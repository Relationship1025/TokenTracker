const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  readCanonicalVersion,
  collectVersionEntries,
  syncVersions,
  findVersionMismatches,
} = require('../scripts/version-files.cjs');

function writeFixture(root, canonical = '2.3.4', stale = '0.0.1') {
  const files = {
    'package.json': JSON.stringify({ name: 'tokentracker-cli', version: canonical }, null, 2),
    'TokenTrackerWin/TokenTrackerWin.csproj': `<Project><PropertyGroup><Version>${stale}</Version></PropertyGroup></Project>`,
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentracker-version-sync-'));
  writeFixture(root);
  return root;
}

test('syncVersions updates every managed platform version from the root package version', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const version = readCanonicalVersion(root);
  const changed = syncVersions(root, version);

  assert.equal(version, '2.3.4');
  assert.deepEqual(findVersionMismatches(root, version), []);
  assert.equal(collectVersionEntries(root).length, 2);
  assert.equal(changed.length, 1);
  assert.match(
    fs.readFileSync(path.join(root, 'TokenTrackerWin/TokenTrackerWin.csproj'), 'utf8'),
    /<Version>2\.3\.4<\/Version>/,
  );
});

test('collectVersionEntries rejects duplicate csproj version entries', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'TokenTrackerWin/TokenTrackerWin.csproj');
  fs.appendFileSync(file, '<Version>9.9.9</Version>\n');

  assert.throws(
    () => collectVersionEntries(root),
    /Expected exactly one <Version> entry/,
  );
});

test('findVersionMismatches reports all stale values without modifying any fixture file', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = new Map(collectVersionEntries(root).map(({ label }) => [label, fs.readFileSync(path.join(root, label), 'utf8')]));

  const mismatches = findVersionMismatches(root, '2.3.4');

  assert.equal(mismatches.length, 1);
  assert.deepEqual(mismatches.map(({ label }) => label), [
    'TokenTrackerWin/TokenTrackerWin.csproj',
  ]);
  for (const [label, content] of before) {
    assert.equal(fs.readFileSync(path.join(root, label), 'utf8'), content, `${label} was modified by validation`);
  }
});
