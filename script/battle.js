import { enterRoad, getCurrentRoadBattleBackground, getPlayerName } from "./road.js";
import {
    applyEnemyAttackImpact,
    applyPlayerSkill,
    chooseEnemyAction,
    createEnemyAttack,
    getEnemyActionProbabilities,
    recoverEnemyStamina,
    skillEffects,
    spendEnemyStamina,
    wolfCombatRules,
} from "./battle/rules.js";
import { getTurnRecommendation } from "./battle/recommendations.js";
import { createBattleState, resetBattleState } from "./battle/state.js";
import { setBattleBackground, startBattleRenderer } from "./battle/renderer.js";
import {
    actionChoiceCancelButton,
    alternateRunButton,
    battleHistoryPreviousButton,
    battleHistoryNextButton,
    battleLossConfirmButton,
    battleLossDialog,
    battleSection,
    chooseActionButton,
    closeBattleLossDialog,
    enterBattleScreen,
    exitBattleScreen,
    fightSkillButtons,
    fightSkillsDialog,
    followRecommendationButton,
    openBattleLossDialog,
    playerStatusName,
    renderBattleHistory,
    setControlsLocked,
    showMenuMessage,
    updateEnemyIntent,
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

function recordTurnField(field, value) {
    if (!battleState.currentTurn) return;
    if (field === "outcome" && battleState.currentTurn.outcome) {
        battleState.currentTurn.outcome = `${battleState.currentTurn.outcome} ${value}`;
        renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
        return;
    }
    battleState.currentTurn[field] = value;
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
}

function beginTurn(recommendation) {
    battleState.currentRecommendation = recommendation;
    battleState.currentTurn = {
        number: battleState.turnHistory.length + 1,
        recommendation: recommendation.text,
        playerChoice: "",
        enemyAction: "",
        outcome: "",
    };
    battleState.turnHistory.push(battleState.currentTurn);
    battleState.historyIndex = battleState.turnHistory.length - 1;
    battleState.enemyActionProbabilities = getEnemyActionProbabilities(battleState);
    updateEnemyIntent(battleState.enemyActionProbabilities);
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
    showMenuMessage(recommendation.text, "recommendation");
}

function showOpeningRecommendation() {
    beginTurn({
        action: "run",
        text: "도망가자! 이길 수 있는 상대가 아니야!",
    });
}

function showTurnRecommendation() {
    beginTurn(getTurnRecommendation(battleState));
}

function finishBattle(message) {
    if (battleState.ended) return;
    recordTurnField("outcome", message);
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
    recordTurnField("outcome", "플레이어의 체력이 0이 되어 전투를 마쳤다.");
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
    followRecommendationButton.focus();
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

    // Calculate at decision time and share this exact distribution with the UI
    // and the random action roll so the displayed bars describe this turn.
    battleState.enemyActionProbabilities = getEnemyActionProbabilities(battleState);
    updateEnemyIntent(battleState.enemyActionProbabilities);
    const action = chooseEnemyAction(
        battleState,
        Math.random() * 100,
        battleState.enemyActionProbabilities,
    );
    if (action === "recover") {
        recoverEnemyStamina(battleState);
        recordTurnField("enemyAction", "숨을 고름");
        recordTurnField("outcome", "늑대가 숨을 고르며 스태미나를 회복했다.");
        showMenuMessage("늑대가 숨을 고르며 스태미나를 회복했다.");
        updateStatusBars(battleState);
        scheduleBattleAction(() => {
            if (battleState.player.health <= 0) {
                showBattleLoss();
                return;
            }
            showTurnRecommendation();
            setControlsLocked(battleState, false);
            followRecommendationButton.focus();
        }, 520);
        return;
    }

    spendEnemyStamina(battleState);
    recordTurnField("enemyAction", "공격");
    showMenuMessage("늑대의 공격!");
    updateStatusBars(battleState);
    scheduleBattleAction(() => {
        createEnemyAttack(battleState, performance.now());
        scheduleBattleAction(() => {
            const message = applyEnemyAttackImpact(battleState);
            if (message) {
                recordTurnField("outcome", message);
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
    recordTurnField("playerChoice", skill.name);
    fightSkillsDialog.hidden = true;
    setControlsLocked(battleState, true);

    const resolve = () => {
        const result = applyPlayerSkill(battleState, skillIndex, performance.now());
        recordTurnField("outcome", result.message);
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

    if (skill.damage > 0 && battleState.player.stamina >= skill.staminaCost) {
        scheduleBattleAction(resolve, 300);
    } else {
        resolve();
    }
}

function attemptEscape() {
    if (battleState.controlsLocked) return;
    recordTurnField("playerChoice", "도망 시도");
    fightSkillsDialog.hidden = true;
    setControlsLocked(battleState, true);
    showMenuMessage("도망을 시도한다.");
    scheduleBattleAction(() => {
        if (Math.random() < 0.8) {
            recordTurnField("outcome", "도망에 실패했다.");
            showMenuMessage("도망치는데 실패했다...");
            scheduleBattleAction(startEnemyTurn, 500);
            return;
        }

        finishBattle("무사히 도망쳤다!");
    }, 1000);
}

function acceptRecommendation() {
    if (battleState.controlsLocked) return;
    const recommendation = battleState.currentRecommendation;
    if (!recommendation) return;
    if (recommendation.action === "run") {
        attemptEscape();
        return;
    }
    resolvePlayerSkill(recommendation.skillIndex);
}

function openActionChoices() {
    if (battleState.controlsLocked) return;
    fightSkillsDialog.hidden = false;
    fightSkillButtons[0].focus();
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
    followRecommendationButton.focus();
}

export async function enterBattle() {
    await setBattleBackground(getCurrentRoadBattleBackground());
    playerStatusName.textContent = getPlayerName() || "플레이어";
    enterBattleScreen();
    followRecommendationButton.focus();
    if (!battleState.started) {
        battleState.started = true;
        showOpeningRecommendation();
    }
}

export function exitBattle() {
    exitBattleScreen();
}

followRecommendationButton.addEventListener("click", acceptRecommendation);
chooseActionButton.addEventListener("click", openActionChoices);

fightSkillButtons.forEach((button, index) => {
    button.addEventListener("click", () => resolvePlayerSkill(index));
});

alternateRunButton.addEventListener("click", attemptEscape);
actionChoiceCancelButton.addEventListener("click", () => {
    fightSkillsDialog.hidden = true;
    chooseActionButton.focus();
});

fightSkillsDialog.addEventListener("click", (event) => {
    if (event.target === fightSkillsDialog) {
        fightSkillsDialog.hidden = true;
        chooseActionButton.focus();
    }
});

battleHistoryPreviousButton.addEventListener("click", () => {
    if (battleState.historyIndex <= 0) return;
    battleState.historyIndex -= 1;
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
});
battleHistoryNextButton.addEventListener("click", () => {
    if (battleState.historyIndex >= battleState.turnHistory.length - 1) return;
    battleState.historyIndex += 1;
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
});

document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const movementKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
    const isActionMenuOpen = !fightSkillsDialog.hidden;
    const mainActions = [followRecommendationButton, chooseActionButton];
    const isMainActionFocused = mainActions.includes(document.activeElement);

    if (
        battleSection.classList.contains("screen-active")
        && movementKeys.includes(key)
        && (isActionMenuOpen || isMainActionFocused)
    ) {
        const choices = isActionMenuOpen
            ? [...fightSkillButtons, alternateRunButton, actionChoiceCancelButton]
                .filter((button) => !button.disabled)
            : mainActions.filter((button) => !button.disabled);
        const focusedIndex = choices.indexOf(document.activeElement);
        if (choices.length) {
            event.preventDefault();
            const vertical = key === "arrowup" || key === "w" ? -1
                : key === "arrowdown" || key === "s" ? 1 : 0;
            const horizontal = key === "arrowleft" || key === "a" ? -1
                : key === "arrowright" || key === "d" ? 1 : 0;
            const delta = isActionMenuOpen || vertical ? vertical : horizontal;
            const activeIndex = focusedIndex === -1 ? 0 : focusedIndex;
            if (delta) choices[(activeIndex + delta + choices.length) % choices.length].focus();
        }
    }

    if (event.key === "Escape" && isActionMenuOpen) {
        event.preventDefault();
        fightSkillsDialog.hidden = true;
        chooseActionButton.focus();
        return;
    }

});

battleLossDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
});
battleLossConfirmButton.addEventListener("click", resetBattle);

startBattleRenderer(battleState);
