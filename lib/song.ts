import { z } from 'zod';
import { isScalar, LineCounter, parseDocument } from 'yaml';

const notePattern = /^[A-G](?:#|b|♯|♭)?$/;
const keyPattern = /^[A-G](?:#|b|♯|♭)?(?:m)?$/;
const shortText = z.string().max(180);
const beatSchema = z.number().min(1).max(64).multipleOf(0.25);
const startsSchema = z.array(beatSchema).min(1).max(4);
const rhythmSchema = z.array(z.strictObject({
  slag: beatSchema,
  notvarde: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)]).default(8),
})).min(1).max(32);
const variantSchema = z.strictObject({
  gang: z.number().int().min(2).max(16),
  ackord: z.string().min(1).max(180),
  stamma: z.string().min(1).max(30).optional(),
  slag: startsSchema.optional(),
});
export type RhythmNote = z.infer<typeof rhythmSchema>[number];

export const barSchema = z.strictObject({
  ackord: z.string().min(1).max(180),
  slag: startsSchema.optional(),
  rytm: rhythmSchema.optional(),
  varianter: z.array(variantSchema).min(1).max(4).optional(),
  nummer: z.number().int().positive().optional(),
  kolumn: z.number().int().min(0).max(3).optional(),
  radbrytning: z.boolean().optional(), sidbrytning: z.boolean().optional(),
  repris_start: z.boolean().optional(), repris_slut: z.boolean().optional(),
  hus: z.string().max(12).optional(), hus_slut: z.boolean().optional(),
  synkop: z.strictObject({ typ: z.enum(['foruttag', 'offbeat']), ackord: z.number().int().min(1).max(4).default(1) }).optional(),
  fermat: z.number().int().min(1).max(4).optional(),
  break: z.boolean().optional(), coda: z.enum(['mal', 'hopp']).optional(), segno: z.boolean().optional(),
  slut: z.boolean().optional(), anvisning: shortText.optional(),
  tonart: z.string().regex(keyPattern, 'Ange tonart som C, Bb eller F#m.').optional(),
  taktart: z.string().regex(/^[1-9]\d?\/(?:1|2|4|8|16)$/).optional(),
});
export type Bar = z.infer<typeof barSchema>;
const sectionSchema = z.strictObject({
  namn: z.string().min(1).max(80), anvisning: shortText.optional(),
  skuggad: z.boolean().optional(), sidbrytning: z.boolean().optional(),
  takter: z.array(z.union([z.string().min(1).max(180), barSchema])).min(1).max(300),
});
export const songSchema = z.strictObject({
  format: z.literal(1), titel: z.string().min(1).max(120), artist: shortText,
  version: shortText.optional(), upphov: shortText.optional(),
  grundtonart: z.string().regex(keyPattern, 'Ange tonart som C, Bb eller F#m.'),
  taktart: z.string().regex(/^[1-9]\d?\/(?:1|2|4|8|16)$/),
  tempo: z.number().min(20).max(300).optional(), stil: z.string().max(80).optional(),
  status: z.enum(['utkast', 'granskad']).default('utkast'),
  kallor: z.array(z.strictObject({ url: z.string().url(), beskrivning: z.string().max(600) })).max(20).optional(),
  anteckningar: z.array(z.string().max(1400)).max(30).optional(),
  delar: z.array(sectionSchema).min(1).max(60),
}).superRefine((song, ctx) => {
  let count = 0;
  let meter = song.taktart;
  song.delar.forEach((section, si) => section.takter.forEach((raw, bi) => {
    count++;
    const bar = asBar(raw);
    meter = bar.taktart ?? meter;
    const [beats, denominator] = meter.split('/').map(Number);
    const path = ['delar', si, 'takter', bi];
    const error = (field: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path: [...path, ...field], message });
    const validateChords = (value: string, starts: number[] | undefined, field: (string | number)[]) => {
      const chords = value.trim().split(/\s+/);
      if (chords.length > 4) error(field, 'Högst fyra ackord per takt.');
      for (const chord of chords) {
        try { parseChord(chord); } catch { error(field, `Okänt ackord: ${chord}. Använd t.ex. Bbmaj7, F6/9, C/G, N.C. eller %.`); }
      }
      if (starts) {
        if (starts.length !== chords.length) error(field, 'Ange ett slag för varje ackord.');
        if (starts[0] !== 1) error(field, 'Första ackordet ska börja på slag 1.');
        if (starts.some((beat, i) => beat >= beats + 1 || (i > 0 && beat <= starts[i - 1]))) error(field, `Ackordslagen ska ligga i stigande ordning inom ${meter}.`);
      }
      return chords;
    };
    const chords = validateChords(bar.ackord, bar.slag, []);
    if (bar.fermat && bar.fermat > chords.length) error(['fermat'], 'Fermatens ackordnummer finns inte i takten.');
    if (bar.synkop && bar.synkop.ackord > chords.length) error(['synkop'], 'Synkopens ackordnummer finns inte i takten.');
    if (bar.rytm && bar.synkop) error(['rytm'], 'Välj egen rytm eller synkop i samma takt.');
    bar.rytm?.forEach((note, i, notes) => {
      const end = note.slag + denominator / note.notvarde;
      if (end > beats + 1) error(['rytm', i], `Noten går utanför takten i ${meter}.`);
      if (i > 0 && note.slag < notes[i - 1].slag + denominator / notes[i - 1].notvarde) error(['rytm', i], 'Rytmens noter ska ligga i tidsordning utan överlapp.');
    });
    const seen = new Set<string>();
    bar.varianter?.forEach((variant, i) => {
      validateChords(variant.ackord, variant.slag, ['varianter', i]);
      const identity = `${variant.gang}:${variant.stamma ?? ''}`;
      if (seen.has(identity)) error(['varianter', i], 'Samma omgång och stämma får bara ha en variant per takt.');
      seen.add(identity);
    });
  }));
  if (count > 500) ctx.addIssue({ code: 'custom', path: ['delar'], message: 'Högst 500 skrivna takter per låt.' });
});
export type Song = z.infer<typeof songSchema>;
export type Section = Song['delar'][number];
export function asBar(raw: string | Bar): Bar { return typeof raw === 'string' ? { ackord: raw } : raw; }
export function ascii(value: string) { return value.replaceAll('♭', 'b').replaceAll('♯', '#'); }
export function pretty(value: string) { return value.replaceAll('b', '♭').replaceAll('#', '♯'); }
export type Chord = { root: string; extension: string; bass?: string; special?: boolean };
export function parseChord(value: string): Chord {
  if (['N.C.', '%', '-'].includes(value)) return { root: value, extension: '', special: true };
  const match = ascii(value).match(/^([A-G][b#]?)(.*?)(?:\/([A-G][b#]?))?$/);
  if (!match || !/^(?:(?:maj|Maj|M|m|min|dim|aug|sus|add|alt|omit|no)|[0-9b#()+°ø/\-])*$/u.test(match[2])) throw new Error(`Ogiltigt ackord: ${value}`);
  return { root: match[1], extension: match[2], bass: match[3] };
}
export function pitch(note: string) {
  const value = ascii(note);
  if (!notePattern.test(value)) throw new Error(`Ogiltig ton: ${note}`);
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (base[value[0]] + (value[1] === '#' ? 1 : value[1] === 'b' ? -1 : 0) + 12) % 12;
}
const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function transposeChord(chord: string, semitones: number, spelling: 'b' | '#') {
  const parsed = parseChord(chord);
  if (parsed.special) return chord;
  const names = spelling === 'b' ? flats : sharps;
  const shift = (n: string) => names[((pitch(n) + semitones) % 12 + 12) % 12];
  return shift(parsed.root) + parsed.extension + (parsed.bass ? '/' + shift(parsed.bass) : '');
}
export class SongError extends Error {
  constructor(message: string, public line = 1) { super(message); }
}
export function readSong(text: string): Song {
  if (text.length > 200_000) throw new SongError('Låtfilen är för stor. Högst 200 kB.');
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, uniqueKeys: true });
  if (doc.errors.length) {
    const error = doc.errors[0];
    throw new SongError(error.message.split('\n')[0], error.linePos?.[0].line ?? 1);
  }
  let value: unknown;
  try { value = doc.toJS({ maxAliasCount: 0 }); }
  catch { throw new SongError('YAML-alias stöds inte. Skriv ut takterna i filen.'); }
  const result = songSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    let path = [...issue.path];
    let node = doc.getIn(path, true);
    while (!node && path.length) { path = path.slice(0, -1); node = doc.getIn(path, true); }
    const offset = node && typeof node === 'object' && 'range' in node ? (node as { range?: number[] }).range?.[0] : 0;
    throw new SongError(`${issue.path.join('.') || 'Låtfil'}: ${issue.message}`, lineCounter.linePos(offset ?? 0).line);
  }
  return result.data;
}

// Edit only musical scalar values in the YAML tree, preserving comments and source notes.
export function transposeText(text: string, target: string, spelling: 'b' | '#') {
  const song = readSong(text);
  if (!keyPattern.test(target)) throw new SongError('Ogiltig måltonart.');
  if (target.endsWith('m') !== song.grundtonart.endsWith('m')) throw new SongError('Transponering bevarar dur eller moll.');
  const distance = pitch(target.replace(/m$/, '')) - pitch(song.grundtonart.replace(/m$/, ''));
  const doc = parseDocument(text);
  const change = (path: (string | number)[], value: string) => {
    const node = doc.getIn(path, true);
    if (isScalar(node)) node.value = value; else doc.setIn(path, value);
  };
  change(['grundtonart'], target);
  song.delar.forEach((section, si) => section.takter.forEach((raw, bi) => {
    const path = ['delar', si, 'takter', bi];
    const bar = asBar(raw);
    change(typeof raw === 'string' ? path : [...path, 'ackord'], bar.ackord.replace(/\S+/g, chord => transposeChord(chord, distance, spelling)));
    if (bar.tonart) change([...path, 'tonart'], transposeChord(bar.tonart, distance, spelling));
    bar.varianter?.forEach((variant, i) => {
      change([...path, 'varianter', i, 'ackord'], variant.ackord.replace(/\S+/g, chord => transposeChord(chord, distance, spelling)));
    });
  }));
  const result = doc.toString({ lineWidth: 110 });
  readSong(result);
  return result;
}
