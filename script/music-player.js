export const MUSIC_TRACKS=Object.freeze({
    intro:'./sounds/intro-deepwood.mp3',
    map:'./sounds/map-forest.mp3',
    mole:'./sounds/Forest%20Final%20Boss%20tutorial.mp3',
    wolf:'./sounds/Forest%20Final%20Boss.mp3',
    ending:'./sounds/ending-constellation.mp3',
});
export const roadMusicTrack=stage=>['map','pond','climb','battleReady'].includes(stage)?'map':'intro';
export function musicEnvelope(time,duration){
    const fadeIn=Math.min(1,Math.max(0,time)/1.5);
    const fadeOut=Number.isFinite(duration)&&duration>0?Math.min(1,Math.max(0,duration-time)/2):1;
    return Math.min(fadeIn,fadeOut);
}
export function createMusicPlayer({createAudio,storage,schedule=fn=>setInterval(fn,50),cancel=id=>clearInterval(id)}){
    const tracks=new Map(),pending=new Set();let current=null,timer=null,volume=.5,muted=false;
    try{const saved=JSON.parse(storage?.getItem('gamingCatMusic'));if(Number.isFinite(saved?.volume))volume=Math.max(0,Math.min(1,saved.volume));muted=saved?.muted===true;}catch{}
    function save(){try{storage?.setItem('gamingCatMusic',JSON.stringify({volume,muted}));}catch{}}
    function tick(){
        const audio=tracks.get(current);if(!audio)return;
        audio.muted=muted;audio.volume=volume*musicEnvelope(audio.currentTime,audio.duration);
    }
    function resume(){
        const audio=tracks.get(current);if(!audio||!audio.paused||pending.has(audio))return;
        tick();pending.add(audio);
        Promise.resolve(audio.play()).catch(()=>{}).finally(()=>{
            pending.delete(audio);
            // A slow play request must not restart a track after a screen change.
            if(tracks.get(current)!==audio)audio.pause();
        });
    }
    function play(name){
        if(!Object.hasOwn(MUSIC_TRACKS,name))return;
        if(current!==name){tracks.get(current)?.pause();current=name;}
        if(!tracks.has(name)){
            const audio=createAudio(MUSIC_TRACKS[name]);audio.loop=true;audio.preload='auto';
            audio.addEventListener('timeupdate',tick);tracks.set(name,audio);
        }
        if(timer===null)timer=schedule(tick);
        tick();resume();
    }
    function stop(name){
        if(name&&name!==current)return;
        tracks.get(current)?.pause();current=null;
        if(timer!==null){cancel(timer);timer=null;}
    }
    return {play,stop,resume,tick,
        reset(){stop();for(const audio of tracks.values())audio.currentTime=0;},
        setVolume(value){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));save();tick();},
        setMuted(value){muted=Boolean(value);save();tick();},
        get settings(){return {volume,muted};},get current(){return current;},
    };
}
