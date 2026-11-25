import { handler } from '@/lib/http';

export const GET = handler(async () => ({ status: 'ok', service: 'lexcode-backend', time: new Date().toISOString() }));
