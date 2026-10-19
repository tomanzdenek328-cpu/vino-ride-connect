import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/dictation')({
  server:{handlers:{POST:async ({request}) => {
    const {uploadSpeech} = await import('@/lib/ai/upload.server');
    return uploadSpeech(request);
  }}},
});
