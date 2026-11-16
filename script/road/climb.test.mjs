import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIMB } from './content.js';
import { freshState, puzzleMoves, solvePuzzle, pressClimbStone, finishPuzzle, restoreState } from './model.js';

test('12 combines horizontal one and vertical two; zero holds only that axis',()=>{
    assert.deepEqual(puzzleMoves('climb',0),[9]);
    assert.deepEqual(puzzleMoves('climb',7),[6]);
});

test('reference prefix leads to all 16 cells, not the old EXIT',()=>{
    const path=solvePuzzle('climb'),s=freshState();
    assert.deepEqual(path.slice(0,8).map(i=>CLIMB[i]),[12,22,13,22,32,23,13,12]);
    assert.equal(path.length,16);assert.equal(new Set(path).size,16);
    for(const [i,cell] of path.entries()){
        assert.equal(pressClimbStone(s,cell),i===15?'complete':'correct');
        assert.equal(s.climbTrail.length,i+1);
        if(i<15)assert.equal(finishPuzzle(s,'climb'),false);
    }
    assert.equal(path.at(-1),7);assert.equal(finishPuzzle(s,'climb'),true);
});

test('three white cells survive errors, four white cells reset on invalid or repeated clicks',()=>{
    for(const count of [0,1,2,3,4,8]){
        const s=freshState();solvePuzzle('climb').slice(0,count).forEach(cell=>pressClimbStone(s,cell));
        const wrong=count?0:1;
        assert.equal(pressClimbStone(s,wrong),count>3?'reset':'wrong');
        assert.equal(s.climbTrail.length,count>3?0:count);
    }
});

test('saved trail and hints respect all already filled cells',()=>{
    const s=freshState(),prefix=solvePuzzle('climb').slice(0,8);
    prefix.forEach(cell=>pressClimbStone(s,cell));
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
    const rest=solvePuzzle('climb',s.puzzle.climb,s.climbTrail);
    assert.equal(new Set([...prefix,...rest]).size,16);
    assert.ok(rest.slice(1).every(cell=>!prefix.includes(cell)));
    const old={...s};delete old.climbTrail;
    const restored=restoreState(JSON.stringify(old));
    assert.deepEqual(restored.climbTrail,[]);assert.equal(restored.puzzle.climb,0);
});
