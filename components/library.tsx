'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, ArrowUpDown, ListMusic, Music2, Play, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { SongEntry } from '@/lib/storage';
import type { LiveSong } from './live-viewer';
import type { Setlist, SetlistLibrary } from '@/lib/setlists';
import { pretty } from '@/lib/song';

type Props = { songs: SongEntry[]; id: string; busy: boolean; openSong: (id: string) => void; refresh: () => Promise<void>; searchInput: RefObject<HTMLInputElement | null>; startLive: (name: string, songs: LiveSong[]) => void; onActiveSetlistChange: (setlist: Setlist | null) => void };
async function responseData(response: Response): Promise<SetlistLibrary> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Kunde inte läsa setlistorna.');
  return data;
}
export function Library({songs, id, busy, openSong, refresh, searchInput, startLive, onActiveSetlistChange}: Props) {
  const [data, setData] = useState<SetlistLibrary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [alphabetical, setAlphabetical] = useState(false), [search, setSearch] = useState('');
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Setlist | null>(null), [draftError, setDraftError] = useState('');
  const [addId, setAddId] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    try { setData(await responseData(await fetch('/api/setlists'))); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunde inte läsa setlistorna.'); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (draft) dialog.current?.showModal(); }, [!!draft]);
  const active = data?.lists.find(list => list.id === selected);
  useEffect(() => { onActiveSetlistChange(active ?? null); }, [active, onActiveSetlistChange]);
  const title = selected === 'all' ? 'Alla låtar' : active?.name ?? 'Setlistan saknas';
  const entries = selected === 'all' ? songs : (active?.songs ?? []).map(songId => songs.find(song => song.id === songId) ?? {id: songId, title: songId, artist: 'Låtfilen saknas', key: '', status: 'fel', error: 'Låtfilen saknas'});
  const ordered = entries.map((song, index) => ({song, index}));
  if (alphabetical) ordered.sort((a,b) => a.song.title.localeCompare(b.song.title, 'sv'));
  const visible = ordered.filter(({song}) => `${song.title} ${song.artist}`.toLocaleLowerCase('sv').includes(search.toLocaleLowerCase('sv')));
  function choose(value: string) { setSelected(value); setSearch(''); setAlphabetical(false); }
  function edit(list?: Setlist) {
    setDraft(list ? structuredClone(list) : {id: crypto.randomUUID(), name: '', songs: []}); setDraftError(''); setAddId('');
  }
  function move(index: number, delta: number) {
    if (!draft) return;
    const next = [...draft.songs];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setDraft({...draft, songs: next});
  }
  async function save(remove = false) {
    if (!draft || !data || pending) return;
    if (!remove && !draft.name.trim()) { setDraftError('Ge setlistan ett namn.'); return; }
    setPending(true); setDraftError('');
    const exists = data.lists.some(list => list.id === draft.id);
    const lists = remove ? data.lists.filter(list => list.id !== draft.id) : exists ? data.lists.map(list => list.id === draft.id ? draft : list) : [...data.lists, draft];
    try {
      setData(await responseData(await fetch('/api/setlists', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lists, revision:data.revision})})));
      if (remove) setSelected(null); else choose(draft.id);
      setDraft(null);
    } catch (e) { setDraftError(e instanceof Error ? e.message : 'Kunde inte spara setlistan.'); }
    finally { setPending(false); }
  }
  return <aside className="library" aria-label="Låtbibliotek">
    <a className="brand" href="/" onClick={e => {e.preventDefault(); setSelected(null);}}><span className="brand-mark"><Music2 size={22}/></span><span>harmis<span className="brand-dot">.</span></span></a>
    <div className="library-heading"><span>DITT LÅTBIBLIOTEK</span><button className="icon-button" onClick={() => {void refresh(); void load();}} title="Uppdatera låtlistan" aria-label="Uppdatera låtlistan"><RefreshCw size={14}/></button></div>
    {error && <p className="library-error" role="alert">{error}</p>}
    {selected === null ? <div className="library-view" key="sets">
      <div className="setlist-heading"><h2>Setlistor</h2><button className="icon-button" aria-label="Ny setlista" disabled={!data} onClick={() => edit()}><Plus size={18}/></button></div>
      <p className="setlist-caption">Välj en lista för att se låtarna.</p>
      <nav className="setlist-list" aria-label="Setlistor">
        <button className="setlist-card" onClick={() => choose('all')}><Music2 size={18}/><span><strong>Alla låtar</strong><small>{songs.length} låtar</small></span><span>›</span></button>
        {data?.lists.map(list => <button className="setlist-card" key={list.id} onClick={() => choose(list.id)}><ListMusic size={18}/><span><strong>{list.name}</strong><small>{list.songs.length} låtar · spelordning</small></span><span>›</span></button>)}
      </nav>
      {data && !data.lists.length && <p className="empty-search">Skapa din första setlista med plusknappen.</p>}
      {!data && !error && <p role="status">Läser setlistor…</p>}
    </div> : <div className="library-view" key={selected}>
      <button className="text-button setlist-back" onClick={() => setSelected(null)}><ArrowLeft size={15}/>Setlistor</button>
      <div className="setlist-heading"><h2>{title}</h2>{active && <button className="text-button" onClick={() => edit(active)}>Redigera</button>}</div>
      {active && <button className="button primary start-live" disabled={busy || !entries.length} onClick={() => startLive(active.name, entries.map(({id,title}) => ({id,title})))}><Play size={15}/>Live</button>}
      <label className="search"><Search size={16}/><input ref={searchInput} aria-label="Sök låt eller artist" placeholder="Sök låt eller artist…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>/</kbd></label>
      <div className="setlist-sort"><span>{visible.length} låtar</span><button className="text-button" aria-label="Sortera i bokstavsordning" aria-pressed={alphabetical} onClick={() => setAlphabetical(!alphabetical)}><ArrowUpDown size={14}/>{alphabetical ? 'A–Ö' : selected === 'all' ? 'Biblioteksordning' : 'Setlistans ordning'}</button></div>
      <nav className="song-list" aria-label="Låtar i vald lista">{visible.map(({song,index}) => <button key={`${song.id}-${index}`} className={`song-item ${song.id === id ? 'active' : ''}`} onClick={() => openSong(song.id)} disabled={busy || !songs.some(item => item.id === song.id)} aria-current={song.id === id ? 'page' : undefined}>
        <span className="song-number">{String(index+1).padStart(2,'0')}</span><span className="song-description"><strong>{song.title}</strong><small>{song.artist || 'Kontrollera låtfilen'}</small></span><span className="song-key">{song.error ? '!' : pretty(song.key)}</span>
      </button>)}{!visible.length && <p className="empty-search">{entries.length ? 'Inga låtar matchar sökningen.' : 'Setlistan är tom. Lägg till låtar via Redigera.'}</p>}</nav>
    </div>}
    <div className="library-footer"><span className="online-dot"/><span>Lokalt bibliotek</span></div>
    {draft && <dialog ref={dialog} className="setlist-dialog" aria-labelledby="setlist-title" onCancel={e => {if (pending) e.preventDefault(); else setDraft(null);}}>
      <form onSubmit={e => {e.preventDefault(); void save();}}>
        <h2 id="setlist-title">{data?.lists.some(list => list.id === draft.id) ? 'Redigera setlista' : 'Ny setlista'}</h2>
        <fieldset disabled={pending}>
          <label>Namn på setlistan<input autoFocus value={draft.name} maxLength={100} onChange={e => setDraft({...draft, name:e.target.value})}/></label>
          <p className="setlist-caption">Låtarna spelas uppifrån och ned. En låt kan finnas i flera setlistor.</p>
          <ol className="setlist-draft">{draft.songs.map((songId, index) => <li key={`${songId}-${index}`}><span>{index+1}. {songs.find(song => song.id === songId)?.title ?? `${songId} (saknas)`}</span><button type="button" className="icon-button" aria-label={`Flytta upp låt ${index+1}`} disabled={index === 0} onClick={() => move(index,-1)}><ArrowUp size={16}/></button><button type="button" className="icon-button" aria-label={`Flytta ned låt ${index+1}`} disabled={index === draft.songs.length-1} onClick={() => move(index,1)}><ArrowDown size={16}/></button><button type="button" className="icon-button" aria-label={`Ta bort låt ${index+1}`} onClick={() => setDraft({...draft,songs:draft.songs.filter((_,i) => i !== index)})}><X size={16}/></button></li>)}</ol>
          <div className="setlist-add"><label>Låt att lägga till<select value={addId} onChange={e => setAddId(e.target.value)}><option value="">Välj låt…</option>{[...songs].sort((a,b) => a.title.localeCompare(b.title,'sv')).map(song => <option key={song.id} value={song.id}>{song.title}</option>)}</select></label><button className="button secondary" type="button" disabled={!addId || draft.songs.length >= 300} onClick={() => {setDraft({...draft,songs:[...draft.songs,addId]}); setAddId('');}}><Plus size={15}/>Lägg till</button></div>
          {draftError && <p className="library-error" role="alert">{draftError}</p>}
          <div className="setlist-actions">{data?.lists.some(list => list.id === draft.id) && <button className="text-button" type="button" onClick={() => {if (window.confirm(`Ta bort setlistan ”${draft.name}”? Låtfilerna finns kvar.`)) void save(true);}}>Ta bort setlista</button>}<button className="button secondary" type="button" onClick={() => setDraft(null)}>Avbryt</button><button className="button primary" type="submit">{pending ? 'Sparar…' : 'Spara setlista'}</button></div>
        </fieldset>
      </form>
    </dialog>}
  </aside>;
}
