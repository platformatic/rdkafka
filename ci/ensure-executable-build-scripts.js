const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildScripts = [
  'configure',
  'deps/librdkafka/configure',
  'deps/librdkafka/lds-gen.py',
];

for (const script of buildScripts) {
  const scriptPath = path.join(root, script);
  fs.chmodSync(scriptPath, fs.statSync(scriptPath).mode | 0o111);
}
