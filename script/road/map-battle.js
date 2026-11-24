import { CHECKPOINTS } from './content.js';
import { mapEncounter } from './exploration.js';

export function roadBattleKind(state){
    if(state.stage==='battleReady')return 'wolf';
    if(state.stage!=='map')return undefined;
    const encounter=mapEncounter(state);
    return encounter?.id==='tutorial'?'mole':encounter?.id==='battle'?'wolf':undefined;
}
export function finishMapTutorial(state,result){
    if(state.stage!=='map'||mapEncounter(state)?.id!=='tutorial'||result!=='victory')return false;
    if(state.completed.includes('tutorial'))return false;
    state.completed.push('tutorial');
    state.events.push({type:'tutorial-complete',node:CHECKPOINTS.find(c=>c.id==='tutorial').at});
    return true;
}
