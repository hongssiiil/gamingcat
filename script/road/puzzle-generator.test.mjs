import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePuzzle,validPuzzle,startPuzzle,resetPuzzleProgress,hasUniqueClimbMoves,hasLimitedPondSteps} from './puzzle-generator.js';
import {freshState,choose,puzzleMoves,solvePuzzle,pressPondStone,pressClimbStone,finishPuzzle,restoreState} from './model.js';
import {CLIMB,POND} from './content.js';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
for(const kind of ['pond','climb']){
    test(`${kind}: 200 seeded boards have legal complete paths and clear through actual input`,()=>{
        const layouts=new Set();let sawZeroAxis=false;
        for(let seed=1;seed<=200;seed++){
            const state=freshState();startPuzzle(state,kind,random(seed));
            const board=state.puzzleBoards[kind],path=board.solution;
            assert(validPuzzle(kind,board));assert.equal(path[0],0);assert.equal(new Set(path).size,16);
            if(kind==='pond'){
                assert.equal(path[15],15);
                assert(hasLimitedPondSteps(board));
                assert(board.tiles.filter(tile=>tile[1]===1).length<=2);
            }
            else{
                assert(hasUniqueClimbMoves(board));
                assert(board.tiles.filter(code=>code===11).length<=2);
                for(let from=0;from<16;from++)assert.equal(puzzleMoves(kind,from,state).length,1);
            }
            layouts.add(JSON.stringify(board.tiles));
            const press=kind==='pond'?pressPondStone:pressClimbStone;
            for(let i=0;i<16;i++){
                const cell=path[i];
                if(i<15){
                    const next=path[i+1],dx=next%4-cell%4,dy=Math.floor(next/4)-Math.floor(cell/4);
                    assert(puzzleMoves(kind,cell,state).includes(next));
                    if(kind==='pond'){
                        assert(dx===0||dy===0);assert.equal(board.tiles[cell][1],Math.abs(dx)+Math.abs(dy));
                    }else{
                        assert.deepEqual(puzzleMoves(kind,cell,state),[next]);
                        assert.equal(board.tiles[cell],Math.abs(dx)*10+Math.abs(dy));
                        sawZeroAxis||=dx===0||dy===0;
                    }
                }
                assert.equal(press(state,cell),i===15?'complete':'correct');
                if(i<15)assert.equal(finishPuzzle(state,kind),false);
            }
            assert(finishPuzzle(state,kind));assert.equal(finishPuzzle(state,kind),false);
        }
        // The pond's fixed endpoints and two-single-step limit leave only 164 paths.
        assert(layouts.size>(kind==='pond'?50:150));if(kind==='climb')assert(sawZeroAxis);
    });
    test(`${kind}: hints use the current board, reset retains it, and saved progress resumes`,()=>{
        const state=freshState();startPuzzle(state,kind,random(27));
        const board=structuredClone(state.puzzleBoards[kind]),press=kind==='pond'?pressPondStone:pressClimbStone;
        const trailKey=kind==='pond'?'pondTrail':'climbTrail';
        const answer=solvePuzzle(kind,0,[],state);assert.equal(answer.length,16);
        answer.slice(0,7).forEach(cell=>press(state,cell));
        const restored=restoreState(JSON.stringify(state));
        assert.deepEqual(restored.puzzleBoards,state.puzzleBoards);assert.deepEqual(restored[trailKey],state[trailKey]);
        const continuation=solvePuzzle(kind,restored.puzzle[kind],restored[trailKey],restored);
        assert.equal(new Set([...restored[trailKey],...continuation]).size,16);
        continuation.slice(1).forEach(cell=>press(restored,cell));assert(finishPuzzle(restored,kind));
        resetPuzzleProgress(state,kind);assert.deepEqual(state[trailKey],[]);assert.equal(state.puzzle[kind],0);
        assert.deepEqual(state.puzzleBoards[kind],board);
        startPuzzle(state,kind,random(29));assert.notDeepEqual(state.puzzleBoards[kind].tiles,board.tiles);
        const damaged=structuredClone(state);damaged.puzzleBoards[kind].tiles[0]=kind==='pond'?['☆',0]:0;
        const repaired=restoreState(JSON.stringify(damaged));assert(validPuzzle(kind,repaired.puzzleBoards[kind]));
        assert.deepEqual(repaired[trailKey],[]);
    });
}
test('generation rejects unsupported kinds',()=>assert.throws(()=>generatePuzzle('unknown')));

test('pond saves with too many single prints restart only the unfinished board',()=>{
    const state=freshState();state.topic='진로';state.stage='fork';
    for(let i=0;i<5;i++){state.fork.progress=1;choose(state);}
    state.stage='pond';
    const old={tiles:structuredClone(POND),solution:solvePuzzle('pond')};
    assert(validPuzzle('pond',old));assert.equal(hasLimitedPondSteps(old),false);
    state.puzzleBoards.pond=old;state.pondTrail=old.solution.slice(0,4);state.puzzle.pond=state.pondTrail.at(-1);
    for(const fixed of [false,true]){
        const saved=structuredClone(state);if(fixed)delete saved.puzzleBoards.pond;
        const restored=restoreState(JSON.stringify(saved));
        assert(hasLimitedPondSteps(restored.puzzleBoards.pond));assert(validPuzzle('pond',restored.puzzleBoards.pond));
        assert.deepEqual(restored.pondTrail,[]);assert.equal(restored.puzzle.pond,0);
        for(const key of ['stage','choices','completedPaths','tokens','completed','mapDistance'])assert.deepEqual(restored[key],state[key]);
    }
    state.stage='map';state.completed.push('pond');state.pondTrail=[...old.solution];state.puzzle.pond=15;
    const restored=restoreState(JSON.stringify(state));
    assert.deepEqual(restored.puzzleBoards.pond,old);assert.deepEqual(restored.pondTrail,state.pondTrail);
});

test('ambiguous unfinished saves are replaced; cleared boards and the journey stay intact',()=>{
    const state=freshState();state.topic='진로';state.stage='fork';
    for(let i=0;i<5;i++){state.fork.progress=1;choose(state);}
    state.stage='climb';state.completed=['pond'];
    const old={tiles:[...CLIMB],solution:solvePuzzle('climb')};
    state.puzzleBoards.climb=old;state.climbTrail=old.solution.slice(0,4);state.puzzle.climb=state.climbTrail.at(-1);
    assert(validPuzzle('climb',old));assert.equal(hasUniqueClimbMoves(old),false);
    for(const fixed of [false,true]){
        const saved=structuredClone(state);if(fixed)delete saved.puzzleBoards.climb;
        const restored=restoreState(JSON.stringify(saved));
        assert(hasUniqueClimbMoves(restored.puzzleBoards.climb));assert.deepEqual(restored.climbTrail,[]);
        assert.equal(restored.puzzle.climb,0);assert.equal(restored.stage,'climb');
        for(const key of ['completed','choices','completedPaths','tokens','mapDistance'])assert.deepEqual(restored[key],state[key]);
    }
    state.stage='map';state.completed.push('climb');state.climbTrail=[...old.solution];state.puzzle.climb=old.solution.at(-1);
    const restored=restoreState(JSON.stringify(state));
    assert.deepEqual(restored.puzzleBoards.climb,old);assert.deepEqual(restored.climbTrail,state.climbTrail);
});
