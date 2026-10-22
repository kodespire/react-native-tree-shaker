exports.greet = (name) => `hello ${name}`;
exports.greetAll = (names) => names.map((n) => exports.greet(n)).join(', ');
exports.unused = 'unused';
