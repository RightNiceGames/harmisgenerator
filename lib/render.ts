import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { asBar, Bar, chordStartPositions, parseChord, pretty, resolveSongMeters, RhythmNote, Song } from './song';

export const PAGE_WIDTH = 595.2756, PAGE_HEIGHT = 841.8898;
const L = 31, R = PAGE_WIDTH - 31, CW = (R - L) / 4;
const INK = '#111111', GREY = '#626262', ACCENT = '#173f50';
type TextOp = { kind: 'text'; x: number; y: number; text: string; size: number; bold: boolean; color: string };
type LineOp = { kind: 'line'; x: number; y: number; x2: number; y2: number; width: number; color: string };
type RectOp = { kind: 'rect'; x: number; y: number; w: number; h: number; color: string };
type EllipseOp = { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string; color: string; width: number };
type PathOp = { kind: 'path'; d: string; color: string; width: number };
type ChordHitOp = { kind: 'chord-hit'; x: number; y: number; w: number; h: number; section: number; bar: number; chord: number; variant?: number; label: string };
type SectionHitOp = {kind:'section-hit';x:number;y:number;w:number;h:number;section:number;label:string};
export type BarHitOp = {kind:'bar-hit'|'bar-number-hit'|'chord-area-hit'|'variant-area-hit';x:number;y:number;w:number;h:number;section:number;bar:number;number:number;variant?:number;label:string;beats:number;meter:string};
export type ReuseHitOp = {kind:'reuse-hit';x:number;y:number;w:number;h:number;section:number;label:string};
export type DrawOp = BarHitOp | ReuseHitOp | SectionHitOp | ChordHitOp | TextOp | LineOp | RectOp | EllipseOp | PathOp;
export type ChartPage = DrawOp[];
export type ChartOptions = {editable?:boolean;columns?:2|4};
let fontBytes: Promise<Buffer[]> | undefined;
function fonts() { return fontBytes ??= Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(name => readFile(path.join(process.cwd(), 'fonts', name)))); }
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

export function layoutChart(song: Song, regular: PDFFont, bold: PDFFont, options: ChartOptions = {}): ChartPage[] {
  const editable = options.editable === true;
  const columns = editable && options.columns === 2 ? 2 : 4;
  const CW = (R-L)/columns;
  const mobile = editable && columns === 2;
  const annotationSize = editable ? mobile ? 12 : 8 : 6;
  const annotationLine = editable ? mobile ? 14 : 10 : 7;
  const mainHeight = editable ? 64 : 32;
  const variantHeight = editable ? 86 : 32;
  const pages: ChartPage[] = [[]];
  let ops = pages[0];
  const width = (s: string, size: number, strong = false) => (strong ? bold : regular).widthOfTextAtSize(s, size);
  const text = (x: number, y: number, value: string, size = 9, strong = false, col = INK) => ops.push({ kind: 'text', x, y, text: value, size, bold: strong, color: col });
  const fitText = (x: number, y: number, value: string, size: number, max: number, strong = false, col = INK) => text(x, y, value, Math.min(size, size * max / Math.max(1, width(value, size, strong))), strong, col);
  // Keep each annotation in its note's horizontal slot, wrapping before the next note.
  const rhythmTexts = (bar: Pick<Bar,'rytm'>, beats: number, stop?:number, axis?:(beat:number)=>number) => (bar.rytm ?? []).map((event, index, events) => {
    const position = axis ?? ((beat:number)=>7 + (beat - 1) * (CW - 14) / beats);
    const offset = position(event.slag);
    const next = events[index + 1];
    const right = next ? position(next.slag)-4 : stop === undefined ? CW - 5 : position(stop)-4;
    const maxWidth = Math.max(1, right - (offset - 2));
    const lines: string[] = [];
    for (const paragraph of (event.text ?? '').trim().split(/\r?\n/)) {
      let current = '';
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        if (current && width(current + ' ' + word, annotationSize) <= maxWidth) { current += ' ' + word; continue; }
        if (current) { lines.push(current); current = ''; }
        for (const char of word) {
          if (current && width(current + char, annotationSize) > maxWidth) { lines.push(current); current = ''; }
          current += char;
        }
      }
      if (current) lines.push(current);
    }
    return { offset: offset - 2, maxWidth, lines };
  });
  const line = (x: number, y: number, x2: number, y2: number, w = .65, col = '#aaaaaa') => ops.push({ kind: 'line', x, y, x2, y2, width: w, color: col });
  const curve = (d: string, w = .7, col = INK) => ops.push({ kind: 'path', d, width: w, color: col });
  const ellipse = (x: number, y: number, rx: number, ry: number, fill = INK, stroke = INK, w = .7) => ops.push({ kind: 'ellipse', x, y, rx, ry, fill, color: stroke, width: w });
  const circle = (x: number, y: number, radius: number, fill = INK, stroke = INK, w = .7) => ellipse(x, y, radius, radius, fill, stroke, w);
  const coda = (x: number, y: number) => { circle(x, y, 5, '#ffffff', ACCENT, 1.25); line(x - 8, y, x + 8, y, 1.25, ACCENT); line(x, y - 8, x, y + 8, 1.25, ACCENT); };
  const fermata = (x: number, y: number) => { curve(`M ${x-6} ${y} C ${x-6} ${y-8} ${x+6} ${y-8} ${x+6} ${y}`, 1.15); circle(x, y-1.8, 1); };
  const note = (x: number, y: number, duration: 'whole' | 'half' | 'eighth' | 'quarter' | 'sixteenth') => {
    ellipse(x, y, 2.3, 1.2, duration === 'half' || duration === 'whole' ? '#ffffff' : INK);
    if (duration !== 'whole') line(x + 2, y, x + 2, y - 6, .7, INK);
    if (duration === 'sixteenth') curve(`M ${x+2} ${y-4} C ${x+2} ${y-2} ${x+8} ${y-2} ${x+5} ${y}`);
    if (duration === 'eighth' || duration === 'sixteenth') curve(`M ${x+2} ${y-6} C ${x+2} ${y-4} ${x+8} ${y-4} ${x+5} ${y-2}`);
  };
  const editorRhythm = (notes: RhythmNote[], axis:(beat:number)=>number, baseline:number, meter:string) => {
    const [beats,denominator]=meter.split('/').map(Number);
    const groupUnits = denominator===8 && beats>=6 && beats%3===0 ? 3 : denominator/4;
    const stems=notes.map((event,index)=>{
      const x=axis(event.slag);
      const gaps=[index>0?x-axis(notes[index-1].slag):Infinity,index+1<notes.length?axis(notes[index+1].slag)-x:Infinity];
      const radius=Math.max(.15,Math.min(3,(Math.min(...gaps)-1)/2));
      const stem=x+radius;
      ellipse(x,baseline,radius,Math.min(1.7,radius*.6),event.notvarde<=2?'#ffffff':INK,INK,1);
      if(event.notvarde!==1)line(stem,baseline,stem,baseline-22,1.1,INK);
      return stem;
    });
    const adjacent=(a:number,b:number)=>notes[a].notvarde>=8 && notes[b].notvarde>=8 && Math.abs(notes[b].slag-notes[a].slag-denominator/notes[a].notvarde)<.0001 && Math.floor((notes[a].slag-1)/groupUnits)===Math.floor((notes[b].slag-1)/groupUnits);
    const flag=(stem:number,extra=false)=>curve(`M ${stem} ${baseline-22+(extra?6:0)} C ${stem+10} ${baseline-16+(extra?6:0)} ${stem+10} ${baseline-10+(extra?6:0)} ${stem+5} ${baseline-7+(extra?6:0)}`,1.5);
    for(let index=0;index<notes.length;index++){
      if(notes[index].notvarde<8)continue;
      let end=index;
      while(end+1<notes.length && adjacent(end,end+1))end++;
      if(end===index){flag(stems[index]);if(notes[index].notvarde===16)flag(stems[index],true);}
      else {
        line(stems[index],baseline-22,stems[end],baseline-22,2.4,INK);
        for(let n=index;n<=end;n++){
          if(notes[n].notvarde!==16)continue;
          if(n<end && notes[n+1].notvarde===16)line(stems[n],baseline-16,stems[n+1],baseline-16,2.4,INK);
          else if(n===index || notes[n-1].notvarde!==16){const direction=n<end?1:-1,nextStem=stems[n+direction];line(stems[n],baseline-16,stems[n]+direction*Math.min(8,Math.abs(nextStem-stems[n])/3),baseline-16,2.4,INK);}
        }
      }
      index=end;
    }
  };
  const tie = (x1: number, x2: number, y: number) => curve(`M ${x1+2} ${y+2} C ${x1+(x2-x1)/3} ${y+6} ${x2-(x2-x1)/3} ${y+6} ${x2-2} ${y+2}`);
  const repeat = (x: number, y: number, start: boolean, bottom = 32) => {
    line(x, y + 4, x, y + bottom, .8, INK);
    line(x + (start ? -4 : 4), y + 4, x + (start ? -4 : 4), y + bottom, 2.2, INK);
    for (const delta of [(bottom+4)/2-4, (bottom+4)/2+4]) circle(x + (start ? 3.5 : -3.5), y + delta, 1.15);
  };
  const header = (continuation = false) => {
    let y = 37;
    if (continuation) { fitText(L, y, song.titel, mobile ? 24 : 16, R-L, true); y += mobile ? 30 : 17; }
    else {
      const titleSize = mobile ? 30 : 23;
      const words = song.titel.split(' '); let current = '';
      for (const word of words) {
        if (current && width(current + ' ' + word, titleSize, true) > R-L) { text(L, y, current, titleSize, true); y += mobile ? 35 : 27; current = word; }
        else current += (current ? ' ' : '') + word;
      }
      fitText(L, y, current, titleSize, R-L, true); y += mobile ? 24 : 17;
    }
    const meta = [pretty(song.grundtonart), song.taktart, song.stil, song.tempo ? `♩ = ${song.tempo}` : undefined].filter(Boolean).join('  •  ');
    fitText(L, y, meta, mobile ? 16 : 8, R-L, false, GREY); y += mobile ? 24 : 14;
    fitText(L, y, song.upphov || song.artist, mobile ? 16 : 8, R-L, false, GREY);
    if (song.spelordning) {
      y += 19;
      let current = 'Spelordning: ';
      for (const step of [...song.spelordning.map(step => `${step.del}${step.ganger > 1 ? ' × '+step.ganger : ''}`), 'SLUT']) {
        const next = current.endsWith(': ') ? current + step : current + ' → ' + step;
        if (width(next, 8, true) > R-L && !current.endsWith(': ')) {
          fitText(L,y,current+' →',8,R-L,true,ACCENT); y += 13; current = step;
        } else current = next;
      }
      fitText(L,y,current,8,R-L,true,ACCENT);
    }
    return y + 30;
  };
  let y = header();
  let number = 1;
  let meter = song.taktart;
  let house: string | undefined;
  const nextPage = () => { ops = []; pages.push(ops); y = header(true); };

  const meters = resolveSongMeters(song);
  const sectionRanges = new Map<string, number[]>();
  let rangeNumber = 1;
  for (const section of song.delar) {
    if(section.ateranvand)continue;
    for (const raw of section.takter) {
      const bar = asBar(raw); rangeNumber = bar.nummer ?? rangeNumber;
      sectionRanges.set(section.namn,[...(sectionRanges.get(section.namn) ?? []),rangeNumber++]);
    }
  }
  const drawReuse = (step: {del:string;ganger:number;anvisning?:string}, last:boolean, reuseIndex?:number) => {
    const instructionLines: string[] = [];
    if (step.anvisning) {
      let current = '';
      for (const word of step.anvisning.split(/\s+/)) {
        const next = current ? current+' '+word : word;
        if (current && width(next,9,true)>R-L-20) { instructionLines.push(current);current=word; }
        else current=next;
      }
      if(current)instructionLines.push(current);
    }
    const extra = instructionLines.length*14;
    if (!editable && y+77+extra > PAGE_HEIGHT-30) nextPage();
    const section = song.delar.findIndex(part=>part.namn===step.del);
    const range = sectionRanges.get(step.del)!;
    ops.push({kind:'rect',x:L,y:y-5,w:R-L,h:66+extra,color:'#f0f3f4'});
    text(L+10,y+7,`ÅTERANVÄND DEL · ${last ? 'AVSLUTNING' : 'ÅTERKOMST'}`,6.5,true,ACCENT);
    fitText(L+10,y+29,`${step.del}${step.ganger>1 ? ' × '+step.ganger : ''}`,15,R-L-20,true,ACCENT);
    if(editable && reuseIndex !== undefined) ops.push({kind:'reuse-hit',x:L,y:y-5,w:R-L,h:66+extra,section:reuseIndex,label:`Återanvänd del: ${step.del}`});
    else ops.push({kind:'section-hit',x:L+8,y:y+14,w:Math.min(R-L-16,width(step.del,15,true)+8),h:19,section,label:`Ändra delnamn: ${step.del}`});
    fitText(L+10,y+48,`Se ${step.del}, takt ${range[0]}–${range.at(-1)}. Spela ${step.ganger} ${step.ganger===1?'gång':'gånger'}${last ? ', sedan SLUT.' : '.'}`,8,R-L-20,false,GREY);
    instructionLines.forEach((value,i)=>fitText(L+10,y+64+i*14,value,9,R-L-20,true,ACCENT));
    y+=77+extra;
  };
  for (const [sectionIndex, section] of song.delar.entries()) {
    if (section.ateranvand) {
      if(section.sidbrytning)nextPage();
      drawReuse({del:section.ateranvand,ganger:section.ganger,anvisning:section.anvisning},sectionIndex===song.delar.length-1,sectionIndex);
      continue;
    }
    type Cell = { bar: Bar; number: number; col: number; beats: number; barIndex: number;meter:string };
    const rows: { cells: Cell[]; pageBreak: boolean }[] = [];
    let row: Cell[] = [], col = 0, pageBreak = !!section.sidbrytning;
    const flush = () => { if (row.length) rows.push({ cells: row, pageBreak }); row = []; col = 0; pageBreak = false; };
    for (const [barIndex, raw] of section.takter.entries()) {
      const bar = asBar(raw);
      const explicitColumn = bar.kolumn === undefined ? undefined : Math.min(columns-1,bar.kolumn);
      if (bar.radbrytning || bar.sidbrytning || col === columns || (explicitColumn !== undefined && explicitColumn < col)) flush();
      if (bar.sidbrytning) pageBreak = true;
      if (explicitColumn !== undefined) col = explicitColumn;
      number = bar.nummer ?? number;
      meter = meters.bars[sectionIndex][barIndex];
      row.push({ bar, number: number++, col: col++, beats: Number(meter.split('/')[0]), barIndex,meter });
    }
    flush();
    let first = true;
    for (const row of rows) {
      const hasHouse = !!house || row.cells.some(({ bar }) => bar.hus);
      const overhead = hasHouse ? 8 : 0;
      const labelSpace = first ? 7 : 0;
      const rhythmLabelSpace = row.cells.some(({ bar }) => bar.rytm && bar.anvisning) ? 10 : 0;
      const annotations = new Map(row.cells.map(cell => [cell.barIndex, rhythmTexts(cell.bar, cell.beats)]));
      const textLines = Math.max(0, ...[...annotations.values()].flatMap(notes => notes.map(note => note.lines.length)));
      const rhythmTextSpace = textLines ? textLines * annotationLine + (editable ? 6 : 3) : 0;
      const rhythmExtra = (editable || row.cells.some(({ bar }) => bar.rytm || bar.slag) ? editable ? row.cells.some(({bar})=>bar.rytm)?76:32 : 18 : 0) + rhythmLabelSpace + rhythmTextSpace + (editable && textLines ? 8 : 0);
      const variantCount = Math.max(0, ...row.cells.map(({ bar }) => bar.varianter?.length ?? 0));
      const variantExtras = Array.from({length:variantCount}, (_, i) => Math.max(0,...row.cells.map(({bar,beats})=> {
        const variant = bar.varianter?.[i]; if(!variant)return 0;
        const frameSpace = !editable && (variant.ackord_nr !== undefined || variant.rytm) ? 3 : 0;
        const enlarged = editable && variant.ackord_nr !== undefined;
        if(!variant.rytm)return frameSpace+(enlarged?40:0);
        const starts = chordStartPositions(bar,beats);
        const start = variant.ackord_nr === undefined ? 1 : starts[variant.ackord_nr-1];
        const stop = variant.ackord_nr === undefined ? undefined : starts[variant.ackord_nr] ?? beats+1;
        const axis = enlarged ? (beat:number)=>7+(beat-start)*(CW-14)/(stop!-start) : undefined;
        const lines = Math.max(0,...rhythmTexts(variant,beats,stop,axis).map(n=>n.lines.length));
        return frameSpace + (editable ? 76 : 18) + (lines ? lines*annotationLine+(editable?6:3) : 0);
      })));
      const variantOffsets = variantExtras.map((_,i)=>variantExtras.slice(0,i).reduce((sum,n)=>sum+variantHeight+n,0));
      const extra = rhythmExtra + variantCount * variantHeight + variantExtras.reduce((sum,n)=>sum+n,0);
      const cellBottom = mainHeight + extra;
      const beforeRow = editable ? columns === 2 ? 230 : 80 : 0, afterRow = editable ? columns === 2 ? 115 : 48 : 0;
      let continued = false;
      if ((row.pageBreak && ops.length > 4) || (!editable && y + labelSpace + overhead + beforeRow + 39 + extra + afterRow > PAGE_HEIGHT-30)) { nextPage(); continued = !first; }
      if (first || continued) {
        const partLabel = section.namn + (section.ganger > 1 ? ' × '+section.ganger : '') + (continued ? ' (forts.)' : '');
        fitText(L, y, partLabel, mobile ? 17 : 10, 260, true, ACCENT);
        ops.push({kind:'section-hit',x:L-2,y:y-(mobile?20:11),w:Math.min(262,width(partLabel,mobile?17:10,true)+5),h:mobile?24:14,section:sectionIndex,label:`Ändra delnamn: ${section.namn}`});
        if (section.anvisning) fitText(L + 275, y, section.anvisning, mobile?14:7.1, R-L-275, false, GREY);
        y += 7; first = false;
      }
      y += overhead + beforeRow;
      let houseStart = row.cells[0].col;
      const drawHouse = (start: number, end: number, label: string) => {
        const x = L + start * CW, right = L + end * CW;
        line(x, y - 2, right, y - 2, .7, INK); line(x, y - 2, x, y + 3, .7, INK);
        text(x + 4, y - 5, label, 6.8, true);
      };
      for (const { bar, number: n, col: column, beats, barIndex,meter:cellMeter } of row.cells) {
        const x = L + column * CW;
        const target = {section:sectionIndex,bar:barIndex,number:n,beats,meter:cellMeter};
        if(editable) {
          ops.push({kind:'bar-hit',x,y:y-beforeRow,w:CW,h:beforeRow+cellBottom+afterRow,...target,label:`Markera ${section.namn}, takt ${n}`});
          ops.push({kind:'bar-number-hit',x,y:y-24,w:CW,h:24,...target,label:`Markera ${section.namn}, takt ${n}`});
        }
        if (bar.hus) { if (house && column > houseStart) drawHouse(houseStart, column, house); house = bar.hus; houseStart = column; }
        if (section.skuggad) ops.push({ kind: 'rect', x, y, w: CW, h: cellBottom, color: '#f0f3f4' });
        line(x, y + 4, x, y + cellBottom);
        text(x + 5, editable ? y - 12 : y + 8, String(n), 6.8, false, GREY);
        const beatX = (beat: number) => x + 7 + (beat - 1) * (CW - 14) / beats;
        const drawChords = (value: string, baseline: number, starts: number[] | undefined, baseScale = 1, main = false, variant?: number, stop = beats+1, axis=beatX) => {
          const tokens = value.trim().split(/\s+/).filter(Boolean);
          const chords = tokens.map(parseChord);
          const factors = chords.map((_, i) => main && (bar.synkop?.ackord === i + 1 || (bar.break && !bar.synkop && !bar.rytm && i === 0)) ? .6 : 1);
          const widths = chords.map(c => width(pretty(c.root), 23, true) + width(pretty(c.extension), 10) + (c.bass ? width('/'+pretty(c.bass), 13, true) : 0) + (c.parenthesized ? width('()',20) : 0) + 2);
          const gap = chords.length > 1 ? 12 : 0;
          const scale = Math.min(baseScale, (CW - 15) / (widths.reduce((sum, w, i) => sum + w*factors[i], 0) + gap * (chords.length-1)));
          let xx = x + 7;
          const positions: number[] = [];
          chords.forEach((chord, i) => {
            if (starts) xx = axis(starts[i]);
            positions.push(xx);
            const available = starts ? (i+1 < starts.length ? axis(starts[i+1])-4 : axis(stop)) - xx : Infinity;
            const factor = starts ? Math.max(.01,Math.min(baseScale * factors[i], available / widths[i])) : scale * factors[i];
            const root = pretty(chord.root), ext = pretty(chord.extension);
            const rootX = xx + (chord.parenthesized ? width('(',20)*factor : 0);
            if(chord.parenthesized){
              text(xx,baseline,'(',20*factor);
              text(xx+(widths[i]-width(')',20))*factor,baseline,')',20*factor);
            }
            text(rootX, baseline, root, 23 * factor, true);
            const rw = width(root, 23, true) * factor;
            text(rootX + rw + .5*factor, baseline - 5*factor, ext, 10*factor);
            if (chord.bass) text(rootX + rw + (width(ext,10)+1)*factor, baseline, '/'+pretty(chord.bass), 13*factor, true);
            if (main && bar.fermat === i+1) fermata(xx + widths[i]*factor/2, baseline-19);
            if (starts && main && !bar.rytm) text(xx, editable ? y+17 : baseline-19, String(starts[i]).replace('.5', 'å'), editable ? mobile ? 12 : 9 : 5.5, false, GREY);
            ops.push({kind:'chord-hit',x:xx-1,y:baseline-23*factor,w:widths[i]*factor+2,h:26*factor,
              section:sectionIndex,bar:barIndex,chord:i,variant,
              label:`Ändra ${tokens[i]}, ${section.namn}, takt ${n}${variant === undefined ? '' : ', variant '+(variant+1)}`});
            xx += (widths[i]*factors[i]+gap)*scale;
          });
          return positions;
        };
        if(editable)ops.push({kind:'chord-area-hit',x,y:y+4+rhythmExtra,w:CW,h:60,...target,label:`Skriv ackord i ${section.namn}, takt ${n}`});
        const positions = drawChords(bar.ackord, y+(editable?44:29)+rhythmExtra, editable || bar.varianter?.some(v=>v.ackord_nr !== undefined) ? chordStartPositions(bar,beats) : bar.slag, mobile?1.2:1, true);
        bar.varianter?.forEach((variant, i) => {
          const ownerName = variant.ackord_nr === undefined ? '' : bar.ackord.trim().split(/\s+/).filter(Boolean)[variant.ackord_nr-1];
          const label = editable ? `${variant.gang}${variant.gang === 2 ? ':a' : ':e'}${variant.och_foljande ? '+' : ''}${ownerName ? ' · '+pretty(ownerName) : ''}${variant.stamma ? ' · '+variant.stamma : ''}` : `${variant.och_foljande ? 'Fr.o.m. ' : ''}${variant.gang}${variant.gang === 2 ? ':a' : ':e'} gången${variant.stamma ? ' · '+variant.stamma : ''}${variant.slag ? ' · slag '+variant.slag.join(', ') : ''}`;
          const base = y + rhythmExtra + (editable?mainHeight:0) + variantOffsets[i];
          const variantExtra = variantExtras[i];
          const ownerStarts = chordStartPositions(bar,beats);
          const start = variant.ackord_nr === undefined ? 1 : ownerStarts[variant.ackord_nr-1];
          const stop = variant.ackord_nr === undefined ? beats+1 : (ownerStarts[variant.ackord_nr] ?? beats+1);
          const enlarged = editable && variant.ackord_nr !== undefined;
          const variantBeatX = enlarged ? (beat:number)=>x+7+(beat-start)*(CW-14)/(stop-start) : beatX;
          const frameX = variant.ackord_nr === undefined || enlarged ? x+4 : beatX(start)-3;
          const frameRight = variant.ackord_nr === undefined || enlarged ? x+CW-4 : beatX(stop);
          const frameTop = base+(editable?26:47);
          const frameBottom = base+(editable?86:64)+variantExtra;
          if(editable || variant.ackord_nr !== undefined || variant.rytm) {
            line(frameX,frameTop,frameRight,frameTop,.4,'#dddddd');
            line(frameX,frameTop,frameX,frameBottom,.4,'#dddddd');
            line(frameRight,frameTop,frameRight,frameBottom,.4,'#dddddd');
            line(frameX,frameBottom,frameRight,frameBottom,.4,'#dddddd');
          }
          fitText(x+7, base+(editable?14:43), label, editable?mobile?16:10:6.4, CW-14, false, ACCENT);
          if(editable)ops.push({kind:'variant-area-hit',x:frameX,y:frameTop+variantExtra,w:frameRight-frameX,h:60,...target,variant:i,label:`Skriv variant ${i+1} i ${section.namn}, takt ${n}`});
          const count = variant.ackord.trim().split(/\s+/).filter(Boolean).length;
          const starts = variant.slag ?? (variant.ackord_nr !== undefined || editable ? Array.from({length:count},(_,j)=>start+Math.floor(j*(stop-start)/count*4)/4) : undefined);
          drawChords(variant.ackord, base+(editable?66:61)+variantExtra, starts, editable?mobile?1.2:1:.7, false, i,stop,variantBeatX);
          if(enlarged) {
            const step=stop-start<=4?.5:Math.ceil((stop-start)/8);
            const ruler=new Set([...Array.from({length:Math.ceil((stop-start)/step)},(_,j)=>start+j*step),...(starts??[]),...(variant.rytm??[]).map(n=>n.slag)]);
            for(const beat of [...ruler].sort((a,b)=>a-b)) {
              const bx=variantBeatX(beat);
              text(bx-2,base+(editable?40:52),String(beat),editable?mobile?12:9:5,false,GREY);
              line(bx,base+(editable?44:54),bx,base+(editable?54:64),.3,'#dddddd');
            }
          }
          if(variant.rytm) {
            const durations = {1:'whole',2:'half',4:'quarter',8:'eighth',16:'sixteenth'} as const;
            for(const event of variant.rytm) {
              const bx=variantBeatX(event.slag),whole=Math.floor(event.slag),fraction=event.slag-whole;
              const label=fraction===.5?`${whole}å`:String(event.slag).replace('.',',');
              if(!enlarged)text(bx-2,base+(editable?40:52),label,editable?mobile?12:9:5,false,GREY);
              if(!editable)note(bx,base+61,durations[event.notvarde]);
            }
            if(editable)editorRhythm(variant.rytm,variantBeatX,base+75,cellMeter);
            const annotationAxis = enlarged ? (beat:number)=>variantBeatX(beat)-x : undefined;
            for(const annotation of rhythmTexts(variant,beats,variant.ackord_nr === undefined ? undefined : stop,annotationAxis))annotation.lines.forEach((value,j)=>fitText(x+annotation.offset,base+(editable?91:70)+j*annotationLine,value,annotationSize,annotation.maxWidth,false,ACCENT));
          }
        });
        if (bar.rytm) {
          if (bar.anvisning) fitText(x+6,y+17,bar.anvisning,mobile?12:6.3,CW-12,false,ACCENT);
          const beatLabels = new Set([...Array.from({length:beats},(_,i)=>i+1), ...bar.rytm.map(n=>n.slag)]);
          for (const beat of [...beatLabels].sort((a,b)=>a-b)) {
            const bx = beatX(beat);
            const whole = Math.floor(beat), fraction = beat-whole;
            const label = fraction === .5 ? `${whole}å` : fraction === 0 ? String(whole) : String(beat).replace('.', ',');
            text(bx-2,y+17+rhythmLabelSpace,label,editable?mobile?12:9:5,false,GREY);
            line(bx,y+20+rhythmLabelSpace,bx,y+32+rhythmLabelSpace,.3,'#dddddd');
          }
          const durations = {1:'whole',2:'half',4:'quarter',8:'eighth',16:'sixteenth'} as const;
          if(editable)editorRhythm(bar.rytm,beatX,y+52+rhythmLabelSpace,cellMeter);
          else for (const event of bar.rytm) note(beatX(event.slag), y+27+rhythmLabelSpace, durations[event.notvarde]);
          for (const annotation of annotations.get(barIndex)!) {
            annotation.lines.forEach((value, index) => fitText(x + annotation.offset, y + (editable?68:36) + rhythmLabelSpace + index * annotationLine, value, annotationSize, annotation.maxWidth, false, ACCENT));
          }
          if (bar.break) text(x+6,y+39+extra,'BREAK',6.3,true,ACCENT);
        }
        if (bar.synkop) {
          const yy = y+13.5;
          if (bar.synkop.typ === 'foruttag') {
            // When wrapping, draw the incoming tie in this bar rather than outside the page.
            const start = column > 0 ? x-CW+11+3.5*(CW-22)/4 : x+10;
            const end = column > 0 ? x+19 : x+38;
            note(start, yy, 'eighth'); note(end, yy, 'eighth'); tie(start, end, yy);
            if (column === 0) text(x+48, yy, 'från föreg. takt', 5, false, GREY);
            if (bar.break) text(end+12, yy-1, 'BREAK', 6.2, true, ACCENT);
          } else {
            const attack = positions[bar.synkop.ackord-1]+2;
            note(attack, yy, 'eighth'); note(attack+16, yy, 'half'); tie(attack,attack+16,yy);
            if (bar.break) text(x+6,y+39+extra,'BREAK',6.3,true,ACCENT);
          }
        } else if (bar.break && !bar.rytm) { note(x+19,y+13.5,'quarter'); text(x+31,y+12.5,'BREAK',6.2,true,ACCENT); }
        const instructions = [bar.rytm ? undefined : bar.anvisning, bar.tonart ? pretty(bar.tonart) : '', bar.taktart, bar.slut ? 'SLUT' : ''].filter(Boolean).join(' · ');
        if (instructions) fitText(x+6,y+39+extra,instructions,6.3,CW-12,false,ACCENT);
        if (bar.coda) { coda(x+CW-13,y+9); if (bar.coda === 'hopp') text(x+CW-48,y+8,'Till',5.5,false,ACCENT); }
        if (bar.segno) { text(x+CW-26,y+12,'S',12,true,ACCENT); line(x+CW-28,y+14,x+CW-14,y,.8,ACCENT); circle(x+CW-28,y+4,1,ACCENT); circle(x+CW-14,y+12,1,ACCENT); }
        if (bar.repris_start) repeat(x,y,true,cellBottom);
        if (bar.repris_slut) repeat(x+CW,y,false,cellBottom);
        if (bar.slut) { line(x+CW-3,y+4,x+CW-3,y+cellBottom,.8,INK); line(x+CW,y+4,x+CW,y+cellBottom,2.2,INK); }
        if (bar.hus_slut && house) { drawHouse(houseStart,column+1,house); house = undefined; }
      }
      const end = row.cells.at(-1)!.col + 1;
      line(L+end*CW,y+4,L+end*CW,y+cellBottom);
      if (house) drawHouse(houseStart,end,house);
      y += mainHeight + 12 + extra + afterRow;
    }
    y += 12;
  }
  song.spelordning?.forEach((step,index)=>{
    const reused=song.spelordning!.slice(0,index).some(previous=>previous.del===step.del)||step.ganger>1||!!step.anvisning;
    if(step.visa_block??reused)drawReuse(step,index===song.spelordning!.length-1);
  });
  if(!editable)pages.forEach((page, i) => page.push({kind:'text', x:R-30, y:PAGE_HEIGHT-16,text:`${i+1} / ${pages.length}`,size:6.5,bold:false,color:GREY}));
  return pages;
}

export function pageSvg(page: ChartPage) {
  const targetOrder: Record<string,number> = {'bar-hit':1,'chord-area-hit':2,'variant-area-hit':2,'bar-number-hit':3,'reuse-hit':4,'section-hit':5,'chord-hit':6};
  const editablePage = page.some(op=>op.kind==='bar-hit'||op.kind==='reuse-hit');
  const commands = editablePage ? [...page.filter(op=>!targetOrder[op.kind]),...page.filter(op=>targetOrder[op.kind]).sort((a,b)=>targetOrder[a.kind]-targetOrder[b.kind])] : page;
  const height = editablePage ? Math.max(PAGE_HEIGHT,...page.map(op=>op.kind==='path'?0:op.kind==='line'?Math.max(op.y,op.y2)+20:op.kind==='ellipse'?op.y+op.ry+20:op.kind==='text'?op.y+op.size+20:op.y+op.h+20)) : PAGE_HEIGHT;
  const content = commands.map(op => {
    switch(op.kind) {
      case 'bar-hit':
      case 'bar-number-hit':
      case 'chord-area-hit':
      case 'variant-area-hit': return `<rect class="${op.kind}" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}" data-bar="${op.bar}" data-number="${op.number}" data-beats="${op.beats}" data-meter="${xml(op.meter)}"${op.variant === undefined ? '' : ` data-variant="${op.variant}"`}><title>${xml(op.label)}</title></rect>`;
      case 'reuse-hit': return `<rect class="reuse-hit" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}"><title>${xml(op.label)}</title></rect>`;
      case 'section-hit': return `<rect class="section-hit" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}"><title>${xml(op.label)}</title></rect>`;
      case 'chord-hit': return `<rect class="chord-hit" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}" data-bar="${op.bar}" data-chord="${op.chord}"${op.variant === undefined ? '' : ` data-variant="${op.variant}"`}><title>${xml(op.label)}</title></rect>`;
      case 'text': return `<text x="${op.x}" y="${op.y}" font-family="Harmis" font-size="${op.size}" font-weight="${op.bold ? 700 : 400}" fill="${op.color}" style="font-kerning:none;font-variant-ligatures:none">${xml(op.text)}</text>`;
      case 'line': return `<line x1="${op.x}" y1="${op.y}" x2="${op.x2}" y2="${op.y2}" stroke="${op.color}" stroke-width="${op.width}"/>`;
      case 'rect': return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.color}"/>`;
      case 'ellipse': return `<ellipse cx="${op.x}" cy="${op.y}" rx="${op.rx}" ry="${op.ry}" fill="${op.fill}" stroke="${op.color}" stroke-width="${op.width}"/>`;
      case 'path': return `<path d="${op.d}" fill="none" stroke="${op.color}" stroke-width="${op.width}"/>`;
    }
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${height}" role="group" aria-label="Ackordblad"><rect width="100%" height="100%" fill="white"/>${content}</svg>`;
}

export async function renderChart(song: Song, format: 'svg' | 'pdf' = 'svg', options: ChartOptions = {}) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const bytes = await fonts();
  const [regular, bold] = await Promise.all(bytes.map(b => pdf.embedFont(b, { subset: true })));
  const pages = layoutChart(song, regular, bold, format === 'pdf' ? {} : options);
  if (format === 'svg') return { pages: pages.map(pageSvg) };
  for (const commands of pages) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    for (const op of commands) {
      switch(op.kind) {
        case 'bar-hit':
        case 'bar-number-hit':
        case 'chord-area-hit':
        case 'variant-area-hit':
        case 'reuse-hit':
        case 'section-hit':
        case 'chord-hit': break; // Interactive targets are only part of the screen preview.
        case 'text': page.drawText(op.text,{ x:op.x,y:PAGE_HEIGHT-op.y,size:op.size,font:op.bold?bold:regular,color:color(op.color) }); break;
        case 'line': page.drawLine({start:{x:op.x,y:PAGE_HEIGHT-op.y},end:{x:op.x2,y:PAGE_HEIGHT-op.y2},thickness:op.width,color:color(op.color)}); break;
        case 'rect': page.drawRectangle({x:op.x,y:PAGE_HEIGHT-op.y-op.h,width:op.w,height:op.h,color:color(op.color)}); break;
        case 'ellipse': page.drawEllipse({x:op.x,y:PAGE_HEIGHT-op.y,xScale:op.rx,yScale:op.ry,color:color(op.fill),borderColor:color(op.color),borderWidth:op.width}); break;
        case 'path': page.drawSvgPath(op.d,{x:0,y:PAGE_HEIGHT,borderColor:color(op.color),borderWidth:op.width}); break;
      }
    }
  }
  pdf.setTitle(song.titel); pdf.setAuthor(song.upphov || song.artist); pdf.setCreator('Harmisgenerator');
  return { pdf: await pdf.save(), pageCount: pages.length };
}
