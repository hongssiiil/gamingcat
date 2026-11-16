import { NOTES, PASSWORD, COSTS, TOPICS, POND, CLIMB, CHECKPOINTS } from './road/content.js';
import { pixelIcon } from './road/pixel-icons.js';
import { FOREST_SIGN, nearbyForestTarget, discoverNote } from './road/forest.js';
import { createForkMotion, updateForkMotion } from './road/fork-motion.js';
import { STORAGE_KEY, freshState, restoreState, scenario, sendRoadMessage, choose, walkFork, puzzleMoves, solvePuzzle, routeMetrics, pointOnRoute, nextCheckpoint, advanceMap, finishPuzzle, pressPondStone, pressClimbStone } from './road/model.js';

const $ = selector => document.querySelector(selector);
const root = $('#Road'), view = $('#road-view'), modal = $('#road-modal'), body = $('#road-modal-body');
const flowDialog = $('#road-flow-dialog');
const forestPopupStages = new Set(['routeMissing', 'contract', 'stopped', 'topic']);
const hasForestScene = () => ['forest','fork','summary','map','pond','climb'].includes(state.stage) || forestPopupStages.has(state.stage);
const chatPanel = $('#road-chat-panel'), chatLog = $('#road-chat-log'), chatInput = $('#road-chat-input');
let chatOpen = false;
let helpStage, puzzleMistakes = 0, helpSuggested = false;
function hideHelpNudge(){
    $('#road-help-nudge').hidden=true;
    $('#road-help-nudge').textContent='';
    $('#road-help').classList.remove('needs-help');
}
function recordPuzzleMistake(){
    puzzleMistakes++;
    if(puzzleMistakes<3||helpSuggested||chatOpen)return;
    helpSuggested=true;
    $('#road-help-nudge').hidden=false;
    $('#road-help-nudge').textContent='도움이 필요해?';
    $('#road-help').classList.add('needs-help');
}
let forkTransition = 0;
let forkMotion, forkIntroElapsed = 0, forkQuestionShown = false, forkRecommendationShown = false, forkReady = false;
let forkLastSteer = 0;
let state;
try { state = restoreState(sessionStorage.getItem(STORAGE_KEY)); } catch { state = freshState(); }
export const journeyChoiceHistory = [];
const keys = new Set();
let lastTime = 0, saveElapsed = 0, animationTime = 0, lastFacing = 'front', statusTimer, returnFocus, tokenChangeTimer;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const active = () => root.classList.contains('screen-active') && !document.hidden;
const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };
const button = (text, action, className = '') => { const b = el('button', className, text); b.type = 'button'; b.addEventListener('click', action); return b; };
const paragraph = text => el('p', '', text);
function save() {
    journeyChoiceHistory.splice(0, journeyChoiceHistory.length, ...state.choices);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Continue in memory. */ }
}
function announce(text) {
    $('#road-status').textContent = text;
    clearTimeout(statusTimer); statusTimer = setTimeout(() => { $('#road-status').textContent = ''; }, 5000);
}
function changeStage(stage) { state.stage = stage; keys.clear(); save(); render(); if (!flowDialog.open) (view.querySelector('.road-puzzle-popup [tabindex="0"]') || view).focus({ preventScroll: true }); }
function updateResources() {
    $('#road-token').textContent = `토큰 ${state.tokens}`;
    $('#road-debt').hidden = state.tokens >= 0;
    $('#road-debt').textContent = `AI DEBT ${Math.max(0, -state.tokens)}`;
}
function openModal(title) {
    closeHelp(false);
    delete modal.dataset.layout;
    $('#road-modal-title').classList.remove('road-sr-only');
    keys.clear(); if (!modal.open) returnFocus = document.activeElement;
    $('#road-modal-title').textContent = title; body.replaceChildren();
    if (!modal.open) modal.showModal(); updateForestPrompt(); return body;
}
function closeModal() { modal.close(); }
modal.addEventListener('close', () => {
    keys.clear(); updateForestPrompt();
    if (!active()) return;
    const fallback = flowDialog.open ? flowDialog.querySelector('button') : view;
    const target = returnFocus?.isConnected && (!flowDialog.open || flowDialog.contains(returnFocus)) ? returnFocus : fallback;
    target?.focus({ preventScroll: true });
});
flowDialog.addEventListener('cancel', event => event.preventDefault());
$('#road-modal-close').addEventListener('click', closeModal);
function setHeader(title, instruction, progress = '') {
    $('#road-title').textContent = title; $('#road-instructions').textContent = instruction; $('#road-progress').textContent = progress;
}
function actor(kind, className = '') {
    const img = el('img', `road-sprite ${className}`);
    img.alt = kind === 'player' ? '플레이어' : 'AI 고양이 티니';
    img.src = `./images/character/${kind}/${kind}_front.png`; img.draggable = false; return img;
}
function animateActor(image, kind, dx, dy) {
    if (!image) return;
    const moving = Math.hypot(dx, dy) > 0;
    const direction = moving ? (Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'back' : 'front') : lastFacing;
    if (moving && kind === 'player') lastFacing = direction;
    const frame = Math.floor(animationTime / 0.175) % 4;
    let name = `${kind}_${direction}.png`;
    if (kind === 'player' && moving && frame % 2) name = direction === 'side' ? 'player-side-walk-frame.png' : direction === 'back' ? `player_back_${frame === 1 ? 'left' : 'right'}.png` : frame === 1 ? 'player-front-walk-frame.png' : 'player-front-walk-frame-right-forward.png';
    if (kind === 'cat' && moving && frame % 2) name = direction === 'side' ? 'cat-side-squash-more.png' : direction === 'back' ? 'cat-back-squash-more.png' : 'cat-front-squash-more.png';
    const path = `./images/character/${kind}/${name}`;
    if (image.getAttribute('src') !== path) image.src = path;
    image.style.setProperty('--flip', dx < 0 && direction === 'side' ? -1 : 1);
}
// Visible trail coordinates on the existing 1023 × 769 forest image.
const forestSegments = [
    [45,552,205,552,37], [205,552,330,483,39], [330,483,739,483,41],
    [739,483,794,548,36], [794,548,974,548,33], [365,483,404,310,32],
    [404,310,404,100,31], [330,483,330,643,26], [330,643,466,643,25], [466,643,466,748,32],
];
function segmentDistance(x, y, [ax,ay,bx,by]) {
    const t = clamp(((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2),0,1);
    return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay));
}
function canWalk(x,y) { return forestSegments.some(s => segmentDistance(x,y,s) < s[4]); }
function renderForest() {
    setHeader('이름 없는 숲', 'WASD 이동 · E 상호작용');
    const viewport = el('div','road-forest-viewport'), world = el('div','road-forest-world');
    const bg = el('img','road-forest-image'); bg.src = './images/backgrounds/road_white.png'; bg.alt = '갈림길이 있는 어두운 숲'; bg.draggable = false; world.append(bg);
    for (const note of NOTES.filter(note => state.notes.includes(note.id))) {
        const b = button('', () => interactForest(note), 'road-note'); b.append(pixelIcon(note.id)); b.setAttribute('aria-label',`${note.name} 쪽지${state.notes.includes(note.id) ? ' · 읽음' : ''}`);
        b.classList.toggle('is-read',state.notes.includes(note.id)); b.style.left = `${note.x}px`; b.style.top = `${note.y}px`; world.append(b);
    }
    const sign = button('',()=>interactForest(FOREST_SIGN),'road-sign-object'), image = el('img');
    image.src = './images/road/sign-transparent-outline-fixed.png'; image.alt = '잠긴 표지판'; sign.append(image); sign.style.left='550px'; sign.style.top='470px';
    const prompt=button('',interact,'road-interaction-prompt');
    prompt.id='road-forest-prompt';prompt.hidden=true;
    prompt.append(el('kbd','','E'),el('span','road-prompt-caption','조사'));
    world.append(sign,actor('player','road-forest-player'),prompt); viewport.append(world); view.append(viewport);
    if (state.notes.length) view.append(button(`쪽지 모음 ${state.notes.length}/4`,showNotebook,'road-notebook'));
    positionForest();
}
function positionForest(dx=0,dy=0) {
    const world = view.querySelector('.road-forest-world'), viewport = view.querySelector('.road-forest-viewport'); if (!world) return;
    // Cover the screen with the forest instead of reserving letterbox bars.
    // The camera still follows the player, so cropped trails remain reachable.
    const scale = Math.max(viewport.clientWidth/1023,viewport.clientHeight/769,1.25);
    const tx = clamp(viewport.clientWidth/2-state.player.x*scale,Math.min(0,viewport.clientWidth-1023*scale),Math.max(0,(viewport.clientWidth-1023*scale)/2));
    const ty = clamp(viewport.clientHeight/2-state.player.y*scale,Math.min(0,viewport.clientHeight-769*scale),0);
    world.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
    const player = world.querySelector('.road-forest-player'); player.style.left=`${state.player.x}px`; player.style.top=`${state.player.y}px`; animateActor(player,'player',dx,dy);
    updateForestPrompt();
}
function updateForestPrompt(){
    const prompt=$('#road-forest-prompt');if(!prompt)return;
    const target=state.stage==='forest'&&!modal.open&&!chatOpen?nearbyForestTarget(state.player):null;
    prompt.hidden=!target;
    if(!target)return;
    prompt.style.left=`${target.x}px`;prompt.style.top=`${target.y-38}px`;
    const discovered=state.notes.includes(target.id);
    prompt.querySelector('.road-prompt-caption').textContent=target.id==='sign'?'읽기':discovered?'다시 읽기':'조사';
    prompt.setAttribute('aria-label',target.id==='sign'?'E · 표지판 읽기':discovered?`E · ${target.name} 쪽지 다시 읽기`:`E · ${target.site} 조사`);
}
function showNotebook() { const b=openModal('주운 쪽지'); for(const note of NOTES.filter(n=>state.notes.includes(n.id))) {const icon=pixelIcon(note.id,note.name);icon.classList.add('road-note-record-icon');b.append(icon,paragraph(note.text));} }
function interactForest(target) {
    if (!active()||modal.open||chatOpen)return;
    if (nearbyForestTarget(state.player)?.id!==target.id) { announce('조금 더 가까이 다가가 보자.'); return; }
    if (target.id==='sign') { showPassword(); return; }
    const discovered=discoverNote(state,target);
    if (discovered) { save(); render(); }
    const noteBody=openModal('');modal.dataset.layout='note';
    const icon=pixelIcon(target.id,target.name);icon.classList.add('road-note-record-icon');
    noteBody.append(icon,paragraph(target.text));
    updateForestPrompt();
}
function showPassword() {
    const b=openModal('표지판');
    modal.dataset.layout='sign';
    $('#road-modal-title').classList.add('road-sr-only');
    b.append(paragraph('자신의 선택에 따라 잎은 듣고 달은 뜨고 비가 내리고 별은 남는다.'));
    const form=el('form'), label=el('label','','네 자리 암호'), input=el('input'), feedback=el('p');
    input.id='road-password'; input.inputMode='numeric'; input.maxLength=4; input.pattern='[0-9]{4}'; input.autocomplete='off'; input.required=true; label.htmlFor=input.id; feedback.setAttribute('role','status');
    const submit=button('확인',()=>{}); submit.type='submit'; form.append(label,input,submit,feedback);
    form.addEventListener('submit',e=>{e.preventDefault(); if(input.value.trim()===PASSWORD){state.events.push({type:'password-solved'});closeModal();changeStage('routeMissing');}else{feedback.textContent='장치는 열리지 않았다. 다시 생각해 보자.';input.select();}});
    b.append(form); input.focus();
}
function renderCard(kicker,title,text,actions) {
    const card=el('article','road-card'), heading=el('h2','',title);
    const isPopup=forestPopupStages.has(state.stage);
    if(isPopup)heading.id='road-flow-title';
    if(kicker)card.append(el('span','road-eyebrow',kicker));
    card.append(heading,paragraph(text));
    const row=el('div','road-actions'); for(const [label,fn] of actions)row.append(button(label,fn));card.append(row);
    (isPopup?flowDialog:view).append(card);return card;
}
function renderTopic() {
    setHeader('탈출 경로 만들기','당신에게 지금 가장 중요한 방향');
    const card=renderCard('','당신은 어디로 향하고 싶은가?','당신의 선택을 바탕으로 탈출 경로를 생성합니다.',[]);
    const list=el('div','road-topic-list');
    for(const topic of TOPICS)list.append(button(topic,()=>{
        if(topic!=='기타'){state.topic=topic;changeStage('fork');return;}
        const b=openModal('어떤 방향이 궁금한가요?'),form=el('form'),label=el('label','','관심사'),input=el('input');input.id='road-interest';input.maxLength=40;input.required=true;label.htmlFor=input.id;
        const submit=button('이 방향으로 시작',()=>{});submit.type='submit';form.append(label,input,submit);
        form.addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim())return;state.topic='기타';state.interest=input.value.trim();closeModal();changeStage('fork');});b.append(form);input.focus();
    }));card.append(list);
}
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs={},text){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;return n;}
function svgBase(){
    const svg=svgEl('svg',{viewBox:'0 0 1000 500',role:'img','aria-label':'플레이어와 고양이가 이동하는 경로 지도'});
    const defs=svgEl('defs'),pattern=svgEl('pattern',{id:'road-grid',width:32,height:32,patternUnits:'userSpaceOnUse'});
    pattern.append(svgEl('path',{d:'M 32 0 L 0 0 0 32',fill:'none',stroke:'#365354','stroke-width':0.6}));defs.append(pattern);svg.append(defs,svgEl('rect',{width:1000,height:500,fill:'url(#road-grid)'}));return svg;
}
function svgCharacter(svg,id,kind){const g=svgEl('g',{id});g.append(svgEl('image',{href:`./images/character/${kind}/${kind}_side.png`,x:-19,y:-37,width:38,height:43}));svg.append(g);return g;}
function renderFork(){
    const q=scenario(state), step=String(state.choices.length+1).padStart(2,'0');
    setHeader('누가 누구를 이끌까?','↑ / ↓ 인접한 갈래 · → 앞으로 · ← 돌아오기',`${step} / 05`);
    const startY=[120,250,380][state.choices.at(-1)?.selected??1];
    forkTransition=0;forkMotion=createForkMotion(state.fork,startY);forkIntroElapsed=0;forkQuestionShown=false;forkRecommendationShown=false;forkReady=state.fork.progress>0;forkLastSteer=0;
    const desktop=el('div','road-fork-desktop'),chart=el('div','road-chart road-fork-chart'),svg=svgBase();
    svg.querySelector('rect')?.remove();const bar=el('div','road-map-titlebar');bar.append(el('span','',`갈림길 ${step}`),el('span','',state.interest||state.topic));
    for(let i=0;i<3;i++){
        const y=[120,250,380][i],d=`M 110 ${startY} L 300 ${startY} L 530 ${y} L 880 ${y}`;
        svg.append(svgEl('path',{d,class:'road-route-line'}));
        if(i===q.recommended)svg.append(svgEl('path',{d,class:'road-route-line is-recommended'}));
        svg.append(svgEl('text',{x:550,y:y-25,class:'road-svg-label'},`${i+1}. ${q.options[i]}`));
    }
    svg.append(svgEl('line',{id:'road-leash',class:'road-leash'}));
    svgCharacter(svg,'road-route-player','player');svgCharacter(svg,'road-route-cat','cat');
    const reaction=svgEl('g',{id:'road-cat-reaction',visibility:'hidden',role:'img','aria-label':'티니가 당황하며 잠시 뒤처집니다'});
    reaction.append(svgEl('path',{d:'M -19 -77 H 19 V -51 H 5 L 0 -45 L -5 -51 H -19 Z',fill:'#f3d69a',stroke:'#35443b','stroke-width':2}),svgEl('text',{x:0,y:-58,'text-anchor':'middle',fill:'#47372a','font-size':17,'font-weight':'bold'},'?!'));
    svg.append(reaction);chart.append(bar,svg,el('div','road-chart-caption','실선 · 내가 걸을 수 있는 길     점선 · 티니가 추천한 길'));
    const popups=el('div','road-fork-popups');
    const question=forkWindow('question',`QUESTION_${step}`,q.prompt);
    const options=el('div','road-options');
    q.options.forEach((option,i)=>options.append(el('p','road-walking-option',`${['↑','→','↓'][i]}  ${option}`)));
    question.querySelector('.road-window-body').append(options,el('p','road-window-hint','↑ / ↓ 로 갈래를 옮기고 → 로 걸어가세요. 왼쪽 갈래에서도 반대 방향을 누르면 가운데로 돌아옵니다.'));
    const recommendation=forkWindow('recommendation','티니 · 새 메시지','티니의 추천');
    const recBody=recommendation.querySelector('.road-window-body'),cat=actor('cat');cat.className='road-window-cat';
    recBody.append(cat,el('strong','road-recommendation-choice',q.options[q.recommended]),paragraph(q.reason),el('span','road-window-hint','결정은 네가 해. 나는 같이 걸을게.'));
    popups.append(question,recommendation);
    const taskbar=el('div','road-fork-taskbar');
    for(const [kind,label] of [['question','질문'],['recommendation','티니 추천']]){
        const toggle=button(label,()=>{if(kind==='question')forkQuestionShown=true;else forkRecommendationShown=true;const opening=view.querySelector(`#road-fork-${kind}`).hidden;toggleForkWindow(kind,opening);if(opening)view.querySelector(`#road-fork-${kind}-title`).focus({preventScroll:true});});
        toggle.dataset.window=kind;toggle.setAttribute('aria-controls',`road-fork-${kind}`);toggle.setAttribute('aria-expanded','false');taskbar.append(toggle);
    }
    taskbar.append(el('span','road-pressure'));desktop.append(chart,popups,taskbar);view.append(desktop);drawFork();
}
function forkWindow(kind,label,title){
    const panel=el('section',`road-pixel-window road-window-${kind}`);panel.id=`road-fork-${kind}`;panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby',`${panel.id}-title`);
    const bar=el('header','road-window-titlebar'),minimize=button('−',()=>{toggleForkWindow(kind,false);view.querySelector(`[data-window="${kind}"]`).focus();});
    minimize.setAttribute('aria-label',kind==='question'?'질문 창 접기':'티니 추천 창 접기');bar.append(el('span','',label),minimize);
    const content=el('div','road-window-body'),heading=el('h2','',title);heading.id=`${panel.id}-title`;heading.tabIndex=-1;content.append(heading);panel.append(bar,content);return panel;
}
function toggleForkWindow(kind,open){
    const panel=view.querySelector(`#road-fork-${kind}`);if(!panel)return;
    panel.hidden=!open;view.querySelector(`[data-window="${kind}"]`).setAttribute('aria-expanded',String(open));
}
function advanceForkIntro(dt){
    forkIntroElapsed+=dt;
    if(!forkQuestionShown&&forkIntroElapsed>=0.25){
        forkQuestionShown=true;toggleForkWindow('question',true);
        const desktop=view.querySelector('.road-fork-desktop');
        requestAnimationFrame(()=>requestAnimationFrame(()=>desktop?.classList.add('question-docked')));
        if(view.contains(document.activeElement)||document.activeElement===document.body)view.querySelector('#road-fork-question-title').focus({preventScroll:true});
    }
    if(!forkRecommendationShown&&forkIntroElapsed>=0.7){forkRecommendationShown=true;toggleForkWindow('recommendation',true);}
}

function drawFork(dt=0,moving=false){
    const q=scenario(state);if(!q||!forkMotion)return;const f=state.fork;
    const previous={player:{...forkMotion.player},cat:{...forkMotion.cat}};
    const surprised=updateForkMotion(forkMotion,f,q.recommended,dt,moving),p=forkMotion.player,c=forkMotion.cat;
    $('#road-route-player')?.setAttribute('transform',`translate(${p.x},${p.y})`);$('#road-route-cat')?.setAttribute('transform',`translate(${c.x},${c.y})`);
    const reaction=$('#road-cat-reaction');reaction?.setAttribute('transform',`translate(${c.x},${c.y})`);reaction?.setAttribute('visibility',surprised?'visible':'hidden');
    const leash=$('#road-leash');if(leash)Object.entries({x1:p.x,y1:p.y-12,x2:c.x,y2:c.y-10}).forEach(([k,v])=>leash.setAttribute(k,v));
    view.querySelectorAll('[data-lane]').forEach(b=>b.setAttribute('aria-pressed',String(forkReady&&Number(b.dataset.lane)===f.lane)));
    const pressure=view.querySelector('.road-pressure');if(pressure)pressure.textContent=!forkReady?'방향키로 원하는 길을 직접 걸어가세요.':surprised?'티니: 어? 그쪽으로 가는 거야?':f.resisted?'티니가 네 걸음을 따라온다.':`${f.lane+1}번 길 · → 키를 누르고 걸어가기`;
    const movingSprites={};
    for(const kind of ['player','cat']){
        const dx=forkMotion[kind].x-previous[kind].x,dy=forkMotion[kind].y-previous[kind].y;
        movingSprites[kind]=Math.hypot(dx,dy)>0.08;
        if(Math.abs(dx)>0.08)$(`#road-route-${kind} image`)?.setAttribute('transform',`scale(${dx<0?-1:1} 1)`);
    }
    animateMapSprites('road-route',p,movingSprites);
}
function renderMap(summary=false){
    setHeader(summary?'당신이 만든 경로':'YOUR DECISION PATH',summary?'다섯 선택으로 이어진 길':'→ / ↑ 앞으로 · ← / ↓ 뒤로 · E 구역 진입','05 / 05');
    const panel=el('section','road-map-parchment');panel.setAttribute('aria-label','숲의 여정 지도');view.append(panel);
    const title=el('h2','road-map-title',summary?'나의 숲 경로':'당신이 그린 숲길');panel.append(title);
    if(summary){const heading=el('div','road-map-heading');heading.append(el('h2','','나만의 탈출 경로로 탈출하자!'));panel.append(heading);}
    const chart=el('div','road-chart road-map-chart'),svg=svgBase(),{points,distances}=routeMetrics(state.choices);
    svg.querySelector('rect')?.remove();
    svg.append(svgEl('text',{x:915,y:60,'text-anchor':'middle',class:'road-map-compass'},'N'),svgEl('path',{d:'M 915 70 L 904 99 L 915 92 L 926 99 Z',fill:'#87683e'}));
    svg.append(svgEl('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),class:'road-route-line'}));
    const next=nextCheckpoint(state),lockIndex=next?.at??5;
    if(!summary&&lockIndex<5)svg.append(svgEl('polyline',{points:points.slice(lockIndex).map(p=>`${p.x},${p.y}`).join(' '),class:'road-route-line is-locked'}));
    points.forEach((p,i)=>{const checkpoint=CHECKPOINTS.find(c=>c.at===i);svg.append(svgEl('circle',{cx:p.x,cy:p.y,r:9,class:`road-node ${distances[i]<=state.mapDistance?'is-visited':''}`}));svg.append(svgEl('text',{x:p.x,y:p.y+35,'text-anchor':'middle',class:'road-svg-label'},i?`${i}`:'출발'));if(checkpoint&&state.completed.includes(checkpoint.id))svg.append(svgEl('text',{x:p.x,y:p.y-28,'text-anchor':'middle',class:'road-svg-checkpoint'},`✓ ${checkpoint.label}`));});
    if(!summary){svgCharacter(svg,'road-map-cat','cat');svgCharacter(svg,'road-map-player','player');const alert=svgEl('g',{id:'road-map-alert','visibility':'hidden','aria-label':'장애물을 발견했습니다'});alert.append(svgEl('path',{d:'M -10 -76 Q -10 -88 0 -88 Q 10 -88 10 -76 L 0 -66 Z',fill:'#fff0b8',stroke:'#604a2c','stroke-width':2}),svgEl('text',{x:0,y:-74,'text-anchor':'middle',fill:'#4a3722','font-size':14,'font-weight':'bold'},'!'));svg.append(alert);}chart.append(svg);panel.append(chart);
    const strip=el('div','road-map-strip');
    if(summary){strip.append(paragraph(`추천과 같은 선택 ${state.choices.filter(c=>c.selected===c.recommended).length}회 · 다른 선택 ${state.choices.filter(c=>c.selected!==c.recommended).length}회`),button('지도 위에서 출발하기 →',()=>changeStage('map')));const details=el('details','road-choice-records');details.append(el('summary','','다섯 선택의 기록'));state.choices.forEach((c,i)=>details.append(paragraph(`${i+1}. ${c.label} · 티니의 추천: ${c.options[c.recommended]} · 고민 ${c.seconds}초`)));strip.append(details);}
    else strip.append(el('p','road-map-message',''),button('구역 살펴보기 · E',interact,'road-checkpoint-button'));
    panel.append(strip);if(!summary){const notice=el('div','road-encounter-notice','예상치 못한 장애물을 만났다!');notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');panel.append(notice,el('p','road-map-controls-hint','→ / ↑ 앞으로 · ← / ↓ 뒤로 · E 구역 진입'));drawMap();}
}
function drawMap(){
    const p=pointOnRoute(state.choices,state.mapDistance),c=pointOnRoute(state.choices,Math.max(0,state.mapDistance-35));$('#road-map-player')?.setAttribute('transform',`translate(${p.x},${p.y})`);$('#road-map-cat')?.setAttribute('transform',`translate(${c.x},${c.y})`);
    const next=nextCheckpoint(state),metric=routeMetrics(state.choices),at=next&&Math.abs(state.mapDistance-metric.distances[next.at])<0.1;
    const message=view.querySelector('.road-map-message');if(message)message.textContent=at?'예상치 못한 장애물을 만났다!':'길을 따라 앞으로 이동하세요.';
    const alert=$('#road-map-alert');alert?.setAttribute('transform',`translate(${p.x},${p.y})`);alert?.setAttribute('visibility',at?'visible':'hidden');
    const notice=view.querySelector('.road-encounter-notice');if(notice)notice.hidden=!at;
    const b=view.querySelector('.road-checkpoint-button');if(b)b.disabled=!at;
    animateMapSprites('road-map',p,keys.size>0);
}
function animateMapSprites(prefix,point,moving){
    for(const kind of ['player','cat']){
        const img=$(`#${prefix}-${kind} image`);if(!img)continue;
        const bounce=(typeof moving==='object'?moving[kind]:moving)&&Math.floor(animationTime/.175)%2;
        const file=bounce?(kind==='player'?'player-side-walk-frame.png':'cat-side-squash-more.png'):`${kind}_side.png`;
        const href=`./images/character/${kind}/${file}`;
        if(img.getAttribute('href')!==href)img.setAttribute('href',href);
    }
    const chart=view.querySelector('.road-chart');
    if(chart&&chart.scrollWidth>chart.clientWidth){const svg=chart.querySelector('svg');chart.scrollLeft=clamp(point.x/1000*svg.clientWidth-chart.clientWidth/2,0,chart.scrollWidth-chart.clientWidth);}
}
function renderPuzzle(kind){
    renderMap();
    const map=view.querySelector('.road-map-parchment');map.inert=true;map.setAttribute('aria-hidden','true');
    const title=kind==='pond'?'연못 건너기':'암벽 오르기';
    setHeader(title,'');
    const overlay=el('div','road-puzzle-overlay'),popup=el('section','road-puzzle-popup');popup.setAttribute('role','dialog');popup.setAttribute('aria-labelledby','road-puzzle-title');
    const top=el('header','road-puzzle-titlebar'),heading=el('h2','',title);heading.id='road-puzzle-title';
    const close=button('×',()=>changeStage('map'));close.setAttribute('aria-label','퍼즐 닫기');top.append(heading,close);popup.append(top);
    const wrap=el('div',`road-puzzle-wrap ${kind}`),board=el('div','road-puzzle-board');board.setAttribute('role','group');board.setAttribute('aria-label',kind==='pond'?'연못의 돌판':'암벽의 숫자판');
    for(let i=0;i<16;i++){const current=state.puzzle[kind]===i,b=button('',()=>selectStone(kind,i),'road-stone');b.dataset.cell=i;b.tabIndex=current?0:-1;b.classList.toggle('is-current',current);
        if(kind==='pond'){
            const [dir,n]=POND[i],paws=el('span','road-paw-cluster');paws.dataset.count=n;
            for(let paw=0;paw<n;paw++){const icon=pixelIcon('paw');icon.style.transform=`rotate(${{'↑':0,'→':90,'↓':180,'←':270}[dir]}deg)`;paws.append(icon);}
            if(!n)paws.append(pixelIcon('star'));
            b.append(paws);b.classList.toggle('is-lit',state.pondTrail.includes(i));b.setAttribute('aria-pressed',String(state.pondTrail.includes(i)));
        }else{b.append(el('span','road-stone-code',String(CLIMB[i])));b.classList.toggle('is-lit',state.climbTrail.includes(i));b.setAttribute('aria-pressed',String(state.climbTrail.includes(i)));}
        if(i===0||(kind==='pond'&&i===15))b.append(el('small','',i===0?'시작':'도착'));if(current)b.append(el('span','road-current-marker','●'));
        b.setAttribute('aria-label',`${Math.floor(i/4)+1}행 ${i%4+1}열, ${kind==='pond'?POND[i].join(' '):CLIMB[i]}${current?', 현재 위치':''}${kind==='pond'&&i===15?', 도착':''}`);board.append(b);
    }
    board.addEventListener('keydown',e=>{const dirs={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};if(!(e.key in dirs))return;e.preventDefault();e.stopPropagation();const from=Number(e.target.dataset.cell);if(!Number.isInteger(from))return;board.querySelector(`[data-cell="${clamp(from+dirs[e.key],0,15)}"]`)?.focus();});
    const actions=el('div','road-actions');actions.append(el('span','road-puzzle-progress',`${(kind==='pond'?state.pondTrail:state.climbTrail).length} / 16`),button('다시',()=>{state.puzzle[kind]=0;if(kind==='pond')state.pondTrail=[];else state.climbTrail=[];save();render();view.querySelector('[data-cell="0"]')?.focus({preventScroll:true});}));
    wrap.append(board,actions);popup.append(wrap);overlay.append(popup);view.append(overlay);
}
function selectStone(kind,index){
    {
        const result=kind==='pond'?pressPondStone(state,index):pressClimbStone(state,index);
        if(result==='wrong'||result==='reset')recordPuzzleMistake();
        if(result==='wrong'){announce('순서가 맞지 않습니다. 흰 칸은 유지됩니다.');return;}
        if(result==='reset'){save();render();view.querySelector('[data-cell="0"]')?.focus({preventScroll:true});announce('순서가 틀려 모두 초기화되었습니다. 시작 칸부터 다시 눌러 주세요.');return;}
    }
    puzzleMistakes=0;hideHelpNudge();
    state.puzzle[kind]=index;
    if(finishPuzzle(state,kind)){save();render();view.focus();announce('길이 열렸다. 지도 위에서 다음 구역으로 이동하자.');}
    else{save();render();view.querySelector(`[data-cell="${index}"]`)?.focus({preventScroll:true});}
}
function interact(){
    if(!active()||modal.open||chatOpen)return;
    if(state.stage==='forest'){const target=nearbyForestTarget(state.player);if(target)interactForest(target);else announce('주변의 수풀이나 돌에 조금 더 가까이 다가가 보자.');}
    else if(state.stage==='map'){const next=nextCheckpoint(state),metric=routeMetrics(state.choices);if(next&&Math.abs(state.mapDistance-metric.distances[next.at])<0.1)changeStage(next.id==='battle'?'battleReady':next.id);else announce('지도의 길을 따라 다음 구역으로 이동하자.');}
}
function helpAnswer(command){
    const stage=state.stage;
    if(stage==='forest')return{hint:state.notes.length?'쪽지에서 남이 권한 길과 실제로 걸은 길을 구분해 보세요.':'수풀과 돌 주변을 살펴보세요. 가까이 가면 조사할 수 있는 곳에 E가 나타나요.',plan:'수풀과 돌에 가까이 가서 E가 나타나면 조사해 보세요. 네 쪽지에서 실제로 선택한 숫자를 표지판의 상징 순서로 놓으면 돼요.',solve:'잎은 3, 달은 1, 비는 4, 별은 2예요. 표지판의 암호는 3142입니다.'}[command];
    if(stage==='pond'||stage==='climb'){const path=solvePuzzle(stage,state.puzzle[stage],stage==='climb'?state.climbTrail:[]);return{hint:stage==='pond'?'발가락이 향하는 방향과 발자국 개수를 함께 보세요.':'두 자리 숫자는 서로 다른 축을 가리켜요.',plan:stage==='pond'?'시작 칸부터 누르고 발자국 방향으로 발자국 개수만큼 떨어진 칸을 누르세요. 16칸을 순서대로 밝히세요. 흰 칸이 4개 이상일 때 틀리면 초기화돼요.':'십의 자리는 좌우 거리, 일의 자리는 상하 거리예요. 12라면 좌우 1칸과 상하 2칸을 함께 이동한 칸이에요. 0인 축은 움직이지 않아요. 시작 칸부터 16칸을 중복 없이 모두 밝히세요.',solve:path.length?`현재 위치에서 ${path.map(i=>`${Math.floor(i/4)+1}행 ${i%4+1}열`).join(' → ')} 순서로 이동하세요.`:'여기서는 출구로 이어지지 않아요. 퍼즐을 다시 시작한 뒤 경로를 확인해 보세요.'}[command];}
    if(stage==='fork'){const q=scenario(state);return{hint:'추천의 이유와 내가 중요하게 생각하는 것을 나란히 놓아 보세요.',plan:'↑·↓로 갈래를 향해 걷고 →로 계속 걸으세요. 길 끝에 도착하면 선택이 기록돼요. 제 추천과 달라도 편하게 걸어가세요. 제가 따라갈게요.',solve:`저는 ‘${q.options[q.recommended]}’을 추천해요. ${q.reason} 이 상황에 하나의 정답이 있는 것은 아니에요.`}[command];}
    if(stage==='map')return{hint:'당신이 만든 지도에 다음 장애물이 표시되어 있어요.',plan:'화살표나 WASD로 길을 따라 이동하고, 장애물에 도착하면 E로 살펴보세요. 퍼즐을 풀면 같은 지도로 돌아와요.',solve:`다음 구역은 ${nextCheckpoint(state).label}입니다. 앞으로 이동하다 멈추는 지점에서 E를 누르세요.`}[command];
    return '도움이 필요한 숲, 갈림길, 지도, 퍼즐에서 다시 불러 주세요.';
}
function showHelp(){
    if(chatOpen){closeHelp();return;}
    puzzleMistakes=0;hideHelpNudge();
    keys.clear(); chatOpen=true; chatPanel.hidden=false;
    updateForestPrompt();
    root.classList.add('road-chat-open');
    $('#road-help').setAttribute('aria-expanded','true');
    view.inert=true; $('#road-controls').inert=true;
    chatLog.setAttribute('aria-live','off'); chatLog.replaceChildren();
    appendChatMessage('tiny','안녕, 나는 티니야. 무엇을 도와줄까?\n작은 단서는 /hint\n해결 순서는 /plan\n정답 /solve\n라고 적어줘!');
    for(const item of state.chat) appendChatExchange(item);
    chatLog.setAttribute('aria-live','polite');
    chatLog.scrollTop=chatLog.scrollHeight; chatInput.focus({preventScroll:true});
}
function closeHelp(focus=true){
    if(!chatOpen)return;
    chatOpen=false; chatPanel.hidden=true; keys.clear();
    root.classList.remove('road-chat-open');
    $('#road-help').setAttribute('aria-expanded','false');
    view.inert=false; $('#road-controls').inert=false;
    if(focus&&active())$('#road-help').focus({preventScroll:true});
    save();
}
function appendChatMessage(who,message,cost){
    const row=el('article',`road-message road-message-${who}`);
    row.append(el('span','road-message-author',who==='player'?'나':'티니'),paragraph(message));
    if(cost)row.append(el('small','road-message-cost',`${cost} 토큰 사용`));
    chatLog.append(row);
}
function appendChatExchange(item){
    appendChatMessage('player',item.message??`/${item.command}`);
    appendChatMessage('tiny',item.answer,COSTS[item.command]);
}
$('#road-chat-close').addEventListener('click',()=>closeHelp());
$('#road-chat-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!active()||!chatOpen)return;
    const previousTokens=state.tokens;
    const item=sendRoadMessage(state,chatInput.value,helpAnswer);
    if(!item)return;
    if(state.tokens<previousTokens){const change=$('#road-token-change');change.textContent=`-${previousTokens-state.tokens}`;change.classList.remove('is-changing');void change.offsetWidth;change.classList.add('is-changing');clearTimeout(tokenChangeTimer);tokenChangeTimer=setTimeout(()=>{change.textContent='';change.classList.remove('is-changing');},1800);}
    chatInput.value='';appendChatExchange(item);save();updateResources();
    chatLog.scrollTop=chatLog.scrollHeight;chatInput.focus({preventScroll:true});
});
chatInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();$('#road-chat-form').requestSubmit();}
});
$('#road-help').addEventListener('click',showHelp);
$('#road-restart').addEventListener('click',()=>{const b=openModal('새로운 여정');b.append(paragraph('지금까지의 Road 진행과 기록을 지우고 숲에서 다시 시작할까요?'),button('처음부터 시작',()=>{state=freshState();chatInput.value='';closeModal();save();render();}),button('계속하기',closeModal));});
$('#road-interact').addEventListener('click',interact);
function render(){
    if(helpStage!==state.stage){helpStage=state.stage;puzzleMistakes=0;helpSuggested=false;hideHelpNudge();}
    root.dataset.stage=state.stage;
    const forestScene=hasForestScene(), forestPopup=forestPopupStages.has(state.stage);
    root.classList.toggle('road-forest-scene',forestScene);
    if(!forestPopup&&flowDialog.open)flowDialog.close();
    flowDialog.replaceChildren();
    view.replaceChildren();view.scrollTop=0;view.className=`road-view road-stage-${forestScene?'forest':state.stage}`;updateResources();$('#road-controls').hidden=!['forest','fork','map'].includes(state.stage);
    if(forestScene)renderForest();
    if(state.stage==='routeMissing'){setHeader('경로를 찾을 수 없습니다','');renderCard('','탈출하려면 당신에게 맞는 경로가 필요합니다.','이 숲을 지나는 길을 만들어 주세요.',[['계속',()=>changeStage('contract')]]);}
    else if(state.stage==='contract'){setHeader('자율성 계약','');renderCard('','나는 내 인생에 주도권을 가지는 것에 동의한다.','동의하지 않으면 여정을 진행할 수 없습니다.',[['동의',()=>changeStage('topic')],['동의하지 않음',()=>changeStage('stopped')]]);}
    else if(state.stage==='stopped'){setHeader('여정이 종료되었습니다','');renderCard('','당신은 동의하지 않았습니다.','이곳에서 여정이 멈췄습니다.',[['처음부터 다시 시작',()=>{state=freshState();chatInput.value='';save();render();}]]);}
    else if(state.stage==='topic')renderTopic();else if(state.stage==='fork')renderFork();else if(state.stage==='summary')renderMap(true);else if(state.stage==='map')renderMap();else if(state.stage==='pond'||state.stage==='climb')renderPuzzle(state.stage);
    else if(state.stage==='battleReady'){setHeader('길 위의 낯선 그림자','');renderCard('늑대와 마주침','탈출하는 길에서 늑대와 마주쳤다.','티니가 당신 곁에 멈춰 섭니다.',[['늑대와 마주하기',()=>$('#show-battle').click()],['지도로 돌아가기',()=>changeStage('map')]]);}
    if(forestPopup&&root.classList.contains('screen-active')){
        closeHelp(false);
        if(!flowDialog.open)flowDialog.showModal();
        flowDialog.querySelector('button')?.focus({preventScroll:true});
    }
}
const keyMap={w:'up',a:'left',s:'down',d:'right',arrowup:'up',arrowleft:'left',arrowdown:'down',arrowright:'right'};
window.addEventListener('keydown',e=>{
    if(!active())return;
    if(chatOpen){if(e.key==='Escape'&&!e.isComposing){e.preventDefault();closeHelp();}return;}
    if(modal.open||flowDialog.open||e.target.matches('input,textarea,select'))return;

    if(['pond','climb'].includes(state.stage)&&e.key==='Escape'){e.preventDefault();changeStage('map');return;}

    if(state.stage==='fork'&&e.key==='Escape'){
        toggleForkWindow('question',false);toggleForkWindow('recommendation',false);forkQuestionShown=true;forkRecommendationShown=true;view.focus({preventScroll:true});return;
    }
    const key=e.key.toLowerCase();if(key==='e'){e.preventDefault();interact();return;}const dir=keyMap[key];if(!dir||!['forest','fork','map'].includes(state.stage))return;e.preventDefault();
    keys.add(dir);
});
window.addEventListener('keyup',e=>keys.delete(keyMap[e.key.toLowerCase()]));
for(const b of root.querySelectorAll('[data-move]')){
    b.addEventListener('pointerdown',e=>{e.preventDefault();if(!active()||modal.open||chatOpen)return;const dir=b.dataset.move;keys.add(dir);b.setPointerCapture(e.pointerId);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.move));
    b.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();keys.add(b.dataset.move);}});b.addEventListener('keyup',()=>keys.delete(b.dataset.move));
}
function clearInput(){keys.clear();save();}
window.addEventListener('blur',clearInput);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',clearInput);window.addEventListener('resize',()=>{if(hasForestScene())positionForest();});
function frame(time){
    const dt=Math.min((time-(lastTime||time))/1000,0.05);lastTime=time;
    if(active()&&!modal.open&&!chatOpen){
        animationTime+=dt;saveElapsed+=dt;const dx=Number(keys.has('right'))-Number(keys.has('left')),dy=Number(keys.has('down'))-Number(keys.has('up'));
        if(state.stage==='forest'){const length=Math.hypot(dx,dy)||1,x=state.player.x+dx/length*180*dt,y=state.player.y+dy/length*180*dt;if(canWalk(x,state.player.y))state.player.x=x;if(canWalk(state.player.x,y))state.player.y=y;positionForest(dx,dy);}
        else if(state.stage==='fork'){
            advanceForkIntro(dt);state.fork.seconds+=dt;
            const reading=!view.querySelector('#road-fork-question').hidden||!view.querySelector('#road-fork-recommendation').hidden;
            if((dx||dy)&&!forkTransition){
                forkReady=true;
                // Up/down nudge one lane at a time. This makes the middle lane
                // reachable again after steering to either outside branch.
                if(dy&&dy!==forkLastSteer)state.fork.lane=clamp(state.fork.lane+Math.sign(dy),0,2);
                forkLastSteer=dy;
                walkFork(state,dx||Number(dy!==0),0,dt);
            }else if(!dy)forkLastSteer=0;
            const movingFork=forkReady&&!reading&&(dx!==0||dy!==0);
            if(movingFork&&forkIntroElapsed>=0.9){forkQuestionShown=true;forkRecommendationShown=true;toggleForkWindow('question',false);toggleForkWindow('recommendation',false);}
            drawFork(dt,movingFork);
            if(forkMotion.player.x>879){forkTransition+=dt;view.querySelector('.road-fork-desktop').classList.add('is-leaving');keys.clear();}
            if(forkTransition>=0.45&&choose(state)){keys.clear();save();render();view.focus({preventScroll:true});announce(state.stage==='summary'?'다섯 선택이 하나의 길로 이어졌다.':'선택이 기록되었습니다. 다음 갈림길입니다.');}
        }
        else if(state.stage==='map'){advanceMap(state,dx||-dy,dt);drawMap();}
        if(saveElapsed>0.5){saveElapsed=0;save();}
    }requestAnimationFrame(frame);
}
export function enterRoad(){root.classList.replace('screen','screen-active');keys.clear();render();if(!flowDialog.open)view.focus({preventScroll:true});}
export function exitRoad(){closeHelp(false);root.classList.replace('screen-active','screen');keys.clear();if(modal.open)closeModal();if(flowDialog.open)flowDialog.close();save();}
export function getCurrentRoadBattleBackground(){return state.stage==='forest'?'./images/battle/battle_bg_green.png':'./images/battle/battle_bg_white.png';}
save();render();requestAnimationFrame(frame);
