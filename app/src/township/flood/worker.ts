import type { FloodWorkerRequest, FloodWorkerResponse } from './model.ts';
import { simulateFloodComparison } from './solver.ts';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<FloodWorkerRequest>) => void) | null;
  postMessage: (message: FloodWorkerResponse) => void;
};

workerScope.onmessage = ({ data }) => {
  if (data.type !== 'run') return;
  const { requestId, input } = data;
  try {
    const result = simulateFloodComparison(input, (progress) => {
      workerScope.postMessage({ type: 'progress', requestId, progress });
    });
    workerScope.postMessage({ type: 'result', requestId, result });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'The flood simulation failed.',
    });
  }
};
