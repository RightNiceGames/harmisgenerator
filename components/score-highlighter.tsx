'use client';
import { useEffect, useRef, useState, type RefObject, type PointerEvent, type KeyboardEvent } from 'react';
import { Highlighter, Eraser, X } from 'lucide-react';
import { highlightColors, highlightNames, type HighlightColor, type HighlightTarget } from '@/lib/highlight';
import { ScoreButton } from './score-button';

type Props={root:RefObject<HTMLDivElement|null>;pages:string[];disabled:boolean;begin:()=>boolean;apply:(target:HighlightTarget,color:HighlightColor|null,range?:{fran:number;till:number})=>void};
export function useScoreHighlighter({root,pages,disabled,begin,apply}:Props){
  const [active,setActive]=useState(false),[color,setColor]=useState<HighlightColor|null>('gul');
  const [preview,setPreview]=useState<{left:number;top:number;width:number;height:number}|null>(null);
  const keyboardTarget=useRef<string|null>(null);
  const drag=useRef<{target:HighlightTarget;rect:DOMRect;start:number;pointer:number}|null>(null);
  useEffect(()=>{const el=root.current;if(!el)return;el.querySelectorAll('[role="button"]').forEach(target=>target.setAttribute('tabindex',target.classList.contains('highlight-hit')?(active?'0':'-1'):(active?'-1':'0')));if(active&&keyboardTarget.current){const target=[...el.querySelectorAll<SVGElement>('.highlight-hit')].find(node=>node.dataset.highlightTarget===keyboardTarget.current);target?.focus({preventScroll:true});keyboardTarget.current=null;}},[active,pages,root]);
  const finish=()=>{drag.current=null;setPreview(null);};
  useEffect(()=>{if(!active)return;const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('.live-view,.help-dialog,.setlist-dialog[open]')){event.preventDefault();drag.current=null;setPreview(null);setActive(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[active]);
  const indexAt=(clientX:number,rect:DOMRect,positions:number[])=>{
    const x=(clientX-rect.left)/rect.width*positions.at(-1)!;
    return positions.reduce((best,value,i)=>Math.abs(value-x)<Math.abs(positions[best]-x)?i:best,0);
  };
  const onPointerDownCapture=(e:PointerEvent<HTMLDivElement>)=>{
    if(!active||disabled||!(e.target instanceof Element))return;
    const el=e.target.closest<SVGElement>('.highlight-hit');if(!el)return;
    e.preventDefault();e.stopPropagation();
    drag.current={target:JSON.parse(el.dataset.highlightTarget!),rect:el.getBoundingClientRect(),start:e.clientX,pointer:e.pointerId};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMoveCapture=(e:PointerEvent<HTMLDivElement>)=>{
    const d=drag.current;if(!d)return;
    const left=Math.max(d.rect.left,Math.min(d.start,e.clientX)),right=Math.min(d.rect.right,Math.max(d.start,e.clientX));
    setPreview({left,top:d.rect.top,width:Math.max(1,right-left),height:d.rect.height});
  };
  const onPointerUpCapture=(e:PointerEvent<HTMLDivElement>)=>{
    const d=drag.current;if(!d||d.pointer!==e.pointerId)return;
    e.preventDefault();e.stopPropagation();finish();
    if(disabled)return;
    const positions=d.target.positions;
    if(color&&positions&&Math.abs(d.start-e.clientX)>4){
      const a=indexAt(d.start,d.rect,positions),b=indexAt(e.clientX,d.rect,positions);
      const fran=Math.min(a,b,positions.length-2),till=Math.max(fran+1,a,b);
      apply(d.target,color,{fran,till});
    }else apply(d.target,color,color&&positions?{fran:0,till:positions.length-1}:undefined);
  };
  const onKeyDownCapture=(e:KeyboardEvent<HTMLDivElement>)=>{
    if(!active)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish();setActive(false);return;}
    if(disabled||!(e.target instanceof SVGElement)||!e.target.classList.contains('highlight-hit')||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopPropagation();keyboardTarget.current=e.target.dataset.highlightTarget!;const target=JSON.parse(e.target.dataset.highlightTarget!) as HighlightTarget;apply(target,color,color&&target.positions?{fran:0,till:target.positions.length-1}:undefined);
  };
  const controls=<div className={`score-pen ${active?'pen-open':''}`} role="group" aria-label="Färgmarkering">
    <ScoreButton label="Markeringspenna" active={active} disabled={disabled} onClick={()=>{if(active){finish();setActive(false);}else if(begin())setActive(true);}}><Highlighter/></ScoreButton>
    {active&&<>
      {(Object.keys(highlightColors) as HighlightColor[]).map(value=><button key={value} className="pen-color" style={{'--mark-color':highlightColors[value]} as React.CSSProperties} aria-label={highlightNames[value]+' markeringspenna'} title={highlightNames[value]} aria-pressed={color===value} onClick={()=>setColor(value)}/>)}
      <ScoreButton label="Sudda färgmarkering" active={color===null} onClick={()=>setColor(null)}><Eraser/></ScoreButton>
      <ScoreButton label="Avsluta färgmarkering" onClick={()=>{finish();setActive(false);}}><X/></ScoreButton>
      <span className="pen-hint">{color?'Klicka på ett element eller dra över text.':'Klicka på elementet för att sudda färgen.'}</span>
    </>}
    {preview&&<div className="pen-preview" style={{...preview,background:color?highlightColors[color]:'#ddd'}}/>}
  </div>;
  return {active,controls,handlers:{onPointerDownCapture,onPointerMoveCapture,onPointerUpCapture,onPointerCancel:finish,onKeyDownCapture}};
}
