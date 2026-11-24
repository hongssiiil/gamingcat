import { enterRoad, getCurrentRoadBattleBackground, saveBattleChoice, returnFromTutorial, journeyTokens, saveJourneyTokens } from "./road.js";
import { music } from './music.js';
import { createBattleState, resetBattleState } from "./battle/state.js?v=37";

import { markBattleTutorialComplete } from "./battle/encounter.js?v=2";
import {
    advanceBattleTutorial,
    isBattleTutorialActive,
    startBattleTutorial,
    stopBattleTutorial,
} from "./battle/tutorial.js?v=11";
import { setBattleBackground, setBattleEnemy, startBattleRenderer } from "./battle/renderer.js?v=47";
import * as ui from "./battle/ui.js?v=44";
import { createBattleFlow } from "./battle/flow.js?v=21";
import { createBattleController } from "./battle/controller.js?v=2";

const state = createBattleState();
const tokenState = journeyTokens;
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
    stopBattleTutorial,
};

const flow = createBattleFlow({
    music,
    state,
    tokenState,
    ui,
    navigation: { enterRoad, getCurrentRoadBattleBackground, saveBattleChoice, saveTokens:saveJourneyTokens, onTutorialFinished:returnFromTutorial,
        onWolfFinished(result){document.dispatchEvent(new CustomEvent('journey-ended',{detail:{result}}));} },
    renderer: { setBattleBackground, setBattleEnemy },
    tutorial,
    scheduler: { schedule, cancel },
});

const controller = createBattleController({ state, tokenState, flow, ui, tutorial });
controller.bind();
startBattleRenderer(state);

export const enterBattle = flow.enterBattle;
export const exitBattle = flow.exitBattle;
export function resetBattleForJourney(){
    cancel();stopBattleTutorial();resetBattleState(state);state.started=false;
    ui.fightSkillsDialog.hidden=true;ui.setControlsLocked(state,false);
    ui.updateStatusBars(state);
}
