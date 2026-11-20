import {endingRecords,endingScenes,constellationName,starPositions,endingAnimation,ENDING_DURATION} from './ending-model.js';
import { BODY_FONT, EMPHASIS_FONT, gameFontsReady } from './game-fonts.js';

const background=new Image();
background.src='./images/ending/night-sky.png';
const STAR=['000010000','000010000','000111000','001111100','111111111','001111100','000111000','000010000','000010000'];
// Bresenham on a two-pixel grid: no antialiased paths or strokes.
function pixelLine(ctx,x0,y0,x1,y1,color,step=2){
    x0=Math.round(x0/step);y0=Math.round(y0/step);x1=Math.round(x1/step);y1=Math.round(y1/step);
    const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
    let error=dx+dy;ctx.fillStyle=color;
    while(true){ctx.fillRect(x0*step,y0*step,step,step);if(x0===x1&&y0===y1)break;const e=error*2;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}
function pixelStar(ctx,x,y,record,selected,formation=1){
    const unit=1,ox=Math.round(x)-4,oy=Math.round(y)-4;
    const color=record.black?'#080b10':record.accepted===true?'#8eafbf':record.accepted===false?'#d5b773':'#d4d5c8';
    const cells=[];STAR.forEach((row,y)=>[...row].forEach((value,x)=>{if(value==='1')cells.push([x,y]);}));
    ctx.fillStyle=record.black?'#eee4c5':'#162330';
    if(formation===1)for(const [x,y] of cells)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])ctx.fillRect(ox+(x+dx)*unit,oy+(y+dy)*unit,unit,unit);
    ctx.fillStyle=color;for(const [x,y] of cells){const drift=(1-formation)*4;ctx.fillRect(Math.round(ox+x*unit+(x-4)*drift),Math.round(oy+y*unit+(y-4)*drift),unit,unit);}
    if(record.tokenUsed){const ring=[[-14,-6],[-6,-14],[6,-14],[14,-6],[14,6],[6,14],[-6,14],[-14,6],[-14,-6]];for(let i=1;i<ring.length;i++)pixelLine(ctx,x+ring[i-1][0],y+ring[i-1][1],x+ring[i][0],y+ring[i][1],'#a89970');}
    if(selected){for(const sx of [-1,1])for(const sy of [-1,1]){pixelLine(ctx,x+sx*19,y+sy*13,x+sx*19,y+sy*19,'#f1dfaf');pixelLine(ctx,x+sx*13,y+sy*19,x+sx*19,y+sy*19,'#f1dfaf');}}
}

export function createEnding({onRestart}){
    const root=document.createElement('section');root.id='Ending';root.className='screen ending-screen';
    root.innerHTML=`<div class="ending-art"><canvas aria-hidden="true"></canvas><header class="ending-heading"><h1></h1><p>별을 눌러 그 순간의 기억을 펼쳐보세요</p><small data-token hidden>결정적인 순간에 토큰을 사용한 여정</small></header><div class="ending-stars" role="group" aria-label="선택 기록 별자리"></div><p class="ending-empty" hidden>아직 기록된 선택이 없습니다.</p></div><button type="button" class="ending-skip" data-skip>별자리 펼치기</button><article class="ending-record" aria-label="선택한 별의 기록" tabindex="-1" aria-live="polite" hidden></article><div class="ending-actions"><button type="button" class="ending-small-button" data-save>별자리 기록 저장</button><button type="button" class="ending-small-button" data-restart>처음으로</button></div><p role="status" data-status></p><dialog aria-labelledby="ending-reset-title"><h2 id="ending-reset-title">처음으로 돌아갈까요?</h2><p>게임 상태와 선택 기록을 초기화하고 새 여정을 시작합니다.</p><button type="button" data-cancel>취소</button><button type="button" data-confirm>처음부터 시작</button></dialog>`;
    document.querySelector('main').append(root);
    const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d'),stars=$('.ending-stars'),panel=$('.ending-record'),dialog=$('dialog');
    let records=[],positions=[],points=[],title='',selected=-1,focused=0,tokenUsed=false,active=false;
    let animationFrame,startTime=0,elapsed=0,lastPaint=0;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    function backgroundRect(width,height){
        const ratio=(background.naturalWidth||1672)/(background.naturalHeight||941);
        const h=Math.max(height,width/ratio)*(width/height<.8?1.12:1),w=h*ratio;
        // Portrait framing keeps the girl, telescope and cat together at x≈34%.
        return {x:Math.max(width-w,Math.min(0,width/2-w*.34)),y:width/height<.8?height-h:Math.max(height-h,Math.min(0,height*.8-h*.8)),w,h};
    }
    function layout(width,height){
        const bg=backgroundRect(width,height),top=height<500?100:Math.max(145,height*.20);
        const bottom=Math.max(top+50,Math.min(height*.55,bg.y+bg.h*.57));
        const w=Math.min(records.length<5?400:540,width*.78),h=Math.min(records.length<5?180:280,bottom-top);
        return positions.map(p=>({x:Math.round(width/2+(p.x-.5)/.76*w),y:Math.round(top+(p.y-.24)/.28*h)}));
    }
    function draw(context,width,height,selection=false,exportTitle=false){
        context.imageSmoothingEnabled=false;context.fillStyle='#091526';context.fillRect(0,0,width,height);
        if(background.complete&&background.naturalWidth){const b=backgroundRect(width,height);context.drawImage(background,Math.round(b.x),Math.round(b.y),Math.ceil(b.w),Math.ceil(b.h));}
        const coords=layout(width,height);
        const animation=endingAnimation(exportTitle?ENDING_DURATION:elapsed,reducedMotion.matches),done=['complete','settle','fade'].includes(animation.phase);
        if(animation.phase==='dim'||animation.phase==='gather'){
            const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);context.fillStyle='#091526';context.globalAlpha=.14;
            context.fillRect(Math.min(...xs)-25,Math.min(...ys)-25,Math.max(...xs)-Math.min(...xs)+50,Math.max(...ys)-Math.min(...ys)+50);context.globalAlpha=1;
        }
        if(animation.phase==='gather'){
            const center={x:width/2,y:coords.reduce((sum,p)=>sum+p.y,0)/9};context.fillStyle='#c6ba96';
            for(let i=0;i<8;i++){const angle=i*2.4,r=(1-animation.progress)*(18+i*4);context.fillRect(Math.round(center.x+Math.cos(angle)*r),Math.round(center.y+Math.sin(angle)*r),2,2);}
        }
        for(let i=1;i<9;i++){
            const progress=done||i<animation.step?1:i===animation.step?Math.min(1,animation.local/.65):0;if(!progress)continue;
            const a=coords[i-1],b=coords[i],head={x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress};
            const gold=!exportTitle&&animation.phase==='trace'&&i>=animation.step-1;
            context.globalAlpha=animation.phase==='fade'?animation.progress:1;
            pixelLine(context,a.x,a.y,head.x,head.y,gold?'#b9a779':'#929f9e',1);context.globalAlpha=1;
            if(progress<1){context.fillStyle='#dac89d';context.fillRect(Math.round(head.x)-1,Math.round(head.y)-1,2,2);context.fillRect(Math.round(head.x)-4,Math.round(head.y)+3,1,1);}
        }
        records.forEach((record,i)=>{
            const built=done||i<animation.step,forming=animation.phase==='trace'&&i===animation.step;
            const formation=built?1:forming?Math.max(0,Math.min(1,(animation.local-.65)/.35)):1;
            const visible=built||forming&&animation.local>=.65;
            const fade=animation.phase==='fade'?animation.progress:1;
            context.globalAlpha=(record.hasRecord?1:.28)*(visible?.85:.2)*fade;
            if(animation.phase==='settle')context.globalAlpha*=1+.15*Math.sin(animation.progress*Math.PI);
            if(exportTitle||animation.phase==='complete')context.globalAlpha=record.hasRecord?1:.28;
            pixelStar(context,coords[i].x,coords[i].y,record,selection&&i===selected,formation);context.globalAlpha=1;
        });
        if(exportTitle){
            context.fillStyle='#ead298';context.textAlign='center';context.font=`${width<600?18:24}px ${EMPHASIS_FONT}`;context.fillText(title,width/2,40,width-32);
            if(tokenUsed){context.font=`12px ${BODY_FONT}`;context.fillText('결정적인 순간에 토큰을 사용한 여정',width/2,66,width-24);}
        }
    }
    function render(){
        root.dataset.animation=endingAnimation(elapsed,reducedMotion.matches).phase;
        draw(ctx,canvas.width,canvas.height,true);
        [...stars.children].forEach((button,i)=>{button.style.left=`${points[i]?.x||0}px`;button.style.top=`${points[i]?.y||0}px`;button.classList.toggle('is-selected',i===selected);button.setAttribute('aria-pressed',String(i===selected));button.tabIndex=i===focused?0:-1;});
    }
    function complete(){cancelAnimationFrame(animationFrame);elapsed=ENDING_DURATION;$('[data-skip]').hidden=true;render();}
    function animate(now){
        if(!active)return;elapsed=now-startTime;
        if(now-lastPaint>=32){render();lastPaint=now;}
        if(endingAnimation(elapsed,reducedMotion.matches).phase==='complete'){complete();return;}
        animationFrame=requestAnimationFrame(animate);
    }
    function updatePanel(){
        panel.replaceChildren();if(!records.length||selected<0){panel.hidden=true;return;}
        panel.hidden=false;
        const close=document.createElement('button');close.type='button';close.className='ending-close';close.textContent='×';close.setAttribute('aria-label','기록 닫기');close.onclick=closeRecord;panel.append(close);
        const r=records[selected],heading=document.createElement('h2');heading.textContent=`${selected+1} / 9 · ${r.scene}`;panel.append(heading);
        const list=document.createElement('dl');
        const fields=[['요약',r.summary],['장면 기록',r.detail],['선택한 행동',r.action],['티니의 추천',r.recommendation],['토큰 사용',r.tokenUsed===true?'토큰을 사용했어요':null]];
        for(const [label,value] of fields){if(value===null||value===undefined||value==='')continue;const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);list.append(item);}
        panel.append(list);
    }
    function closeRecord(){panel.hidden=true;selected=-1;render();stars.children[focused]?.focus({preventScroll:true});}
    function select(index,focus=false){if(!records.length)return;complete();selected=(index+records.length)%records.length;focused=selected;updatePanel();render();if(focus)stars.children[selected].focus({preventScroll:true});}
    function resize(){const bounds=$('.ending-art').getBoundingClientRect();if(!bounds.width)return;canvas.width=Math.round(bounds.width);canvas.height=Math.round(bounds.height);points=layout(canvas.width,canvas.height);render();}
    const resizeObserver=new ResizeObserver(resize);
    root.addEventListener('keydown',event=>{if(dialog.open)return;if(elapsed<ENDING_DURATION)complete();if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeRecord();return;}if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();focused=(focused+(event.key==='ArrowRight'?1:-1)+9)%9;render();stars.children[focused].focus({preventScroll:true});}});
    root.addEventListener('pointerdown',()=>{if(elapsed<ENDING_DURATION)complete();});
    $('[data-skip]').onclick=complete;
    $('[data-restart]').onclick=()=>dialog.showModal();$('[data-cancel]').onclick=()=>dialog.close();
    $('[data-confirm]').onclick=()=>{dialog.close();hide();onRestart();};
    $('[data-save]').onclick=async()=>{complete();const button=$('[data-save]');button.disabled=true;try{await background.decode();await gameFontsReady;await document.fonts.ready;const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;draw(image.getContext('2d'),image.width,image.height,false,true);const blob=await new Promise(resolve=>image.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='별자리-기록.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('[data-status]').textContent='별자리 기록을 저장했습니다.';}catch{$('[data-status]').textContent='이미지를 저장하지 못했습니다. 다시 시도해 주세요.';}finally{button.disabled=false;}};
    background.onload=()=>{if(active)resize();};
    function hide(){active=false;cancelAnimationFrame(animationFrame);resizeObserver.disconnect();root.className='screen ending-screen';document.querySelector('.screen-navigation').hidden=false;}
    return {hide,show(journey,result){
        active=true;records=endingScenes(journey,result);positions=starPositions();title=constellationName(endingRecords(journey,result));tokenUsed=records.some(r=>r.tokenUsed)||journey.events?.some(e=>e.type==='help'&&e.cost>0);
        root.className='screen-active ending-screen';root.dataset.result=result;root.setAttribute('aria-label',`별자리 엔딩 · ${title}`);$('h1').textContent=title;$('[data-token]').hidden=!tokenUsed;document.querySelector('.screen-navigation').hidden=true;
        selected=-1;focused=0;stars.replaceChildren();$('[data-status]').textContent='';
        records.forEach((r,i)=>{const button=document.createElement('button');button.type='button';button.className='ending-star';const label=`${i+1}. ${r.scene}: ${r.hasRecord?r.summary||'선택 기록 있음':'기록 없음'}${r.black?' · 검은 별':''}`;button.setAttribute('aria-label',label);button.title=label;button.dataset.index=i;button.addEventListener('click',()=>select(i,true));stars.append(button);});
        $('.ending-empty').hidden=true;updatePanel();elapsed=0;resizeObserver.observe($('.ending-art'));resize();$('[data-skip]').hidden=false;cancelAnimationFrame(animationFrame);startTime=performance.now();lastPaint=0;animationFrame=requestAnimationFrame(animate);
        (stars.children[0]||$('[data-save]')).focus({preventScroll:true});
    }};
}
