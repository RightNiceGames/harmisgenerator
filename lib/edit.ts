import { isMap, isSeq, parseDocument } from 'yaml';
import { asBar, readSong } from './song';
export function selectedBar(text: string, cursor: number): { section: number; bar: number } | undefined {
  const doc = parseDocument(text);
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
export type EditAction = 'takt' | 'del' | 'repris_start' | 'repris_slut' | 'hus1' | 'hus2' | 'hus_slut' | 'foruttag' | 'offbeat' | 'fermat' | 'break' | 'coda' | 'coda_hopp' | 'segno' | 'anvisning' | 'slut' | 'radbrytning' | 'sidbrytning' | 'nummer' | 'taktart' | 'tonart' | 'variant' | 'slag' | 'rytm';
export function insertFeature(text: string, cursor: number, action: EditAction): { text: string; cursor: number } {
  const song = readSong(text), doc = parseDocument(text);
  const selected = selectedBar(text, cursor);
  let destination: (string | number)[];
  if (action === 'del') {
    const sections = doc.get('delar', true);
    if (!isSeq(sections)) throw new Error('Låtdelar saknas.');
    sections.add(doc.createNode({ namn: 'Ny del', takter: ['C', 'C', 'F', 'G7'] }));
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
