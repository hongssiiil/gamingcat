export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_INITIAL_STAMINA = 100;
export const ENEMY_INITIAL_HEALTH = 100;
export const ENEMY_INITIAL_STAMINA = 100;

export function createBattleState() {
    return {
        player: {
            health: PLAYER_INITIAL_HEALTH,
            maxHealth: PLAYER_INITIAL_HEALTH,
            stamina: PLAYER_INITIAL_STAMINA,
            maxStamina: PLAYER_INITIAL_STAMINA,
        },
        enemy: {
            health: ENEMY_INITIAL_HEALTH,
            maxHealth: ENEMY_INITIAL_HEALTH,
            stamina: ENEMY_INITIAL_STAMINA,
            maxStamina: ENEMY_INITIAL_STAMINA,
        },
        playerAttackAnimation: null,
        playerRestFlashUntil: 0,
        enemyAttackAnimation: null,
        playerHitFlashUntil: 0,
        controlsLocked: false,
        ended: false,
        started: false,
        recommendationFollowCount: 0,
        currentRecommendation: null,
    };
}

export function resetBattleState(state) {
    state.player.health = state.player.maxHealth;
    state.player.stamina = state.player.maxStamina;
    state.enemy.health = state.enemy.maxHealth;
    state.enemy.stamina = state.enemy.maxStamina;
    state.playerAttackAnimation = null;
    state.playerRestFlashUntil = 0;
    state.enemyAttackAnimation = null;
    state.playerHitFlashUntil = 0;
    state.controlsLocked = false;
    state.ended = false;
    state.started = true;
    state.recommendationFollowCount = 0;
    state.currentRecommendation = null;
}
