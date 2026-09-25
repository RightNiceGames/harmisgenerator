import { listSongs } from '../lib/storage';
const songs = await listSongs();
for (const song of songs) console.log(song.error ? `FEL ${song.id}: ${song.error}` : `OK  ${song.id}`);
console.log(`${songs.length} låtfiler, ${songs.filter(s => s.error).length} fel`);
if (!songs.length || songs.some(s => s.error)) process.exitCode = 1;
