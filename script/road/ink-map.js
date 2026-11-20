import { STAGE_STATE, STAGE_SPAN, overviewCamera } from './journey.js';
import { forkPoint,FORK_END_Y } from './fork-motion.js';
import { explorationInk, explorationScale, sampleExploration, mapEncounter } from './exploration.js';
import { CHECKPOINTS } from './content.js';
import { BODY_FONT, EMPHASIS_FONT, gameFontsReady } from '../game-fonts.js';
await gameFontsReady;
const INK='#29251f';
const ROAD_INK='#36251c';
const ROAD_INK_WIDTH=4;
const ns=()=>document.createElement('canvas');
const images={};
function load(key,url,crop=false){
    const img=new Image();images[key]={img};img.src=url;
    img.onload=()=>{
        if(!crop)return;
        const probe=ns();probe.width=96;probe.height=96;
        const c=probe.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(img,0,0,96,96);
        const data=c.getImageData(0,0,96,96).data;let x0=96,y0=96,x1=0,y1=0;
        for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(data[(y*96+x)*4+3]>80){x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1);}
        images[key].crop=[x0/96*img.width,y0/96*img.height,(x1-x0+1)/96*img.width,(y1-y0+1)/96*img.height];
    };
}
load('paper','./images/road/Dialogue_UI.png');
load('wolf','./images/battle/wolf.png',true);
for(const kind of ['player','cat']){
    load(kind,'./images/character/'+kind+'/'+kind+'_side.png',true);
    load(kind+'Walk','./images/character/'+kind+'/'+(kind==='player'?'player-side-walk-frame.png':'cat-side-squash-more.png'),true);
    load(kind+'Back','./images/character/'+kind+'/'+kind+'_back.png',true);
    load(kind+'Front','./images/character/'+kind+'/'+kind+'_front.png',true);
}
export function createInkMap(canvas,{width=800,height=480}={}){
    const W=width,H=height;
    canvas.width=W;canvas.height=H;
    let ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    // Keep copy at native browser resolution while the map stays pixelated.
    canvas.parentElement.querySelector('.road-map-text-layer')?.remove();
    const textLayer=document.createElement('div');textLayer.className='road-map-text-layer';
    textLayer.setAttribute('aria-hidden','true');canvas.after(textLayer);
    const labels=[];let labelIndex=0;
    function renderFrame(draw,args){
        labelIndex=0;
        try{return draw(...args);}finally{for(let i=labelIndex;i<labels.length;i++)labels[i].hidden=true;}
    }
    const background=ns();background.width=W;background.height=H;
    let paperReady=false;
    function line(x0,y0,x1,y1,color=INK,width=1){
        ctx.fillStyle=color;
        const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
        for(let i=0;i<=n;i++)ctx.fillRect(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),width,width);
    }
    function polygon(points,color){
        ctx.fillStyle=color;
        const min=Math.floor(Math.min(...points.map(p=>p[1]))),max=Math.ceil(Math.max(...points.map(p=>p[1])));
        for(let y=min;y<=max;y++){
            const xs=[];
            for(let i=0,j=points.length-1;i<points.length;j=i++){
                const a=points[i],b=points[j];
                if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
            }
            xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)ctx.fillRect(Math.round(xs[i]),y,Math.round(xs[i+1]-xs[i]),1);
        }
    }
    function text(value,x,y,size=12,color=INK,weight='normal',align='left'){
        const m=ctx.getTransform(),scale=Math.hypot(m.a,m.b);
        let label=labels[labelIndex++];
        if(!label){label=document.createElement('span');labels.push(label);textLayer.append(label);}
        label.hidden=false;
        if(label.textContent!==String(value))label.textContent=value;
        const family=weight==='bold'&&size>=23?EMPHASIS_FONT:BODY_FONT;
        const style=`left:${(m.a*x+m.c*y+m.e)/W*100}%;top:${(m.b*x+m.d*y+m.f)/H*100}%;font-size:${size*scale/W*100}cqw;color:${color};opacity:${ctx.globalAlpha};font-family:${family};transform:${align==='center'?'translateX(-50%)':'none'};`;
        if(label.dataset.style!==style){label.style.cssText=style;label.dataset.style=style;}
    }
    function wrap(value,width,size,weight='normal'){
        ctx.font=size+'px '+(weight==='bold'&&size>=23?EMPHASIS_FONT:BODY_FONT);
        const lines=[];let row='';
        for(const word of value.split(' ')){
            const next=row?row+' '+word:word;
            if(row&&ctx.measureText(next).width>width){lines.push(row);row='';}
            if(ctx.measureText(word).width>width){
                for(const ch of word){if(ctx.measureText(row+ch).width>width){lines.push(row);row='';}row+=ch;}
            }else row=row?row+' '+word:word;
        }
        if(row)lines.push(row);return lines;
    }
    function sprite(key,x,y,height,flip=false){
        const a=images[key];if(!a?.img.complete||!a.img.naturalWidth)return;
        const crop=a.crop||[0,0,a.img.width,a.img.height],width=Math.round(height*crop[2]/crop[3]);
        ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
        ctx.drawImage(a.img,...crop,-Math.round(width/2),-height,width,height);ctx.restore();
    }
    function paper(){
        const img=images.paper.img;
        if(img.complete&&img.naturalWidth&&!paperReady){
            const b=background.getContext('2d');b.imageSmoothingEnabled=false;
            const sx=[0,110,img.width-110,img.width],sy=[0,65,img.height-65,img.height];
            const dx=[0,30,W-30,W],dy=[0,28,H-28,H];
            for(let y=0;y<3;y++)for(let x=0;x<3;x++)b.drawImage(img,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
            paperReady=true;
        }
        if(paperReady)ctx.drawImage(background,0,0);else{ctx.fillStyle='#dfc28c';ctx.fillRect(10,10,W-20,H-20);}
        ctx.globalAlpha=.055;ctx.fillStyle='#64462c';
        for(let i=0;i<400;i++){const x=28+(i*139%741),y=25+(i*83%425);ctx.fillRect(x,y,i%3+1,1);}ctx.globalAlpha=1;
    }
    function compass(angle=null){
        ctx.globalAlpha=.16;const x=128,y=368,r=53;
        for(let a=0;a<360;a+=4){const t=a*Math.PI/180,u=(a+4)*Math.PI/180;line(x+Math.cos(t)*r,y+Math.sin(t)*r,x+Math.cos(u)*r,y+Math.sin(u)*r,'#644d34');}
        for(let a=0;a<8;a++){const t=a*Math.PI/4;
            const tip=[x+Math.sin(t)*r,y+Math.cos(t)*r],left=[x+Math.sin(t+.5)*12,y+Math.cos(t+.5)*12];
            polygon([[x,y],tip,left],'#644d34');
        }
        line(x-64,y,x+64,y,'#644d34');line(x,y-64,x,y+64,'#644d34');
        if(angle!==null){
            const tip=[x+Math.sin(angle)*43,y-Math.cos(angle)*43],back=[x-Math.sin(angle)*27,y+Math.cos(angle)*27];
            const left=[x+Math.cos(angle)*6,y+Math.sin(angle)*6],right=[x-Math.cos(angle)*6,y-Math.sin(angle)*6];
            ctx.globalAlpha=.3;polygon([tip,left,right],'#705331');polygon([back,left,right],'#927447');
        }
        text('N',x,y-68,12,'#644d34','bold','center');ctx.globalAlpha=1;
    }
    function stamp(lane,x,y){
        ctx.save();ctx.translate(x-34,y-60);
        const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
        const dark='#574631',shade='#8a7553',light='#c6ae79';
        if(lane===0){
            rect(5,24,58,38,dark);rect(8,27,52,33,shade);rect(23,13,22,47,dark);rect(26,16,16,44,light);
            polygon([[20,15],[34,0],[49,15]],dark);polygon([[24,13],[34,4],[44,13]],shade);
            for(const tx of [5,47]){rect(tx,19,16,40,dark);rect(tx+3,22,10,35,light);for(let i=0;i<3;i++)rect(tx+i*6,14,4,8,dark);}
            for(const wx of [12,32,54]){rect(wx,30,4,7,dark);rect(wx,44,4,6,dark);}
            rect(28,46,12,16,dark);rect(31,49,5,13,'#b29965');
            line(35,0,35,-9,dark);rect(36,-9,10,5,'#957c50');
            for(let i=0;i<12;i++)rect(8+i*4%49,37+Math.floor(i/6)*15,5,1,shade);
        }else if(lane===1){
            line(34,0,34,53,dark,2);line(52,14,52,50,dark,2);
            polygon([[29,5],[8,39],[29,39]],dark);polygon([[27,12],[13,36],[27,36]],'#e5d3a8');
            polygon([[38,5],[38,39],[60,39]],dark);polygon([[40,12],[40,36],[55,36]],'#e5d3a8');
            polygon([[54,18],[54,43],[67,43]],shade);
            polygon([[0,47],[68,47],[54,61],[16,61]],dark);
            polygon([[9,50],[61,50],[51,57],[18,57]],shade);
            line(5,65,63,65,'#667f7b',2);line(18,69,54,69,'#8b9a85');
            rect(35,-3,13,5,shade);
        }else{
            polygon([[3,55],[32,45],[39,50],[10,61]],dark);polygon([[6,46],[40,56],[35,62],[3,52]],shade);
            polygon([[12,50],[8,34],[17,39],[20,12],[30,28],[34,23],[39,41],[30,53]],'#9d4d26');
            polygon([[16,48],[16,35],[23,40],[26,24],[32,42],[29,50]],'#d68c32');
            polygon([[22,47],[25,38],[28,48]],'#f0c664');
            const cx=57,cy=45;
            for(let a=0;a<360;a+=10){const t=a*Math.PI/180,u=(a+10)*Math.PI/180;line(cx+Math.cos(t)*16,cy+Math.sin(t)*16,cx+Math.cos(u)*16,cy+Math.sin(u)*16,dark,2);}
            polygon([[cx,30],[cx-6,49],[cx+6,49]],'#946342');polygon([[cx,60],[cx-6,43],[cx+6,43]],'#d9c796');
        }
        ctx.restore();
    }
    function paw(x,y,angle){
        ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.fillStyle=INK;
        ctx.fillRect(-2,-1,5,4);ctx.fillRect(-5,-4,2,3);ctx.fillRect(-2,-6,2,3);ctx.fillRect(1,-6,2,3);ctx.fillRect(4,-4,2,3);ctx.restore();
    }
    function route(lane,progress,color,width,dashed=false,startY=270){
        let last=forkPoint(lane,0,startY);
        for(let i=1;i<=Math.ceil(progress*260);i++){
            const p=forkPoint(lane,Math.min(progress,i/260),startY);
            if(!dashed||i%8<4)line(last.x,last.y,p.x,p.y,color,width);
            last=p;
        }
    }
    function overviewDecorations(alpha,withCompass=true){
        const sepia='#795d38';ctx.save();ctx.globalAlpha=alpha*.16;
        // Survey sketches are deliberately much quieter than the travelled ink.
        for(const [x,y,h] of [[88,146,31],[108,155,44],[135,142,35],[155,157,25]]){
            line(x,y-h+4,x,y+8,sepia,2);
            for(let tier=0;tier<3;tier++){
                const top=y-h+tier*h*.22,half=7+tier*4;
                polygon([[x,top],[x-half,top+h*.48],[x+half,top+h*.48]],sepia);
            }
        }
        for(let i=0;i<24;i++){
            const x=72+i*5,y=181+Math.sin(i*.3)*10;
            if(i%3!==2)line(x,y,x+2,y+1,sepia);
        }
        for(let row=0;row<3;row++)for(let wave=0;wave<6;wave++){
            const x=331+wave*19+row*5,y=144+row*11;
            line(x,y,x+5,y+3,sepia);line(x+5,y+3,x+11,y+3,sepia);line(x+11,y+3,x+15,y,sepia);
        }
        for(const [x,y,h] of [[615,169,36],[649,161,53],[685,170,38],[716,163,26]]){
            line(x-h*.6,y,x,y-h,sepia);line(x,y-h,x+h*.7,y,sepia);
            line(x,y-h,x-3,y-20,sepia);line(x-3,y-20,x+5,y-24,sepia);line(x+5,y-24,x+12,y-12,sepia);
            for(let i=0;i<4;i++)line(x+i*4,y-15+i*3,x+i*4+4,y-11+i*3,sepia);
        }
        ctx.restore();
        if(withCompass){ctx.save();ctx.translate(-32,-9);compass();ctx.restore();}
    }
    function overviewLandmark(path,x,y,reveal){
        const dark='#51432f',stone='#99835d',light='#d9c39a';
        const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
        // Keep the original choice symbol, adding a different settlement around it.
        ctx.save();ctx.translate(Math.round(x),Math.round(y));
        if(path.lane===0){
            ctx.globalAlpha=reveal;
            for(const side of [-1,1]){
                const tx=side<0?-42:28;
                rect(tx,-40,14,38,dark);rect(tx+2,-36,10,32,stone);
                for(let n=0;n<3;n++)rect(tx+n*5,-44,4,7,dark);
                rect(tx+5,-30,3,6,dark);rect(tx+4,-15,4,5,dark);
                if(path.index%2===0){line(tx+6,-44,tx+6,-55,dark);rect(tx+7,-55,9,4,'#875539');}
            }
        }else if(path.lane===1&&path.index>0){
            ctx.globalAlpha=reveal;
            rect(-43,-46,13,41,dark);rect(-40,-43,7,37,light);
            polygon([[-45,-46],[-37,-58],[-28,-46]],dark);rect(-39,-39,5,7,'#a38347');
            rect(-48,-4,91,5,dark);rect(-46,-3,87,2,stone);
            for(const px of [-43,-28,25,38])rect(px,-3,3,12,dark);
            for(let n=0;n<3;n++)line(-48+n*7,12,38-n*6,12+n*3,'#7f8a78');
        }else if(path.lane===2){
            ctx.globalAlpha=reveal;
            polygon([[-37,-6],[-14,-46],[15,-6]],dark);
            polygon([[-32,-8],[-14,-40],[8,-8]],'#b49358');
            polygon([[-14,-40],[-10,-8],[8,-8]],'#806b47');
            polygon([[-20,-8],[-14,-29],[-9,-8]],'#3c3629');
            line(-14,-46,-14,-51,dark,2);line(-34,-7,-42,0,dark);line(13,-7,22,0,dark);
        }
        ctx.globalAlpha=1;
        if(path.lane===2){ctx.translate(18,0);ctx.scale(.85,.85);}
        stamp(path.lane,0,0);
        ctx.restore();
    }
    function brushTrail(points,seed,reveal,opacity=1,color=ROAD_INK){
        ctx.globalAlpha=opacity;
        const scale=Math.hypot(ctx.getTransform().a,ctx.getTransform().b)||1;
        const width=ROAD_INK_WIDTH*(W/800)/scale;
        for(let i=1;i<points.length;i++){
            const [ax,ay]=points[i-1],[bx,by]=points[i],length=Math.hypot(bx-ax,by-ay);
            for(let d=0;d<=length;d++){
                const t=length?d/length:0,x=Math.round(ax+(bx-ax)*t),y=Math.round(ay+(by-ay)*t);
                // Position-based pressure and dry edges stay fixed on redraw.
                const pressure=.85+.2*Math.sin(x*.09+y*.06+seed);
                const size=width*pressure;
                ctx.fillStyle=color;ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),Math.ceil(size),Math.ceil(size));
                if((x*7+y*11+seed)%9===0){
                    ctx.globalAlpha=opacity*.35;
                    ctx.fillRect(Math.round(x-size/2)-1,Math.round(y+size/2),2,1);
                    ctx.globalAlpha=opacity;
                }
            }
        }
        ctx.globalAlpha=1;
    }
    function dottedTrail(points,opacity=1,offset=0,width=1){
        ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle='#21170f';
        let distance=offset;
        for(let i=1;i<points.length;i++){
            const [ax,ay]=points[i-1],[bx,by]=points[i],length=Math.hypot(bx-ax,by-ay);
            for(let d=Math.ceil(distance)-distance;d<length;d++){
                if((distance+d)%10>=4)continue;
                const t=d/(length||1);
                ctx.fillRect(Math.round(ax+(bx-ax)*t),Math.round(ay+(by-ay)*t),width,width);
            }
            distance+=length;
        }
        ctx.restore();
    }
    function drawOverview(j,paths){
        const target=overviewCamera(paths),reveal=Math.min(1,Math.max(0,(1-j.zoom)/(1-target.zoom)));
        const project=([x,y])=>[(x-j.cameraX)*j.zoom,240+(y-240)*j.zoom];
        ctx.save();ctx.beginPath();ctx.rect(27,27,746,426);ctx.clip();
        overviewDecorations(reveal);
        // Project the saved positions, then stamp at screen-pixel density so ink
        // and landmarks retain their texture as the entire scroll zooms out.
        dottedTrail(paths.flatMap(path=>path.points.map(project)),reveal,0,2);
        for(const path of paths){
            const [x,y]=project([path.end.x,path.end.y]);
            overviewLandmark(path,x,y-4,reveal);
        }
        const last=paths.at(-1);
        if(last){
            const [x,y]=project([last.end.x,last.end.y]);
            // Existing sprites remain readable beside the final landmark.
            const px=x+29*reveal,py=y+9*reveal,cx=x-24*(1-reveal)+52*reveal;
            const ph=Math.round(48-8*reveal),ch=Math.round(28-4*reveal);
            let previous=[px+6,py-ph*.35];
            for(let i=1;i<=20;i++){
                const t=i/20,point=[px+6+(cx-4-px-6)*t,py-ph*.35+(ph*.35-ch*.42)*t+Math.sin(t*Math.PI)*7];
                line(...previous,...point,'#6d5437');previous=point;
            }
            sprite('player',px,py,ph);sprite('cat',cx,py,ch);
        }
        ctx.globalAlpha=reveal;
        text('다섯 번의 선택, 하나로 이어진 길',400,65,24,INK,'bold','center');
        line(278,104,522,104,'#aa8958');ctx.fillStyle='#8b6a40';ctx.fillRect(397,102,5,5);
        for(const path of paths){
            const [x,y]=project([path.end.x,path.end.y]);
            for(let yy=Math.round(y)+16;yy<321;yy+=7)line(Math.round(x),yy,Math.round(x),yy+2,'#98774b');
            text(String(path.index+1).padStart(2,'0'),x,327,14,'#80603a','bold','center');
            let size=12,rows=wrap(path.label,112,size);
            while(rows.length>2&&size>9)rows=wrap(path.label,112,--size);
            rows.forEach((row,i)=>text(row,x,350+i*17,size,INK,'normal','center'));
        }
        text('당신과 티니가 걸어온 길이 한 장의 지도로 남았습니다.',400,397,11,'#6f5031','normal','center');
        ctx.globalAlpha=1;
        // A stamped counter, drawn as square pixels instead of a rounded badge.
        ctx.fillStyle='#80603a';ctx.fillRect(675,29,81,27);ctx.fillStyle='#e0c595';ctx.fillRect(677,31,77,23);
        ctx.fillStyle='#b59664';ctx.fillRect(679,33,73,1);ctx.fillRect(679,51,73,1);
        text('05 / 05',715,36,12,'#674b2d','bold','center');
        ctx.restore();
    }
    function rubble(x,y){
        ctx.save();ctx.translate(Math.round(x),Math.round(y));
        for(const [xx,yy,w,h] of [[-22,0,15,12],[-8,-7,19,19],[9,0,15,11],[-4,7,12,7]]){
            polygon([[xx,yy],[xx+3,yy-h],[xx+w-4,yy-h-2],[xx+w,yy-3],[xx+w-2,yy+3]],'#574f3e');
            polygon([[xx+2,yy-2],[xx+5,yy-h+2],[xx+w-5,yy-h+1],[xx+w-2,yy-3]],'#a09575');
            line(xx+5,yy-h+2,xx+w-5,yy-h+1,'#c1b38d',2);
        }
        ctx.restore();
    }
    function warningMarker(x,y,wolf,time){
        y=Math.round(y+Math.sin(time*3)*2);x=Math.round(x);
        ctx.fillStyle='#51402b';ctx.fillRect(x-7,y-4,15,26);
        text('!',x,y-3,21,wolf?'#db684b':'#efc65a','bold','center');
    }
    function dangerBanner(x,y){
        const width=226;x=Math.round(Math.max(42,Math.min(W-width-42,x-width/2)));y=Math.round(y);
        ctx.fillStyle='#4c3929';ctx.fillRect(x-2,y-2,width+4,38);ctx.fillStyle='#efdcab';ctx.fillRect(x,y,width,34);
        for(const yy of [y,y+29])for(let xx=0;xx<width;xx+=12){
            ctx.fillStyle='#ac4d33';ctx.fillRect(x+xx,yy,Math.min(12,width-xx),5);
            polygon([[x+xx+2,yy],[x+xx+8,yy],[x+xx+4,yy+5],[x+xx,yy+5]],'#e5b750');
        }
        text('! 여기 장애물이 있다 !',x+width/2,y+8,15,'#593f29','bold','center');
    }
    function drawExploration(state,motion){
        const route=motion.route,scale=explorationScale(W),at=mapEncounter(state);
        const puzzleOpen=state.stage==='pond'||state.stage==='climb',effect=motion.clearEffect;
        const project=p=>[48+(p.x-motion.cameraX)*scale,270+(p.y-270)*.5];
        ctx.clearRect(0,0,W,H);paper();
        ctx.save();ctx.beginPath();ctx.rect(28,94,W-56,311);ctx.clip();
        const scroll=motion.cameraX*scale;
        for(let tile=Math.floor(scroll/720)-1;tile<=Math.floor(scroll/720)+1;tile++){
            ctx.save();ctx.translate(tile*720-scroll,20);overviewDecorations(1,false);ctx.restore();
        }
        ctx.save();ctx.translate(-25,-7);compass(motion.direction*Math.PI/2+(motion.moving?Math.sin(motion.time*5)*.055:0));ctx.restore();
        for(const segment of explorationInk(route,state.completed)){
            const a=project(segment.a),b=project(segment.b);
            if(Math.max(a[0],b[0])<24||Math.min(a[0],b[0])>W-24)continue;
            dottedTrail([a,b],.44,segment.from*scale);
        }
        // Saved exploration progress keeps the walked footprints after waiting,
        // backtracking or reloading; no marks are drawn ahead of the player.
        for(let distance=18,step=0;distance<=state.mapFurthest;distance+=18,step++){
            const [x,y]=project(sampleExploration(route,distance));
            if(x<24||x>W-24)continue;
            const [nx,ny]=project(sampleExploration(route,distance+3));
            const angle=Math.atan2(ny-y,nx-x),side=step%2?1:-1;
            ctx.save();ctx.translate(Math.round(x-Math.sin(angle)*side*5),Math.round(y+Math.cos(angle)*side*5));
            ctx.rotate(angle);ctx.globalAlpha=1;ctx.fillStyle=ROAD_INK;
            ctx.fillRect(-3,-2,4,4);ctx.fillRect(2,-1,2,3);ctx.restore();
        }
        ctx.globalAlpha=1;
        for(const node of route.nodes){
            const [x,y]=project(node);if(x< -80||x>W+80)continue;
            // Landmarks stay visible; only the road ink follows travel progress.
            ctx.save();ctx.globalAlpha=1;
            const landmark=landmarkBitmap(node);
            ctx.drawImage(landmark,Math.round(x)-56,Math.round(y)-107,112,104);ctx.restore();
            const checkpoint=CHECKPOINTS.find(c=>c.at===node.index+1);
            if(!checkpoint||state.completed.includes(checkpoint.id))continue;
            ctx.globalAlpha=1;
            if(checkpoint.id==='battle'){
                ctx.save();ctx.filter='brightness(.48)';sprite('wolf',x+3,y+5,52);ctx.restore();
                warningMarker(x+3,y-92,true,motion.time);
            }else{
                for(let xx=-29;xx<=29;xx+=8){line(x+xx,y+14,x+xx+3,y+14,'#8f7044');line(x+xx,y-10,x+xx+3,y-10,'#8f7044');}
                line(x-30,y-10,x-30,y+14,'#8f7044',2);line(x+30,y-10,x+30,y+14,'#8f7044',2);
                rubble(x,y+1);warningMarker(x-33,y-91,false,motion.time);
            }
            ctx.globalAlpha=1;
        }
        if(effect){
            const node=route.nodes[effect.nodeId-1],[x,y]=project(node),t=Math.min(1,effect.elapsed/.5);
            dottedTrail([[x-28,y],[x-28+56*t,y]],.44);
            ctx.globalAlpha=1-t;
            for(let i=0;i<14;i++){
                const angle=i*2.4,spread=10+t*27;
                ctx.fillStyle=i%3?'#a28c65':'#322b20';
                ctx.fillRect(Math.round(x+Math.cos(angle)*spread),Math.round(y-8+Math.sin(angle)*spread*.4-t*16),i%2+2,2);
            }
            ctx.globalAlpha=1;
        }
        const p=sampleExploration(route,state.mapDistance),c=sampleExploration(route,motion.catDistance);
        const [px,py]=project(p),[cx,cy]=project(c),walk=motion.moving&&Math.floor(motion.time*7)%2;
        sprite('player'+(walk?'Walk':''),px,py-(walk?1:0),48,motion.direction<0);
        const alertBob=at?Math.round(Math.sin(motion.time*5)*1.5):0;
        const jump=effect?Math.round(Math.sin(Math.PI*Math.min(1,effect.elapsed/.5))*13):0;
        sprite('cat'+(walk?'Walk':''),cx-9,cy+8+alertBob-jump,28,at?false:motion.direction<0);
        if(at&&!puzzleOpen){const node=route.nodes[at.at-1],[x,y]=project(node);dangerBanner(x,Math.max(99,y-145));}
        ctx.restore();
        text('당신이 그린 숲길',48,43,W<600?23:26,INK,'bold');
        line(48,410,W-48,410,'#a68a5d');
        const instruction=puzzleOpen?'구간을 갈아끼우는 중':effect?'티니: 길이 이어졌어!':at?'[A][D] 이동 (막힘)':'[A][D] 이동';
        text(instruction,at||puzzleOpen?W*.29:W*.5,433,W<600?14:13,'#6b5133','bold','center');
    }
    const landmarkCache=new Map();
    function landmarkBitmap(node){
        const key=node.index+':'+node.lane;
        if(!landmarkCache.has(key)){
            const bitmap=ns();bitmap.width=112;bitmap.height=104;
            const main=ctx;
            try{ctx=bitmap.getContext('2d');ctx.imageSmoothingEnabled=false;overviewLandmark(node,56,92,1);}
            finally{ctx=main;}
            landmarkCache.set(key,bitmap);
        }
        return landmarkCache.get(key);
    }
    const renderer={drawExploration,draw(q,f,motion,step,topic,{intro=0,paused=false,journey={phase:'ACTIVE',index:step-1,cameraX:0,zoom:1,elapsed:0},completedPaths=[]}={}){
        const j=journey,phase=j.phase,zoom=j.zoom,originX=j.index*STAGE_SPAN;
        const fade=phase===STAGE_STATE.ARRIVED?Math.max(0,1-j.elapsed/.8):phase===STAGE_STATE.NEXT_FORK?Math.min(1,j.elapsed/.6):phase===STAGE_STATE.ACTIVE?1:0;
        const overview=[STAGE_STATE.ZOOMING,STAGE_STATE.COMPLETE].includes(phase);
        const activePath=[STAGE_STATE.ACTIVE,STAGE_STATE.NEXT_FORK].includes(phase);
        ctx.clearRect(0,0,W,H);paper();
        if(overview){drawOverview(j,completedPaths);return;}
        ctx.save();ctx.beginPath();ctx.rect(27,27,746,426);ctx.clip();
        ctx.translate(-j.cameraX*zoom,240*(1-zoom));ctx.scale(zoom,zoom);
        // The center paper and watermark are world objects sliding beneath the viewport rim.
        const img=images.paper.img;
        for(let tile=-1;tile<=6;tile++){
            if(img.complete&&img.naturalWidth)ctx.drawImage(img,110,65,img.width-220,img.height-130,tile*STAGE_SPAN,-1000,STAGE_SPAN,2480);
            ctx.save();ctx.translate(tile*STAGE_SPAN,0);compass();ctx.restore();
        }
        for(const path of completedPaths){
            brushTrail(path.points,path.index,1);
            const arriving=phase===STAGE_STATE.ARRIVED&&path.index===j.index;
            const pop=arriving?1+Math.sin(Math.min(1,j.elapsed/.8)*Math.PI)*.14:1;
            const iconScale=pop;
            ctx.save();ctx.translate(path.end.x,path.end.y-4);ctx.scale(iconScale,iconScale);stamp(path.lane,0,0);ctx.restore();
            if(arriving){ctx.globalAlpha=(1-j.elapsed/.8)*.25;ctx.fillStyle=INK;for(let n=0;n<12;n++)ctx.fillRect(path.end.x-32+(n*13%65),path.end.y-10-(n*17%56),3,3);ctx.globalAlpha=1;}
            const old=path.index<j.index;wrap(path.label,old?100:150,old?10:11).forEach((s,i)=>text(s,path.end.x,path.end.y+19+i*15,old?10:11,'#715232','normal','center'));
        }
        ctx.translate(originX,0);ctx.globalAlpha=fade;
        text(topic,48,27,10,'#806340');
        wrap(q.prompt,340,25,'bold').forEach((s,i)=>text(s,48,54+i*33,25,INK,'bold'));
        for(let lane=0;lane<3;lane++)route(lane,1,'#a88d60',1,true,f.startY);
        for(let t=.44;t<.98;t+=.065){
            const p=forkPoint(q.recommended,t,f.startY),next=forkPoint(q.recommended,t+.008,f.startY);
            paw(p.x,p.y+(Math.round(t*100)%2?5:-5),Math.atan2(next.y-p.y,next.x-p.x)+Math.PI/2);
        }
        // Deterministic rough ink follows the actual, saved player positions only.
        ctx.globalAlpha=1;
        const trail=activePath?(f.ink||[]):[];brushTrail(trail,0,1);
        ctx.globalAlpha=fade;
        for(let lane=0;lane<3;lane++){
            if(!activePath&&lane===f.lane)continue;
            const y=FORK_END_Y[lane];stamp(lane,620,y-4);
            wrap((lane+1)+'. '+q.options[lane],164,13,'bold').forEach((s,i)=>text(s,620,y+12+i*18,13,INK,'bold','center'));
        }
        // A single pinned note is part of the parchment, never a separate window.
        ctx.save();ctx.translate(-20,0);
        polygon([[423,37],[596,37],[596,134],[582,149],[423,149]],'#8c7651');
        polygon([[419,33],[592,33],[592,129],[578,145],[419,145]],'#f1e4bb');
        polygon([[578,129],[592,129],[578,145]],'#c1ac7f');
        sprite('catFront',438,60,20);
        text('티니의 추천 · '+(q.recommended+1),452,43,12,INK,'bold');
        const memoSize=wrap(q.reason,146,12).length>5?11:12;
        wrap(q.reason,146,memoSize).forEach((s,i)=>text(s,432,67+i*14,memoSize));
        ctx.fillStyle='#513b2c';ctx.fillRect(501,28,4,12);ctx.fillStyle='#a7794c';ctx.fillRect(498,24,10,7);ctx.fillStyle='#d6ac72';ctx.fillRect(499,24,6,2);
        ctx.restore();ctx.globalAlpha=1;
        const p=motion.player,c=motion.cat,tension=activePath?motion.tension:0;
        const resisting=activePath&&f.isResisting;
        const hand={x:p.x+7,y:p.y-17},neck={x:c.x-4,y:c.y-12};
        const sag=resisting?0:(1-tension)*15;
        let prev=hand;
        for(let i=1;i<=35;i++){
            const t=i/35,u=1-t;
            // Shake only the visible leash, leaving movement and saved ink intact.
            const jitter=resisting?Math.sin(motion.time*35+i)*tension*Math.sin(Math.PI*t)*1.5:0;
            const next={x:u*u*hand.x+2*u*t*(hand.x+neck.x)/2+t*t*neck.x,
                y:u*u*hand.y+2*u*t*((hand.y+neck.y)/2+sag)+t*t*neck.y+jitter};
            line(prev.x,prev.y,next.x,next.y,resisting?'#a44832':'#695239',resisting?2:1);prev=next;
        }
        const walk=Math.floor(motion.time*6)%2===1;
        const actors=[['player',p,48],['cat',c,28]].sort((a,b)=>a[1].y-b[1].y);
        for(const [kind,pos,height] of actors){
            const moving=motion[kind+'Moving'];
            const bob=moving&&walk&&!f.isResisting?1:0;
            const bracing=kind==='cat'&&resisting?Math.sin(motion.time*25)*1.3:0;
            const frame=kind==='cat'&&f.isResisting?(q.recommended===0?'Back':q.recommended===2?'Front':''):(walk&&moving&&!f.isResisting?'Walk':'');
            sprite(kind+frame,pos.x+bracing,pos.y-bob,height,kind==='cat'&&f.isResisting?false:motion[kind+'Flip']);
        }
        ctx.restore();
        text(String(j.index+1).padStart(2,'0')+' / 05',707,29,12,'#795a38','bold','center');
        const message=phase===STAGE_STATE.COMPLETE?'당신과 티니가 걸어온 길이 한 장의 지도에 남았습니다.':phase===STAGE_STATE.ARRIVED?'선택한 길에 잉크를 새깁니다.':phase===STAGE_STATE.PANNING?'두루마리를 펼치는 중…':phase===STAGE_STATE.NEXT_FORK?'다음 갈림길이 나타납니다.':phase===STAGE_STATE.ZOOMING?'걸어온 다섯 길을 펼쳐 봅니다.':paused?'잠시 멈춤 · SPACE로 계속':'티니는 추천 길로 이끌어요. 원하는 곳으로 직접 걸어가세요.';
        text(message,400,phase===STAGE_STATE.COMPLETE?404:441,10,'#6f5031','normal','center');
        if(phase!==STAGE_STATE.COMPLETE)text('WASD / 방향키 이동 · SPACE 잠시 멈춤',400,456,9,'#806340','normal','center');
    }};
    return {draw:(...args)=>renderFrame(renderer.draw,args),drawExploration:(...args)=>renderFrame(renderer.drawExploration,args)};
}
