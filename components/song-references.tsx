import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Check, ChevronDown, Link2, Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react';
import type { Song } from '@/lib/song';
import { ScoreButton } from './score-button';

type Source = NonNullable<Song['kallor']>[number];
type Draft = {kind:'kallor';index?:number;url:string;description:string;error:string} | {kind:'anteckningar';index?:number;text:string;error:string};
export type SongReferencesHandle = {flush:()=>boolean;clear:()=>void};
type Props = {
  song?:Song;
  text:string;
  busy:boolean;
  onApply:(field:'kallor'|'anteckningar',index:number|undefined,value:Source|string|undefined)=>{text:string}|{error:string};
  onDirty:(dirty:boolean)=>void;
  onInvalid:()=>void;
};

export const SongReferences = forwardRef<SongReferencesHandle,Props>(function SongReferences({song,text,busy,onApply,onDirty,onInvalid},ref) {
  const [expanded,setExpanded] = useState(false),[draft,setDraft] = useState<Draft|null>(null);
  const current = useRef<Draft|null>(null),editor = useRef<HTMLFormElement>(null),ownText = useRef<string|null>(null);
  function update(next:Draft|null) {
    current.current = next;
    setDraft(next);
    const original = next?.index===undefined?undefined:next.kind==='kallor'?song?.kallor?.[next.index]:song?.anteckningar?.[next.index];
    onDirty(!!next&&(next.kind==='kallor'
      ? next.url!==(typeof original==='object'?original.url:'') || next.description!==(typeof original==='object'?original.beskrivning:'')
      : next.text!==(typeof original==='string'?original:'')));
  }
  function reject(value:Draft,message:string) {
    update({...value,error:message});
    setExpanded(true);
    onInvalid();
    requestAnimationFrame(()=>editor.current?.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea')?.focus());
    return false;
  }
  function commit() {
    const value=current.current;
    if(!value)return true;
    if(value.index===undefined&&(value.kind==='kallor'?!value.url.trim()&&!value.description.trim():!value.text.trim())) {update(null);return true;}
    if(value.kind==='kallor') {
      try {new URL(value.url.trim());} catch {return reject(value,'Ange en giltig webbadress, till exempel https://example.com.');}
    } else if(!value.text.trim()) return reject(value,'Skriv en arbetsanteckning eller avbryt.');
    const result=onApply(value.kind,value.index,value.kind==='kallor'?{url:value.url.trim(),beskrivning:value.description.trim()}:value.text.trim());
    if('error' in result)return reject(value,result.error);
    ownText.current=result.text;
    update(null);
    return true;
  }
  useImperativeHandle(ref,()=>({flush:commit,clear:()=>update(null)}));
  useEffect(()=>{
    if(ownText.current===text){ownText.current=null;return;}
    update(null);
  },[text]); // External edits must not leave a draft pointing to a different entry.
  useEffect(()=>{
    if(draft)editor.current?.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea')?.focus();
  },[draft?.kind,draft?.index]);

  function begin(kind:Draft['kind'],index?:number) {
    if(busy||!commit())return;
    const source=index===undefined?undefined:song?.kallor?.[index];
    update(kind==='kallor'?{kind,index,url:source?.url??'',description:source?.beskrivning??'',error:''}:{kind,index,text:index===undefined?'':song?.anteckningar?.[index]??'',error:''});
  }
  function remove(kind:Draft['kind'],index:number) {
    if(busy)return;
    if(current.current?.kind===kind&&current.current.index===index)update(null);
    else if(!commit())return;
    const result=onApply(kind,index,undefined);
    if('error' in result) {
      begin(kind,index);
      if(current.current)reject(current.current,result.error);
    } else ownText.current=result.text;
  }
  const form=draft&&<form className="reference-editor" ref={editor} onSubmit={event=>{event.preventDefault();commit();}} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();update(null);}
  }}>
    {draft.kind==='kallor'?<>
      <label className="score-field">Webbadress<input aria-label="Källans webbadress" aria-invalid={!!draft.error} type="url" value={draft.url} placeholder="https://…" onChange={event=>update({...draft,url:event.target.value,error:''})}/></label>
      <label className="score-field">Beskrivning<textarea aria-label="Beskrivning av källan" value={draft.description} rows={3} maxLength={600} placeholder="Vad använde du källan till?" onChange={event=>update({...draft,description:event.target.value,error:''})}/></label>
    </>:<label className="score-field">Arbetsanteckning<textarea aria-label="Arbetsanteckning" aria-invalid={!!draft.error} value={draft.text} rows={4} maxLength={1400} placeholder="Arrangemang, saker att kontrollera, beslut från repetitionen…" onChange={event=>update({...draft,text:event.target.value,error:''})}/></label>}
    {draft.error&&<p role="alert" className="score-error">{draft.error}</p>}
    <div className="reference-editor-actions">
      <span className="score-hint">{draft.index===undefined?'Lägg till i låten':'Ändra i låten'}</span>
      <ScoreButton label={draft.kind==='kallor'?'Bekräfta källa':'Bekräfta arbetsanteckning'} onClick={commit}><Check/></ScoreButton>
      <ScoreButton label="Avbryt redigering av underlag" onClick={()=>update(null)}><X/></ScoreButton>
    </div>
  </form>;
  return <section className="song-references" aria-label="Källor och arbetsanteckningar">
    <button type="button" className="sources-toggle" aria-expanded={expanded} onClick={()=>{
      if(expanded&&!commit())return;
      setExpanded(!expanded);
    }}><ChevronDown size={15} className={expanded?'expanded':''}/><span>Källor & arbetsanteckningar</span><span>{song?.kallor?.length??0} källor</span></button>
    {expanded&&<div className="reference-content">
      <div className="reference-heading"><Link2 size={15}/><h3>Källor</h3><ScoreButton label="Lägg till källa" disabled={busy||(song?.kallor?.length??0)>=20} onClick={()=>begin('kallor')}><Plus/></ScoreButton></div>
      {!song?.kallor?.length&&draft?.kind!=='kallor'&&<p className="score-hint">Lägg till länkar till inspelningar eller ackordunderlag.</p>}
      {song?.kallor?.map((source,index)=>draft?.kind==='kallor'&&draft.index===index?<div key={index}>{form}</div>:<div className="reference-entry" key={index}>
        <div className="reference-copy"><a href={source.url} target="_blank" rel="noreferrer">{source.beskrivning||source.url}</a><small>{source.url}</small></div>
        <div className="reference-actions"><ScoreButton label={`Redigera källa ${index+1}`} onClick={()=>begin('kallor',index)}><Pencil/></ScoreButton><ScoreButton label={`Ta bort källa ${index+1}`} onClick={()=>remove('kallor',index)}><Trash2/></ScoreButton></div>
      </div>)}
      {draft?.kind==='kallor'&&draft.index===undefined&&form}
      <div className="reference-heading"><StickyNote size={15}/><h3>Arbetsanteckningar</h3><ScoreButton label="Lägg till arbetsanteckning" disabled={busy||(song?.anteckningar?.length??0)>=30} onClick={()=>begin('anteckningar')}><Plus/></ScoreButton></div>
      {!song?.anteckningar?.length&&draft?.kind!=='anteckningar'&&<p className="score-hint">Spara beslut om arrangemanget och frågor inför repetitionen.</p>}
      {song?.anteckningar?.map((note,index)=>draft?.kind==='anteckningar'&&draft.index===index?<div key={index}>{form}</div>:<div className="reference-entry" key={index}>
        <p className="reference-copy">{note}</p><div className="reference-actions"><ScoreButton label={`Redigera arbetsanteckning ${index+1}`} onClick={()=>begin('anteckningar',index)}><Pencil/></ScoreButton><ScoreButton label={`Ta bort arbetsanteckning ${index+1}`} onClick={()=>remove('anteckningar',index)}><Trash2/></ScoreButton></div>
      </div>)}
      {draft?.kind==='anteckningar'&&draft.index===undefined&&form}
    </div>}
  </section>;
});
