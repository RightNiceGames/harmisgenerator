import { z } from 'zod';

export const highlightColors = {rod:'#f6b9b5',gul:'#ffeb8a',bla:'#b7d5fa',gron:'#bce3ad'} as const;
export type HighlightColor = keyof typeof highlightColors;
export const highlightNames: Record<HighlightColor,string> = {rod:'Röd',gul:'Gul',bla:'Blå',gron:'Grön'};
export const highlightSchema = z.strictObject({
  element:z.string().min(1).max(500),
  farg:z.enum(['rod','gul','bla','gron']),
  fran:z.number().int().nonnegative().optional(),
  till:z.number().int().positive().optional(),
}).refine(value=>(value.fran===undefined&&value.till===undefined)||(value.fran!==undefined&&value.till!==undefined&&value.till>value.fran),'Textmarkeringen behöver ett giltigt spann.');
export const highlightsSchema=z.array(highlightSchema).max(400).optional();
export type Highlight=z.infer<typeof highlightSchema>;
export type HighlightOwner={section?:number;bar?:number;variant?:number;formStep?:number};
export type HighlightTarget={owner:HighlightOwner;element:string;text?:string;positions?:number[]};

export function remapChordHighlights(marks:Highlight[]|undefined,map:(index:number)=>number|undefined):Highlight[]|undefined {
  const next=marks?.flatMap(mark=>{
    const match=/^ackord:(\d+)$/.exec(mark.element);if(!match)return [mark];
    const index=map(Number(match[1]));return index===undefined?[]:[{...mark,element:`ackord:${index}`}];
  });
  return next?.length?next:undefined;
}
