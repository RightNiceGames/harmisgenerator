'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpDown, Check, ChevronDown, CircleHelp, FileMusic, FolderOpen, ListMusic, LoaderCircle, Maximize2, Music2, Plus, RefreshCw, RotateCcw, RotateCw, Save, Search, X } from 'lucide-react';
import { readSong, asBar, pretty, SongError, transposeText } from '@/lib/song';
import { EditAction, insertFeature, selectedBar, insertReuse, selectedSection, replaceExistingChord, renameSection, type ChordTarget } from '@/lib/edit';
import type { SongEntry } from '@/lib/storage';

type Props = { initialSongs: SongEntry[]; initialId: string; initial: { text: string; revision: string } };
const musicalTools: { action: EditAction; mark: string; label: string }[] = [
  { action: 'takt', mark: '|', label: 'Ny takt' }, { action: 'del', mark: 'A', label: 'Ny del' },
  { action: 'repris_start', mark: '‖:', label: 'Reprisstart' }, { action: 'repris_slut', mark: ':‖', label: 'Reprisslut' },
  { action: 'hus1', mark: '1.', label: 'Första hus' }, { action: 'hus2', mark: '2.', label: 'Andra hus' }, { action: 'hus_slut', mark: '⌝', label: 'Hus slut' },
  { action: 'foruttag', mark: '♪⌒', label: 'Föruttag' }, { action: 'offbeat', mark: '♪♩', label: 'Synkop' },
  { action: 'variant', mark: '2:a', label: 'Variantackord' }, { action: 'slag', mark: '1–4', label: 'Ackordslag' }, { action: 'rytm', mark: '♫', label: 'Egen rytm' },
  { action: 'nc', mark: 'N.C.', label: 'Utan ackord' }, { action: 'repeat_bar', mark: '%', label: 'Upprepa takt' },
  { action: 'fermat', mark: '◠', label: 'Fermat' }, { action: 'break', mark: 'Br', label: 'BREAK' },
  { action: 'coda', mark: '⊕', label: 'Coda' }, { action: 'coda_hopp', mark: '→⊕', label: 'Till coda' },
  { action: 'segno', mark: '𝄋', label: 'Segno' }, { action: 'anvisning', mark: 'Aa', label: 'Anvisning' },
  { action: 'slut', mark: '▏▎', label: 'Slut' }, { action: 'nummer', mark: '#', label: 'Taktnummer' },
  { action: 'radbrytning', mark: '↵', label: 'Ny rad' }, { action: 'sidbrytning', mark: '↡', label: 'Ny sida' },
  { action: 'taktart', mark: '¾', label: 'Taktart' }, { action: 'tonart', mark: '♯♭', label: 'Tonartsbyte' },
];
async function jsonResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Förfrågan misslyckades.');
  return data;
}
export function Editor({ initialSongs, initialId, initial }: Props) {
  const [songs, setSongs] = useState(initialSongs), [id, setId] = useState(initialId);
  const [text, setText] = useState(initial.text), [saved, setSaved] = useState(initial.text), [revision, setRevision] = useState(initial.revision);
  const [search, setSearch] = useState(''), [pages, setPages] = useState<string[]>([]), [previewText, setPreviewText] = useState('');
  const [saving, setSaving] = useState(false), [loading, setLoading] = useState(false), [exporting, setExporting] = useState(false), [rendering, setRendering] = useState(false);
  const [notice, setNotice] = useState(''), [requestError, setRequestError] = useState(''), [renderError, setRenderError] = useState('');
  const [formOpen, setFormOpen] = useState(false), [formPart, setFormPart] = useState(''), [formTimes, setFormTimes] = useState(1), [formInstruction, setFormInstruction] = useState(''), [formAfter,setFormAfter] = useState(-1);
  const [cursor, setCursor] = useState(0), [help, setHelp] = useState(false), [sources, setSources] = useState(false), [transpose, setTranspose] = useState(false);
  const [target, setTarget] = useState('C'), [spelling, setSpelling] = useState<'b' | '#'>('b'), [wide, setWide] = useState(false);
  const [chordEdit, setChordEdit] = useState<{target:ChordTarget | {kind:'section';section:number}; source:string; label:string} | null>(null);
  const [chordDraft, setChordDraft] = useState(''), [chordError, setChordError] = useState('');
  const chordDialog = useRef<HTMLDialogElement>(null);
  const chordInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (chordEdit) { chordDialog.current?.showModal(); chordInput.current?.select(); }
  }, [chordEdit]);
  const [zoom, setZoom] = useState('fit');
  const searchInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null), gutter = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([initial.text]), historyIndex = useRef(0);
  const [undoState, setUndoState] = useState({ back: false, forward: false });
  const dirty = text !== saved;
  const parsed = useMemo(() => {
    try { return { song: readSong(text), error: '', line: 0 }; }
    catch (e) { return { song: undefined, error: e instanceof Error ? e.message : 'Ogiltig låtfil.', line: e instanceof SongError ? e.line : 1 }; }
  }, [text]);
  const current = songs.find(s => s.id === id);
  const selection = useMemo(() => selectedBar(text, cursor), [text, cursor]);
  const stale = previewText !== text;
  const busy = saving || loading;
  const updateUndo = () => setUndoState({ back: historyIndex.current > 0, forward: historyIndex.current < history.current.length-1 });
  const edit = useCallback((value: string) => {
    if (history.current[historyIndex.current] === value) return;
    history.current = history.current.slice(0, historyIndex.current+1);
    history.current.push(value);
    if (history.current.length > 200) history.current.shift();
    historyIndex.current = history.current.length-1; updateUndo();
    setText(value); setNotice(''); setRequestError('');
  }, []);
  const undo = useCallback((forward = false) => {
    const index = historyIndex.current + (forward ? 1 : -1);
    if (index < 0 || index >= history.current.length) return;
    historyIndex.current = index; setText(history.current[index]); updateUndo(); setNotice('');
  }, []);
  const focusAt = (position: number, view?: { top: number; left: number; windowX: number; windowY: number }) => requestAnimationFrame(() => {
    const area = editor.current;
    if (!area) return;
    area.focus({ preventScroll: !!view });
    area.setSelectionRange(position, position);
    setCursor(position);
    if (view) {
      const restore = () => {
        area.scrollTop = view.top; area.scrollLeft = view.left;
        if (gutter.current) gutter.current.scrollTop = area.scrollTop;
        window.scrollTo(view.windowX, view.windowY);
      };
      restore();
      requestAnimationFrame(restore);
    }
  });
  useEffect(() => {
    const controller = new AbortController();
    if (!parsed.song) { setRendering(false); return; }
    setRendering(true); setRenderError('');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/render', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text}), signal:controller.signal });
        const data = await jsonResponse(response);
        if (!controller.signal.aborted) { setPages(data.pages); setPreviewText(text); }
      } catch (e) { if (!controller.signal.aborted) setRenderError(e instanceof Error ? e.message : 'Förhandsvisningen misslyckades.'); }
      finally { if (!controller.signal.aborted) setRendering(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, parsed.song]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn);
  }, [dirty]);
  useEffect(() => {
    if (!help) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHelp(false); return; }
      if (event.key !== 'Tab') return;
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('.help-dialog button')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [help]);
  const save = useCallback(async () => {
    if (!dirty || !parsed.song || busy) return;
    setSaving(true); setRequestError(''); const snapshot = text;
    try {
      const response = await fetch(`/api/songs/${id}`,{ method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:snapshot,revision}) });
      const data = await jsonResponse(response);
      setRevision(data.revision); setSaved(snapshot); setNotice('Sparad i låtbiblioteket');
      const song = parsed.song;
      setSongs(items => items.map(item => item.id === id ? { id,title:song.titel,artist:song.artist,key:song.grundtonart,status:song.status } : item));
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }, [dirty, parsed.song, busy, text, id, revision]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); searchInput.current?.focus(); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey); }
    };
    window.addEventListener('keydown',keyboard); return () => window.removeEventListener('keydown',keyboard);
  }, [save, undo]);
  async function openSong(nextId: string, reload = false) {
    if (busy || (nextId === id && !reload)) return;
    if (dirty && !window.confirm('Du har osparade ändringar. Vill du lämna dem och läsa in låtfilen?')) return;
    setLoading(true); setRequestError('');
    try {
      const data = await jsonResponse(await fetch(`/api/songs/${nextId}`));
      setId(nextId); setText(data.text); setSaved(data.text); setRevision(data.revision);
      if (nextId !== id) { setPages([]); setPreviewText(''); }
      setNotice(''); setTranspose(false); setCursor(0);
      history.current = [data.text]; historyIndex.current = 0; updateUndo();
      if (editor.current) editor.current.scrollTop = 0;
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte öppna låten.'); }
    finally { setLoading(false); }
  }
  async function refresh() {
    try { setSongs(await jsonResponse(await fetch('/api/songs'))); setNotice('Låtlistan uppdaterad'); }
    catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte uppdatera listan.'); }
  }
  function insert(action: EditAction) {
    try {
      const view = { top: editor.current?.scrollTop ?? 0, left: editor.current?.scrollLeft ?? 0, windowX: window.scrollX, windowY: window.scrollY };
      const result = insertFeature(text,cursor,action);
      edit(result.text); focusAt(result.cursor, view);
    }
    catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte infoga.'); }
  }
  function openChord(element: Element) {
    if (stale || busy || !parsed.song) return;
    const hit = element.closest<SVGElement>('.chord-hit, .section-hit');
    if (!hit) return;
    if (hit.classList.contains('section-hit')) {
      const section=Number(hit.dataset.section), part=parsed.song.delar[section];
      if (!part) return;
      setChordDraft(part.namn);setChordError('');
      setChordEdit({target:{kind:'section',section},source:text,label:`Ändra delnamn: ${part.namn}`});return;
    }
    const target: ChordTarget = {section:Number(hit.dataset.section),bar:Number(hit.dataset.bar),chord:Number(hit.dataset.chord),
      ...(hit.dataset.variant === undefined ? {} : {variant:Number(hit.dataset.variant)})};
    const raw = parsed.song.delar[target.section]?.takter[target.bar];
    if (raw === undefined) return;
    const bar = asBar(raw), value = target.variant === undefined ? bar.ackord : bar.varianter?.[target.variant]?.ackord;
    const chord = value?.trim().split(/\s+/)[target.chord];
    if (!chord) return;
    setChordDraft(chord); setChordError('');
    setChordEdit({target,source:text,label:hit.getAttribute('aria-label') ?? 'Ändra ackord'});
  }
  function applyChord() {
    if (!chordEdit) return;
    try {
      if (chordEdit.source !== text || stale || busy) throw new Error('Låtfilen har ändrats. Stäng och välj ackordet igen.');
      edit('kind' in chordEdit.target ? renameSection(text,chordEdit.target.section,chordDraft) : replaceExistingChord(text,chordEdit.target,chordDraft));
      setChordEdit(null);
    } catch (e) { setChordError(e instanceof Error ? e.message : 'Kunde inte ändra ackordet.'); }
  }
  function appendPart() {
    try {
      edit(insertReuse(text, formPart, formTimes, formInstruction, formAfter<0?undefined:formAfter));
      setFormOpen(false);
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte återanvända delen.'); }
  }
  function doTranspose() {
    try {
      const minor = parsed.song?.grundtonart.endsWith('m') ? 'm' : '';
      edit(transposeText(text,target+minor,spelling)); setTranspose(false); setNotice('Transponerad. Spara när du är nöjd.');
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte transponera.'); }
  }
  async function exportPdf() {
    if (!parsed.song) return;
    setExporting(true); setRequestError('');
    try {
      const response = await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,format:'pdf'})});
      if (!response.ok) await jsonResponse(response);
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a'); a.href=url; a.download=id.replace(/\.ya?ml$/, '')+'.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url),60_000); setNotice('PDF exporterad från texten i redigeraren');
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte exportera.'); }
    finally { setExporting(false); }
  }
  const visible = songs.filter(s => `${s.title} ${s.artist}`.toLocaleLowerCase('sv').includes(search.toLocaleLowerCase('sv')));
  return <div className="app-shell">
    <aside className="library" aria-label="Låtbibliotek">
      <a className="brand" href="/" onClick={e => e.preventDefault()}><span className="brand-mark"><Music2 size={22}/></span><span>harmis<span className="brand-dot">.</span></span></a>
      <div className="library-heading"><span>DITT LÅTBIBLIOTEK</span><button className="icon-button" onClick={refresh} title="Uppdatera låtlistan" aria-label="Uppdatera låtlistan"><RefreshCw size={14}/></button></div>
      <label className="search"><Search size={16}/><input ref={searchInput} aria-label="Sök låt eller artist" placeholder="Sök låt eller artist…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>/</kbd></label>
      <div className="library-count"><FolderOpen size={14}/><span>Alla låtar</span><span>{songs.length}</span></div>
      <nav className="song-list">{visible.map((song,index) => <button key={song.id} className={`song-item ${song.id === id ? 'active' : ''}`} onClick={() => openSong(song.id)} disabled={busy} aria-current={song.id === id ? 'page' : undefined}>
        <span className="song-number">{String(index+1).padStart(2,'0')}</span><span className="song-description"><strong>{song.title}</strong><small>{song.artist || 'Kontrollera låtfilen'}</small></span><span className="song-key">{song.error ? '!' : pretty(song.key)}</span>
      </button>)}{!visible.length && <p className="empty-search">Inga låtar matchar sökningen.</p>}</nav>
      <div className="library-footer"><span className="online-dot"/><span>Lokalt bibliotek</span><span className="file-tag">songs/</span></div>
    </aside>
    <main className="main">
      <div className={`workspace ${wide ? 'preview-wide' : ''}`}>
      <div className="editing-column">
      <header className="topbar"><div className="breadcrumb"><ListMusic size={16}/><span>Bibliotek</span><span className="breadcrumb-slash">/</span><span>Ackordblad</span></div><button className="text-button" onClick={() => setHelp(true)}><CircleHelp size={16}/>Så fungerar det</button></header>
      <section className="song-header"><div><div className="eyebrow">REDIGERA & SPELA</div><h1>{parsed.song?.titel || current?.title || 'Ditt nästa ackordblad'}</h1><p>{parsed.song?.artist || current?.artist || 'Lägg en låtfil i songs-mappen för att börja.'}{parsed.song?.version && <span className="version-label">{parsed.song.version}</span>}</p></div>
        <div className="header-actions"><button className="button secondary" disabled={!parsed.song || busy} onClick={() => { setFormAfter(selectedSection(text,cursor) ?? -1); setFormPart(parsed.song?.delar.find(part=>!part.ateranvand)?.namn ?? ''); setFormTimes(1); setFormInstruction(''); setFormOpen(!formOpen); }}><Plus size={16}/>Återanvänd del</button><button className="button secondary" onClick={() => { setTarget((parsed.song?.grundtonart || 'C').replace(/m$/,'')); setTranspose(!transpose); }} disabled={!parsed.song || busy}><ArrowUpDown size={16}/>Transponera</button><button className="button primary" onClick={exportPdf} disabled={!parsed.song || busy || exporting}>{exporting ? <LoaderCircle size={16} className="spin"/> : <ArrowDownToLine size={16}/>}Exportera PDF</button></div>
      </section>
      <div className="song-facts"><span><i>TONART</i><b>{parsed.song ? pretty(parsed.song.grundtonart) : '—'}</b></span><span><i>TAKTART</i><b>{parsed.song?.taktart || '—'}</b></span><span><i>TEMPO</i><b>{parsed.song?.tempo ? `${parsed.song.tempo} bpm` : '—'}</b></span><span><i>FORM</i><b>{parsed.song?.delar.length ?? '—'} delar</b></span><span className="draft-status"><span className={`status-dot ${parsed.song?.status === 'granskad' ? 'reviewed' : ''}`}/>{parsed.song?.status === 'granskad' ? 'Granskad' : 'Arbetsutkast'}</span></div>
      {formOpen && <section className="transpose-panel" aria-label="Återanvänd låtdel"><div><strong>Lägg till en återkomst</strong><p>Återkomsten infogas direkt bland låtdelarna på vald plats. Du kan lägga nya partier efter den.</p></div><label>Placering<select aria-label="Infoga efter" value={formAfter} onChange={e=>{setFormAfter(Number(e.target.value));setFormPart('');}}><option value={-1}>Sist i låten</option>{parsed.song?.delar.map((part,i)=><option key={i} value={i}>Efter {i+1}. {part.ateranvand ? `Återanvänd ${part.ateranvand}` : part.namn}</option>)}</select></label><label>Låtdel<select aria-label="Låtdel att återanvända" value={formPart} onChange={e=>setFormPart(e.target.value)}><option value="" disabled>Välj del</option>{parsed.song?.delar.map((part,i)=>!part.ateranvand&&(formAfter<0||i<=formAfter)?<option key={i} value={part.namn}>{part.namn}</option>:null)}</select></label><label>Antal gånger<select aria-label="Antal gånger" value={formTimes} onChange={e=>setFormTimes(Number(e.target.value))}>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label className="form-instruction">Anvisning för denna återkomst<input aria-label="Anvisning för denna återkomst" value={formInstruction} onChange={e=>setFormInstruction(e.target.value)} maxLength={180} placeholder="Till exempel: Instrumentalt (solo)"/></label><button className="button primary" onClick={appendPart} disabled={!parsed.song || busy || !formPart}>Infoga återanvänd del</button><button className="icon-button" aria-label="Stäng återanvändning" onClick={()=>setFormOpen(false)}><X size={18}/></button></section>}
      {transpose && <section className="transpose-panel" aria-label="Transponera låten"><div><strong>Välj ny tonart</strong><p>Ackorden och tonarten ändras i texten. Spara för att uppdatera låtfilen.</p></div><label>Måltonart<select aria-label="Måltonart" value={target} onChange={e => setTarget(e.target.value)}>{['C','Db','C#','D','Eb','D#','E','F','Gb','F#','G','Ab','G#','A','Bb','A#','B'].map(n => <option key={n} value={n}>{pretty(n)}{parsed.song?.grundtonart.endsWith('m') ? 'm' : ''}</option>)}</select></label><label>Förtecken<select aria-label="Förtecken" value={spelling} onChange={e => setSpelling(e.target.value as 'b'|'#')}><option value="b">♭ B-förtecken</option><option value="#">♯ Korsförtecken</option></select></label><button className="button primary" onClick={doTranspose}>Transponera</button><button className="icon-button" aria-label="Stäng transponering" onClick={() => setTranspose(false)}><X size={18}/></button></section>}
      {requestError && <div className="error-banner" role="alert">{requestError}<button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setRequestError('')}><X size={16}/></button></div>}
        <section className="editor-panel" aria-label="Låtfil">
          <div className="panel-header"><div><FileMusic size={17}/><h2>Låtfil</h2><span className="subtle-tag">YAML</span></div><div><button className="icon-button" aria-label="Ångra" title="Ångra (Ctrl+Z)" onClick={() => undo()} disabled={!undoState.back || busy}><RotateCcw size={16}/></button><button className="icon-button" aria-label="Gör om" onClick={() => undo(true)} disabled={!undoState.forward || busy}><RotateCw size={16}/></button><button className="save-button" onClick={save} disabled={!dirty || !parsed.song || busy}>{saving ? <LoaderCircle size={14} className="spin"/> : <Save size={14}/>}Spara{dirty && <span className="unsaved-dot"/>}</button></div></div>
          <div className="tools-caption"><span>INFOGA I VALD TAKT</span><span>{selection && parsed.song ? `${parsed.song.delar[selection.section]?.namn} · takt ${selection.bar+1}` : 'Placera markören i en takt'}</span></div>
          <div className="musical-tools">{musicalTools.map(tool => <button key={tool.action} title={tool.label} aria-label={tool.label} onMouseDown={event => event.preventDefault()} onClick={() => insert(tool.action)} disabled={!parsed.song || busy || (!selection && tool.action !== 'del')}><span>{tool.mark}</span>{tool.label}</button>)}</div>
          <div className="code-editor"><div className="line-numbers" ref={gutter} aria-hidden="true">{text.split('\n').map((_,i) => <div className={parsed.line === i+1 ? 'error-line' : ''} key={i}>{i+1}</div>)}</div><textarea ref={editor} aria-label="Låtfilens text" value={text} onChange={e => edit(e.target.value)} onSelect={e => setCursor(e.currentTarget.selectionStart)} onClick={e => setCursor(e.currentTarget.selectionStart)} onKeyUp={e => setCursor(e.currentTarget.selectionStart)} onScroll={e => { if(gutter.current) gutter.current.scrollTop=e.currentTarget.scrollTop; }} onKeyDown={e => { if(e.key === 'Tab') { e.preventDefault(); const pos=e.currentTarget.selectionStart; edit(text.slice(0,pos)+'  '+text.slice(e.currentTarget.selectionEnd)); focusAt(pos+2); } }} spellCheck={false} autoCapitalize="off" autoComplete="off" readOnly={busy} wrap="off"/></div>
          {parsed.error && text && <div className="parse-error" role="alert"><button onClick={() => focusAt(text.split('\n').slice(0,parsed.line-1).join('\n').length+1)}>Rad {parsed.line}</button><span>{parsed.error}</span></div>}
          <footer className="editor-footer"><span className={dirty ? 'dirty-label' : ''}>{dirty ? '● Osparade ändringar' : <><Check size={13}/>Alla ändringar sparade</>}</span><button onClick={() => openSong(id,true)} disabled={!id || busy} title="Läs om filen från disk">Läs in på nytt</button><span>Rad {text.slice(0,cursor).split('\n').length}</span></footer>
        </section>
      <section className="sources-section"><button className="sources-toggle" onClick={() => setSources(!sources)} aria-expanded={sources}><ChevronDown size={15} className={sources ? 'expanded' : ''}/><span>Källor & arbetsanteckningar</span><span>{parsed.song?.kallor?.length ?? 0} källor</span></button>{sources && <div className="sources-content">{parsed.song?.anteckningar?.map((note,i) => <p key={i}>{note}</p>)}<ul>{parsed.song?.kallor?.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.beskrivning}</a></li>)}</ul>{!parsed.song?.kallor?.length && <p>Den här låten har inga webbkällor.</p>}</div>}</section>
      <div className="bottom-status" role="status" aria-live="polite">{notice || (loading ? 'Öppnar låten…' : 'Ändra texten. Se resultatet. Spela.')}</div>
      </div>
        <section className={`preview-panel ${stale || busy ? 'preview-readonly' : ''}`} aria-label="Förhandsvisning" onClick={e => { if(e.target instanceof Element) openChord(e.target); }} onKeyDown={e=>{if ((e.key==='Enter' || e.key===' ') && e.target instanceof Element && e.target.closest('.chord-hit, .section-hit')) {e.preventDefault();openChord(e.target);}}}>
          <div className="panel-header"><div><h2>Förhandsvisning</h2><span className="live-label"><span className="online-dot"/>{rendering ? 'Uppdaterar' : stale && pages.length ? 'Inaktuell' : 'Live'}</span></div><div><select aria-label="Zoom" className="zoom-select" value={zoom} onChange={e => setZoom(e.target.value)}><option value="fit">Anpassa</option><option value="100">100 %</option><option value="125">125 %</option></select><button className="icon-button" aria-label={wide ? 'Visa redigerare' : 'Större förhandsvisning'} title="Växla bred förhandsvisning" onClick={() => setWide(!wide)}><Maximize2 size={16}/></button></div></div>
          <div className="preview-meta"><span>A4 · stående</span><span>{pages.length ? `${pages.length} ${pages.length === 1 ? 'sida' : 'sidor'}` : 'Förbereder ackordblad'}</span></div>
          {(parsed.error || renderError) && pages.length > 0 && <div className="stale-message">Senaste fungerande förhandsvisning. Rätta felet för att uppdatera.</div>}
          {renderError && <div className="parse-error" role="alert">{renderError}</div>}
          <div className={`paper-stack ${zoom === 'fit' ? 'fit-pages' : ''}`} style={zoom === 'fit' ? undefined : { '--paper-width': `${Number(zoom)*7.94}px` } as React.CSSProperties}>
            {pages.map((svg,i) => <figure key={i} className="paper" aria-label={`Ackordblad sida ${i+1}`} dangerouslySetInnerHTML={{__html:svg}}/>)}
            {!pages.length && <div className="preview-empty">{parsed.error ? <><FileMusic size={36}/><p>Förhandsvisningen visas när låtfilen är giltig.</p></> : <><LoaderCircle size={30} className="spin"/><p>Ritar ditt ackordblad…</p></>}</div>}
          </div>
          <footer className="preview-footer"><span>Klicka på ett ackord eller delnamn för att ändra det. Spara skriver till låtfilen.</span></footer>
        </section>
      </div>
    </main>
    {chordEdit && <dialog className="chord-dialog" ref={chordDialog} onCancel={()=>setChordEdit(null)} aria-labelledby="chord-title"><form onSubmit={e=>{e.preventDefault();applyChord();}}><h2 id="chord-title">{'kind' in chordEdit.target ? 'Ändra delnamn' : 'Ändra ackord'}</h2><p>{chordEdit.label}</p><label htmlFor="chord-value">{'kind' in chordEdit.target ? 'Delnamn' : 'Ackord'}</label><input id="chord-value" ref={chordInput} autoFocus value={chordDraft} onChange={e=>{setChordDraft(e.target.value);setChordError('');}} autoComplete="off" spellCheck={false} aria-invalid={!!chordError} aria-describedby={chordError ? 'chord-error' : undefined}/>{!('kind' in chordEdit.target) && <><p className="chord-entry-hint">Skriv flera ackord med mellanslag för att ersätta det valda ackordet i samma takt. Högst fyra ackord per takt. Angivna slag delas inom det valda ackordets utrymme.</p><label className="parenthesis-option"><input type="checkbox" checked={!!chordDraft.trim() && chordDraft.trim().split(/\s+/).every(value=>value.startsWith('(')&&value.endsWith(')'))} onChange={e=>{setChordDraft(chordDraft.trim().split(/\s+/).filter(Boolean).map(value=>{const wrapped=value.startsWith('(')&&value.endsWith(')');return e.target.checked ? (wrapped?value:`(${value})`) : (wrapped?value.slice(1,-1):value);}).join(' '));setChordError('');}}/>Ackord inom parentes</label></>}{chordError && <p id="chord-error" role="alert">{chordError}</p>}<div><button type="button" className="button secondary" onClick={()=>setChordEdit(null)}>Avbryt</button><button className="button primary" type="submit">{'kind' in chordEdit.target ? 'Ändra delnamn' : 'Ändra ackord'}</button></div></form></dialog>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="icon-button close-help" aria-label="Stäng hjälp" autoFocus onClick={() => setHelp(false)}><X size={20}/></button><div className="eyebrow">FRÅN LÅTFIL TILL NOTSTÄLL</div><h2 id="help-title">Gör harmisen till din.</h2><ol><li><strong>Välj en låt.</strong> Listan läser filerna i songs-mappen. Uppdatera listan när du har lagt till en fil.</li><li><strong>Ändra texten.</strong> Varje rad under takter är en takt. Separera flera ackord i samma takt med mellanslag.</li><li><strong>Infoga musikaliska tecken.</strong> Placera markören i en takt och använd knapparna. Ändra de infogade värdena direkt i texten.</li><li><strong>Transponera och spara.</strong> Grundtoner, bastoner och tonart ändras tillsammans. Spara skriver över låtfilen och behåller en lokal säkerhetskopia.</li><li><strong>Exportera PDF.</strong> Exporten använder texten du ser, även innan du sparar. Öppna PDF-filen för att skriva ut den.</li></ol><p className="help-note">Variantackord anger vilken gång alternativet spelas. Ackordslag placerar ackordbyten, t.ex. [1, 4]. Egen rytm anger anslag: i 4/4 betyder slag 1.5 första åttondelens efterslag, 1å; notvarde 8 betyder åttondel. Lägg till text: "Eb" eller annan fritext på en rytmnot för att visa text direkt under noten. Tomma textfält tar ingen extra höjd. Texten ändras inte vid transponering.</p><p className="help-note">Ctrl+S sparar. Ctrl+Z ångrar. Tab infogar två mellanslag. Ett skrivfel visar radnumret och behåller senaste fungerande förhandsvisning.</p><button className="button primary" onClick={() => setHelp(false)}>Tillbaka till musiken</button></section></div>}
  </div>;
}
