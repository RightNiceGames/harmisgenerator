import { isMap, isSeq, isScalar, parseDocument, visit } from 'yaml';
import { asBar, readSong, parseSongDocument, parseChord } from './song';
export function selectedBar(text: string, cursor: number): { section: number; bar: number } | undefined {
  const doc = parseSongDocument(text);
  const sections = doc.get('delar', true);
  if (!isSeq(sections)) return;
  const active = selectedSection(text,cursor);
  let nearest: { section: number; bar: number } | undefined;
  sections.items.forEach((section, si) => {
    if (!isMap(section) || si !== active) return;
    const bars = section.get('takter', true);
    if (!isSeq(bars)) return;
    bars.items.forEach((bar, bi) => {
      const range = bar && typeof bar === 'object' && 'range' in bar ? (bar as { range?: number[] }).range : undefined;
      if (range && range[0] <= cursor) nearest = { section: si, bar: bi };
    });
  });
  return nearest;
}
export type EditAction = 'takt' | 'del' | 'repris_start' | 'repris_slut' | 'hus1' | 'hus2' | 'hus_slut' | 'foruttag' | 'offbeat' | 'fermat' | 'break' | 'coda' | 'coda_hopp' | 'segno' | 'anvisning' | 'slut' | 'radbrytning' | 'sidbrytning' | 'nummer' | 'taktart' | 'tonart' | 'variant' | 'slag' | 'rytm' | 'nc' | 'repeat_bar';
export function insertFeature(text: string, cursor: number, action: EditAction): { text: string; cursor: number } {
  const song = readSong(text), doc = parseSongDocument(text);
  const selected = selectedBar(text, cursor);
  let destination: (string | number)[];
  if (action === 'del') {
    const sections = doc.get('delar', true);
    if (!isSeq(sections)) throw new Error('Låtdelar saknas.');
    let name = 'Ny del';
    for (let i=2; song.delar.some(part=>part.namn===name); i++) name = `Ny del ${i}`;
    const after = song.spelordning ? song.delar.length-1 : (selectedSection(text,cursor) ?? song.delar.length-1);
    sections.items.splice(after+1,0,doc.createNode({ namn: name, takter: ['C', 'C', 'F', 'G7'] }));
    if (song.spelordning) doc.set('spelordning', [...song.spelordning, {del:name,ganger:1}]);
    destination = ['delar', after+1, 'namn'];
  } else {
    if (!selected) throw new Error('Placera markören i den takt du vill ändra.');
    const { section, bar } = selected;
    let meter = song.taktart;
    const endMeters=new Map<string,string>();
    song.delar.slice(0,section+1).forEach((part,si)=>{
      if(part.ateranvand){meter=endMeters.get(part.ateranvand)??meter;return;}
      part.takter.forEach((raw,bi)=>{if(si<section||bi<=bar)meter=asBar(raw).taktart??meter;});
      endMeters.set(part.namn,meter);
    });
    const [beats, denominator] = meter.split('/').map(Number);
    const base = ['delar', section, 'takter'];
    destination = [...base, bar];
    if (action === 'takt') {
      const seq = doc.getIn(base, true);
      if (!isSeq(seq)) throw new Error('Takter saknas.');
      seq.items.splice(bar+1, 0, doc.createNode('C')); destination = [...base, bar+1];
    } else {
      const data = { ...asBar(song.delar[section].takter[bar]) };
      const values: Record<string, Record<string, unknown>> = {
        nc: { ackord: 'N.C.' }, repeat_bar: { ackord: '%' },
        slag: { slag: data.slag ?? data.ackord.trim().split(/\s+/).map((_, i, chords) => 1 + Math.floor(i * (beats / chords.length) * 4) / 4) },
        rytm: { rytm: data.rytm ?? [0, 1, 3].map(offset => ({ slag: 1 + offset * denominator / 8, notvarde: 8 })).filter(note => note.slag + denominator / 8 <= beats + 1) },
        variant: { varianter: [...(data.varianter ?? []), { gang: Math.max(1, ...(data.varianter ?? []).map(v => v.gang)) + 1, ackord: data.ackord, ...(data.slag ? { slag: data.slag } : {}) }] },
        hus1: { hus: '1.' }, hus2: { hus: '2.' },
        foruttag: { synkop: { typ: 'foruttag', ackord: 1 } },
        offbeat: { synkop: { typ: 'offbeat', ackord: Math.min(2, data.ackord.trim().split(/\s+/).length) } },
        fermat: { fermat: 1 }, coda: { coda: 'mal' }, coda_hopp: { coda: 'hopp' },
        anvisning: { anvisning: 'walking' }, nummer: { nummer: 1 },
        taktart: { taktart: '3/4' }, tonart: { tonart: song.grundtonart },
      };
      const fields = values[action] ?? { [action]: true };
      if (action === 'rytm' && data.synkop) throw new Error('Ta bort synkop-raden innan du infogar en egen rytm.');
      if ((action === 'foruttag' || action === 'offbeat') && data.rytm) throw new Error('Ta bort rytm-raderna innan du infogar en synkop.');
      let node = doc.getIn(destination, true);
      if (!isMap(node)) { const old = node; const replacement = doc.createNode(data); if (old && typeof old === 'object' && 'comment' in old) replacement.comment = old.comment as string; doc.setIn(destination, replacement); }
      if (action === 'nc' || action === 'repeat_bar') {
        for (const key of ['slag','synkop','fermat','rytm','varianter']) doc.deleteIn([...destination,key]);
      }
      for (const [key, value] of Object.entries(fields)) doc.setIn([...destination, key], value);
      destination = [...destination, Object.keys(fields)[0]];
    }
  }
  const result = doc.toString({ lineWidth: 110 });
  readSong(result);
  const updated = parseDocument(result).getIn(destination, true);
  const range = updated && typeof updated === 'object' && 'range' in updated ? (updated as { range?: number[] }).range : undefined;
  return { text: result, cursor: range?.[0] ?? cursor };
}

export function appendFormStep(text: string, part: string, times: number, instruction = '') {
  const song = readSong(text), doc = parseSongDocument(text);
  const steps = song.spelordning ?? song.delar.map(section=>({del:section.namn,ganger:1}));
  doc.set('spelordning', [...steps, {del:part,ganger:times,visa_block:true,...(instruction.trim() ? {anvisning:instruction.trim()} : {})}]);
  const result = doc.toString({lineWidth:110});
  readSong(result);
  return result;
}

export type ChordTarget = { section: number; bar: number; chord: number; variant?: number };
export function replaceExistingChord(text: string, target: ChordTarget, replacement: string) {
  const song = readSong(text), doc = parseSongDocument(text);
  const indexes = [target.section, target.bar, target.chord, ...(target.variant === undefined ? [] : [target.variant])];
  if (indexes.some(i=>!Number.isInteger(i)||i<0)) throw new Error('Ogiltig ackordposition.');
  const raw = song.delar[target.section]?.takter[target.bar];
  if (raw === undefined) throw new Error('Takten finns inte längre.');
  const bar = asBar(raw);
  const path: (string|number)[] = ['delar',target.section,'takter',target.bar];
  let value = bar.ackord;
  if (target.variant !== undefined) {
    const variant = bar.varianter?.[target.variant];
    if (!variant) throw new Error('Varianten finns inte längre.');
    value = variant.ackord; path.push('varianter',target.variant,'ackord');
  } else if (typeof raw !== 'string') path.push('ackord');
  const tokens = [...value.matchAll(/\S+/g)];
  const token = tokens[target.chord];
  if (!token) throw new Error('Ackordet finns inte längre.');
  const next = replacement.trim();
  if (!next || /\s/.test(next)) throw new Error('Ange ett enda ackord, till exempel Bb7, C/G, N.C. eller %.');
  parseChord(next);
  const node = doc.getIn(path,true);
  if (!isScalar(node)) throw new Error('Ackordfältet kan inte redigeras.');
  node.value = value.slice(0,token.index) + next + value.slice(token.index!+token[0].length);
  const result = doc.toString({lineWidth:110});
  readSong(result);
  return result;
}

export function renameSection(text: string, index: number, name: string) {
  const song = readSong(text), doc = parseSongDocument(text);
  if (!Number.isInteger(index) || index < 0 || !song.delar[index]) throw new Error('Låtdelen finns inte längre.');
  const next = name.trim();
  if (!next || next.length > 80 || /[\r\n]/.test(next)) throw new Error('Ange ett delnamn på 1–80 tecken, på en rad.');
  if (song.delar.some((part,i)=>i!==index && part.namn===next)) throw new Error('En annan låtdel har redan det namnet.');
  const previous = song.delar[index].namn;
  if (song.delar[index].ateranvand) throw new Error('Byt namn på den ursprungliga delen.');
  const change = (path:(string|number)[]) => { const node = doc.getIn(path,true); if(isScalar(node))node.value=next; };
  change(['delar',index,'namn']);
  song.delar.forEach((part,i)=>{if(part.ateranvand===previous)change(['delar',i,'ateranvand']);});
  song.spelordning?.forEach((step,i)=>{if(step.del===previous)change(['spelordning',i,'del']);});
  const result=doc.toString({lineWidth:110});readSong(result);return result;
}

export function selectedSection(text: string, cursor: number): number | undefined {
  const sections = parseSongDocument(text).get('delar',true);
  if (!isSeq(sections)) return;
  const index=sections.items.findIndex(part=>isMap(part) && !!part.range && cursor>=part.range[0] && cursor<=part.range[2]);
  return index<0 ? undefined : index;
}

// Keep old files readable, but convert their form into the actual sequence of parts before editing it.
export function inlineLegacyForm(text: string) {
  const song=readSong(text);
  if (!song.spelordning) return text;
  const doc=parseSongDocument(text), parts=doc.get('delar',true);
  if (!isSeq(parts)) throw new Error('Låtdelar saknas.');
  const seen=new Set<string>();
  const sequence: typeof parts.items=[];
  for(const step of song.spelordning) {
    if (!seen.has(step.del)) {
      const index=song.delar.findIndex(part=>part.namn===step.del);
      const node=parts.items[index];
      sequence.push(node);
      seen.add(step.del);
      if(step.anvisning && isMap(node))node.set('anvisning',[song.delar[index].anvisning,step.anvisning].filter(Boolean).join(' · '));
      if(step.ganger>1)sequence.push(doc.createNode({ateranvand:step.del,ganger:step.ganger-1}));
    } else sequence.push(doc.createNode({ateranvand:step.del,...(step.ganger>1?{ganger:step.ganger}:{}),...(step.anvisning?{anvisning:step.anvisning}:{})}));
  }
  const comments: string[]=[];
  const collect=(_key:unknown,node:unknown)=>{
    if(node && typeof node==='object')for(const field of ['commentBefore','comment'] as const){
      const value=(node as {commentBefore?:string;comment?:string})[field];if(value)comments.push(value);
    }
  };
  if(isMap(doc.contents)) {
    const pair=doc.contents.items.find(pair=>isScalar(pair.key)&&pair.key.value==='spelordning');
    if(pair){collect(null,pair.key);visit(pair.value,collect);}
  }
  if(comments.length)doc.comment=[doc.comment,...comments].filter(Boolean).join('\n');
  parts.items=sequence;doc.delete('spelordning');
  const result=doc.toString({lineWidth:110});readSong(result);return result;
}

export function insertReuse(text: string, part: string, times: number, instruction = '', after?: number) {
  const converted=inlineLegacyForm(text), song=readSong(converted),doc=parseSongDocument(converted);
  const index=after ?? song.delar.length-1;
  if (!Number.isInteger(index)||index<0||index>=song.delar.length) throw new Error('Välj en befintlig del att infoga efter.');
  if (!song.delar.slice(0,index+1).some(section=>!section.ateranvand&&section.namn===part)) throw new Error('Välj en del som redan är utskriven före denna plats.');
  const parts=doc.get('delar',true);if(!isSeq(parts))throw new Error('Låtdelar saknas.');
  parts.items.splice(index+1,0,doc.createNode({ateranvand:part,...(times!==1?{ganger:times}:{}),...(instruction.trim()?{anvisning:instruction.trim()}: {})}));
  const result=doc.toString({lineWidth:110});readSong(result);return result;
}
