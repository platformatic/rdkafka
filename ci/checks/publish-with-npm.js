// This package may only be published with npm.
//
// pnpm does not delegate packing to npm. It builds the tarball with its own
// packer, which synthesizes the tar entry modes instead of reading them off
// disk, marking as executable only the files listed in `bin`. That strips the
// executable bit from configure, deps/librdkafka/configure and
// deps/librdkafka/lds-gen.py, and every clean native install of the result then
// fails with exit 126 ("Permission denied"). 4.1.0 and 4.1.0-alpha.1 shipped
// that way. npm packs with node-tar, which reads the real mode off disk.
//
// See also ci/checks/tarball-executable-bits.js, which asserts the same
// property against a packed artifact.

const userAgent = process.env.npm_config_user_agent;

// Unset means we cannot tell what is driving the publish. Allow it rather than
// break an unusual but legitimate setup; CI publishes through npm regardless.
if (userAgent && !userAgent.startsWith('npm/')) {
  const packageManager = userAgent.split(' ')[0];

  console.error(`Refusing to publish with ${packageManager}: this package must be published with npm.`);
  console.error('');
  console.error(`${packageManager} rewrites file modes while packing and marks only \`bin\` entries`);
  console.error('executable, which strips the executable bit from the native build scripts and');
  console.error('breaks clean installs with exit 126. See CONTRIBUTING.md.');
  process.exit(1);
}
