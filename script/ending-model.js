// Adapt existing records without inventing recommendations or narrative events.
export function endingRecords({choices=[],battles=[]}={},result){
    let previousHelp=0;
    const road=choices.map((choice,index)=>{
        const known=Number.isInteger(choice.recommended)&&Number.isInteger(choice.selected)&&typeof choice.options?.[choice.recommended]==='string';
        const tokenUsed=Number.isFinite(choice.helpCount)?choice.helpCount>previousHelp:null;
        previousHelp=choice.helpCount??previousHelp;
        return {scene:'갈림길',action:choice.label,recommendation:known?choice.options[choice.recommended]:null,
            accepted:known?choice.selected===choice.recommended:null,tokenUsed,detail:choice.prompt||'',recordedAt:choice.recordedAt??index};
    });
    const combat=battles.filter(turn=>turn.playerChoice).map(turn=>({scene:'해적 전투',action:turn.playerChoice,
        recommendation:turn.recommendation||null,accepted:typeof turn.accepted==='boolean'?turn.accepted:null,
        tokenUsed:turn.tokenUsed??null,detail:turn.outcome||'',result:turn.result,recordedAt:turn.recordedAt??Number.MAX_SAFE_INTEGER}));
    const records=[...road,...combat].sort((a,b)=>a.recordedAt-b.recordedAt);
    // A successful escape is the terminal choice, not an additional invented event.
    if(result==='escape'){
        const index=records.findLastIndex(record=>record.result==='escape');
        if(index>=0)records.push(...records.splice(index,1));
    }
    return records.map((record,index)=>({...record,black:result==='escape'&&index===records.length-1&&record.result==='escape'}));
}
export function constellationName(records){
    return {cat:'함께 걷는 검은고양이자리',compass:'자신의 길을 낸 나침반자리',traveler:'숲을 건넌 여행자자리'}[constellationTheme(records)];
}
export function constellationTheme(records){
    const accepted=records.filter(r=>r.accepted===true).length,rejected=records.filter(r=>r.accepted===false).length;
    return accepted>rejected?'cat':rejected>accepted?'compass':'traveler';
}
// Fixed scene order and an open, non-crossing constellation; no action adds nodes.
export const SCENE_NAMES=Object.freeze(['암호 찾기','갈림길 1','갈림길 2','갈림길 3','갈림길 4','갈림길 5','퍼즐 1','퍼즐 2','해적 전투']);
const SCENE_POSITIONS=[[.18,.39],[.27,.28],[.43,.31],[.53,.25],[.72,.30],[.81,.41],[.63,.49],[.49,.41],[.32,.50]];
export function starPositions(){return SCENE_POSITIONS.map(([x,y])=>({x,y}));}
export function endingScenes(journey={},result){
    const {choices=[],events=[],battles=[],notes=[],completed=[],pondTrail=[],climbTrail=[]}=journey;
    const nodes=SCENE_NAMES.map((scene,index)=>({scene,id:index,hasRecord:false,summary:'아직 이 장면의 기록이 없어요',black:false,accepted:null,tokenUsed:null}));
    const help=stage=>events.some(e=>e.type==='help'&&e.stage===stage&&e.cost>0);
    const solved=events.some(e=>e.type==='password-solved');
    const noteCount=new Set([...notes,...events.filter(e=>e.type==='note').map(e=>e.id)]).size;
    if(solved||noteCount||help('forest'))Object.assign(nodes[0],{hasRecord:true,summary:solved?'암호를 풀었어요.':noteCount?`단서 ${noteCount}개를 찾았어요.`:'티니에게 도움을 요청했어요.',tokenUsed:help('forest')||null});
    for(let i=1;i<=5;i++){
        const records=choices.filter((c,index)=>c.scene===`fork-${i}`||(!c.scene&&index===i-1));
        if(!records.length)continue;
        const known=records.filter(c=>Number.isInteger(c.selected)&&Number.isInteger(c.recommended)&&typeof c.options?.[c.recommended]==='string'&&typeof c.options?.[c.selected]==='string');
        const followed=known.filter(c=>c.selected===c.recommended).length;
        Object.assign(nodes[i],{hasRecord:true,summary:known.length?`AI 추천을 ${followed} / ${known.length}회 따랐어요`:null,
            followed,total:known.length,detail:records.at(-1).prompt||null,action:records.map(c=>c.label).filter(Boolean).join(' · '),
            recommendation:known.map(c=>c.options[c.recommended]).join(' · ')||null,
            accepted:known.length?(followed===known.length?true:followed===0?false:null):null,
            tokenUsed:help(`fork-${i}`)||null});
        // helpCount is cumulative across forks; compare against the preceding
        // actual choice in the global log, never against a per-node zero.
        const used=records.some(c=>{const index=choices.indexOf(c),before=index?choices[index-1].helpCount:events.filter(e=>e.type==='help'&&e.stage==='forest').length;return Number.isFinite(c.helpCount)&&Number.isFinite(before)&&c.helpCount>before;});
        if(used)nodes[i].tokenUsed=true;
    }
    for(const [index,kind,trail] of [[6,'pond',pondTrail],[7,'climb',climbTrail]]){
        const done=completed.includes(kind)||events.some(e=>e.type==='puzzle-complete'&&e.puzzle===kind);
        if(done||trail.length||help(kind))Object.assign(nodes[index],{hasRecord:true,summary:done?'퍼즐을 완료했어요.':trail.length?`${trail.length}칸의 진행 기록이 있어요.`:'티니에게 도움을 요청했어요.',tokenUsed:help(kind)||null});
    }
    const turns=battles.filter(t=>t.playerChoice),outcome=['victory','escape','defeat'].includes(result)?result:turns.at(-1)?.result;
    const actionCounts=new Map();turns.forEach(t=>actionCounts.set(t.playerChoice,(actionCounts.get(t.playerChoice)||0)+1));
    const knownTurns=turns.filter(t=>typeof t.accepted==='boolean'),followedTurns=knownTurns.filter(t=>t.accepted).length;
    if(turns.length||['victory','escape','defeat'].includes(outcome))Object.assign(nodes[8],{hasRecord:true,
        summary:({victory:'해적 전투에서 승리했어요.',escape:'해적 전투에서 도주했어요.',defeat:'해적 전투에서 패배했어요.'})[outcome]||turns.at(-1)?.outcome||'선택한 전투 행동이 기록되어 있어요.',
        detail:turns.at(-1)?.outcome||null,action:[...actionCounts].map(([action,count])=>`${action} ${count}회`).join(' · '),black:outcome==='escape',tokenUsed:turns.some(t=>t.tokenUsed===true)||null,
        accepted:knownTurns.length===turns.length&&knownTurns.length?(followedTurns===knownTurns.length?true:followedTurns===0?false:null):null});
    return nodes;
}
export const ENDING_DURATION=7000;
export function endingAnimation(elapsed,reduced=false){
    if(reduced){const progress=Math.min(1,Math.max(0,elapsed/250));return {phase:progress===1?'complete':'fade',progress,step:8,local:1};}
    if(elapsed<400)return {phase:'dim',progress:elapsed/400,step:-1,local:0};
    if(elapsed<850)return {phase:'gather',progress:(elapsed-400)/450,step:-1,local:0};
    if(elapsed<6450){const progress=(elapsed-850)/5600*9;return {phase:'trace',progress,step:Math.floor(progress),local:progress%1};}
    if(elapsed<ENDING_DURATION)return {phase:'settle',progress:(elapsed-6450)/550,step:8,local:1};
    return {phase:'complete',progress:1,step:8,local:1};
}
