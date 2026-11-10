import { enterRoad } from "./road.js";
import {
    applyEnemyAttackImpact,
    applyPlayerSkill,
    createEnemyAttack,
    recoverEnemyStamina,
    skillEffects,
    spendEnemyStamina,
    wolfCombatRules,
} from "./battle/rules.js";
import { getTurnRecommendation } from "./battle/recommendations.js";
import { createBattleState, resetBattleState } from "./battle/state.js";
import { setBattleBackground, startBattleRenderer } from "./battle/renderer.js";
import { getCurrentRoadBattleBackground } from "./road.js";
import {
    battleLossConfirmButton,
    battleLossDialog,
    bagButton,
    closeBattleLossDialog,
    enterBattleScreen,
    exitBattleScreen,
    fightButton,
    fightSkillButtons,
    fightSkillsDialog,
    openBattleLossDialog,
    runButton,
    setControlsLocked,
    showMenuMessage,
    updateStatusBars,
} from "./battle/ui.js";

const battleState = createBattleState();
const scheduledActions = new Set();

function scheduleBattleAction(callback, delay) {
    const timeoutId = window.setTimeout(() => {
        scheduledActions.delete(timeoutId);
        callback();
    }, delay);
    scheduledActions.add(timeoutId);
    return timeoutId;
}

function cancelScheduledActions() {
    scheduledActions.forEach((timeoutId) => window.clearTimeout(timeoutId));
    scheduledActions.clear();
}

function showOpeningRecommendation() {
    battleState.currentRecommendation = {
        action: "run",
        text: "도망가자! 이길 수 있는 상대가 아니야!",
    };
    showMenuMessage(battleState.currentRecommendation.text);
}

function showTurnRecommendation() {
    battleState.currentRecommendation = getTurnRecommendation(battleState);
    showMenuMessage(battleState.currentRecommendation.text);
}

function followRecommendationIfMatched(action, skillIndex) {
    const recommendation = battleState.currentRecommendation;
    const matched = recommendation?.action === action
        && (action !== "skill" || recommendation.skillIndex === skillIndex);
    if (matched) battleState.recommendationFollowCount += 1;
}

function finishBattle(message) {
    if (battleState.ended) return;
    battleState.ended = true;
    setControlsLocked(battleState, true);
    fightSkillsDialog.hidden = true;
    showMenuMessage(message);
    scheduleBattleAction(() => {
        exitBattle();
        enterRoad();
    }, 1200);
}

function showBattleLoss() {
    if (battleState.ended) return;
    battleState.ended = true;
    cancelScheduledActions();
    setControlsLocked(battleState, true);
    fightSkillsDialog.hidden = true;
    battleState.playerAttackAnimation = null;
    battleState.enemyAttackAnimation = null;
    openBattleLossDialog();
}

function endEnemyTurn() {
    battleState.playerAttackAnimation = null;
    battleState.enemyAttackAnimation = null;
    if (battleState.player.health <= 0) {
        showBattleLoss();
        return;
    }
    showTurnRecommendation();
    setControlsLocked(battleState, false);
    fightButton.focus();
}

function startEnemyTurn() {
    if (battleState.enemy.health <= 0) {
        finishBattle("늑대를 물리쳤다!");
        return;
    }
    if (battleState.player.health <= 0) {
        showBattleLoss();
        return;
    }

    if (battleState.enemy.stamina < wolfCombatRules.staminaCost) {
        recoverEnemyStamina(battleState);
        showMenuMessage("늑대가 숨을 고르며 스태미나를 회복했다.");
        updateStatusBars(battleState);
        scheduleBattleAction(() => {
            if (battleState.player.health <= 0) {
                showBattleLoss();
                return;
            }
            showTurnRecommendation();
            setControlsLocked(battleState, false);
            fightButton.focus();
        }, 520);
        return;
    }

    spendEnemyStamina(battleState);
    showMenuMessage("늑대의 공격!");
    updateStatusBars(battleState);
    scheduleBattleAction(() => {
        createEnemyAttack(battleState, performance.now());
        scheduleBattleAction(() => {
            const message = applyEnemyAttackImpact(battleState);
            if (message) {
                showMenuMessage(message);
                updateStatusBars(battleState);
            }
        }, 85);
        scheduleBattleAction(endEnemyTurn, 170 + 800);
    }, 600);
}

function resolvePlayerSkill(skillIndex) {
    if (battleState.controlsLocked) return;
    const skill = skillEffects[skillIndex];
    if (!skill) return;
    followRecommendationIfMatched("skill", skillIndex);
    if (battleState.player.stamina < skill.staminaCost) {
        const result = applyPlayerSkill(battleState, skillIndex, performance.now());
        fightSkillsDialog.hidden = true;
        setControlsLocked(battleState, true);
        showMenuMessage(result.message);
        scheduleBattleAction(startEnemyTurn, 800);
        return;
    }

    fightSkillsDialog.hidden = true;
    setControlsLocked(battleState, true);

    const resolve = () => {
        const result = applyPlayerSkill(battleState, skillIndex, performance.now());
        showMenuMessage(result.message);
        updateStatusBars(battleState);

        if (result.kind === "insufficient-stamina") {
            scheduleBattleAction(startEnemyTurn, 800);
        } else if (result.kind === "attack") {
            scheduleBattleAction(
                startEnemyTurn,
                (result.skill.name === "일반 공격" ? 170 : 430) + 500,
            );
        } else if (result.kind === "recovery") {
            scheduleBattleAction(startEnemyTurn, 1020);
        }
    };

    if (skill.damage > 0) scheduleBattleAction(resolve, 300);
    else resolve();
}

function resetBattle() {
    cancelScheduledActions();
    closeBattleLossDialog();
    resetBattleState(battleState);
    setControlsLocked(battleState, false);
    fightSkillsDialog.hidden = true;
    updateStatusBars(battleState);
    enterBattleScreen();
    showOpeningRecommendation();
    runButton.focus();
}

export function enterBattle() {
    setBattleBackground(getCurrentRoadBattleBackground());
    enterBattleScreen();
    if (!battleState.started) {
        battleState.started = true;
        showOpeningRecommendation();
    }
}

export function exitBattle() {
    exitBattleScreen();
}

fightButton.addEventListener("click", () => {
    if (battleState.controlsLocked) return;
    fightSkillsDialog.hidden = false;
    fightSkillButtons[0].focus();
});

fightSkillButtons.forEach((button, index) => {
    button.addEventListener("click", () => resolvePlayerSkill(index));
});

fightSkillsDialog.addEventListener("click", (event) => {
    if (event.target === fightSkillsDialog) {
        fightSkillsDialog.hidden = true;
        fightButton.focus();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !fightSkillsDialog.hidden) {
        fightSkillsDialog.hidden = true;
        fightButton.focus();
    }
});

battleLossDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
});
battleLossConfirmButton.addEventListener("click", resetBattle);

bagButton.addEventListener("click", () => {
    if (battleState.controlsLocked) return;
    console.log("가방 버튼 클릭됨");
    showMenuMessage("가방을 열어서 뭐하게?");
});

runButton.addEventListener("click", () => {
    if (battleState.controlsLocked) return;
    followRecommendationIfMatched("run");
    console.log("도망가기 버튼 클릭됨");
    setControlsLocked(battleState, true);
    showMenuMessage("도망을 시도한다.");
    scheduleBattleAction(() => {
        showMenuMessage("도망치는데 실패했다...");
        scheduleBattleAction(startEnemyTurn, 500);
    }, 1000);
});

startBattleRenderer(battleState);
