/**
 * Server-Sent Events (SSE) Stream Reader for Cited Chat.
 *
 * Reads events formatted as:
 *   event: meta | token | replace | done
 *   data: {...}
 *
 * @param {string} batchId
 * @param {string} question
 * @param {object} callbacks
 * @param {function(object): void} callbacks.onMeta - Called with { citations: [...] }
 * @param {function(string): void} callbacks.onToken - Called with each streamed text token
 * @param {function(string): void} callbacks.onReplace - Called if answer is replaced with fallback
 * @param {function(object): void} callbacks.onDone - Called when stream completes with { messageId, grounded }
 * @param {function(Error): void} callbacks.onError - Called on stream or connection error
 * @returns {Promise<void>}
 */
export async function streamChatQuery(batchId, question, { onMeta, onToken, onReplace, onDone, onError }) {
  try {
    const response = await fetch(`/api/batches/${batchId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      let msg = `Chat request failed (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {}
      throw new Error(msg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataPayload = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            dataPayload = line.replace('data: ', '').trim();
          }
        }

        if (dataPayload) {
          try {
            const parsed = JSON.parse(dataPayload);
            if (eventType === 'meta' && onMeta) onMeta(parsed);
            else if (eventType === 'token' && onToken) onToken(parsed);
            else if (eventType === 'replace' && onReplace) onReplace(parsed);
            else if (eventType === 'done' && onDone) onDone(parsed);
          } catch {
            if (eventType === 'token' && onToken) onToken(dataPayload);
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
    else throw err;
  }
}
