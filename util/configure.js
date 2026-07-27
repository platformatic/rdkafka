'use strict';

var query = process.argv[2];

var fs = require('fs');
var path = require('path');

var baseDir = path.resolve(__dirname, '../');
var releaseDir = path.join(baseDir, 'build', 'deps');

var isWin = /^win/.test(process.platform);

// Skip running this if we are running on a windows system
if (isWin) {
  process.stderr.write('Skipping run because we are on windows\n');
  process.exit(0);
}

var childProcess = require('child_process');

// Scripts the native build shells out to directly: this file runs ./configure,
// which in turn runs deps/librdkafka/configure, and deps/librdkafka/src/Makefile
// pipes into ../lds-gen.py. All three need the executable bit or the build dies
// with exit 126 / "Permission denied".
//
// Some package managers synthesize tar entry modes when packing instead of
// reading them off disk (pnpm marks only `bin` entries executable), so a
// published tarball can arrive with these at 0644 even though they are 0755 in
// git. Restore the bit here so an install works whatever produced the tarball.
var executableBuildScripts = [
  'configure',
  'deps/librdkafka/configure',
  'deps/librdkafka/lds-gen.py'
];

executableBuildScripts.forEach(function(script) {
  var scriptPath = path.join(baseDir, script);
  var mode;

  try {
    mode = fs.statSync(scriptPath).mode & parseInt('777', 8);
  } catch (e) {
    // Missing file. Let the build below fail with its own, clearer error.
    return;
  }

  // Mirror the read bits into the execute bits, the same way `chmod +x` does.
  var executableMode = mode | ((mode & parseInt('444', 8)) >> 2);

  if (executableMode === mode) {
    return;
  }

  try {
    fs.chmodSync(scriptPath, executableMode);
  } catch (e) {
    process.stderr.write('Could not restore the executable bit on ' + script +
      ': ' + e.message + '\n');
  }
});

try {
  childProcess.execSync('./configure --prefix=' + releaseDir + ' --libdir=' + releaseDir, {
    cwd: baseDir,
    stdio: [0,1,2]
  });
  process.exit(0);
} catch (e) {
  process.stderr.write(e.message + '\n');
  process.exit(1);
}
