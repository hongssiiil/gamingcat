import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleFlow } from './flow.js';
import { createBattleState, MOLE_INITIAL_HEALTH, ENEMY_INITIAL_HEALTH } from './state.js';

function setup(){
    const state=createBattleState(),tokenState={tokens:30,events:[]},pending=[],calls=[];
    let active=false;
    const noop=()=>{};
    const ui={
        enemyName:{},enemyPortrait:{},playerStatusName:{},fightSkillsDialog:{hidden:true},
        followRecommendationButton:{focus:noop},autoBattleButton:{focus:noop},
        renderBattleHistory:noop,showEnemyProbability:noop,showMenuMessage:noop,
        updateBattleActionButtons:noop,updateStatusBars:noop,enterBattleScreen:noop,
        exitBattleScreen(){calls.push('exit');},closeBattleLossDialog:noop,
        setControlsLocked(s,locked){s.controlsLocked=locked;},
    };
    const flow=createBattleFlow({state,tokenState,ui,
        navigation:{getCurrentRoadBattleBackground:()=>'',saveBattleChoice:noop,
            enterRoad(){calls.push('road');},
            onTutorialFinished(result){calls.push(`tutorial:${result}`);},
            onWolfFinished(result){calls.push(`wolf:${result}`);}},
        renderer:{setBattleBackground:async()=>{},setBattleEnemy:noop},
        tutorial:{isBattleTutorialActive:()=>active,
            startBattleTutorial(){active=true;calls.push('start-tutorial');},
            stopBattleTutorial(){active=false;},
            advanceBattleTutorial(step,next){next?.();},
            markBattleTutorialComplete(){calls.push('tutorial-complete');}},
        scheduler:{schedule(callback){pending.push(callback);},cancel(){pending.length=0;}}
    });
    return {state,tokenState,flow,calls,pending,isActive:()=>active,
        win(){
            state.enemy.health=1;state.plannedEnemyAction='attack';flow.resolvePlayerSkill(0);
            for(let i=0;pending.length&&i<10;i++)pending.shift()();
            assert.equal(pending.length,0);assert.equal(state.ended,true);
        }};
}

// This test file runs in its own Node process; no browser or audio is needed.
globalThis.Audio=class { play(){return Promise.resolve();} pause(){} };
globalThis.document={querySelector(){return null;}};

test('mole victory returns to the map and removes tutorial input restrictions',async()=>{
    const h=setup();await h.flow.enterBattle('mole');
    assert.equal(h.state.enemy.maxHealth,MOLE_INITIAL_HEALTH);assert(h.isActive());
    h.win();
    assert.deepEqual(h.calls,['start-tutorial','tutorial-complete','exit','tutorial:victory']);
    assert.equal(h.isActive(),false);
});

test('node 5 explicitly starts wolf even before the session tutorial is complete',async()=>{
    const h=setup();await h.flow.enterBattle('wolf');
    assert.equal(h.state.enemyKind,'wolf');assert.equal(h.state.enemy.maxHealth,ENEMY_INITIAL_HEALTH);
    assert.equal(h.isActive(),false);h.win();
    assert.deepEqual(h.calls,['exit','wolf:victory']);
});

test('opening a new encounter cancels the old return callback and resets the enemy',async()=>{
    const h=setup();await h.flow.enterBattle('mole');
    h.state.enemy.health=1;h.pending.push(()=>h.calls.push('stale-return'));
    await h.flow.enterBattle('wolf');
    assert.equal(h.pending.length,0);assert.equal(h.isActive(),false);
    assert.equal(h.state.enemy.health,ENEMY_INITIAL_HEALTH);
    await h.flow.enterBattle('mole');
    assert.equal(h.state.enemy.health,MOLE_INITIAL_HEALTH);assert(h.isActive());
    h.flow.exitBattle();assert.equal(h.isActive(),false);
});
test('entry, tutorial return, wolf entry and retry never refill or erase the journey wallet',async()=>{
    const h=setup();h.tokenState.tokens=12;h.tokenState.events.push({type:'help',stage:'forest',cost:8});
    await h.flow.enterBattle('mole');assert.equal(h.tokenState.tokens,12);
    h.tokenState.tokens=7;h.tokenState.events.push({type:'help',stage:'battle',cost:5});
    h.flow.exitBattle();await h.flow.enterBattle('wolf');h.flow.resetBattle();
    assert.equal(h.tokenState.tokens,7);assert.equal(h.tokenState.events.length,2);
});
