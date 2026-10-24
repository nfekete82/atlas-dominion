// Optional module worker: loaded only after explicit player opt-in.
// No game state or browser DOM exists in this worker.
const MODEL = 'onnx-community/Qwen3-0.6B-ONNX';
const RUNTIME = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let generator = null;
let busy = false;
const send = payload => self.postMessage(payload);
self.onmessage = async event => {
  const request = event.data;
  if (!request || typeof request !== 'object') return;
  if (request.type === 'init') {
    if (generator || busy) return;
    busy = true;
    try {
      if (!self.navigator?.gpu) throw new Error('WebGPU ist in diesem Browser-Worker nicht verfügbar.');
      send({ type: 'status', status: 'loading' });
      const { pipeline } = await import(RUNTIME);
      generator = await pipeline('text-generation', MODEL, {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: p => {
          if (p.status === 'progress' && Number.isFinite(p.progress)) {
            send({ type: 'progress', progress: Math.max(0, Math.min(100, Math.round(p.progress))) });
          }
        },
      });
      send({ type: 'ready' });
    } catch (error) {
      generator = null;
      send({ type: 'error', message: String(error instanceof Error ? error.message : error) });
    } finally {
      busy = false;
    }
    return;
  }
  if (request.type !== 'plan' || !generator || busy) return;
  busy = true;
  try {
    const started = performance.now();
    const output = await generator(request.messages, {
      max_new_tokens: 80,
      do_sample: false,
      return_full_text: false,
    });
    const result = output?.[0]?.generated_text;
    const content = typeof result === 'string'
      ? result
      : Array.isArray(result) ? (result.at(-1)?.content ?? '') : '';
    send({ type: 'plan', id: request.id, answer: content, durationMs: Math.round(performance.now() - started) });
  } catch (error) {
    send({ type: 'plan-error', id: request.id, message: String(error instanceof Error ? error.message : error) });
  } finally {
    busy = false;
  }
};
