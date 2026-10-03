import { body, checkOrigin, failure } from '@/lib/http';
import { setlistStore } from '@/lib/setlist-storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await setlistStore.load()); } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const data = await body(request);
    if (typeof data.revision !== 'string') throw new Error('Filversion saknas.');
    return Response.json(await setlistStore.save(data.lists, data.revision));
  } catch (error) { return failure(error); }
}
