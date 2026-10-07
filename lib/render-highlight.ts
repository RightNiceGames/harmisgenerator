import type { PDFFont } from 'pdf-lib';
import { asBar, type Song } from './song';
import type { ChartPage, DrawOp } from './render';
import { highlightColors, type Highlight, type HighlightOwner, type HighlightTarget } from './highlight';

// Targets belong to musical objects, so copying/moving a bar carries its marks.
export function chartHighlighter(song:Song, regular:PDFFont, bold:PDFFont, editable:boolean, current:()=>{ops:ChartPage;owner:HighlightOwner}) {
  let depth=0;
  const counts=new Map<string,number>();
  const marksFor=(owner:HighlightOwner):Highlight[]=>{
    if(owner.formStep!==undefined)return song.spelordning?.[owner.formStep]?.markeringar??[];
    if(owner.section===undefined)return song.markeringar??[];
    const section=song.delar[owner.section];
    if(owner.bar===undefined)return section.markeringar??[];
    const bar=asBar(section.takter[owner.bar]);
    return (owner.variant===undefined?bar:bar.varianter?.[owner.variant])?.markeringar??[];
  };
  const bounds=(op:DrawOp):[number,number,number,number]|undefined=>{
    switch(op.kind){
      case 'text':return [op.x,op.y-op.size,(op.bold?bold:regular).widthOfTextAtSize(op.text,op.size),op.size*1.25];
      case 'line':return [Math.min(op.x,op.x2)-1,Math.min(op.y,op.y2)-1,Math.abs(op.x-op.x2)+2,Math.abs(op.y-op.y2)+2];
      case 'ellipse':return [op.x-op.rx-1,op.y-op.ry-1,op.rx*2+2,op.ry*2+2];
      case 'path':{const values=op.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number)??[],xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);if(!xs.length)return;return [Math.min(...xs)-1,Math.min(...ys)-1,Math.max(...xs)-Math.min(...xs)+2,Math.max(...ys)-Math.min(...ys)+2];}
      case 'rect':return [op.x,op.y,op.w,op.h];
    }
  };
  return function mark(kind:string,draw:()=>void,fixedKey?:string){
    if(depth){draw();return;}
    const {ops,owner}=current(),start=ops.length;
    depth++;try{draw();}finally{depth--;}
    const drawings=ops.slice(start),boxes=drawings.map(bounds).filter((box):box is [number,number,number,number]=>!!box);
    if(!boxes.length)return;
    const singleText=drawings.length===1&&drawings[0].kind==='text'?drawings[0]:undefined;
    if(singleText&&!singleText.text)return;
    const base=singleText?'text:'+singleText.text:kind,key=JSON.stringify(owner)+':'+base,occurrence=counts.get(key)??0;
    counts.set(key,occurrence+1);
    const element=fixedKey??`${base}:${occurrence}`;
    const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1]));
    const w=Math.max(...boxes.map(b=>b[0]+b[2]))-x,h=Math.max(...boxes.map(b=>b[1]+b[3]))-y;
    const positions=singleText?Array.from({length:Array.from(singleText.text).length+1},(_,i)=>(singleText.bold?bold:regular).widthOfTextAtSize(Array.from(singleText.text).slice(0,i).join(''),singleText.size)):undefined;
    const target:HighlightTarget={owner:{...owner},element,text:singleText?.text,positions};
    const backgrounds:DrawOp[]=marksFor(owner).filter(m=>m.element===element).flatMap(m=>{
      const left=m.fran!==undefined&&positions?positions[Math.min(m.fran,positions.length-1)]:0;
      const right=m.till!==undefined&&positions?positions[Math.min(m.till,positions.length-1)]:w;
      return right<=left?[]:[{kind:'rect' as const,x:x+left-1,y,w:right-left+2,h,color:highlightColors[m.farg],highlight:true}];
    });
    ops.splice(start,0,...backgrounds);
    if(editable)ops.push({kind:'highlight-hit',x,y,w:Math.max(2,w),h:Math.max(2,h),target,label:singleText?.text??kind});
  };
}
