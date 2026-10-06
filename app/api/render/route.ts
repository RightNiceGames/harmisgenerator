import { body, checkOrigin, failure } from '@/lib/http';
import { readSong } from '@/lib/song';
import { renderChart } from '@/lib/render';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const data = await body(request);
    if (typeof data.text !== 'string') throw new Error('Låttext saknas.');
    const result = await renderChart(readSong(data.text), data.format === 'pdf' ? 'pdf' : 'svg', {editable:data.editable===true,columns:data.columns===2?2:4});
    if (result.pdf) return new Response(Buffer.from(result.pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="ackordblad.pdf"', 'Cache-Control': 'no-store' } });
    return Response.json(result);
  } catch (e) { return failure(e); }
}
