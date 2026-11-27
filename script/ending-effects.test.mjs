import test from 'node:test';
import assert from 'node:assert/strict';
import {drawEndingEffect,drawPixelToken,endingEffectForJourney,tokenUsageBand} from './ending-effects.js';
import {drawNightDetails,meteorLane,meteorMotion,meteorTracksAt,METEOR_CYCLE} from './ending-art.js';

function canvas(){const rects=[],stack=[];return {rects,globalAlpha:1,fillStyle:'',save(){stack.push([this.globalAlpha,this.fillStyle]);},restore(){[this.globalAlpha,this.fillStyle]=stack.pop();},fillRect(...rect){rects.push([...rect,this.globalAlpha,this.fillStyle]);}};}

test('token use bands include each boundary and continue above the starting allowance',()=>{
    assert.deepEqual([0,10,11,19,20,30,31,44].map(tokenUsageBand),[0,0,1,1,2,2,3,3]);
    assert.equal(endingEffectForJourney({tokens:30}).kind,'meteor');
    assert.equal(endingEffectForJourney({tokens:30}).density,16);
    assert.equal(endingEffectForJourney({tokens:19}).density,8);
    assert.equal(endingEffectForJourney({tokens:10}).kind,'none');
    assert.equal(endingEffectForJourney({tokens:0}).kind,'none');
    assert.equal(endingEffectForJourney({tokens:-1}).busy,true);
    assert.equal(endingEffectForJourney({}).spent,0);
});

test('lower token use selects meteors, while 0-10 remaining tokens has no falling effect',()=>{
    const low=endingEffectForJourney({tokens:30}),moderate=endingEffectForJourney({tokens:19});
    const lowCanvas=canvas(),moderateCanvas=canvas(),tokenCanvas=canvas();
    const coords=[{x:200,y:200},{x:500,y:400}];
    drawNightDetails(lowCanvas,800,600,coords,8000,false,'cat',low.density);
    drawNightDetails(moderateCanvas,800,600,coords,8000,false,'cat',moderate.density);
    drawEndingEffect(tokenCanvas,800,600,0,endingEffectForJourney({tokens:10}));
    let lowTotal=0,moderateTotal=0;
    for(let time=2000;time<2000+METEOR_CYCLE;time+=2500){
        lowTotal+=meteorTracksAt(time,low.density).length;
        moderateTotal+=meteorTracksAt(time,moderate.density).length;
    }
    assert(lowTotal>moderateTotal);
    assert.equal(tokenCanvas.rects.length,0);
});

test('token artwork is drawn as a centered pixel diamond',()=>{
    const ctx=canvas();drawPixelToken(ctx,80,60,8,1);
    const outline=ctx.rects.filter(rect=>rect[5]==='#858585');
    const outlineWidths=outline.map(rect=>rect[2]);
    assert.deepEqual(outlineWidths,[3,1,5,3,7,5,9,7,11,9,9,7,7,5,5,3,3,1]);
    const centers=outline.map(rect=>rect[0]+rect[2]/2);
    assert(centers.every(center=>center===centers[0]));
    assert(ctx.rects.every(rect=>rect[5]==='#858585'));
});

test('negative token balance keeps the slow token drop effect',()=>{
    const ctx=canvas();drawEndingEffect(ctx,800,600,0,endingEffectForJourney({tokens:-1}));
    assert(ctx.rects.length>0);
    assert.equal(endingEffectForJourney({tokens:-1}).kind,'token');
    // Even after five seconds, the first ordinary token has only just begun to descend.
    const later=canvas();drawEndingEffect(later,800,600,5000,endingEffectForJourney({tokens:-1}));
    assert(later.rects.length>0);
    assert(Math.max(...later.rects.map(r=>r[1]+r[3]))<130);
});

test('negative-balance token drops enter from the top in staggered waves',()=>{
    const effect=endingEffectForJourney({tokens:-1}),early=canvas(),later=canvas();
    drawEndingEffect(early,800,600,0,effect);
    drawEndingEffect(later,800,600,4000,effect);
    const bounds=ctx=>({min:Math.min(...ctx.rects.map(r=>r[1])),max:Math.max(...ctx.rects.map(r=>r[1]+r[3]))});
    assert(early.rects.length>0&&later.rects.length>early.rects.length);
    assert(bounds(early).min<0&&bounds(early).max<bounds(later).max);
});

test('meteor shimmer changes brightness and adds a bright pixel glint',()=>{
    const coords=[{x:200,y:200},{x:500,y:400}],a=canvas(),b=canvas();
    drawNightDetails(a,800,600,coords,2100,false,'cat',1);
    drawNightDetails(b,800,600,coords,2450,false,'cat',1);
    const streak=c=>c.rects.filter(rect=>['#fff9df','#e5f3ff','#b9d9ff'].includes(rect[5]));
    assert(streak(a).length>0&&streak(b).length>0);
    assert.notDeepEqual(streak(a).map(rect=>rect[4]),streak(b).map(rect=>rect[4]));
    assert(a.rects.some(rect=>rect[5]==='#fffdf0')&&b.rects.some(rect=>rect[5]==='#fffdf0'));
});

test('meteor tracks occupy separate lanes with proportional density between bands',()=>{
    const low=Array.from({length:16},(_,i)=>meteorLane(i,16));
    const moderate=Array.from({length:8},(_,i)=>meteorLane(i,8));
    for(const lanes of [low,moderate])for(let i=0;i<lanes.length;i++)for(let j=i+1;j<lanes.length;j++){
        assert(Math.hypot((lanes[i].x-lanes[j].x)*800,(lanes[i].y-lanes[j].y)*600)>40);
    }
    assert.equal(low.length,moderate.length*2);
});

test('meteors travel faster with longer pixel tails',()=>{
    const meteor={dx:.25,dy:.2,length:20};
    assert.deepEqual(meteorMotion(meteor,16),{dx:.16,dy:.11000000000000001,length:15});
    assert.deepEqual(meteorMotion(meteor,8),{dx:.16,dy:.11000000000000001,length:18});
});

test('31+ token use drops more tokens and reduced motion draws neither effect',()=>{
    const regular=canvas(),busy=canvas(),still=canvas();
    drawEndingEffect(regular,800,600,5000,endingEffectForJourney({tokens:0}));
    drawEndingEffect(busy,800,600,5000,endingEffectForJourney({tokens:-1}));
    drawEndingEffect(still,800,600,0,endingEffectForJourney({tokens:-1}),true);
    assert(busy.rects.length>regular.rects.length);
    assert.equal(still.rects.length,0);
});
