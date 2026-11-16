import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, moveFork, scenario } from './model.js';
import { createForkMotion, updateForkMotion } from './fork-motion.js';

test('each new fork starts at the height of the previously chosen exit', () => {
    for(const startY of [120,250,380]){
        const motion=createForkMotion({lane:1,progress:0},startY);
        assert.equal(motion.player.y,startY);
        assert.equal(motion.cat.y,startY);
        updateForkMotion(motion,{lane:1,progress:0,resistance:0},2,1/60);
        assert.equal(motion.player.y,startY);
    }
});

test('player speed stays equal across recommendation, hesitation and resumed movement', () => {
    const states=[freshState(),freshState()];
    for(const s of states){s.topic='진로';s.stage='fork';}
    states[0].fork.lane=scenario(states[0]).recommended;
    states[1].fork.lane=(states[0].fork.lane+1)%3;
    for(let i=0;i<180;i++){
        const direction=i>30&&i<50?0:1;
        for(const s of states)moveFork(s,direction,1/60);
        assert.equal(states[0].fork.progress,states[1].fork.progress);
    }
    assert.equal(states[1].fork.resisted,true);
});

test('reaction ending and lane changes never teleport either character', () => {
    const s=freshState();s.topic='진로';s.stage='fork';s.fork.lane=2;
    const motion=createForkMotion(s.fork);let sawReaction=false;
    for(let i=0;i<200;i++){
        if(i===95)s.fork.lane=0;
        const before=structuredClone(motion);
        moveFork(s,1,1/60);
        const reacting=updateForkMotion(motion,s.fork,0,1/60,true);
        sawReaction ||= reacting;
        for(const key of ['player','cat']){
            assert.ok(Math.hypot(motion[key].x-before[key].x,motion[key].y-before[key].y)<=280/60+0.00001);
        }
    }
    assert.ok(sawReaction);
});

test('following settles at the same target at 30, 60 and 144 fps', () => {
    const fork={lane:2,progress:0.7,resistance:1};
    const results=[30,60,144].map(fps=>{
        const motion=createForkMotion({...fork,progress:0});
        for(let i=0;i<fps*3;i++)updateForkMotion(motion,fork,0,1/fps);
        return motion;
    });
    for(const result of results)assert.ok(Math.abs(result.cat.x-results[0].cat.x)<0.2);
});

test('Tiny leads when the player takes the recommended route', () => {
    const s=freshState();s.topic='진로';s.stage='fork';s.fork.lane=0;
    const motion=createForkMotion(s.fork);
    for(let i=0;i<90;i++){moveFork(s,1,1/60);updateForkMotion(motion,s.fork,0,1/60);}
    assert.ok(motion.cat.x>motion.player.x);
});
