export const skillEffects = [
    { name: "일반 공격", damage: 10, staminaCost: 20, accuracy: 100 },
    { name: "힘껏 휘두르기", damage: 20, staminaCost: 30, accuracy: 80 },
    {
        name: "숨 고르기",
        damage: 0,
        staminaCost: 0,
        accuracy: 100,
        staminaRecovery: 40,
        healthRecovery: 10,
    },
    {
        name: "방어하기",
        damage: 0,
        staminaCost: 10,
        accuracy: 100,
        defense: true,
    },
];

export const wolfCombatRules = {
    baseDamage: 15,
    criticalDamage: 25,
    baseAccuracy: 70,
    baseCriticalChance: 30,
    criticalChanceCap: 70,
    staminaCost: 20,
    defenseStaminaCost: 10,
    roarStaminaCost: 10,
    roarPlayerStaminaDamage: 20,
    defenseDamageReduction: 0.5,
    staminaRecovery: 30,
};

export function getEnemyActionProbabilities(state) {
    if (state.enemy.stamina < wolfCombatRules.staminaCost) {
        return { attack: 0, recover: 100, defend: 0, roar: 0 };
    }

    if (state.enemy.stamina < state.enemy.maxStamina) {
        const remainingProbability = 70 / 3;
        return {
            attack: remainingProbability,
            recover: 30,
            defend: remainingProbability,
            roar: remainingProbability,
        };
    }

    const actionProbability = 100 / 3;
    return {
        attack: actionProbability,
        recover: 0,
        defend: actionProbability,
        roar: actionProbability,
    };
}

export function chooseEnemyAction(state, roll = Math.random() * 100, predictedProbabilities = null) {
    const probabilities = predictedProbabilities ?? getEnemyActionProbabilities(state);
    const actions = ["attack", "recover", "defend", "roar"];
    let threshold = 0;
    for (const action of actions) {
        threshold += probabilities[action] ?? 0;
        if (roll < threshold) return action;
    }
    for (let index = actions.length - 1; index >= 0; index -= 1) {
        const action = actions[index];
        if ((probabilities[action] ?? 0) > 0) return action;
    }
    return "recover";
}

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
    if (skill.defense) {
        state.player.defending = true;
        return {
            kind: "defense",
            message: "방어 자세를 취했다. 이번 턴 늑대 공격의 피해가 줄어든다.",
            skill,
        };
    }

    const previousHealth = state.player.health;
    const previousStamina = state.player.stamina;
    const previousEnemyHealth = state.enemy.health;
    if (skill.staminaRecovery || skill.healthRecovery) {
        state.playerRestFlashUntil = now + 520;
    }

    // Guard reduces damage instead of allowing the defender to evade the attack.
    const hit = state.enemy.defending || Math.random() * 100 < skill.accuracy;
    let damage = 0;
    let blockedByDefense = false;
    if (hit) {
        damage = skill.damage;
        if (skill.damage > 0 && state.enemy.defending) {
            damage = Math.ceil(skill.damage * (1 - wolfCombatRules.defenseDamageReduction));
            blockedByDefense = true;
        }
        state.enemy.health = Math.max(0, state.enemy.health - damage);
        damage = previousEnemyHealth - state.enemy.health;
    }
    if (skill.damage > 0 && state.enemy.defending) {
        state.enemy.defending = false;
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
            : blockedByDefense
                ? `${skill.name}! 늑대의 방어로 피해가 줄어 ${damage} 피해를 줬다.`
                : `${skill.name}! 적에게 ${damage} 피해를 줬다.`;

    return {
        kind: skill.damage > 0 ? "attack" : "recovery",
        message,
        skill,
        hit,
        damage,
        blockedByDefense,
    };
}

export function recoverEnemyStamina(state) {
    state.enemy.stamina = Math.min(
        state.enemy.maxStamina,
        state.enemy.stamina + wolfCombatRules.staminaRecovery,
    );
}

export function spendEnemyStamina(state, amount = wolfCombatRules.staminaCost) {
    state.enemy.stamina = Math.max(0, state.enemy.stamina - amount);
}

export function defendEnemy(state) {
    spendEnemyStamina(state, wolfCombatRules.defenseStaminaCost);
    state.enemy.defending = true;
}

export function roarAtPlayer(state) {
    spendEnemyStamina(state, wolfCombatRules.roarStaminaCost);
    const drainedStamina = Math.min(
        state.player.stamina,
        wolfCombatRules.roarPlayerStaminaDamage,
    );
    state.player.stamina -= drainedStamina;
    return drainedStamina;
}

export function createEnemyAttack(state, now) {
    const accuracy = wolfCombatRules.baseAccuracy;
    const criticalChance = Math.min(
        wolfCombatRules.criticalChanceCap,
        wolfCombatRules.baseCriticalChance,
    );
    // Guard reduces damage instead of allowing the defender to evade the attack.
    const hit = state.player.defending || Math.random() * 100 < accuracy;
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

    if (!attack.hit) {
        state.player.defending = false;
        return "늑대의 공격을 피했다!";
    }

    const incomingDamage = attack.critical
        ? wolfCombatRules.criticalDamage
        : wolfCombatRules.baseDamage;
    const defended = state.player.defending;
    const damage = defended
        ? Math.ceil(incomingDamage * (1 - wolfCombatRules.defenseDamageReduction))
        : incomingDamage;
    state.player.defending = false;
    state.player.health = Math.max(0, state.player.health - damage);
    state.playerHitFlashUntil = performance.now() + 350;
    if (defended) {
        return attack.critical
            ? `늑대의 치명타를 방어해 ${damage} 피해를 받았다.`
            : `방어에 성공해 늑대에게 ${damage} 피해를 받았다.`;
    }
    return attack.critical
        ? `늑대의 치명타! ${damage} 피해를 받았다.`
        : `늑대에게 ${damage} 피해를 받았다.`;
}
