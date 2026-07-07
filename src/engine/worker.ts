// Web Worker entry — runs one SearchEngine off the main thread and streams
// progress back. The controller spawns one of these per core (capped).

import { SearchEngine } from './search';
import type { WorkerMessage, WorkerRequest } from './types';

const post = (m: WorkerMessage) => (self as unknown as { postMessage(x: unknown): void }).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { config, seeds } = e.data;
  const engine = new SearchEngine(config, seeds);
  let lastPost = 0;
  while (!engine.finished) {
    engine.step(400);
    const now = Date.now();
    if (now - lastPost > 200) {
      lastPost = now;
      post({ type: 'progress', progress: engine.progress() });
    }
  }
  post({ type: 'done', outcome: engine.outcome() });
};
