import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSetlistStore } from '../lib/setlist-storage';
const list = {id:'52f0bcce-e104-4d25-ac31-6594653a7a4b', name:'Första set', songs:['universum.yaml','flykten-fran-vardagen.yaml','universum.yaml']};
test('setlists persist names and order, including repeated and missing songs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'harmis-setlists-'));
  try {
    const store = createSetlistStore(dir);
    const initial = await store.load();
    assert.deepEqual(initial.lists, []);
    const saved = await store.save([list], initial.revision);
    assert.deepEqual(await createSetlistStore(dir).load(), saved);
    const updated = await store.save([{...list,name:'Kväll',songs:['saknad.yaml',...list.songs]}], saved.revision);
    assert.equal(updated.lists[0].songs[0], 'saknad.yaml');
    await assert.rejects(store.save([],saved.revision), /ändrats/);
    const deleted = await store.save([], updated.revision);
    assert.deepEqual(deleted.lists, []);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('concurrent saves reject stale revisions and invalid data never replaces saved lists', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'harmis-setlists-'));
  try {
    const store = createSetlistStore(dir), initial = await store.load();
    const results = await Promise.allSettled([store.save([list],initial.revision),store.save([{...list,name:'Andra'}],initial.revision)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const current = await store.load();
    for (const invalid of [[{...list,name:' '}],[{...list,songs:['../outside.yaml']}],[list,list]]) await assert.rejects(store.save(invalid,current.revision));
    assert.deepEqual(await store.load(),current);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
