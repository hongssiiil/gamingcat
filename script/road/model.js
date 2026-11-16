import { COSTS, POND, CLIMB, CHECKPOINTS, SCENARIOS, TOPICS, NOTES } from './content.js';
export const STORAGE_KEY = 'gamingCatRoadV2';
export const STAGES = ['forest', 'routeMissing', 'contract', 'stopped', 'topic', 'fork', 'summary', 'map', 'pond', 'climb', 'battleReady'];
export function freshState() {
    return { version: 2, stage: 'forest', tokens: 10, notes: [], topic: '', interest: '',
        choices: [], events: [], chat: [], player: { x: 340, y: 483 }, mapDistance: 0,
        completed: [], pondTrail: [], climbTrail: [], puzzle: { pond: 0, climb: 0 }, fork: { lane: 1, progress: 0, resistance: 0, seconds: 0, resisted: false } };
}
export function restoreState(raw) {
    try {
        const s = JSON.parse(raw);
        if (!s || s.version !== 2 || !STAGES.includes(s.stage)) return freshState();
        if (!Number.isFinite(s.tokens) || s.tokens > 10 || !Array.isArray(s.notes) || !Array.isArray(s.choices) || s.choices.length > 5) return freshState();
        if (!Array.isArray(s.events) || !Array.isArray(s.chat) || !Array.isArray(s.completed)) return freshState();
        if (s.notes.some(id => !NOTES.some(note => note.id === id)) || new Set(s.notes).size !== s.notes.length) return freshState();
        if (typeof s.interest !== 'string' || s.interest.length > 40 || typeof s.topic !== 'string') return freshState();
        if (s.events.some(e => !e || typeof e.type !== 'string') || s.chat.some(c => !c || !(Object.hasOwn(COSTS,c.command) || (c.command === null && typeof c.message === 'string')) || typeof c.answer !== 'string' || (c.message !== undefined && typeof c.message !== 'string'))) return freshState();
        if (!s.player || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.y) || !Number.isFinite(s.mapDistance)) return freshState();
        if (!s.fork || !Number.isInteger(s.fork.lane) || s.fork.lane < 0 || s.fork.lane > 2 || !['progress', 'resistance', 'seconds'].every(k => Number.isFinite(s.fork[k]) && s.fork[k] >= 0)) return freshState();
        if (!s.puzzle || !['pond', 'climb'].every(k => Number.isInteger(s.puzzle[k]) && s.puzzle[k] >= 0 && s.puzzle[k] < 16)) return freshState();
        if (s.choices.some(c => !c || !Number.isInteger(c.selected) || c.selected < 0 || c.selected > 2 || !Number.isInteger(c.recommended) || c.recommended < 0 || c.recommended > 2 || !Array.isArray(c.options) || c.options.length !== 3 || c.options.some(o => typeof o !== 'string') || typeof c.label !== 'string' || !Number.isFinite(c.seconds))) return freshState();
        if (['fork', 'summary', 'map', 'pond', 'climb', 'battleReady'].includes(s.stage) && !TOPICS.includes(s.topic)) return freshState();
        if (s.stage === 'fork' && s.choices.length >= 5) return freshState();
        if (['summary', 'map', 'pond', 'climb', 'battleReady'].includes(s.stage) && s.choices.length !== 5) return freshState();
        if (s.completed.some(k => !['pond', 'climb'].includes(k))) return freshState();
        if (s.mapDistance < 0 || s.mapDistance > routeMetrics(s.choices).total || s.fork.progress > 1 || s.player.x < 0 || s.player.x > 1023 || s.player.y < 0 || s.player.y > 769) return freshState();
        // Older saves had no clicked sequence; restart just the pond attempt.
        const path=solvePuzzle('pond');
        if(!Array.isArray(s.pondTrail)||s.pondTrail.length>16||s.pondTrail.some((cell,i)=>cell!==path[i])){
            s.pondTrail=[];s.puzzle.pond=0;
        }else s.puzzle.pond=s.pondTrail.at(-1)??0;
        if(!Array.isArray(s.climbTrail)||s.climbTrail.length>16||new Set(s.climbTrail).size!==s.climbTrail.length||s.climbTrail.some((cell,i)=>!Number.isInteger(cell)||cell<0||cell>15||(i===0?cell!==0:!puzzleMoves('climb',s.climbTrail[i-1]).includes(cell))))s.climbTrail=[];
        s.puzzle.climb=s.climbTrail.at(-1)??0;
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
export function choose(state) {
    const q = scenario(state);
    if (!q || state.fork.progress < 1) return false;
    state.choices.push({ scene: `fork-${state.choices.length + 1}`, topic: state.topic,
        prompt: q.prompt, options: [...q.options], recommended: q.recommended,
        selected: state.fork.lane, path: ['up', 'right', 'down'][state.fork.lane],
        label: q.options[state.fork.lane], resisted: state.fork.resisted,
        seconds: Math.round(state.fork.seconds * 10) / 10,
        helpCount: state.events.filter(e => e.type === 'help').length });
    state.fork = { lane: 1, progress: 0, resistance: 0, seconds: 0, resisted: false };
    if (state.choices.length === 5) state.stage = 'summary';
    return true;
}
export function moveFork(state, direction, dt) {
    const q = scenario(state);
    if (!q || !direction) return;
    const f = state.fork;
    if (f.lane !== q.recommended && direction > 0) {
        f.resistance = Math.min(1, f.resistance + dt);
        f.resisted = true;
    }
    // Tiny reacts visually; the player's speed never depends on agreement.
    f.progress = Math.max(0, Math.min(1, f.progress + direction * dt / 4.2));
}

export function walkFork(state, dx, dy, dt) {
    if (!dx && !dy) return;
    // Steering and walking are one action; reaching the exit commits the choice.
    const lane = dy < 0 ? 0 : dy > 0 ? 2 : state.fork.lane;
    if (lane !== state.fork.lane) { state.fork.lane = lane; state.fork.resistance = 0; }
    moveFork(state, dx < 0 ? -1 : 1, dt);
}
export function puzzleMoves(kind, from) {
    const row = Math.floor(from / 4), col = from % 4;
    let candidates;
    if (kind === 'pond') {
        const [direction, n] = POND[from];
        const [dx, dy] = ({ '→': [1, 0], '←': [-1, 0], '↑': [0, -1], '↓': [0, 1] })[direction] || [0, 0];
        candidates = n ? [[col + dx * n, row + dy * n]] : [];
    } else {
        const h = Math.floor(CLIMB[from] / 10), v = CLIMB[from] % 10;
        candidates = [-1,1].flatMap(dx=>[-1,1].map(dy=>[col+dx*h,row+dy*v]));
    }
    return [...new Set(candidates.filter(([x, y]) => x >= 0 && x < 4 && y >= 0 && y < 4).map(([x, y]) => y * 4 + x))].filter(cell=>cell!==from);
}
export function solvePuzzle(kind, start = 0, visited = []) {
    if(kind==='climb'){
        const used=new Set([...visited,start]);
        function search(cell,path){
            if(used.size===16)return path;
            for(const next of puzzleMoves(kind,cell))if(!used.has(next)){
                used.add(next);const found=search(next,[...path,next]);if(found)return found;used.delete(next);
            }
            return null;
        }
        return search(start,[start])??[];
    }
    const queue = [[start]], seen = new Set([start]);
    while (queue.length) {
        const path = queue.shift(), last = path.at(-1);
        if (last === 15) return path;
        for (const next of puzzleMoves(kind, last)) if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
    return [];
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
    const metrics = routeMetrics(state.choices), next = nextCheckpoint(state);
    const limit = next ? metrics.distances[next.at] : metrics.total;
    state.mapDistance = Math.max(0, Math.min(limit, state.mapDistance + direction * dt * 140));
    return next && Math.abs(state.mapDistance - limit) < 0.1 ? next : null;
}
export function finishPuzzle(state, kind) {
    if (state.completed.includes(kind)) return false;
    if ((kind === 'pond' ? state.pondTrail : state.climbTrail)?.length !== 16) return false;
    state.completed.push(kind);
    state.events.push({ type: 'puzzle-complete', puzzle: kind });
    state.stage = 'map';
    return true;
}

export function pressPondStone(state, index) {
    const trail=state.pondTrail??(state.pondTrail=[]);
    const expected=trail.length?puzzleMoves('pond',trail.at(-1))[0]:0;
    if(index!==expected||trail.includes(index)){
        if(trail.length>3){state.pondTrail=[];state.puzzle.pond=0;return 'reset';}
        return 'wrong';
    }
    trail.push(index);state.puzzle.pond=index;
    return trail.length===16?'complete':'correct';
}

export function pressClimbStone(state,index){
    const trail=state.climbTrail??(state.climbTrail=[]);
    const valid=trail.length?puzzleMoves('climb',trail.at(-1)).includes(index):index===0;
    if(!valid||trail.includes(index)){
        if(trail.length>3){state.climbTrail=[];state.puzzle.climb=0;return 'reset';}
        return 'wrong';
    }
    trail.push(index);state.puzzle.climb=index;
    return trail.length===16?'complete':'correct';
}
