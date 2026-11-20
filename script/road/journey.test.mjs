import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,choose,walkFork,restoreState} from './model.js';
import {forkPoint} from './fork-motion.js';
import {STAGE_STATE,advanceJourney,overviewCamera} from './journey.js';
const newState=()=>{const s=freshState();s.topic='진로';s.stage='fork';return s;};
const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)advanceJourney(s.inkJourney,1/60,s.completedPaths);};
function arrive(s,lane){
    s.fork.lane=lane;s.fork.progress=1;
    // Keep a detour that differs from the guide curve to prove real ink is retained.
    s.fork.ink=[[80,s.fork.startY],[201,s.fork.startY+9],[400,220],[620,forkPoint(lane,1).y]];
    assert(choose(s,{continuous:true}));
}
test('arrived, panning and next-fork phases preserve ink and lock input',()=>{
    const s=newState();arrive(s,2);
    const saved=structuredClone(s.completedPaths),before=s.fork.progress;
    assert.equal(s.inkJourney.phase,STAGE_STATE.ARRIVED);
    walkFork(s,0,-1,.05);assert.equal(s.fork.progress,before);
    assert.equal(choose(s,{continuous:true}),false);
    tick(s,.75);assert.equal(s.inkJourney.phase,STAGE_STATE.ARRIVED);
    tick(s,.1);assert.equal(s.inkJourney.phase,STAGE_STATE.PANNING);
    tick(s,.45);assert(s.inkJourney.cameraX>0&&s.inkJourney.cameraX<540);
    tick(s,.6);assert.equal(s.inkJourney.phase,STAGE_STATE.NEXT_FORK);
    assert.equal(s.inkJourney.cameraX,540);
    tick(s,.7);assert.equal(s.inkJourney.phase,STAGE_STATE.ACTIVE);
    assert.deepEqual(s.completedPaths,saved);assert.equal(s.fork.startY,392);
});
test('all five segments join the exact chosen world landmark, including different heights',()=>{
    const s=newState();
    for(const lane of [2,0,1,2,0]){
        const previous=s.completedPaths.at(-1);
        arrive(s,lane);
        const current=s.completedPaths.at(-1);
        if(previous)assert.deepEqual(current.points[0],[previous.end.x,previous.end.y]);
        assert.deepEqual(current.points[1],[201+current.originX,current.startY+9]);
        assert.deepEqual(current.points.at(-1),[current.end.x,current.end.y]);
        tick(s,2.6);
    }
    assert.equal(s.choices.length,5);assert.equal(s.completedPaths.length,5);
    assert.equal(s.inkJourney.phase,STAGE_STATE.COMPLETE);assert.equal(s.inkJourney.index,4);
    const {zoom,cameraX}=s.inkJourney;
    for(const path of s.completedPaths)for(const [x,y] of path.points){
        assert((x-cameraX)*zoom>=27&&(x-cameraX)*zoom<=773);
        assert(y*zoom+240*(1-zoom)>=27&&y*zoom+240*(1-zoom)<=453);
    }
    assert.deepEqual({zoom,cameraX},overviewCamera(s.completedPaths));
});
test('reload in each transition phase never duplicates a committed choice',()=>{
    let s=newState();arrive(s,0);
    for(const delay of [.2,.7,.4,.7,.7]){
        tick(s,delay);
        const count=s.choices.length,paths=structuredClone(s.completedPaths);
        s=restoreState(JSON.stringify(s));
        assert.equal(s.choices.length,count);assert.deepEqual(s.completedPaths,paths);
        assert.equal(choose(s,{continuous:true}),false);
    }
});
test('legacy saves reconstruct completed world routes without losing existing choices',()=>{
    const s=newState();arrive(s,2);tick(s,2.6);arrive(s,0);tick(s,2.6);
    delete s.completedPaths;delete s.inkJourney;
    const restored=restoreState(JSON.stringify(s));
    assert.equal(restored.choices.length,2);assert.equal(restored.completedPaths.length,2);
    assert.equal(restored.inkJourney.cameraX,1080);
    assert.deepEqual(restored.completedPaths[1].points[0],[620,392]);
});
test('a next fork starts at the same height through its shared stem and curve',()=>{
    for(const startY of [160,280,392])for(let lane=0;lane<3;lane++){
        assert.equal(forkPoint(lane,0,startY).y,startY);
        assert.equal(forkPoint(lane,.3,startY).y,startY);
        assert(Math.abs(forkPoint(lane,.300001,startY).y-startY)<.001);
    }
});

test('departing the completed overview preserves every real ink position on reload',()=>{
    const s=newState();
    for(const lane of [1,0,1,2,1]){arrive(s,lane);tick(s,2.6);}
    const paths=structuredClone(s.completedPaths),choices=structuredClone(s.choices);
    // The CTA changes only the stage; the following map uses the same saved record.
    s.stage='map';
    const restored=restoreState(JSON.stringify(s));
    assert.equal(restored.stage,'map');
    assert.deepEqual(restored.completedPaths,paths);
    assert.deepEqual(restored.choices,choices);
    assert.equal(restored.inkJourney.phase,STAGE_STATE.COMPLETE);
});
