import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, choose, advanceMap, restoreState } from './model.js';
import { mapEncounter } from './exploration.js';
import { finishMapTutorial, roadBattleKind } from './map-battle.js';

function tutorialMap(){
    const state=freshState();state.topic='진로';state.stage='fork';
    for(const lane of [1,0,2,1,0]){state.fork.lane=lane;state.fork.progress=1;choose(state);}
    state.stage='map';state.completed.push('pond');
    assert.equal(advanceMap(state,1,100).id,'tutorial');
    return state;
}

test('node 2 starts the mole; victory preserves the map and unlocks node 3 before the wolf',()=>{
    const state=tutorialMap();
    assert.equal(roadBattleKind(state),'mole');
    const position=state.mapDistance,farthest=state.mapFurthest;
    const paths=structuredClone(state.completedPaths),choices=structuredClone(state.choices);
    assert.equal(finishMapTutorial(state,'victory'),true);
    assert.equal(state.stage,'map');assert.equal(state.mapDistance,position);assert.equal(state.mapFurthest,farthest);
    assert.deepEqual(state.completedPaths,paths);assert.deepEqual(state.choices,choices);
    assert.deepEqual(state.completed,['pond','tutorial']);
    assert.equal(mapEncounter(state),null);
    assert.equal(finishMapTutorial(state,'victory'),false);
    assert.equal(state.events.filter(e=>e.type==='tutorial-complete').length,1);
    assert.equal(state.events.at(-1).node,2);
    assert.equal(advanceMap(state,1,100).id,'climb');
    state.completed.push('climb');
    assert.equal(advanceMap(state,1,100).id,'battle');
    assert.equal(roadBattleKind(state),'wolf');
});

test('escape, defeat and unrelated screens cannot clear the tutorial',()=>{
    const state=tutorialMap();
    for(const result of ['escape','defeat',undefined]){
        assert.equal(finishMapTutorial(state,result),false);
        assert.equal(advanceMap(state,1,100).id,'tutorial');
    }
    state.stage='battleReady';
    assert.equal(finishMapTutorial(state,'victory'),false);
    assert.equal(roadBattleKind(state),'wolf');
    assert.equal(finishMapTutorial(freshState(),'victory'),false);
});

test('reload retains tutorial completion and a new journey requires it again',()=>{
    const state=tutorialMap();finishMapTutorial(state,'victory');
    const restored=restoreState(JSON.stringify(state));
    assert.deepEqual(restored,state);
    assert.equal(advanceMap(restored,1,100).id,'climb');
    const restarted=tutorialMap();
    assert.equal(restarted.completed.includes('tutorial'),false);
    assert.equal(roadBattleKind(restarted),'mole');
});

test('old third-puzzle saves return safely to the relocated tutorial without losing choices',()=>{
    const state=tutorialMap();state.stage='climb';state.tokenBudgetVersion=1;state.tokens=12;
    const restored=restoreState(JSON.stringify(state));
    assert.equal(restored.stage,'map');assert.equal(mapEncounter(restored).at,2);
    assert.equal(roadBattleKind(restored),'mole');assert.equal(restored.tokens,22);
    assert.deepEqual(restored.choices,state.choices);
    assert.deepEqual(restored.completed,['pond']);
    assert(finishMapTutorial(restored,'victory'));
    assert.equal(advanceMap(restored,1,100).id,'climb');
});
