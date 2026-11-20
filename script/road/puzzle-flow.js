import { finishPuzzle } from './model.js';
import { mapEncounter } from './exploration.js';

// These are adapters to the existing puzzles, not new boards or answer rules.
export const NODE_PUZZLES=Object.freeze({1:'pond',3:'climb'});
export const puzzleNodeId=kind=>Number(Object.keys(NODE_PUZZLES).find(id=>NODE_PUZZLES[id]===kind))||null;
export const isPuzzleOpen=state=>puzzleNodeId(state.stage)!==null;
export const isCelebrating=motion=>Boolean(motion?.clearEffect&&motion.clearEffect.elapsed<.5);

export function openNodePuzzle(state,nodeId,motion){
    const kind=NODE_PUZZLES[nodeId],at=mapEncounter(state);
    if(state.stage!=='map'||!kind||at?.at!==nodeId||state.completed.includes(kind)||isCelebrating(motion))return false;
    state.puzzleView={nodeId,cameraX:motion.cameraX,catDistance:motion.catDistance,direction:motion.direction};
    state.stage=kind;
    return true;
}
export function restorePuzzleView(state,motion){
    const saved=state.puzzleView;
    if(!isPuzzleOpen(state)||saved?.nodeId!==puzzleNodeId(state.stage)||
        !Number.isFinite(saved.cameraX)||!Number.isFinite(saved.catDistance))return false;
    motion.cameraX=Math.max(0,Math.min(motion.route.nodes.at(-1)?.x??0,saved.cameraX));
    motion.catDistance=Math.max(0,Math.min(motion.route.total,saved.catDistance));
    motion.direction=saved.direction===-1?-1:1;
    return true;
}
export function cancelNodePuzzle(state){
    if(!isPuzzleOpen(state))return false;
    state.stage='map';delete state.puzzleView;
    return true;
}
export function completeNodePuzzle(state,nodeId,motion){
    const kind=NODE_PUZZLES[nodeId];
    if(!kind||state.stage!==kind||mapEncounter(state)?.at!==nodeId)return false;
    // finishPuzzle remains the sole existing completion check and save update.
    if(!finishPuzzle(state,kind))return false;
    delete state.puzzleView;
    motion.clearEffect={nodeId,elapsed:0};motion.moving=false;
    return true;
}
