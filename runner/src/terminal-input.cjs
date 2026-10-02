const fs = require('node:fs');

globalThis.input = function input(prompt = '') {
  if (prompt) process.stdout.write(String(prompt));
  const bytes = [];
  const byte = Buffer.alloc(1);
  while (true) {
    const count = fs.readSync(0, byte, 0, 1, null);
    if (count === 0 || byte[0] === 10) break;
    if (byte[0] !== 13) bytes.push(byte[0]);
  }
  return Buffer.from(bytes).toString('utf8');
};
