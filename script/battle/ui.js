export const battleSection = document.querySelector("#Battle");
export const menuSection = document.querySelector(".menu-section");
export const menuText = document.getElementById("ai-recommendation");
const messageKind = document.getElementById("battle-message-kind");
export const followRecommendationButton = document.getElementById("follow-recommendation-button");
export const chooseActionButton = document.getElementById("choose-action-button");
export const fightSkillsDialog = document.getElementById("fight-skills-dialog");
export const fightSkillButtons = fightSkillsDialog.querySelectorAll(".skill-option");
export const alternateRunButton = document.getElementById("alternate-run-button");
export const actionChoiceCancelButton = document.getElementById("action-choice-cancel");
export const battleLossDialog = document.getElementById("battle-loss-dialog");
export const battleLossConfirmButton = document.getElementById("battle-loss-confirm");
export const enemyStatus = document.getElementById("enemy-status");
export const playerStatus = document.getElementById("player-status");
export const playerStatusName = playerStatus.querySelector(".status-name");
export const battleHistoryPanel = document.getElementById("battle-history-panel");
export const battleHistoryPreviousButton = document.getElementById("battle-history-previous");
export const battleHistoryNextButton = document.getElementById("battle-history-next");
const battleHistoryTurnLabel = document.getElementById("battle-history-turn-label");
const battleHistoryRecommendation = document.getElementById("battle-history-recommendation");
const battleHistoryChoice = document.getElementById("battle-history-choice");
const battleHistoryResult = document.getElementById("battle-history-result");

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
    followRecommendationButton.disabled = locked;
    chooseActionButton.disabled = locked;
    alternateRunButton.disabled = locked;
    actionChoiceCancelButton.disabled = locked;
    fightSkillButtons.forEach((button) => {
        button.disabled = locked;
    });
}

export function showMenuMessage(message, type = "narration") {
    menuText.textContent = message;
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
    battleHistoryRecommendation.textContent = turn?.recommendation || "추천을 기다리는 중";
    battleHistoryChoice.textContent = turn?.playerChoice || "아직 선택 전";
    const enemyAction = turn?.enemyAction && !(turn.outcome || "").includes("늑대")
        ? `늑대 행동: ${turn.enemyAction}`
        : "";
    battleHistoryResult.textContent = [turn?.outcome, enemyAction]
        .filter(Boolean)
        .join(" · ") || "결과를 기다리는 중";
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

export function openBattleLossDialog() {
    battleLossDialog.showModal();
    battleLossConfirmButton.focus();
}

export function closeBattleLossDialog() {
    if (battleLossDialog.open) battleLossDialog.close();
}
