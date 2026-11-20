import { BRANCH_START,clamp } from './fork-physics.js';
export const FORK_START={x:80,y:270};
export const FORK_END_Y=[160,280,392];
export function forkPoint(lane,progress,startY=270){
    if(progress<=BRANCH_START)return {x:80+195*progress/BRANCH_START,y:startY};
    const t=(progress-BRANCH_START)/(1-BRANCH_START),u=1-t,y=FORK_END_Y[lane];
    return {x:u*u*u*275+3*u*u*t*400+3*u*t*t*450+t*t*t*620,
        y:u*u*u*startY+3*u*u*t*startY+3*u*t*t*y+t*t*t*y};
}
export function createForkMotion(fork){
    if(!fork.ink?.length){
        fork.ink=[];
        const steps=Math.max(1,Math.ceil(fork.progress*180));
        for(let i=0;i<=steps;i++){const p=forkPoint(fork.lane,fork.progress*i/steps,fork.startY);fork.ink.push([p.x,p.y]);}
    }
    const p=forkPoint(fork.lane,fork.progress,fork.startY),last=fork.ink?.at(-1);
    const player=fork.position??(last?{x:last[0],y:last[1]}:p);
    return {player:{...player},cat:{...(fork.catPosition??{x:player.x+38,y:player.y})},time:0,tension:0,playerMoving:false,catMoving:false};
}
export function updateForkMotion(motion,fork,recommended,dt){
    motion.time+=dt;
    if(fork.position){
        for(const kind of ['player','cat']){
            const target=kind==='player'?fork.position:(fork.catPosition??motion.cat);
            const old=motion[kind];motion[kind+'Moving']=Math.hypot(target.x-old.x,target.y-old.y)>.02;
            if(Math.abs(target.x-old.x)>.02)motion[kind+'Flip']=target.x<old.x;
            motion[kind]={...target};
        }
        motion.tension=clamp((Math.hypot(motion.cat.x-motion.player.x,motion.cat.y-motion.player.y)-24)/48,0,1);
        return fork.isResisting;
    }
    return false;
}
