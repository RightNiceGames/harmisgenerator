import { SongError } from './song';
import { StorageError } from './storage';
export function failure(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod.', line: error instanceof SongError ? error.line : undefined }, { status: error instanceof StorageError ? error.status : 400 });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || new URL(origin).host !== host) throw new StorageError('Skrivningar tillåts endast från den lokala redigeraren.', 403);
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 250_000) throw new StorageError('För stor förfrågan.', 413);
  return JSON.parse(text);
}
