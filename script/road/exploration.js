import { CHECKPOINTS } from './content.js';

export const ENCOUNTER_DISTANCE=76;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const routes=new WeakMap();
// One arc-length table drives both drawing and movement on the recorded ink.
export function explorationRoute(paths){
    const cached=routes.get(paths);if(cached?.count===paths.length)return cached.route;
    const points=[],nodes=[];let distance=0;
    for(const path of paths){
        for(const [x,y] of path.points){
            const previous=points.at(-1);
            if(previous){const length=Math.hypot(x-previous.x,y-previous.y);if(length<.001)continue;distance+=length;}
            points.push({x,y,distance});
        }
        nodes.push({...path.end,index:path.index,lane:path.lane,label:path.label,distance});
    }
    const route={points,nodes,total:distance};routes.set(paths,{count:paths.length,route});return route;
}
export function sampleExploration(route,distance){
    if(!route.points.length)return {x:80,y:270,distance:0};
    const d=clamp(distance,0,route.total),points=route.points;
    let low=0,high=points.length-1;
    while(low<high){const mid=(low+high)>>1;if(points[mid].distance<d)low=mid+1;else high=mid;}
    const b=points[low],a=points[Math.max(0,low-1)],t=(d-a.distance)/(b.distance-a.distance||1);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,distance:d};
}
export function explorationLimit(state,route=explorationRoute(state.completedPaths)){
    const next=CHECKPOINTS.find(c=>!state.completed.includes(c.id));
    const node=next&&route.nodes[next.at-1];
    return {checkpoint:next,node,distance:node?Math.max(0,node.distance-ENCOUNTER_DISTANCE):route.total};
}
export function mapEncounter(state){
    const limit=explorationLimit(state);
    return limit.node&&Math.abs(state.mapDistance-limit.distance)<.1?limit.checkpoint:null;
}
export function inkVisibility(distance,furthest){
    // Reveal only the ink that has reached the player. A short soft edge makes
    // the front look as if it is soaking into the parchment while moving.
    const t=clamp((furthest+8-distance)/28,0,1);
    return t*t*(3-2*t);
}
const inkSegments=new WeakMap();
export function explorationInk(route,completed){
    const key=completed.join('|'),cached=inkSegments.get(route);if(cached?.key===key)return cached.segments;
    const gaps=CHECKPOINTS.filter(c=>c.id!=='battle'&&!completed.includes(c.id)).map(c=>route.nodes[c.at-1]).filter(Boolean);
    const segments=[];
    for(let i=1;i<route.points.length;i++){
        const a=route.points[i-1],b=route.points[i];let intervals=[[a.distance,b.distance]];
        for(const node of gaps)intervals=intervals.flatMap(([from,to])=>{
            const left=node.distance-38,right=node.distance+38;
            if(to<=left||from>=right)return [[from,to]];
            return [...(from<left?[[from,left]]:[]),...(to>right?[[right,to]]:[])];
        });
        for(const [from,to] of intervals){
            const point=d=>{const t=(d-a.distance)/(b.distance-a.distance);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
            segments.push({a:point(from),b:point(to),from,to});
        }
    }
    inkSegments.set(route,{key,segments});return segments;
}
export function explorationScale(width=800){return .58*(width-90)/710;}
export function cameraTarget(route,point,width=800){
    const scale=explorationScale(width),anchor=width*.36;
    return clamp(point.x-(anchor-48)/scale,0,Math.max(0,(route.nodes.at(-1)?.x??80)-(width-138)/scale));
}
export function createExplorationMotion(state,width=800){
    const route=explorationRoute(state.completedPaths),point=sampleExploration(route,state.mapDistance);
    return {route,width,cameraX:cameraTarget(route,point,width),distance:state.mapDistance,inkDistance:state.mapFurthest,
        catDistance:Math.max(0,state.mapDistance-34),direction:1,moving:false,time:0,footprints:[],lastStep:state.mapDistance};
}
export function updateExplorationMotion(motion,state,dt){
    const frozen=state.stage!=='map'||Boolean(motion.clearEffect);
    if(motion.clearEffect){
        motion.clearEffect.elapsed+=dt;
        if(motion.clearEffect.elapsed>=.5)delete motion.clearEffect;
    }
    motion.time+=dt;
    // The visual ink front follows recorded progress with a small delay. It
    // never retreats, so backtracking keeps every line already drawn.
    motion.inkDistance??=state.mapFurthest;
    motion.inkDistance=Math.min(state.mapFurthest,motion.inkDistance+240*dt);
    if(frozen){motion.moving=false;motion.distance=state.mapDistance;return motion;}
    const delta=state.mapDistance-motion.distance;
    motion.moving=Math.abs(delta)>.001;
    if(motion.moving)motion.direction=Math.sign(delta);
    motion.distance=state.mapDistance;
    const point=sampleExploration(motion.route,state.mapDistance),rate=1-Math.exp(-6*dt);
    motion.cameraX+=(cameraTarget(motion.route,point,motion.width)-motion.cameraX)*rate;
    const catTarget=Math.max(0,state.mapDistance-34);
    motion.catDistance+=(catTarget-motion.catDistance)*(1-Math.exp(-12*dt));
    if(motion.moving&&Math.abs(state.mapDistance-motion.lastStep)>=18){
        motion.footprints.push({distance:state.mapDistance,time:motion.time,side:motion.footprints.length%2?1:-1});
        motion.lastStep=state.mapDistance;
    }
    motion.footprints=motion.footprints.filter(p=>motion.time-p.time<8).slice(-80);
    return motion;
}
