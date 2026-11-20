import { enterBattle, exitBattle, resetBattleForJourney } from "./battle.js";
import { enterRoad, exitRoad, getEndingJourney, restartJourney } from "./road.js";
import { createEnding } from './ending.js';
const ending=createEnding({onRestart(){resetBattleForJourney();restartJourney();}});
document.addEventListener('journey-ended',({detail})=>{if(!['victory','escape'].includes(detail.result))return;exitRoad();exitBattle();ending.show(getEndingJourney(),detail.result);});

document.querySelector("#show-road").addEventListener("click", () => {
    ending.hide();
    exitBattle();
    enterRoad();
});

document.querySelector("#show-battle").addEventListener("click", () => {
    ending.hide();
    exitRoad();
    enterBattle();
});
