const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const model = require('../assets/js/settings-model.js');

test('settings validate hex colours and keep supported house selections', () => {
  assert.equal(model.normalizeHex('  abc123 '), '#ABC123');
  assert.equal(model.normalizeHex('#aBcDeF'), '#ABCDEF');
  for (const value of ['', '#abc', '#GGGGGG', 'red', null, 12]) assert.equal(model.normalizeHex(value), null);
  assert.deepEqual(model.normalize({ colors: { khali: 'abc123', lewis: 'bad' }, house: '__proto__' }), {
    colors: { khali: '#ABC123', lewis: '#EF948F' }, house: 'koala-tree',
  });
  assert.equal(model.normalize({ house: 'temple' }).house, 'temple');
});

test('settings save only changed fields to preserve unrelated edits from other devices', () => {
  const previous = model.normalize(null);
  const next = model.normalize({ colors: { khali: '#123456' }, house: 'temple' });
  assert.deepEqual(model.changes(previous, next), { 'colors/khali': '#123456', house: 'temple' });
  assert.deepEqual(model.changes(previous, previous), {});
});

test('shared settings only write on explicit apply, propagate subscriptions, and surface failed writes', async () => {
  let subscription;
  let failWrite = false;
  const writes = [];
  const styles = new Map();
  const events = [];
  const reference = {
    on: (event, handler) => { subscription = handler; },
    update: async updates => {
      if (failWrite) throw new Error('permission denied');
      writes.push(updates);
    },
  };
  const window = { dispatchEvent: event => events.push(event) };
  const context = vm.createContext({
    window, SettingsModel: model, console,
    getComputedStyle: () => ({ getPropertyValue: property => property === "--yellow" ? "#EDB878" : "#EF948F" }),
    isAppAuthenticated: () => true,
    initializeFirebaseDatabase: () => ({ ref: path => { assert.equal(path, 'settings'); return reference; } }),
    document: {
      documentElement: { style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) } },
      getElementById: () => null,
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  vm.runInContext(readFileSync('assets/js/shared-settings.js', 'utf8'), context);
  subscription({ val: () => null });
  await window.appSettings.ready;
  assert.deepEqual(writes, []);
  assert.equal(styles.size, 0);
  subscription({ val: () => ({ colors: { khali: '#112233', lewis: '#AABBCC' }, house: 'cat-house' }) });
  assert.equal(window.appSettings.current.house, 'cat-house');
  assert.equal(styles.get('--yellow'), '#112233');
  assert.equal(styles.get('--lewis-rgb'), '170, 187, 204');
  assert.equal(events.at(-1).type, 'app-settings-change');
  assert.deepEqual(writes, []);
  await window.appSettings.apply({ house: 'temple' });
  assert.deepEqual(writes, [{ house: 'temple' }]);
  failWrite = true;
  await assert.rejects(window.appSettings.apply({ house: 'koala-tree' }), /permission denied/);
});
