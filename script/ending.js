import {endingRecords,endingScenes,constellationName,constellationTheme,starPositions,endingAnimation,ENDING_DURATION} from './ending-model.js';
import {starAppearance,drawChoiceStar,drawNightDetails,drawStarlight} from './ending-art.js';
import {drawDiorama} from './ending-diorama.js';
import {endingEffectForJourney,drawEndingEffect} from './ending-effects.js';
import { BODY_FONT, EMPHASIS_FONT, gameFontsReady } from './game-fonts.js';

const background=new Image();
background.src='./images/ending/night-sky.png';
export function createEnding({onRestart}){
    const root=document.createElement('section');root.id='Ending';root.className='screen ending-screen';root.tabIndex=-1;
    root.innerHTML=`<div class="ending-art"><canvas aria-hidden="true"></canvas><header class="ending-heading"><h1></h1><p>별을 눌러 그 순간의 기억을 펼쳐보세요</p><div class="ending-legend" aria-label="별의 색과 모양 안내"><span data-kind="followed"><i aria-hidden="true"></i>티니의 추천을 따른 선택</span><span data-kind="direct"><i aria-hidden="true"></i>직접 고른 선택</span><span data-kind="memory"><i aria-hidden="true"></i>여정의 기록</span></div><small data-token hidden>결정적인 순간에 토큰을 사용한 여정</small></header><div class="ending-stars" role="group" aria-label="선택 기록 별자리"></div><div class="ending-tooltip" id="ending-star-tip" role="tooltip" hidden></div><p class="ending-empty" hidden>아직 기록된 선택이 없습니다.</p></div><button type="button" class="ending-skip" data-skip>별자리 펼치기</button><article class="ending-record" aria-label="선택한 별의 기록" tabindex="-1" aria-live="polite" hidden></article><div class="ending-actions"><button type="button" class="ending-small-button" data-save>별자리 기록 저장</button><button type="button" class="ending-small-button" data-restart>처음으로</button></div><p role="status" data-status></p><dialog aria-labelledby="ending-reset-title"><h2 id="ending-reset-title">처음으로 돌아갈까요?</h2><p>게임 상태와 선택 기록을 초기화하고 새 여정을 시작합니다.</p><button type="button" data-cancel>취소</button><button type="button" data-confirm>처음부터 시작</button></dialog>`;
    document.querySelector('main').append(root);
    const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d'),stars=$('.ending-stars'),panel=$('.ending-record'),dialog=$('dialog');
    let records=[],positions=[],points=[],title='',theme='traveler',effect=null,selected=-1,focused=0,hovered=-1,hoverStart=0,tokenUsed=false,active=false;
    let animationFrame,startTime=0,elapsed=0,lastPaint=0,ambientTime=0,ambientStart=0;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    function backgroundRect(width,height){
        const ratio=(background.naturalWidth||1672)/(background.naturalHeight||941);
        const h=Math.max(height,width/ratio)*(width/height<.8?1.12:1),w=h*ratio;
        // Portrait framing keeps the girl, telescope and cat together at x≈34%.
        return {x:Math.max(width-w,Math.min(0,width/2-w*.34)),y:width/height<.8?height-h:Math.max(height-h,Math.min(0,height*.8-h*.8)),w,h};
    }
    function layout(width,height){
        const bg=backgroundRect(width,height),top=height<500?140:Math.max(190,height*.27);
        const bottom=Math.max(top+50,Math.min(height*.62,bg.y+bg.h*.60));
        const w=Math.min(records.length<5?400:680,width*.78),h=Math.min(records.length<5?180:300,bottom-top);
        return positions.map(p=>({x:Math.round(width/2+(p.x-.5)/.76*w),y:Math.round(top+(p.y-.24)/.28*h)}));
    }
    function draw(context,width,height,selection=false,exportTitle=false){
        const still=exportTitle||reducedMotion.matches,time=still?0:ambientTime;
        context.imageSmoothingEnabled=false;context.fillStyle='#091526';context.fillRect(0,0,width,height);
        if(background.complete&&background.naturalWidth)drawDiorama(context,background,backgroundRect(width,height),time,still);
        const coords=layout(width,height);
        const animation=endingAnimation(exportTitle?ENDING_DURATION:elapsed,reducedMotion.matches),done=['complete','settle','fade'].includes(animation.phase);
        drawNightDetails(context,width,height,coords,time,still,theme,effect?.density??1);
        drawEndingEffect(context,width,height,time,effect,still);
        for(let i=1;i<records.length;i++){
            const progress=done||i<animation.step?1:i===animation.step?Math.min(1,animation.local/.8):0;
            context.save();context.globalAlpha=animation.phase==='fade'?animation.progress:1;
            drawStarlight(context,coords[i-1],coords[i],starAppearance(records[i]).color,progress);context.restore();
        }
        records.forEach((record,i)=>{
            const built=done||i<animation.step,forming=animation.phase==='trace'&&i===animation.step;
            const formation=built?1:forming?Math.min(1,animation.local/.2):0;
            const travel=forming&&i>0?Math.min(1,animation.local/.8):1;
            const star=forming&&i>0?{x:coords[i-1].x+(coords[i].x-coords[i-1].x)*travel,y:coords[i-1].y+(coords[i].y-coords[i-1].y)*travel}:coords[i];
            context.save();context.globalAlpha=(record.hasRecord?1:.4)*(animation.phase==='fade'?animation.progress:1);
            drawChoiceStar(context,star.x,star.y,record,{highlight:selection&&(i===hovered||i===selected),selected:selection&&i===selected,time:forming?0:time,index:i,formation,ripple:selection&&!still&&i===hovered?time-hoverStart:null});
            if(formation>0&&travel===1){context.globalAlpha*=.65;context.fillStyle=starAppearance(record).color;context.font='10px '+BODY_FONT;context.textAlign='center';context.fillText(String(i+1).padStart(2,'0'),coords[i].x,coords[i].y+34);}
            context.restore();
        });
        if(exportTitle){
            context.fillStyle='#ead298';context.textAlign='center';context.font=`${width<600?18:24}px ${EMPHASIS_FONT}`;context.fillText(title,width/2,40,width-32);
            context.font='11px '+BODY_FONT;context.fillStyle='#b09a70';context.fillText('✦ 티니의 추천을 따른 선택',width/2,64,width-32);context.fillStyle='#82958e';context.fillText('✧ 직접 고른 선택',width/2,82,width-32);
            if(tokenUsed){context.font=`12px ${BODY_FONT}`;context.fillText('결정적인 순간에 토큰을 사용한 여정',width/2,102,width-24);}
        }
    }
    function render(){
        root.dataset.animation=endingAnimation(elapsed,reducedMotion.matches).phase;
        draw(ctx,canvas.width,canvas.height,true);
        [...stars.children].forEach((button,i)=>{button.style.left=`${points[i]?.x||0}px`;button.style.top=`${points[i]?.y||0}px`;button.classList.toggle('is-selected',i===selected);button.setAttribute('aria-pressed',String(i===selected));button.tabIndex=i===focused?0:-1;});
        positionTooltip();
    }
    function positionTooltip(){
        const tip=$('.ending-tooltip');if(hovered<0){tip.hidden=true;return;}
        const r=records[hovered],p=points[hovered];if(!r||!p)return;
        tip.hidden=false;tip.style.left=Math.max(116,Math.min(canvas.width-116,p.x))+'px';tip.style.top=Math.max(110,p.y-88)+'px';
    }
    function preview(index){
        if(index!==hovered)hoverStart=ambientTime;
        hovered=index;const tip=$('.ending-tooltip');tip.replaceChildren();
        if(index>=0){const r=records[index],heading=document.createElement('strong'),text=document.createElement('span');heading.textContent=String(index+1).padStart(2,'0')+' · '+r.scene;text.textContent=starAppearance(r).label;tip.append(heading,text);}
        render();
    }
    function complete(){elapsed=ENDING_DURATION;startTime=performance.now()-ENDING_DURATION;$('[data-skip]').hidden=true;render();}
    function animate(now){
        if(!active)return;elapsed=now-startTime;ambientTime=now-ambientStart;
        if(!document.hidden&&now-lastPaint>=40){render();lastPaint=now;}
        const done=endingAnimation(elapsed,reducedMotion.matches).phase==='complete';
        if(done)$('[data-skip]').hidden=true;
        if(!done||!reducedMotion.matches)animationFrame=requestAnimationFrame(animate);
    }
    reducedMotion.addEventListener('change',()=>{if(active){cancelAnimationFrame(animationFrame);animationFrame=requestAnimationFrame(animate);}});
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
    function select(index,focus=false){if(!records.length)return;complete();preview(-1);selected=(index+records.length)%records.length;focused=selected;updatePanel();render();if(focus)stars.children[selected].focus({preventScroll:true});}
    function resize(){const bounds=$('.ending-art').getBoundingClientRect();if(!bounds.width)return;canvas.width=Math.round(bounds.width);canvas.height=Math.round(bounds.height);points=layout(canvas.width,canvas.height);render();}
    const resizeObserver=new ResizeObserver(resize);
    root.addEventListener('keydown',event=>{if(dialog.open||event.target.closest('#music-controls'))return;if(elapsed<ENDING_DURATION)complete();if(event.key==='Escape'&&hovered>=0){preview(-1);return;}if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeRecord();return;}if(event.target.closest('.ending-stars')&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();focused=(focused+(event.key==='ArrowRight'?1:-1)+9)%9;render();stars.children[focused].focus({preventScroll:true});}});
    root.addEventListener('pointerdown',()=>{if(elapsed<ENDING_DURATION)complete();});
    $('[data-skip]').onclick=complete;
    $('[data-restart]').onclick=()=>dialog.showModal();$('[data-cancel]').onclick=()=>dialog.close();
    $('[data-confirm]').onclick=()=>{dialog.close();hide();onRestart();};
    $('[data-save]').onclick=async()=>{complete();const button=$('[data-save]');button.disabled=true;try{await background.decode();await gameFontsReady;await document.fonts.ready;const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;draw(image.getContext('2d'),image.width,image.height,false,true);const blob=await new Promise(resolve=>image.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='별자리-기록.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('[data-status]').textContent='별자리 기록을 저장했습니다.';}catch{$('[data-status]').textContent='이미지를 저장하지 못했습니다. 다시 시도해 주세요.';}finally{button.disabled=false;}};
    background.onload=()=>{if(active)resize();};
    function hide(){active=false;cancelAnimationFrame(animationFrame);resizeObserver.disconnect();root.className='screen ending-screen';document.querySelector('.screen-navigation').hidden=false;}
    return {hide,show(journey,result){
        active=true;records=endingScenes(journey,result);positions=starPositions();title=constellationName(endingRecords(journey,result));tokenUsed=records.some(r=>r.tokenUsed)||journey.events?.some(e=>e.type==='help'&&e.cost>0);
        theme=constellationTheme(endingRecords(journey,result));root.dataset.watermarkTheme=theme;
        effect=endingEffectForJourney(journey);
        root.className='screen-active ending-screen';root.dataset.result=result;root.setAttribute('aria-label',`별자리 엔딩 · ${title}`);$('h1').textContent=title;$('[data-token]').hidden=!tokenUsed;document.querySelector('.screen-navigation').hidden=true;
        selected=-1;focused=0;hovered=-1;stars.replaceChildren();$('[data-status]').textContent='';
        records.forEach((r,i)=>{const button=document.createElement('button');button.type='button';button.className='ending-star';const label=`${i+1}. ${r.scene}: ${r.hasRecord?r.summary||'선택 기록 있음':'기록 없음'}${r.black?' · 검은 별':''}`;button.setAttribute('aria-label',label);button.dataset.kind=starAppearance(r).kind;button.setAttribute('aria-describedby','ending-star-tip');button.dataset.index=i;button.addEventListener('pointerenter',()=>preview(i));button.addEventListener('pointerleave',()=>preview(-1));button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))preview(i);});button.addEventListener('blur',()=>preview(-1));button.addEventListener('click',()=>select(i,true));stars.append(button);});
        $('.ending-empty').hidden=true;updatePanel();elapsed=0;resizeObserver.observe($('.ending-art'));resize();$('[data-skip]').hidden=false;cancelAnimationFrame(animationFrame);startTime=performance.now();ambientStart=startTime;ambientTime=0;lastPaint=0;animationFrame=requestAnimationFrame(animate);
        root.focus({preventScroll:true});preview(-1);
    }};
}
