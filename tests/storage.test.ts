import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const reference=readFileSync('songs/flykten-fran-vardagen.yaml','utf8');
test('atomic save preserves backup, detects conflicts and rejects traversal/symlinks',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'harmis-storage-'));
  const original=process.cwd();process.chdir(dir);
  try {
    await mkdir('songs');await writeFile('songs/test.yaml',reference);
    const {loadSong,saveSong}=await import('../lib/storage');
    const loaded=await loadSong('test.yaml');
    const changed=reference.replace('tempo: 112','tempo: 113');
    await saveSong('test.yaml',changed,loaded.revision);
    assert.equal(await readFile('songs/test.yaml','utf8'),changed);
    const backups=await readdir('work/backups');assert.equal(backups.length,1);
    assert.equal(await readFile(path.join('work/backups',backups[0]),'utf8'),reference);
    await assert.rejects(saveSong('test.yaml',reference,loaded.revision),/ändrats utanför/);
    await assert.rejects(loadSong('../test.yaml'),/Ogiltigt/);
    await writeFile('outside.yaml',reference);await symlink(path.join(dir,'outside.yaml'),'songs/linked.yaml');
    await assert.rejects(loadSong('linked.yaml'),/direkt i songs/);
    const fresh=await loadSong('test.yaml');
    const results=await Promise.allSettled([saveSong('test.yaml',reference,fresh.revision),saveSong('test.yaml',changed+'\n',fresh.revision)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  } finally {process.chdir(original);}
});
