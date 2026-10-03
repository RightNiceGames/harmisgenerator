'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns2, LoaderCircle, RefreshCw, X } from 'lucide-react';

export type LiveSong = {id: string; title: string};
export type LiveSession = {name: string; songs: LiveSong[]; override?: {id: string; text: string}};
type Props = {session: LiveSession; onClose: () => void};
async function data(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Kunde inte läsa harmisen.');
  return result;
}
export function LiveViewer({session, onClose}: Props) {
  const [position, setPosition] = useState<{song: number; page: number | null}>({song: 0, page: 0});
  const [twoPages, setTwoPages] = useState(true), [controls, setControls] = useState(true);
  const [chart, setChart] = useState<{id: string; pages: string[]} | null>(null);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cache = useRef(new Map<string, Promise<string[]>>());
  const song = session.songs[position.song];
  const pages = chart?.id === song.id ? chart.pages : [];
  const step = twoPages ? 2 : 1;
  const page = position.page === null ? Math.floor((pages.length - 1) / step) * step : position.page;
  const loading = !pages.length && !error;
  const atStart = position.song === 0 && page === 0;
  const atEnd = position.song === session.songs.length - 1 && (error || page + step >= pages.length);

  const load = useCallback((id: string) => {
    let pending = cache.current.get(id);
    if (!pending) {
      pending = (async () => {
        const text = session.override?.id === id ? session.override.text : (await data(await fetch(`/api/songs/${id}`, {cache:'no-store'}))).text;
        const result = await data(await fetch('/api/render', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})}));
        if (!Array.isArray(result.pages) || !result.pages.length) throw new Error('Harmisen saknar sidor.');
        return result.pages as string[];
      })();
      cache.current.set(id, pending);
    }
    return pending;
  }, [session]);
  useEffect(() => {
    let active = true;
    setError('');
    load(song.id).then(pages => {if (active) setChart({id:song.id, pages});}).catch(e => {if (active) setError(e instanceof Error ? e.message : 'Kunde inte läsa harmisen.');});
    // Render the next song ahead of time to avoid waiting while performing.
    const next = session.songs[position.song + 1];
    if (next) void load(next.id).catch(() => {});
    return () => {active = false;};
  }, [load, song.id, position.song, session, retry]);

  const showControls = useCallback(() => {
    setControls(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!root.current?.querySelector('.live-controls :focus')) setControls(false);
    }, 2500);
  }, []);
  useEffect(() => {showControls(); return () => {if (timer.current) clearTimeout(timer.current);};}, [showControls]);
  const navigate = useCallback((direction: number) => {
    if (loading) return;
    if (direction > 0) {
      if (!error && page + step < pages.length) setPosition({song:position.song, page:page + step});
      else if (position.song + 1 < session.songs.length) setPosition({song:position.song + 1, page:0});
    } else {
      if (!error && page > 0) setPosition({song:position.song, page:Math.max(0, page - step)});
      else if (position.song > 0) setPosition({song:position.song - 1, page:null});
    }
  }, [loading, error, page, step, pages.length, position.song, session.songs.length]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const oldInert = shell?.inert ?? false;
    const oldOverflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = 'hidden';
    root.current?.focus({preventScroll:true});
    let wasFullscreen = !!document.fullscreenElement;
    const fullscreen = () => {
      if (document.fullscreenElement) wasFullscreen = true;
      else if (wasFullscreen) onClose();
    };
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreen);
      if (shell) shell.inert = oldInert;
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus({preventScroll:true});
    };
  }, [onClose]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); onClose();}
      else if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        navigate(event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : -1);
      } else if (event.key === 'Tab') {
        showControls();
        const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => document.removeEventListener('keydown', keyboard, true);
  }, [navigate, onClose, showControls]);

  const shown = pages.slice(Math.max(0,page), Math.max(0,page) + step);
  return createPortal(<div ref={root} className={`live-view ${controls ? 'live-controls-visible' : ''}`} role="dialog" aria-modal="true" aria-label={`Live: ${session.name}`} tabIndex={-1} onPointerMove={showControls} onPointerDown={showControls}>
    <div className={`live-pages ${shown.length === 2 ? 'live-pair' : ''}`} aria-live="polite" aria-busy={loading}>
      {shown.map((svg, i) => <figure key={`${position.song}-${page+i}`} className="live-paper" aria-label={`${song.title}, sida ${page+i+1}`}><div inert dangerouslySetInnerHTML={{__html:svg}}/></figure>)}
      {loading && <div className="live-message" role="status"><LoaderCircle size={26} className="spin"/><p>Läser {song.title}…</p></div>}
      {error && <div className="live-message live-error" role="alert"><h2>{song.title}</h2><p>{error}</p><button className="button secondary" onClick={() => {cache.current.delete(song.id); setChart(null); setError(''); setRetry(retry+1);}}><RefreshCw size={16}/>Försök igen</button></div>}
    </div>
    <button className="live-turn live-back" aria-label="Föregående sida eller låt" disabled={loading || atStart} onClick={() => navigate(-1)}/>
    <button className="live-turn live-next" aria-label="Nästa sida eller låt" disabled={loading || !!atEnd} onClick={() => navigate(1)}/>
    <div className="live-controls" onFocus={showControls} onBlur={showControls}>
      <button className="live-control live-exit" aria-label="Avsluta Live-läge" title="Avsluta (Escape)" onClick={onClose}><X size={22}/></button>
      <button className="live-control live-layout" aria-label="Två sidor i Live-läge" aria-pressed={twoPages} title={twoPages ? 'Visa en sida' : 'Visa två sidor'} onClick={() => {
        const nextStep = twoPages ? 1 : 2;
        setPosition({...position, page: Math.floor(Math.max(0,page) / nextStep) * nextStep}); setTwoPages(!twoPages); showControls();
      }}><Columns2 size={20}/><span>{twoPages ? '2 sidor' : '1 sida'}</span></button>
    </div>
  </div>, document.body);
}
