export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_INITIAL_STAMINA = 100;
export const ENEMY_INITIAL_HEALTH = 120;
export const ENEMY_INITIAL_STAMINA = 100;
export const MOLE_INITIAL_HEALTH = 60;

export function createBattleState() {
    return {
        player: {
            health: PLAYER_INITIAL_HEALTH,
            maxHealth: PLAYER_INITIAL_HEALTH,
            stamina: PLAYER_INITIAL_STAMINA,
            maxStamina: PLAYER_INITIAL_STAMINA,
            defending: false,
        },
        enemy: {
            health: ENEMY_INITIAL_HEALTH,
            maxHealth: ENEMY_INITIAL_HEALTH,
            stamina: ENEMY_INITIAL_STAMINA,
            maxStamina: ENEMY_INITIAL_STAMINA,
            defending: false,
        },
        enemyKind: "wolf",
        playerAttackAnimation: null,
        playerRestFlashUntil: 0,
        enemyAttackAnimation: null,
        enemyRoarAnimation: null,
        playerHitFlashUntil: 0,
        playerRoarHitUntil: 0,
        controlsLocked: false,
        ended: false,
        started: false,
        currentRecommendation: null,
        enemyActionProbabilities: null,
        displayedEnemyActionProbabilities: null,
        plannedEnemyAction: null,
        turnHistory: [],
        currentTurn: null,
        historyIndex: 0,
        recommendationRevealed: false,
        probabilityRevealed: false,
        activeHelpView: "prompt",
        autoBattleEnabled: false,
    };
}

export function resetBattleState(state) {
    state.player.health = state.player.maxHealth;
    state.player.stamina = state.player.maxStamina;
    state.player.defending = false;
    state.enemy.health = state.enemy.maxHealth;
    state.enemy.stamina = state.enemy.maxStamina;
    state.enemy.defending = false;
    state.playerAttackAnimation = null;
    state.playerRestFlashUntil = 0;
    state.enemyAttackAnimation = null;
    state.enemyRoarAnimation = null;
    state.playerHitFlashUntil = 0;
    state.playerRoarHitUntil = 0;
    state.controlsLocked = false;
    state.ended = false;
    state.started = true;
    state.currentRecommendation = null;
    state.enemyActionProbabilities = null;
    state.displayedEnemyActionProbabilities = null;
    state.plannedEnemyAction = null;
    state.turnHistory = [];
    state.currentTurn = null;
    state.historyIndex = 0;
    state.recommendationRevealed = false;
    state.probabilityRevealed = false;
    state.activeHelpView = "prompt";
    state.autoBattleEnabled = false;
}
