export const skillEffects = [
    { name: "일반 공격", damage: 10, staminaCost: 20, accuracy: 100 },
    { name: "힘껏 휘두르기", damage: 20, staminaCost: 30, accuracy: 70 },
    {
        name: "숨 고르기",
        damage: 0,
        staminaCost: 0,
        accuracy: 100,
        staminaRecovery: 40,
        healthRecovery: 10,
    },
];

export const wolfCombatRules = {
    baseDamage: 15,
    criticalDamage: 25,
    baseAccuracy: 70,
    baseCriticalChance: 30,
    criticalChanceCap: 70,
    staminaCost: 20,
};

export function applyPlayerSkill(state, skillIndex, now) {
    const skill = skillEffects[skillIndex];
    if (!skill) return { kind: "invalid" };
    if (state.player.stamina < skill.staminaCost) {
        return {
            kind: "insufficient-stamina",
            message: `${skill.name}! 스태미나가 부족해 실패했다...`,
        };
    }

    state.player.stamina -= skill.staminaCost;
    const previousHealth = state.player.health;
    const previousStamina = state.player.stamina;
    if (skill.staminaRecovery || skill.healthRecovery) {
        state.playerRestFlashUntil = now + 520;
    }

    const hit = Math.random() * 100 < skill.accuracy;
    if (hit) {
        state.enemy.health = Math.max(0, state.enemy.health - skill.damage);
    }
    if (skill.staminaRecovery) {
        state.player.stamina = Math.min(
            state.player.maxStamina,
            state.player.stamina + skill.staminaRecovery,
        );
    }
    if (skill.healthRecovery) {
        state.player.health = Math.min(
            state.player.maxHealth,
            state.player.health + skill.healthRecovery,
        );
    }

    const recoveredHealth = state.player.health - previousHealth;
    const recoveredStamina = state.player.stamina - previousStamina;
    if (skill.damage > 0) {
        state.playerAttackAnimation = {
            startedAt: now,
            duration: skill.name === "일반 공격" ? 170 : 430,
            heavy: skill.name !== "일반 공격",
            hit,
        };
    }

    const message = !hit
        ? `${skill.name}! 빗나갔다...`
        : skill.staminaRecovery || skill.healthRecovery
            ? `${skill.name}! 체력 ${recoveredHealth}, 스태미나 ${recoveredStamina} 회복했다.`
            : `${skill.name}! 적에게 ${skill.damage} 피해를 줬다.`;

    return {
        kind: skill.damage > 0 ? "attack" : "recovery",
        message,
        skill,
        hit,
    };
}

export function recoverEnemyStamina(state) {
    state.enemy.stamina = Math.min(
        state.enemy.maxStamina,
        state.enemy.stamina + wolfCombatRules.staminaCost * 1.5,
    );
}

export function spendEnemyStamina(state) {
    state.enemy.stamina -= wolfCombatRules.staminaCost;
}

export function createEnemyAttack(state, now) {
    const accuracy = Math.min(
        100,
        wolfCombatRules.baseAccuracy + state.recommendationFollowCount * 5,
    );
    const criticalChance = Math.min(
        wolfCombatRules.criticalChanceCap,
        wolfCombatRules.baseCriticalChance + state.recommendationFollowCount * 5,
    );
    const hit = Math.random() * 100 < accuracy;
    state.enemyAttackAnimation = {
        startedAt: now,
        impactApplied: false,
        hit,
        critical: hit && Math.random() * 100 < criticalChance,
    };
}

export function applyEnemyAttackImpact(state) {
    const attack = state.enemyAttackAnimation;
    if (!attack || attack.impactApplied) return null;
    attack.impactApplied = true;

    if (!attack.hit) return "늑대의 공격을 피했다!";

    const damage = attack.critical
        ? wolfCombatRules.criticalDamage
        : wolfCombatRules.baseDamage;
    state.player.health = Math.max(0, state.player.health - damage);
    state.playerHitFlashUntil = performance.now() + 350;
    return attack.critical
        ? `늑대의 치명타! ${damage} 피해를 받았다.`
        : `늑대에게 ${damage} 피해를 받았다.`;
}
