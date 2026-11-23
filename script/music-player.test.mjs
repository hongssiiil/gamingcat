import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusicPlayer,MUSIC_TRACKS,musicEnvelope,roadMusicTrack} from './music-player.js';
function setup(saved){
    const audios=new Map(),data=new Map(saved?[['gamingCatMusic',JSON.stringify(saved)]]:[]);
    let scheduled=0;
    const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
    const player=createMusicPlayer({storage,schedule(){scheduled++;return 1;},cancel(){scheduled--;},createAudio(src){
        const audio={currentTime:0,duration:100,paused:true,volume:1,muted:false,plays:0,
            addEventListener(){},play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;}};
        audios.set(src,audio);return audio;
    }});
    return {player,storage,audio:name=>audios.get(MUSIC_TRACKS[name]),scheduled:()=>scheduled};
}
test('intro includes the complete fork overview; map and both puzzles share one track',()=>{
    for(const stage of ['forest','routeMissing','contract','topic','fork','summary'])assert.equal(roadMusicTrack(stage),'intro');
    for(const stage of ['map','pond','climb','battleReady'])assert.equal(roadMusicTrack(stage),'map');
});
test('tutorial pauses map music; returning resumes its exact position, not the beginning',async()=>{
    const h=setup();h.player.play('map');await Promise.resolve();await Promise.resolve();
    const map=h.audio('map');map.currentTime=42.75;
    h.player.play('mole');assert(map.paused);assert.equal(map.currentTime,42.75);
    h.player.stop('mole');h.player.play('map');
    assert.equal(map.currentTime,42.75);assert.equal(map.paused,false);assert(h.audio('mole').paused);
    h.player.play(roadMusicTrack('pond'));h.player.play(roadMusicTrack('climb'));
    assert.equal(map.currentTime,42.75);assert.equal(h.scheduled(),1);
});
test('wolf to constellation switches tracks and restarting rewinds the journey',()=>{
    const h=setup();h.player.play('map');h.audio('map').currentTime=29;h.player.play('wolf');h.player.stop('wolf');h.player.play('ending');
    assert(h.audio('wolf').paused);assert.equal(h.player.current,'ending');
    h.player.stop('wolf');assert.equal(h.player.current,'ending');
    h.player.reset();h.player.play('intro');assert.equal(h.audio('map').currentTime,0);assert(h.audio('ending').paused);
});
test('volume and mute persist and apply to every background track',()=>{
    const h=setup();h.player.setVolume(.24);h.player.setMuted(true);
    for(const name of Object.keys(MUSIC_TRACKS)){
        h.player.play(name);const audio=h.audio(name);audio.currentTime=10;h.player.tick();
        assert.equal(audio.volume,.24);assert.equal(audio.muted,true);assert.equal(audio.loop,true);
    }
    assert.deepEqual(JSON.parse(h.storage.getItem('gamingCatMusic')),{volume:.24,muted:true});
    const restored=setup({volume:.24,muted:true});assert.deepEqual(restored.player.settings,{volume:.24,muted:true});
    h.player.setMuted(false);h.player.setVolume(0);assert.equal(h.audio('ending').volume,0);assert.equal(h.audio('ending').muted,false);
});
test('native looping fades out over the last two seconds and fades in at the start',()=>{
    const h=setup();h.player.play('map');const audio=h.audio('map');
    for(const [time,expected] of [[50,.5],[98,.5],[99,.25],[100,0],[0,0],[.75,.25],[1.5,.5]]){
        audio.currentTime=time;h.player.tick();assert.equal(audio.volume,expected);
    }
    assert.equal(musicEnvelope(10,NaN),1);assert.equal(musicEnvelope(0,NaN),0);
});
test('blocked autoplay can be retried after user interaction',async()=>{
    const h=setup();h.player.play('intro');await Promise.resolve();await Promise.resolve();
    const audio=h.audio('intro');audio.pause();audio.play=()=>Promise.reject(new Error('NotAllowedError'));
    h.player.resume();await Promise.resolve();await Promise.resolve();
    audio.play=function(){this.paused=false;return Promise.resolve();};h.player.resume();assert.equal(audio.paused,false);
});
test('a delayed play resolution cannot revive a previous screen track',async()=>{
    const h=setup();h.player.play('intro');await Promise.resolve();await Promise.resolve();
    const audio=h.audio('intro');audio.pause();let finish;
    audio.play=()=>new Promise(resolve=>{finish=()=>{audio.paused=false;resolve();};});
    h.player.resume();h.player.play('map');finish();await Promise.resolve();await Promise.resolve();
    assert.equal(audio.paused,true);assert.equal(h.audio('map').paused,false);
});
