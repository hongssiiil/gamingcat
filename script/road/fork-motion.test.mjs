import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,walkFork,choose,restoreState} from './model.js';
import {createForkMotion,updateForkMotion,forkPoint} from './fork-motion.js';
import {PLAYER_SPEED,CAT_PULL_SPEED,TETHER_LENGTH,FORK_GOAL_Y} from './fork-physics.js';
const state=()=>{const s=freshState();s.topic='진로';s.stage='fork';return s;};
test('shared stem and cubic guides still join existing landmarks',()=>{
    for(let lane=0;lane<3;lane++){assert.deepEqual(forkPoint(lane,0),{x:80,y:270});assert.deepEqual(forkPoint(lane,.3),{x:275,y:270});}
});
test('idle cat leads smoothly to its recommendation',()=>{
    const s=state();for(let i=0;i<2400&&s.fork.progress<1;i++)walkFork(s,0,0,1/60);
    assert.equal(s.fork.lane,0);assert.equal(s.fork.progress,1);assert.equal(choose(s),true);assert.equal(choose(s),false);
});
test('WASD moves on both axes and can backtrack without lane snapping',()=>{
    const s=state();walkFork(s,1,0,.05);const first={...s.fork.position};
    for(let i=0;i<30;i++)walkFork(s,1,1,1/60);
    const second={...s.fork.position};assert.ok(second.x>first.x&&second.y>first.y+20);
    for(let i=0;i<20;i++)walkFork(s,-1,-1,1/60);
    assert.ok(s.fork.position.x<second.x&&s.fork.position.y<second.y);
    assert.equal(s.fork.progress<1,true);assert.equal(choose(s),false);
});
test('cat keeps pulling after sustained opposing movement and after release',()=>{
    const s=state();s.fork.position={x:420,y:340};s.fork.catPosition={x:455,y:295};
    for(let i=0;i<240;i++)walkFork(s,0,1,1/60);
    assert.equal(s.fork.acceptedLane,null);assert.equal(s.fork.resistance,0);assert.equal(s.fork.isResisting,true);
    assert.ok(s.fork.catPosition.y<s.fork.position.y);const before=s.fork.position.y;
    for(let i=0;i<60;i++)walkFork(s,0,0,1/60);
    assert.ok(s.fork.position.y<before);assert.equal(s.fork.acceptedLane,null);
});
test('all three landmarks are reachable by actual directional input',()=>{
    for(let lane=0;lane<3;lane++){
        const s=state();for(let i=0;i<1800&&s.fork.progress<1;i++){
            const p=s.fork.position??{x:80,y:270};
            walkFork(s,p.x<612?1:p.x>626?-1:0,Math.abs(FORK_GOAL_Y[lane]-p.y)>2?Math.sign(FORK_GOAL_Y[lane]-p.y):0,1/60);
        }
        assert.equal(s.fork.progress,1);assert.equal(s.fork.lane,lane);assert.equal(choose(s),true);assert.equal(s.choices[0].selected,lane);
    }
});
test('saved movement is continuous, tethered, and survives reload',()=>{
    const s=state(),m=createForkMotion(s.fork);
    for(let i=0;i<500;i++){
        const before={...m.player};walkFork(s,i<250?1:-1,i%120<60?1:-1,1/60);updateForkMotion(m,s.fork,0,1/60);
        assert.ok(Math.hypot(m.player.x-before.x,m.player.y-before.y)<=(PLAYER_SPEED+CAT_PULL_SPEED)/60+.001);
        assert.ok(Math.hypot(m.player.x-m.cat.x,m.player.y-m.cat.y)<=TETHER_LENGTH+.001);
    }
    const last=s.fork.ink.at(-1);assert.ok(Math.hypot(last[0]-m.player.x,last[1]-m.player.y)<2.1);
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
});
test('30, 60 and 144 fps produce the same free movement',()=>{
    const results=[30,60,144].map(fps=>{const s=state();for(let i=0;i<fps*4;i++)walkFork(s,1,i<fps*2?1:-1,1/fps);return s.fork.position;});
    for(const p of results)assert.ok(Math.hypot(p.x-results[0].x,p.y-results[0].y)<5);
});
