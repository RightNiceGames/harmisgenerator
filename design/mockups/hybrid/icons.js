/* Small, local icon vocabulary. Musical/content choices keep their actual values. */
const iconPaths = {
 edit:'<path d="m15 4 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/>',
 variant:'<path d="M5 3v6c0 4 14 2 14 8v4M5 9v12M16 18l3 3 3-3"/><circle cx="5" cy="3" r="1"/>',
 add:'<path d="M12 5v14M5 12h14"/>', copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>', more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 left:'<path d="m14 5-7 7 7 7M7 12h14"/>', right:'<path d="m10 5 7 7-7 7M3 12h14"/>', up:'<path d="m5 12 7-7 7 7M12 5v16"/>', down:'<path d="m5 12 7 7 7-7M12 3v16"/>',
 music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
 form:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M14 6h4v8M10 18H6v-8"/>',
 song:'<path d="M14 2H5v20h14V7ZM14 2v5h5M8 12h8M8 16h5"/>', settings:'<path d="M5 3v18M12 3v18M19 3v18"/><path d="M2 7h6M9 16h6M16 9h6"/>',
 panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M7 9h3M7 13h3"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 undo:'<path d="m9 4-5 5 5 5M4 9h9a7 7 0 0 1 7 7v4"/>', redo:'<path d="m15 4 5 5-5 5M20 9h-9a7 7 0 0 0-7 7v4"/>',
 repeat:'<path d="M5 3v18M8 3v18M16 3v18M19 3v18"/><circle cx="11" cy="9" r=".7"/><circle cx="11" cy="15" r=".7"/><circle cx="13" cy="9" r=".7"/><circle cx="13" cy="15" r=".7"/>',
 start:'<path d="M5 3v18M9 3v18"/><circle cx="15" cy="9" r="1"/><circle cx="15" cy="15" r="1"/>', end:'<path d="M15 3v18M19 3v18"/><circle cx="9" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
 house:'<path d="M3 19V5h18v14"/>', parentheses:'<path d="M8 3c-6 5-6 13 0 18M16 3c6 5 6 13 0 18"/>',
 nc:'<path d="M3 18V6l7 12V6M21 7c-8-5-8 15 0 10"/>', rhythm:'<path d="M15 17V3l6 4M15 3v5l6 4"/><ellipse cx="11" cy="18" rx="4" ry="3"/>',
 row:'<path d="M20 4v8H4M9 7l-5 5 5 5M4 21h16"/>', page:'<path d="M6 2h12v7H6ZM6 15h12v7H6ZM2 12h20"/>', layout:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 changes:'<path d="M5 4v16M9 4v16M2 9h10M2 15h10M16 6h6M16 18h6M18 6l-2 6h6l-2 6"/>',
 range:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><path d="M7 12h10"/>',
 reuse:'<path d="m16 3 4 4-4 4M20 7H8a5 5 0 0 0-5 5M8 21l-4-4 4-4M4 17h12a5 5 0 0 0 5-5"/>',
 unlink:'<path d="m3 3 18 18M8 16l-2 2a3 3 0 0 1-4-4l4-4M16 8l2-2a3 3 0 0 1 4 4l-4 4M9 15l6-6"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 check:'<path d="m4 12 5 5L20 6"/>', clear:'<path d="m3 14 9-11 9 8-9 10H9ZM8 8l9 8M13 21h9"/>',
 trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>'
};
function actionIcon(action) {
 if(action.startsWith('variant-settings:'))return 'settings';
 if(action==='context:variant-rhythm'||action.startsWith('edit-rhythm:'))return 'rhythm';
 if(action.startsWith('variant-step:'))return action.endsWith(':-1')?'left':'right';
 if(action.startsWith('variant-up:'))return 'up';
 if(action.startsWith('variant-attack:'))return 'close';
 if(action==='close-context')return 'close';
 if(action==='toggle-panel')return innerWidth<761?'menu':'panel';
 if(action==='part-delete-confirm'||action==='context-delete-range')return 'trash';
 if(action.startsWith('variant-choice:'))return {keep:'check',remove:'clear',edit:'edit'}[action.split(':')[1]];
 if(action==='context-tool:insert')return 'changes';
 if(action.startsWith('chord-step:'))return action.endsWith(':-1')?'left':'right';
 if(action.startsWith('move:'))return action.endsWith(':-1')?'up':'down';
 if(action.startsWith('chord-up:'))return 'up';
 if(action.startsWith('attack:'))return 'close';
 if(/^(delete-|context-delete|reuse-remove|part-delete-confirm)/.test(action)||action==='context:delete-range')return 'close';
 if(action.includes('cancel')||action==='close-panel'||action==='part-rename-cancel')return 'close';
 if(action.includes('duplicate')||action.startsWith('context-copy-part:'))return 'copy';
 if(action==='context-parentheses')return 'parentheses';
 if(action==='nc')return 'nc';
 if(action==='context-clear-chords')return 'clear';
 if(action==='undo'||action==='redo'||action==='reset')return action;
 if(action.startsWith('goto-source:'))return 'eye';
 if(action==='detach-reuse')return 'unlink';
 if(action==='reuse'||action.startsWith('context-reuse:'))return 'reuse';
 if(action.includes('apply')||action==='part-rename-save'||action==='house-replace')return 'check';
 if(action==='house-cancel')return 'close';
 if(action.startsWith('rename-part:')||action==='context-edit'||action==='continue-edit')return 'edit';
 if(action.startsWith('range-'))return 'range';
 if(action.startsWith('repeat:'))return {both:'repeat',start:'start',end:'end'}[action.split(':')[1]];
 if(action==='context-remove-repeat'||action==='house-remove')return 'clear';
 if(action.startsWith('house:')||action.includes('house'))return 'house';
 if(action.startsWith('break:'))return {row:'row',page:'page',remove:'clear'}[action.split(':')[1]];
 if(action.includes('insert-bar')||action.startsWith('context-new-part:'))return 'add';
 const id=action.split(':').at(-1);
 return ({music:'music',form:'form',song:'song',settings:'settings',chord:'edit',insert:'add',rhythm:'rhythm',repeats:'repeat',layout:'layout',changes:'changes',order:'form',variant:'variant',add:'add','bar-more':'more','chord-more':'more','part-more':'more','reuse-more':'more','reuse-settings':'settings'})[id] || (action.startsWith('context:')?'left':'more');
}
function iconSVG(name,number='') {
 return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.more}${number?`<text x="12" y="16" fill="currentColor" stroke="none" text-anchor="middle" font-size="11" font-family="sans-serif">${number}</text>`:''}</svg>`;
}
function iconButtonHTML(text,action,kind='',attrs='') {
 const el=document.createElement('span');el.innerHTML=text;
 const small=el.querySelector('small'),description=small?.textContent;small?.remove();
 const supplied=attrs.match(/aria-label="([^"]+)"/),title=attrs.match(/title="([^"]+)"/);
 let label=supplied?.[1]||title?.[1]||esc(el.textContent.trim());
 const labels={'context:variant':'Variantackord','context:add':'Lägg till ackord','context:chord-more':'Fler ackordval','context:bar-more':'Fler taktval','context:part-more':'Fler val för delen','context:repeats':'Repris och hus','context:':'Tillbaka till snabbval','context-edit':'Skriv ackord','context-insert-bar':'Infoga tom takt efter markeringen','context-tool:insert':'Tonart och taktart','context:reuse-more':'Fler val för återanvändningen'};
 if(!supplied)label=labels[action]||label;
 const content=/^(recent:|block:|select-part:|context-select-reuse:|resolution:)/.test(action)||/^(attack:|variant-attack:)/.test(action)&&!text.startsWith('Ta bort')&&text!=='×';
 if(content)return `<button class="${kind}" data-action="${esc(action)}" ${attrs}>${text}</button>`;
 const unavailable=attrs.match(/data-unavailable="([^"]+)"/)?.[1];
 const number=/^(?:context-house:|house:)([12])$/.exec(action)?.[1];
 if(el.textContent.startsWith('Behåll'))label=esc(el.textContent);
 return `<button class="${kind} icon-button" data-action="${esc(action)}" ${attrs} ${supplied?'':`aria-label="${label}"`} data-tooltip="${label}${unavailable?' · '+unavailable:description?' · '+esc(description):''}">${iconSVG(el.textContent.startsWith('Behåll')?'left':actionIcon(action),number)}</button>`;
}
/* A single floating tooltip avoids clipping in the score and scrollable menus. */
let iconTooltip,iconTooltipTarget,hoverTimer;
function hideIconTooltip(){clearTimeout(hoverTimer);hoverTimer=null;iconTooltip?.remove();iconTooltip=null;if(iconTooltipTarget?.getAttribute('aria-describedby')==='icon-tooltip')iconTooltipTarget.removeAttribute('aria-describedby');iconTooltipTarget=null;}
function showIconTooltip(target){
 hideIconTooltip();if(!target?.dataset.tooltip)return;
 const tip=document.createElement('div');tip.className='icon-tooltip';tip.textContent=target.dataset.tooltip;tip.setAttribute('role','tooltip');tip.id='icon-tooltip';document.body.append(tip);iconTooltip=tip;
 target.setAttribute('aria-describedby',tip.id);iconTooltipTarget=target;
 const r=target.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+r.width/2-t.width/2))+'px';tip.style.top=(r.bottom+t.height+12<innerHeight?r.bottom+6:Math.max(8,r.top-t.height-6))+'px';
}
function queueIconHover(target){hideIconTooltip();if(target)hoverTimer=setTimeout(()=>{hoverTimer=null;if(target.isConnected&&target.matches(':hover'))showIconTooltip(target);},120);}
document.addEventListener('pointerover',e=>{if(e.pointerType==='mouse')queueIconHover(e.target.closest('[data-tooltip]'));});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-tooltip]')&&!e.target.closest('[data-tooltip]').contains(e.relatedTarget))hideIconTooltip();});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-tooltip]:focus-visible'))showIconTooltip(e.target);});
document.addEventListener('focusout',hideIconTooltip);
document.addEventListener('click',hideIconTooltip);
document.addEventListener('scroll',()=>{const active=document.activeElement;if(active?.matches('[data-tooltip]:focus-visible')){hideIconTooltip();hoverTimer=setTimeout(()=>{hoverTimer=null;if(active.isConnected&&active===document.activeElement&&active.matches(':focus-visible'))showIconTooltip(active);},40);}else queueIconHover(document.querySelector('[data-tooltip]:hover'));},true);
