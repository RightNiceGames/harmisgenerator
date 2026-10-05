/* Isolated, in-memory design prototype. Nothing is written to songs or APIs. */
const $ = (selector, parent=document) => parent.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={plus:'M12 5v14M5 12h14',down:'m7 10 5 5 5-5',back:'m14 6-6 6 6 6',undo:'M8 7H3v-5M3 7a9 9 0 1 1 0 10',redo:'M16 7h5v-5M21 7a9 9 0 1 0 0 10',check:'m5 12 4 4L19 6',close:'m6 6 12 12M18 6 6 18',edit:'m4 16 12-12 4 4-12 12H4v-4M14 6l4 4',export:'M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4',play:'m8 5 11 7-11 7Z',music:'M9 18V5l10-2v13M9 5l10-2M9 18a3 2 0 1 1-3-2c2 0 3 1 3 2M19 16a3 2 0 1 1-3-2c2 0 3 1 3 2',grid:'M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z',repeat:'M4 8h15l-4-4m5 12H5l4 4M4 8v4m16 4v-4',source:'m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',help:'M12 17v.1M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',transpose:'M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3',trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6M14 10v6',save:'M4 3h14l3 3v15H3V3Zm3 0v7h10V3M7 21v-7h10v7',layout:'M3 3h18v18H3ZM3 8h18M8 8v13',search:'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.music}"/></svg>`;
const button = (label,action,kind='',ico='') => `<button class="${kind}" data-action="${action}">${ico?icon(ico):''}${label}</button>`;
const states=[['overview','01 · Arbetsytan'],['chord','02 · Ändra ackord'],['bar','03 · Infoga i vald takt'],['rhythm','04 · Slag och egen rytm'],['repeats','05 · Välj repris eller hus'],['house','06 · Välj hus och spann'],['applied','07 · Hus infogat'],['structure','08 · Återanvänd en låtdel'],['structure-applied','09 · Återkomst infogad'],['song','10 · Låtuppgifter'],['layout','11 · Layout i vald takt']];
const params=new URLSearchParams(location.search);
let version=params.get('version')==='b'?'b':'a', currentState=params.get('state')||'overview';
let mode='', selected=[], chordSelected=false, selectedSection=1, score='base',dirty=false,notice='', dialog='', chordChanges={}, insertedBars=[], customRhythm=false,houseApplied=false;
let draftChord='', savedDraft={},history=[], title='Tro',artist='Marie Fredriksson', key='D',tempo='72';
const parts=['Intro','Vers','Refräng'];
const barNumber=id=>{const [s,b]=id.split('-').map(Number);return [0,4,12][s]+b+1;};
const selectionLabel=()=>!selected.length?'Ingen markering':`${parts[Number(selected[0].split('-')[0])]} · takt ${barNumber(selected[0])}${selected.length>1?'–'+barNumber(selected.at(-1)):''}${chordSelected?' · ackord 1':''}`;
function setState(state){
 currentState=state;mode='';selected=[];chordSelected=false;score='base';dirty=false;notice='';dialog='';customRhythm=false;houseApplied=false;chordChanges={};insertedBars=[];
 if(['chord','bar','rhythm','layout'].includes(state)){selected=[state==='layout'?'1-4':'1-6'];chordSelected=state==='chord'||state==='rhythm';selectedSection=1;}
 if(['repeats','house','applied'].includes(state)){selected=['2-6','2-7'];selectedSection=2;}
 if(state==='chord'){mode='chord';draftChord='A';}
 if(state==='bar')mode='insert';
 if(state==='rhythm'){mode='rhythm';score='rhythm';customRhythm=true;}
 if(state==='repeats')mode='repeats';
 if(state==='house')mode='house';
 if(state==='applied'){score='house';dirty=true;houseApplied=true;notice='Första hus tillagt i takt 19–20';}
 if(state==='structure'){mode='form';selectedSection=2;}
 if(state==='structure-applied'){score='structure';dirty=true;selectedSection=3;notice='Vers återanvänds två gånger efter Refräng';}
 if(state==='song')mode='song';
 if(state==='layout')mode='layout';
 render();
}
function field(label,name,value,kind='input',options=[]){return `<div class="field"><label for="${name}">${label}</label>${kind==='select'?`<select id="${name}">${options.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select>`:kind==='textarea'?`<textarea id="${name}">${escapeHTML(value)}</textarea>`:`<input id="${name}" value="${escapeHTML(value)}" autocomplete="off">`}</div>`;}
function option(label,action,symbol='',description='',selectedOption=false){return `<button data-action="${action}" class="${selectedOption?'selected':''}">${symbol?`<span class="symbol">${symbol}</span>`:''}<span class="option-text">${label}${description?`<small>${description}</small>`:''}</span><span class="arrow">${icon('down')}</span></button>`;}
function panelHeading(name,context=selectionLabel()){return `<div class="panel-title"><div><h2>${name}</h2><p>${context}</p></div><span class="spacer"></span>${button('','close-panel','icon-btn','close')}</div>`;}
function actions(apply='Använd',action='apply'){return `<div class="panel-actions">${button('Avbryt','close-panel','outline')}${button(apply,action,'primary')}</div>`;}
function panel(){
 let body='',head='',tail='';
 if(mode==='chord'){
 head=panelHeading('Ändra ackord');
 body=field('Ackord','chord-value',draftChord,'input')+`<p class="helper">Byt ackord eller skriv flera med mellanslag.<br>Exempel: D A/C♯. Högst fyra i samma takt.</p><div class="quick">${['D','A','Bm','G'].map(v=>button(v,'quick:'+v)).join('')}</div><label class="checkline"><input id="parentheses" type="checkbox"> Visa inom parentes</label><div class="inline-error" id="chord-error" role="alert"></div><div class="options" style="margin-top:14px">${option('Slag och rytm','rhythm','','Placera byten och anslag')}${option('Variantackord','variant','','Ett annat ackord vid nästa omtagning')}</div>`;
 tail=actions('Ändra ackord','apply-chord');
 }else if(mode==='insert'){
 head=panelHeading('Infoga och redigera takt');body=`<div class="group-label">INNEHÅLL I TAKTEN</div><div class="options">${option('Lägg till ackord','add-chord','+','Välj placering på slag 1, 2, 3 eller 4')}${option('Upprepa föregående takt','repeat-bar','%')}${option('Utan ackord','no-chord','N.C.')}</div><div class="group-label">TAKTSTRUKTUR</div><div class="options">${option('Ny takt efter markeringen','insert-bar','|')}${option('Ny takt före markeringen','insert-before','|')}${option('Duplicera markerade takter','duplicate','⧉')}${option('Ta bort markerade takter','remove-bar','−')}</div>`;
 }else if(mode==='rhythm'){
 head=panelHeading('Slag och rytm');body=`<div class="group-label">ACKORDBYTEN</div><p class="helper">Bestäm på vilket slag varje ackord börjar.</p><div class="two-fields">${field('D börjar på','start-d','1','select',['1','1å','2','2å','3','3å','4','4å'])}${field('A börjar på','start-a','3','select',['1','1å','2','2å','3','3å','4','4å'])}</div><div class="group-label">ANS LAG</div><div class="quick">${button('Föruttag','sync:föruttag',customRhythm?'':'active')}${button('Synkop','sync:synkop')}${button('Egen rytm','own-rhythm',customRhythm?'active':'')}</div>${customRhythm?`<div class="beat-grid">${['1','1å','2','2å','3','3å','4','4å'].map((b,i)=>`<button class="${[0,1,4].includes(i)?'on':''}" data-action="beat:${i}">${b}</button>`).join('')}</div><div class="group-label">SLAG · NOTVÄRDE · TEXT</div>${[['1','1/8',''],['1å','1/8',''],['3','1/4','']].map((row,i)=>`<div class="rhythm-note"><span style="width:22px">${row[0]}</span><select aria-label="Notvärde för anslag ${i+1}"><option>${row[1]}</option><option>1/16</option><option>1/2</option><option>1/1</option></select><input aria-label="Text för anslag ${i+1}" placeholder="Valfri text" value="${row[2]}">${button('','delete-note','icon-btn','close')}</div>`).join('')}<p class="helper" style="margin-top:10px">Tryck på slagen för att lägga till eller ta bort anslag.</p>`:`<p class="helper">Välj vilket ackord som ska få rytmtecknet.</p>${field('Ackord','sync-chord','Ackord 1','select',['Ackord 1','Ackord 2'])}`}<div class="panel-note">Föruttag, synkop och egen rytm är alternativa sätt att ange rytm. Bara ett är aktivt i samma takt.</div>`;body=body.replace('ANS LAG','ANSLAG');tail=actions('Använd rytm','apply-rhythm');
 }else if(mode==='repeats'){
 head=panelHeading('Repris och hus');body=`<div class="range-pill">${icon('check')} ${selected.length} takter markerade</div><div class="group-label">REPRIS</div><div class="options">${option('Repris runt markeringen','apply-repeat','‖:','Start vid första takten, slut vid sista')}${option('Bara reprisstart','repeat-start','‖:')}${option('Bara reprisslut','repeat-end',':‖')}</div><div class="group-label">HUS</div>${version==='a'?`<div class="options">${option('Lägg till hus','house','1.','Välj första, andra eller eget nummer')}</div>`:`<div class="mini-grid">${button('Första hus','house','outline')}${button('Andra hus','house:2','outline')}${button('Eget hus…','house:custom','outline')}${button('Avsluta hus','end-house','outline')}</div>`}<button class="subtle-link" data-action="remove-repeat">Ta bort repris eller hus</button>`;
 }else if(mode==='house'){
 head=panelHeading('Lägg till hus');body=`<div class="range-pill">${icon('check')} Takt ${barNumber(selected[0])}–${barNumber(selected.at(-1))}</div><label>Vilket hus?</label><div class="quick">${button('Första · 1.','choose-house:1','active')}${button('Andra · 2.','choose-house:2')}${button('Eget…','choose-house:custom')}</div><div id="custom-house-field"></div><div class="two-fields">${field('Börjar i takt','house-start','19')}${field('Slutar i takt','house-end','20')}</div><label class="checkline"><input type="checkbox" checked id="close-house"> Avsluta huset efter sista takten</label><label class="checkline"><input type="checkbox" checked id="close-repeat"> Reprisslut efter huset</label><p class="helper" style="margin-top:14px">Husets klammer går över hela markeringen. Reprisslutet hamnar efter takt 20.</p><div class="panel-note">För andra hus: markera de följande takterna och välj Andra. Markeringen anger exakt vilka takter huset omfattar.</div>`;tail=actions('Lägg till första hus','apply-house');
 }else if(mode==='form'){
 head=panelHeading('Återanvänd en del','Låtform · efter Refräng');body=`<div class="quick">${button('Ny del','new-part')}${button('Återanvänd','form','active')}</div>${field('Del att återanvända','reuse-part','Vers','select',['Intro','Vers','Refräng'])}<div class="two-fields">${field('Spela antal gånger','reuse-times','2','select',['1','2','3','4','8','16'])}${field('Placera efter','reuse-after','Refräng','select',['Intro','Vers','Refräng'])}</div>${field('Anvisning för återkomsten','reuse-instruction','Instrumentalt')}<div class="panel-note">Återkomsten använder ackorden i Vers. Ändrar du den utskrivna versen följer återkomsten med. Välj Duplicera del om du vill redigera en fristående kopia.</div>${button('Duplicera del istället','duplicate-part','subtle-link')}`;tail=actions('Infoga återkomst','apply-form');
 }else if(mode==='song'){
 head=panelHeading('Låtuppgifter','Gäller hela ackordbladet');body=field('Titel','song-title',title)+field('Artist','song-artist',artist)+`<div class="two-fields">${field('Grundtonart','song-key',key,'select',['C','D','E','F','G','A','B'])}${field('Taktart','song-meter','4/4','select',['4/4','3/4','6/8'])}</div><div class="two-fields">${field('Tempo, bpm','song-tempo',tempo)}${field('Status','song-status','Arbetsutkast','select',['Arbetsutkast','Granskad'])}</div>${field('Version','song-version','Grundarrangemang')}<div class="options">${option('Upphov och stil','credits')}${option('Källor och arbetsanteckningar','notes')}</div><p class="helper">Byte av grundtonart ändrar uppgiften. Använd Transponera för att flytta ackorden samtidigt.</p>`;tail=actions('Spara uppgifter','apply-song');
 }else if(mode==='layout'){
 head=panelHeading('Layout och byten');body=`<div class="group-label">BRYTNING FÖRE VALD TAKT</div><div class="mini-grid">${button('Ny rad','line-break','outline')}${button('Ny sida','page-break','outline')}</div><div class="group-label" style="margin-top:20px">TAKTNUMMER OCH KOLUMN</div><div class="two-fields">${field('Visa taktnummer','bar-number','9')}${field('Kolumn','bar-column','Automatisk','select',['Automatisk','1','2','3','4'])}</div><div class="group-label">MUSIKALISKT BYTE I TAKTEN</div><div class="two-fields">${field('Ny taktart','local-meter','4/4','select',['4/4','3/4','6/8'])}${field('Ny tonart','local-key','Ingen','select',['Ingen','C','D','E','F','G'])}</div><div class="panel-note">Brytningen placeras före takt 9. Tonarts- och taktartsbyte gäller från vald takt.</div>`;tail=actions('Använd ändringar','apply-layout');
 }else if(mode==='signs'){
 head=panelHeading('Tecken och anvisningar');body=`<div class="group-label">SPELANVISNINGAR</div><div class="mini-grid">${button('Fermat','mark:Fermat','outline')}${button('BREAK','mark:BREAK','outline')}${button('Slut','mark:SLUT','outline')}${button('Anvisning…','instruction','outline')}</div><div class="group-label" style="margin-top:20px">NAVIGERING</div><div class="options">${option('Coda','mark:Coda','⊕')}${option('Till coda','mark:Till coda','⊕')}${option('Segno','mark:Segno','𝄋')}</div><p class="helper">Fermat kopplas till det valda ackordet. Övriga tecken placeras i den valda takten.</p>`;
 }else if(mode==='variant'){
 head=panelHeading('Variantackord');body=field('Ackord i varianten','variant-chord','G')+`<div class="two-fields">${field('Spelas gången','variant-time','2','select',['2','3','4','5','6'])}${field('Stämma, valfritt','variant-voice','')}</div><label class="checkline"><input type="checkbox"> Även följande gånger</label><p class="helper" style="margin-top:14px">Variantackordet visas under huvudackordet. Lägg till slag om bytet börjar senare i takten.</p>`;tail=actions('Lägg till variant','apply');
 }else if(mode==='transpose'){
 head=panelHeading('Transponera','Gäller hela låten, inklusive bastoner och varianter');body=field('Ny tonart','target-key','E','select',['C','D','E','F','G','A','B'])+field('Förtecken','target-spelling','Korsförtecken ♯','select',['Korsförtecken ♯','B-förtecken ♭'])+`<p class="helper">Nuvarande tonart är ${key}. Förhandsgranskningen uppdateras när du använder ändringen.</p>`;tail=actions('Transponera','apply-transpose');
 }else if(mode==='new-part'){
 head=panelHeading('Lägg till del','Låtform');body=field('Delnamn','new-part-name','Brygga')+field('Placera efter','new-part-after','Vers','select',['Intro','Vers','Refräng'])+field('Antal takter','new-part-bars','4')+`<p class="helper">Nya takter visas direkt i bladet. Klicka på varje takt för att fylla i ackord.</p>`;tail=actions('Lägg till del','apply');
 }else if(['notes','instruction','credits'].includes(mode)){
 const names={notes:'Källor och arbetsanteckningar',instruction:'Anvisning i vald takt',credits:'Upphov och stil'};head=panelHeading(names[mode],mode==='instruction'?selectionLabel():'Låtuppgifter');body=mode==='notes'?field('Källa, länk','source-url','https://www.e-chords.com/chords/marie-fredriksson/tro')+field('Beskrivning','source-label','Ackordskiss i D')+field('Arbetsanteckningar','work-notes','Kontrollera taktindelning mot inspelningen.','textarea'):mode==='instruction'?field('Anvisning','instruction-text','Walking'):field('Upphov','composer',artist)+field('Stil','music-style','');tail=actions('Använd','apply');
 }
 return mode?`<section class="floating" aria-label="${mode}">${head}<div class="panel-body">${body}</div>${tail}</section>`:'';
}
function overviewInspector(){return `<div class="inspector-overview"><h2>Musikverktyg</h2><p>Klicka på ett ackord för att ändra det. Klicka i en takt eller markera ett spann för att infoga.</p><div class="group-label">ACKORD OCH RYTM</div><div class="mini-grid">${button('Ackord','need-selection:chord','outline')}${button('Slag och rytm','need-selection:rhythm','outline')}${button('Variantackord','need-selection:variant','outline')}${button('Utan ackord','need-selection:no-chord','outline')}</div><div class="group-label">TAKTER</div><div class="mini-grid">${button('Ny takt','need-selection:insert','outline')}${button('Upprepa takt','need-selection:repeat-bar','outline')}</div><div class="group-label">REPRIS OCH HUS</div><div class="mini-grid">${button('Reprisstart','need-selection:repeat-start','outline')}${button('Reprisslut','need-selection:repeat-end','outline')}${button('Första hus','need-selection:house','outline')}${button('Andra hus','need-selection:house','outline')}${button('Eget hus','need-selection:house','outline')}${button('Hus slut','need-selection:end-house','outline')}</div><div class="group-label">TECKEN OCH LAYOUT</div><div class="mini-grid">${button('Fermat / BREAK','need-selection:signs','outline')}${button('Coda / Segno','need-selection:signs','outline')}${button('Anvisning','need-selection:instruction','outline')}${button('Rad / sida','need-selection:layout','outline')}</div></div>`;}
function render(){
 const alternative=version==='b';
 document.title=`Harmis · ${alternative?'B: fast panel':'A: nära markeringen'} · ${currentState}`;
 $('#app').innerHTML=`<div class="prototype-strip"><strong>Harmis / designförslag</strong><div class="variants">${button('A · Nära markeringen','version:a',!alternative?'active':'')}${button('B · Fast panel','version:b',alternative?'active':'')}</div><span class="demo-note muted">Lokal demo · skriver inte till låtbiblioteket</span><span class="spacer"></span><select aria-label="Visa steg i mockupen" id="state-select">${states.map(([id,label])=>`<option value="${id}" ${currentState===id?'selected':''}>${label}</option>`).join('')}</select><a href="index.html">Alla bilder</a></div>
 <div class="app-shell ${alternative?'alternative':''}"><aside class="sidebar"><div class="brand"><span class="brand-mark">h</span>harmis</div>${button('Låtar och setlistor','library','back','back')}<div class="side-song"><div class="eyebrow">Nu redigerar du</div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(artist)}</p></div><nav aria-label="Låtform"><div class="form-heading"><span class="eyebrow">Låtform</span>${button('','new-part','icon-btn','plus')}</div>${parts.map((p,i)=>`<button class="part-item ${selectedSection===i?'active':''}" data-action="section:${i}"><span class="part-index">0${i+1}</span><span>${p}</span><small>${i?8:4} takter</small></button>`).join('')}${score==='structure'?`<button class="part-item reuse active" data-action="form"><span class="part-index">04</span><span>Vers × 2</span><small>Återkomst · instrumentalt</small></button>`:''}${button('Lägg till del','new-part','side-insert','plus')}<p class="side-note">Ordna delar här. Ändra ackord och takter direkt i bladet.</p></nav><div class="side-bottom">${button('Källor och anteckningar','notes','','source')}${button('Så fungerar redigeringen','help','','help')}</div></aside>
 <main class="workspace"><header class="header"><div class="header-top"><div><div class="breadcrumb">Bibliotek / Ackordblad</div><h1>${escapeHTML(title)}${button('','song','edit-title','edit')}</h1><p class="byline">${escapeHTML(artist)} · Grundarrangemang</p></div><span class="spacer"></span><div class="header-actions">${button('Spela','live','outline live-button','play')}${button('Exportera PDF','export','outline','export')}${button('Spara','save','primary','save')}</div></div><div class="metadata"><button data-action="song"><span class="meta-label">Tonart</span><strong>${key}</strong>${icon('edit')}</button><button data-action="song"><span class="meta-label">Taktart</span><strong>4/4</strong></button><button data-action="song"><span class="meta-label">Tempo</span><strong>${tempo} bpm</strong></button><button data-action="song"><span class="status-dot"></span>Arbetsutkast</button><div class="saved">${icon(dirty?'edit':'check')}${dirty?'Osparade ändringar':'Alla ändringar sparade'}</div></div></header>
 <div class="toolbar"><span class="choice-label">${selected.length?'Redigera':'Infoga'}</span>${button('Infoga','insert',mode==='insert'?'active':'','plus')}${button('Rytm','rhythm',mode==='rhythm'?'active':'','music')}${button('Repris & hus','repeats',['repeats','house'].includes(mode)?'active':'','repeat')}${button('Tecken','signs',mode==='signs'?'active':'')}${button('Layout','layout',mode==='layout'?'active':'','layout')}<span class="spacer"></span>${button('','undo','icon-btn','undo')}${button('','redo','icon-btn','redo')}<span class="divider"></span>${button('Transponera','transpose','toolbar-transpose','transpose')}${button('•••','more','icon-btn')}</div>
 <div class="content"><section class="preview" aria-label="Redigerbart ackordblad"><div class="preview-top"><span class="status"><span class="status-dot"></span>Redigera i bladet</span><span class="spacer"></span><span>A4 · 1 sida</span><span class="divider"></span>${button('Anpassa','zoom')}${button('','two-pages','icon-btn','grid')}</div><div class="scene"><figure class="paper" style="margin-block:0">${SCORES[score]}</figure>${!alternative?panel():''}${notice?`<div class="toast" role="status">${icon('check')}<span>${notice}</span>${button('Ångra','undo')}</div>`:''}${currentState==='overview'?`<div class="instruction"><strong>Välj var du vill ändra</strong>Klicka på ett ackord för att skriva.<br>Klicka i takten för att infoga.<br>Markera flera med Shift + klick.</div>`:''}</div><footer class="footer"><span class="selection-info">${selected.length?selectionLabel():''}</span><span>${selected.length?'Klicka i tom taktarea för taktval.':'Klicka på ackord eller i en takt för att börja.'}</span><span class="spacer"></span><span class="mobile-hide"><span class="key">Shift</span> + klick för spann</span><span><span class="key">Esc</span> avmarkera</span></footer></section>${alternative?`<aside class="inspector" aria-label="Fast verktygspanel"><div class="inspector-label">VERKTYG</div><div class="inspector-tabs">${button('Musik','inspector:music',!['form','song'].includes(mode)?'active':'')}${button('Form','form',mode==='form'?'active':'')}${button('Låt','song',mode==='song'?'active':'')}</div>${mode?panel():overviewInspector()}</aside>`:''}</div></main></div>`;
 for(const [action,label] of [['undo','Ångra'],['redo','Gör om'],['more','Fler alternativ'],['two-pages','Visa två sidor'],['close-panel','Stäng panel']]){document.querySelectorAll(`[data-action="${action}"]`).forEach(el=>el.setAttribute('aria-label',label));}
 prepareScore();positionPanel();
 $('#state-select').addEventListener('change',event=>{setState(event.target.value);replaceURL();});
 if(mode==='chord'){$('#chord-value').addEventListener('input',event=>draftChord=event.target.value);}
 if(dialog)showDialog(dialog);
}
function prepareScore(){
 const svg=$('.paper>svg'), ns='http://www.w3.org/2000/svg', targets=[...svg.querySelectorAll('.chord-hit')], group=document.createElementNS(ns,'g');
 const seen=new Set();
 for(const hit of targets){
  const id=hit.dataset.section+'-'+hit.dataset.bar;hit.setAttribute('data-target',id);
  if(chordSelected&&selected.includes(id))hit.classList.add('selected');
  if(seen.has(id)||hit.dataset.variant!==undefined)continue;seen.add(id);
  const x=31+(Number(hit.dataset.bar)%4)*133.3189,y=Number(hit.getAttribute('y'))-3;
  const bar=document.createElementNS(ns,'rect');
  Object.entries({x,y,width:133.3189,height:36,class:'bar-hit'+(selected.includes(id)?' selected':''),'data-target':id,role:'button',tabindex:0,'aria-label':`Markera ${parts[Number(hit.dataset.section)]}, takt ${barNumber(id)}`}).forEach(([k,v])=>bar.setAttribute(k,String(v)));
  group.appendChild(bar);
 }
 const firstText=svg.querySelector('text');svg.insertBefore(group,firstText);
 Object.entries(chordChanges).forEach(([id,value])=>{const hit=svg.querySelector(`.chord-hit[data-target="${id}"]`);if(hit){const y=Number(hit.getAttribute('y')),x=Number(hit.getAttribute('x'));for(const text of [...svg.querySelectorAll('text')]){if(Math.abs(Number(text.getAttribute('x'))-x-1)<2&&Math.abs(Number(text.getAttribute('y'))-y-23)<3){text.textContent=value;break;}}}});
 svg.addEventListener('click',e=>selectTarget(e));svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectTarget(e);}});
}
function selectTarget(event){
 const hit=event.target.closest('.chord-hit,.bar-hit,.section-hit');if(!hit)return;
 if(hit.classList.contains('section-hit')){selectedSection=Number(hit.dataset.section);mode='form';render();return;}
 const id=hit.dataset.target;selectedSection=Number(id.split('-')[0]);
 if(event.shiftKey&&selected.length){const [s,b]=selected[0].split('-').map(Number),[s2,b2]=id.split('-').map(Number);if(s===s2)selected=Array.from({length:Math.abs(b2-b)+1},(_,i)=>`${s}-${Math.min(b,b2)+i}`);else selected=[id];chordSelected=false;mode='';}
 else{selected=[id];chordSelected=hit.classList.contains('chord-hit');mode=chordSelected?'chord':'';draftChord=chordChanges[id]||hit.querySelector('title')?.textContent?.split(',')[0].replace('Ändra ','')||'A';}
 currentState='custom';notice='';render();
}
function positionPanel(){
 if(window.innerWidth<761){
  const scene=$('.scene'),hit=$(`.bar-hit[data-target="${selected[0]}"]`);
  if(hit&&scene){const r=hit.getBoundingClientRect(),s=scene.getBoundingClientRect();scene.scrollTop+=Math.max(0,r.top-s.top-55);}
  return;
 }
 if(version==='b'||!mode)return;
 const scene=$('.scene'),popup=$('.floating',scene);if(!popup)return;
 const sr=scene.getBoundingClientRect(),hit=$(`.bar-hit[data-target="${selected[0]}"]`),r=hit?.getBoundingClientRect(),lastHit=$(`.bar-hit[data-target="${selected.at(-1)}"]`),last=lastHit?.getBoundingClientRect();
 popup.style.maxHeight=Math.max(250,sr.height-36)+'px';
 let left=r?(last?.right??r.right)-sr.left+18:sr.width-360,top=r?r.top-sr.top:22;
 if(left+326>sr.width-16)left=sr.width>1000?sr.width-342:r?r.left-sr.left-344:sr.width-342;
 if(left<16){left=Math.max(16,sr.width-342);top=r?r.bottom-sr.top+16:24;}
 top=Math.max(18,Math.min(top,sr.height-popup.offsetHeight-20));
 popup.style.left=left+'px';popup.style.top=top+'px';
}
function replaceURL(){const p=new URLSearchParams({version,state:currentState});historyURL(p);}
function historyURL(p){window.history.replaceState(null,'',location.pathname+'?'+p.toString());}
function remember(){history.push({score,chordChanges:{...chordChanges},dirty,houseApplied,title,artist,key,tempo});}
function changed(message){dirty=true;notice=message;mode='';currentState='custom';render();}
function needSelection(next){if(!selected.length){notice='Markera först ett ackord eller en takt i bladet';render();return false;}mode=next;render();return true;}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
 if(action.startsWith('version:')){version=action.slice(8);render();replaceURL();return;}
 if(action.startsWith('section:')){selectedSection=Number(action.slice(8));selected=[];mode='';render();return;}
 if(action.startsWith('quick:')){draftChord=action.slice(6);$('#chord-value').value=draftChord;return;}
 if(action.startsWith('need-selection:')){needSelection(action.slice(15));return;}
 if(action.startsWith('choose-house:')){b.parentElement.querySelectorAll('button').forEach(el=>el.classList.remove('active'));b.classList.add('active');const house=action.slice(13);$('.panel-actions .primary').textContent=house==='1'?'Lägg till första hus':house==='2'?'Lägg till andra hus':'Lägg till hus';$('#custom-house-field').innerHTML=house==='custom'?field('Husnummer','custom-house','3.') : '';return;}
 if(action.startsWith('sync:')){customRhythm=false;mode='rhythm';render();return;}
 if(action.startsWith('beat:')){b.classList.toggle('on');return;}
 if(action.startsWith('mark:')){remember();changed(action.slice(5)+' tillagt i vald takt');return;}
 if(['insert','rhythm','repeats','house','house:2','house:custom','signs','layout','variant','instruction'].includes(action)){if(!selected.length&&action==='insert'){mode='new-part';render();return;}needSelection(action.split(':')[0]);return;}
 if(['form','song','transpose','new-part','notes','credits'].includes(action)){mode=action;render();return;}
 if(action==='inspector:music'){mode='';render();return;}
 if(action==='close-panel'){mode='';dialog='';render();return;}
 if(action==='apply-chord'){
  const value=$('#chord-value').value.trim();const tokens=value.split(/\s+/);
  if(!value||tokens.length>4||tokens.some(t=>!/^\(?[A-G](?:[#b♯♭])?(?:m|maj|min|dim|sus|add|aug|M|\d|[#b♯♭]|\/|[A-G]|\(|\)|\+|-)*/.test(t))){$('#chord-error').textContent='Ange ett giltigt ackord, till exempel D, Bm eller A/C♯.';return;}
  remember();chordChanges[selected[0]]=value;changed('Ackordet ändrat i takt '+barNumber(selected[0]));return;
 }
 if(action==='add-chord'){mode='chord';draftChord='D A';render();return;}
 if(action==='own-rhythm'){customRhythm=true;mode='rhythm';render();return;}
 if(action==='delete-note'){b.closest('.rhythm-note').remove();return;}
 if(action==='apply-rhythm'){remember();score='rhythm';changed('Rytm tillagd i takt '+barNumber(selected[0]));return;}
 if(action==='apply-house'){remember();score='house';houseApplied=true;changed('Första hus tillagt i takt 19–20');return;}
 if(action==='apply-form'){remember();score='structure';selectedSection=3;changed('Vers återanvänds två gånger efter Refräng');return;}
 if(action==='apply-song'){remember();title=$('#song-title').value||'Tro';artist=$('#song-artist').value;key=$('#song-key').value;tempo=$('#song-tempo').value;changed('Låtuppgifterna har ändrats');return;}
 if(action==='save'){dirty=false;notice='Sparat i denna demo';render();return;}
 if(action==='undo'){const previous=history.pop();if(previous){({score,chordChanges,dirty,houseApplied,title,artist,key,tempo}=previous);mode='';notice='Ändringen ångrad';render();}else setState('overview');return;}
 if(action==='more'){dialog='more';render();return;}
 if(action==='library'){dialog='library';render();return;}
 if(['help','source','export','live'].includes(action)){dialog=action;render();return;}
 if(action==='source-done'){dialog='';notice='Låtfilen visas bara i det avancerade läget';render();return;}
 if(['no-chord','repeat-bar'].includes(action)){remember();chordChanges[selected[0]]=action==='no-chord'?'N.C.':'%';changed('Innehållet i vald takt ändrat');return;}
 if(action==='zoom'){const paper=$('.paper');paper.style.width=paper.style.width==='90%'?'':'90%';positionPanel();return;}
 if(action==='confirm-remove'){remember();changed('Markerade takter borttagna i demo');dialog='';return;}
 if(action==='remove-bar'){dialog='remove';render();return;}
 if(['apply','apply-layout','apply-transpose','apply-repeat','repeat-start','repeat-end','end-house','insert-bar','insert-before','duplicate','duplicate-part','remove-repeat','line-break','page-break','two-pages','redo'].includes(action)){remember();changed('Ändringen visas i denna design-demo');return;}
});
function showDialog(name){
 let content='';
 if(name==='more')content=panelHeading('Fler alternativ','Avancerat och hjälp')+`<div class="panel-body"><div class="options">${option('Visa textfil','source','&lt;/&gt;','Avancerad redigering')}${option('Källor och anteckningar','notes')}${option('Tangentbord och hjälp','help')}</div></div>`;
 if(name==='source')content=panelHeading('Textfil','Avancerat · förhandsgranskningen är standard')+`<div class="panel-body"><label for="source-code">Låtfilens text</label><textarea id="source-code" class="source-code">format: 1\ntitel: Tro\nartist: Marie Fredriksson\ngrundtonart: D\ntaktart: 4/4\ntempo: 72\ndelar:\n  - namn: Intro\n    takter:\n      - D\n      - A\n      - Bm\n      - G</textarea><p>Textläget visar låtfilen vid behov. Den här demon skriver inte till filen.</p></div>`+actions('Tillbaka till bladet','source-done');
 if(name==='help')content=panelHeading('Redigera direkt i bladet','Ackord, takter och delar')+`<div class="panel-body"><p>Klicka på ett ackord och skriv det nya värdet. Klicka i takten för att markera hela takten. Använd Shift + klick för ett sammanhängande spann inom en låtdel. Esc stänger panelen, och sedan avmarkeras urvalet. Ctrl + Z ångrar. Ctrl + S sparar i denna demo.</p></div>`;
 if(name==='library')content=panelHeading('Låtar och setlistor','Biblioteket öppnas vid behov')+`<div class="panel-body">${field('Sök låt','library-search','')}<div class="options">${option('Tro · Marie Fredriksson','close-panel','D')}${option('Vintersaga · Ted Ström','close-panel','Em')}${option('Du måste finnas · Kristina från Duvemåla','close-panel','F')}</div></div>`;
 if(name==='export'||name==='live')content=panelHeading(name==='export'?'Exportera PDF':'Spela från ackordbladet','Illustrerat flöde')+`<div class="panel-body"><p>Här tar den befintliga ${name==='export'?'PDF-exporten':'spelvyn'} över. Mockupen visar placeringen av knappen.</p></div>`;
 if(name==='remove')content=panelHeading('Ta bort markerade takter?',selectionLabel())+`<div class="panel-body"><p>Ackord och tecken i markeringen tas bort. Du kan ångra ändringen.</p></div>`+actions('Ta bort','confirm-remove');
 const backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML=`<section class="floating" role="dialog" aria-modal="true">${content}</section>`;document.body.appendChild(backdrop);
 backdrop.addEventListener('click',e=>{if(e.target===backdrop){dialog='';backdrop.remove();}});
}
// Remove an old modal before a new render. The demo is also navigable by keyboard.
const originalRender=render;render=function(){document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove());originalRender();};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(mode||dialog){mode='';dialog='';}else{selected=[];chordSelected=false;}render();}if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();dirty=false;notice='Sparat i denna demo';render();}if((event.ctrlKey||event.metaKey)&&event.key==='z'){event.preventDefault();document.querySelector('[data-action="undo"]').click();}});
window.addEventListener('resize',positionPanel);
window.mockup={setState,getState:()=>({version,currentState,mode,selected,dirty,score}),setVersion:v=>{version=v;render();}};
setState(currentState);
