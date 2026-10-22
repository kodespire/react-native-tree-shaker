import { parse } from '@babel/parser';
import traverseModule, { type Binding, type NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

// CommonJS and ESM loaders disagree on where the function lives.
export const traverse: typeof traverseModule = (traverseModule as any).default ?? traverseModule;

/**
 * Parameter positions in Metro's module factory:
 * `__d(function (global, require, importDefault, importAll, module, exports, dependencyMap) {...})`.
 * Minifiers rename the parameters, so they are found by position.
 */
export const Param = {
  Require: 1,
  ImportDefault: 2,
  ImportAll: 3,
  Module: 4,
  Exports: 5,
  DependencyMap: 6,
} as const;
type Param = (typeof Param)[keyof typeof Param];

/** Thrown when code doesn't have a shape the analysis can follow. */
export class UnsupportedCodeError extends Error {}

export type Factory = NodePath<t.FunctionExpression | t.ArrowFunctionExpression>;

/** The module factory inside Metro's `__d(function (...) {...})` wrapper. */
export function factoryOf(code: string): Factory {
  const ast = parse(code, { sourceType: 'script', allowReturnOutsideFunction: true });
  let factory: Factory | undefined;
  traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      // `__d(...)`, or `<globalPrefix>__d(...)`
      if (callee.type === 'Identifier' && callee.name.endsWith('__d') && args[0] && /Function/.test(args[0].type)) {
        factory = path.get('arguments.0') as Factory;
        path.stop();
      }
    },
  });
  if (!factory) throw new UnsupportedCodeError('is not a Metro module definition');
  return factory;
}

export function paramBinding(factory: Factory, position: Param): Binding | undefined {
  const param = factory.node.params[position];
  return param?.type === 'Identifier' ? factory.scope.getBinding(param.name) : undefined;
}

/** For a reference to the dependency map: the literal index in `d[N]`, `'paths'` for `d.paths`, otherwise undefined. */
export function dependencyIndex(ref: NodePath): number | 'paths' | undefined {
  const parent = ref.parentPath;
  if (!parent?.isMemberExpression() || parent.node.object !== ref.node) return undefined;
  const { property, computed } = parent.node;
  if (!computed && property.type === 'Identifier' && property.name === 'paths') return 'paths';
  if (computed && property.type === 'NumericLiteral') return property.value;
  return undefined;
}

/** The require/importDefault/importAll call whose argument contains this `d[N]`, looking through `c ? d[1] : d[2]`. */
export function loaderCall(member: NodePath): NodePath<t.CallExpression> | null {
  let arg = member;
  while (arg.parentPath?.isConditionalExpression() && arg.parentPath.node.test !== arg.node) arg = arg.parentPath;
  const call = arg.parentPath;
  if (call?.isCallExpression() && call.node.arguments[0] === arg.node && call.node.callee.type === 'Identifier') return call;
  return null;
}

export function propertyName(member: t.MemberExpression | t.OptionalMemberExpression): string | undefined {
  if (!member.computed) return member.property.type === 'Identifier' ? member.property.name : undefined;
  return literalKey(member.property);
}

export function literalKey(node: t.Node): string | undefined {
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'NumericLiteral') return String(node.value);
  return undefined;
}

export function isWriteTarget(member: NodePath): boolean {
  const parent = member.parentPath!;
  return (
    (parent.isAssignmentExpression() && parent.node.left === member.node) ||
    parent.isUpdateExpression() ||
    parent.isUnaryExpression({ operator: 'delete' })
  );
}

/** `Object.<name>(...)` with the global `Object`. */
export function isObjectCall(call: NodePath, name: string): call is NodePath<t.CallExpression> {
  if (!call.isCallExpression()) return false;
  const callee = call.node.callee;
  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Object' &&
    !call.scope.hasBinding('Object', { noGlobals: true }) &&
    propertyName(callee) === name
  );
}

/**
 * Babel's `interopRequireDefault` as the minifier inlines it into an
 * expression: `x && x.__esModule ? x : {default: x}`, or with a temporary,
 * `(n = x) && n.__esModule ? n : {default: n}`.
 */
function inlineInteropDefault(cond: NodePath): { name: string; assigned: boolean } | null {
  if (!cond.isConditionalExpression()) return null;
  const { test, consequent, alternate } = cond.node;
  if (test.type !== 'LogicalExpression' || test.operator !== '&&') return null;
  const left = test.left;
  let name: string;
  let assigned = false;
  if (left.type === 'AssignmentExpression' && left.operator === '=' && left.left.type === 'Identifier') {
    name = left.left.name;
    assigned = true;
  } else if (left.type === 'Identifier') {
    name = left.name;
  } else {
    return null;
  }
  const isName = (node: t.Node) => node.type === 'Identifier' && node.name === name;
  const right = test.right;
  if (right.type !== 'MemberExpression' || !isName(right.object) || propertyName(right) !== '__esModule') return null;
  if (!isName(consequent) || alternate.type !== 'ObjectExpression' || alternate.properties.length !== 1) return null;
  const prop = alternate.properties[0];
  if (prop.type !== 'ObjectProperty' || prop.computed || literalKey(prop.key) !== 'default' && !(prop.key.type === 'Identifier' && prop.key.name === 'default')) return null;
  return isName(prop.value) ? { name, assigned } : null;
}

/** Whether `ref` is one of the pattern's own references to its variable. */
function inPatternPosition(cond: NodePath<t.ConditionalExpression>, ref: t.Node): boolean {
  const { test, consequent, alternate } = cond.node as t.ConditionalExpression & { test: t.LogicalExpression };
  const left = test.left.type === 'AssignmentExpression' ? test.left.left : test.left;
  const object = (test.right as t.MemberExpression).object;
  const value = ((alternate as t.ObjectExpression).properties[0] as t.ObjectProperty).value;
  return ref === left || ref === object || ref === consequent || ref === value;
}

/** The inlined interop expression around `ref`, if `ref` is one of its references. */
function enclosingInlineInterop(ref: NodePath): NodePath<t.ConditionalExpression> | null {
  let p = ref.parentPath;
  for (let depth = 0; p && depth < 4; depth++, p = p.parentPath) {
    if (p.isConditionalExpression()) return inlineInteropDefault(p) && inPatternPosition(p, ref.node) ? p : null;
  }
  return null;
}

/**
 * If `value` is the module inside an inlined `interopRequireDefault`, the
 * whole expression. With a temporary, only when every use of the temporary is
 * inside such an expression that assigns it first, so no use can see a value
 * assigned by another.
 */
export function inlineInteropAround(value: NodePath): NodePath<t.ConditionalExpression> | null {
  const assignment = value.parentPath;
  if (assignment?.isAssignmentExpression({ operator: '=' }) && assignment.node.right === value.node) {
    const test = assignment.parentPath;
    const cond = test?.parentPath;
    if (!test?.isLogicalExpression({ operator: '&&' }) || test.node.left !== assignment.node || !cond?.isConditionalExpression()) return null;
    const pattern = inlineInteropDefault(cond);
    if (!pattern?.assigned) return null;
    const binding = cond.scope.getBinding(pattern.name);
    if (!binding) return null;
    const assignsFirst = (path: NodePath) => {
      const c = enclosingInlineInterop(path);
      return c !== null && inlineInteropDefault(c)?.assigned === true;
    };
    const ownAssignment = (v: NodePath) => v.isAssignmentExpression() && assignsFirst(v.get('left') as NodePath);
    if (!binding.referencePaths.every(assignsFirst) || !binding.constantViolations.every(ownAssignment)) return null;
    return cond;
  }
  if (!value.isIdentifier()) return null;
  const cond = enclosingInlineInterop(value);
  return cond && inlineInteropDefault(cond)?.assigned === false ? cond : null;
}

/** The module value an inlined `interopRequireDefault` expression wraps, if `cond` is one. */
export function inlineInteropSource(cond: NodePath): NodePath | null {
  const pattern = inlineInteropDefault(cond);
  if (!pattern) return null;
  const source = (pattern.assigned ? cond.get('test.left.right') : cond.get('test.left')) as NodePath;
  return inlineInteropAround(source)?.node === cond.node ? source : null;
}
