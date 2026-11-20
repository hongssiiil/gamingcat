export const battleSection = document.querySelector("#Battle");
export const menuSection = document.querySelector(".menu-section");
export const menuText = document.getElementById("ai-recommendation");
const messageKind = document.getElementById("battle-message-kind");
export const followRecommendationButton = document.getElementById("follow-recommendation-button");
export const chooseActionButton = document.getElementById("choose-action-button");
export const probabilityButton = document.getElementById("battle-probability-button");
export const autoBattleButton = document.getElementById("battle-auto-button");
export const enemyProbabilityText = document.getElementById("battle-enemy-probability");
export const fightSkillsDialog = document.getElementById("fight-skills-dialog");
export const fightSkillButtons = fightSkillsDialog.querySelectorAll(".skill-option");
export const alternateRunButton = document.getElementById("alternate-run-button");
export const actionChoiceCancelButton = document.getElementById("action-choice-cancel");
export const battleLossDialog = document.getElementById("battle-loss-dialog");
export const battleLossConfirmButton = document.getElementById("battle-loss-confirm");
export const enemyStatus = document.getElementById("enemy-status");
export const playerStatus = document.getElementById("player-status");
export const enemyName = enemyStatus.querySelector(".status-name");
export const enemyPortrait = enemyStatus.querySelector(".status-portrait");
export const playerStatusName = playerStatus.querySelector(".status-name");
export const battleHistoryPanel = document.getElementById("battle-history-panel");
export const battleHistoryPreviousButton = document.getElementById("battle-history-previous");
export const battleHistoryNextButton = document.getElementById("battle-history-next");
const battleHistoryTurnLabel = document.getElementById("battle-history-turn-label");
const battleHistoryRecommendation = document.getElementById("battle-history-recommendation");
const battleHistoryChoice = document.getElementById("battle-history-choice");
const battleHistoryResult = document.getElementById("battle-history-result");
export const STAMINA_ERROR_FEEDBACK_MS = 420;
let staminaFeedbackTimeout;

export function enterBattleScreen() {
    battleSection.classList.replace("screen", "screen-active");
    if (window.matchMedia("(max-width: 900px), (pointer: coarse)").matches) {
        const lock = screen.orientation?.lock;
        if (lock) lock.call(screen.orientation, "landscape").catch(() => {});
    }
}

export function exitBattleScreen() {
    battleSection.classList.replace("screen-active", "screen");
    screen.orientation?.unlock?.();
}

export function setControlsLocked(state, locked) {
    state.controlsLocked = locked;
    followRecommendationButton.disabled = locked || state.autoBattleEnabled;
    chooseActionButton.disabled = locked || state.autoBattleEnabled;
    alternateRunButton.disabled = locked;
    actionChoiceCancelButton.disabled = locked;
    probabilityButton.disabled = locked || state.autoBattleEnabled;
    autoBattleButton.disabled = state.ended || (locked && !state.autoBattleEnabled);
    autoBattleButton.setAttribute("aria-pressed", String(state.autoBattleEnabled));
    autoBattleButton.textContent = state.autoBattleEnabled
        ? "자동전투 중지"
        : "자동전투 시작 · 턴당 2토큰";
    fightSkillButtons.forEach((button) => {
        button.disabled = locked || state.autoBattleEnabled;
    });
}

export function updateBattleActionButtons(state) {
    followRecommendationButton.textContent = !state.recommendationRevealed
        ? `추천 행동 보기 · ${state.probabilityRevealed ? 1 : 2}토큰`
        : state.activeHelpView === "recommendation"
            ? "추천대로 행동"
            : "추천 행동 다시 보기";
    probabilityButton.textContent = !state.probabilityRevealed
        ? `${state.enemyKind === "mole" ? "두더지" : "늑대"} 행동 확률 · 1토큰`
        : state.activeHelpView === "probability"
            ? `${state.enemyKind === "mole" ? "두더지" : "늑대"} 확률 표시 중`
            : "적 행동 확률 다시 보기";
    setControlsLocked(state, state.controlsLocked);
}

export function showEnemyProbability(probabilities = null) {
    if (!probabilities) {
        enemyProbabilityText.hidden = true;
        enemyProbabilityText.textContent = "";
        return;
    }
    enemyProbabilityText.hidden = false;
    const actionLabels = [
        ["attack", "공격"],
        ["recover", "회복"],
        ["defend", "방어"],
        ["roar", "포효"],
    ];
    const roundedProbabilities = Object.fromEntries(actionLabels.map(([action]) => [
        action,
        Number((probabilities[action] ?? 0).toFixed(1)),
    ]));
    const roundingDifference = Number((100 - Object.values(roundedProbabilities)
        .reduce((sum, value) => sum + value, 0)).toFixed(1));
    const lastPossibleAction = [...actionLabels].reverse()
        .find(([action]) => (probabilities[action] ?? 0) > 0)?.[0];
    if (lastPossibleAction) {
        roundedProbabilities[lastPossibleAction] += roundingDifference;
    }
    const formatProbability = (value) => Number.isInteger(value) ? value : value.toFixed(1);
    enemyProbabilityText.textContent = `다음 행동 · ${actionLabels
        .map(([action, label]) => `${label} ${formatProbability(roundedProbabilities[action])}%`)
        .join(" / ")}`;
}

export function showMenuMessage(message, type = "narration") {
    menuText.textContent = message;
    enemyProbabilityText.hidden = true;
    enemyProbabilityText.textContent = "";
    const isRecommendation = type === "recommendation";
    messageKind.hidden = !isRecommendation;
    messageKind.textContent = isRecommendation ? "고양이 추천" : "";
    menuSection.classList.toggle("is-recommendation", isRecommendation);
}

export function renderBattleHistory(turns, selectedIndex) {
    const turn = turns[selectedIndex];
    battleHistoryTurnLabel.textContent = turns.length
        ? `${selectedIndex + 1}턴 / ${turns.length}턴`
        : "기록 없음";
    battleHistoryPreviousButton.disabled = selectedIndex <= 0;
    battleHistoryNextButton.disabled = selectedIndex >= turns.length - 1;
    battleHistoryRecommendation.textContent = turn?.recommendation
        || (turn?.playerChoice ? "추천을 받지 않음" : "추천을 기다리는 중");
    battleHistoryChoice.textContent = turn?.playerChoice || "아직 선택 전";
    if (!turn?.playerChoice) {
        battleHistoryResult.textContent = "아직 선택 전";
        return;
    }
    const enemyAction = {
        공격: "공격했다",
        "숨을 고름": "숨을 골랐다",
        방어: "방어했다",
        포효: "포효했다",
        "행동하지 못함": "행동하지 못했다",
    }[turn?.enemyAction] ?? (turn?.enemyAction ? `${turn.enemyAction}했다` : "아직 행동하지 않았다");
    battleHistoryResult.textContent = `적은 ${enemyAction}. 나는 ${turn?.playerDamageReceived ?? 0}의 데미지를, 적은 ${turn?.enemyDamageReceived ?? 0}의 데미지를 입었다.`;
}

function updateStatus(status, entity, type) {
    const value = entity[type];
    const max = type === "health" ? entity.maxHealth : entity.maxStamina;
    const bar = status.querySelector(`.${type}-bar`);
    const valueLabel = document.getElementById(
        `${status === enemyStatus ? "enemy" : "player"}-${type}-value`,
    );
    const boundedValue = Math.max(0, Math.min(value, max));
    bar.querySelector(".status-fill").style.width = `${max > 0 ? (boundedValue / max) * 100 : 0}%`;
    bar.setAttribute("aria-valuemax", String(max));
    bar.setAttribute("aria-valuenow", String(boundedValue));
    if (valueLabel) valueLabel.textContent = `${boundedValue} / ${max}`;
}

export function updateStatusBars(state) {
    updateStatus(enemyStatus, state.enemy, "health");
    updateStatus(enemyStatus, state.enemy, "stamina");
    updateStatus(playerStatus, state.player, "health");
    updateStatus(playerStatus, state.player, "stamina");
}

export function flashInsufficientStamina() {
    const staminaBar = playerStatus.querySelector(".stamina-bar");
    if (!staminaBar) return;

    window.clearTimeout(staminaFeedbackTimeout);
    staminaBar.classList.remove("is-insufficient-feedback");
    void staminaBar.offsetWidth;
    staminaBar.classList.add("is-insufficient-feedback");
    staminaFeedbackTimeout = window.setTimeout(() => {
        staminaBar.classList.remove("is-insufficient-feedback");
    }, STAMINA_ERROR_FEEDBACK_MS + 40);
}

export function openBattleLossDialog() {
    battleLossDialog.showModal();
    battleLossConfirmButton.focus();
}

export function closeBattleLossDialog() {
    if (battleLossDialog.open) battleLossDialog.close();
}
