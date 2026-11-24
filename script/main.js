import { enterBattle, exitBattle, resetBattleForJourney } from "./battle.js?v=57";
import { enterRoad, exitRoad, getEndingJourney, restartJourney, getRoadBattleKind } from "./road.js";
import { createEnding } from './ending.js';
import { music, initMusicControls } from './music.js';
document.addEventListener('journey-restarted',resetBattleForJourney);
const ending=createEnding({onRestart(){restartJourney();}});
initMusicControls();
document.addEventListener('journey-ended',({detail})=>{if(!['victory','escape'].includes(detail.result))return;exitRoad();exitBattle();ending.show(getEndingJourney(),detail.result);music.play('ending');});

document.querySelector("#show-road").addEventListener("click", () => {
    ending.hide();
    exitBattle();
    enterRoad();
});

document.querySelector("#show-battle").addEventListener("click", () => {
    ending.hide();
    exitRoad();
    enterBattle(getRoadBattleKind());
});
