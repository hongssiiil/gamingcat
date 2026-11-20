import { forkPoint } from './fork-motion.js';
export const STAGE_STATE=Object.freeze({ACTIVE:'ACTIVE',ARRIVED:'ARRIVED',PANNING:'PANNING',NEXT_FORK:'NEXT_FORK',ZOOMING:'ZOOMING',COMPLETE:'COMPLETE'});
export const STAGE_SPAN=540;
export const easeInOut=t=>t*t*(3-2*t);
export const initialJourney=()=>({phase:STAGE_STATE.ACTIVE,elapsed:0,index:0,cameraX:0,zoom:1});
export function makeCompletedPath(fork,choice,index,startY=270){
    const originX=index*STAGE_SPAN;
    const ink=fork.ink?.length?fork.ink:Array.from({length:181},(_,i)=>{const p=forkPoint(choice.selected,i/180,startY);return [p.x,p.y];});
    const end=forkPoint(choice.selected,1,startY);
    const points=ink.map(([x,y])=>[x+originX,y]);
    points[0]=[80+originX,startY];
    const endpoint=[end.x+originX,end.y];
    if(Math.hypot(points.at(-1)[0]-endpoint[0],points.at(-1)[1]-endpoint[1])>.001)points.push(endpoint);
    return {index,lane:choice.selected,label:choice.label,originX,startY,points,end:{x:endpoint[0],y:endpoint[1]}};
}
export function finishJourneyStage(state,oldFork,choice,continuous){
    state.completedPaths??=[];
    const index=state.choices.length-1,startY=state.completedPaths.at(-1)?.end.y??270;
    state.completedPaths.push(makeCompletedPath(oldFork,choice,index,startY));
    state.fork.startY=state.completedPaths.at(-1).end.y;
    if(continuous){
        const j=state.inkJourney??initialJourney();
        Object.assign(j,{phase:STAGE_STATE.ARRIVED,elapsed:0,index,cameraX:index*STAGE_SPAN,zoom:1,
            arrivedFork:{...oldFork,isResisting:false,resistance:0,startY},arrivalActors:null});
        state.inkJourney=j;
    }else{
        const next=Math.min(4,state.choices.length);
        state.inkJourney={...initialJourney(),index:next,cameraX:next*STAGE_SPAN};
        if(state.choices.length===5){state.inkJourney.phase=STAGE_STATE.COMPLETE;state.inkJourney.zoom=overviewCamera(state.completedPaths).zoom;state.inkJourney.cameraX=overviewCamera(state.completedPaths).cameraX;}
    }
}
export function overviewCamera(paths){
    const end=paths.at(-1)?.end.x??620;
    const zoom=Math.min(1,680/(end+80));
    return {zoom,cameraX:-40/zoom};
}
export function advanceJourney(j,dt,paths){
    if([STAGE_STATE.ACTIVE,STAGE_STATE.COMPLETE].includes(j.phase))return false;
    const before=j.phase;j.elapsed+=Math.min(.05,Math.max(0,dt));
    if(j.phase===STAGE_STATE.ARRIVED&&j.elapsed>=.8){
        j.phase=paths.length===5?STAGE_STATE.ZOOMING:STAGE_STATE.PANNING;j.elapsed=0;
        j.fromCameraX=j.cameraX;
    }else if(j.phase===STAGE_STATE.PANNING){
        const t=Math.min(1,j.elapsed);
        j.cameraX=j.fromCameraX+STAGE_SPAN*easeInOut(t);
        if(t===1){j.index=paths.length;j.phase=STAGE_STATE.NEXT_FORK;j.elapsed=0;j.cameraX=j.index*STAGE_SPAN;delete j.arrivedFork;delete j.arrivalActors;}
    }else if(j.phase===STAGE_STATE.NEXT_FORK&&j.elapsed>=.6){
        j.phase=STAGE_STATE.ACTIVE;j.elapsed=0;
    }else if(j.phase===STAGE_STATE.ZOOMING){
        const t=easeInOut(Math.min(1,j.elapsed/1.3)),target=overviewCamera(paths);
        j.cameraX=j.fromCameraX+(target.cameraX-j.fromCameraX)*t;
        j.zoom=1+(target.zoom-1)*t;
        if(j.elapsed>=1.3){j.phase=STAGE_STATE.COMPLETE;j.elapsed=0;j.cameraX=target.cameraX;j.zoom=target.zoom;}
    }
    return before!==j.phase;
}
export function restoreJourney(state){
    const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=3000&&p[1]>=0&&p[1]<=480;
    if(!Array.isArray(state.completedPaths)||state.completedPaths.length!==state.choices.length||
        state.completedPaths.some((p,i)=>!p||p.index!==i||p.lane!==state.choices[i].selected||!Array.isArray(p.points)||!p.points.length||p.points.length>1602||!p.points.every(validPoint)||!p.end||!Number.isFinite(p.end.x)||!Number.isFinite(p.end.y))){
        state.completedPaths=[];
        state.choices.forEach((choice,i)=>state.completedPaths.push(makeCompletedPath({},choice,i,state.completedPaths.at(-1)?.end.y??270)));
    }
    const j=state.inkJourney;
    if(!j||!Object.values(STAGE_STATE).includes(j.phase)||!['elapsed','cameraX','zoom','index'].every(k=>Number.isFinite(j[k]))||
        !Number.isInteger(j.index)||j.index<0||j.index>4||j.zoom<=0||j.zoom>1||j.elapsed<0||
        j.index!==(['ACTIVE','NEXT_FORK'].includes(j.phase)?Math.min(4,state.choices.length):Math.max(0,state.choices.length-1))){
        state.inkJourney={...initialJourney(),index:Math.min(4,state.choices.length),cameraX:Math.min(4,state.choices.length)*STAGE_SPAN};
    }
    if(state.choices.length===5&&!['ARRIVED','ZOOMING','COMPLETE'].includes(state.inkJourney.phase)){
        Object.assign(state.inkJourney,{phase:STAGE_STATE.COMPLETE,index:4,...overviewCamera(state.completedPaths)});
    }
    const current=state.inkJourney;
    if(current.phase===STAGE_STATE.COMPLETE)Object.assign(current,overviewCamera(state.completedPaths));
    if(state.stage==='fork'&&['ARRIVED','PANNING','ZOOMING','COMPLETE'].includes(current.phase)){
        const path=state.completedPaths[current.index];
        if(path&&(!current.arrivedFork||!Array.isArray(current.arrivedFork.ink)||!current.arrivedFork.ink.every(validPoint)))current.arrivedFork={lane:path.lane,progress:1,resistance:0,isResisting:false,startY:path.startY,
            ink:path.points.map(([x,y])=>[x-path.originX,y])};
        if([STAGE_STATE.PANNING,STAGE_STATE.ZOOMING].includes(current.phase)&&!Number.isFinite(current.fromCameraX))current.fromCameraX=current.index*STAGE_SPAN;
        if(current.arrivalActors&&!['player','cat'].every(key=>current.arrivalActors[key]&&['x','y'].every(axis=>Number.isFinite(current.arrivalActors[key][axis]))))delete current.arrivalActors;
    }
    const startY=state.completedPaths.at(-1)?.end.y??270;
    if(state.fork.startY!==startY&&state.fork.ink)state.fork.ink=[];
    state.fork.startY=startY;
    return state;
}
