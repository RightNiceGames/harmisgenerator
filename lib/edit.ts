import { isMap, isSeq, isScalar, parseDocument } from 'yaml';
import { asBar, readSong, parseSongDocument, parseChord } from './song';
export function selectedBar(text: string, cursor: number): { section: number; bar: number } | undefined {
  const doc = parseSongDocument(text);
  const sections = doc.get('delar', true);
  if (!isSeq(sections)) return;
  let nearest: { section: number; bar: number } | undefined;
  sections.items.forEach((section, si) => {
    if (!isMap(section)) return;
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
    sections.add(doc.createNode({ namn: name, takter: ['C', 'C', 'F', 'G7'] }));
    if (song.spelordning) doc.set('spelordning', [...song.spelordning, {del:name,ganger:1}]);
    destination = ['delar', song.delar.length, 'namn'];
  } else {
    if (!selected) throw new Error('Placera markören i den takt du vill ändra.');
    const { section, bar } = selected;
    let meter = song.taktart;
    song.delar.forEach((part, si) => part.takter.forEach((raw, bi) => {
      if (si < section || (si === section && bi <= bar)) meter = asBar(raw).taktart ?? meter;
    }));
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

export function appendFormStep(text: string, part: string, times: number) {
  const song = readSong(text), doc = parseSongDocument(text);
  const steps = song.spelordning ?? song.delar.map(section=>({del:section.namn,ganger:1}));
  doc.set('spelordning', [...steps, {del:part,ganger:times}]);
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
