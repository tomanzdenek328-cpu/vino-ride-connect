import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/translator-speech')({
  server: { handlers: { POST: async ({ request }) => {
    const { translatorSpeech } = await import('@/lib/ai/translator-voice.server');
    return translatorSpeech(request);
  } } },
});