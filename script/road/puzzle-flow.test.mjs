import test from 'node:test';
import assert from 'node:assert/strict';
import {finishMapTutorial} from './map-battle.js';
import {freshState,choose,advanceMap,solvePuzzle,pressPondStone,pressClimbStone,restoreState} from './model.js';
import {createExplorationMotion,updateExplorationMotion,mapEncounter,explorationInk} from './exploration.js';
import {openNodePuzzle,cancelNodePuzzle,completeNodePuzzle,isCelebrating,restorePuzzleView} from './puzzle-flow.js';

function encounter(){
    const state=freshState();state.topic='진로';state.stage='fork';
    for(const lane of [1,0,1,2,1]){state.fork.progress=1;state.fork.lane=lane;choose(state);}
    state.stage='map';advanceMap(state,1,100);
    const motion=createExplorationMotion(state);motion.cameraX-=17;motion.catDistance-=3;
    return {state,motion};
}
test('only the encountered puzzle opens, with movement and camera frozen',()=>{
    const {state,motion}=encounter(),distance=state.mapDistance,camera=motion.cameraX,cat=motion.catDistance;
    assert.equal(openNodePuzzle(state,3,motion),false);
    assert.equal(openNodePuzzle(state,1,motion),true);assert.equal(state.stage,'pond');
    for(const direction of [-1,1])advanceMap(state,direction,10);
    updateExplorationMotion(motion,state,1);
    assert.equal(state.mapDistance,distance);assert.equal(motion.cameraX,camera);assert.equal(motion.catDistance,cat);
    assert.equal(completeNodePuzzle(state,1,motion),false);assert.deepEqual(state.completed,[]);
});
test('cancel and reopen generate a fresh attempt; reload preserves its board and progress',()=>{
    const {state,motion}=encounter(),distance=state.mapDistance;
    openNodePuzzle(state,1,motion);
    for(const cell of solvePuzzle('pond',0,[],state).slice(0,5))pressPondStone(state,cell);
    const previousBoard=state.puzzleBoards.pond;
    const trail=[...state.pondTrail];
    assert(cancelNodePuzzle(state));assert.equal(state.stage,'map');assert.equal(mapEncounter(state).at,1);
    assert.deepEqual(state.pondTrail,trail);assert.equal(state.mapDistance,distance);assert.deepEqual(state.completed,[]);
    assert(openNodePuzzle(state,1,motion));assert.deepEqual(state.pondTrail,[]);
    assert.notEqual(state.puzzleBoards.pond,previousBoard);
    for(const cell of solvePuzzle('pond',0,[],state).slice(0,3))pressPondStone(state,cell);
    const restored=restoreState(JSON.stringify(state)),restoredMotion=createExplorationMotion(restored);
    assert(restorePuzzleView(restored,restoredMotion));
    assert.equal(restoredMotion.cameraX,motion.cameraX);assert.equal(restoredMotion.catDistance,motion.catDistance);
    assert.deepEqual(restored.pondTrail,state.pondTrail);assert.equal(restored.stage,'pond');
    assert.deepEqual(restored.puzzleBoards,state.puzzleBoards);
});
test('existing answers clear each corresponding node once and unlock its ink after the celebration',()=>{
    const {state,motion}=encounter(),choices=structuredClone(state.choices),paths=structuredClone(state.completedPaths);
    for(const [nodeId,kind,press] of [[1,'pond',pressPondStone],[3,'climb',pressClimbStone]]){
        if(nodeId===3){advanceMap(state,1,100);assert(finishMapTutorial(state,'victory'));}
        advanceMap(state,1,100);updateExplorationMotion(motion,state,.05);
        const distance=state.mapDistance,camera=motion.cameraX,cat=motion.catDistance;
        assert(openNodePuzzle(state,nodeId,motion));
        for(const cell of solvePuzzle(kind,0,[],state))press(state,cell);
        assert.equal(completeNodePuzzle(state,nodeId===1?3:1,motion),false);
        assert(completeNodePuzzle(state,nodeId,motion));assert.equal(state.stage,'map');assert(state.completed.includes(kind));
        assert.equal(completeNodePuzzle(state,nodeId,motion),false);
        assert.equal(mapEncounter(state),null);assert(isCelebrating(motion));
        const d=motion.route.nodes[nodeId-1].distance;
        assert(explorationInk(motion.route,state.completed).some(s=>s.from<d&&s.to>=d));
        updateExplorationMotion(motion,state,.49);assert(isCelebrating(motion));
        assert.equal(motion.cameraX,camera);assert.equal(motion.catDistance,cat);assert.equal(state.mapDistance,distance);
        updateExplorationMotion(motion,state,.02);assert.equal(isCelebrating(motion),false);
        assert.deepEqual(restoreState(JSON.stringify(state)).completed,state.completed);
    }
    assert.deepEqual(state.completed,['pond','tutorial','climb']);
    assert.equal(state.events.filter(e=>e.type==='puzzle-complete').length,2);
    assert.deepEqual(state.choices,choices);assert.deepEqual(state.completedPaths,paths);
});
