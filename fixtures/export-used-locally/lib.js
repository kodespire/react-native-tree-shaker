const make = () => () => 'made';

// Babel compiles this to `var helper = exports.helper = make()`.
export const helper = make();

export function run() {
  return helper();
}
