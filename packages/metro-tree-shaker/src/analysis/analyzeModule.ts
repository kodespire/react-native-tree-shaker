import type { Binding, NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import {
  dependencyIndex,
  factoryOf,
  inlineInteropAround,
  isObjectCall,
  isWriteTarget,
  literalKey,
  loaderCall,
  Param,
  paramBinding,
  propertyName,
  UnsupportedCodeError,
  type Factory,
} from './metroModule';

/** Babel's CommonJS interop helpers, which wrap a required module object. */
export type InteropHelper = 'interopRequireDefault' | 'interopRequireWildcard';

export interface DependencyInfo {
  /** Whether the dependency marks itself `__esModule`. Undefined when unknown. */
  esModule?: boolean;
  /** The dependency is one of `@babel/runtime`'s interop helpers. */
  helper?: InteropHelper;
}

/** Every export of a dependency may be read, and why. */
export interface ReadsAll {
  all: string;
}
export type DependencyReads = Set<string> | ReadsAll;
export const readsAll = (reads: DependencyReads | undefined): reads is ReadsAll => reads !== undefined && !(reads instanceof Set);

export type ExportsShape =
  /** Exports are only ever written: `exports.X = ...` or `Object.defineProperty(exports, 'X', ...)`. */
  | { kind: 'static'; names: Set<string> }
  /** Something else uses the exports object, so no export can be removed. */
  | { kind: 'pinned'; reason: string };

export interface ModuleAnalysis {
  /** For each dependency the module requires, the export names it reads. An empty set: required only for its side effects. */
  reads: Map<number, DependencyReads>;
  /** Dependencies re-exported wholesale with `export *`. */
  stars: Set<number>;
  /**
   * `module.exports = require(dependency)`: this module is an alias of that
   * dependency. Several when it picks one at runtime, as React's entry does
   * (`module.exports = require(isProduction ? './prod' : './dev')`, in two
   * branches or as a conditional).
   */
  aliases: Set<number>;
  exports: ExportsShape;
  /** The module marks itself `__esModule`. */
  esModule: boolean;
}

/**
 * How a tracked value relates to a dependency's exports object:
 * - `exports`: the object itself;
 * - `defaultWrapper`: `{ default: exports }` (interopRequireDefault of a CommonJS module);
 * - `wildcardCopy`: a copy of the exports, getters copied by descriptor, plus
 *   `default: exports` (interopRequireWildcard of a CommonJS module);
 * - `unknownWrapper`: either of the above or the exports object itself, when
 *   it's unknown whether the dependency is an ES module.
 */
type Shape = 'exports' | 'defaultWrapper' | 'wildcardCopy' | 'unknownWrapper';

interface StarLoop {
  dependency: number;
  /** The loop's key variable (`n` in `for (n in x)` or `Object.keys(x).forEach(function (n) {...})`). */
  key: Binding;
}

/** Bindings and recognizers for one Metro module factory, shared by the analysis and the rewriter. */
export function createContext(factory: Factory, code: string, dependencies: ReadonlyArray<DependencyInfo | undefined>) {
  const loaders = new Map<Binding | undefined, 'require' | 'importDefault' | 'importAll'>([
    [paramBinding(factory, Param.Require), 'require'],
    [paramBinding(factory, Param.ImportDefault), 'importDefault'],
    [paramBinding(factory, Param.ImportAll), 'importAll'],
  ]);
  loaders.delete(undefined);
  const dependencyMap = paramBinding(factory, Param.DependencyMap);
  const moduleObject = paramBinding(factory, Param.Module);
  const exportsObject = paramBinding(factory, Param.Exports);

  /** The dependency a `require(d[k])` call (or a constant holding one) loads. */
  function requiredDependency(path: NodePath): number | undefined {
    if (path.isSequenceExpression()) {
      const expressions = path.get('expressions');
      return requiredDependency(expressions[expressions.length - 1]);
    }
    if (path.isCallExpression()) {
      const callee = path.get('callee');
      const arg = path.get('arguments')[0];
      if (!callee.isIdentifier() || loaders.get(callee.scope.getBinding(callee.node.name)) !== 'require' || !arg?.isMemberExpression()) return undefined;
      const object = arg.get('object');
      if (!object.isIdentifier() || object.scope.getBinding(object.node.name) !== dependencyMap) return undefined;
      const index = dependencyIndex(object);
      return typeof index === 'number' ? index : undefined;
    }
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (!binding || binding.constantViolations.length > 0 || !binding.path.isVariableDeclarator() || !binding.path.node.init) return undefined;
      return requiredDependency(binding.path.get('init') as NodePath);
    }
    return undefined;
  }

  /** Like requiredDependency, also looking through Babel's interop helpers: `t(r(d[k]))` and variables holding it. */
  function loopSource(path: NodePath): number | undefined {
    const direct = requiredDependency(path);
    if (direct !== undefined) return direct;
    if (path.isCallExpression() && path.node.arguments.length >= 1 && interopHelper(path.get('callee'), new Set())) {
      return requiredDependency(path.get('arguments')[0]);
    }
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (!binding || binding.constantViolations.length > 0 || !binding.path.isVariableDeclarator() || !binding.path.node.init) return undefined;
      return loopSource(binding.path.get('init') as NodePath);
    }
    return undefined;
  }

  const isExportsRef = (path: NodePath) => path.isIdentifier() && exportsObject !== undefined && path.scope.getBinding(path.node.name) === exportsObject;

  // --- `export *` loops ------------------------------------------------------

  const starLoops = new Map<t.Node, StarLoop>();
  factory.traverse({
    // Babel: `Object.keys(_y).forEach(function (n) { ... Object.defineProperty(exports, n, { get() { return _y[n] } }) })`
    CallExpression(path) {
      const callee = path.get('callee');
      if (!callee.isMemberExpression() || propertyName(callee.node) !== 'forEach') return;
      const keys = callee.get('object');
      const fn = path.get('arguments')[0];
      if (!isObjectCall(keys, 'keys') || !fn || !(fn.isFunctionExpression() || fn.isArrowFunctionExpression())) return;
      const dependency = loopSource(keys.get('arguments')[0]);
      const param = fn.node.params[0];
      if (dependency === undefined || param?.type !== 'Identifier') return;
      const key = fn.scope.getBinding(param.name);
      if (key && isStarLoopBody(key, dependency)) starLoops.set(path.node, { dependency, key });
    },
    // Metro: `for (var n in r(d[0])) "default" !== n && (e[n] = r(d[0])[n])`
    ForInStatement(path) {
      const dependency = requiredDependency(path.get('right'));
      const left = path.node.left;
      const name = left.type === 'VariableDeclaration' ? (left.declarations[0]?.id as t.Identifier | undefined)?.name : left.type === 'Identifier' ? left.name : undefined;
      if (dependency === undefined || name === undefined) return;
      const key = path.scope.getBinding(name);
      if (key && isStarLoopBody(key, dependency)) starLoops.set(path.node, { dependency, key });
    },
  });

  /** The loop key is only compared, used to index the exports or the dependency, checked with `in`, or passed to `defineProperty`/`hasOwnProperty`. */
  function isStarLoopBody(key: Binding, dependency: number): boolean {
    return key.referencePaths.every((ref) => {
      const parent = ref.parentPath!;
      if (parent.isBinaryExpression() && ['===', '!==', '==', '!='].includes(parent.node.operator)) return true;
      if (parent.isBinaryExpression({ operator: 'in' }) && parent.node.left === ref.node) return isExportsRef(parent.get('right'));
      if (parent.isMemberExpression() && parent.node.computed && parent.node.property === ref.node) {
        const object = parent.get('object');
        return isExportsRef(object) || loopSource(object) === dependency;
      }
      if (isObjectCall(parent, 'defineProperty') && parent.node.arguments[1] === ref.node) return isExportsRef(parent.get('arguments')[0]);
      if (parent.isCallExpression() && parent.node.arguments[1] === ref.node) {
        const callee = parent.node.callee;
        return callee.type === 'MemberExpression' && propertyName(callee) === 'call' && callee.object.type === 'MemberExpression' && propertyName(callee.object) === 'hasOwnProperty';
      }
      return false;
    });
  }

  /** The star loop a path sits in, if it uses that loop's key in an allowed way for the given dependency. */
  function enclosingStarLoop(path: NodePath): StarLoop | undefined {
    for (let p: NodePath | null = path.parentPath; p; p = p.parentPath) {
      const loop = starLoops.get(p.node);
      if (loop) return loop;
    }
    return undefined;
  }

  const usesLoopKey = (node: t.Node, loop: StarLoop) => node.type === 'Identifier' && loop.key.referencePaths.some((r) => r.node === node);

  /**
   * Whether a callee is one of Babel's interop helpers: required from
   * `@babel/runtime` (`r(d[1])`, `r(d[1]).default`, or a variable holding
   * either), or inlined, recognized by the body Babel generates.
   */
  function interopHelper(callee: NodePath, visited: Set<NodePath>): InteropHelper | undefined {
    if (visited.has(callee)) return undefined;
    visited.add(callee);
    if (callee.isSequenceExpression()) {
      const expressions = callee.get('expressions');
      return interopHelper(expressions[expressions.length - 1], visited);
    }
    if (callee.isMemberExpression() && propertyName(callee.node) === 'default') return interopHelper(callee.get('object'), visited);
    if (callee.isCallExpression()) {
      const dependency = requiredDependency(callee);
      return dependency === undefined ? undefined : dependencies[dependency]?.helper;
    }
    if (callee.isIdentifier()) {
      const b = callee.scope.getBinding(callee.node.name);
      if (!b || b.constantViolations.length > 0) return undefined;
      if (b.path.isVariableDeclarator() && b.path.node.init) return interopHelper(b.path.get('init') as NodePath, visited);
      if (b.path.isFunctionDeclaration()) return inlinedHelper(b.path);
      return undefined;
    }
    if (callee.isFunctionExpression() || callee.isArrowFunctionExpression()) return inlinedHelper(callee);
    return undefined;
  }

  /** Babel's inlined helpers, by the checks only they make. */
  function inlinedHelper(fn: NodePath<t.Function>): InteropHelper | undefined {
    const source = code.slice(fn.node.start!, fn.node.end!);
    if (!source.includes('__esModule')) return undefined;
    // Copies getters by descriptor: `(r=Object.getOwnPropertyDescriptor(e,s))&&(r.get||r.set)?o(l,s,r):l[s]=e[s]`,
    // or, in babel-preset-expo's version, `var u=Object.getOwnPropertyDescriptor(e,n);Object.defineProperty(t,n,u.get?u:{…})`.
    if (source.includes('getOwnPropertyDescriptor') && /\.get\s*(\|\|\s*[\w$]+\.set|\?)/.test(source)) return 'interopRequireWildcard';
    // `function(e){return e&&e.__esModule?e:{default:e}}`
    if (source.length < 120 && /\{\s*["']?default["']?\s*:\s*[\w$]+\s*\}/.test(source)) return 'interopRequireDefault';
    return undefined;
  }

  return { factory, loaders, dependencyMap, moduleObject, exportsObject, requiredDependency, loopSource, interopHelper, isExportsRef, starLoops, enclosingStarLoop, usesLoopKey };
}

export type ModuleContext = ReturnType<typeof createContext>;

/**
 * What one Metro module reads from each of its dependencies, and how it
 * defines its own exports, in Metro's transformed output. Works for both
 * dialects Metro produces: Babel's CommonJS transform and Metro's own
 * import/export lowering. Reads that can't be followed make that one
 * dependency `all`; uses of the exports object that can't be followed pin
 * this module's exports.
 */
export function analyzeModule(code: string, dependencies: ReadonlyArray<DependencyInfo | undefined>): ModuleAnalysis {
  const factory = factoryOf(code);
  const { loaders, dependencyMap, moduleObject, exportsObject, requiredDependency, interopHelper, isExportsRef, starLoops, enclosingStarLoop, usesLoopKey } =
    createContext(factory, code, dependencies);

  /** The dependencies `module.exports = <right>` makes this module an alias of, or undefined if it isn't only requires. */
  function aliasTargets(right: NodePath): number[] | undefined {
    if (right.isConditionalExpression()) {
      const [a, b] = [aliasTargets(right.get('consequent')), aliasTargets(right.get('alternate'))];
      return a && b ? [...a, ...b] : undefined;
    }
    const dependency = requiredDependency(right);
    return dependency === undefined ? undefined : [dependency];
  }

  const reads = new Map<number, DependencyReads>();
  const stars = new Set<number>();
  const aliases = new Set<number>();

  // --- Exports ----------------------------------------------------------------

  const exportNames = new Set<string>();
  let esModule = false;
  let pinned: string | undefined;
  const pin = (reason: string) => {
    pinned ??= reason;
  };
  const defineExport = (name: string) => (name === '__esModule' ? (esModule = true) : exportNames.add(name));

  for (const ref of exportsObject?.referencePaths ?? []) {
    const parent = ref.parentPath!;
    const loop = enclosingStarLoop(ref);
    if (loop) {
      const allowed =
        (parent.isMemberExpression() && parent.node.computed && usesLoopKey(parent.node.property, loop)) ||
        (parent.isBinaryExpression({ operator: 'in' }) && usesLoopKey(parent.node.left, loop)) ||
        (isObjectCall(parent, 'defineProperty') && usesLoopKey(parent.node.arguments[1], loop)) ||
        // `Object.prototype.hasOwnProperty.call(exports, key)`: an own export shadows the star's (babel-preset-expo).
        (isHasOwnPropertyCall(parent, ref.node) && usesLoopKey((parent.node as t.CallExpression).arguments[1], loop));
      if (allowed) continue;
    }
    if (parent.isMemberExpression() && parent.node.object === ref.node) {
      const name = propertyName(parent.node);
      if (name === undefined) pin('uses its exports object with a computed key');
      else if (parent.parentPath!.isAssignmentExpression({ operator: '=' }) && parent.parentPath!.node.left === parent.node) defineExport(name);
      else pin(`reads its own export ${name}`);
    } else if (isObjectCall(parent, 'defineProperty') && parent.node.arguments[0] === ref.node) {
      const name = literalKey(parent.node.arguments[1]);
      if (name === undefined) pin('defines an export with a computed name');
      else defineExport(name);
    } else {
      pin(`passes its exports object to a ${parent.type}`);
    }
  }

  for (const ref of moduleObject?.referencePaths ?? []) {
    const member = ref.parentPath!;
    if (member.isMemberExpression() && member.node.object === ref.node && propertyName(member.node) === 'exports') {
      const assignment = member.parentPath!;
      if (assignment.isAssignmentExpression({ operator: '=' }) && assignment.node.left === member.node) {
        const targets = aliasTargets(assignment.get('right'));
        for (const t of targets ?? []) aliases.add(t);
        pin(targets !== undefined ? 're-exports another module wholesale' : 'replaces module.exports');
      } else {
        pin('uses module.exports');
      }
    } else {
      pin('uses its module object');
    }
  }

  // --- Reads ------------------------------------------------------------------

  function track(dependency: number, start: NodePath, shape: Shape) {
    const names = reads.get(dependency) as Set<string>;
    const seen = new Map<Binding, Set<Shape>>();
    const inlineInterops = new Set<t.Node>();
    const firstVisit = (binding: Binding, s: Shape) => {
      const shapes = seen.get(binding) ?? new Set<Shape>();
      if (shapes.has(s)) return false;
      seen.set(binding, shapes.add(s));
      return true;
    };

    function value(at: NodePath, s: Shape): void {
      // `(n = x) && n.__esModule ? n : {default: n}`: Babel's interopRequireDefault, inlined by the minifier.
      const inline = s === 'exports' ? inlineInteropAround(at) : null;
      if (inline) {
        if (inlineInterops.has(inline.node)) return; // one of its other references to the module
        inlineInterops.add(inline.node);
        const target = dependencies[dependency]?.esModule;
        return value(inline, target === true ? 'exports' : target === false ? 'defaultWrapper' : 'unknownWrapper');
      }
      let v = at;
      for (;;) {
        const parent = v.parentPath!;
        if (parent.isSequenceExpression()) {
          const expressions = parent.node.expressions;
          if (expressions[expressions.length - 1] !== v.node) return; // value discarded
          v = parent;
        } else if (parent.isParenthesizedExpression() || (parent.isConditionalExpression() && parent.node.test !== v.node) || parent.isLogicalExpression()) {
          v = parent;
        } else {
          break;
        }
      }

      const parent = v.parentPath!;
      if ((parent.isMemberExpression() || parent.isOptionalMemberExpression()) && parent.node.object === v.node) {
        const loop = enclosingStarLoop(parent);
        if (loop?.dependency === dependency && parent.node.computed && usesLoopKey(parent.node.property, loop)) return; // `x[n]` in an export * loop
        const name = propertyName(parent.node);
        if (name === undefined) throw new UnsupportedCodeError('reads the module with a computed key');
        if (isWriteTarget(parent)) throw new UnsupportedCodeError(`assigns to the module's export ${name}`);
        // `var x = r(d[0]).x` with x never used: reading an ES module's export has
        // no effect. A CommonJS module's getter might (react-native's require modules).
        if (dependencies[dependency]?.esModule === true && valueUnused(parent)) return;
        if (s === 'exports') names.add(name);
        else if (name === 'default') {
          if (s === 'unknownWrapper') names.add('default');
          value(parent, 'exports');
        } else if (s !== 'defaultWrapper') names.add(name);
        return;
      }
      if (parent.isExpressionStatement()) return; // required for its side effects only
      // Only its truthiness is read: `x ? a : b`, `if (x)`, `!x`.
      if ((parent.isConditionalExpression() || parent.isIfStatement()) && parent.node.test === v.node) return;
      if (parent.isUnaryExpression({ operator: '!' })) return;

      if (parent.isVariableDeclarator() && parent.node.init === v.node) {
        const id = parent.get('id');
        if (id.isIdentifier()) return binding(parent.scope.getBinding(id.node.name), parent, s);
        if (id.isObjectPattern()) return pattern(id, s);
      }
      if (parent.isAssignmentExpression({ operator: '=' }) && parent.node.right === v.node) {
        const left = parent.get('left');
        if (left.isIdentifier()) {
          binding(parent.scope.getBinding(left.node.name), parent, s);
          // `f(x = r(d[0]))`: the assignment's own value goes on too.
          if (!valueUnused(parent)) value(parent, s);
          return;
        }
        // `module.exports = require(x)`: importers of this module read x directly.
        if (s === 'exports' && left.isMemberExpression() && propertyName(left.node) === 'exports') {
          const object = left.get('object');
          const isModuleExports = object.isIdentifier() && moduleObject !== undefined && object.scope.getBinding(object.node.name) === moduleObject;
          if (isModuleExports && aliasTargets(parent.get('right'))?.includes(dependency)) return;
        }
      }
      // `export *`: the loop reads exports by key, handled through `stars`.
      if (isObjectCall(parent, 'keys') && starLoops.has(parent.parentPath!.parentPath!.node)) {
        stars.add(dependency);
        return;
      }
      if (parent.isForInStatement() && starLoops.has(parent.node) && starLoops.get(parent.node)!.dependency === dependency) {
        stars.add(dependency);
        return;
      }
      // Wrapped by Babel's interop helper: `import RN, { View } from 'x'`.
      if (s === 'exports' && parent.isCallExpression() && parent.node.arguments[0] === v.node) {
        const helper = interopHelper(parent.get('callee'), new Set());
        if (helper) {
          const target = dependencies[dependency]?.esModule;
          // The helpers return an ES module unchanged.
          const wrapped: Shape = target === true ? 'exports' : target === false ? (helper === 'interopRequireDefault' ? 'defaultWrapper' : 'wildcardCopy') : 'unknownWrapper';
          return value(parent, wrapped);
        }
      }
      // Returned from a function, as in Babel's lazy-import helper:
      // `function n(){var t=r(d[0]);return n=function(){return t},t}`, used as `n().View`.
      if (parent.isReturnStatement()) return callsTo(parent.getFunctionParent()!, s);
      if (parent.isArrowFunctionExpression() && parent.node.body === v.node) return callsTo(parent, s);
      throw new UnsupportedCodeError(`passes the module's exports object to a ${parent.type}`);
    }

    /** Follows every call of a function that returns the value. */
    function callsTo(fn: NodePath<t.Function>, s: Shape) {
      const parent = fn.parentPath!;
      let name: string | undefined;
      if (fn.isFunctionDeclaration()) name = fn.node.id?.name;
      else if (parent.isAssignmentExpression({ operator: '=' }) && parent.node.right === fn.node && parent.node.left.type === 'Identifier') name = parent.node.left.name;
      else if (parent.isVariableDeclarator() && parent.node.init === fn.node && parent.node.id.type === 'Identifier') name = parent.node.id.name;

      const b = name === undefined ? undefined : parent.scope.getBinding(name);
      if (!b) throw new UnsupportedCodeError('returns the module from a function that is never named');
      if (!firstVisit(b, s)) return;
      for (const ref of b.referencePaths) {
        const call = ref.parentPath!;
        if (call.isCallExpression() && call.node.callee === ref.node) value(call, s);
        else throw new UnsupportedCodeError(`passes ${name}(), which returns the module, to a ${call.type}`);
      }
    }

    function binding(b: Binding | undefined, origin: NodePath, s: Shape) {
      if (!b) throw new UnsupportedCodeError('assigns the module to a global');
      if (!firstVisit(b, s)) return;
      if (b.constantViolations.some((v) => v !== origin)) {
        throw new UnsupportedCodeError(`reassigns the variable holding the module (${b.identifier.name})`);
      }
      for (const ref of b.referencePaths) value(ref, s);
    }

    function pattern(p: NodePath<t.ObjectPattern>, s: Shape) {
      for (const property of p.get('properties')) {
        if (property.isRestElement()) throw new UnsupportedCodeError('destructures the module with a rest element');
        const node = property.node as t.ObjectProperty;
        const name = !node.computed && node.key.type === 'Identifier' ? node.key.name : literalKey(node.key);
        if (name === undefined) throw new UnsupportedCodeError('destructures the module with a computed key');
        if (s !== 'exports' && name === 'default') {
          if (s === 'unknownWrapper') names.add('default');
          const target = (property as NodePath<t.ObjectProperty>).get('value');
          if (!target.isIdentifier()) throw new UnsupportedCodeError('destructures the module with a nested pattern');
          binding(target.scope.getBinding(target.node.name), p.parentPath!, 'exports');
        } else if (s !== 'defaultWrapper') {
          names.add(name);
        }
      }
    }

    value(start, shape);
  }

  const all = (dependency: number, reason: string) => reads.set(dependency, { all: reason });

  for (const ref of dependencyMap?.referencePaths ?? []) {
    const index = dependencyIndex(ref);
    if (index === 'paths') continue;
    if (index === undefined) {
      for (let i = 0; i < dependencies.length; i++) all(i, 'uses its dependency map dynamically');
      break;
    }
    if (readsAll(reads.get(index))) continue;
    if (!reads.has(index)) reads.set(index, new Set());
    if (dependencies[index]?.helper) {
      all(index, 'is an interop helper');
      continue;
    }

    const call = loaderCall(ref.parentPath as NodePath);
    const loader = call && loaders.get(call.scope.getBinding((call.node.callee as t.Identifier).name));
    if (!call || !loader) {
      all(index, "uses the module's ID outside a require call");
      continue;
    }
    const esModuleTarget = dependencies[index]?.esModule;
    try {
      if (loader === 'importAll') {
        if (esModuleTarget !== true) throw new UnsupportedCodeError('imports a CommonJS module with importAll, which reads every export');
        track(index, call, 'exports');
      } else if (loader === 'importDefault') {
        // Returns `exports.default` of an ES module, or the exports object itself.
        if (esModuleTarget !== false && !valueUnused(call)) (reads.get(index) as Set<string>).add('default');
        if (esModuleTarget !== true) track(index, call, 'exports');
      } else {
        track(index, call, 'exports');
      }
    } catch (error) {
      if (!(error instanceof UnsupportedCodeError)) throw error;
      all(index, error.message);
    }
  }

  return {
    reads,
    stars,
    aliases,
    exports: pinned === undefined ? { kind: 'static', names: exportNames } : { kind: 'pinned', reason: pinned },
    esModule,
  };
}

/** `Object.prototype.hasOwnProperty.call(object, key)` or `{}.hasOwnProperty.call(object, key)`. */
function isHasOwnPropertyCall(call: NodePath, object: t.Node): boolean {
  if (!call.isCallExpression() || call.node.arguments[0] !== object) return false;
  const callee = call.node.callee;
  if (callee.type !== 'MemberExpression' || propertyName(callee) !== 'call') return false;
  const method = callee.object;
  return method.type === 'MemberExpression' && propertyName(method) === 'hasOwnProperty';
}

/** Whether an expression's value is thrown away: a statement, or a variable nothing reads. */
function valueUnused(at: NodePath): boolean {
  let v = at;
  for (;;) {
    const parent = v.parentPath!;
    if (parent.isSequenceExpression()) {
      const expressions = parent.node.expressions;
      if (expressions[expressions.length - 1] !== v.node) return true;
      v = parent;
    } else if (parent.isParenthesizedExpression()) {
      v = parent;
    } else {
      break;
    }
  }
  const parent = v.parentPath!;
  if (parent.isExpressionStatement() || parent.isUnaryExpression({ operator: 'void' })) return true;
  if (parent.isVariableDeclarator() && parent.node.init === v.node && parent.node.id.type === 'Identifier') {
    const binding = parent.scope.getBinding(parent.node.id.name);
    return binding !== undefined && binding.referencePaths.length === 0 && binding.constantViolations.length === 0;
  }
  return false;
}

export type { Factory };
