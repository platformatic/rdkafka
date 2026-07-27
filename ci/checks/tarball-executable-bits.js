const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const librdkafkaPath = path.resolve(root, 'deps', 'librdkafka');

// Packing must not drop the executable bit on the scripts the native build
// shells out to: deps/librdkafka/src/Makefile pipes into `../lds-gen.py` and
// deps/librdkafka.gyp runs `./configure`, so a 0644 there means a clean install
// fails with exit 126 / "Permission denied".
//
// This cannot be asserted against the working tree, because the modes are lost
// during packing rather than in the checkout: pnpm's packer synthesizes tar
// entry modes (0755 only for files listed in `bin`, 0644 for everything else)
// instead of reading them off disk. So pack for real and inspect the artifact.

const EXEC_OWNER_COLUMN = 3;
const TARBALL_PREFIX = 'package/';

function trackedExecutables(cwd, prefix) {
  const listing = execFileSync('git', ['ls-files', '--stage'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  return listing
    .split('\n')
    .filter((line) => line.startsWith('100755 '))
    .map((line) => prefix + line.slice(line.indexOf('\t') + 1));
}

function packWithNpm(destination) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  // --ignore-scripts keeps this hermetic. prepack regenerates the TypeScript
  // definitions, which is irrelevant to file modes and slow to redo.
  execFileSync(npm, ['pack', '--ignore-scripts', '--pack-destination', destination], {
    cwd: root,
    stdio: 'ignore'
  });

  const tarballs = fs.readdirSync(destination).filter((f) => f.endsWith('.tgz'));

  if (tarballs.length !== 1) {
    console.error(`Expected one tarball in ${destination}, found ${tarballs.length}`);
    process.exit(1);
  }

  return path.join(destination, tarballs[0]);
}

function readTarballModes(tarball) {
  const listing = execFileSync('tar', ['-tvzf', tarball], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  const modes = new Map();

  for (const line of listing.split('\n')) {
    const columns = line.trim().split(/\s+/);
    const mode = columns[0];
    const name = columns[columns.length - 1];

    // Symlinks list as `name -> target`, which would record the target instead.
    if (!mode || mode.startsWith('l') || !name.startsWith(TARBALL_PREFIX)) {
      continue;
    }

    modes.set(name.slice(TARBALL_PREFIX.length), mode);
  }

  return modes;
}

if (!fs.existsSync(librdkafkaPath)) {
  console.error(`Could not find librdkafka at path ${librdkafkaPath}`);
  console.error('Run `git submodule update --init --recursive` first.');
  process.exit(1);
}

const expected = trackedExecutables(root, '')
  .concat(trackedExecutables(librdkafkaPath, 'deps/librdkafka/'));

const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'rdkafka-pack-'));
let packed;
let modes;

try {
  modes = readTarballModes(packWithNpm(destination));
  packed = expected.filter((file) => modes.has(file));
} finally {
  fs.rmSync(destination, { recursive: true, force: true });
}

// If nothing lined up, the tar listing failed to parse or .npmignore changed
// shape. Either way the check is no longer proving anything, so fail loudly
// rather than passing vacuously.
if (packed.length === 0) {
  console.error('No executable files from git were found in the tarball at all.');
  console.error(`Tarball entries inspected: ${modes.size}`);
  process.exit(1);
}

const stripped = packed.filter((file) => modes.get(file)[EXEC_OWNER_COLUMN] !== 'x');

if (stripped.length > 0) {
  console.error(`${stripped.length} of ${packed.length} packed files lost their executable bit:`);
  for (const file of stripped) {
    console.error(`  ${modes.get(file)} ${file}`);
  }
  console.error('');
  console.error('Pack and publish with npm. pnpm rewrites tar entry modes and');
  console.error('marks only `bin` entries executable, which breaks native builds.');
  process.exit(1);
}

console.log(`All ${packed.length} executable files kept mode 0755 in the tarball.`);
