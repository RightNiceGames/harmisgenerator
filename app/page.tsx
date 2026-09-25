import { listSongs, loadSong } from '@/lib/storage';
import { Editor } from '@/components/editor';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const songs = await listSongs();
  const first = songs.find(s => !s.error);
  const initial = first ? await loadSong(first.id) : { text: '', revision: '' };
  return <Editor initialSongs={songs} initialId={first?.id ?? ''} initial={initial} />;
}
