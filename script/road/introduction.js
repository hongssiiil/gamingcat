function icon(kind){
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.className='intro-icon';canvas.setAttribute('aria-hidden','true');
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    if(kind==='paw'){
        for(const [x,y,w,h] of [[10,17,12,8],[7,20,18,4],[5,10,5,6],[11,5,4,7],[18,5,4,7],[24,10,4,6]])r(x,y,w,h,'#513e2c');
    }else if(kind==='compass'){
        for(let i=0;i<7;i++){r(15-i,3+i*2,2+i*2,2,'#80623c');r(15-i,27-i*2,2+i*2,2,'#ad8851');}
        r(3,15,26,2,'#80623c');r(15,1,2,30,'#80623c');r(12,12,8,8,'#c7a870');r(14,14,4,4,'#655136');
    }else if(kind==='heart'){
        const rows=['01100110','11111111','11111111','01111110','00111100','00011000'];
        rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')r(4+x*3,7+y*3,3,3,y<2?'#cb7768':'#9e403e');}));
    }else if(kind==='sun'){
        r(10,10,12,12,'#e7b957');r(12,8,8,16,'#f3cf76');r(8,12,16,8,'#f3cf76');
        for(const [x,y,w,h] of [[15,2,2,4],[15,26,2,4],[2,15,4,2],[26,15,4,2],[5,5,3,3],[24,5,3,3],[5,24,3,3],[24,24,3,3]])r(x,y,w,h,'#ba8b35');
    }else if(kind==='ink'){
        r(4,21,13,8,'#3e3428');r(7,18,7,3,'#69513b');r(7,23,3,3,'#a28d63');
        for(let i=0;i<17;i++){r(13+i,24-i,2,2,'#675238');if(i>5)r(14+i,17-i,4,7,'#e9d6a6');}
    }else{
        r(4,13,24,15,'#71624a');r(6,15,20,11,'#bba77a');
        for(const x of [4,13,23]){r(x,8,5,16,'#66583f');r(x,5,2,4,'#66583f');r(x+3,5,2,4,'#66583f');r(x+1,13,2,4,'#dbc391');}
        r(14,21,4,7,'#493c2d');r(15,1,2,5,'#a88542');
    }
    return canvas;
}
const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;};
function cat(){const img=node('img','intro-cat');img.src='./images/character/cat/cat_side.png';img.alt='티니';return img;}
let sound;
function stampSound(){
    try{sound??=new (window.AudioContext||window.webkitAudioContext)();sound.resume().catch(()=>{});
        const tone=sound.createOscillator(),gain=sound.createGain(),t=sound.currentTime;tone.type='triangle';tone.frequency.setValueAtTime(180,t);tone.frequency.exponentialRampToValueAtTime(45,t+.12);
        gain.gain.setValueAtTime(.16,t);gain.gain.exponentialRampToValueAtTime(.001,t+.14);tone.connect(gain);gain.connect(sound.destination);tone.start(t);tone.stop(t+.15);
    }catch{/* Sound is optional when browser audio is unavailable. */}
}
export function renderIntroduction(dialog,stage,{advance,choose}){
    dialog.dataset.intro=stage;
    const paper=node('article','intro-paper');let busy=false;
    const caption=node('p','intro-caption',stage==='routeMissing'?'백지 지도 개척 안내':stage==='contract'?'여정의 서약서':'세 갈래 여정 선포서');
    const heading=node('h2','intro-title');heading.id='road-flow-title';
    const sub=node('p','intro-subtitle'),actions=node('div','intro-actions');
    const seal=node('div','intro-seal');seal.setAttribute('aria-hidden','true');seal.append(icon('paw'));
    const watermark=icon('compass');watermark.classList.add('intro-watermark');
    paper.append(watermark,icon(stage==='routeMissing'?'ink':stage==='contract'?'compass':'castle'),caption,heading,sub);
    const transition=(effect,fn)=>{if(busy)return;busy=true;stampSound();paper.classList.add(effect);paper.querySelectorAll('button').forEach(b=>b.disabled=true);setTimeout(()=>{if(paper.isConnected)fn();},360);};
    const button=(label,cls,fn)=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
    if(stage==='routeMissing'){
        heading.append(node('span','','탈출하려면'),node('span','','당신에게 맞는 경로가 필요합니다.'));
        sub.textContent='이 숲을 지나는 길을 만들어 주세요.';
        paper.append(cat());actions.append(button('길 만들기 시작 [Enter]','intro-primary',()=>transition('is-inking',()=>advance('contract'))));
        paper.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.tagName!=='BUTTON'){e.preventDefault();actions.querySelector('button').click();}});
    }else if(stage==='contract'){
        heading.append(node('span','','나는 내 인생에 주도권을'),node('span','','가지는 것에 동의한다.'));
        sub.textContent='동의하지 않으면 여정을 진행할 수 없습니다.';sub.classList.add('intro-warning');
        const feedback=node('div','intro-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
        feedback.append(cat(),node('p','','준비가 되면 언제든 다시 서명해 줘.'));
        actions.append(button('서약하고 출발하기 (동의)','intro-primary intro-wax',()=>transition('is-sealing',()=>advance('topic'))),button('아직 망설인다 (동의하지 않음)','intro-secondary',()=>{
            paper.classList.remove('is-hesitating');void paper.offsetWidth;paper.classList.add('is-hesitating');feedback.hidden=false;
        }));paper.append(seal,feedback);
    }else{
        heading.textContent='당신은 어디로 향하고 싶은가?';sub.textContent='당신의 선택을 바탕으로 탈출 경로를 생성합니다.';
        const topics=['연애','진로','자기실현'],types=['heart','castle','sun'];
        const comments=['티니: 마음이 향하는 만남을 찾아볼까?','티니: 너에게 맞는 일의 지도를 그려 보자.','티니: 네 안의 가능성을 함께 찾아보자.'];
        const cards=node('div','intro-cards'),comment=node('p','intro-comment',comments[0]);comment.setAttribute('aria-live','polite');let selected=0;
        const select=i=>{selected=i;[...cards.children].forEach((b,n)=>{b.classList.toggle('is-selected',n===i);b.setAttribute('aria-pressed',String(n===i));});comment.textContent=comments[i];};
        topics.forEach((topic,i)=>{const b=button('','intro-choice intro-choice-'+types[i],()=>{select(i);transition('is-sealing',()=>choose(topic));});
            b.setAttribute('aria-label',topic);const tab=node('span','intro-card-tab');tab.append(icon(types[i]));b.append(tab,icon(types[i]),node('strong','',topic));
            b.addEventListener('mouseenter',()=>{if(!busy)select(i);});b.addEventListener('focus',()=>select(i));cards.append(b);
        });select(0);
        cards.addEventListener('keydown',e=>{const d={a:-1,ArrowLeft:-1,d:1,ArrowRight:1}[e.key];if(d){e.preventDefault();e.stopPropagation();if(!busy){select((selected+d+3)%3);cards.children[selected].focus();}}});
        const foot=node('div','intro-topic-footer');foot.append(comment,node('span','','선택하기 [Enter]'));paper.append(cards,foot,seal);
        const paws=node('div','intro-paws');paws.setAttribute('aria-hidden','true');paws.append(icon('paw'),icon('paw'),icon('paw'));paper.append(paws);
    }
    paper.append(actions);dialog.append(paper);
}
