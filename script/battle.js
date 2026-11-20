import { enterRoad, getCurrentRoadBattleBackground } from "./road.js";
import { createBattleState } from "./battle/state.js?v=37";
import { BATTLE_STARTING_TOKENS } from "./battle/token.js?v=37";
import { markBattleTutorialComplete } from "./battle/encounter.js?v=2";
import {
    advanceBattleTutorial,
    isBattleTutorialActive,
    startBattleTutorial,
} from "./battle/tutorial.js?v=11";
import { setBattleBackground, setBattleEnemy, startBattleRenderer } from "./battle/renderer.js?v=47";
import * as ui from "./battle/ui.js?v=43";
import { createBattleFlow } from "./battle/flow.js?v=19";
import { createBattleController } from "./battle/controller.js?v=2";

const state = createBattleState();
const tokenState = { tokens: BATTLE_STARTING_TOKENS, events: [] };
const scheduledActions = new Set();

function schedule(callback, delay) {
    const timeoutId = window.setTimeout(() => {
        scheduledActions.delete(timeoutId);
        callback();
    }, delay);
    scheduledActions.add(timeoutId);
    return timeoutId;
}

function cancel() {
    scheduledActions.forEach((timeoutId) => window.clearTimeout(timeoutId));
    scheduledActions.clear();
}

const tutorial = {
    advanceBattleTutorial,
    isBattleTutorialActive,
    markBattleTutorialComplete,
    startBattleTutorial,
};

const flow = createBattleFlow({
    state,
    tokenState,
    ui,
    navigation: { enterRoad, getCurrentRoadBattleBackground },
    renderer: { setBattleBackground, setBattleEnemy },
    tutorial,
    scheduler: { schedule, cancel },
});

const controller = createBattleController({ state, tokenState, flow, ui, tutorial });
controller.bind();
startBattleRenderer(state);

export const enterBattle = flow.enterBattle;
export const exitBattle = flow.exitBattle;
