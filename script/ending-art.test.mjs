import test from 'node:test';
import assert from 'node:assert/strict';
import {starAppearance,skyParticles,drawNightDetails,drawChoiceStar,meteorAt,METEOR_GAPS,drawStarlight,WATERMARKS} from './ending-art.js';
import {endingScenes,constellationName,constellationTheme} from './ending-model.js';
import {dioramaMotion} from './ending-diorama.js';
test('actual choices receive gold and blue stars; unknown records are never classified as direct',()=>{
    const choices=[0,1].map((selected,i)=>({scene:`fork-${i+1}`,selected,recommended:0,options:['추천','직접'],label:'선택'}));
    const records=endingScenes({choices,completed:['pond']});
    assert.equal(starAppearance(records[1]).kind,'followed');assert.equal(starAppearance(records[1]).color,'#b09a70');
    assert.equal(starAppearance(records[2]).kind,'direct');assert.equal(starAppearance(records[2]).color,'#82958e');
    assert.equal(starAppearance(records[6]).kind,'memory');assert.equal(starAppearance(records[3]).kind,'empty');
    assert.equal(starAppearance(endingScenes({},'escape')[8]).kind,'escape');
    const battle=accepted=>({playerChoice:'공격',accepted});
    assert.equal(starAppearance(endingScenes({battles:[battle(true)]},'victory')[8]).kind,'followed');
    assert.equal(starAppearance(endingScenes({battles:[battle(false)]},'victory')[8]).kind,'direct');
    for(const battles of [[battle(true),battle(false)],[battle(true),battle(null)]])assert.equal(starAppearance(endingScenes({battles},'victory')[8]).kind,'memory');
});
function canvas(){const rects=[],stack=[];return {rects,globalAlpha:1,fillStyle:'',save(){stack.push([this.globalAlpha,this.fillStyle]);},restore(){[this.globalAlpha,this.fillStyle]=stack.pop();},fillRect(...r){rects.push([...r,this.fillStyle,this.globalAlpha]);}};}
test('sky particles are stable and reduced-motion scenery does not change over time',()=>{
    assert.deepEqual(skyParticles(),skyParticles());assert(skyParticles().every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<.72));
    const a=canvas(),b=canvas(),coords=[{x:200,y:200},{x:500,y:400}];
    drawNightDetails(a,800,600,coords,0,true);drawNightDetails(b,800,600,coords,8600,true);
    assert.deepEqual(a.rects,b.rects);
    const moving=canvas();drawNightDetails(moving,800,600,coords,2600,false);assert(moving.rects.length>a.rects.length);
    assert(new Set(skyParticles().map(p=>p.period)).size>90);
});
test('every constellation name selects its matching distinct watermark',()=>{
    for(const [records,key,title] of [
        [[{accepted:true}],'cat','함께 걷는 검은고양이자리'],
        [[{accepted:false}],'compass','자신의 길을 낸 나침반자리'],
        [[{accepted:false},{accepted:true}],'traveler','숲을 건넌 여행자자리'],
    ]){assert.equal(constellationTheme(records),key);assert.equal(constellationName(records),title);}
    assert.equal(new Set(Object.values(WATERMARKS).map(JSON.stringify)).size,3);
});
test('meteors vary at two to four second intervals and last roughly two to three seconds',()=>{
    assert(new Set(METEOR_GAPS).size>20);assert(METEOR_GAPS.every(gap=>gap>=2000&&gap<=4000));
    let time=2000;const variants=[];
    for(let i=0;i<METEOR_GAPS.length;i++){
        const meteor=meteorAt(time+100);assert.equal(meteor.index,i);
        assert(meteor.progress>0&&meteor.progress<1);assert(meteor.duration>=2200&&meteor.duration<3200);
        const midpoint=meteorAt(time+meteor.duration/2);assert.equal(midpoint.index,i);assert(Math.abs(midpoint.progress-.5)<.03);
        assert.equal(meteorAt(time+meteor.duration+100),null);
        variants.push(meteor);time+=meteor.duration+METEOR_GAPS[i];
    }
    assert.equal(meteorAt(time+100).index,0);
    for(const key of ['duration','x','y','length','alpha'])assert(new Set(variants.map(m=>m[key])).size>8);
});
test('background uses sparse dots and only a minority slowly twinkle without nebula blocks',()=>{
    const stars=skyParticles();assert.equal(stars.length,100);
    assert(stars.every(p=>[1,2].includes(p.size)&&p.period>=8000));
    assert(stars.filter(p=>p.twinkle).length<stars.length/2);
    const a=canvas();drawNightDetails(a,800,600,[{x:200,y:200},{x:500,y:400}],0,true);
    assert(a.rects.filter(r=>r[4]==='#bac2bd').every(r=>r[2]<=2&&r[3]<=2));
    assert(a.rects.every(r=>['#bac2bd','#9aabdc'].includes(r[4])));
});
test('constellation lines stay fixed without a traveling head',()=>{
    const a=canvas(),b=canvas(),start={x:10,y:10},end={x:100,y:100};
    drawStarlight(a,start,end,'#ffffff');drawStarlight(b,start,end,'#ffffff');
    assert.deepEqual(a.rects,b.rects);assert(a.rects.every(r=>r[2]===1&&r[3]===1));
});
test('intro line grows only to its current endpoint and stays complete afterward',()=>{
    const start={x:10,y:10},end={x:110,y:10},hidden=canvas(),half=canvas(),full=canvas(),later=canvas();
    drawStarlight(hidden,start,end,'#ffffff',0);assert.equal(hidden.rects.length,0);
    drawStarlight(half,start,end,'#ffffff',.5);assert.equal(Math.max(...half.rects.map(r=>r[0])),60);
    drawStarlight(full,start,end,'#ffffff',1);drawStarlight(later,start,end,'#ffffff',2);
    assert.deepEqual(full.rects,later.rects);
});
test('idle stars breathe in place and background dots change brightness without moving',()=>{
    const a=canvas(),b=canvas(),record={hasRecord:true,accepted:true};
    drawChoiceStar(a,100,100,record,{time:0});drawChoiceStar(b,100,100,record,{time:2250});
    assert.deepEqual(a.rects.map(r=>r.slice(0,5)),b.rects.map(r=>r.slice(0,5)));
    assert.notDeepEqual(a.rects,b.rects);
    const skyA=canvas(),skyB=canvas(),coords=[{x:200,y:200},{x:500,y:400}];
    drawNightDetails(skyA,800,600,coords,0);drawNightDetails(skyB,800,600,coords,4000);
    const dots=c=>c.rects.filter(r=>r[4]==='#bac2bd');
    assert.deepEqual(dots(skyA).map(r=>r.slice(0,5)),dots(skyB).map(r=>r.slice(0,5)));
    assert(dots(skyA).some((r,i)=>Math.abs(r[5]-dots(skyB)[i][5])>.08));
});
test('unformed stars are invisible and idle breathing has a visible brightness range',()=>{
    const hidden=canvas(),bright=canvas(),dim=canvas(),record={hasRecord:true,accepted:true};
    drawChoiceStar(hidden,100,100,record,{formation:0});assert.equal(hidden.rects.length,0);
    drawChoiceStar(bright,100,100,record,{time:1200});drawChoiceStar(dim,100,100,record,{time:3600});
    const alpha=c=>Math.max(...c.rects.filter(r=>r[4]===starAppearance(record).core).map(r=>r[5]));
    assert(alpha(bright)-alpha(dim)>.6);
});
test('foreground motion and hover rings animate but reduced motion remains fixed',()=>{
    assert.notDeepEqual(dioramaMotion(0),dioramaMotion(2000));assert.equal(dioramaMotion(4250).blink,true);
    assert.deepEqual(dioramaMotion(0,true),dioramaMotion(4250,true));
    const a=canvas(),b=canvas(),record={hasRecord:true,accepted:true};
    drawChoiceStar(a,100,100,record,{highlight:true,ripple:100});drawChoiceStar(b,100,100,record,{highlight:true,ripple:800});
    assert.notDeepEqual(a.rects,b.rects);assert(b.rects.every(r=>r.slice(0,4).every(Number.isInteger)));
});
test('choice star pixels stay on integer coordinates and hover enlarges the cross',()=>{
    const a=canvas(),b=canvas(),record={hasRecord:true,accepted:true};
    drawChoiceStar(a,100.4,100.8,record);drawChoiceStar(b,100.4,100.8,record,{highlight:true});
    for(const ctx of [a,b])assert(ctx.rects.every(r=>r.slice(0,4).every(Number.isInteger)));
    const core=ctx=>ctx.rects.filter(r=>r[4]==='#b09a70'&&r[5]>.5);
    assert(Math.max(...core(b).map(r=>r[0]))>Math.max(...core(a).map(r=>r[0])));
});
