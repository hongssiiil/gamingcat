import {pixelLine} from './ending-art.js';

// All foreground motion uses the original artwork's 1672 x 941 coordinate grid.
const cache=new WeakMap();
const GRASS=[[78,727],[402,753],[742,768],[778,769],[907,785],[1020,801],[1151,816],[1311,810]];
export function dioramaMotion(time,still=false){
    const t=still?0:time/1000,blinkPhase=t%6.7;
    return {wind:still?0:Math.sin(t*.55),tail:still?0:Math.sin(t*.55),window:still?0:.025+.015*Math.sin(t*.8)+.01*Math.sin(t*1.37),
        blink:!still&&((blinkPhase>4.2&&blinkPhase<4.36)||(blinkPhase>4.56&&blinkPhase<4.67)),time:t};
}
function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function prepare(image){
    const clean=surface(1672,941),ctx=clean.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,1672,941);
    const original=ctx.getImageData(0,0,1672,941),data=original.data,plate=ctx.getImageData(0,0,1672,941);
    const at=(x,y)=>(y*1672+x)*4;
    const copy=(x,y,sx,sy)=>{const a=at(x,y),b=at(sx,sy);for(let c=0;c<3;c++)plate.data[a+c]=data[b+c];};
    // Remove only the pale painted smoke; the surrounding sky is sampled on the same row.
    for(let y=568;y<619;y++)for(let x=194;x<286;x++){
        const p=at(x,y);if(data[p]>65&&data[p+1]>90&&data[p+2]>95)copy(x,y,300,y);
    }
    const cape=surface(94,58),capeCtx=cape.getContext('2d'),capeData=capeCtx.createImageData(94,58);
    const red=(x,y)=>{const p=at(x,y);return data[p]>48&&data[p]>data[p+1]*1.7&&data[p]>data[p+2]*1.15;};
    for(let yy=0;yy<58;yy++)for(let xx=0;xx<94;xx++){
        const x=448+xx,y=696+yy,p=at(x,y);
        const edge=data[p]<40&&data[p+1]<35&&data[p+2]<40&&[-2,-1,0,1,2].some(d=>red(x+d,y)||red(x,y+d));
        if(!red(x,y)&&!edge)continue;
        const dest=(yy*94+xx)*4;for(let c=0;c<4;c++)capeData.data[dest+c]=data[p+c];
        copy(x,y,437,y);
    }
    capeCtx.putImageData(capeData,0,0);
    const trees=surface(1672,151),treeCtx=trees.getContext('2d'),treeData=treeCtx.createImageData(1672,151);
    const dark=(x,y)=>{const p=at(x,y);return data[p]<16&&data[p+1]<49&&data[p+2]<68;};
    for(let y=790;y<941;y++)for(let x=0;x<1672;x++){
        if(!dark(x,y))continue;
        const p=at(x,y),dest=((y-790)*1672+x)*4;for(let c=0;c<4;c++)treeData.data[dest+c]=data[p+c];
        // A narrow clean margin under moving branches prevents a stationary duplicate outline.
        for(let distance=1;distance<=7;distance++){
            const nx=x+distance<1672&&!dark(x+distance,y)?x+distance:x-distance>=0&&!dark(x-distance,y)?x-distance:-1;
            if(nx>=0){copy(x,y,nx,y);break;}
        }
    }
    treeCtx.putImageData(treeData,0,0);ctx.putImageData(plate,0,0);
    const eyes=[];
    for(let y=749;y<765;y++)for(let x=632;x<665;x++){
        const p=at(x,y);if(data[p]>120&&data[p+1]>120&&data[p+2]>120)eyes.push([x,y]);
    }
    const windowPixels=[];
    for(let y=685;y<729;y++)for(let x=287;x<323;x++){
        const p=at(x,y);if(data[p]>150&&data[p+1]>125&&data[p+2]<data[p]*.9)windowPixels.push([x,y]);
    }
    const result={clean,cape,trees,eyes,windowPixels};cache.set(image,result);return result;
}
export function drawDiorama(ctx,image,bounds,time=0,still=false){
    if(still){ctx.drawImage(image,Math.round(bounds.x),Math.round(bounds.y),Math.ceil(bounds.w),Math.ceil(bounds.h));return;}
    const layers=cache.get(image)||prepare(image),motion=dioramaMotion(time);
    ctx.save();ctx.translate(Math.round(bounds.x),Math.round(bounds.y));ctx.scale(bounds.w/1672,bounds.h/941);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(layers.clean,0,0);
    // Tint only the lit pane pixels, leaving the window frame and house untouched.
    ctx.fillStyle='#ffd478';ctx.globalAlpha=motion.window;
    for(const [x,y] of layers.windowPixels)ctx.fillRect(x,y,1,1);
    ctx.globalAlpha=1;
    for(let y=0;y<151;y+=4){
        const h=Math.min(4,151-y),shift=Math.round(motion.wind*(1-y/151)*2);
        ctx.drawImage(layers.trees,0,y,1672,h,shift,790+y,1672,h);
    }
    // The cape remains attached at the shoulder; the lower hem moves by at most two pixels.
    for(let y=0;y<58;y+=2){
        const shift=Math.round(Math.sin(motion.time*.55+y*.025)*(y/58)*2);
        ctx.drawImage(layers.cape,0,y,94,2,448+shift,696+y,94,2);
    }
    // Soft smoke puffs rise from the existing chimney and disperse toward the left.
    for(let i=0;i<10;i++){
        const age=(motion.time*.11+i/10)%1,x=277-age*70+Math.sin(age*9+i)*3,y=620-age*65;
        ctx.globalAlpha=(1-age)*.43;ctx.fillStyle=i%2?'#a8b7c0':'#d2d6cc';
        const size=2+Math.floor(age*3)*2;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,size*2,size);
        ctx.globalAlpha*=.45;ctx.fillRect(Math.round(x/2)*2-size,Math.round(y/2)*2-2,size,size);
    }
    ctx.globalAlpha=1;
    // A small tail is attached to Tiny's right haunch; the original body stays in place.
    let previous={x:669,y:767};
    for(let i=1;i<=12;i++){
        const p={x:669+i*1.8,y:767-Math.sin(i/12*Math.PI*.75)*(8+motion.tail*3)};
        pixelLine(ctx,previous.x,previous.y,p.x,p.y,'#04070b',3);previous=p;
    }
    if(motion.blink){ctx.fillStyle='#030609';for(const [x,y] of layers.eyes)ctx.fillRect(x,y,1,1);ctx.fillStyle='#667581';ctx.fillRect(639,757,5,1);ctx.fillRect(653,757,5,1);}
    for(let i=0;i<GRASS.length;i++){
        const [x,y]=GRASS[i],sway=Math.sin(motion.time*.45+i)*2;
        for(let blade=-1;blade<=1;blade++)pixelLine(ctx,x+blade*3,y,x+blade*5+sway,y-5-Math.abs(blade)*3,'#102d3b',2);
    }
    for(let i=0;i<9;i++){
        const x=230+i*138+Math.sin(motion.time*.25+i*2)*22,y=803+(i%3)*39+Math.cos(motion.time*.31+i)*10;
        const alpha=.12+.55*Math.pow((Math.sin(motion.time*.75+i*1.9)+1)/2,2);
        ctx.fillStyle=i%2?'#d3df8b':'#f2d890';ctx.globalAlpha=alpha*.16;ctx.fillRect(Math.round(x)-3,Math.round(y)-3,8,8);
        ctx.globalAlpha=alpha;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,2,2);
    }
    ctx.restore();
}
