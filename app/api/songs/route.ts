import { listSongs } from '@/lib/storage';
import { failure } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(await listSongs()); } catch (e) { return failure(e); }
}
