const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const MissHistory = vm.runInNewContext(readFileSync('assets/js/miss-history.js', 'utf8') + '\nMissHistory');
const dayKey = at => new Date(at).toISOString().slice(0, 10);
const firstDay = Date.parse('2026-10-07T12:00:00Z');
const secondDay = firstDay + 86400000;

test('incremental totals handle edits, sender changes, deletion, and invalid records', () => {
  const history = new MissHistory(dayKey);
  history.update('a', { from: ' KHALI ', at: firstDay, id: 'forged' });
  history.update('b', { from: 'lewis', at: secondDay });
  assert.equal(history.count('khali'), 1);
  assert.equal(history.countOnDay('khali', dayKey(firstDay)), 1);
  assert.equal(history.latest.id, 'b');
  history.update('a', { from: 'lewis', at: secondDay + 1 });
  assert.equal(history.count('khali'), 0);
  assert.equal(history.days.has(dayKey(firstDay)), false);
  assert.equal(history.count('lewis'), 2);
  assert.equal(history.latest.id, 'a');
  history.update('a', { from: 'lewis', at: firstDay });
  assert.equal(history.latest.id, 'b');
  assert.equal(history.lastAt('lewis'), secondDay);
  history.remove('b');
  assert.equal(history.latest.id, 'a');
  assert.equal(history.lastAt('lewis'), firstDay);
  for (const at of [Infinity, NaN, -1, 0, 1e20]) {
    history.update('invalid', { from: 'lewis', at });
    assert.equal(history.records.has('invalid'), false);
  }
  history.update('a', null);
  assert.equal(history.latest, null);
  assert.equal(history.count('lewis'), 0);
});

test('adding misses and acknowledging server timestamps do not scan existing history', () => {
  const history = new MissHistory(dayKey);
  for (let index = 0; index < 10000; index++) {
    history.update(String(index), { from: index % 2 ? 'khali' : 'lewis', at: firstDay + index });
  }
  history.findLatest = () => { throw new Error('unexpected history scan'); };
  history.update('new', { from: 'khali', at: secondDay });
  history.update('new', { from: 'khali', at: secondDay + 1 });
  assert.equal(history.count('khali'), 5001);
  assert.equal(history.lastAt('khali'), secondDay + 1);
  const version = history.version;
  history.update('new', { from: 'khali', at: secondDay + 1 });
  assert.equal(history.version, version);
});

test('mixed changes match an independent full-history calculation', () => {
  const history = new MissHistory(dayKey);
  const records = new Map();
  for (let index = 0; index < 300; index++) {
    const id = String(index % 47);
    const event = { from: index % 3 ? 'khali' : 'lewis', at: firstDay + (index % 5) * 86400000 + index };
    if (index % 7 === 0) {
      history.remove(id);
      records.delete(id);
    } else {
      history.update(id, event);
      records.set(id, event);
    }
    for (const person of ['khali', 'lewis']) {
      const matching = [...records.values()].filter(event => event.from === person);
      assert.equal(history.count(person), matching.length);
      assert.equal(history.lastAt(person), Math.max(0, ...matching.map(event => event.at)));
      for (let day = 0; day < 5; day++) {
        const key = dayKey(firstDay + day * 86400000);
        assert.equal(history.countOnDay(person, key), matching.filter(event => dayKey(event.at) === key).length);
      }
    }
  }
});
