import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/translator-transcribe')({
  server: { handlers: { POST: async ({ request }) => {
    const { uploadSpeech } = await import('@/lib/ai/upload.server');
    return uploadSpeech(request, false);
  } } },
});