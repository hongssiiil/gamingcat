import { enterBattle, exitBattle } from "./battle.js?v=53";
import { enterRoad, exitRoad } from "./road.js";

document.querySelector("#show-road").addEventListener("click", () => {
    exitBattle();
    enterRoad();
});

document.querySelector("#show-battle").addEventListener("click", () => {
    exitRoad();
    enterBattle();
});
