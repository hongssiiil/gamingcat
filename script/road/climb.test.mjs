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

test('errors preserve zero to two lit cells and undo one step from three onwards',()=>{
    const path=solvePuzzle('climb');
    for(let count=0;count<16;count++){
        const s=freshState();path.slice(0,count).forEach(cell=>pressClimbStone(s,cell));
        const wrong=count?path[0]:1;
        assert.equal(pressClimbStone(s,wrong),count>=3?'backtrack':'wrong');
        const remaining=count>=3?count-1:count;
        assert.deepEqual(s.climbTrail,path.slice(0,remaining));
        assert.equal(s.puzzle.climb,path[remaining-1]??0);
        assert.deepEqual(restoreState(JSON.stringify(s)),s);
        path.slice(remaining).forEach(cell=>pressClimbStone(s,cell));
        assert.equal(finishPuzzle(s,'climb'),true);
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
