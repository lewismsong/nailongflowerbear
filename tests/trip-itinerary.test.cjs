const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function fixture() {
  const handlers = {};
  const timers = new Map();
  const writes = [];
  const errors = [];
  const document = { activeElement: null };
  const element = { innerText: '', addEventListener: (event, callback) => { handlers[event] = callback; } };
  let nextTimer = 0;
  let subscription;
  let subscriptionError;
  let rejectWrite = false;
  const reference = {
    on: (event, callback, error) => { subscription = callback; subscriptionError = error; },
    set: text => {
      writes.push(text);
      return rejectWrite ? Promise.reject(new Error('permission denied')) : Promise.resolve();
    },
    remove: () => reference.set(null),
  };
  const context = vm.createContext({
    document, console: { error: (...details) => errors.push(details) },
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(readFileSync('assets/js/trip-itinerary.js', 'utf8'), context);
  const messages = [];
  context.initializeTripTextField(element, reference, message => messages.push(message));
  return {
    element, document, handlers, writes, errors, messages,
    receive: text => subscription({ val: () => text }),
    denySubscription: () => subscriptionError(new Error('permission denied')),
    rejectWrites: () => { rejectWrite = true; },
    flush: () => { for (const callback of timers.values()) callback(); timers.clear(); },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('typing is debounced, blur flushes, and unchanged fields do not write', async () => {
  const field = fixture();
  field.receive('existing');
  field.handlers.blur();
  assert.deepEqual(field.writes, []);
  field.element.innerText = 'first';
  field.handlers.input();
  field.element.innerText = 'second';
  field.handlers.input();
  field.flush();
  field.handlers.blur();
  await settle();
  assert.deepEqual(field.writes, ['second']);
  field.handlers.blur();
  assert.deepEqual(field.writes, ['second']);
  field.element.innerText = '   ';
  field.handlers.input();
  field.handlers.blur();
  await settle();
  assert.deepEqual(field.writes, ['second', null]);
});

test('remote updates preserve focused and unsaved edits', async () => {
  const field = fixture();
  field.receive('initial');
  field.document.activeElement = field.element;
  field.receive('remote');
  assert.equal(field.element.innerText, 'initial');
  field.document.activeElement = null;
  field.handlers.blur();
  assert.equal(field.element.innerText, 'remote');
  assert.deepEqual(field.writes, []);
  field.element.innerText = 'local';
  field.handlers.input();
  field.receive('new remote');
  assert.equal(field.element.innerText, 'local');
  field.handlers.blur();
  await settle();
  assert.deepEqual(field.writes, ['local']);
});

test('write and subscription errors are visible and failed writes can be retried', async () => {
  const field = fixture();
  field.rejectWrites();
  field.element.innerText = 'local';
  field.handlers.input();
  field.handlers.blur();
  await settle();
  assert.match(field.messages.at(-1), /couldn't save/);
  field.handlers.blur();
  await settle();
  assert.deepEqual(field.writes, ['local', 'local']);
  field.denySubscription();
  assert.match(field.messages.at(-1), /can't reach/);
  assert.equal(field.errors.length, 3);
});
