import generateModule from '@babel/generator';
import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createContext, type DependencyInfo, type ModuleContext } from '../analysis/analyzeModule';
import {
  dependencyIndex,
  factoryOf,
  inlineInteropAround,
  inlineInteropSource,
  isObjectCall,
  isWriteTarget,
  literalKey,
  loaderCall,
  propertyName,
} from '../analysis/metroModule';

const generate: typeof generateModule = (generateModule as any).default ?? generateModule;

export interface Edits {
  /** Exports nobody reads. */
  removeExports: ReadonlySet<string>;
  /** `export *` loops, by dependency index, whose re-exports nobody reads. */
  dropStars: ReadonlySet<number>;
  /** Dependencies whose requires can go wherever their value is unused: side-effect-free modules. */
  dropRequires: ReadonlySet<number>;
  /** Whether a dependency may have side effects, so its require stays when an export's value is dropped. */
  hasSideEffects(index: number): boolean;
}

export interface EditResult {
  code: string;
  /** Maps the edited code back to the input code (whose name is `filename`). */
  map: { version: number; sources: string[]; names: string[]; mappings: string; file?: string };
}

/**
 * Removes unused exports, unused `export *` loops and unused requires from a
 * Metro module, keeping any side effects their values had. Returns null when
 * nothing changed. Dead code left behind (functions only an export used) is
 * for the minifier to remove.
 */
export function editModule(code: string, filename: string, dependencies: ReadonlyArray<DependencyInfo | undefined>, edits: Edits): EditResult | null {
  const factory = factoryOf(code);
  const ctx = createContext(factory, code, dependencies);
  let changed = false;

  // --- Exports ----------------------------------------------------------------
  const assignments = new Set<t.Node>();
  const definitions = new Set<t.Node>();
  for (const ref of ctx.exportsObject?.referencePaths ?? []) {
    const parent = ref.parentPath!;
    if (parent.isMemberExpression() && parent.node.object === ref.node) {
      const name = propertyName(parent.node);
      const assignment = parent.parentPath!;
      if (name !== undefined && edits.removeExports.has(name) && assignment.isAssignmentExpression({ operator: '=' }) && assignment.node.left === parent.node) {
        assignments.add(assignment.node);
      }
    } else if (isObjectCall(parent, 'defineProperty') && parent.node.arguments[0] === ref.node) {
      const name = literalKey(parent.node.arguments[1]);
      if (name !== undefined && edits.removeExports.has(name)) definitions.add(parent.node);
    }
  }

  // --- export * loops ---------------------------------------------------------
  const loops = new Set([...ctx.starLoops].filter(([, loop]) => edits.dropStars.has(loop.dependency)).map(([node]) => node));

  if (assignments.size > 0 || definitions.size > 0 || loops.size > 0) {
    factory.traverse({
      // Exit, so `e.a = e.b = void 0` loses its inner assignment first.
      AssignmentExpression: {
        exit(path) {
          if (!assignments.has(path.node)) return;
          // `p = e.x = y`, as Babel compiles an export the module also uses: keep the value.
          path.replaceWith(isDiscarded(path) ? residue(path.get('right'), ctx, edits) : path.node.right);
          changed = true;
        },
      },
      CallExpression: {
        exit(path) {
          if (definitions.has(path.node)) {
            // A getter or value descriptor: no side effects. defineProperty returns its object.
            path.replaceWith(isDiscarded(path) ? voidZero() : t.cloneNode(path.node.arguments[0] as t.Expression));
            changed = true;
          } else if (loops.has(path.node)) {
            // `Object.keys(x).forEach(...)`: keep only x's side effects. forEach returns undefined.
            const kept = residueOfSource(path.get('callee.object.arguments.0') as NodePath, ctx, edits);
            path.replaceWith(kept && !isDiscarded(path) ? t.sequenceExpression([kept, voidZero()]) : (kept ?? voidZero()));
            changed = true;
          }
        },
      },
      ForInStatement: {
        exit(path) {
          if (!loops.has(path.node)) return;
          // `for (n in a, b, r(d[k]))`: keep a, b, and the require if it has side effects.
          const right = path.get('right');
          const expressions = right.isSequenceExpression() ? right.get('expressions') : [right];
          const kept = expressions.slice(0, -1).map((e) => e.node);
          const source = residueOfSource(expressions[expressions.length - 1], ctx, edits);
          if (source) kept.push(source);
          if (kept.length === 0) path.remove();
          else path.replaceWith(t.expressionStatement(kept.length === 1 ? kept[0] : t.sequenceExpression(kept)));
          changed = true;
        },
      },
    });
    factory.scope.crawl();
  }

  // --- Unused requires of side-effect-free modules ----------------------------
  // Planned ones, and any that removing exports just left unused.
  const droppable = (index: number) => edits.dropRequires.has(index) || (changed && !edits.hasSideEffects(index));
  if (edits.dropRequires.size > 0 || changed) {
    const fresh = createContext(factory, code, dependencies);
    const dead = new Set<NodePath>();
    for (const ref of fresh.dependencyMap?.referencePaths ?? []) {
      const index = dependencyIndex(ref);
      if (typeof index !== 'number' || !droppable(index) || !ref.parentPath) continue;
      const call = loaderCall(ref.parentPath);
      if (!call || call.node.arguments[0] !== ref.parentPath.node) continue;
      for (const use of deadUses(call, fresh) ?? []) dead.add(use);
    }
    // Outermost first: a dead expression may contain another.
    for (const use of [...dead].sort((a, b) => a.node.start! - b.node.start! || b.node.end! - a.node.end!)) {
      if (use.node && !use.findParent((p) => dead.has(p))) {
        use.replaceWith(voidZero());
        changed = true;
      }
    }
  }

  if (!changed) return null;
  const file = factory.findParent((p) => p.isProgram())!.parent as t.File;
  const result = generate(file, { sourceMaps: true, sourceFileName: filename, comments: true, compact: true }, code);
  return { code: result.code, map: result.map as EditResult['map'] };
}

const voidZero = () => t.unaryExpression('void', t.numericLiteral(0));

/** `void 0` itself, or whatever side effects an export's value had. */
function residue(value: NodePath, ctx: ModuleContext, edits: Edits): t.Expression {
  return residueOfSource(value, ctx, edits) ?? voidZero();
}

/**
 * What to keep of an expression whose value is no longer needed: nothing,
 * or its require when the module may have side effects. Reading an export
 * has none.
 */
function residueOfSource(source: NodePath, ctx: ModuleContext, edits: Edits): t.Expression | null {
  if (isPure(source)) return null;
  const loaded = moduleUnder(source, ctx);
  if (loaded === 'variable') return null; // the require stays where the variable is set
  if (loaded) return edits.hasSideEffects(loaded.index) ? t.cloneNode(loaded.call.node) : null;
  return source.node as t.Expression;
}

/**
 * The module an expression reads: `r(d[k])`, `i(d[k])` or `a(d[k])`, possibly
 * behind member reads (`r(d[k]).a.b`) or an interop helper (`t(r(d[k]))`), or
 * `'variable'` for reads of a variable holding one.
 */
function moduleUnder(
  value: NodePath,
  ctx: ModuleContext,
  seen = new Set<NodePath>(),
): { call: NodePath<t.CallExpression>; index: number } | 'variable' | null {
  let v = value;
  while (v.isMemberExpression() && !v.node.computed) v = v.get('object');
  const inline = inlineInteropSource(v);
  if (inline) return moduleUnder(inline, ctx, seen);
  if (v.isIdentifier()) {
    const binding = v.scope.getBinding(v.node.name);
    if (!binding || binding.constantViolations.length > 0 || !binding.path.isVariableDeclarator() || seen.has(binding.path)) return null;
    const init = binding.path.get('init');
    if (!init.node) return null;
    seen.add(binding.path);
    return moduleUnder(init as NodePath, ctx, seen) ? 'variable' : null;
  }
  if (v.isCallExpression() && v.node.arguments.length >= 1 && ctx.interopHelper(v.get('callee'), new Set())) v = v.get('arguments')[0];
  if (!v.isCallExpression()) return null;
  const callee = v.get('callee');
  const member = v.get('arguments')[0];
  if (!callee.isIdentifier() || !ctx.loaders.has(callee.scope.getBinding(callee.node.name)) || !member?.isMemberExpression()) return null;
  const object = member.get('object');
  if (!object.isIdentifier() || object.scope.getBinding(object.node.name) !== ctx.dependencyMap) return null;
  const index = dependencyIndex(object);
  return typeof index === 'number' ? { call: v, index } : null;
}

/** Whether evaluating an expression can't have side effects (reads of local bindings count as pure). */
function isPure(path: NodePath): boolean {
  const node = path.node;
  if (t.isLiteral(node) && !t.isTemplateLiteral(node)) return true;
  if (t.isTemplateLiteral(node)) return node.expressions.length === 0;
  if (t.isIdentifier(node)) return node.name === 'undefined' || path.scope.hasBinding(node.name, { noGlobals: true });
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) return true;
  if (t.isUnaryExpression(node) && ['void', '!', '-', '+', 'typeof'].includes(node.operator)) return isPure(path.get('argument') as NodePath);
  if (t.isSequenceExpression(node)) return (path.get('expressions') as NodePath[]).every(isPure);
  if (t.isConditionalExpression(node) || t.isLogicalExpression(node) || t.isBinaryExpression(node)) {
    const parts = t.isConditionalExpression(node) ? ['test', 'consequent', 'alternate'] : ['left', 'right'];
    return parts.every((key) => isPure(path.get(key) as NodePath));
  }
  if (t.isArrayExpression(node)) return (path.get('elements') as NodePath[]).every((e) => e.node !== null && !e.isSpreadElement() && isPure(e));
  if (t.isObjectExpression(node)) {
    return (path.get('properties') as NodePath[]).every((p) => {
      if (p.isObjectMethod()) return !p.node.computed || isPure(p.get('key') as NodePath);
      if (!p.isObjectProperty()) return false;
      return (!p.node.computed || isPure(p.get('key') as NodePath)) && isPure(p.get('value') as NodePath);
    });
  }
  // `(() => { const a = x => …; return y => … })()`, as typia and other code generators emit.
  if (t.isCallExpression(node) && (t.isArrowFunctionExpression(node.callee) || t.isFunctionExpression(node.callee))) {
    if (node.callee.async || node.callee.generator) return false;
    // Default values and destructuring in parameters run code.
    if (!node.callee.params.every((p) => t.isIdentifier(p) || (t.isRestElement(p) && t.isIdentifier(p.argument)))) return false;
    if (!(path.get('arguments') as NodePath[]).every((a) => !a.isSpreadElement() && isPure(a))) return false;
    const body = path.get('callee.body') as NodePath;
    if (!body.isBlockStatement()) return isPure(body);
    return body.get('body').every((statement) => {
      if (statement.isFunctionDeclaration() || statement.isEmptyStatement()) return true;
      // Destructuring can run getters or iterators, or throw.
      if (statement.isVariableDeclaration()) {
        return statement.get('declarations').every((d) => t.isIdentifier(d.node.id) && (!d.node.init || isPure(d.get('init') as NodePath)));
      }
      if (statement.isReturnStatement()) return !statement.node.argument || isPure(statement.get('argument') as NodePath);
      return false;
    });
  }
  if (t.isClassExpression(node)) {
    if (node.superClass && !isPure(path.get('superClass') as NodePath)) return false;
    return node.body.body.every((member) => {
      if (t.isStaticBlock(member)) return false;
      if ('computed' in member && member.computed) return false;
      if ((t.isClassProperty(member) || t.isClassPrivateProperty(member)) && member.static && member.value) return false;
      return true;
    });
  }
  return false;
}

/**
 * The expressions to replace with `void 0` to remove a value nothing uses, or
 * null if something might. A value is unused when it's thrown away, or only
 * goes through member reads, interop helpers and variables that end up thrown
 * away (`var c = r(d[0]), a = helper(c)` with `a` unused).
 */
function deadUses(value: NodePath, ctx: ModuleContext, seen = new Set<Binding>()): NodePath[] | null {
  const inline = inlineInteropAround(value);
  if (inline) return deadUses(inline, ctx, seen);
  const parent = value.parentPath!;
  if (isDiscarded(value)) return [value];
  // A property of an object nothing uses: replace just this value, keeping the others' side effects.
  if (parent.isObjectProperty() && parent.node.value === value.node && parent.parentPath!.isObjectExpression()) {
    return deadUses(parent.parentPath!, ctx, seen) ? [value] : null;
  }
  if (parent.isMemberExpression() && parent.node.object === value.node && !isWriteTarget(parent)) return deadUses(parent, ctx, seen);
  if (parent.isCallExpression() && parent.node.arguments[0] === value.node && ctx.interopHelper(parent.get('callee'), new Set())) {
    return deadUses(parent, ctx, seen);
  }
  if (parent.isVariableDeclarator() && parent.node.init === value.node && parent.node.id.type === 'Identifier') {
    const binding = parent.scope.getBinding(parent.node.id.name);
    if (!binding || binding.constantViolations.length > 0) return null;
    if (seen.has(binding)) return [];
    seen.add(binding);
    const uses: NodePath[] = [value];
    for (const ref of binding.referencePaths) {
      const more = deadUses(ref, ctx, seen);
      if (!more) return null;
      uses.push(...more);
    }
    return uses;
  }
  return null;
}

function isDiscarded(path: NodePath): boolean {
  const parent = path.parentPath!;
  if (parent.isExpressionStatement()) return true;
  if (parent.isSequenceExpression()) {
    const expressions = parent.node.expressions;
    return expressions[expressions.length - 1] !== path.node || isDiscarded(parent);
  }
  return false;
}
