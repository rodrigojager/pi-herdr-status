import test from 'node:test';
import assert from 'node:assert/strict';
import * as herdr from '../src/index.ts';
test('Herdr integration publishes only model metadata, preserves dialogs and skips headless/subagent contexts', async () => {
  const previousPane = process.env.HERDR_PANE_ID;
  process.env.HERDR_PANE_ID = 'test-pane';
  const calls = [];
  herdr._setExecFileImplForTest((_exe, args, options, callback) => {
    calls.push(args); assert.equal(options.windowsHide, true); assert.equal(options.timeout, 2000); callback(null);
  });
  const handlers = new Map();
  const pi = { on: (event, handler) => handlers.set(event, handler), getThinkingLevel: () => 'high' };
  const confirm = async () => true;
  const ctx = { hasUI: true, model: { provider: 'test', id: 'test/model' }, ui: { confirm }, sessionManager: {
    getHeader: () => ({}), getSessionFile: () => 'session.jsonl',
  } };
  try {
    herdr.default(pi);
    await handlers.get('session_start')({}, ctx);
    await handlers.get('session_shutdown')({ reason: 'reload' }, ctx);
    await handlers.get('model_select')({}, { ...ctx, hasUI: false });
    await handlers.get('model_select')({}, { ...ctx, sessionManager: { ...ctx.sessionManager, getHeader: () => ({ parentSession: 'main' }) } });
    await handlers.get('session_shutdown')({ reason: 'quit' }, ctx);
    await herdr._waitForMetadataQueueForTest();
    assert.equal(calls.length, 2);
    assert.ok(calls.every(args => args[1] === 'report-metadata' && args.includes('herdr:pi')));
    assert.ok(calls[0].includes('model_info=model (high)'));
    assert.ok(calls[1].includes('--clear-token'));
    assert.equal(ctx.ui.confirm, confirm);
    assert.equal(handlers.has('agent_start'), false);
  } finally {
    herdr._setExecFileImplForTest();
    if (previousPane === undefined) delete process.env.HERDR_PANE_ID; else process.env.HERDR_PANE_ID = previousPane;
  }
});
