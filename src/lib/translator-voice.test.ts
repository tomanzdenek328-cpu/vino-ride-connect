import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { speechBody } from './ai/speech-request.server';
import { encodeWav } from './dispatch/record-wav';

test('speech sends the exact translated text, including foreign characters', () => {
  const text = 'Ваше таксі прибуло. مرحباً';
  const body = speechBody({ baseURL: '', apiKey: '', model: 'google/gemini-3.1-flash-tts-preview', format: 'gemini', voice: 'Kore' }, text);
  assert.ok('contents' in body);
  if (!body.contents) throw new Error('Missing native speech contents');
  assert.equal(body.contents[0].parts[0].text, text);
  assert.equal(body.stream_format, 'sse');
});

test('microphone WAV includes all samples and a complete PCM header', async () => {
  const blob = encodeWav([new Float32Array([0, 1]), new Float32Array([-1])], 24000);
  const bytes = await blob.arrayBuffer(); const view = new DataView(bytes);
  assert.equal(bytes.byteLength, 50);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), -32768);
});