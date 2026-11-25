import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createRefreshQueue } from './refresh-queue';

test('refresh received during a request runs again without overlap', async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const queue = createRefreshQueue(async () => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
  });
  const first = queue.refresh();
  await queue.refresh();
  await queue.refresh();
  assert.equal(calls, 1);
  release?.();
  await first;
  assert.equal(calls, 2);
  queue.dispose();
});

test('a stalled refresh is aborted and cannot permanently block later refreshes', async () => {
  let firstSignal: AbortSignal | undefined;
  let calls = 0;
  const queue = createRefreshQueue(async signal => {
    calls++;
    if (calls === 1) {
      firstSignal = signal;
      await new Promise<void>(() => {});
    }
  }, 10);
  await queue.refresh();
  assert.equal(firstSignal?.aborted, true);
  await queue.refresh();
  assert.equal(calls, 2);
  queue.dispose();
});

test('disposal aborts an active refresh and prevents new work', async () => {
  let calls = 0;
  let signal: AbortSignal | undefined;
  const queue = createRefreshQueue(async current => { calls++; signal = current; });
  await queue.refresh();
  queue.dispose();
  await queue.refresh();
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
});

test('second-by-second polling skips busy reads instead of queuing continuous work', async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const queue = createRefreshQueue(async () => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
  });
  const first = queue.poll();
  await queue.poll();
  await queue.poll();
  assert.equal(calls, 1);
  release?.();
  await first;
  assert.equal(calls, 1);
  await queue.poll();
  assert.equal(calls, 2);
  queue.dispose();
});