export const battleSection = document.querySelector("#Battle");
export const menuSection = document.querySelector(".menu-section");
export const menuText = document.getElementById("ai-recommendation");
export const fightButton = document.getElementById("fight-button");
export const bagButton = document.getElementById("bag-button");
export const runButton = document.getElementById("run-button");
export const fightSkillsDialog = document.getElementById("fight-skills-dialog");
export const fightSkillButtons = fightSkillsDialog.querySelectorAll(".fight-skill-button");
export const battleLossDialog = document.getElementById("battle-loss-dialog");
export const battleLossConfirmButton = document.getElementById("battle-loss-confirm");
export const enemyStatus = document.getElementById("enemy-status");
export const playerStatus = document.getElementById("player-status");

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
    fightButton.disabled = locked;
    bagButton.disabled = locked;
    runButton.disabled = locked;
    fightSkillButtons.forEach((button) => {
        button.disabled = locked;
    });
}

export function showMenuMessage(message) {
    menuText.textContent = message;
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
