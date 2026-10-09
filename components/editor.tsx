'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpDown, Check, CircleHelp, Columns2, FileMusic, ListMusic, LoaderCircle, Maximize2, Minimize2, Plus, RotateCcw, RotateCw, Save, X, Code2, Eye, PanelRightOpen, Type, BookOpen } from 'lucide-react';
import { readSong, asBar, pretty, SongError, transposeText } from '@/lib/song';
import { EditAction, insertFeature, selectedBar, insertReuse, selectedSection } from '@/lib/edit';
import { LiveViewer, type LiveSession, type LiveSong, type LiveLocation } from './live-viewer';
import { Library } from './library';
import { ScoreEditor, ScoreButton, type ScoreEditorHandle } from './score-editor';
import type { SongEntry } from '@/lib/storage';
import type { Setlist } from '@/lib/setlists';

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
  const [printPages,setPrintPages]=useState<string[]>([]),renderCache=useRef(new Map<string,string[]>());
  const [pages, setPages] = useState<string[]>([]), [previewText, setPreviewText] = useState('');
  const [saving, setSaving] = useState(false), [loading, setLoading] = useState(false), [exporting, setExporting] = useState(false), [rendering, setRendering] = useState(false);
  const [notice, setNotice] = useState(''), [requestError, setRequestError] = useState(''), [renderError, setRenderError] = useState('');
  const [formOpen, setFormOpen] = useState(false), [formPart, setFormPart] = useState(''), [formTimes, setFormTimes] = useState(1), [formInstruction, setFormInstruction] = useState(''), [formAfter,setFormAfter] = useState(-1);
  const [cursor, setCursor] = useState(0), [help, setHelp] = useState(false), [transpose, setTranspose] = useState(false);
  const [target, setTarget] = useState('C'), [spelling, setSpelling] = useState<'b' | '#'>('b');
  const score = useRef<ScoreEditorHandle>(null),fullRoot=useRef<HTMLElement>(null);
  const [fullscreen,setFullscreen]=useState(false),[fullscreenPending,setFullscreenPending]=useState(false);
  useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement===fullRoot.current);document.addEventListener('fullscreenchange',sync);sync();return()=>document.removeEventListener('fullscreenchange',sync);},[]);
  const [showText,setShowText]=useState(false),[inlineDirty,setInlineDirty]=useState(false),[printPreview,setPrintPreview]=useState(false),[small,setSmall]=useState(false),[panelVisible,setPanelVisible]=useState(true),[libraryOpen,setLibraryOpen]=useState(false),[libraryCollapsed,setLibraryCollapsed]=useState(false);
  const [previewMode,setPreviewMode]=useState('');
  const renderMode=printPreview?'print':'edit';
  useEffect(()=>{const media=matchMedia('(max-width:760px)'),sync=()=>setSmall(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
  const [zoom, setZoom] = useState('fit');
  const [twoPages, setTwoPages] = useState(false);
  const [live, setLive] = useState<LiveSession | null>(null);
  const liveBookmarks=useRef(new Map<string,LiveLocation>());
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);
  const liveDrafts=useRef(new Map<string,{text:string;saved:string;revision:string;history:string[];historyIndex:number}>());
  const liveReturnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(!live&&!loading&&liveReturnFocus.current){liveReturnFocus.current.focus({preventScroll:true});liveReturnFocus.current=null;}},[live,loading]);
  const [pageRequest,setPageRequest]=useState<{page:number;request:number}|undefined>();
  const closeLive = useCallback(async(location:LiveLocation) => {
    liveBookmarks.current.set(location.id,location);setLive(null);setTwoPages(false);setPrintPreview(false);
    if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
    if(location.id!==id){
      liveDrafts.current.set(id,{text,saved,revision,history:[...history.current],historyIndex:historyIndex.current});
      setLoading(true);
      try{
        const cached=liveDrafts.current.get(location.id),data=cached??await jsonResponse(await fetch(`/api/songs/${location.id}`));
        score.current?.clear();editGroup.current=null;setNotice('');setCursor(0);setId(location.id);setText(data.text);setSaved(cached?.saved??data.text);setRevision(data.revision);setPages([]);setPrintPages([]);setPreviewText('');
        history.current=cached?.history??[data.text];historyIndex.current=cached?.historyIndex??0;setUndoState({back:historyIndex.current>0,forward:historyIndex.current<history.current.length-1});
      }catch(e){setRequestError(e instanceof Error?e.message:'Kunde inte öppna låten.');return;}finally{setLoading(false);}
    }
    setPageRequest({page:location.page,request:Date.now()});
  },[id,text,saved,revision]);
  async function startLive(name?: string, items?: LiveSong[]) {
    if (!items && activeSetlist) {
      name = activeSetlist.name;
      items = activeSetlist.songs.map(songId => ({id:songId,title:songs.find(song => song.id === songId)?.title ?? songId}));
    }
    if (busy || items?.length===0) return;
    liveReturnFocus.current=document.activeElement as HTMLElement;
    const snapshot=score.current?score.current.flush():text;if(snapshot===null)return;
    let song;try{song=readSong(snapshot);}catch{return;}
    // Live is portaled to body and must not be hidden behind the editor's fullscreen subtree.
    try{if(document.fullscreenElement===fullRoot.current)await document.exitFullscreen();}
    catch(e){setRequestError(e instanceof Error?e.message:'Kunde inte lämna helskärm.');return;}
    const liveSongs=items??songs.map(item=>({id:item.id,title:item.title}));
    const startSong=Math.max(0,liveSongs.findIndex(item=>item.id===id));
    const bookmark=liveBookmarks.current.get(liveSongs[startSong].id);
    setLive({name:name??song.titel,songs:liveSongs,startSong,startPage:liveSongs[startSong].id===id?(score.current?.getPage()??bookmark?.page??0):0,twoPages:bookmark?.twoPages,turnPairs:bookmark?.turnPairs,override:{id,text:snapshot},drafts:Object.fromEntries([...liveDrafts.current].map(([key,value])=>[key,value.text]))});
  }
  async function showLibrary(open:boolean,focusSearch=false){
    try{if(document.fullscreenElement===fullRoot.current)await document.exitFullscreen();}
    catch(e){setRequestError(e instanceof Error?e.message:'Kunde inte lämna helskärm.');return;}
    setLibraryOpen(open);if(open)setLibraryCollapsed(false);if(open&&focusSearch)requestAnimationFrame(()=>searchInput.current?.focus());
  }
  async function toggleFullscreen(){
    if(fullscreenPending||busy||score.current?.flush()===null)return;
    setFullscreenPending(true);setRequestError('');
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(fullRoot.current?.requestFullscreen){setLibraryOpen(false);await fullRoot.current.requestFullscreen();}else throw new Error('Helskärm stöds inte i den här webbläsaren.');}
    catch(e){setRequestError(e instanceof Error?e.message:'Kunde inte öppna helskärm.');}
    finally{setFullscreenPending(false);}
  }
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
  const stale = previewText !== text || previewMode !== renderMode;
  const busy = saving || loading;
  const updateUndo = () => setUndoState({ back: historyIndex.current > 0, forward: historyIndex.current < history.current.length-1 });
  const editGroup=useRef<{id:string;index:number}|null>(null);
  const edit = useCallback((value: string,group?:string) => {
    if (history.current[historyIndex.current] === value) return;
    if(group&&editGroup.current?.id===group&&historyIndex.current>editGroup.current.index){history.current[historyIndex.current]=value;}else{const index=historyIndex.current;history.current = history.current.slice(0, index+1);history.current.push(value);editGroup.current=group?{id:group,index}:null;}
    if (history.current.length > 200) history.current.shift();
    historyIndex.current = history.current.length-1; updateUndo();
    setText(value); setNotice(''); setRequestError('');
  }, []);
  const rollbackScore=useCallback((value:string,group:string)=>{if(editGroup.current?.id===group){historyIndex.current=editGroup.current.index;history.current=history.current.slice(0,historyIndex.current+1);}setText(value);editGroup.current=null;updateUndo();},[]);
  const undo = useCallback((forward = false) => {
    if(score.current?.flush()===null)return;score.current?.clear();editGroup.current=null;
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
        const get=async(editable:boolean)=>{const key=(editable?renderMode:'plain')+':'+text;const cached=renderCache.current.get(key);if(cached)return cached;const response=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,editable}),signal:controller.signal});const data=await jsonResponse(response);if(!controller.signal.aborted){renderCache.current.set(key,data.pages);if(renderCache.current.size>16)renderCache.current.delete(renderCache.current.keys().next().value!);}return data.pages as string[];};
        const [editablePages,plainPages]=await Promise.all([get(!printPreview),get(false)]);
        if(!controller.signal.aborted){setPages(editablePages);setPrintPages(plainPages);setPreviewText(text);setPreviewMode(renderMode);}

      } catch (e) { if (!controller.signal.aborted) setRenderError(e instanceof Error ? e.message : 'Förhandsvisningen misslyckades.'); }
      finally { if (!controller.signal.aborted) setRendering(false); }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, parsed.song, printPreview, renderMode]);
  useEffect(() => {
    const pendingLiveDraft=[...liveDrafts.current.values()].some(draft=>draft.text!==draft.saved);
    if (!dirty&&!inlineDirty&&!pendingLiveDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn);
  }, [dirty,inlineDirty,id]);
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
    if (!parsed.song||busy)return;const snapshot=score.current?score.current.flush():text;if(snapshot===null||snapshot===saved)return;let snapshotSong;try{snapshotSong=readSong(snapshot);}catch(e){setRequestError(e instanceof Error?e.message:'Kontrollera låten.');return;}
    setSaving(true); setRequestError('');
    try {
      const response = await fetch(`/api/songs/${id}`,{ method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:snapshot,revision}) });
      const data = await jsonResponse(response);
      liveDrafts.current.delete(id);setRevision(data.revision); setSaved(snapshot); setNotice('Sparad i låtbiblioteket');
      const song = snapshotSong;
      setSongs(items => items.map(item => item.id === id ? { id,title:song.titel,artist:song.artist,key:song.grundtonart,status:song.status } : item));
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte spara.'); }
    finally { setSaving(false); }
  }, [parsed.song,busy,text,saved,id,revision]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (live || (event.target as HTMLElement)?.closest('.setlist-dialog')) return;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault();void showLibrary(true,true); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
      if (event.key.toLowerCase() === 'z' && (!(event.target instanceof HTMLElement) || !event.target.matches('input,textarea,[contenteditable]') || event.target===editor.current)) { event.preventDefault(); undo(event.shiftKey); }
    };
    window.addEventListener('keydown',keyboard); return () => window.removeEventListener('keydown',keyboard);
  }, [save, undo, live]);
  async function openSong(nextId: string, reload = false) {
    if (busy)return;if(nextId===id&&!reload){setLibraryOpen(false);return;}
    let snapshot=score.current?score.current.flush():text,discarded=false;if(snapshot===null){if(!window.confirm('Du har osparade ändringar. Vill du lämna dem och läsa in låtfilen?'))return;score.current?.rollback();score.current?.clear();snapshot=text;discarded=true;}
    if (!discarded&&(snapshot!==saved||inlineDirty) && !window.confirm('Du har osparade ändringar. Vill du lämna dem och läsa in låtfilen?')) return;
    setLoading(true); setRequestError('');
    try {
      const cached=reload?undefined:liveDrafts.current.get(nextId);
      const data = cached??await jsonResponse(await fetch(`/api/songs/${nextId}`));
      liveDrafts.current.delete(id);liveDrafts.current.delete(nextId);
      score.current?.clear();editGroup.current=null;setLibraryOpen(false);setId(nextId); setText(data.text); setSaved(cached?.saved??data.text); setRevision(data.revision);
      if (nextId !== id) { setPages([]);setPrintPages([]); setPreviewText(''); }
      setNotice(''); setTranspose(false); setCursor(0);
      history.current = cached?.history??[data.text]; historyIndex.current = cached?.historyIndex??0; updateUndo();
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
  function appendPart() {
    try {
      edit(insertReuse(text, formPart, formTimes, formInstruction, formAfter<0?undefined:formAfter));
      setFormOpen(false);
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte återanvända delen.'); }
  }
  function doTranspose() {
    try {
      const minor = parsed.song?.grundtonart.endsWith('m') ? 'm' : '';
      const source=score.current?score.current.flush():text;if(source===null)return;edit(transposeText(source,target+minor,spelling));score.current?.clear(); setTranspose(false); setNotice('Transponerad. Spara när du är nöjd.');
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte transponera.'); }
  }
  async function exportPdf() {
    if (!parsed.song) return;const snapshot=score.current?score.current.flush():text;if(snapshot===null)return;
    setExporting(true); setRequestError('');
    try {
      const response = await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:snapshot,format:'pdf'})});
      if (!response.ok) await jsonResponse(response);
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a'); a.href=url; a.download=id.replace(/\.ya?ml$/, '')+'.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url),60_000); setNotice('PDF exporterad från texten i redigeraren');
    } catch (e) { setRequestError(e instanceof Error ? e.message : 'Kunde inte exportera.'); }
    finally { setExporting(false); }
  }
  return <div className={`app-shell score-app ${libraryOpen?'library-open':''} ${libraryCollapsed?'library-collapsed':''}`}>
    {live&&<LiveViewer session={live} onClose={closeLive}/>}
    <div className="library-region"><Library songs={songs} id={id} busy={busy} openSong={openSong} refresh={refresh} searchInput={searchInput} startLive={startLive} onActiveSetlistChange={setActiveSetlist}/>{small&&<button className="button secondary library-close" onClick={()=>setLibraryOpen(false)}>Stäng bibliotek</button>}</div>
    <main ref={fullRoot} className="main score-main">
      <h1 className="sr-only">{parsed.song?.titel||current?.title||'Harmisgenerator'}</h1>
      <div className="editor-global-tools">
        <div className="global-nav-wrap"><div className="global-nav"><ScoreButton className="mobile-library" label="Visa bibliotek" active={libraryOpen} onClick={()=>void showLibrary(!libraryOpen)}><BookOpen/></ScoreButton><ScoreButton className="desktop-library" label={libraryCollapsed?'Visa bibliotek':'Dölj bibliotek'} active={!libraryCollapsed} onClick={()=>setLibraryCollapsed(v=>!v)}><BookOpen/></ScoreButton><ScoreButton label="Form" onClick={()=>score.current?.showPanel('form')}><ListMusic/></ScoreButton><ScoreButton label="Låt" onClick={()=>score.current?.showPanel('song')}><Type/></ScoreButton><ScoreButton label={showText?'Dölj låtfil':'Visa låtfil'} active={showText} onClick={()=>{if(score.current?.flush()!==null)setShowText(v=>!v);}}><Code2/></ScoreButton><ScoreButton label="Transponera" disabled={!parsed.song||busy} onClick={()=>{if(score.current?.flush()===null)return;setTarget((parsed.song?.grundtonart||'C').replace(/m$/,''));setTranspose(v=>!v);}}><ArrowUpDown/></ScoreButton><ScoreButton label="Så fungerar det" onClick={()=>setHelp(true)}><CircleHelp/></ScoreButton></div><span className="global-swipe-hint">↔ Svep</span></div>
        <div className="global-actions"><ScoreButton label="Ångra" disabled={!undoState.back&&!inlineDirty||busy} onClick={()=>undo()}><RotateCcw/></ScoreButton><ScoreButton label="Gör om" disabled={!undoState.forward||busy} onClick={()=>undo(true)}><RotateCw/></ScoreButton><ScoreButton label="Spara" disabled={(!dirty&&!inlineDirty)||!parsed.song||busy} onClick={()=>void save()}>{saving?<LoaderCircle className="spin"/>:<Save/>}</ScoreButton><ScoreButton label="Exportera PDF" disabled={!parsed.song||busy||exporting} onClick={()=>void exportPdf()}>{exporting?<LoaderCircle className="spin"/>:<ArrowDownToLine/>}</ScoreButton><ScoreButton label={panelVisible?'Fäll in menykolumn':'Visa menykolumn'} active={panelVisible} onClick={()=>score.current?.togglePanel()}><PanelRightOpen/></ScoreButton></div>
      </div>
      {formOpen && <section className="transpose-panel" aria-label="Återanvänd låtdel"><div><strong>Lägg till en återkomst</strong><p>Återkomsten infogas direkt bland låtdelarna på vald plats. Du kan lägga nya partier efter den.</p></div><label>Placering<select aria-label="Infoga efter" value={formAfter} onChange={e=>{setFormAfter(Number(e.target.value));setFormPart('');}}><option value={-1}>Sist i låten</option>{parsed.song?.delar.map((part,i)=><option key={i} value={i}>Efter {i+1}. {part.ateranvand ? `Återanvänd ${part.ateranvand}` : part.namn}</option>)}</select></label><label>Låtdel<select aria-label="Låtdel att återanvända" value={formPart} onChange={e=>setFormPart(e.target.value)}><option value="" disabled>Välj del</option>{parsed.song?.delar.map((part,i)=>!part.ateranvand&&(formAfter<0||i<=formAfter)?<option key={i} value={part.namn}>{part.namn}</option>:null)}</select></label><label>Antal gånger<select aria-label="Antal gånger" value={formTimes} onChange={e=>setFormTimes(Number(e.target.value))}>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label className="form-instruction">Anvisning för denna återkomst<input aria-label="Anvisning för denna återkomst" value={formInstruction} onChange={e=>setFormInstruction(e.target.value)} maxLength={180} placeholder="Till exempel: Instrumentalt (solo)"/></label><button className="button primary" onClick={appendPart} disabled={!parsed.song || busy || !formPart}>Infoga återanvänd del</button><button className="icon-button" aria-label="Stäng återanvändning" onClick={()=>setFormOpen(false)}><X size={18}/></button></section>}
      {transpose && <section className="transpose-panel" aria-label="Transponera låten"><div><strong>Välj ny tonart</strong><p>Ackorden och tonarten ändras i texten. Spara för att uppdatera låtfilen.</p></div><label>Måltonart<select aria-label="Måltonart" value={target} onChange={e => setTarget(e.target.value)}>{['C','Db','C#','D','Eb','D#','E','F','Gb','F#','G','Ab','G#','A','Bb','A#','B'].map(n => <option key={n} value={n}>{pretty(n)}{parsed.song?.grundtonart.endsWith('m') ? 'm' : ''}</option>)}</select></label><label>Förtecken<select aria-label="Förtecken" value={spelling} onChange={e => setSpelling(e.target.value as 'b'|'#')}><option value="b">♭ B-förtecken</option><option value="#">♯ Korsförtecken</option></select></label><button className="button primary" onClick={doTranspose}>Transponera</button><button className="icon-button" aria-label="Stäng transponering" onClick={() => setTranspose(false)}><X size={18}/></button></section>}
      {requestError && <div className="error-banner" role="alert">{requestError}<button className="icon-button" aria-label="Stäng felmeddelande" onClick={() => setRequestError('')}><X size={16}/></button></div>}
      {showText&&<>        <section className="editor-panel legacy-file-panel" aria-label="Låtfil">
          <div className="panel-header"><div><FileMusic size={17}/><h2>Låtfil</h2><span className="subtle-tag">YAML</span></div><ScoreButton label="Dölj låtfil" onClick={()=>setShowText(false)}><X/></ScoreButton></div>
          <button className="button secondary legacy-reuse" disabled={!parsed.song||busy} onClick={()=>{setFormAfter(selectedSection(text,cursor)??-1);setFormPart(parsed.song?.delar.find(p=>!p.ateranvand)?.namn??'');setFormOpen(v=>!v);}}>Återanvänd del</button><div className="tools-caption"><span>INFOGA I VALD TAKT</span><span>{selection && parsed.song ? `${parsed.song.delar[selection.section]?.namn} · takt ${selection.bar+1}` : 'Placera markören i en takt'}</span></div>
          <div className="musical-tools">{musicalTools.map(tool => <button key={tool.action} title={tool.label} aria-label={tool.label} onMouseDown={event => event.preventDefault()} onClick={() => insert(tool.action)} disabled={!parsed.song || busy || (!selection && tool.action !== 'del')}><span>{tool.mark}</span>{tool.label}</button>)}</div>
          <div className="code-editor"><div className="line-numbers" ref={gutter} aria-hidden="true">{text.split('\n').map((_,i) => <div className={parsed.line === i+1 ? 'error-line' : ''} key={i}>{i+1}</div>)}</div><textarea ref={editor} aria-label="Låtfilens text" value={text} onChange={e => edit(e.target.value)} onSelect={e => setCursor(e.currentTarget.selectionStart)} onClick={e => setCursor(e.currentTarget.selectionStart)} onKeyUp={e => setCursor(e.currentTarget.selectionStart)} onScroll={e => { if(gutter.current) gutter.current.scrollTop=e.currentTarget.scrollTop; }} onKeyDown={e => { if(e.key === 'Tab') { e.preventDefault(); const pos=e.currentTarget.selectionStart; edit(text.slice(0,pos)+'  '+text.slice(e.currentTarget.selectionEnd)); focusAt(pos+2); } }} spellCheck={false} autoCapitalize="off" autoComplete="off" readOnly={busy} wrap="off"/></div>
          {parsed.error && text && <div className="parse-error" role="alert"><button onClick={() => focusAt(text.split('\n').slice(0,parsed.line-1).join('\n').length+1)}>Rad {parsed.line}</button><span>{parsed.error}</span></div>}
          <footer className="editor-footer"><span className={dirty ? 'dirty-label' : ''}>{dirty ? '● Osparade ändringar' : <><Check size={13}/>Alla ändringar sparade</>}</span><button onClick={() => openSong(id,true)} disabled={!id || busy} title="Läs om filen från disk">Läs in på nytt</button><span>Rad {text.slice(0,cursor).split('\n').length}</span></footer>
        </section>
</>}
      <div className="score-preview-tools"><span className="live-label"><span className="online-dot"/>{rendering?'Uppdaterar':stale&&pages.length?'Inaktuell':'Uppdaterad'}</span><span>{printPreview?'Utskriftsförhandsgranskning':'Klicka på ackord eller taktnummer'}</span><span className="grow"/><select aria-label="Zoom" className="zoom-select" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="fit">Anpassa</option><option value="100">100 %</option><option value="125">125 %</option></select><ScoreButton label="Liveläge" disabled={!parsed.song||busy} onClick={()=>void startLive()}><Eye/></ScoreButton><ScoreButton label={fullscreen?'Lämna helskärm':'Helskärm'} active={fullscreen} disabled={!parsed.song||busy||fullscreenPending} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize2/>:<Maximize2/>}</ScoreButton><ScoreButton label="Visa två sidor sida vid sida" active={twoPages} disabled={!parsed.song||busy||pages.length<2} onClick={()=>{if(score.current?.flush()===null)return;setTwoPages(!twoPages);setPrintPreview(!twoPages);}}><Columns2/></ScoreButton><span className="preview-page-count">{pages.length} {pages.length===1?'sida':'sidor'}</span></div>
      {(parsed.error||renderError)&&pages.length>0&&<div className="stale-message">Senaste fungerande förhandsvisning. Rätta felet för att uppdatera.</div>}
      {renderError&&<p className="parse-error" role="alert">{renderError}</p>}
      <ScoreEditor pageRequest={pageRequest} key={id} ref={score} text={text} song={parsed.song} pages={pages} printPages={printPages} printPreview={printPreview} previewText={previewText} busy={busy} enabled={!printPreview&&!!parsed.song&&previewMode===renderMode} zoom={zoom} twoPages={twoPages} onEdit={edit} onRollback={rollbackScore} onCursor={setCursor} onDraftChange={setInlineDirty} onNotice={setNotice} onPanelChange={setPanelVisible}
      />
      <div className="bottom-status" role="status" aria-live="polite">{notice||(loading?'Öppnar låten…':dirty||inlineDirty?'Osparade ändringar':'Klick markerar ackord · klick igen redigerar')}</div>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="icon-button close-help" aria-label="Stäng hjälp" autoFocus onClick={() => setHelp(false)}><X size={20}/></button><div className="eyebrow">FRÅN LÅTFIL TILL NOTSTÄLL</div><h2 id="help-title">Gör harmisen till din.</h2><ol><li><strong>Välj setlista och låt.</strong> Skapa en setlista med plusknappen i biblioteket, eller öppna Alla låtar. Redigera ändrar listans spelordning; A–Ö-knappen sorterar bara visningen. Listan läser filerna i songs-mappen. Uppdatera listan när du har lagt till en fil.</li><li><strong>Redigera på bladet.</strong> Första klicket markerar ett ackord, nästa öppnar taktens ackordrad. Skriv flera ackord med mellanslag. Enter sparar raden, Escape avbryter.</li><li><strong>Välj takt eller del.</strong> Taktnummerraden markerar takten. Ctrl-klick eller Cmd-klick väljer enskilda takter. Shift-klick väljer ett spann inom samma del. På pekskärm trycker du på taktnumren för att markera fler. Verktygen visas vid markeringen. Visa låtfil öppnar det avancerade textläget.</li><li><strong>Färgmarkera.</strong> Öppna markeringspennan ovanför bladet och välj rött, gult, blått eller grönt. Klicka på ett ackord eller en symbol, eller dra över en del av en text. Suddgummit tar bort elementets färg. Markeringarna sparas med låten och syns även i PDF och Live.</li><li><strong>Transponera och spara.</strong> Grundtoner, bastoner och tonart ändras tillsammans. Spara skriver över låtfilen och behåller en lokal säkerhetskopia.</li><li><strong>Exportera PDF.</strong> Exporten använder texten du ser, även innan du sparar. Öppna PDF-filen för att skriva ut den.</li></ol><p className="help-note">Variantackord anger vilken gång alternativet spelas. Ackordslag placerar ackordbyten, t.ex. [1, 4]. Egen rytm anger anslag: i 4/4 betyder slag 1.5 första åttondelens efterslag, 1å; notvarde 8 betyder åttondel. Lägg till text: "Eb" eller annan fritext på en rytmnot för att visa text direkt under noten. Tomma textfält tar ingen extra höjd. Texten ändras inte vid transponering.</p><p className="help-note">Ctrl+S sparar. Ctrl+Z ångrar musikändringar; i ett öppet skrivfält gäller vanlig textånger. Tab avslutar skrivningen på bladet. Ett skrivfel visar radnumret och behåller senaste fungerande förhandsvisning.</p><button className="button primary" onClick={() => setHelp(false)}>Tillbaka till musiken</button></section></div>}
    </main>
  </div>;
}
