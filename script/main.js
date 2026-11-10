import { enterBattle, exitBattle } from "./battle.js";
import { enterRoad, exitRoad } from "./road.js";

document.querySelector("#show-road").addEventListener("click", () => {
    exitBattle();
    enterRoad();
});

document.querySelector("#show-battle").addEventListener("click", () => {
    exitRoad();
    enterBattle();
});

// TEMP FOREST BATTLE TRANSITION START
window.addEventListener("gamingcat:temporary-forest-battle", () => {
    exitRoad();
    enterBattle();
});
// TEMP FOREST BATTLE TRANSITION END
