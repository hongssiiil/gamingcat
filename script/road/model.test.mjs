import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, TOPICS, CHECKPOINTS } from './content.js';
import { freshState, restoreState, useHelp, sendRoadMessage, moveFork, walkFork, choose, solvePuzzle, puzzleMoves, routeMetrics, advanceMap, finishPuzzle, pressPondStone, pressClimbStone } from './model.js';

function walkTo(s,lane){
    for(let i=0;i<1800&&s.fork.progress<1;i++){
        const p=s.fork.position??{x:80,y:s.fork.startY??270},y=[160,280,392][lane];
        walkFork(s,p.x<612?1:p.x>626?-1:0,Math.abs(y-p.y)>2?Math.sign(y-p.y):0,1/60);
    }
}
test('walking enters every branch without a selection action and commits only at its end', () => {
    for(const lane of [0,1,2]){
        const s=freshState();s.topic='진로';s.stage='fork';
        walkFork(s,1,0,1/60);
        assert.ok(s.fork.progress>0);
        assert.equal(choose(s),false);assert.equal(s.choices.length,0);
        walkTo(s,lane);
        assert.equal(choose(s),true);assert.equal(s.choices[0].selected,lane);
    }
});

test('help costs allow debt without blocking progress', () => {
    const s=freshState();
    for(const cmd of ['hint','plan','solve','solve']) assert.equal(useHelp(s,cmd,'answer'),true);
    assert.equal(s.tokens,-10); assert.equal(s.events.length,4);
    assert.equal(useHelp(s,'unknown',''),false); assert.equal(s.tokens,-10);
});
test('typed commands charge once; ordinary messages and typos do not spend tokens', () => {
    const s=freshState();let calls=0;
    const answer=cmd=>{calls++;return `${cmd} answer`;};
    assert.equal(sendRoadMessage(s,'   ',answer),null);
    for(const message of ['안녕','/hints','/hinted please','/constructor']) {
        const reply=sendRoadMessage(s,message,answer);
        assert.equal(reply.command,null);assert.equal(reply.message,message);
    }
    assert.equal(s.tokens,10);assert.equal(calls,0);
    for(const command of [' /hint ','/PLAN 힌트 줘','/solve','/solve'])sendRoadMessage(s,command,answer);
    assert.equal(s.tokens,-10);assert.equal(calls,4);assert.equal(s.events.length,4);
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
    s.stage='contract';sendRoadMessage(s,'/hint',answer);
    assert.equal(s.tokens,-10);assert.equal(calls,4);
    assert.equal(useHelp(s,'constructor','invalid'),false);
});
test('all topics permit every route, including choices against the recommendation', () => {
    for(const topic of TOPICS) for(let variant=0;variant<243;variant++) {
        const s=freshState();s.topic=topic;s.stage='fork';let value=variant;
        for(let step=0;step<5;step++) {
            const selected=value%3;value=Math.floor(value/3);s.fork.lane=selected;
            walkTo(s,selected);
            assert.equal(s.fork.progress,1);assert.equal(choose(s),true);
            assert.equal(s.choices[step].selected,selected);
            if(selected!==SCENARIOS[topic][step].recommended)assert.equal(s.choices[step].resisted,true);
        }
        assert.equal(s.stage,'summary');assert.equal(choose(s),false);
        const metrics=routeMetrics(s.choices);
        assert.equal(metrics.points.length,6);
        assert.ok(metrics.distances.every((d,i)=>!i||d>metrics.distances[i-1]));
        assert.deepEqual(restoreState(JSON.stringify(s)),s);
    }
});
test('both puzzles have legal solutions; zero distance never permits staying put', () => {
    for(const kind of ['pond','climb']) {
        const path=solvePuzzle(kind);assert.equal(path[0],0);if(kind==='pond')assert.equal(path.at(-1),15);else assert.equal(path.length,16);
        for(let i=1;i<path.length;i++) assert.ok(puzzleMoves(kind,path[i-1]).includes(path[i]));
        for(let i=0;i<16;i++) assert.ok(!puzzleMoves(kind,i).includes(i));
    }
    assert.deepEqual(puzzleMoves('climb',7),[6]);
});
test('obstacles lock the map, completion preserves location and unlocks only the next segment', () => {
    const s=freshState();s.topic='진로';s.stage='fork';
    for(let i=0;i<5;i++){s.fork.progress=1;choose(s);}s.stage='map';
    for(const checkpoint of CHECKPOINTS){
        assert.equal(advanceMap(s,1,100).id,checkpoint.id);
        const position=s.mapDistance;advanceMap(s,1,100);assert.equal(s.mapDistance,position);
        if(checkpoint.id==='battle')break;
        s.stage=checkpoint.id;assert.equal(finishPuzzle(s,checkpoint.id),false);
        for(const cell of solvePuzzle(checkpoint.id)){if(checkpoint.id==='pond')pressPondStone(s,cell);else pressClimbStone(s,cell);}
        assert.equal(finishPuzzle(s,checkpoint.id),true);assert.equal(s.stage,'map');assert.equal(s.mapDistance,position);
        assert.equal(finishPuzzle(s,checkpoint.id),false);
        assert.deepEqual(restoreState(JSON.stringify(s)),s);
    }
});
test('missing, legacy and malformed saves start safely', () => {
    for(const data of [null,'{','[]','{"version":1}',JSON.stringify({...freshState(),fork:null})]) assert.deepEqual(restoreState(data),freshState());
});
