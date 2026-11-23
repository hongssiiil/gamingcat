import {createMusicPlayer} from './music-player.js';
let storage;try{storage=window.localStorage;}catch{}
export const music=createMusicPlayer({storage,createAudio(src){
    const audio=new Audio(src);audio.hidden=true;audio.dataset.backgroundMusic='true';document.body.append(audio);return audio;
}});
export function initMusicControls(){
    const host=document.createElement('div');host.id='music-controls';host.setAttribute('popover','manual');
    host.innerHTML=`<button type="button" class="music-toggle" aria-label="배경음악 설정" aria-expanded="false" aria-controls="music-panel"><svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path d="M3 9h4V7h2V5h3v14H9v-2H7v-2H3z" fill="currentColor"/><path class="music-waves" d="M15 8h2v8h-2zM19 5h2v14h-2z" fill="currentColor"/><path class="music-cross" d="M15 8h2v2h2V8h2v2h-2v4h2v2h-2v-2h-2v2h-2v-2h2v-4h-2z" fill="currentColor"/></svg></button><section id="music-panel" aria-label="배경음악 설정" hidden><div class="music-heading"><strong>배경음악</strong><button type="button" class="music-close" aria-label="음악 설정 닫기">×</button></div><label for="music-volume">음량 <output id="music-level"></output></label><input id="music-volume" type="range" min="0" max="100" step="1"><button type="button" class="music-mute" aria-pressed="false">음악 끄기</button></section>`;
    document.body.append(host);
    const toggle=host.querySelector('.music-toggle'),panel=host.querySelector('section'),slider=host.querySelector('input'),mute=host.querySelector('.music-mute');
    function refresh(){
        const {volume,muted}=music.settings,percent=Math.round(volume*100);
        slider.value=percent;host.querySelector('output').value=percent+'%';
        slider.setAttribute('aria-valuetext',percent+'%');
        host.dataset.muted=String(muted||volume===0);mute.textContent=muted?'음악 켜기':'음악 끄기';mute.setAttribute('aria-pressed',String(muted));
    }
    function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
    toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));music.resume();});
    host.querySelector('.music-close').addEventListener('click',()=>{close();toggle.focus();});
    mute.addEventListener('click',()=>{music.setMuted(!music.settings.muted);music.resume();refresh();});
    slider.addEventListener('input',()=>{music.setVolume(Number(slider.value)/100);music.setMuted(false);music.resume();refresh();});
    host.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();toggle.focus();}});
    document.addEventListener('pointerdown',event=>{music.resume();if(!host.contains(event.target))close();},true);
    document.addEventListener('keydown',()=>music.resume(),true);
    // Modal dialogs make the rest of the document inert; keep the controls inside the active dialog.
    const place=()=>{const parent=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if(host.parentNode!==parent)parent.append(host);if(host.showPopover&&!host.matches(':popover-open'))host.showPopover();};
    const observer=new MutationObserver(place);
    document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open'],childList:true}));
    refresh();place();music.play('intro');
}
