import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,choose,advanceMap,restoreState,routeMetrics} from './model.js';
import {explorationRoute,sampleExploration,explorationLimit,mapEncounter,explorationInk,inkVisibility,createExplorationMotion,updateExplorationMotion,cameraTarget,explorationScale} from './exploration.js';

function completedMap(){
    const s=freshState();s.topic='진로';s.stage='fork';
    for(const lane of [1,0,1,2,1]){s.fork.lane=lane;s.fork.progress=1;choose(s);}
    s.stage='map';return s;
}
test('exploration follows the saved ink, including a detour, without changing choices',()=>{
    const s=completedMap(),path=s.completedPaths[0];
    path.points.splice(1,0,[99,313]);
    const snapshot=structuredClone(s.completedPaths),route=explorationRoute(s.completedPaths);
    const detour=route.points.find(p=>p.x===99&&p.y===313);
    assert(detour);assert.deepEqual(sampleExploration(route,detour.distance),detour);
    assert.equal(route.nodes.length,5);
    for(const node of route.nodes){const p=sampleExploration(route,node.distance);assert.equal(p.x,node.x);assert.equal(p.y,node.y);}
    advanceMap(s,1,1);assert.deepEqual(s.completedPaths,snapshot);
});
test('unsolved puzzles at 1/3, tutorial at 4 and wolf at 5 stop movement, even with a long frame',()=>{
    const s=completedMap(),route=explorationRoute(s.completedPaths);
    for(const [at,id] of [[1,'pond'],[3,'climb'],[4,'tutorial'],[5,'battle']]){
        assert.equal(advanceMap(s,1,100).id,id);
        assert.equal(s.mapDistance,route.nodes[at-1].distance-76);
        assert.equal(mapEncounter(s).id,id);
        const before=s.mapDistance;advanceMap(s,1,100);assert.equal(s.mapDistance,before);
        advanceMap(s,-1,.1);assert.equal(mapEncounter(s),null);
        advanceMap(s,1,.1);assert.equal(mapEncounter(s).id,id);
        if(id!=='battle')s.completed.push(id);
    }
    assert(s.mapDistance>route.nodes[3].distance);
});
test('puzzle slots interrupt the rendered ink and reconnect only after that puzzle is solved',()=>{
    const s=completedMap(),route=explorationRoute(s.completedPaths);
    const crosses=(segments,d)=>segments.some(p=>p.from<d&&p.to>=d);
    let segments=explorationInk(route,s.completed);
    assert(!crosses(segments,route.nodes[0].distance));assert(!crosses(segments,route.nodes[2].distance));
    assert(crosses(segments,route.nodes[1].distance));assert(crosses(segments,route.nodes[3].distance));
    s.completed.push('pond');segments=explorationInk(route,s.completed);
    assert(crosses(segments,route.nodes[0].distance));assert(!crosses(segments,route.nodes[2].distance));
});
test('backtracking and reload preserve explored ink and the exact saved route',()=>{
    const s=completedMap();advanceMap(s,1,100);const farthest=s.mapFurthest;
    advanceMap(s,-1,1);assert.equal(s.mapFurthest,farthest);
    const restored=restoreState(JSON.stringify(s));assert.deepEqual(restored,s);
    assert.equal(inkVisibility(0,s.mapFurthest),1);assert.equal(inkVisibility(farthest+600,farthest),0);
    assert.equal(inkVisibility(farthest+8,farthest),0);assert(inkVisibility(farthest-6,farthest)>0);
});
test('legacy SVG progress migrates to the same obstacle without erasing its choices',()=>{
    const s=completedMap();delete s.mapPathVersion;delete s.mapFurthest;
    s.mapDistance=routeMetrics(s.choices).distances[0+1];
    const restored=restoreState(JSON.stringify(s));
    assert.deepEqual(restored.choices,s.choices);assert.deepEqual(restored.completedPaths,s.completedPaths);
    assert.equal(mapEncounter(restored).id,'pond');assert.equal(restored.mapDistance,explorationLimit(restored).distance);
});
test('camera eases toward the player and footsteps only appear after real movement',()=>{
    const s=completedMap(),motion=createExplorationMotion(s);
    updateExplorationMotion(motion,s,1/60);assert.equal(motion.footprints.length,0);
    const before=motion.cameraX;advanceMap(s,1,2);updateExplorationMotion(motion,s,1/60);
    const target=cameraTarget(motion.route,sampleExploration(motion.route,s.mapDistance));
    assert(motion.cameraX>before&&motion.cameraX<target);assert.equal(motion.footprints.length,1);
    for(let i=0;i<120;i++)updateExplorationMotion(motion,s,1/60);
    assert(Math.abs(motion.cameraX-target)<.01);assert.equal(motion.footprints.length,1);
});
test('narrow and wide canvases fit two to three segments and leave room for the last landmark',()=>{
    const s=completedMap(),route=explorationRoute(s.completedPaths),last=route.nodes.at(-1);
    for(const width of [480,800]){
        const scale=explorationScale(width),camera=cameraTarget(route,last,width);
        const visibleSegments=(width-56)/scale/540;
        assert(visibleSegments>=2&&visibleSegments<=3);
        const x=48+(last.x-camera)*scale;
        assert(x-56>28&&x+56<width-28);
    }
});
