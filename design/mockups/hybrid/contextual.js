/* Direct action rows. Each selection owns at most one parameter editor. */
let contextView = '', selectedReuse = null, contextReturnAction = '';
let chordRevealTimer=null,chordRevealGeneration=0,chordRevealPending=null;
function cancelChordReveal(){clearTimeout(chordRevealTimer);chordRevealTimer=null;chordRevealPending=null;chordRevealGeneration++;}
function queueChordReveal(keyboard=false){
 cancelChordReveal();const generation=chordRevealGeneration,id=selectedVariantId||chordId,variant=!!selectedVariantId,barId=selected[0];
 const reveal=()=>{if(generation!==chordRevealGeneration||draft||contextView||(selectedVariantId||chordId)!==id||selected.length!==1||selected[0]!==barId)return;const chord=$(variant?`[data-variant-chord="${id}"]`:`[data-chord="${id}"]`),tools=$('.flat-chord-tools'),scene=$('.scene');if(!tools||!scene)return;
  if(!keyboard&&matchMedia('(hover: hover)').matches&&chord?.matches(':hover')){chordRevealPending={generation,id,variant,reveal};return;}
  const rect=tools.getBoundingClientRect(),bounds=scene.getBoundingClientRect();if(rect.bottom>bounds.bottom-8||rect.top<bounds.top)tools.scrollIntoView({block:'nearest',inline:'nearest'});
 };
 if(keyboard)reveal();else chordRevealTimer=setTimeout(reveal,650);
}
for(const event of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(event,cancelChordReveal,{capture:true,passive:true});
document.addEventListener('pointermove',e=>{const pending=chordRevealPending;if(pending&&pending.generation===chordRevealGeneration&&e.target.closest(pending.variant?'[data-variant-chord]':'[data-chord]')?.getAttribute(pending.variant?'data-variant-chord':'data-chord')!==String(pending.id)){chordRevealPending=null;chordRevealTimer=setTimeout(pending.reveal,100);}},{passive:true});
function resetContext() { contextView = ''; selectedReuse = null; selectedVariantId=null;variantOwnerId=null; contextReturnAction=''; }
function singleBar() { return !selectedPart && !selectedReuse && selected.length === 1 ? selectedBar() : null; }
function needSingleBar() { if (singleBar()) return true; fail('Markera ett ackord eller en enda takt för det här verktyget.'); return false; }
function contextButton(text, action, extra = '') { return btn(text, action, 'context-button', extra); }
function contextToggle(text, view, extra='') { return contextButton(text, 'context:' + view, `aria-expanded="${contextView === view}" ${extra}`); }
function contextHeading(title, hint = '') { return `<div class="context-caption"><strong>${esc(title)}</strong>${hint ? `<span>${esc(hint)}<span class="strip-scroll-hint" aria-hidden="true">${innerWidth<761?'↔ Svep':'↔ Rulla'}</span></span>` : ''}</div>`; }
function contextFeedback() {
 const conflict = pendingHouse ? `<div class="context-warning" role="alert"><strong>Husen överlappar</strong><p>Nytt hus ${esc(pendingHouse.number)} över ${selected.length} takter. Det befintliga husets hela spann ersätts.</p>${pendingHouse.spans.map(s => `<p>Hus ${esc(s.number)}: takt ${numberOf(s.barIds[0])}–${numberOf(s.barIds.at(-1))}</p>`).join('')}${contextButton('Ersätt befintligt hus', 'house-replace')}${contextButton('Behåll befintligt hus', 'house-cancel')}</div>` : '';
 return conflict + (error ? `<div class="context-warning" role="alert">${esc(error)}</div>` : '');
}
function panelToggleHTML(){const mobile=innerWidth<761,on=mobile?panelOpen:!panelCollapsed;return btn(mobile?(on?'Stäng menyn':'Öppna menyn'):(on?'Fäll in menykolumn':'Visa menykolumn'),'toggle-panel','panel-toggle',`aria-expanded="${on}" aria-controls="editor-panel"`);}
function selectionContiguous(){if(!selected.length)return false;const bars=sectionOf(selected[0]).bars,indices=selected.map(id=>bars.findIndex(b=>b.id===id));return indices.every((n,i)=>!i||n===indices[i-1]+1);}
function selectionNumbers(){return selected.map(numberOf).join(', ');}
function canCheckBar(b){return !draft&&!selectedPart&&!selectedReuse&&(!selected.length||sectionOf(selected[0]).id===sectionOf(b.id).id);}
function barCheckHTML(b){return canCheckBar(b)?`<label class="bar-check" title="${selected.includes(b.id)?'Avmarkera':'Markera'} takt ${numberOf(b.id)}"><input id="bar-check-${b.id}" type="checkbox" data-bar-check="${b.id}" aria-label="${selected.includes(b.id)?'Avmarkera':'Markera'} takt ${numberOf(b.id)}" ${selected.includes(b.id)?'checked':''}></label>`:'';}
function toggleCheckedBar(id,on){
 if(!commitRename()||!commitDraft(false))return;
 if(selected.length&&sectionOf(selected[0]).id!==sectionOf(id).id)return;
 resetContext();selectedPart=null;chordId=null;rangeAnchor=null;pendingHouse=null;error='';
 const ids=new Set(selected);if(on)ids.add(id);else ids.delete(id);
 selected=sectionOf(id).bars.filter(b=>ids.has(b.id)).map(b=>b.id);message=selected.length?selected.length+' takter markerade.':'Markeringen avbröts.';render();
}
function actionGroup(contents){return `<div class="action-group">${contents}</div>`;}
function barCornerActions(b){
 if(selectedPart||selectedReuse||draft||!selected.length||b.id!==selected.at(-1))return '';
 const many=selected.length>1,first=selectedBar(),contiguous=selectionContiguous(),hasRepeat=selected.some(id=>barById(id).repeatStart||barById(id).repeatEnd),hasHouse=visibleBars().some(v=>v.houseSpan?.barIds.some(id=>selected.includes(id)));
 const scope=many?(contiguous?'Takt '+numberOf(first.id)+'–'+numberOf(b.id):selected.length+' takter · '+selectionNumbers()):'Takt '+numberOf(b.id);
 const spanAttrs=contiguous?'':'disabled data-unavailable="Markera sammanhängande takter"';
 const row=actionGroup(contextButton('Ny tom takt efter markeringen','context-insert-bar')+contextButton(many?'Duplicera valda takter':'Duplicera takten',many?'duplicate-bars':'duplicate-bar:'+b.id)+contextButton(many?'Ta bort valda takter':'Ta bort takten',many?'context:delete-range':'delete-bar:'+b.id,`aria-label="${many?'Ta bort '+selected.length+' valda takter':sectionOf(b.id).bars.length===1?'Töm sista takten':'Ta bort takt '+numberOf(b.id)}"`)+contextButton('Töm ackordraden','context-clear-chords',selected.some(id=>barById(id).chords.length)?'':'disabled'))+
 actionGroup(contextToggle('Rytm','rhythm',many?'disabled data-unavailable="Välj en enda takt"':'')+contextToggle('Tonart och taktart','changes',many?'disabled data-unavailable="Välj en enda takt"':''))+
 actionGroup(contextButton('Repris runt markeringen','repeat:both',spanAttrs)+contextButton('Reprisstart i första valda takten','repeat:start',`aria-pressed="${first.repeatStart}"`)+contextButton('Reprisslut i sista valda takten','repeat:end',`aria-pressed="${b.repeatEnd}"`)+(hasRepeat?contextButton('Ta bort repris','context-remove-repeat'):''))+
 actionGroup(contextButton('Första hus','context-house:1',spanAttrs)+contextButton('Andra hus','context-house:2',spanAttrs)+contextToggle('Eget husnummer','house-number',spanAttrs)+(hasHouse?contextButton('Ta bort hus','house-remove'):''))+
 actionGroup(contextButton('Ny rad före första valda takten','break:row',`aria-pressed="${first.rowBreak}"`)+contextButton('Ny sida före första valda takten','break:page',`aria-pressed="${first.pageBreak}"`)+(first.rowBreak||first.pageBreak?contextButton('Ta bort brytning','break:remove'):''));
 return `<div class="bar-corner-actions flat-bar-tools" role="group" aria-label="Taktverktyg för ${esc(scope)}">${contextHeading(scope,'Takter')}<div class="action-strip" data-strip="bar">${row}</div>${innerWidth>760&&(['rhythm','changes','house-number','delete-range'].includes(contextView)||(!chordId&&(pendingHouse||error)))?`<div class="context-body parameter-body">${contextParameterBody()}${contextFeedback()}</div>`:''}</div>`;
}
function parameterHeading(title){return `<div class="context-subheading"><h3>${esc(title)}</h3>${contextButton('Stäng parametrar','close-context')}</div>`;}
function contextChordBody(b,c){
 if(contextView==='variant')return variantParamsHTML(c);
 if(contextView==='add')return `${parameterHeading('Lägg till efter '+c.name)}<div class="chips">${model.recent.map(n=>contextButton(esc(n),'recent:'+n,(currentVariant()?c.variantChords.length:b.chords.length)>=4?'disabled':'')).join('')}</div>${b.chords.length>=4?'<p class="hint">Takten har redan fyra ackord.</p>':''}`;
 if(contextView==='order')return currentVariant()?variantOrderHTML(b,c):`${parameterHeading('Ordning och startpunkter')}${resolutionHTML()}${changeStartsHTML(b)}`;
 return '';
}
function chordTools(b){
 const owner=b.chords.find(c=>c.id===chordId),variant=currentVariant(),c=variant||owner;if(!c||draft||selectedPart||selected[0]!==b.id)return '';
 const left=variant?variantNextPosition(b,owner,c,-1):nextChordPosition(b,c,-1),right=variant?variantNextPosition(b,owner,c,1):nextChordPosition(b,c,1),move=variant?'variant-step:':'chord-step:';
 return `<div class="chord-tools context-tools flat-chord-tools" role="group" aria-label="Ackordverktyg för ${esc(c.name)}">${contextHeading((variant?'Variant '+c.name:c.name)+' · takt '+numberOf(b.id),'Slag '+beatLabel(c.start))}<div class="action-strip" data-strip="chord">${actionGroup(contextButton('Flytta '+c.name+' åt vänster',move+c.id+':-1',left==null?'disabled':'')+contextButton('Flytta '+c.name+' åt höger',move+c.id+':1',right==null?'disabled':'')+`<select data-chord-grid aria-label="Notvärde för ackordets placeringssteg">${[4,8,16].map(n=>`<option value="${n}" ${n===resolution?'selected':''}>1/${n}</option>`).join('')}</select>`)}${actionGroup(contextButton('Skriv ackord','context-edit')+contextToggle(variant?'Variantens spelomgång':'Variantackord','variant')+(variant?contextToggle('Rytm för hela variantraden '+owner.variant,'variant-rhythm'):'')+contextToggle('Lägg till ackord','add'))}${actionGroup(contextButton(c.parenthetical?'Ta bort parentes':'Inom parentes','context-parentheses',`aria-pressed="${c.parenthetical}"`)+contextButton('N.C. i stället för '+c.name,'nc')+contextToggle('Ordning och startpunkter','order')+contextButton('Ta bort '+c.name,'context-delete-chord'))}</div>${innerWidth>760&&['variant','add','order','variant-rhythm'].includes(contextView)?`<div class="context-body parameter-body">${contextView==='variant-rhythm'?rhythmParameterHTML(true):contextChordBody(b,owner)}</div>`:''}${!['rhythm','changes','house-number','delete-range'].includes(contextView)&&!pendingHouse?contextFeedback():''}</div>`;
}
function rhythmParameterHTML(variant=false){
 const b=singleBar();if(!b)return '';const c=variant?variantOwner():null,attacks=variant?(c.variantAttacks||[]):b.attacks,action=variant?'variant-attack:':'attack:';
 return `${parameterHeading(variant?'Variantens rytm · '+variantPassLabel(c):'Rytm i takt '+numberOf(b.id))}${variant?`<p class="variant-rhythm-scope">${esc(c.variant)} · i stället för ${esc(c.name)}</p>`:''}${resolutionHTML()}<div class="beat-grid" style="--beats:${meterUnits(b)}">${Array.from({length:meterUnits(b)},(_,beat)=>`<div class="beat-group"><span>${beat+1}</span>${positions(b).filter(n=>Math.floor(n)===beat+1).map(n=>btn(beatLabel(n),action+n,attacks.some(a=>a.start===n)?'on':'',`aria-label="${variant?'Variantens anslag':'Anslag'} på ${beatLabel(n)}" aria-pressed="${attacks.some(a=>a.start===n)}" ${variant&&(n<c.start||n>=variantEnd(b,c))?'disabled':''}`)).join('')}</div>`).join('')}</div><div class="attacks">${[...attacks].sort((a,z)=>a.start-z.start).map(a=>`<div class="beat-row"><span>Slag ${beatLabel(a.start)}</span><select ${variant?'data-variant-duration':'data-duration'}="${a.start}" aria-label="Notvärde för ${variant?'variantens ':''}anslag ${beatLabel(a.start)}">${[4,8,16].map(n=>`<option value="${n}" ${a.duration===n?'selected':''}>1/${n}</option>`).join('')}</select>${contextButton('Ta bort anslag '+beatLabel(a.start),action+a.start)}</div>`).join('')}</div><p class="hint rhythm-hint">Klicka på slag för att lägga till eller ta bort anslag. Notvärdet anger längden.</p>`;
}

function contextParameterBody(){
 if(contextView==='variant-rhythm')return rhythmParameterHTML(true);
 if(['variant','add','order'].includes(contextView)){const b=singleBar(),c=currentChord();return b&&c?contextChordBody(b,c):'';}
 if(contextView==='rhythm')return rhythmParameterHTML();
 if(contextView==='changes')return `${parameterHeading('Tonart och taktart')}${localChangesHTML().replace('<h3>Byten i markerad takt</h3>','')}`;
 if(contextView==='house-number')return `${parameterHeading('Eget husnummer')}${field('Husnummer','context-house-number','1, 2')}${contextButton('Lägg till hus','context-house-apply')}`;
 if(contextView==='delete-range')return `${parameterHeading('Ta bort '+selected.length+' valda takter?')}<p class="hint">Ackord och markeringar i de valda takterna tas bort. En tom takt behålls om hela delen väljs. Ångra återställer allt.</p><div class="row">${contextButton('Behåll takterna','close-context')}${contextButton('Ta bort valda takter','context-delete-range')}</div>`;
 if(contextView==='reuse-settings'){const block=selectedForm();return `${parameterHeading('Återanvänd '+sectionById(block.source).name)}<div class="reuse-fields">${field('Gånger','context-reuse-count',block.count,'type="number" min="1" max="16"')}${field('Anvisning','context-reuse-instruction',block.instruction,'placeholder="Instrumentalt"')}</div>${contextButton('Använd inställningar','context-reuse-apply')}`;}
 return '';
}
function contextPopupHTML(){const scope=['rhythm','changes','house-number','delete-range'].includes(contextView)?selectionText().replace(/ · variant .*/, ''):selectionText();return innerWidth<761&&contextView?`<dialog id="context-popup" class="context-popup" aria-label="Parametrar för ${esc(scope)}"><p class="popup-scope">${esc(scope)}</p><div class="context-tools popup-parameters">${contextParameterBody()}${contextFeedback()}</div></dialog>`:'';}

function positionChordTools() {
 for(const row of document.querySelectorAll('.score-row')){const bars=[...row.querySelectorAll('.bar')],base=(innerWidth<761?103:85)+(bars.some(el=>barById(el.dataset.bar).attacks.length)?32:0)+(bars.some(el=>barById(el.dataset.bar).key||barById(el.dataset.bar).meter)?10:0);row.style.setProperty('--measure-height',base+'px');let needed=base;for(const stack of row.querySelectorAll('.variant-stack'))if(stack.children.length)needed=Math.max(needed,base+(innerWidth<761?44:24)+stack.scrollHeight);row.style.setProperty('--bar-needed-height',needed+'px');row.style.removeProperty('margin-bottom');}
 for(const line of document.querySelectorAll('.rhythm-notation')){const notes=[...line.querySelectorAll('.rhythm-attack')];notes.forEach((note,i)=>{const gap=notes[i+1]?notes[i+1].offsetLeft-note.offsetLeft:line.clientWidth-note.offsetLeft;note.querySelector('.rhythm-note').style.width=(note.classList.contains('is-beamed')?8:Math.max(8,Math.min(21,gap-2)))+'px';});}
 const scene = $('.scene'); if (!scene) return;
 const bounds = scene.getBoundingClientRect();
 for(const tools of document.querySelectorAll('.flat-bar-tools,.flat-chord-tools')){
  const bar=tools.closest('.bar'),rect=bar.getBoundingClientRect(),row=bar.closest('.score-row'),body=tools.querySelector('.context-body'),rowRect=row.getBoundingClientRect();
  const available=Math.min(rowRect.width,bounds.width-20),desired=tools.classList.contains('flat-bar-tools')?590:410;
  tools.style.width=Math.min(desired,available)+'px';
  const width=tools.getBoundingClientRect().width,anchor=tools.classList.contains('flat-bar-tools')?rect.right-width:rect.left;
  tools.style.left=(Math.max(rowRect.left,Math.min(anchor,rowRect.right-width))-rect.left)+'px';tools.style.right='auto';const strip=tools.querySelector('.action-strip');tools.classList.toggle('strip-overflow',strip.scrollWidth>strip.clientWidth+1);
  if(body)body.style.maxHeight=Math.max(110,Math.min(360,scene.clientHeight-100))+'px';
  if(tools.classList.contains('flat-bar-tools')){
   tools.style.top=-(tools.querySelector('.context-caption').offsetHeight+tools.querySelector('.action-strip').offsetHeight+22)+'px';tools.style.bottom='auto';
   if(body){const chordCard=bar.querySelector('.flat-chord-tools'),chordHeight=chordCard?.offsetHeight||0,bodyWidth=Math.min(350,available);body.style.width=bodyWidth+'px';body.style.maxWidth='none';body.style.left=(Math.max(rowRect.left,Math.min(rect.left,rowRect.right-bodyWidth))-rect.left-Number.parseFloat(tools.style.left))+'px';body.style.top=(rect.height-Number.parseFloat(tools.style.top)+chordHeight+(chordCard?18:8))+'px';tools.style.zIndex='9';row.style.marginBottom=Math.max(Number.parseFloat(row.style.marginBottom)||0,chordHeight+body.offsetHeight+40)+'px';}
  }else row.style.marginBottom=Math.max(Number.parseFloat(row.style.marginBottom)||0,tools.offsetHeight+24)+'px';
 }

}
function revealContext(){const node=$('.context-body')||$('.flat-chord-tools')||$('.flat-bar-tools')||(selectedReuse?$(`[data-score-block="${selectedReuse}"] .section-context`):$('.part-selected .section-context'));node?.scrollIntoView({block:'nearest',inline:'nearest'});}
function blockMovesHTML(block) {
 const i = model.form.indexOf(block);
 return `${btn('↑', 'move:' + block.id + ':-1', 'context-move', `aria-label="Flytta ${esc(sectionById(block.source).name)} upp i formen" ${i === 0 ? 'disabled' : ''}`)}${btn('↓', 'move:' + block.id + ':1', 'context-move', `aria-label="Flytta ${esc(sectionById(block.source).name)} ner i formen" ${i === model.form.length - 1 ? 'disabled' : ''}`)}`;
}
function partActionsHTML(s,block){
 if(selectedPart!==s.id||renameState)return '';
 return `<div class="part-actions action-strip" data-strip="part" role="group" aria-label="Verktyg för delen ${esc(s.name)}">${btn('Ändra titel','rename-part:'+s.id,'outline')}${btn('Återanvänd','context-reuse:'+s.id,'outline')}${blockMovesHTML(block)}${contextButton('Duplicera del','context-copy-part:'+s.id)}${contextButton('Ny del efter '+s.name,'context-new-part:'+s.id)}${btn('Ta bort delen','delete-part:'+s.id,'part-delete',`aria-label="Ta bort delen ${esc(s.name)}"`)}</div>`;
}
function reuseScoreHTML(block,s){
 const on=selectedReuse===block.id;
 return `<div class="reuse-score ${on?'reuse-selected':''}" data-score-block="${block.id}">${btn(esc(s.name)+' × '+block.count,'context-select-reuse:'+block.id,'reuse-name',`aria-pressed="${on}"`)}<p>Återanvänd del · följer originalets ackord${block.instruction?' · '+esc(block.instruction):''}</p>${on?`<div class="reuse-actions action-strip" data-strip="reuse" role="group" aria-label="Verktyg för återanvändningen">${contextToggle('Inställningar','reuse-settings')}${contextButton('Visa original','goto-source:'+s.id)}${blockMovesHTML(block)}${contextButton('Gör till egen del','detach-reuse')}${contextButton('Ta bort återanvändning','reuse-remove')}</div>${innerWidth>760&&contextView==='reuse-settings'?`<div class="section-context">${contextParameterBody()}</div>`:''}${error?`<p class="context-warning" role="alert">${esc(error)}</p>`:''}`:''}</div>`;
}
function requestContextHouse(value) {
 if(!selectionContiguous()){fail('Markera sammanhängande takter för att lägga till ett hus.');return;}
 if (!/^\d+(?:\s*,\s*\d+)*$/.test(value)) { fail('Skriv husnummer, till exempel 1 eller 1, 2.'); renderScore(); return; }
 const overlaps = visibleBars().filter(b => b.houseSpan?.barIds.some(id => selected.includes(id)));
 if (overlaps.some(b => JSON.stringify(b.houseSpan.barIds) !== JSON.stringify(selected))) { pendingHouse = {number:value, spans:overlaps.map(b => clone(b.houseSpan))}; render();revealContext();return; }
 contextView = ''; applyHouse(value);
}
function copyPart(id, empty = false) {
 const source = sectionById(id), original = model.form.find(f => f.source === id && !f.reuse), copy = empty ? {id:'part' + (++uid),name:'Ny del',bars:Array.from({length:4},() => makeBar([]))} : clone(source);
 if (!empty) {
  copy.id = 'part' + (++uid); const ids = new Map();
  copy.entryMeter = meterFor(source.bars[0]);
  copy.bars.forEach(b => {const previous=b.id;b.id=++uid;ids.set(previous,b.id);copyChordIdentities(b);});
  copy.bars.forEach(b => {if(b.houseSpan)b.houseSpan.barIds=b.houseSpan.barIds.map(id=>ids.get(id));});
  if (!copy.bars[0].meter) copy.bars[0].meter = copy.entryMeter;
  copy.name = source.name + ' · kopia';
 }
 const base = copy.name; let n = 2; while (model.sections.some(s => s.name === copy.name)) copy.name = base + ' ' + n++;
 const block = {id:'f' + (++uid), source:copy.id, count:empty ? 1 : original.count, instruction:empty ? '' : original.instruction};
 mutate(() => {model.sections.push(copy);model.form.splice(model.form.indexOf(original)+1,0,block);selectedPart=copy.id;selectedBlock=block.id;selected=copy.bars.map(b=>b.id);chordId=null;resetContext();},empty?'En ny del med fyra tomma takter infogades.':'Delen kopierades. Musikändringar i kopian påverkar inte originalet.');
 $('#section-' + copy.id)?.scrollIntoView({block:'nearest'});
}
function contextualReuse(id) {
 const source = sectionById(id), original = model.form.find(f => f.source === id && !f.reuse), block = {id:'reuse'+(++uid),source:id,reuse:true,count:1,instruction:''};
 mutate(() => {source.entryMeter=meterFor(source.bars[0]);if(!source.bars[0].meter)source.bars[0].meter=source.entryMeter;model.form.push(block);selectedBlock=block.id;selectedReuse=block.id;selectedPart=null;selected=[];chordId=null;contextView='reuse-settings';},'En länkad återanvändning lades sist i formen. Flyttpilarna ändrar dess plats.');
 const element=$(`[data-score-block="${block.id}"]`);element?.scrollIntoView({block:'nearest'});
 $('#context-reuse-count')?.focus({preventScroll:true});
}
function deleteRange() {
 const ids=[...selected], previous=clone(model), depth=past.length;
 contextView='';for(const id of ids)deleteBar(id);
 past.splice(depth,past.length-depth,previous);future=[];message=ids.length+' takter togs bort. Ångra återställer hela spannet.';render();
}
function insertContextBar(){
 if(!needBar()||selectedPart)return;
 const section=sectionOf(selected[0]),index=section.bars.findIndex(b=>b.id===selected.at(-1)),bar=makeBar([]);
 mutate(()=>{const spans=section.bars.filter(b=>b.houseSpan).map(b=>({owner:b,first:b.houseSpan.barIds[0],last:b.houseSpan.barIds.at(-1)}));section.bars.splice(index+1,0,bar);for(const span of spans){const first=section.bars.findIndex(b=>b.id===span.first),last=section.bars.findIndex(b=>b.id===span.last);span.owner.houseSpan.barIds=section.bars.slice(first,last+1).map(b=>b.id);span.owner.houseSpan.length=span.owner.houseSpan.barIds.length;}selected=[bar.id];chordId=null;contextView='';},'En tom takt infogades efter markeringen. Skriv ackorden direkt.');
 beginEdit(bar.id,null);
}
function handleContextAction(action) {
 if(action==='close-context'){const target=contextReturnAction;contextView='';render();if(target)$('[data-action="'+target+'"]')?.focus({preventScroll:true});return true;}
 if(action?.startsWith('context:')){
  const view=action.slice(8);
  if(['rhythm','variant-rhythm','changes','variant','add','order'].includes(view)&&!needSingleBar())return true;
  if(view==='house-number'&&!selectionContiguous()){fail('Markera sammanhängande takter för att lägga till ett hus.');return true;}
  contextView=contextView===view?'':view;contextReturnAction='context:'+view;error='';render();if(contextView&&innerWidth>760)revealContext();
  const focus={'variant':'#context-variant-pass','house-number':'#context-house-number','changes':'#local-key','reuse-settings':'#context-reuse-count'}[view];if(contextView&&focus)$(focus)?.focus({preventScroll:true});return true;
 }
 if (action==='context-insert-bar'){insertContextBar();return true;}
 if (action==='context-edit') {if(needSingleBar())beginEdit(selected[0],null);return true;}
 if (action==='context-parentheses') {const c=currentChord();if(c)mutate(()=>c.parenthetical=!c.parenthetical,'Parentesen uppdaterades för '+c.name+'.');return true;}
 if (action==='context-delete-chord') {const b=singleBar(),c=currentChord();if(b&&c)mutate(()=>{b.chords=b.chords.filter(v=>v.id!==c.id);chordId=b.chords[0]?.id||null;contextView='';},'Ackordet togs bort. Rytm och takttecken är kvar.');return true;}
 if(action==='context-clear-chords'){if(needBar())mutate(()=>{selected.forEach(id=>barById(id).chords=[]);chordId=null;contextView='';},'Ackordraderna tömdes. Rytm och takttecken är kvar.');return true;}
 if (action==='context-remove-repeat') {mutate(()=>selected.forEach(id=>{const b=barById(id);b.repeatStart=false;b.repeatEnd=false;}),'Repristecknen i markeringen togs bort.');return true;}
 if (action?.startsWith('context-house:')) {requestContextHouse(action.slice(14));return true;}
 if (action==='context-house-apply') {requestContextHouse($('#context-house-number').value.trim());return true;}
 if (action==='context-delete-range') {deleteRange();return true;}
 if (action?.startsWith('context-copy-part:')) {copyPart(action.slice(18));return true;}
 if (action?.startsWith('context-new-part:')) {copyPart(action.slice(17),true);return true;}
 if (action?.startsWith('context-reuse:')) {contextualReuse(action.slice(14));return true;}
 if (action?.startsWith('context-select-reuse:')) {selectedReuse=action.slice(21);selectedBlock=selectedReuse;selectedPart=null;selected=[];chordId=null;contextView='';panelOpen=false;error='';render();return true;}
 if (action==='context-reuse-apply') {
  const block=selectedForm(),count=Number($('#context-reuse-count').value),instruction=$('#context-reuse-instruction').value.trim();
  if(!Number.isInteger(count)||count<1||count>16){fail('Välj ett heltal mellan 1 och 16.');renderScore();return true;}
  mutate(()=>{block.count=count;block.instruction=instruction;},'Återanvändningens inställningar uppdaterades.');return true;
 }
 return false;
}

function captureStripScroll(){return Object.fromEntries([...document.querySelectorAll('[data-strip]')].map(el=>[el.dataset.strip,el.scrollLeft]));}
function restoreStripScroll(saved){for(const el of document.querySelectorAll('[data-strip]'))if(saved[el.dataset.strip]!==undefined)el.scrollLeft=saved[el.dataset.strip];}
