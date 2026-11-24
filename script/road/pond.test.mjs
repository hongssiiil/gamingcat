import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, pressPondStone, solvePuzzle, finishPuzzle, restoreState } from './model.js';

test('pond visits all 16 cells once, lights only correct clicks and completes at the exit',()=>{
    const s=freshState(),path=solvePuzzle('pond');
    assert.equal(path.length,16);assert.equal(new Set(path).size,16);
    for(const [i,cell] of path.entries()){
        assert.equal(pressPondStone(s,cell),i===15?'complete':'correct');
        assert.deepEqual(s.pondTrail,path.slice(0,i+1));
        if(i<15)assert.equal(finishPuzzle(s,'pond'),false);
    }
    assert.equal(finishPuzzle(s,'pond'),true);
});

test('errors preserve zero to two lit cells and undo one step from three onwards',()=>{
    const path=solvePuzzle('pond');
    for(let count=0;count<16;count++){
        const s=freshState();path.slice(0,count).forEach(cell=>pressPondStone(s,cell));
        const wrong=count?path[0]:1;
        assert.equal(pressPondStone(s,wrong),count>=3?'backtrack':'wrong');
        const remaining=count>=3?count-1:count;
        assert.deepEqual(s.pondTrail,path.slice(0,remaining));
        assert.equal(s.puzzle.pond,path[remaining-1]??0);
        assert.deepEqual(restoreState(JSON.stringify(s)),s);
        path.slice(remaining).forEach(cell=>pressPondStone(s,cell));
        assert.equal(finishPuzzle(s,'pond'),true);
    }
});

test('pond trail persists; old saves and invalid sequences restart only the pond attempt',()=>{
    const s=freshState();solvePuzzle('pond').slice(0,5).forEach(cell=>pressPondStone(s,cell));
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
    for(const trail of [undefined,[0,15],[-1],Array(17).fill(0)]){
        const result=restoreState(JSON.stringify({...s,pondTrail:trail}));
        assert.deepEqual(result.pondTrail,[]);assert.equal(result.puzzle.pond,0);assert.equal(result.tokens,s.tokens);
    }
});
