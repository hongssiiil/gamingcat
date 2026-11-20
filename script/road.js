import { renderIntroduction } from './road/introduction.js';
import { STAGE_STATE, STAGE_SPAN, advanceJourney } from './road/journey.js';
import { NOTES, PASSWORD, COSTS, TOPICS, SCENARIOS, POND, CLIMB } from './road/content.js';
import { ground, forestIslands, props, canWalk, nearestWalkable } from './road/collision.js';
import { pixelIcon } from './road/pixel-icons.js';
import { createForestOcclusion } from './road/occlusion.js';
import { FOREST_SIGN, nearbyForestTarget, discoverNote } from './road/forest.js';
import { createForkMotion, updateForkMotion, forkPoint } from './road/fork-motion.js';
import { STORAGE_KEY, freshState, restoreState, scenario, sendRoadMessage, choose, walkFork, puzzleMoves, solvePuzzle, nextCheckpoint, advanceMap, pressPondStone, pressClimbStone } from './road/model.js';
import { explorationRoute, createExplorationMotion, updateExplorationMotion, mapEncounter } from './road/exploration.js';
import { NODE_PUZZLES, puzzleNodeId, isPuzzleOpen, isCelebrating, openNodePuzzle, cancelNodePuzzle, completeNodePuzzle, restorePuzzleView } from './road/puzzle-flow.js';

import { createInkMap } from './road/ink-map.js';

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
let forkMotion, inkMap, forkIntroElapsed=0, forkPaused=false;
let mapRenderer,mapMotion,mapResizeObserver;
let state;
try { state = restoreState(sessionStorage.getItem(STORAGE_KEY)); } catch { state = freshState(); }
state.player = nearestWalkable(state.player);
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
const showForestCollisionDebug = new URLSearchParams(location.search).get('collisionDebug')==='1';
let forestOcclusion;
function renderForestCollisionDebug(){
    const svg=svgEl('svg',{class:'road-collision-debug',viewBox:'0 0 1023 769','aria-hidden':'true','pointer-events':'none'});
    const defs=svgEl('defs'),mask=svgEl('mask',{id:'road-collision-blocked-mask',maskUnits:'userSpaceOnUse',x:0,y:0,width:1023,height:769});
    mask.append(svgEl('rect',{width:1023,height:769,fill:'white'}));
    for(const area of [ground]){
        const points=area.map(([x,y])=>`${x},${y}`).join(' ');
        mask.append(svgEl('polygon',{points,fill:'black'}));
    }
    defs.append(mask);svg.append(defs);
    svg.append(svgEl('rect',{width:1023,height:769,class:'road-collision-blocked-wash',mask:'url(#road-collision-blocked-mask)'}));
    for(const area of [ground]){
        const points=area.map(([x,y])=>`${x},${y}`).join(' ');
        svg.append(svgEl('polygon',{points,class:'road-collision-walkable'}));
    }
    for(const island of forestIslands){
        const points=island.map(([x,y])=>`${x},${y}`).join(' ');
        svg.append(svgEl('polygon',{points,class:'road-collision-island'}));
    }
    for(const {box:[x,y,width,height]} of props)svg.append(svgEl('rect',{x,y,width,height,class:'road-collision-prop'}));
    svg.append(svgEl('ellipse',{id:'road-debug-feet',rx:7,ry:4,fill:'#fff',stroke:'#137de8','stroke-width':2}));
    return svg;
}
function renderForest() {
    setHeader('이름 없는 숲', 'WASD 이동 · E 상호작용');
    const viewport = el('div','road-forest-viewport'), world = el('div','road-forest-world');
    const bg = el('img','road-forest-image'); bg.src = './images/backgrounds/road_white.png'; bg.alt = '갈림길이 있는 어두운 숲'; bg.draggable = false; world.append(bg);
    forestOcclusion=createForestOcclusion();world.append(forestOcclusion.element);
    if(state.stage==='forest'&&showForestCollisionDebug){
        world.append(renderForestCollisionDebug());
        const legend=el('div','road-collision-legend');
        for(const [kind,label] of [['walkable','이동 가능 영역'],['blocked','이동 불가 영역'],['island','숲 장애물'],['prop','오브젝트 발밑 충돌']]){
            const item=el('span',`road-collision-legend-item ${kind}`);item.append(el('i'),el('span','',label));legend.append(item);
        }
        view.append(legend);
    }
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
    forestOcclusion?.update(state.player.y);
    world.querySelector('.road-sign-object').style.zIndex=state.player.y<483?'4':'2';
    const feet=world.querySelector('#road-debug-feet');
    if(feet){feet.setAttribute('cx',state.player.x);feet.setAttribute('cy',state.player.y);}
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
    const inscription=el('p','road-sign-inscription');
    inscription.append(el('span','','자신의 선택에 따라 길은 뚫고 날은 뜨고'),el('span','','비가 내리고 빛은 남는다.'));b.append(inscription);
    const form=el('form','road-sign-form'),label=el('p','road-sign-label','네 자리 암호'),slots=el('div','road-password-slots'),feedback=el('p','road-sign-feedback');
    label.id='road-password-label';slots.setAttribute('role','group');slots.setAttribute('aria-labelledby',label.id);
    feedback.id='road-password-feedback';feedback.setAttribute('role','status');
    let rejecting=false;
    const inputs=Array.from({length:4},(_,i)=>{
        const input=el('input');input.type='text';input.inputMode='numeric';input.maxLength=1;input.autocomplete='off';input.placeholder='_';
        input.setAttribute('aria-label',`암호 ${i+1}번째 숫자`);input.setAttribute('aria-describedby',feedback.id);
        input.addEventListener('focus',()=>input.select());
        input.addEventListener('input',()=>{
            input.value=input.value.replace(/[^0-9]/g,'').slice(-1);
            if(input.value&&i<3)inputs[i+1].focus();
        });
        input.addEventListener('paste',event=>{
            event.preventDefault();const digits=event.clipboardData.getData('text').replace(/[^0-9]/g,'').slice(0,4-i);
            if(!digits)return;[...digits].forEach((digit,n)=>inputs[i+n].value=digit);inputs[Math.min(3,i+digits.length)].focus();
        });
        input.addEventListener('keydown',event=>{
            if(event.key==='Backspace'){event.preventDefault();if(input.value)input.value='';else if(i){inputs[i-1].value='';inputs[i-1].focus();}}
            if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();inputs[clamp(i+(event.key==='ArrowLeft'?-1:1),0,3)].focus();}
        });slots.append(input);return input;
    });
    const submit=button('자물쇠 열기',()=>{},'road-sign-submit');submit.type='submit';
    form.append(label,slots,submit,feedback);
    form.addEventListener('submit',event=>{
        event.preventDefault();if(rejecting)return;
        if(inputs.some(input=>!input.value)){feedback.textContent='네 자리 숫자를 모두 새겨 주세요.';inputs.find(input=>!input.value).focus();return;}
        if(inputs.map(input=>input.value).join('')===PASSWORD){state.events.push({type:'password-solved'});closeModal();changeStage('routeMissing');return;}
        rejecting=true;feedback.textContent='자물쇠가 열리지 않습니다. 다시 시도해 주세요.';slots.classList.add('is-wrong');submit.disabled=true;
        inputs.forEach(input=>{input.disabled=true;input.setAttribute('aria-invalid','true');});
        setTimeout(()=>{slots.classList.remove('is-wrong');inputs.forEach(input=>{input.value='';input.disabled=false;input.removeAttribute('aria-invalid');});submit.disabled=false;rejecting=false;if(modal.open&&slots.isConnected)inputs[0].focus();},550);
    });
    b.append(form);inputs[0].focus();
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
function intro(stage){renderIntroduction(flowDialog,stage,{advance:changeStage,choose:topic=>{state.topic=topic;state.interest='';changeStage('fork');}});}
function renderTopic(){intro('topic');}
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs={},text){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!=null)n.textContent=text;return n;}
function forkScenario(){return SCENARIOS[state.topic][state.inkJourney.index];}
function syncForkControls(){
    const j=state.inkJourney,q=forkScenario(),sheet=view.querySelector('.road-ink-map');if(!sheet)return;
    sheet.dataset.stageState=j.phase;
    sheet.dataset.cameraX=j.cameraX.toFixed(2);sheet.dataset.zoom=j.zoom.toFixed(3);
    sheet.querySelector('h2').textContent=j.phase===STAGE_STATE.COMPLETE?'다섯 번의 선택, 하나로 이어진 길':q.prompt;
    sheet.querySelector('.road-ink-description').textContent=j.phase===STAGE_STATE.COMPLETE?'완성된 선택 기록: '+state.choices.map((c,i)=>(i+1)+'. '+c.label).join(', '):'WASD 또는 방향키로 자유롭게 걸어 랜드마크에 도착하세요. 티니의 추천: '+q.options[q.recommended]+'. '+q.reason;
    sheet.querySelector('.road-ink-pause').hidden=j.phase===STAGE_STATE.COMPLETE;
    sheet.querySelector('.road-ink-finish').hidden=j.phase!==STAGE_STATE.COMPLETE;
}
function renderFork(){
    const j=state.inkJourney,q=forkScenario();
    setHeader(q.prompt,'',String(Math.min(5,state.choices.length+1))+' / 05');
    forkMotion=createForkMotion(j.arrivedFork??state.fork);forkIntroElapsed=j.index>0?4:0;forkPaused=false;
    if(j.arrivalActors){forkMotion.player={...j.arrivalActors.player};forkMotion.cat={...j.arrivalActors.cat};}
    const viewport=el('div','road-ink-viewport'),sheet=el('section','road-ink-map');
    sheet.setAttribute('aria-label','잉크로 그리는 선택 지도');
    const title=el('h2','road-sr-only',q.prompt),desc=el('p','road-sr-only road-ink-description',
        'WASD 또는 방향키로 이동합니다. 티니는 추천 길로 당깁니다. Space: 일시정지. 추천: '+q.options[q.recommended]+'. '+q.reason);
    const canvas=el('canvas','road-ink-canvas');canvas.setAttribute('aria-hidden','true');
    const pause=button('Ⅱ 잠시 멈춤',()=>{forkPaused=!forkPaused;pause.textContent=forkPaused?'▶ 계속 걷기':'Ⅱ 잠시 멈춤';pause.setAttribute('aria-pressed',String(forkPaused));},'road-ink-pause');
    pause.setAttribute('aria-pressed','false');
    const finish=button('완성한 길 위에서 출발하기 →',()=>changeStage('map'),'road-ink-finish');finish.hidden=true;
    sheet.append(canvas,title,desc,pause,finish);
    viewport.append(sheet);view.append(viewport);inkMap=createInkMap(canvas);syncForkControls();drawFork();
}
function drawFork(dt=0){
    const j=state.inkJourney,q=forkScenario();if(!q||!forkMotion)return;
    const frozen=[STAGE_STATE.ARRIVED,STAGE_STATE.PANNING,STAGE_STATE.ZOOMING,STAGE_STATE.COMPLETE].includes(j.phase);
    const f=frozen?j.arrivedFork:state.fork;
    if(!frozen)updateForkMotion(forkMotion,f,q.recommended,dt);
    inkMap.draw(q,f,forkMotion,j.index+1,state.interest||state.topic,{intro:Math.max(0,4-forkIntroElapsed),paused:forkPaused,journey:j,completedPaths:state.completedPaths});
    const sheet=view.querySelector('.road-ink-map');sheet.dataset.cameraX=j.cameraX.toFixed(2);sheet.dataset.zoom=j.zoom.toFixed(3);
}
function renderMap(summary=false){
    if(summary){state.stage='fork';state=restoreState(JSON.stringify(state));save();render();return;}
    setHeader('당신이 그린 숲길','','');
    const viewport=el('div','road-explore-viewport'),sheet=el('section','road-ink-map road-explore-map');
    sheet.setAttribute('aria-label','당신이 그린 숲길 탐험 지도');
    sheet.append(el('h2','road-sr-only','당신이 그린 숲길'));
    const description=el('p','road-sr-only road-explore-description');
    description.setAttribute('aria-live','polite');sheet.append(description);
    const canvas=el('canvas','road-ink-canvas');canvas.setAttribute('aria-hidden','true');sheet.append(canvas);
    const action=button('',interact,'road-explore-action');action.hidden=true;sheet.append(action);
    for(const [direction,label] of [['left','A'],['right','D']]){
        const control=button('',()=>{},'road-explore-move');
        control.dataset.direction=direction;control.setAttribute('aria-label',direction==='left'?'왼쪽으로 걷기':'오른쪽으로 걷기');
        control.textContent=label;
        control.addEventListener('pointerdown',event=>{
            event.preventDefault();if(state.stage!=='map'||modal.open||chatOpen)return;
            keys.clear();keys.add(direction);control.setPointerCapture(event.pointerId);
        });
        for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,()=>keys.delete(direction));
        control.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();keys.add(direction);}});
        control.addEventListener('keyup',()=>keys.delete(direction));sheet.append(control);
    }
    viewport.append(sheet);view.append(viewport);
    const resize=()=>{
        const width=Math.min(800,Math.max(480,Math.round(viewport.clientWidth)));
        if(mapRenderer&&canvas.width===width)return;
        sheet.style.aspectRatio=width+'/480';
        mapRenderer=createInkMap(canvas,{width});
        if(!mapMotion||mapMotion.route!==explorationRoute(state.completedPaths)||mapMotion.width!==width){
            mapMotion=createExplorationMotion(state,width);restorePuzzleView(state,mapMotion);
        }
        delete sheet.dataset.status;
        drawMap();
    };
    resize();mapResizeObserver=new ResizeObserver(resize);mapResizeObserver.observe(viewport);
}
function drawMap(dt=0){
    if(!mapRenderer||!mapMotion)return;
    updateExplorationMotion(mapMotion,state,dt);mapRenderer.drawExploration(state,mapMotion);
    const at=mapEncounter(state),sheet=view.querySelector('.road-explore-map');if(!sheet)return;
    const puzzleOpen=isPuzzleOpen(state),celebrating=isCelebrating(mapMotion);
    sheet.dataset.cameraX=mapMotion.cameraX.toFixed(2);sheet.dataset.distance=state.mapDistance.toFixed(2);
    sheet.dataset.blocked=at?.id??'';sheet.dataset.furthest=state.mapFurthest.toFixed(2);
    sheet.dataset.isBlocked=String(Boolean(at)||celebrating);sheet.dataset.puzzleOpen=String(puzzleOpen);
    sheet.dataset.clearedNodes=state.completed.map(puzzleNodeId).filter(Boolean).join(',');
    sheet.dataset.clearEffect=mapMotion.clearEffect?.nodeId??'';
    const action=sheet.querySelector('.road-explore-action'),status=puzzleOpen?'puzzle:'+state.stage:celebrating?'clearing':at?.id??'walking';
    if(sheet.dataset.status!==status){
        sheet.dataset.status=status;action.hidden=!at||puzzleOpen||celebrating;action.disabled=action.hidden;action.dataset.encounter=at?.id??'';
        sheet.querySelectorAll('.road-explore-move').forEach(b=>{b.disabled=puzzleOpen||celebrating;});
        if(at&&!puzzleOpen){
            const label=at.id==='battle'?'늑대와 마주하기 [E]':'구간 갈아끼우기 [E]';
            action.textContent=label;
        }
        sheet.querySelector('.road-explore-description').textContent=puzzleOpen?'오른쪽 퍼즐 패널에서 구간을 갈아끼우는 중입니다. 지도 이동은 잠시 멈춥니다.':celebrating?'돌이 사라지고 잉크 길이 이어졌습니다.':at?'! 여기 장애물이 있다 ! '+at.label+'. A/D 또는 좌우 방향키로 이동 (막힘). E로 '+(at.id==='battle'?'늑대와 마주하기.':'구간 갈아끼우기.'):'A/D 또는 좌우 방향키로 직접 그린 잉크 길을 탐험하세요.';
    }
}
function openPuzzle(nodeId){
    if(!openNodePuzzle(state,nodeId,mapMotion))return;
    keys.clear();root.dataset.stage=state.stage;helpStage=state.stage;puzzleMistakes=0;helpSuggested=false;hideHelpNudge();save();
    renderPuzzle({nodeId});view.querySelector('.road-puzzle-dock [tabindex="0"]')?.focus({preventScroll:true});
}
function closePuzzlePanel(){
    view.querySelector('.road-puzzle-dock')?.remove();
    const sheet=view.querySelector('.road-explore-map');if(sheet)delete sheet.dataset.puzzleNode;
    root.dataset.stage=state.stage;keys.clear();helpStage=state.stage;puzzleMistakes=0;helpSuggested=false;hideHelpNudge();drawMap();save();
}
function cancelPuzzle(){
    if(!cancelNodePuzzle(state))return;
    closePuzzlePanel();view.querySelector('.road-explore-action')?.focus({preventScroll:true});
}
function onPuzzleSuccess(nodeId){
    if(!completeNodePuzzle(state,nodeId,mapMotion))return false;
    closePuzzlePanel();view.focus({preventScroll:true});announce('돌이 사라지고 길이 이어졌습니다. 티니와 다시 걸어 보세요.');return true;
}
function renderPuzzle({nodeId}){
    const kind=NODE_PUZZLES[nodeId];if(!kind)return;
    if(!view.querySelector('.road-explore-map'))renderMap();
    const map=view.querySelector('.road-explore-map');
    map.querySelector('.road-puzzle-dock')?.remove();map.dataset.puzzleNode=nodeId;
    drawMap();
    const title=kind==='pond'?'연못 건너기':'암벽 오르기';
    setHeader(title,'');
    const popup=el('section','road-puzzle-popup road-puzzle-dock');popup.dataset.nodeId=nodeId;
    popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','road-puzzle-title');
    popup.append(el('p','road-puzzle-kicker','구간 갈아끼우기 · '+String(nodeId).padStart(2,'0')));
    const top=el('header','road-puzzle-titlebar'),heading=el('h2','',title);heading.id='road-puzzle-title';
    const close=button('×',cancelPuzzle);close.setAttribute('aria-label','퍼즐 닫기');top.append(heading,close);popup.append(top);
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
    const actions=el('div','road-actions');actions.append(el('span','road-puzzle-progress',`${(kind==='pond'?state.pondTrail:state.climbTrail).length} / 16`),button('다시',()=>{state.puzzle[kind]=0;if(kind==='pond')state.pondTrail=[];else state.climbTrail=[];save();renderPuzzle({nodeId});view.querySelector('[data-cell="0"]')?.focus({preventScroll:true});}));
    wrap.append(board,actions);popup.append(wrap);map.append(popup);
}
function selectStone(kind,index){
    {
        const result=kind==='pond'?pressPondStone(state,index):pressClimbStone(state,index);
        if(result==='wrong'||result==='reset')recordPuzzleMistake();
        if(result==='wrong'){announce('순서가 맞지 않습니다. 흰 칸은 유지됩니다.');return;}
        if(result==='reset'){save();renderPuzzle({nodeId:puzzleNodeId(kind)});view.querySelector('[data-cell="0"]')?.focus({preventScroll:true});announce('순서가 틀려 모두 초기화되었습니다. 시작 칸부터 다시 눌러 주세요.');return;}
    }
    puzzleMistakes=0;hideHelpNudge();
    state.puzzle[kind]=index;
    if(!onPuzzleSuccess(puzzleNodeId(kind))){save();renderPuzzle({nodeId:puzzleNodeId(kind)});view.querySelector(`[data-cell="${index}"]`)?.focus({preventScroll:true});}
}
function interact(){
    if(!active()||modal.open||chatOpen)return;
    if(state.stage==='forest'){const target=nearbyForestTarget(state.player);if(target)interactForest(target);else announce('주변의 수풀이나 돌에 조금 더 가까이 다가가 보자.');}
    else if(state.stage==='map'){
        const at=mapEncounter(state);
        if(!at){announce('잉크 길을 따라 다음 구역으로 이동하세요.');return;}
        if(at.id==='battle'){changeStage('battleReady');$('#show-battle').click();}
        else openPuzzle(at.at);
    }
}
function helpAnswer(command){
    const stage=state.stage;
    if(stage==='forest')return{hint:state.notes.length?'쪽지에서 남이 권한 길과 실제로 걸은 길을 구분해 보세요.':'수풀과 돌 주변을 살펴보세요. 가까이 가면 조사할 수 있는 곳에 E가 나타나요.',plan:'수풀과 돌에 가까이 가서 E가 나타나면 조사해 보세요. 네 쪽지에서 실제로 선택한 숫자를 표지판의 상징 순서로 놓으면 돼요.',solve:'잎은 3, 달은 1, 비는 4, 별은 2예요. 표지판의 암호는 3142입니다.'}[command];
    if(stage==='pond'||stage==='climb'){const path=solvePuzzle(stage,state.puzzle[stage],stage==='climb'?state.climbTrail:[]);return{hint:stage==='pond'?'발가락이 향하는 방향과 발자국 개수를 함께 보세요.':'두 자리 숫자는 서로 다른 축을 가리켜요.',plan:stage==='pond'?'시작 칸부터 누르고 발자국 방향으로 발자국 개수만큼 떨어진 칸을 누르세요. 16칸을 순서대로 밝히세요. 흰 칸이 4개 이상일 때 틀리면 초기화돼요.':'십의 자리는 좌우 거리, 일의 자리는 상하 거리예요. 12라면 좌우 1칸과 상하 2칸을 함께 이동한 칸이에요. 0인 축은 움직이지 않아요. 시작 칸부터 16칸을 중복 없이 모두 밝히세요.',solve:path.length?`현재 위치에서 ${path.map(i=>`${Math.floor(i/4)+1}행 ${i%4+1}열`).join(' → ')} 순서로 이동하세요.`:'여기서는 출구로 이어지지 않아요. 퍼즐을 다시 시작한 뒤 경로를 확인해 보세요.'}[command];}
    if(stage==='fork'){const q=forkScenario();return{hint:'추천의 이유와 내가 중요하게 생각하는 것을 나란히 놓아 보세요.',plan:'WASD 또는 방향키로 원하는 곳으로 걸어가세요. 저는 추천 길로 계속 당겨요. 대각선으로 움직이거나 되돌아가며 방향을 조절할 수 있어요. 랜드마크에 도착하면 선택이 기록돼요.',solve:`저는 ‘${q.options[q.recommended]}’을 추천해요. ${q.reason} 이 상황에 하나의 정답이 있는 것은 아니에요.`}[command];}
    if(stage==='map')return{hint:'당신이 만든 지도에 다음 장애물이 표시되어 있어요.',plan:'A/D 또는 좌우 방향키로 잉크 길을 따라 걸어 보세요. 장애물 앞에서 E를 누르면 오른쪽 퍼즐로 구간을 갈아끼울 수 있어요. 퍼즐을 풀면 같은 자리에서 길이 이어져요.',solve:`다음 구역은 ${nextCheckpoint(state).label}입니다. 앞으로 이동하다 멈추는 지점에서 E를 누르세요.`}[command];
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
    mapResizeObserver?.disconnect();mapResizeObserver=null;mapRenderer=null;
    if(helpStage!==state.stage){helpStage=state.stage;puzzleMistakes=0;helpSuggested=false;hideHelpNudge();}
    root.dataset.stage=state.stage;
    const forestScene=hasForestScene(), forestPopup=forestPopupStages.has(state.stage);
    root.classList.toggle('road-forest-scene',forestScene);
    if(!forestPopup&&flowDialog.open)flowDialog.close();
    flowDialog.replaceChildren();
    view.replaceChildren();view.scrollTop=0;view.className=`road-view road-stage-${forestScene?'forest':state.stage}`;updateResources();$('#road-controls').hidden=!['forest','fork','map'].includes(state.stage);
    if(forestScene)renderForest();
    if(state.stage==='routeMissing')intro('routeMissing');
    else if(state.stage==='contract')intro('contract');
    else if(state.stage==='stopped'){setHeader('여정이 종료되었습니다','');renderCard('','당신은 동의하지 않았습니다.','이곳에서 여정이 멈췄습니다.',[['처음부터 다시 시작',()=>{state=freshState();chatInput.value='';save();render();}]]);}
    else if(state.stage==='topic')renderTopic();else if(state.stage==='fork')renderFork();else if(state.stage==='summary')renderMap(true);else if(state.stage==='map')renderMap();else if(isPuzzleOpen(state))renderPuzzle({nodeId:puzzleNodeId(state.stage)});
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

    if(isPuzzleOpen(state)&&e.key==='Escape'){e.preventDefault();cancelPuzzle();return;}

    if(state.stage==='fork'&&['Escape',' '].includes(e.key)&&!e.target.closest('button')){
        e.preventDefault();if(!e.repeat)view.querySelector('.road-ink-pause')?.click();return;
    }
    if(state.stage==='fork'&&state.inkJourney.phase!==STAGE_STATE.ACTIVE)return;
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
            const j=state.inkJourney;
            if(!forkPaused){
                if(j.phase===STAGE_STATE.ACTIVE){
                    const input=dx!==0||dy!==0;
                    forkIntroElapsed=input?4:forkIntroElapsed+dt;state.fork.seconds+=dt;
                    if(forkIntroElapsed>=4)walkFork(state,dx,dy,dt);
                    drawFork(forkIntroElapsed>=4?dt:0);
                    if(state.fork.progress>=1){
                        const end=forkPoint(state.fork.lane,1,state.fork.startY);
                        forkMotion.player={...end};forkMotion.playerMoving=false;forkMotion.catMoving=false;forkMotion.tension=0;
                        choose(state,{continuous:true});
                        state.inkJourney.arrivalActors={player:{...forkMotion.player},cat:{...forkMotion.cat}};
                        keys.clear();syncForkControls();save();announce('선택한 랜드마크에 도착했습니다.');
                    }
                }else if(j.phase!==STAGE_STATE.COMPLETE){
                    keys.clear();
                    if(j.phase===STAGE_STATE.ARRIVED){
                        // Let Tiny settle beside the player; keep both in world position while panning.
                        const rate=1-Math.exp(-8*dt);
                        forkMotion.cat.x+=(forkMotion.player.x-24-forkMotion.cat.x)*rate;
                        forkMotion.cat.y+=(forkMotion.player.y-forkMotion.cat.y)*rate;
                        j.arrivalActors={player:{...forkMotion.player},cat:{...forkMotion.cat}};
                    }
                    if(advanceJourney(j,dt,state.completedPaths)){
                        if(j.phase===STAGE_STATE.NEXT_FORK){
                            forkMotion.player.x-=STAGE_SPAN;forkMotion.cat.x-=STAGE_SPAN;
                            state.fork.ink=[[80,state.fork.startY]];forkIntroElapsed=4;
                            forkMotion.tension=0;
                        }
                        syncForkControls();save();
                        if(j.phase===STAGE_STATE.ACTIVE)announce('다음 갈림길입니다. 방향키로 원하는 길을 걸으세요.');
                        if(j.phase===STAGE_STATE.COMPLETE)announce('다섯 번의 선택으로 완성한 전체 지도입니다.');
                    }
                    drawFork(0);
                }else drawFork(0);
            }else drawFork(0);
        }
        else if(state.stage==='map'){if(!isCelebrating(mapMotion))advanceMap(state,dx,dt);drawMap(dt);}
        else if(isPuzzleOpen(state))drawMap(dt);
        if(saveElapsed>0.5){saveElapsed=0;save();}
    }requestAnimationFrame(frame);
}
export function enterRoad(){root.classList.replace('screen','screen-active');keys.clear();render();if(!flowDialog.open)view.focus({preventScroll:true});}
export function exitRoad(){closeHelp(false);root.classList.replace('screen-active','screen');keys.clear();if(modal.open)closeModal();if(flowDialog.open)flowDialog.close();save();}
export function getCurrentRoadBattleBackground(){return state.stage==='forest'?'./images/battle/battle_bg_green.png':'./images/battle/battle_bg_white.png';}
export function getEndingJourney(){return {choices:state.choices,events:state.events,battles:state.battleHistory||[],notes:state.notes,completed:state.completed,pondTrail:state.pondTrail,climbTrail:state.climbTrail};}
export function saveBattleChoice(turn){state.battleHistory??=[];if(!state.battleHistory.includes(turn))state.battleHistory.push(turn);save();}
export function restartJourney(){state=freshState();chatInput.value='';save();enterRoad();}
save();render();requestAnimationFrame(frame);
