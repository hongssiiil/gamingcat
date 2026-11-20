import test from 'node:test';
import assert from 'node:assert/strict';
import {endingScenes,SCENE_NAMES,starPositions,endingAnimation,ENDING_DURATION} from './ending-model.js';
const fork=(scene,selected,recommended=0)=>({scene,selected,recommended,options:['추천 길','다른 길','아래 길'],label:['추천 길','다른 길','아래 길'][selected],prompt:'저장된 질문'});
test('always nine ordered scene nodes, with honest empty summaries',()=>{
    const nodes=endingScenes();assert.equal(nodes.length,9);assert.deepEqual(nodes.map(n=>n.scene),SCENE_NAMES);
    assert.ok(nodes.every(n=>!n.hasRecord&&!n.black&&n.summary==='아직 이 장면의 기록이 없어요'));
});
test('fork denominator includes only comparable recommendations and groups by scene',()=>{
    const nodes=endingScenes({choices:[fork('fork-2',0),fork('fork-2',1),fork('fork-2',0),{scene:'fork-2',label:'추천 기록 없는 선택'},fork('fork-4',1)]});
    assert.equal(nodes[2].summary,'AI 추천을 2 / 3회 따랐어요');assert.equal(nodes[2].total,3);assert.equal(nodes[2].followed,2);
    assert.equal(nodes[1].hasRecord,false);assert.equal(nodes[4].summary,'AI 추천을 0 / 1회 따랐어요');assert.equal(nodes.length,9);
});
test('missing recommendation remains unknown without making a denominator',()=>{
    const node=endingScenes({choices:[{scene:'fork-1',label:'행동'}]})[1];assert.equal(node.hasRecord,true);assert.equal(node.summary,null);assert.equal(node.total,0);assert.equal(node.recommendation,null);
});
test('password uses solved event or actually found clues, never stage inference',()=>{
    assert.equal(endingScenes({stage:'battleReady'})[0].hasRecord,false);
    assert.equal(endingScenes({notes:['leaf'],events:[{type:'note',id:'leaf'}]})[0].summary,'단서 1개를 찾았어요.');
    assert.equal(endingScenes({events:[{type:'password-solved'}]})[0].summary,'암호를 풀었어요.');
});
test('puzzles use completed, completion events and trails without guessing failures',()=>{
    let nodes=endingScenes({completed:['pond'],climbTrail:[0,1]});assert.equal(nodes[6].summary,'퍼즐을 완료했어요.');assert.equal(nodes[7].summary,'2칸의 진행 기록이 있어요.');
    nodes=endingScenes({events:[{type:'puzzle-complete',puzzle:'climb'}]});assert.equal(nodes[7].summary,'퍼즐을 완료했어요.');assert.equal(nodes[6].hasRecord,false);
});
test('token attribution does not repeat cumulative help or attach forest help to fork one',()=>{
    const nodes=endingScenes({events:[{type:'help',stage:'forest',cost:1}],choices:[{...fork('fork-1',0),helpCount:1},{...fork('fork-2',0),helpCount:2},{...fork('fork-3',0),helpCount:2}]});
    assert.equal(nodes[0].tokenUsed,true);assert.equal(nodes[1].tokenUsed,null);assert.equal(nodes[2].tokenUsed,true);assert.equal(nodes[3].tokenUsed,null);
});
test('many battle actions still create one battle node; escape alone is black',()=>{
    const battles=Array.from({length:30},()=>({playerChoice:'도망 시도',outcome:'도망에 실패했다.'}));battles.at(-1).result='escape';
    const escaped=endingScenes({battles},'escape');assert.equal(escaped.length,9);assert.equal(escaped[8].black,true);assert.equal(escaped.filter(n=>n.black).length,1);
    assert.equal(endingScenes({battles},'victory')[8].black,false);assert.equal(endingScenes()[8].black,false);
    assert.equal(endingScenes({battles:[{playerChoice:'일반 공격',result:'defeat'}]})[8].summary,'늑대 전투에서 패배했어요.');
});
test('nine fixed positions are stable, separated and have no crossing segments',()=>{
    const p=starPositions();assert.equal(p.length,9);assert.deepEqual(p,starPositions());
    for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)assert.ok(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>.1);
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let i=0;i<6;i++)for(let j=i+2;j<8;j++)assert.equal(cross(p[i],p[i+1],p[j])*cross(p[i],p[i+1],p[j+1])<0&&cross(p[j],p[j+1],p[i])*cross(p[j],p[j+1],p[i+1])<0,false);
});
test('4.2 second animation gathers, traces nine nodes, settles then completes',()=>{
    assert.equal(endingAnimation(0).phase,'dim');assert.equal(endingAnimation(500).phase,'gather');assert.equal(endingAnimation(850).step,0);
    for(let i=0;i<9;i++)assert.equal(endingAnimation(850+(i+.5)*2800/9).step,i);
    assert.equal(endingAnimation(3800).phase,'settle');assert.equal(endingAnimation(ENDING_DURATION).phase,'complete');
});
test('reduced motion is only a 250ms fade with no gathering or tracing',()=>{
    assert.equal(endingAnimation(100,true).phase,'fade');assert.equal(endingAnimation(250,true).phase,'complete');
});
