import { loadSong, saveSong } from '@/lib/storage';
import { body, checkOrigin, failure } from '@/lib/http';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try { return Response.json(await loadSong((await context.params).id)); } catch (e) { return failure(e); }
}
export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const data = await body(request);
    if (typeof data.text !== 'string' || typeof data.revision !== 'string') throw new Error('Text och filversion saknas.');
    return Response.json(await saveSong((await context.params).id, data.text, data.revision));
  } catch (e) { return failure(e); }
}
