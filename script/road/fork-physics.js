export const BRANCH_START=.30;
export const WALK_DURATION=6;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const FORK_GOAL_Y=[160,280,392];
export const PLAYER_SPEED=96;
export const CAT_PULL_SPEED=42;
export const TETHER_LENGTH=72;
export function advanceFork(f,recommended,dx,dy,dt){
    dt=clamp(dt,0,.05);
    if(f.progress>=1)return;
    const last=f.ink?.at(-1);
    f.position??=last?{x:last[0],y:last[1]}:{x:80+540*f.progress,y:f.startY??270};
    const p=f.position;
    f.catPosition??={x:p.x+38,y:p.y};
    const cat=f.catPosition;
    // Tiny continues toward its recommendation; input never unlocks a timed acceptance state.
    const guideX=clamp(p.x+55,80,620),t=clamp((guideX-245)/330,0,1),ease=t*t*(3-2*t);
    const target={x:guideX,y:(f.startY??270)+(FORK_GOAL_Y[recommended]-(f.startY??270))*ease};
    const tx=target.x-cat.x,ty=target.y-cat.y,travel=Math.min(1,120*dt/(Math.hypot(tx,ty)||1));
    cat.x+=tx*travel;cat.y+=ty*travel;
    let cx=cat.x-p.x,cy=cat.y-p.y,d=Math.hypot(cx,cy)||1;
    if(d>TETHER_LENGTH){cat.x=p.x+cx*TETHER_LENGTH/d;cat.y=p.y+cy*TETHER_LENGTH/d;cx=cat.x-p.x;cy=cat.y-p.y;d=TETHER_LENGTH;}
    const length=Math.hypot(dx,dy)||1,ix=dx/length,iy=dy/length;
    const pull=CAT_PULL_SPEED*clamp(d/42,0,1);
    f.isResisting=(dx!==0||dy!==0)&&(ix*cx+iy*cy)/d<.35&&pull>4;
    f.resisted||=f.isResisting;f.pullForce=pull/CAT_PULL_SPEED;
    f.resistance=0;f.acceptedLane=null;
    p.x=clamp(p.x+(ix*PLAYER_SPEED+cx/d*pull)*dt,80,640);
    p.y=clamp(p.y+(iy*PLAYER_SPEED+cy/d*pull)*dt,150,410);
    const separation=Math.hypot(cat.x-p.x,cat.y-p.y);
    if(separation>TETHER_LENGTH){cat.x=p.x+(cat.x-p.x)*TETHER_LENGTH/separation;cat.y=p.y+(cat.y-p.y)*TETHER_LENGTH/separation;}
    f.lane=FORK_GOAL_Y.reduce((best,y,i)=>Math.abs(y-p.y)<Math.abs(FORK_GOAL_Y[best]-p.y)?i:best,0);
    f.progress=clamp((p.x-80)/540,0,.999);
    if(Math.hypot(p.x-620,p.y-FORK_GOAL_Y[f.lane])<14)f.progress=1;
    f.ink??=[[80,f.startY??270]];
    const tail=f.ink.at(-1);
    if(!tail||Math.hypot(p.x-tail[0],p.y-tail[1])>=2||f.progress===1)f.ink.push([p.x,p.y]);
    if(f.ink.length>1600)f.ink=f.ink.filter((_,i)=>i%2===0||i===f.ink.length-1);
}
