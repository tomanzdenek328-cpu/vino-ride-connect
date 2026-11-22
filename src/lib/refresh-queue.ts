/** Coalesce refreshes without losing changes received during a request. */
export function createRefreshQueue(run: (signal: AbortSignal) => Promise<void>, timeoutMs = 10_000) {
  let active = false;
  let queued = false;
  let disposed = false;
  let controller: AbortController | null = null;
  const refresh = async () => {
    if (disposed) return;
    if (active) { queued = true; return; }
    active = true;
    do {
      queued = false;
      controller = new AbortController();
      const signal = controller.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          run(signal),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => { controller?.abort(); resolve(); }, timeoutMs);
          }),
        ]);
      } catch (error) {
        if (!signal.aborted) console.warn('Refresh failed', error);
      } finally {
        clearTimeout(timer);
      }
    } while (queued && !disposed);
    active = false;
  };
  return {
    refresh,
    dispose: () => { disposed = true; controller?.abort(); },
  };
}