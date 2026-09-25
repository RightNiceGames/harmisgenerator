import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { asBar, Bar, parseChord, pretty, Song } from './song';

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
export type DrawOp = SectionHitOp | ChordHitOp | TextOp | LineOp | RectOp | EllipseOp | PathOp;
export type ChartPage = DrawOp[];
let fontBytes: Promise<Buffer[]> | undefined;
function fonts() { return fontBytes ??= Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(name => readFile(path.join(process.cwd(), 'fonts', name)))); }
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

export function layoutChart(song: Song, regular: PDFFont, bold: PDFFont): ChartPage[] {
  const pages: ChartPage[] = [[]];
  let ops = pages[0];
  const width = (s: string, size: number, strong = false) => (strong ? bold : regular).widthOfTextAtSize(s, size);
  const text = (x: number, y: number, value: string, size = 9, strong = false, col = INK) => ops.push({ kind: 'text', x, y, text: value, size, bold: strong, color: col });
  const fitText = (x: number, y: number, value: string, size: number, max: number, strong = false, col = INK) => text(x, y, value, Math.min(size, size * max / Math.max(1, width(value, size, strong))), strong, col);
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
  const tie = (x1: number, x2: number, y: number) => curve(`M ${x1+2} ${y+2} C ${x1+(x2-x1)/3} ${y+6} ${x2-(x2-x1)/3} ${y+6} ${x2-2} ${y+2}`);
  const repeat = (x: number, y: number, start: boolean, bottom = 32) => {
    line(x, y + 4, x, y + bottom, .8, INK);
    line(x + (start ? -4 : 4), y + 4, x + (start ? -4 : 4), y + bottom, 2.2, INK);
    for (const delta of [(bottom+4)/2-4, (bottom+4)/2+4]) circle(x + (start ? 3.5 : -3.5), y + delta, 1.15);
  };
  const header = (continuation = false) => {
    let y = 37;
    if (continuation) { fitText(L, y, song.titel, 16, R-L, true); y += 17; }
    else {
      const words = song.titel.split(' '); let current = '';
      for (const word of words) {
        if (current && width(current + ' ' + word, 23, true) > R-L) { text(L, y, current, 23, true); y += 27; current = word; }
        else current += (current ? ' ' : '') + word;
      }
      fitText(L, y, current, 23, R-L, true); y += 17;
    }
    const meta = [pretty(song.grundtonart), song.taktart, song.stil, song.tempo ? `♩ = ${song.tempo}` : undefined].filter(Boolean).join('  •  ');
    fitText(L, y, meta, 8, R-L, false, GREY); y += 14;
    fitText(L, y, song.upphov || song.artist, 8, R-L, false, GREY);
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

  const sectionRanges = new Map<string, number[]>();
  for (const [sectionIndex, section] of song.delar.entries()) {
    type Cell = { bar: Bar; number: number; col: number; beats: number; barIndex: number };
    const rows: { cells: Cell[]; pageBreak: boolean }[] = [];
    let row: Cell[] = [], col = 0, pageBreak = !!section.sidbrytning;
    const flush = () => { if (row.length) rows.push({ cells: row, pageBreak }); row = []; col = 0; pageBreak = false; };
    for (const [barIndex, raw] of section.takter.entries()) {
      const bar = asBar(raw);
      if (bar.radbrytning || bar.sidbrytning || col === 4 || (bar.kolumn !== undefined && bar.kolumn < col)) flush();
      if (bar.sidbrytning) pageBreak = true;
      if (bar.kolumn !== undefined) col = bar.kolumn;
      number = bar.nummer ?? number;
      sectionRanges.set(section.namn,[...(sectionRanges.get(section.namn) ?? []),number]);
      meter = bar.taktart ?? meter;
      row.push({ bar, number: number++, col: col++, beats: Number(meter.split('/')[0]), barIndex });
    }
    flush();
    let first = true;
    for (const row of rows) {
      const hasHouse = !!house || row.cells.some(({ bar }) => bar.hus);
      const overhead = hasHouse ? 8 : 0;
      const labelSpace = first ? 7 : 0;
      const rhythmLabelSpace = row.cells.some(({ bar }) => bar.rytm && bar.anvisning) ? 10 : 0;
      const rhythmExtra = (row.cells.some(({ bar }) => bar.rytm || bar.slag) ? 18 : 0) + rhythmLabelSpace;
      const variantCount = Math.max(0, ...row.cells.map(({ bar }) => bar.varianter?.length ?? 0));
      const extra = rhythmExtra + variantCount * 32;
      const cellBottom = 32 + extra;
      let continued = false;
      if ((row.pageBreak && ops.length > 4) || y + labelSpace + overhead + 39 + extra > PAGE_HEIGHT-30) { nextPage(); continued = !first; }
      if (first || continued) {
        fitText(L, y, section.namn + (continued ? ' (forts.)' : ''), 10, 260, true, ACCENT);
        ops.push({kind:'section-hit',x:L-2,y:y-11,w:Math.min(262,width(section.namn+(continued ? ' (forts.)' : ''),10,true)+5),h:14,section:sectionIndex,label:`Ändra delnamn: ${section.namn}`});
        if (section.anvisning) fitText(L + 275, y, section.anvisning, 7.1, R-L-275, false, GREY);
        y += 7; first = false;
      }
      y += overhead;
      let houseStart = row.cells[0].col;
      const drawHouse = (start: number, end: number, label: string) => {
        const x = L + start * CW, right = L + end * CW;
        line(x, y - 2, right, y - 2, .7, INK); line(x, y - 2, x, y + 3, .7, INK);
        text(x + 4, y - 5, label, 6.8, true);
      };
      for (const { bar, number: n, col: column, beats, barIndex } of row.cells) {
        const x = L + column * CW;
        if (bar.hus) { if (house && column > houseStart) drawHouse(houseStart, column, house); house = bar.hus; houseStart = column; }
        if (section.skuggad) ops.push({ kind: 'rect', x, y, w: CW, h: cellBottom, color: '#f0f3f4' });
        line(x, y + 4, x, y + cellBottom);
        text(x + 5, y + 8, String(n), 6.8, false, GREY);
        const beatX = (beat: number) => x + 7 + (beat - 1) * (CW - 14) / beats;
        const drawChords = (value: string, baseline: number, starts: number[] | undefined, baseScale = 1, main = false, variant?: number) => {
          const chords = value.trim().split(/\s+/).map(parseChord);
          const factors = chords.map((_, i) => main && (bar.synkop?.ackord === i + 1 || (bar.break && !bar.synkop && !bar.rytm && i === 0)) ? .6 : 1);
          const widths = chords.map(c => width(pretty(c.root), 23, true) + width(pretty(c.extension), 10) + (c.bass ? width('/'+pretty(c.bass), 13, true) : 0) + 2);
          const gap = chords.length > 1 ? 12 : 0;
          const scale = Math.min(baseScale, (CW - 15) / (widths.reduce((sum, w, i) => sum + w*factors[i], 0) + gap * (chords.length-1)));
          let xx = x + 7;
          const positions: number[] = [];
          chords.forEach((chord, i) => {
            if (starts) xx = beatX(starts[i]);
            positions.push(xx);
            const available = starts ? (i+1 < starts.length ? beatX(starts[i+1])-4 : x+CW-7) - xx : Infinity;
            const factor = starts ? Math.min(baseScale * factors[i], available / widths[i]) : scale * factors[i];
            const root = pretty(chord.root), ext = pretty(chord.extension);
            text(xx, baseline, root, 23 * factor, true);
            const rw = width(root, 23, true) * factor;
            text(xx + rw + .5*factor, baseline - 5*factor, ext, 10*factor);
            if (chord.bass) text(xx + rw + (width(ext,10)+1)*factor, baseline, '/'+pretty(chord.bass), 13*factor, true);
            if (main && bar.fermat === i+1) fermata(xx + widths[i]*factor/2, baseline-19);
            if (starts && main && !bar.rytm) text(xx, baseline-19, String(starts[i]).replace('.5', 'å'), 5.5, false, GREY);
            ops.push({kind:'chord-hit',x:xx-1,y:baseline-23*factor,w:widths[i]*factor+2,h:26*factor,
              section:sectionIndex,bar:barIndex,chord:i,variant,
              label:`Ändra ${value.trim().split(/\s+/)[i]}, ${section.namn}, takt ${n}${variant === undefined ? '' : ', variant '+(variant+1)}`});
            xx += (widths[i]*factors[i]+gap)*scale;
          });
          return positions;
        };
        const positions = drawChords(bar.ackord, y+29+rhythmExtra, bar.slag, 1, true);
        bar.varianter?.forEach((variant, i) => {
          const label = `${variant.gang}${variant.gang === 2 ? ':a' : ':e'} gången${variant.stamma ? ' · '+variant.stamma : ''}${variant.slag ? ' · slag '+variant.slag.join(', ') : ''}`;
          const base = y + rhythmExtra + i*32;
          fitText(x+7, base+43, label, 6.4, CW-14, false, ACCENT);
          drawChords(variant.ackord, base+61, variant.slag, .7, false, i);
        });
        if (bar.rytm) {
          if (bar.anvisning) fitText(x+6,y+17,bar.anvisning,6.3,CW-12,false,ACCENT);
          const beatLabels = new Set([...Array.from({length:beats},(_,i)=>i+1), ...bar.rytm.map(n=>n.slag)]);
          for (const beat of [...beatLabels].sort((a,b)=>a-b)) {
            const bx = beatX(beat);
            const whole = Math.floor(beat), fraction = beat-whole;
            const label = fraction === .5 ? `${whole}å` : fraction === 0 ? String(whole) : String(beat).replace('.', ',');
            text(bx-2,y+17+rhythmLabelSpace,label,5,false,GREY);
            line(bx,y+20+rhythmLabelSpace,bx,y+32+rhythmLabelSpace,.3,'#dddddd');
          }
          const durations = {1:'whole',2:'half',4:'quarter',8:'eighth',16:'sixteenth'} as const;
          for (const event of bar.rytm) note(beatX(event.slag), y+27+rhythmLabelSpace, durations[event.notvarde]);
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
      y += 44 + extra;
    }
    y += 12;
  }
  song.spelordning?.forEach((step, index) => {
    const reused = song.spelordning!.slice(0,index).some(previous=>previous.del===step.del) || step.ganger > 1;
    if (!(step.visa_block ?? reused)) return;
    if (y+77 > PAGE_HEIGHT-30) nextPage();
    const last = index === song.spelordning!.length-1;
    const section = song.delar.findIndex(part=>part.namn===step.del);
    const range = sectionRanges.get(step.del)!;
    ops.push({kind:'rect',x:L,y:y-5,w:R-L,h:66,color:'#f0f3f4'});
    text(L+10,y+7,`ÅTERANVÄND DEL · ${last ? 'AVSLUTNING' : 'STEG '+(index+1)+' I SPELORDNINGEN'}`,6.5,true,ACCENT);
    fitText(L+10,y+29,`${step.del}${step.ganger>1 ? ' × '+step.ganger : ''}`,15,R-L-20,true,ACCENT);
    ops.push({kind:'section-hit',x:L+8,y:y+14,w:Math.min(R-L-16,width(step.del,15,true)+8),h:19,section,label:`Ändra delnamn: ${step.del}`});
    fitText(L+10,y+48,`Se ${step.del}, takt ${range[0]}–${range.at(-1)}. Spela ${step.ganger} ${step.ganger===1?'gång':'gånger'}${last ? ', sedan SLUT.' : '.'}`,8,R-L-20,false,GREY);
    y+=77;
  });
  pages.forEach((page, i) => page.push({kind:'text', x:R-30, y:PAGE_HEIGHT-16,text:`${i+1} / ${pages.length}`,size:6.5,bold:false,color:GREY}));
  return pages;
}

export function pageSvg(page: ChartPage) {
  const content = page.map(op => {
    switch(op.kind) {
      case 'section-hit': return `<rect class="section-hit" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}"><title>${xml(op.label)}</title></rect>`;
      case 'chord-hit': return `<rect class="chord-hit" x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="transparent" role="button" tabindex="0" aria-label="${xml(op.label)}" data-section="${op.section}" data-bar="${op.bar}" data-chord="${op.chord}"${op.variant === undefined ? '' : ` data-variant="${op.variant}"`}><title>${xml(op.label)}</title></rect>`;
      case 'text': return `<text x="${op.x}" y="${op.y}" font-family="Harmis" font-size="${op.size}" font-weight="${op.bold ? 700 : 400}" fill="${op.color}" style="font-kerning:none;font-variant-ligatures:none">${xml(op.text)}</text>`;
      case 'line': return `<line x1="${op.x}" y1="${op.y}" x2="${op.x2}" y2="${op.y2}" stroke="${op.color}" stroke-width="${op.width}"/>`;
      case 'rect': return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.color}"/>`;
      case 'ellipse': return `<ellipse cx="${op.x}" cy="${op.y}" rx="${op.rx}" ry="${op.ry}" fill="${op.fill}" stroke="${op.color}" stroke-width="${op.width}"/>`;
      case 'path': return `<path d="${op.d}" fill="none" stroke="${op.color}" stroke-width="${op.width}"/>`;
    }
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" role="group" aria-label="Ackordblad"><rect width="100%" height="100%" fill="white"/>${content}</svg>`;
}

export async function renderChart(song: Song, format: 'svg' | 'pdf' = 'svg') {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const bytes = await fonts();
  const [regular, bold] = await Promise.all(bytes.map(b => pdf.embedFont(b, { subset: true })));
  const pages = layoutChart(song, regular, bold);
  if (format === 'svg') return { pages: pages.map(pageSvg) };
  for (const commands of pages) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    for (const op of commands) {
      switch(op.kind) {
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
