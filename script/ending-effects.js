export function tokenUsageBand(spent){
    const amount=Number.isFinite(spent)?Math.max(0,spent):0;
    if(amount<=10)return 0;
    if(amount<20)return 1;
    if(amount<=30)return 2;
    return 3;
}

export function endingEffectForJourney(journey){
    const spent=Math.max(0,30-(Number.isFinite(journey?.tokens)?journey.tokens:30));
    const band=tokenUsageBand(spent);
    return {spent,band,kind:band<2?'meteor':band===2?'none':'token',density:band===0?16:band===1?8:0,busy:band===3};
}

const TOKEN_PHASES=Object.freeze(Array.from({length:14},(_,i)=>({
    x:.08+(i*37%83)/100,
    delay:i*420,
    duration:band=>band===3?12000+(i%4)*900:18000+(i%5)*1200,
    size:band=>band===3?7+(i%3):8+(i%2),
})));

export function drawPixelToken(ctx,x,y,size,alpha){
    const unit=Math.max(1,Math.round(size/9)),rows=[1,3,5,7,9,7,5,3,1];
    const left=Math.round((x-9*unit/2)/2)*2,top=Math.round((y-9*unit/2)/2)*2;
    ctx.save();ctx.globalAlpha*=alpha;
    for(let row=0;row<rows.length;row++){
        const width=rows[row],start=(9-width)/2;
        ctx.fillStyle='#858585';ctx.fillRect(left+(start-1)*unit,top+row*unit,(width+2)*unit,unit);
        ctx.fillRect(left+start*unit,top+row*unit,width*unit,unit);
    }
    ctx.restore();
}

export function drawEndingEffect(ctx,width,height,time,effect,still=false){
    if(still||!effect||effect.kind==='none')return;
    if(effect.kind==='meteor')return;
    const count=effect.busy?TOKEN_PHASES.length:5,ceiling=height*.72;
    for(let i=0;i<count;i++){
        const particle=TOKEN_PHASES[i],duration=particle.duration(effect.band),cycle=duration+(effect.busy?i%4*130:550);
        const age=time-particle.delay*(effect.busy?1:2);
        if(age<0)continue;
        const phase=age%cycle;
        if(phase>=duration)continue;
        const progress=phase/duration,y=-20+progress*(ceiling+40);
        const sway=effect.busy?Math.sin(progress*Math.PI*2+i)*1.5:0;
        const x=width*particle.x+sway;
        drawPixelToken(ctx,x,y,particle.size(effect.band),effect.busy?.86:.62);
    }
}
