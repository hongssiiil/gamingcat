import { enterRoad, getCurrentRoadBattleBackground } from "./road.js";
import {
    applyEnemyAttackImpact,
    applyPlayerSkill,
    chooseEnemyAction,
    createEnemyAttack,
    defendEnemy,
    getEnemyActionProbabilities,
    recoverEnemyStamina,
    roarAtPlayer,
    skillEffects,
    spendEnemyStamina,
    wolfCombatRules,
} from "./battle/rules.js?v=36";
import {
    getDisplayedEnemyActionProbabilities,
    getTurnRecommendation,
} from "./battle/recommendations.js?v=35";
import { createBattleState, resetBattleState } from "./battle/state.js?v=35";
import { BATTLE_STARTING_TOKENS, consumeBattleToken, renderBattleTokens } from "./battle/token.js?v=35";
import { setBattleBackground, startBattleRenderer } from "./battle/renderer.js?v=40";
import {
    actionChoiceCancelButton,
    alternateRunButton,
    battleHistoryPreviousButton,
    battleHistoryNextButton,
    battleLossConfirmButton,
    battleLossDialog,
    battleSection,
    chooseActionButton,
    probabilityButton,
    autoBattleButton,
    closeBattleLossDialog,
    enterBattleScreen,
    exitBattleScreen,
    flashInsufficientStamina,
    fightSkillButtons,
    fightSkillsDialog,
    followRecommendationButton,
    openBattleLossDialog,
    playerStatusName,
    renderBattleHistory,
    setControlsLocked,
    showMenuMessage,
    showEnemyProbability,
    STAMINA_ERROR_FEEDBACK_MS,
    updateStatusBars,
    updateBattleActionButtons,
} from "./battle/ui.js?v=39";

const battleState = createBattleState();
const battleTokenState = { tokens: BATTLE_STARTING_TOKENS, events: [] };
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

function spendBattleToken(command) {
    const spent = consumeBattleToken(battleTokenState, command);
    if (spent) renderBattleTokens(battleTokenState.tokens);
    return spent;
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

function recordTurnDamage(field, amount) {
    if (!battleState.currentTurn || amount <= 0) return;
    battleState.currentTurn[field] = (battleState.currentTurn[field] ?? 0) + amount;
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
}

function beginTurn() {
    battleState.recommendationRevealed = false;
    battleState.probabilityRevealed = false;
    battleState.activeHelpView = "prompt";
    battleState.currentTurn = {
        number: battleState.turnHistory.length + 1,
        recommendation: "",
        playerChoice: "",
        enemyAction: "",
        playerDamageReceived: 0,
        enemyDamageReceived: 0,
        outcome: "",
    };
    battleState.turnHistory.push(battleState.currentTurn);
    battleState.historyIndex = battleState.turnHistory.length - 1;
    battleState.enemyActionProbabilities = getEnemyActionProbabilities(battleState);
    battleState.plannedEnemyAction = chooseEnemyAction(
        battleState,
        Math.random() * 100,
        battleState.enemyActionProbabilities,
    );
    battleState.currentRecommendation = getTurnRecommendation(
        battleState,
        battleTokenState.tokens,
        battleState.enemyActionProbabilities,
    );
    battleState.displayedEnemyActionProbabilities = null;
    renderBattleHistory(battleState.turnHistory, battleState.historyIndex);
    showEnemyProbability();
    showMenuMessage("어떤 행동을 할까?");
    updateBattleActionButtons(battleState);
}

function showOpeningRecommendation() {
    beginTurn();
}

function showTurnRecommendation() {
    beginTurn();
    if (battleState.autoBattleEnabled) {
        scheduleBattleAction(runAutoBattleTurn, 120);
    }
}

function finishBattle(message) {
    if (battleState.ended) return;
    if (battleState.currentTurn && !battleState.currentTurn.enemyAction) {
        recordTurnField("enemyAction", "행동하지 못함");
    }
    recordTurnField("outcome", message);
    battleState.player.defending = false;
    battleState.enemy.defending = false;
    battleState.ended = true;
    battleState.autoBattleEnabled = false;
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
    if (battleState.currentTurn && !battleState.currentTurn.enemyAction) {
        recordTurnField("enemyAction", "행동하지 못함");
    }
    recordTurnField("outcome", "플레이어의 체력이 0이 되어 전투를 마쳤다.");
    battleState.player.defending = false;
    battleState.enemy.defending = false;
    battleState.ended = true;
    battleState.autoBattleEnabled = false;
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
    battleState.player.defending = false;
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

    const action = battleState.plannedEnemyAction ?? chooseEnemyAction(
        battleState,
        Math.random() * 100,
        battleState.enemyActionProbabilities ?? getEnemyActionProbabilities(battleState),
    );
    battleState.plannedEnemyAction = null;
    if (action === "recover") {
        recoverEnemyStamina(battleState);
        recordTurnField("enemyAction", "숨을 고름");
        recordTurnField("outcome", "늑대가 숨을 고르며 스태미나를 회복했다.");
        showMenuMessage("늑대가 숨을 고르며 스태미나를 회복했다.");
        updateStatusBars(battleState);
        scheduleBattleAction(endEnemyTurn, 520);
        return;
    }

    if (action === "defend") {
        defendEnemy(battleState);
        recordTurnField("enemyAction", "방어");
        recordTurnField("outcome", "늑대가 자세를 낮춰 다음 공격의 피해를 줄일 준비를 했다.");
        showMenuMessage("늑대가 방어 자세를 취했다. 다음 공격의 피해가 줄어든다.");
        updateStatusBars(battleState);
        scheduleBattleAction(endEnemyTurn, 520);
        return;
    }

    if (action === "roar") {
        const drainedStamina = roarAtPlayer(battleState);
        recordTurnField("enemyAction", "포효");
        recordTurnField("outcome", `늑대의 포효! 플레이어 스태미나 ${drainedStamina} 감소.`);
        showMenuMessage(`늑대의 포효! 스태미나 ${drainedStamina} 감소.`);
        updateStatusBars(battleState);
        scheduleBattleAction(endEnemyTurn, 620);
        return;
    }

    spendEnemyStamina(battleState);
    recordTurnField("enemyAction", "공격");
    showMenuMessage("늑대의 공격!");
    updateStatusBars(battleState);
    scheduleBattleAction(() => {
        createEnemyAttack(battleState, performance.now());
        scheduleBattleAction(() => {
            const previousHealth = battleState.player.health;
            const message = applyEnemyAttackImpact(battleState);
            if (message) {
                recordTurnDamage("playerDamageReceived", previousHealth - battleState.player.health);
                recordTurnField("outcome", message);
                showMenuMessage(message);
                updateStatusBars(battleState);
            }
        }, 85);
        scheduleBattleAction(endEnemyTurn, 170 + 800);
    }, 600);
}

function resolvePlayerSkill(skillIndex, automatic = false) {
    if (battleState.controlsLocked && !automatic) return;
    const skill = skillEffects[skillIndex];
    if (!skill) return;
    recordTurnField("playerChoice", skill.name);
    fightSkillsDialog.hidden = true;
    setControlsLocked(battleState, true);

    const resolve = () => {
        const result = applyPlayerSkill(battleState, skillIndex, performance.now());
        recordTurnDamage("enemyDamageReceived", result.damage ?? 0);
        recordTurnField("outcome", result.message);
        updateStatusBars(battleState);

        if (result.kind === "insufficient-stamina") {
            flashInsufficientStamina();
            scheduleBattleAction(
                () => showMenuMessage(result.message),
                STAMINA_ERROR_FEEDBACK_MS,
            );
            scheduleBattleAction(startEnemyTurn, 800);
            return;
        }

        showMenuMessage(result.message);
        if (result.kind === "attack") {
            scheduleBattleAction(
                startEnemyTurn,
                (result.skill.name === "일반 공격" ? 170 : 430) + 500,
            );
        } else if (result.kind === "recovery") {
            scheduleBattleAction(startEnemyTurn, 1020);
        } else if (result.kind === "defense") {
            scheduleBattleAction(startEnemyTurn, 520);
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
    if (!battleState.recommendationRevealed) {
        if (!spendBattleToken("recommendation")) return;
        battleState.recommendationRevealed = true;
        battleState.currentRecommendation = getTurnRecommendation(
            battleState,
            battleTokenState.tokens,
            battleState.enemyActionProbabilities,
        );
        recordTurnField("recommendation", battleState.currentRecommendation.text);
    }
    if (battleState.activeHelpView !== "recommendation") {
        battleState.activeHelpView = "recommendation";
        showMenuMessage(battleState.currentRecommendation.text, "recommendation");
        updateBattleActionButtons(battleState);
        followRecommendationButton.focus();
        return;
    }
    const recommendation = battleState.currentRecommendation;
    if (!recommendation) return;
    resolvePlayerSkill(recommendation.skillIndex);
}

function revealEnemyProbabilities() {
    if (battleState.controlsLocked || battleState.autoBattleEnabled) return;
    if (!battleState.probabilityRevealed) {
        if (!spendBattleToken("probability")) return;
        battleState.probabilityRevealed = true;
        battleState.displayedEnemyActionProbabilities = getDisplayedEnemyActionProbabilities(
            battleState.enemyActionProbabilities,
            battleTokenState.tokens,
        );
    }
    battleState.activeHelpView = "probability";
    showMenuMessage("늑대의 다음 행동 확률");
    showEnemyProbability(battleState.displayedEnemyActionProbabilities);
    updateBattleActionButtons(battleState);
    probabilityButton.focus();
}

function toggleAutoBattle() {
    if (battleState.ended) return;
    if (battleState.autoBattleEnabled) {
        battleState.autoBattleEnabled = false;
        setControlsLocked(battleState, battleState.controlsLocked);
        showMenuMessage("자동전투를 멈췄어. 다음 행동을 골라 줘.");
        return;
    }
    if (battleState.controlsLocked) return;
    battleState.autoBattleEnabled = true;
    setControlsLocked(battleState, false);
    showMenuMessage("자동전투를 시작할게. 매 턴 1토큰을 사용할게.");
    scheduleBattleAction(runAutoBattleTurn, 120);
}

function runAutoBattleTurn() {
    if (!battleState.autoBattleEnabled || battleState.controlsLocked || battleState.ended) return;
    if (!spendBattleToken("autoTurn")) {
        battleState.autoBattleEnabled = false;
        setControlsLocked(battleState, false);
        showMenuMessage("자동전투를 진행할 수 없어 멈췄어.");
        return;
    }

    const recommendation = getTurnRecommendation(
        battleState,
        battleTokenState.tokens,
        battleState.enemyActionProbabilities,
    );
    battleState.currentRecommendation = recommendation;
    recordTurnField("recommendation", recommendation.text);
    resolvePlayerSkill(recommendation.skillIndex, true);
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
    playerStatusName.textContent = "나";
    enterBattleScreen();
    renderBattleTokens(battleTokenState.tokens);
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
probabilityButton.addEventListener("click", revealEnemyProbabilities);
autoBattleButton.addEventListener("click", toggleAutoBattle);

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
    const mainActions = [
        followRecommendationButton,
        chooseActionButton,
        probabilityButton,
        autoBattleButton,
    ];
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
