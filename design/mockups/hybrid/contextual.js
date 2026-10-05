/* Contextual controls for the isolated prototype. The selection owns one open group. */
let contextView = '', selectedReuse = null, contextVariantDraft = null;
function resetContext() { contextView = ''; selectedReuse = null; contextVariantDraft = null; }
function singleBar() { return !selectedPart && !selectedReuse && selected.length === 1 ? selectedBar() : null; }
function needSingleBar() { if (singleBar()) return true; fail('Markera ett ackord eller en enda takt för det här verktyget.'); return false; }
function contextButton(text, action, extra = '') { return btn(text, action, 'context-button', extra); }
function contextToggle(text, view) { return contextButton(text, 'context:' + view, `aria-expanded="${contextView === view}"`); }
function contextHeading(title, hint = '') { return `<div class="context-caption"><strong>${esc(title)}</strong>${hint ? `<span>${esc(hint)}</span>` : ''}</div>`; }
function contextBack(view = '') { return btn('← Tillbaka', 'context:' + view, 'context-back', 'aria-label="Tillbaka till ' + (view === 'repeats' ? 'Repris & hus' : 'snabbval') + '"'); }
function contextFeedback() {
 const conflict = pendingHouse ? `<div class="context-warning" role="alert"><strong>Husen överlappar</strong><p>Nytt hus ${esc(pendingHouse.number)} över ${selected.length} takter. Det befintliga husets hela spann ersätts.</p>${pendingHouse.spans.map(s => `<p>Hus ${esc(s.number)}: takt ${numberOf(s.barIds[0])}–${numberOf(s.barIds.at(-1))}</p>`).join('')}${contextButton('Ersätt befintligt hus', 'house-replace')}${contextButton('Behåll befintligt hus', 'house-cancel')}</div>` : '';
 return conflict + (error ? `<div class="context-warning" role="alert">${esc(error)}</div>` : '');
}
function compactVariantFields(c, prefix = '') {
 const d = prefix && contextVariantDraft?.id === c?.id ? contextVariantDraft : {value:c?.variant || '', pass:c?.variantPass || 2, following:!!c?.variantFollowing};
 const disabled=c?'':'disabled';
 return `<div class="variant-fields"><div class="variant-line">${field('Ackord',prefix+'variant',d.value,`placeholder="G Am" autocomplete="off" ${disabled}`)}${field('Spelas gång',prefix+'variant-pass',d.pass,`type="number" min="2" max="16" ${disabled}`)}</div><label class="variant-follow row"><input id="${prefix}variant-following" type="checkbox" ${d.following?'checked':''} ${disabled}> Även följande gånger</label><p id="${prefix}variant-feedback" class="hint variant-feedback" role="status">${esc(variantError || (c?.variant ? variantLabel(c) : 'Uppdateras direkt · mellanslag mellan ackord'))}</p></div>`;
}
function contextVariantHTML(c) {
 return `<div class="context-subheading">${contextBack()}<h3>Variant till ${esc(c.name)}</h3></div>${compactVariantFields(c,'context-')}`;
}
function panelToggleHTML(){const mobile=innerWidth<761,on=mobile?panelOpen:!panelCollapsed;return btn(mobile?(on?'Stäng menyn':'Öppna menyn'):(on?'Fäll in menykolumn':'Visa menykolumn'),'toggle-panel','panel-toggle',`aria-expanded="${on}" aria-controls="editor-panel"`);}
function barCornerActions(b){
 if(selectedPart||selectedReuse||draft||selected.length!==1||selected[0]!==b.id||rangeAnchor!==null)return '';
 return `<div class="bar-corner-actions" role="group" aria-label="Takt ${numberOf(b.id)}">${btn('Duplicera takten','duplicate-bar:'+b.id,'corner-copy',`aria-label="Duplicera takt ${numberOf(b.id)} och infoga efter"`)}${btn('Ta bort takten','delete-bar:'+b.id,'bar-delete',`aria-label="${sectionOf(b.id).bars.length===1?'Töm sista takten':'Ta bort takt '+numberOf(b.id)}"`)}</div>`;
}
function rememberContextVariant() {
 const c = currentChord(); if (!c || !$('#context-variant')) return;
 contextVariantDraft = {id:c.id, value:$('#context-variant').value, pass:$('#context-variant-pass').value, following:$('#context-variant-following').checked};
}
function contextChordBody(b, c) {
 if (contextView === 'variant') return contextVariantHTML(c);
 if (contextView === 'add') return `${contextBack()}<h3>Lägg till efter ${esc(c.name)}</h3><div class="chips">${model.recent.map(n => contextButton(esc(n), 'recent:' + n, b.chords.length >= 4 ? 'disabled' : '')).join('')}</div><p class="hint">Tidigare ackord infogas efter markeringen. Nytt namn skriver du i ackordraden.</p>${b.chords.length >= 4 ? '<p class="hint">Takten har redan fyra ackord.</p>' : ''}`;
 if (contextView === 'chord-more') return `${contextBack()}<div class="context-options">${contextButton(c.parenthetical ? 'Ta bort parentes' : 'Inom parentes', 'context-parentheses', `aria-pressed="${c.parenthetical}"`)}${contextButton('N.C. i stället för ' + esc(c.name), 'nc')}${contextButton('Ta bort ' + esc(c.name), 'context-delete-chord')}</div><p class="hint">${esc(c.name)} · ackordval</p>`;
 return '';
}
function chordTools(b) {
 const c = b.chords.find(c => c.id === chordId); if (!c || draft || selectedPart || selected[0] !== b.id) return '';
 const left = nextChordPosition(b, c, -1), right = nextChordPosition(b, c, 1);
 return `<div class="chord-tools context-tools" role="group" aria-label="Placera ${esc(c.name)}">${contextHeading(c.name + ' · takt ' + numberOf(b.id), 'Ackord')}<div class="context-placement"><button data-action="chord-step:${c.id}:-1" class="icon-button" data-tooltip="Flytta ${esc(c.name)} åt vänster" aria-label="Flytta ${esc(c.name)} åt vänster" ${left == null ? 'disabled' : ''}>${iconSVG('left')}</button><button data-action="chord-step:${c.id}:1" class="icon-button" data-tooltip="Flytta ${esc(c.name)} åt höger" aria-label="Flytta ${esc(c.name)} åt höger" ${right == null ? 'disabled' : ''}>${iconSVG('right')}</button><select data-chord-grid aria-label="Notvärde för ackordets placeringssteg">${[4,8,16].map(n => `<option value="${n}" ${n === resolution ? 'selected' : ''}>1/${n}</option>`).join('')}</select><span>Slag ${beatLabel(c.start)}</span></div><div class="context-primary">${contextButton('Skriv', 'context-edit')}${contextToggle('Variant', 'variant')}${contextToggle('Lägg till', 'add')}${contextToggle('Fler', 'chord-more')}</div>${contextView ? `<div class="context-body">${contextChordBody(b,c)}</div>` : ''}${contextFeedback()}</div>`;
}
function contextRepeatsHTML() {
 const n = selected.length, hasRepeat = selected.some(id => { const b = barById(id); return b.repeatStart || b.repeatEnd; }), hasHouse = visibleBars().some(b => b.houseSpan?.barIds.some(id => selected.includes(id)));
 return `${contextBack()}<h3>${n === 1 ? 'Repris & hus i takten' : 'Repris & hus över ' + n + ' takter'}</h3><div class="context-options"><div class="row wrap">${contextButton('Repris runt ' + (n === 1 ? 'takten' : n + ' takter'), 'repeat:both')}${hasRepeat ? contextButton('Ta bort repris', 'context-remove-repeat') : ''}</div><div class="row wrap">${contextButton('Reprisstart', 'repeat:start')}${contextButton('Reprisslut', 'repeat:end')}</div><h3>Hus över hela markeringen</h3><div class="row wrap">${contextButton('1:a hus', 'context-house:1')}${contextButton('2:a hus', 'context-house:2')}${contextButton('Eget…', 'context:house-number')}${hasHouse ? contextButton('Ta bort hus', 'house-remove') : ''}</div></div><p class="hint">Reprisen börjar i första markerade takten och slutar i sista. Husnumret gäller hela markeringen.</p>`;
}
function contextBarBody(b) {
 if (contextView === 'repeats') return contextRepeatsHTML();
 if (contextView === 'house-number') return `${contextBack('repeats')}${field('Husnummer', 'context-house-number', '1, 2')}<p class="hint">Gäller ${esc(selectionText())}.</p>${contextButton('Lägg till hus', 'context-house-apply')}`;
 if (contextView === 'bar-more') return `${contextBack()}<div class="context-options">${selected.length === 1 ? `<div class="row wrap">${contextButton('Rytm…', 'context-tool:rhythm')}${contextButton('Repris & hus', 'context:repeats')}${contextButton('Tonart & taktart…', 'context-tool:insert')}</div><div class="row wrap">${contextButton('Markera flera', 'range-start')}${contextButton('Rad / sida', 'context:layout')}</div>${contextButton('Töm ackordraden', 'context-clear-chords', b.chords.length ? '' : 'disabled')}` : `<div class="row wrap">${contextButton('Ny takt efter spannet', 'context-insert-bar')}${contextButton('Rad / sida', 'context:layout')}</div><p class="hint">Ackord, rytm och lokala byten redigeras i en enda takt åt gången.</p>${contextButton('Ta bort ' + selected.length + ' takter…', 'context:delete-range')}`}</div>`;
 if (contextView === 'layout') return `${contextBack('bar-more')}<h3>Före ${selected.length > 1 ? 'första markerade takten' : 'takt ' + numberOf(b.id)}</h3><div class="context-options">${contextButton('Ny rad', 'break:row')}${contextButton('Ny sida', 'break:page')}${b.rowBreak || b.pageBreak ? contextButton('Ta bort brytning', 'break:remove') : ''}</div><p class="hint">Brytningen gäller början av markeringen.</p>`;
 if (contextView === 'delete-range') return `${contextBack('bar-more')}<h3>Ta bort ${selected.length} takter?</h3><p class="hint">Ackord och markeringar i spannet tas bort. En tom takt behålls om hela delen väljs. Repristecken flyttas till nästa kvarvarande takt, annars föregående. Ångra återställer allt.</p><div class="row wrap">${contextButton('Behåll takterna', 'context:bar-more')}${contextButton('Ta bort ' + selected.length + ' takter', 'context-delete-range')}</div>`;
 return '';
}
function barActions(b) {
 if (selectedPart || selectedReuse || chordId || draft || rangeAnchor !== null || !selected.includes(b.id) || b.id !== selected.at(-1)) return '';
 const many = selected.length > 1, first = selectedBar();
 return `<div class="bar-actions context-tools" role="group" aria-label="${many ? 'Åtgärder för markerade takter' : 'Åtgärder för markerad takt'}">${contextHeading(many ? 'Takt ' + numberOf(first.id) + '–' + numberOf(b.id) : 'Takt ' + numberOf(b.id), many ? selected.length + ' takter' : 'Takt')}<div class="context-primary">${many ? `${contextButton('Duplicera', 'duplicate-bars')}${contextToggle('Repris', 'repeats')}${contextButton('Hus', 'context-houses')}` : `${contextButton('Ackord', 'context-edit')}${contextButton('+ Takt', 'context-insert-bar', 'title="Infoga en tom takt efter markeringen"')}`}${contextToggle('Fler', 'bar-more')}</div>${contextView ? `<div class="context-body">${contextBarBody(first)}</div>` : ''}${contextFeedback()}</div>`;
}
function positionChordTools() {
 for (const row of document.querySelectorAll('.score-row')) {
  const base = innerWidth < 761 ? 87 : 85; let needed = base;
  for (const variant of row.querySelectorAll('.variant')) needed = Math.max(needed, variant.offsetTop + variant.scrollHeight + 13);
  row.style.setProperty('--bar-needed-height', needed + 'px'); row.style.removeProperty('margin-bottom');
 }
 const scene = $('.scene'); if (!scene) return;
 const bounds = scene.getBoundingClientRect();
 for(const tools of document.querySelectorAll('.bar-corner-actions')){
  const rect=tools.closest('.bar').getBoundingClientRect(),width=tools.getBoundingClientRect().width;
  tools.style.left=(Math.max(bounds.left+8,Math.min(rect.right-width,bounds.right-width-8))-rect.left)+'px';tools.style.right='auto';
 }
 for (const tools of document.querySelectorAll('.context-tools')) {
  const bar = tools.closest('.bar'), rect = bar.getBoundingClientRect(), width = tools.getBoundingClientRect().width, body = tools.querySelector('.context-body');
  if(body){body.style.maxHeight=Math.max(90,scene.clientHeight-(tools.offsetHeight-body.offsetHeight)-35)+'px';}
  tools.style.left = (Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - width - 8)) - rect.left) + 'px';
  bar.closest('.score-row').style.marginBottom = (tools.offsetHeight + 24) + 'px';
 }
}
function revealContext(){const node=$('.context-tools')||(selectedReuse?$(`[data-score-block="${selectedReuse}"] .section-context`):$('.part-selected .section-context'));node?.scrollIntoView({block:'nearest',inline:'nearest'});}
function blockMovesHTML(block) {
 const i = model.form.indexOf(block);
 return `${btn('↑', 'move:' + block.id + ':-1', 'context-move', `aria-label="Flytta ${esc(sectionById(block.source).name)} upp i formen" ${i === 0 ? 'disabled' : ''}`)}${btn('↓', 'move:' + block.id + ':1', 'context-move', `aria-label="Flytta ${esc(sectionById(block.source).name)} ner i formen" ${i === model.form.length - 1 ? 'disabled' : ''}`)}`;
}
function partActionsHTML(s, block) {
 if (selectedPart !== s.id || renameState) return '';
 return `<div class="part-actions">${btn('Ändra titel', 'rename-part:' + s.id, 'outline')}${btn('Återanvänd', 'context-reuse:' + s.id, 'outline')}${blockMovesHTML(block)}${contextToggle('Fler', 'part-more')}${btn('×', 'delete-part:' + s.id, 'part-delete', `aria-label="Ta bort delen ${esc(s.name)}" title="Ta bort delen ${esc(s.name)}"`)}</div>`;
}
function partBodyHTML(s) {
 if (selectedPart !== s.id || contextView !== 'part-more') return '';
 return `<div class="section-context">${contextBack()}<div class="part-more-moves row"><span>Flytta delen i formen</span>${blockMovesHTML(model.form.find(f=>f.source===s.id&&!f.reuse))}</div><div class="row wrap">${contextButton('Duplicera del', 'context-copy-part:' + s.id)}${contextButton('Ny del efter ' + esc(s.name), 'context-new-part:' + s.id)}${contextButton('Låtform…', 'tab:form')}</div><p class="hint">Återanvänd länkar till delens musik. Duplicera skapar en egen del som kan ändras separat.</p></div>`;
}
function reuseScoreHTML(block, s) {
 const on = selectedReuse === block.id;
 return `<div class="reuse-score ${on ? 'reuse-selected' : ''}" data-score-block="${block.id}">${btn(esc(s.name) + ' × ' + block.count, 'context-select-reuse:' + block.id, 'reuse-name', `aria-pressed="${on}"`)}<p>Återanvänd del · följer originalets ackord${block.instruction ? ' · ' + esc(block.instruction) : ''}</p>${on ? `<div class="reuse-actions row wrap">${contextToggle('Inställningar', 'reuse-settings')}${contextButton('Visa original', 'goto-source:' + s.id)}${blockMovesHTML(block)}${contextToggle('Fler', 'reuse-more')}</div>${contextView === 'reuse-settings' ? `<div class="section-context">${contextBack()}${field('Antal gånger', 'context-reuse-count', block.count, 'type="number" min="1" max="16"')}${field('Anvisning', 'context-reuse-instruction', block.instruction, 'placeholder="Till exempel instrumentalt"')}${contextButton('Använd inställningar', 'context-reuse-apply')}</div>` : ''}${contextView === 'reuse-more' ? `<div class="section-context">${contextBack()}<div class="row wrap">${contextButton('Gör till egen del', 'detach-reuse')}${contextButton('Ta bort återanvändning', 'reuse-remove')}</div><p class="hint">Originaldelen och andra återanvändningar påverkas inte.</p></div>` : ''}${error ? `<p class="context-warning" role="alert">${esc(error)}</p>` : ''}` : btn('Visa originaldelen', 'goto-source:' + s.id)}</div>`;
}
function requestContextHouse(value) {
 if (!/^\d+(?:\s*,\s*\d+)*$/.test(value)) { fail('Skriv husnummer, till exempel 1 eller 1, 2.'); renderScore(); return; }
 const overlaps = visibleBars().filter(b => b.houseSpan?.barIds.some(id => selected.includes(id)));
 if (overlaps.some(b => JSON.stringify(b.houseSpan.barIds) !== JSON.stringify(selected))) { pendingHouse = {number:value, spans:overlaps.map(b => clone(b.houseSpan))}; render();revealContext();return; }
 contextView = 'repeats'; applyHouse(value);revealContext();
}
function copyPart(id, empty = false) {
 const source = sectionById(id), original = model.form.find(f => f.source === id && !f.reuse), copy = empty ? {id:'part' + (++uid),name:'Ny del',bars:Array.from({length:4},() => makeBar([]))} : clone(source);
 if (!empty) {
  copy.id = 'part' + (++uid); const ids = new Map();
  copy.entryMeter = meterFor(source.bars[0]);
  copy.bars.forEach(b => {const previous=b.id;b.id=++uid;ids.set(previous,b.id);b.chords.forEach(c => c.id=++uid);});
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
 if(innerWidth<761){contextView='';tab='form';panelOpen=true;render();$('#reuse-count')?.focus();}else $('#context-reuse-count')?.focus({preventScroll:true});
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
 if (action?.startsWith('context:')) {
  const view=action.slice(8);contextView=contextView===view?'':view;error='';variantError='';
  if(innerWidth<761&&['variant','reuse-settings'].includes(contextView)){contextView='';if(view==='variant'){setTool('chord');$('#variant')?.scrollIntoView({block:'center'});$('#variant')?.focus();}else{tab='form';panelOpen=true;render();$('#reuse-count')?.focus();}return true;}
  renderScore();if(contextView)revealContext();if(view==='variant')$('#context-variant')?.focus({preventScroll:true});return true;
 }
 if (action==='context-insert-bar'){insertContextBar();return true;}
 if (action==='context-edit') {if(needSingleBar())beginEdit(selected[0],null);return true;}
 if (action?.startsWith('context-tool:')) {contextView='';setTool(action.slice(13));if(action.endsWith('insert'))$('#local-key')?.scrollIntoView({block:'center'});return true;}
 if (action==='context-parentheses') {const c=currentChord();if(c)mutate(()=>c.parenthetical=!c.parenthetical,'Parentesen uppdaterades för '+c.name+'.');return true;}
 if (action==='context-delete-chord') {const b=singleBar(),c=currentChord();if(b&&c)mutate(()=>{b.chords=b.chords.filter(v=>v.id!==c.id);chordId=b.chords[0]?.id||null;contextView='';contextVariantDraft=null;},'Ackordet togs bort. Rytm och takttecken är kvar.');return true;}
 if (action==='context-clear-chords') {const b=singleBar();if(b)mutate(()=>{b.chords=[];chordId=null;contextView='';},'Ackordraden tömdes. Takten, rytmen och takttecknen är kvar.');return true;}
 if (action==='context-remove-repeat') {mutate(()=>selected.forEach(id=>{const b=barById(id);b.repeatStart=false;b.repeatEnd=false;}),'Repristecknen i markeringen togs bort.');return true;}
 if (action==='context-houses') {contextView='repeats';renderScore();revealContext();$('.context-body h3:last-of-type')?.scrollIntoView({block:'nearest'});return true;}
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
