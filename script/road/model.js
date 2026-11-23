import { initialJourney, finishJourneyStage, restoreJourney } from './journey.js';
import { explorationRoute, explorationLimit, mapEncounter } from './exploration.js';
import { advanceFork } from './fork-physics.js';
import { COSTS, CHECKPOINTS, SCENARIOS, TOPICS, NOTES } from './content.js';
import { puzzleTiles, validPuzzle, startPuzzle, hasUniqueClimbMoves, hasLimitedPondSteps } from './puzzle-generator.js';
export const STORAGE_KEY = 'gamingCatRoadV2';
export const STAGES = ['forest', 'routeMissing', 'contract', 'stopped', 'topic', 'fork', 'summary', 'map', 'pond', 'climb', 'battleReady'];
export function freshState() {
    return { version: 2, tokenBudgetVersion:1, stage: 'forest', tokens: 20, notes: [], topic: '', interest: '',
        choices: [], completedPaths: [], inkJourney: initialJourney(), events: [], chat: [], player: { x: 340, y: 483 }, mapDistance: 0,
        mapPathVersion:1,mapFurthest:0,puzzleBoards:{},
        completed: [], pondTrail: [], climbTrail: [], puzzle: { pond: 0, climb: 0 }, fork: { startY:270, lane: 1, progress: 0, resistance: 0, seconds: 0, resisted: false } };
}
export function restoreState(raw) {
    try {
        const s = JSON.parse(raw);
        if (!s || s.version !== 2 || !STAGES.includes(s.stage)) return freshState();
        if (!Number.isFinite(s.tokens) || s.tokens > (s.tokenBudgetVersion===1?20:10) || !Array.isArray(s.notes) || !Array.isArray(s.choices) || s.choices.length > 5) return freshState();
        if (!Array.isArray(s.events) || !Array.isArray(s.chat) || !Array.isArray(s.completed)) return freshState();
        if (s.notes.some(id => !NOTES.some(note => note.id === id)) || new Set(s.notes).size !== s.notes.length) return freshState();
        if (typeof s.interest !== 'string' || s.interest.length > 40 || typeof s.topic !== 'string') return freshState();
        if (s.events.some(e => !e || typeof e.type !== 'string') || s.chat.some(c => !c || !(Object.hasOwn(COSTS,c.command) || (c.command === null && typeof c.message === 'string')) || typeof c.answer !== 'string' || (c.message !== undefined && typeof c.message !== 'string'))) return freshState();
        if (!s.player || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y) || !Number.isFinite(s.mapDistance)) return freshState();
        if (!s.fork || !Number.isInteger(s.fork.lane) || s.fork.lane < 0 || s.fork.lane > 2 || !['progress', 'resistance', 'seconds'].every(k => Number.isFinite(s.fork[k]) && s.fork[k] >= 0)) return freshState();
        if (!s.puzzle || !['pond', 'climb'].every(k => Number.isInteger(s.puzzle[k]) && s.puzzle[k] >= 0 && s.puzzle[k] < 16)) return freshState();
        if (s.choices.some(c => !c || !Number.isInteger(c.selected) || c.selected < 0 || c.selected > 2 || !Number.isInteger(c.recommended) || c.recommended < 0 || c.recommended > 2 || !Array.isArray(c.options) || c.options.length !== 3 || c.options.some(o => typeof o !== 'string') || typeof c.label !== 'string' || !Number.isFinite(c.seconds))) return freshState();
        if (['fork', 'summary', 'map', 'pond', 'climb', 'battleReady'].includes(s.stage) && !TOPICS.includes(s.topic)) return freshState();
        if (s.stage === 'fork' && s.choices.length >= 5 && !['ARRIVED','ZOOMING','COMPLETE'].includes(s.inkJourney?.phase)) return freshState();
        if (['summary', 'map', 'pond', 'climb', 'battleReady'].includes(s.stage) && s.choices.length !== 5) return freshState();
        if (s.completed.some(k => !['pond', 'climb', 'tutorial'].includes(k))) return freshState();
        if (s.mapDistance < 0 || s.fork.progress > 1 || s.player.x < 0 || s.player.x > 1023 || s.player.y < 0 || s.player.y > 769) return freshState();
        if(s.fork.acceptedLane!=null&&![0,1,2].includes(s.fork.acceptedLane))s.fork.acceptedLane=null;
        for(const key of ['position','catPosition'])if(s.fork[key]&&(!Number.isFinite(s.fork[key].x)||!Number.isFinite(s.fork[key].y)||s.fork[key].x<0||s.fork[key].x>800||s.fork[key].y<0||s.fork[key].y>480))delete s.fork[key];
        if(s.fork.ink!=null&&(!Array.isArray(s.fork.ink)||s.fork.ink.length>1600||s.fork.ink.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>800||p[1]<0||p[1]>480)))s.fork.ink=[];
        s.puzzleBoards=s.puzzleBoards&&typeof s.puzzleBoards==='object'&&!Array.isArray(s.puzzleBoards)?s.puzzleBoards:{};
        for(const kind of ['pond','climb'])if(s.puzzleBoards[kind]&&!validPuzzle(kind,s.puzzleBoards[kind]))startPuzzle(s,kind);
        // Replace ambiguous unfinished saves without losing the journey or cleared obstacles.
        if(!s.completed.includes('climb')&&(s.puzzleBoards.climb||s.stage==='climb')&&!hasUniqueClimbMoves(s.puzzleBoards.climb))startPuzzle(s,'climb');
        if(!s.completed.includes('pond')&&(s.puzzleBoards.pond||s.stage==='pond')&&!hasLimitedPondSteps(s.puzzleBoards.pond))startPuzzle(s,'pond');
        const path=solvePuzzle('pond',0,[],s);
        if(!Array.isArray(s.pondTrail)||s.pondTrail.length>16||s.pondTrail.some((cell,i)=>cell!==path[i])){
            s.pondTrail=[];s.puzzle.pond=0;
        }else s.puzzle.pond=s.pondTrail.at(-1)??0;
        if(!Array.isArray(s.climbTrail)||s.climbTrail.length>16||new Set(s.climbTrail).size!==s.climbTrail.length||s.climbTrail.some((cell,i)=>!Number.isInteger(cell)||cell<0||cell>15||(i===0?cell!==0:!puzzleMoves('climb',s.climbTrail[i-1],s).includes(cell))))s.climbTrail=[];
        s.puzzle.climb=s.climbTrail.at(-1)??0;
        restoreJourney(s);
        const route=explorationRoute(s.completedPaths);
        if(s.mapPathVersion!==1){
            // Preserve progress from the old six-point SVG map, including an
            // encounter saved at a node rather than in front of its collider.
            const old=routeMetrics(s.choices),d=s.mapDistance;
            if(d>old.total)return freshState();
            let previous=0;
            for(let i=1;i<old.distances.length;i++){
                if(d<=old.distances[i]){
                    const start=i===1?0:route.nodes[i-2].distance,end=route.nodes[i-1].distance;
                    s.mapDistance=start+(end-start)*(d-previous)/(old.distances[i]-previous);break;
                }
                previous=old.distances[i];
            }
            s.mapDistance=Math.min(s.mapDistance,explorationLimit(s,route).distance);
            s.mapPathVersion=1;s.mapFurthest=s.mapDistance;
        }
        if(s.mapDistance>route.total+.01)return freshState();
        s.mapDistance=Math.min(s.mapDistance,explorationLimit(s,route).distance);
        s.mapFurthest=Math.max(s.mapDistance,Math.min(route.total,Number.isFinite(s.mapFurthest)?s.mapFurthest:0));
        // Preserve what was spent from the old ten-token allowance, exactly once.
        if(s.tokenBudgetVersion!==1){s.tokens+=10;s.tokenBudgetVersion=1;}
        return s;
    } catch { return freshState(); }
}
export function scenario(state) { return SCENARIOS[state.topic]?.[state.choices.length]; }
export function useHelp(state, command, answer) {
    if (!Object.hasOwn(COSTS,command)) return false;
    state.tokens -= COSTS[command];
    state.events.push({ type: 'help', stage: state.stage, command, cost: COSTS[command], tokens: state.tokens });
    state.chat.push({ command, stage: state.stage, answer });
    return true;
}
export function sendRoadMessage(state, raw, answerFor) {
    const message = raw.trim();
    if (!message || message.length > 300) return null;
    const match = /^\/(hint|plan|solve)(?=\s|$)/i.exec(message);
    const command = match?.[1].toLowerCase();
    if (command && ['forest','fork','map','pond','climb'].includes(state.stage)) {
        useHelp(state, command, answerFor(command));
        state.chat.at(-1).message = message;
    } else {
        const answer = command
            ? '지금은 도움을 쓸 문제가 없어요. 숲이나 갈림길, 지도, 퍼즐에서 다시 불러 주세요. 토큰은 사용하지 않았어요.'
            : message.startsWith('/')
                ? '그 명령은 아직 몰라요. /hint, /plan, /solve 중 하나를 입력해 주세요. 토큰은 사용하지 않았어요.'
                : '무엇을 도와드릴까요? 작은 단서는 /hint, 해결 순서는 /plan, 정답이 궁금하면 /solve를 입력해 주세요.';
        state.chat.push({ command: null, message, stage: state.stage, answer });
    }
    return state.chat.at(-1);
}
export function choose(state, {continuous=false}={}) {
    const q = scenario(state);
    if (!q || state.fork.progress < 1) return false;
    state.choices.push({ scene: `fork-${state.choices.length + 1}`, topic: state.topic,
        prompt: q.prompt, options: [...q.options], recommended: q.recommended,
        selected: state.fork.lane, path: ['up', 'right', 'down'][state.fork.lane],
        label: q.options[state.fork.lane], resisted: state.fork.resisted,
        seconds: Math.round(state.fork.seconds * 10) / 10,
        recordedAt: Date.now(),
        helpCount: state.events.filter(e => e.type === 'help').length });
    const oldFork=state.fork;
    state.fork = { lane: 1, progress: 0, resistance: 0, seconds: 0, resisted: false };
    finishJourneyStage(state,oldFork,state.choices.at(-1),continuous);
    if (state.choices.length === 5 && !continuous) state.stage = 'summary';
    return true;
}
export function moveFork(state, direction, dt) {
    if(state.inkJourney?.phase!=='ACTIVE')return;
    const q=scenario(state);if(!q)return;
    const lane=state.fork.lane;
    advanceFork(state.fork,q.recommended,direction<0?-1:direction&&lane===1?1:0,direction>0?(lane===0?-1:lane===2?1:0):0,dt);
}
export function walkFork(state, dx, dy, dt) {
    if(state.inkJourney?.phase!=='ACTIVE')return;
    const q=scenario(state);if(q)advanceFork(state.fork,q.recommended,dx,dy,dt);
}
export function puzzleMoves(kind, from, state) {
    const tiles=puzzleTiles(state,kind);
    const row = Math.floor(from / 4), col = from % 4;
    let candidates;
    if (kind === 'pond') {
        const [direction, n] = tiles[from];
        const [dx, dy] = ({ '→': [1, 0], '←': [-1, 0], '↑': [0, -1], '↓': [0, 1] })[direction] || [0, 0];
        candidates = n ? [[col + dx * n, row + dy * n]] : [];
    } else {
        const h = Math.floor(tiles[from] / 10), v = tiles[from] % 10;
        candidates = [-1,1].flatMap(dx=>[-1,1].map(dy=>[col+dx*h,row+dy*v]));
    }
    return [...new Set(candidates.filter(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4).map(([x, y]) => y * 4 + x))].filter(cell=>cell!==from);
}
export function solvePuzzle(kind, start = 0, visited = [], state) {
        const used=new Set([...visited,start]);
        function search(cell,path){
            if(used.size===16)return kind==='climb'||cell===15?path:null;
            for(const next of puzzleMoves(kind,cell,state))if(!used.has(next)){
                used.add(next);const found=search(next,[...path,next]);if(found)return found;used.delete(next);
            }
            return null;
        }
        return search(start,[start])??[];
}
export function routePoints(choices) {
    return [{ x: 85, y: 250 }, ...choices.map((c, i) => ({ x: 235 + i * 160, y: [140, 250, 360][c.selected] }))];
}
export function routeMetrics(choices) {
    const points = routePoints(choices), distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return { points, distances, total: distances.at(-1) };
}
export function pointOnRoute(choices, distance) {
    const { points, distances } = routeMetrics(choices);
    for (let i = 1; i < points.length; i++) if (distance <= distances[i]) {
        const t = Math.max(0, (distance - distances[i - 1]) / (distances[i] - distances[i - 1]));
        return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
    return points.at(-1);
}
export function nextCheckpoint(state) { return CHECKPOINTS.find(c => !state.completed.includes(c.id)); }
export function advanceMap(state, direction, dt) {
    if(state.stage!=='map')return null;
    const limit=explorationLimit(state).distance;
    state.mapDistance=Math.max(0,Math.min(limit,state.mapDistance+Math.sign(direction)*Math.max(0,dt)*190));
    state.mapFurthest=Math.max(state.mapFurthest??0,state.mapDistance);
    return mapEncounter(state);
}
export function finishPuzzle(state, kind) {
    if (state.completed.includes(kind)) return false;
    const trail=kind==='pond'?state.pondTrail:state.climbTrail;
    if(trail?.length!==16||new Set(trail).size!==16||trail[0]!==0||(kind==='pond'&&trail[15]!==15))return false;
    if(trail.some((cell,i)=>!Number.isInteger(cell)||cell<0||cell>15||(i>0&&!puzzleMoves(kind,trail[i-1],state).includes(cell))))return false;
    state.completed.push(kind);
    state.events.push({ type: 'puzzle-complete', puzzle: kind });
    state.stage = 'map';
    return true;
}

export function pressPondStone(state, index) {
    const trail=state.pondTrail??(state.pondTrail=[]);
    const expected=trail.length?puzzleMoves('pond',trail.at(-1),state)[0]:0;
    if(index!==expected||trail.includes(index)){
        if(trail.length>3){state.pondTrail=[];state.puzzle.pond=0;return 'reset';}
        return 'wrong';
    }
    trail.push(index);state.puzzle.pond=index;
    return trail.length===16?'complete':'correct';
}

export function pressClimbStone(state,index){
    const trail=state.climbTrail??(state.climbTrail=[]);
    const valid=trail.length?puzzleMoves('climb',trail.at(-1),state).includes(index):index===0;
    if(!valid||trail.includes(index)){
        if(trail.length>3){state.climbTrail=[];state.puzzle.climb=0;return 'reset';}
        return 'wrong';
    }
    trail.push(index);state.puzzle.climb=index;
    return trail.length===16?'complete':'correct';
}
