import { remapChordHighlights } from './highlight';
import { isMap, isScalar, isSeq, isNode, type YAMLMap } from 'yaml';
import { asBar, chordStartPositions, parseChord, parseSongDocument, readSong, resolveSongMeters, type Song } from './song';
import type { Highlight, HighlightColor, HighlightOwner } from './highlight';
import { inlineLegacyForm } from './edit';

export type ScoreTarget = { section:number; bar:number; variant?:number };
type Path = (string|number)[];
type Document = ReturnType<typeof parseSongDocument>;
export const tokens = (value:string) => value.trim().split(/\s+/).filter(Boolean);
const pathOf = (t:ScoreTarget):Path => ['delar',t.section,'takter',t.bar];
function write(doc:Document) { const result=doc.toString({lineWidth:110});readSong(result);return result; }
// Reconcile values inside the original YAML nodes so nested comments follow the music.
function setValue(doc:Document,path:Path,before:unknown,next:unknown,origins?:number[]){
  if(JSON.stringify(before)===JSON.stringify(next))return;if(next===undefined||next===null){doc.deleteIn(path);return;}const node=doc.getIn(path,true);
  if(Array.isArray(before)&&Array.isArray(next)&&isSeq(node)){const old=[...node.items],used=new Set<number>();const indexes=next.map((value,i)=>{if(origins)return origins[i];if(before.length===next.length)return i;if(value&&typeof value==='object'&&'slag'in value){const at=before.findIndex((v,j)=>!used.has(j)&&v&&typeof v==='object'&&v.slag===value.slag);if(at>=0){used.add(at);return at;}return -1;}if(typeof value==='number'||typeof value==='string'){const at=before.findIndex((v,j)=>!used.has(j)&&v===value);if(at>=0){used.add(at);return at;}return -1;}return i<before.length?i:-1;});node.items=indexes.map((at,i)=>at>=0&&old[at]?old[at]:doc.createNode(next[i]));next.forEach((value,i)=>{const at=indexes[i];if(at>=0)setValue(doc,[...path,i],before[at],value);});return;}
  if(before&&next&&typeof before==='object'&&typeof next==='object'&&!Array.isArray(next)&&isMap(node)){const a=before as Record<string,unknown>,b=next as Record<string,unknown>;for(const key of new Set([...Object.keys(a),...Object.keys(b)]))setValue(doc,[...path,key],a[key],b[key]);return;}
  if(isScalar(node)&&typeof next!=='object')node.value=next;else doc.setIn(path,next);
}
function barMap(doc:Document,song:Song,t:ScoreTarget) {
  const raw=song.delar[t.section]?.takter[t.bar];if(raw===undefined)throw Error('Takten finns inte längre.');
  const path=pathOf(t),node=doc.getIn(path,true);
  if(!isMap(node)){const replacement=doc.createNode(asBar(raw));if(isScalar(node)){replacement.comment=node.comment;replacement.commentBefore=node.commentBefore;}doc.setIn(path,replacement);}
  return path;
}
function fieldsAt(song:Song,t:ScoreTarget) {const raw=song.delar[t.section]?.takter[t.bar];if(raw===undefined)throw Error('Takten finns inte längre.');const bar=asBar(raw);const fields=t.variant===undefined?bar:bar.varianter?.[t.variant];if(!fields)throw Error('Varianten finns inte längre.');return {bar,fields};}
export function patchBar(text:string,t:ScoreTarget,fields:Record<string,unknown>,variantOrigins?:number[]) {
  const song=readSong(text),current=fieldsAt(song,t).fields;if(Object.entries(fields).every(([key,value])=>JSON.stringify((current as Record<string,unknown>)[key])===JSON.stringify(value??undefined)))return text;const doc=parseSongDocument(text);let path=barMap(doc,song,t);
  if(t.variant!==undefined){fieldsAt(song,t);path=[...path,'varianter',t.variant];}
  for(const [key,value] of Object.entries(fields))setValue(doc,[...path,key],(current as Record<string,unknown>)[key],value,key==='varianter'?variantOrigins:undefined);
  return write(doc);
}
export function normalizeChordLine(value:string) {
  let group=false;const result:string[]=[];
  for(let word of tokens(value)){if(word.startsWith('(')){if(group)throw Error('Stäng den första parentesen.');group=true;word=word.slice(1);}
    const balance=[...word].reduce((n,c)=>n+(c==='('?1:c===')'?-1:0),0),closes=balance===-1&&word.endsWith(')');if(closes)word=word.slice(0,-1);
    parseChord(word);result.push(group?`(${word})`:word);if(closes){if(!group)throw Error('En avslutande parentes saknar början.');group=false;}
  }
  if(group)throw Error('Stäng parentesen.');if(result.length>4)throw Error('Högst fyra ackord på en rad.');return result.join(' ');
}
export function bounds(song:Song,t:ScoreTarget) {
  const {bar,fields}=fieldsAt(song,t),meter=resolveSongMeters(song).bars[t.section][t.bar],beats=Number(meter.split('/')[0]);
  const owner=t.variant===undefined?undefined:bar.varianter![t.variant].ackord_nr,base=chordStartPositions(bar,beats);
  return {meter,beats,denominator:Number(meter.split('/')[1]),start:owner===undefined?1:base[owner-1],end:owner===undefined?beats+1:(base[owner]??beats+1),fields};
}
export function startsFor(song:Song,t:ScoreTarget) {const b=bounds(song,t),count=tokens(b.fields.ackord).length;return b.fields.slag??(t.variant===undefined?chordStartPositions(b.fields,b.beats):Array.from({length:count},(_,i)=>b.start+Math.floor(i*(b.end-b.start)/count*4)/4));}
export class VariantChoiceError extends Error {constructor(){super('Grundackorden ändras. Behåll eller ta bort de berörda varianterna.');}}
export function setChordLine(text:string,t:ScoreTarget,value:string,choice?:'keep'|'remove') {
  const normalized=normalizeChordLine(value),song=readSong(text),doc=parseSongDocument(text),{bar,fields}=fieldsAt(song,t),before=tokens(fields.ackord),after=tokens(normalized),b=bounds(song,t),oldStarts=startsFor(song,t);
  let path=barMap(doc,song,t);if(t.variant!==undefined)path=[...path,'varianter',t.variant];
  if(normalized===fields.ackord)return text;
  const identity=(n:string|undefined)=>n?.replace(/^\((.*)\)$/, '$1');const changed=before.map((n,i)=>identity(n)!==identity(after[i]));const mapped=(old:number)=>before.length===after.length?old:(after.indexOf(before[old])>=0?after.indexOf(before[old]):old);
  if(t.variant===undefined&&bar.varianter?.some(v=>v.ackord_nr===undefined?(before.length!==after.length||changed.some(Boolean)):changed[v.ackord_nr-1])&&!choice)throw new VariantChoiceError();
  const starts=before.length===after.length?oldStarts:Array.from({length:after.length},(_,i)=>b.start+(after.length===2&&b.end-b.start>=4?i*2:Math.floor(i*(b.end-b.start)/Math.max(after.length,b.end-b.start)*4)/4));
  if(starts.some((n,i)=>n>=b.end||(i&&n<=starts[i-1])))throw Error('Ackorden ryms inte i spannet. Skriv färre ackord eller ändra slagplaceringen.');
  setValue(doc,[...path,'markeringar'],fields.markeringar,remapChordHighlights(fields.markeringar,i=>mapped(i)<after.length?mapped(i):undefined));
  setValue(doc,[...path,'ackord'],fields.ackord,normalized);setValue(doc,[...path,'slag'],fields.slag,starts.length?starts:undefined);
  if(t.variant===undefined){
    if(bar.fermat){const index=mapped(bar.fermat-1);if(index>=after.length)doc.deleteIn([...path,'fermat']);else doc.setIn([...path,'fermat'],index+1);}if(bar.synkop){const index=mapped(bar.synkop.ackord-1);if(index>=after.length)doc.deleteIn([...path,'synkop']);else setValue(doc,[...path,'synkop'],bar.synkop,{...bar.synkop,ackord:index+1});}
    if(bar.varianter){const origins:number[]=[];const next=bar.varianter.flatMap((v,vi)=>{
      if(choice==='remove'&&(v.ackord_nr===undefined||changed[v.ackord_nr-1]))return [];
      if(v.ackord_nr===undefined){origins.push(vi);return [v];}const old=v.ackord_nr-1;let owner=old;if(before.length!==after.length){const match=after.indexOf(before[old]);owner=match>=0?match:old;}
      if(owner>=after.length){if(choice==='keep')throw Error('Varianten hör till ett borttaget grundackord. Välj att ta bort varianten eller behåll grundackordet.');return [];}origins.push(vi);const delta=starts[owner]-oldStarts[old];return [{...v,ackord_nr:owner+1,...(v.slag?{slag:v.slag.map(n=>n+delta)}:{}),...(v.rytm?{rytm:v.rytm.map(n=>({...n,slag:n.slag+delta}))}:{})}];});
      if(next.length)setValue(doc,[...path,'varianter'],bar.varianter,next,origins);else doc.deleteIn([...path,'varianter']);
    }
  }
  return write(doc);
}
export function moveChord(text:string,t:ScoreTarget,index:number,start:number) {
  const song=readSong(text),values=startsFor(song,t),b=bounds(song,t);if(index<0||index>=values.length||start<b.start||start>=b.end||(index>0&&start<=values[index-1])||(values[index+1]!==undefined&&start>=values[index+1]))throw Error('Ackorden måste ligga i ordning inom spannet.');
  const delta=start-values[index];values[index]=start;const fields:Record<string,unknown>={slag:values};
  if(t.variant===undefined){const bar=asBar(song.delar[t.section].takter[t.bar]);if(bar.varianter)fields.varianter=bar.varianter.map(v=>v.ackord_nr===index+1?{...v,...(v.slag?{slag:v.slag.map(n=>n+delta)}:{}),...(v.rytm?{rytm:v.rytm.map(n=>({...n,slag:n.slag+delta}))}:{})}:v);}
  return patchBar(text,t,fields);
}
export function reorderChord(text:string,t:ScoreTarget,index:number,direction:number){
  const song=readSong(text),{bar,fields}=fieldsAt(song,t),list=tokens(fields.ackord),next=index+direction;if(next<0||next>=list.length)return text;
  [list[index],list[next]]=[list[next],list[index]];const patch:Record<string,unknown>={ackord:list.join(' '),markeringar:remapChordHighlights(fields.markeringar,i=>i===index?next:i===next?index:i)};
  if(t.variant===undefined){const map=(i:number)=>i===index?next:i===next?index:i,starts=startsFor(song,t);
    if(bar.fermat)patch.fermat=map(bar.fermat-1)+1;if(bar.synkop)patch.synkop={...bar.synkop,ackord:map(bar.synkop.ackord-1)+1};
    if(bar.varianter)patch.varianter=bar.varianter.map(v=>{if(v.ackord_nr===undefined)return v;const old=v.ackord_nr-1,owner=map(old),delta=starts[owner]-starts[old];return {...v,ackord_nr:owner+1,...(v.slag?{slag:v.slag.map(n=>n+delta)}:{}),...(v.rytm?{rytm:v.rytm.map(n=>({...n,slag:n.slag+delta}))}:{})};});
  }
  return patchBar(text,t,patch);
}
export function deleteChord(text:string,t:ScoreTarget,index:number){
  const song=readSong(text),{bar,fields}=fieldsAt(song,t),list=tokens(fields.ackord),starts=startsFor(song,t);if(index<0||index>=list.length)throw Error('Ackordet finns inte längre.');list.splice(index,1);starts.splice(index,1);const patch:Record<string,unknown>={ackord:list.join(' '),slag:starts.length?starts:undefined,markeringar:remapChordHighlights(fields.markeringar,i=>i===index?undefined:i>index?i-1:i)};
  if(t.variant===undefined){if(bar.fermat)patch.fermat=bar.fermat===index+1?undefined:bar.fermat-(bar.fermat>index+1?1:0);if(bar.synkop)patch.synkop=bar.synkop.ackord===index+1?undefined:{...bar.synkop,ackord:bar.synkop.ackord-(bar.synkop.ackord>index+1?1:0)};if(bar.varianter){const next=bar.varianter.filter(v=>v.ackord_nr!==index+1).map(v=>v.ackord_nr!==undefined&&v.ackord_nr>index+1?{...v,ackord_nr:v.ackord_nr-1}:v);patch.varianter=next.length?next:undefined;}}
  return patchBar(text,t,patch,bar.varianter?.flatMap((v,i)=>v.ackord_nr===index+1?[]:[i]));
}
export function insertChord(text:string,t:ScoreTarget,after:number|undefined,value:string,resolution=4){
  const name=normalizeChordLine(value);if(tokens(name).length!==1)throw Error('Välj ett ackord att lägga till.');const song=readSong(text),{bar,fields}=fieldsAt(song,t),list=tokens(fields.ackord),starts=startsFor(song,t),bs=bounds(song,t);if(list.length>=4)throw Error('Högst fyra ackord på en rad.');const index=after===undefined?list.length:after+1,previous=starts[index-1]??bs.start-.001,end=starts[index]??bs.end;
  const grid=Array.from({length:Math.ceil((bs.end-bs.start)*resolution/bs.denominator)},(_,i)=>bs.start+i*bs.denominator/resolution).filter(n=>n>previous&&n<end);const owned=t.variant===undefined?(bar.varianter??[]).map((v,i)=>({v,i})).filter(({v})=>v.ackord_nr===index):[];
  const available=grid.filter(n=>owned.every(({v,i})=>startsFor(song,{...t,variant:i}).every(start=>start<n)&&(v.rytm??[]).every(note=>note.slag+bs.denominator/note.notvarde<=n)));
  const start=list.length===1&&previous===1&&available.includes(3)?3:available[0];if(start===undefined)throw Error('Ingen ledig startpunkt efter ackordet på valt rutnät. Välj ett finare notvärde eller justera varianten först.');list.splice(index,0,name);starts.splice(index,0,start);const patch:Record<string,unknown>={ackord:list.join(' '),slag:starts,markeringar:remapChordHighlights(fields.markeringar,i=>i>=index?i+1:i)};
  if(t.variant===undefined){if(bar.fermat)patch.fermat=bar.fermat+(bar.fermat>index?1:0);if(bar.synkop)patch.synkop={...bar.synkop,ackord:bar.synkop.ackord+(bar.synkop.ackord>index?1:0)};if(bar.varianter)patch.varianter=bar.varianter.map((v,i)=>v.ackord_nr!==undefined?{...v,ackord_nr:v.ackord_nr+(v.ackord_nr>index?1:0),...(v.ackord_nr===index&&!v.slag?{slag:startsFor(song,{...t,variant:i})}:{})}:v);}
  return {text:patchBar(text,t,patch),chord:index,start};
}
export function addVariant(text:string,t:ScoreTarget,owner?:number) {
  const song=readSong(text),bar=asBar(song.delar[t.section].takter[t.bar]);if((bar.varianter?.length??0)>=4)throw Error('Högst fyra variantrader per takt.');
  let gang=2;while(bar.varianter?.some(v=>v.gang===gang&&v.ackord_nr===owner))gang++;
  return {text:patchBar(text,t,{varianter:[...(bar.varianter??[]),{gang,ackord:'',...(owner===undefined?{}:{ackord_nr:owner})}]}),variant:bar.varianter?.length??0};
}
export function removeVariant(text:string,t:ScoreTarget) {const song=readSong(text),bar=asBar(song.delar[t.section].takter[t.bar]),next=bar.varianter?.filter((_,i)=>i!==t.variant);return patchBar(text,{section:t.section,bar:t.bar},{varianter:next?.length?next:undefined},bar.varianter?.flatMap((_,i)=>i===t.variant?[]:[i]));}
export function setVariantScope(text:string,t:ScoreTarget,owner:number|undefined) {
  const song=readSong(text),{bar}=fieldsAt(song,t);
  if(t.variant===undefined)throw Error('Välj en variantrad.');
  const variant=bar.varianter![t.variant];
  if(variant.ackord_nr===owner)return text;
  if(owner!==undefined&&(!Number.isInteger(owner)||owner<1||owner>tokens(bar.ackord).length))throw Error('Välj ett grundackord som finns i takten.');
  // Expanding a chord variant keeps its actual timing rather than spreading it across the bar.
  const starts=startsFor(song,t),timing=owner===undefined?{slag:starts.length?starts:undefined}:{};
  try {return patchBar(text,t,{ackord_nr:owner,...timing});}
  catch(e) {
    if(e instanceof Error&&/spann|grundackordets/.test(e.message))throw Error('Variantens ackord eller rytm ryms inte inom valt ackord. Justera startpunkterna och rytmen, eller välj hela takten.');
    throw e;
  }
}
export function barCursor(text:string,t:ScoreTarget) {const node=parseSongDocument(text).getIn(pathOf(t),true);return node&&typeof node==='object'&&'range'in node?(node as {range?:number[]}).range?.[0]??0:0;}
function barSequence(doc:Document,section:number){const node=doc.getIn(['delar',section,'takter'],true);if(!isSeq(node))throw Error('Välj en skriven del.');return node;}
function cloneNode(node:unknown){if(!isNode(node))throw Error('Delen kan inte kopieras.');return node.clone();}
function sections(doc:Document){const node=doc.get('delar',true);if(!isSeq(node))throw Error('Låtdelar saknas.');return node;}
export function insertBar(text:string,section:number,after:number){const song=readSong(text),doc=parseSongDocument(text),seq=barSequence(doc,section);if(!song.delar[section]||after<0||after>=seq.items.length)throw Error('Välj en befintlig takt.');seq.items.splice(after+1,0,doc.createNode(''));return write(doc);}
export function duplicateBars(text:string,section:number,indices:number[]){readSong(text);const doc=parseSongDocument(text),seq=barSequence(doc,section),sorted=[...new Set(indices)].sort((a,b)=>a-b);const copies=sorted.map(i=>{const node=seq.items[i];if(!node)throw Error('Takten finns inte längre.');if(!isNode(node))throw Error('Takten kan inte kopieras.');const copy=node.clone();if(isMap(copy))for(const k of ['repris_start','repris_slut','hus','hus_slut','radbrytning','sidbrytning'])copy.delete(k);return copy;});seq.items.splice(sorted.at(-1)!+1,0,...copies);return write(doc);}
export function deleteBars(text:string,section:number,indices:number[]) {
  const song=readSong(text),doc=parseSongDocument(text),seq=barSequence(doc,section),removed=new Set(indices),all=song.delar.flatMap((s,si)=>s.takter.map((raw,bi)=>({si,bi,raw}))),meters=resolveSongMeters(song).bars;
  const spans=houseSpans(song,section);
  for(const i of [...removed].sort((a,b)=>b-a)){const index=all.findIndex(v=>v.si===section&&v.bi===i),source=asBar(song.delar[section].takter[i]);const next=all.slice(index+1).find(v=>v.si!==section||!removed.has(v.bi))??all.slice(0,index).reverse().find(v=>v.si!==section||!removed.has(v.bi));
    if(next){const target={section:next.si,bar:next.bi},p=barMap(doc,song,target);for(const k of ['repris_start','repris_slut'] as const)if(source[k])doc.setIn([...p,k],true);if(source.taktart&&!asBar(next.raw).taktart)doc.setIn([...p,'taktart'],meters[next.si][next.bi]);if(source.tonart&&!asBar(next.raw).tonart)doc.setIn([...p,'tonart'],source.tonart);if(source.hus&&!spans.some(v=>v.start===i))doc.setIn([...p,'hus'],source.hus);if(source.hus_slut&&!spans.some(v=>v.end===i))doc.setIn([...p,'hus_slut'],true);}
  }
  for(const span of spans){doc.deleteIn(['delar',section,'takter',span.start,'hus']);if(span.closed)doc.deleteIn(['delar',section,'takter',span.end,'hus_slut']);const remaining=Array.from({length:span.end-span.start+1},(_,i)=>span.start+i).filter(i=>!removed.has(i));if(remaining.length){const first=barMap(doc,song,{section,bar:remaining[0]});doc.setIn([...first,'hus'],span.number);if(span.closed){const last=barMap(doc,song,{section,bar:remaining.at(-1)!});doc.setIn([...last,'hus_slut'],true);}}}
  for(const i of [...removed].sort((a,b)=>b-a)){if(i<0||i>=seq.items.length)throw Error('Takten finns inte längre.');seq.items.splice(i,1);}if(!seq.items.length)seq.items.push(doc.createNode(''));return write(doc);
}
export function patchBars(text:string,section:number,indices:number[],fields:Record<string,unknown>){let result=text;for(const bar of indices)result=patchBar(result,{section,bar},fields);return result;}
export function houseSpans(song:Song,section:number){const spans:{start:number;end:number;number:string;closed:boolean}[]=[];let start=-1,number='';song.delar[section].takter.forEach((raw,i)=>{const bar=asBar(raw);if(bar.hus){if(start>=0)spans.push({start,end:i-1,number,closed:false});start=i;number=bar.hus;}if(bar.hus_slut&&start>=0){spans.push({start,end:i,number,closed:true});start=-1;}});if(start>=0)spans.push({start,end:song.delar[section].takter.length-1,number,closed:false});return spans;}
export function clearHouse(text:string,section:number,indices:number[]){const song=readSong(text),doc=parseSongDocument(text);for(const span of houseSpans(song,section).filter(v=>indices.some(n=>n>=v.start&&n<=v.end))){doc.deleteIn(['delar',section,'takter',span.start,'hus']);if(span.closed)doc.deleteIn(['delar',section,'takter',span.end,'hus_slut']);}return write(doc);}
export function setHouse(text:string,section:number,indices:number[],number:string) {
  if(!/^\d+(?:\s*,\s*\d+)*\.?$/.test(number))throw Error('Ange ett husnummer, till exempel 1 eller 1, 2.');const sorted=[...new Set(indices)].sort((a,b)=>a-b);if(sorted.some((n,i)=>i>0&&n!==sorted[i-1]+1))throw Error('Markera sammanhängande takter för ett hus.');
  let result=clearHouse(text,section,sorted);result=patchBar(result,{section,bar:sorted[0]},{hus:number.endsWith('.')?number:number+'.'});return patchBar(result,{section,bar:sorted.at(-1)!},{hus_slut:true});
}
export function patchSong(text:string,fields:Record<string,unknown>){const song=readSong(text);if(fields.titel==='')throw Error('Ge låten en titel.');const normalized=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value===''&&key!=='artist'?undefined:value]));if(Object.entries(normalized).every(([key,value])=>JSON.stringify((song as Record<string,unknown>)[key])===JSON.stringify(value)))return text;const doc=parseSongDocument(text);for(const [key,value] of Object.entries(normalized))if(value===undefined)doc.delete(key);else doc.set(key,value);return write(doc);}
export function patchSongEntry(text:string,field:'kallor'|'anteckningar',index:number|undefined,value:NonNullable<Song['kallor']>[number]|string|undefined) {
  const song=readSong(text),before=song[field]??[],next:unknown[]=[...before],origins=before.map((_,i)=>i);
  if(index===undefined) {
    if(value===undefined)throw Error('Ange en källa eller arbetsanteckning.');
    next.push(value);origins.push(-1);
  } else {
    if(!Number.isInteger(index)||index<0||index>=before.length)throw Error('Källan eller arbetsanteckningen finns inte längre.');
    if(value===undefined) {next.splice(index,1);origins.splice(index,1);}
    else next[index]=value;
  }
  if(JSON.stringify(before)===JSON.stringify(next))return text;
  const doc=parseSongDocument(text);
  setValue(doc,[field],before,next.length?next:undefined,origins);
  return write(doc);
}
export function patchSection(text:string,section:number,fields:Record<string,unknown>){const song=readSong(text);if(!song.delar[section])throw Error('Delen finns inte längre.');const doc=parseSongDocument(text);for(const [k,v]of Object.entries(fields))if(v===undefined||v==='')doc.deleteIn(['delar',section,k]);else doc.setIn(['delar',section,k],v);return write(doc);}
function pinMeters(doc:Document,song:Song){const meters=resolveSongMeters(song).bars;song.delar.forEach((s,si)=>{if(s.ateranvand||!s.takter.length||asBar(s.takter[0]).taktart)return;const p=barMap(doc,song,{section:si,bar:0});doc.setIn([...p,'taktart'],meters[si][0]);});}
function canonicalSection(text:string,index:number){const original=readSong(text),converted=inlineLegacyForm(text),song=readSong(converted);if(!original.spelordning)return {converted,song,index};const part=original.delar[index],resolved=part?song.delar.findIndex(p=>!p.ateranvand&&p.namn===part.namn):index;if(resolved<0)throw Error('Delen finns inte i spelordningen.');return {converted,song,index:resolved};}
export function moveSection(text:string,index:number,delta:number){const normalized=canonicalSection(text,index);index=normalized.index;const {converted,song}=normalized,doc=parseSongDocument(converted),seq=sections(doc),next=index+delta;if(next<0||next>=seq.items.length)return converted;pinMeters(doc,song);const [item]=seq.items.splice(index,1);seq.items.splice(next,0,item);return write(doc);}
export function reuseSection(text:string,source:number){const normalized=canonicalSection(text,source);source=normalized.index;const {converted,song}=normalized,part=song.delar[source];if(!part||part.ateranvand)throw Error('Välj en skriven del att återanvända.');const doc=parseSongDocument(converted);pinMeters(doc,song);sections(doc).items.push(doc.createNode({ateranvand:part.namn,ganger:1}));return write(doc);}
export function removeSection(text:string,index:number){const normalized=canonicalSection(text,index);index=normalized.index;const {converted,song}=normalized,doc=parseSongDocument(converted),seq=sections(doc),part=song.delar[index];if(!part)throw Error('Delen finns inte längre.');pinMeters(doc,song);seq.items=seq.items.filter((_,i)=>i!==index&&(part.ateranvand||song.delar[i].ateranvand!==part.namn));return write(doc);}
export function copySection(text:string,index:number,empty=false,detach=false){const normalized=canonicalSection(text,index);index=normalized.index;const {converted,song}=normalized,part=song.delar[index];if(empty&&!song.delar.length){const doc=parseSongDocument(converted);sections(doc).items.push(doc.createNode({namn:'Ny del',takter:['','','','']}));return write(doc);}if(!part)throw Error('Delen finns inte längre.');const source=part.ateranvand?song.delar.findIndex(s=>!s.ateranvand&&s.namn===part.ateranvand):index,doc=parseSongDocument(converted),seq=sections(doc);pinMeters(doc,song);
  let name=empty?'Ny del':song.delar[source].namn+' · kopia',n=2;const base=name;while(song.delar.some(s=>s.namn===name))name=base+' '+n++;
  const node=empty?doc.createNode({namn:name,takter:['','','','']}):cloneNode(seq.items[source]);if(!isMap(node))throw Error('Delen kan inte kopieras.');const map=node as YAMLMap;map.set('namn',name);if(detach){map.set('ganger',part.ganger);if(part.anvisning)map.set('anvisning',part.anvisning);seq.items.splice(index,1,node);}else seq.items.splice(index+1,0,node);return write(doc);
}

export function patchFormInstruction(text:string,index:number,value:string){
  const song=readSong(text),step=song.spelordning?.[index];
  if(!step)throw Error('Återkomsten finns inte längre.');
  const instruction=value.trim()||undefined;if(step.anvisning===instruction)return text;
  const doc=parseSongDocument(text);setValue(doc,['spelordning',index,'anvisning'],step.anvisning,instruction);return write(doc);
}

export function setHighlight(text:string,owner:HighlightOwner,element:string,color:HighlightColor|null,range?:{fran:number;till:number}) {
  const song=readSong(text),doc=parseSongDocument(text);
  let path:Path=[];
  if(owner.formStep!==undefined){if(!song.spelordning?.[owner.formStep])throw Error('Återkomsten finns inte längre.');path=['spelordning',owner.formStep];}
  else if(owner.section!==undefined){
    if(!song.delar[owner.section])throw Error('Delen finns inte längre.');path=['delar',owner.section];
    if(owner.bar!==undefined){path=barMap(doc,song,{section:owner.section,bar:owner.bar});if(owner.variant!==undefined){fieldsAt(song,{section:owner.section,bar:owner.bar,variant:owner.variant});path.push('varianter',owner.variant);}}
  }
  const node=doc.getIn([...path,'markeringar']) as {toJSON?:()=>Highlight[]}|undefined;
  const before:Highlight[]=node?.toJSON?.()??[];
  const next=before.flatMap(mark=>{
    if(mark.element!==element)return [mark];
    if(!color||!range||mark.fran===undefined||mark.till===undefined)return [];
    if(mark.till<=range.fran||mark.fran>=range.till)return [mark];
    return [...(mark.fran<range.fran?[{...mark,till:range.fran}]:[]),...(mark.till>range.till?[{...mark,fran:range.till}]:[])];
  });
  if(color)next.push({element,farg:color,...range});
  setValue(doc,[...path,'markeringar'],before,next.length?next:undefined);
  return write(doc);
}
