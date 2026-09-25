import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, lstat, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSong } from './song';
export const SONG_DIR = path.join(process.cwd(), 'songs');
export type SongEntry = { id: string; title: string; artist: string; key: string; status: string; error?: string };
export const revision = (text: string) => createHash('sha256').update(text).digest('hex');
export class StorageError extends Error { constructor(message: string, public status: number) { super(message); } }
async function songPath(id: string) {
  if (!/^[a-z0-9][a-z0-9-]*\.ya?ml$/.test(id)) throw new StorageError('Ogiltigt filnamn.', 400);
  const file = path.join(SONG_DIR, id);
  const stat = await lstat(file).catch(() => { throw new StorageError('Låtfilen finns inte.', 404); });
  if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(await realpath(file)) !== await realpath(SONG_DIR)) throw new StorageError('Låtfilen måste ligga direkt i songs-mappen.', 400);
  return file;
}
export async function loadSong(id: string) {
  const text = await readFile(await songPath(id), 'utf8');
  return { text, revision: revision(text) };
}
export async function listSongs(): Promise<SongEntry[]> {
  await mkdir(SONG_DIR, { recursive: true });
  const files = (await readdir(SONG_DIR)).filter(name => /^[a-z0-9][a-z0-9-]*\.ya?ml$/.test(name));
  return (await Promise.all(files.map(async id => {
    try { const { text } = await loadSong(id); const s = readSong(text); return { id, title: s.titel, artist: s.artist, key: s.grundtonart, status: s.status }; }
    catch (e) { return { id, title: id, artist: '', key: '', status: 'fel', error: e instanceof Error ? e.message : 'Kunde inte läsa filen.' }; }
  }))).sort((a, b) => a.id.startsWith('flykten-') ? -1 : b.id.startsWith('flykten-') ? 1 : a.title.localeCompare(b.title, 'sv'));
}
const locks = new Map<string, Promise<unknown>>();
export async function saveSong(id: string, text: string, expectedRevision: string) {
  const previous = locks.get(id) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    readSong(text);
    const file = await songPath(id);
    const old = await readFile(file, 'utf8');
    if (revision(old) !== expectedRevision) throw new StorageError('Filen har ändrats utanför redigeraren. Kopiera dina ändringar innan du läser in den på nytt.', 409);
    const backupDir = path.join(process.cwd(), 'work', 'backups');
    await mkdir(backupDir, { recursive: true });
    await writeFile(path.join(backupDir, `${id}.${Date.now()}.${randomUUID().slice(0, 8)}.bak`), old, 'utf8');
    const temp = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(temp, text, { encoding: 'utf8', flag: 'wx' }); await rename(temp, file); }
    finally { await unlink(temp).catch(() => {}); }
    return { revision: revision(text) };
  });
  locks.set(id, operation);
  try { return await operation; } finally { if (locks.get(id) === operation) locks.delete(id); }
}
