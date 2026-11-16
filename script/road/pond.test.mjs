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

test('wrong clicks preserve zero through three white cells; reset from four onwards',()=>{
    const path=solvePuzzle('pond');
    for(let count=0;count<16;count++){
        const s=freshState();path.slice(0,count).forEach(cell=>pressPondStone(s,cell));
        const wrong=(path[count]+1)%16;
        assert.equal(pressPondStone(s,wrong),count<=3?'wrong':'reset');
        assert.deepEqual(s.pondTrail,count<=3?path.slice(0,count):[]);
        if(count>3){assert.equal(s.puzzle.pond,0);assert.equal(pressPondStone(s,0),'correct');}
    }
});

test('duplicate clicks cannot increase the white count and obey the same reset rule',()=>{
    const s=freshState(),path=solvePuzzle('pond');
    path.slice(0,3).forEach(cell=>pressPondStone(s,cell));
    assert.equal(pressPondStone(s,path[2]),'wrong');assert.equal(s.pondTrail.length,3);
    pressPondStone(s,path[3]);assert.equal(pressPondStone(s,path[3]),'reset');
});

test('pond trail persists; old saves and invalid sequences restart only the pond attempt',()=>{
    const s=freshState();solvePuzzle('pond').slice(0,5).forEach(cell=>pressPondStone(s,cell));
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
    for(const trail of [undefined,[0,15],[-1],Array(17).fill(0)]){
        const result=restoreState(JSON.stringify({...s,pondTrail:trail}));
        assert.deepEqual(result.pondTrail,[]);assert.equal(result.puzzle.pond,0);assert.equal(result.tokens,s.tokens);
    }
});
