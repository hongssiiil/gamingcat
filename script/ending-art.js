export function starAppearance(record){
    if(record.black)return {kind:'escape',label:'도주의 기록',color:'#aaa1b3',core:'#131b30'};
    if(!record.hasRecord)return {kind:'empty',label:'기록 없음',color:'#677b99',core:'#9aa9bc'};
    if(record.accepted===true)return {kind:'followed',label:'티니의 추천을 따른 선택',color:'#b09a70',core:'#c9b88f'};
    if(record.accepted===false)return {kind:'direct',label:'직접 고른 선택',color:'#82958e',core:'#b3bdb0'};
    return {kind:'memory',label:'여정의 기록',color:'#a6a18b',core:'#c6bea5'};
}
export function pixelLine(ctx,x0,y0,x1,y1,color,step=2){
    x0=Math.round(x0/step);y0=Math.round(y0/step);x1=Math.round(x1/step);y1=Math.round(y1/step);
    const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
    let error=dx+dy;ctx.fillStyle=color;
    while(true){ctx.fillRect(x0*step,y0*step,step,step);if(x0===x1&&y0===y1)break;const e=error*2;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}
const CROSS=['00000100000','00000100000','00001110000','00001110000','00111111100','11111111111','00111111100','00001110000','00001110000','00000100000','00000100000'];
const DIAMOND=['0001000','0011100','0111110','1111111','0111110','0011100','0001000'];
function glyph(ctx,rows,x,y,unit,color){
    ctx.fillStyle=color;const ox=Math.round(x-rows[0].length*unit/2),oy=Math.round(y-rows.length*unit/2);
    rows.forEach((row,yy)=>{for(let xx=0;xx<row.length;xx++)if(row[xx]==='1')ctx.fillRect(ox+xx*unit,oy+yy*unit,unit,unit);});
}
export function drawChoiceStar(ctx,x,y,record,{highlight=false,selected=false,time=0,index=0,formation=1,ripple=null}={}){
    const style=starAppearance(record),empty=style.kind==='empty',memory=style.kind==='memory';
    if(formation<=0)return;
    const breath=Math.sin(time/(4800+index*320)*Math.PI*2+index*1.7);
    const pulse=highlight||selected?1:.65+.35*breath,glow=.8+.6*breath,unit=highlight?3:2;
    ctx.save();ctx.globalAlpha*=Math.min(1,formation);
    // Stepped translucent pixels form a glow without blurring the star's edges.
    for(const [size,opacity] of [[8,.025],[6,.05],[4,.085]]){
        ctx.save();ctx.globalAlpha*=opacity*glow*(selected?3.2:highlight?1.8:1);glyph(ctx,DIAMOND,x,y,size,style.color);ctx.restore();
    }
    ctx.save();ctx.globalAlpha*=pulse;
    glyph(ctx,memory||empty?DIAMOND:CROSS,x,y,empty?1:unit,style.color);
    if(style.kind==='followed'){
        for(const dx of [-1,1])for(const dy of [-1,1])ctx.fillRect(Math.round(x+dx*8)-1,Math.round(y+dy*8)-1,2,2);
    }
    if(style.kind==='direct'){
        pixelLine(ctx,x-8,y-8,x+8,y+8,style.color,2);pixelLine(ctx,x+8,y-8,x-8,y+8,style.color,2);
    }
    glyph(ctx,DIAMOND,x,y,selected?2:1,style.core);ctx.restore();
    if(ripple!==null){
        const phase=(Math.max(0,ripple)%1500)/1500,r=18+phase*28;
        ctx.save();ctx.globalAlpha*=(1-phase)*.42;
        const ring=Array.from({length:9},(_,i)=>({x:x+Math.cos(i*Math.PI/4)*r,y:y+Math.sin(i*Math.PI/4)*r}));
        for(let i=1;i<ring.length;i++)pixelLine(ctx,ring[i-1].x,ring[i-1].y,ring[i].x,ring[i].y,style.color,2);
        ctx.restore();
    }
    if(record.tokenUsed){ctx.fillStyle='#c1b59c';ctx.fillRect(Math.round(x)-1,Math.round(y)+19,2,2);}
    if(selected){for(const sx of [-1,1])for(const sy of [-1,1]){pixelLine(ctx,x+sx*23,y+sy*17,x+sx*23,y+sy*23,style.color);pixelLine(ctx,x+sx*17,y+sy*23,x+sx*23,y+sy*23,style.color);}}
    ctx.restore();
}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function skyParticles(){
    const next=random(41027);
    return Array.from({length:100},()=>{
        return {x:next(),y:.015+next()*.665,size:next()>.86?2:1,alpha:.3+next()*.35,phase:next()*6.28,period:8000+next()*8000,twinkle:next()<.35};
    });
}
const particles=skyParticles();
const CAT=['000010000001000000000000','000111000011100000000000','000111111111100000000000','000111111111100000000000','000111111111100000000000','000011111111000000000000','000001111110000000000000','000011111111000000000000','000111111111100000000000','001111111111110000000000','001111111111110000000110','001111111111110000001110','001111111111110000011100','001111111111111111111000','000111111111111111100000','000011111111111110000000'];
const COMPASS=['00000000100000000','00000000100000000','00000001110000000','00000001110000000','00000011111000000','00000011111000000','00000111111100000','00011111011111000','11111110001111111','00011111011111000','00000111111100000','00000011111000000','00000011111000000','00000001110000000','00000001110000000','00000000100000000','00000000100000000'];
const TRAVELER=['00000001110000000','00000011111000000','00000111111100000','00000110011100000','00000111111100000','00000011111000100','00000111111000100','00001111111100100','00011111111111100','00011111111100100','00111111111100100','00111111111100100','00000111111000100','00000110011000100','00001100001100100','00001100001100100','00011100001110100'];
export const WATERMARKS=Object.freeze({cat:CAT,compass:COMPASS,traveler:TRAVELER});
const meteorRandom=random(7301);
export const METEOR_GAPS=Object.freeze(Array.from({length:64},()=>2000+Math.floor(meteorRandom()*2001)));
const meteors=METEOR_GAPS.map(()=>({duration:2200+meteorRandom()*1000,x:.05+meteorRandom()*.62,y:.02+meteorRandom()*.22,dx:.18+meteorRandom()*.18,dy:.12+meteorRandom()*.16,length:10+Math.floor(meteorRandom()*15),alpha:.3+meteorRandom()*.35}));
export const METEOR_CYCLE=METEOR_GAPS.reduce((a,b)=>a+b,0)+meteors.reduce((sum,meteor)=>sum+meteor.duration,0);
export function meteorAt(time){
    if(time<2000)return null;
    let cursor=(time-2000)%METEOR_CYCLE;
    for(let i=0;i<METEOR_GAPS.length;i++){
        const meteor=meteors[i];
        if(cursor<meteor.duration)return {index:i,...meteor,progress:cursor/meteor.duration};
        cursor-=meteor.duration;
        if(cursor<METEOR_GAPS[i])return null;cursor-=METEOR_GAPS[i];
    }
    return null;
}
export function meteorLane(index,count){
    const columns=count>=12?4:count>=6?2:1,rows=Math.ceil(count/columns);
    return {x:.05+.70*((index%columns)+.5)/columns,y:.02+.48*(Math.floor(index/columns)+.5)/rows};
}
export function meteorMotion(meteor,count){
    return {dx:.12+meteor.dx*.16,dy:.07+meteor.dy*.2,length:Math.min(count>=10?15:18,meteor.length)};
}
export function meteorTracksAt(time,count){
    return Array.from({length:count},(_,index)=>{
        const meteor=meteorAt(time+METEOR_CYCLE*index/count);
        return meteor?{meteor,lane:meteorLane(index,count)}:null;
    }).filter(Boolean);
}
export function drawNightDetails(ctx,width,height,coords,time=0,still=false,theme='cat',meteorDensity=1){
    ctx.save();
    for(const p of particles){
        const fade=Math.max(.4,1-p.y/.85),pulse=still?1:(p.twinkle?.65:.9)+(p.twinkle?.35:.1)*Math.sin(time/p.period*Math.PI*2+p.phase);
        ctx.globalAlpha=p.alpha*fade*pulse;ctx.fillStyle='#bac2bd';
        const x=Math.round(p.x*width/2)*2,y=Math.round(p.y*height/2)*2;
        ctx.fillRect(x,y,p.size,p.size);
    }
    const cx=coords.reduce((sum,p)=>sum+p.x,0)/coords.length,cy=coords.reduce((sum,p)=>sum+p.y,0)/coords.length;
    const span=Math.max(...coords.map(p=>p.x))-Math.min(...coords.map(p=>p.x));
    const unit=Math.max(3,Math.min(8,Math.round(span/75)));
    ctx.globalAlpha=.055;glyph(ctx,WATERMARKS[theme]||WATERMARKS.traveler,cx,cy,unit,'#9aabdc');
    if(!still&&meteorDensity>0){
        const count=meteorDensity>1?meteorDensity:1;
        for(const {meteor,lane} of meteorTracksAt(time,count)){
            const t=meteor.progress,{dx:trackDx,dy:trackDy,length}=meteorMotion(meteor,count);
            const x=width*(lane.x+t*trackDx),y=height*(lane.y+t*trackDy);
            const angle=Math.atan2(height*trackDy,width*trackDx),dx=Math.cos(angle)*4,dy=Math.sin(angle)*4;
            ctx.save();
            for(let i=0;i<length;i++){
                const shimmer=.55+.45*Math.sin(t*Math.PI*8+meteor.index*1.9);
                ctx.globalAlpha=Math.pow(1-i/length,1.45)*Math.min(1,meteor.alpha*2.6)*shimmer;
                ctx.fillStyle=i<2?'#fff9df':i<5?'#e5f3ff':'#b9d9ff';
                ctx.fillRect(Math.round((x-i*dx)/2)*2,Math.round((y-i*dy)/2)*2,2,2);
            }
            const sparkle=.55+.45*Math.sin(t*Math.PI*8+meteor.index*1.9);
            ctx.globalAlpha=sparkle;ctx.fillStyle='#fffdf0';
            ctx.fillRect(Math.round((x-2)/2)*2,Math.round(y/2)*2,6,2);
            ctx.fillRect(Math.round(x/2)*2,Math.round((y-2)/2)*2,2,6);
            ctx.restore();
        }
    }
    ctx.restore();
}
export function drawStarlight(ctx,a,b,color,progress=1){
    if(progress<=0)return;
    const head={x:a.x+(b.x-a.x)*Math.min(1,progress),y:a.y+(b.y-a.y)*Math.min(1,progress)};
    ctx.save();const alpha=ctx.globalAlpha;
    for(const [offset,opacity] of [[2,.045],[1,.11],[0,.62]]){
        ctx.globalAlpha=alpha*opacity;pixelLine(ctx,a.x,a.y+offset,head.x,head.y+offset,color,1);
        if(offset)pixelLine(ctx,a.x,a.y-offset,head.x,head.y-offset,color,1);
    }
    ctx.restore();
}
