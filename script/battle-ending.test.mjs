import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import * as state from './battle/state.js';
const source=await readFile(new URL('./battle.js',import.meta.url),'utf8');
async function battle(outcome){
    const callbacks=new Map(),timers=new Map(),records=[],events=[];let loss=false,battleState,id=0;
    const element=()=>({hidden:true,focus(){},classList:{contains:()=>true},addEventListener(name,fn){this[name]=fn;}});
    const uiNames=[...source.matchAll(/import \{([\s\S]*?)\} from "\.\/battle\/ui.js";/g)][0][1].split('import {').at(-1).split(',').map(s=>s.trim()).filter(Boolean);
    const ui=Object.fromEntries(uiNames.map(name=>[name,/^(set|show|update|render|enter|exit|close|open)/.test(name)?()=>{}:element()]));
    ui.fightSkillButtons=[element(),element(),element()];ui.setControlsLocked=(s,value)=>s.controlsLocked=value;ui.openBattleLossDialog=()=>loss=true;
    const rules={skillEffects:[{name:'일반 공격',damage:10,staminaCost:0}],wolfCombatRules:{},applyPlayerSkill(s){if(outcome==='victory')s.enemy.health=0;else s.player.health=0;return {kind:'recovery',message:'공격했다.'};},getEnemyActionProbabilities:()=>({}),chooseEnemyAction:()=> 'recover',recoverEnemyStamina(){},spendEnemyStamina(){},createEnemyAttack(){},applyEnemyAttackImpact(){}};
    const context=createContext({console,Math:{...Math,random:()=>.99},performance:{now:()=>0},window:{setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(i){timers.delete(i);}},document:{addEventListener(n,fn){callbacks.set(n,fn);},dispatchEvent(e){events.push(e);}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
    const dependencies={'./road.js':{getCurrentRoadBattleBackground:()=>'',saveBattleChoice(turn){if(!records.includes(turn))records.push(turn);}},'./battle/rules.js':rules,'./battle/recommendations.js':{getTurnRecommendation:()=>({action:'skill',skillIndex:0,text:'공격 추천'})},'./battle/state.js':state,'./battle/renderer.js':{setBattleBackground:async()=>{},startBattleRenderer(s){battleState=s;}},'./battle/ui.js':ui};
    const module=new SourceTextModule(source,{context});await module.link(spec=>{const exports=dependencies[spec];return new SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});});await module.evaluate();await module.namespace.enterBattle();
    if(outcome==='escape')ui.followRecommendationButton.click();else ui.fightSkillButtons[0].click();
    for(let n=0;timers.size&&n<20;n++){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}
    return {events,records,loss,battleState,module};
}
for(const result of ['victory','escape','defeat'])test(`actual battle controller: ${result}`,async()=>{
    const run=await battle(result);
    if(result==='defeat'){assert.equal(run.loss,true);assert.equal(run.events.length,0);}else{assert.equal(run.events.length,1);assert.equal(run.events[0].detail.result,result);assert.equal(run.records.at(-1).result,result);assert.equal(run.loss,false);}
    assert.equal(run.records.length,1);assert.ok(run.records[0].playerChoice);
    run.module.namespace.resetBattleForJourney();assert.equal(run.battleState.started,false);assert.equal(run.battleState.turnHistory.length,0);assert.equal(run.battleState.player.health,100);
});
