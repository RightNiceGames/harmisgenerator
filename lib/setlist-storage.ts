import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { revision, StorageError } from './storage';
import { setlistsSchema } from './setlists';

// One atomic file preserves the order of each list and guards against concurrent edits.
export function createSetlistStore(directory: string) {
  const file = path.join(directory, 'library.json');
  let lock: Promise<unknown> = Promise.resolve();
  async function raw() {
    try { return await readFile(file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '[]\n'; throw error; }
  }
  async function load() {
    const text = await raw();
    return { lists: setlistsSchema.parse(JSON.parse(text)), revision: revision(text) };
  }
  async function save(input: unknown, expectedRevision: string) {
    const lists = setlistsSchema.parse(input);
    const operation = lock.catch(() => {}).then(async () => {
      const old = await raw();
      if (revision(old) !== expectedRevision) throw new StorageError('Setlistorna har ändrats. Stäng redigeringen och uppdatera biblioteket innan du försöker igen.', 409);
      await mkdir(directory, { recursive: true });
      const temp = `${file}.${randomUUID()}.tmp`;
      const text = JSON.stringify(lists, null, 2) + '\n';
      try { await writeFile(temp, text, {encoding: 'utf8', flag: 'wx'}); await rename(temp, file); }
      finally { await unlink(temp).catch(() => {}); }
      return { lists, revision: revision(text) };
    });
    lock = operation;
    return operation;
  }
  return { load, save };
}
export const setlistStore = createSetlistStore(path.join(process.cwd(), 'setlists'));
