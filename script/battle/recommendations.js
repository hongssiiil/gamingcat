import { skillEffects, wolfCombatRules, getEnemyActionProbabilities } from "./rules.js?v=39";

function scoreSkill(
    state,
    skillIndex,
    probabilities = getEnemyActionProbabilities(state),
) {
    const skill = skillEffects[skillIndex];
    const expectedDamage = Math.min(state.enemy.health, skill.damage);
    const expectedHealing = Math.min(
        state.player.maxHealth - state.player.health,
        skill.healthRecovery ?? 0,
    );
    const staminaAfterCost = state.player.stamina - skill.staminaCost;
    const expectedStaminaGain = Math.min(
        state.player.maxStamina - staminaAfterCost,
        skill.staminaRecovery ?? 0,
    );
    const staminaAfterAction = staminaAfterCost + expectedStaminaGain;
    const expectedWolfDamage = (1 - wolfCombatRules.baseCriticalChance / 100)
        * wolfCombatRules.baseDamage
        + wolfCombatRules.baseCriticalChance / 100 * wolfCombatRules.criticalDamage;
    const expectedIncomingDamage = probabilities.attack / 100
        * expectedWolfDamage;
    const defendedIncomingDamage = skill.defense
        ? expectedIncomingDamage * (1 - wolfCombatRules.defenseDamageReduction)
        : expectedIncomingDamage;
    const expectedStaminaPressure = probabilities.roar / 100
        * Math.min(staminaAfterAction, wolfCombatRules.roarPlayerStaminaDamage);

    // Compare each legal action by expected enemy damage, player survival and
    // the stamina left for subsequent turns.
    return expectedDamage
        + expectedHealing * 1.2
        + (expectedStaminaGain - skill.staminaCost) * 0.2
        - expectedStaminaPressure * 0.2
        - defendedIncomingDamage * 1.2;
}

function debtPenalty(tokens) {
    if (tokens > 0) return { rank: 0, message: "" };
    const debt = Math.abs(tokens);
    const message = debt >= 4
        ? "토큰 빚이 커서 티니가 엉뚱한 말을 하고 있어."
        : debt >= 1
            ? "토큰 빚 때문에 티니의 판단이 크게 흐려졌어."
            : "토큰이 바닥나서 티니가 멍해졌어.";
    return { rank: 2, message };
}

const enemyActionLabels = {
    attack: "공격",
    recover: "회복",
    defend: "방어",
    roar: "포효",
};

function getMostLikelyEnemyAction(probabilities) {
    const tieBreakOrder = ["attack", "recover", "defend", "roar"];
    return tieBreakOrder.reduce((mostLikely, action) => (
        probabilities[action] > probabilities[mostLikely] ? action : mostLikely
    ), tieBreakOrder[0]);
}

function getAttackRecommendation(stamina) {
    if (stamina >= skillEffects[1].staminaCost) return 1;
    if (stamina >= skillEffects[0].staminaCost) return 0;
    return 2;
}

function getRecommendedSkillIndex(state, enemyAction) {
    if (enemyAction === "attack") return 3;
    if (enemyAction === "recover") {
        return getAttackRecommendation(state.player.stamina);
    }
    if (enemyAction === "defend") {
        if (state.player.health < state.player.maxHealth) return 2;
        return getAttackRecommendation(state.player.stamina);
    }
    if (enemyAction === "roar") {
        const staminaAfterRoar = Math.max(
            0,
            state.player.stamina - wolfCombatRules.roarPlayerStaminaDamage,
        );
        return getAttackRecommendation(staminaAfterRoar);
    }
    return 2;
}

function describePlayerSkill(skillIndex) {
    if (skillIndex === 0) return "일반 공격을 하자!";
    if (skillIndex === 1) return "힘껏 휘두르자!";
    if (skillIndex === 3) return "방어하자!";
    return "숨을 고르자!";
}

export function getTurnRecommendation(
    state,
    tokens = 0,
    enemyProbabilities = state.enemyActionProbabilities ?? getEnemyActionProbabilities(state),
) {
    const penalty = debtPenalty(tokens);
    const mostLikelyAction = getMostLikelyEnemyAction(enemyProbabilities);
    let skillIndex = getRecommendedSkillIndex(state, mostLikelyAction);
    const needsMoreStamina = state.player.stamina < skillEffects[skillIndex].staminaCost;

    if (needsMoreStamina) {
        return {
            action: "skill",
            skillIndex: 2,
            text: "지금 스태미나가 부족하니까 숨을 고르자!",
            score: 0,
        };
    }

    if (penalty.rank > 0) {
        const candidates = skillEffects
            .map((skill, skillIndex) => ({
                action: "skill",
                skillIndex,
                score: state.player.stamina < skill.staminaCost
                    ? -1000
                    : scoreSkill(state, skillIndex, enemyProbabilities),
            }))
            .sort((a, b) => b.score - a.score);
        const confused = state.player.stamina >= state.player.maxStamina
            ? candidates.find((candidate) => candidate.skillIndex === 2)
            : candidates[Math.min(penalty.rank, candidates.length - 1)];
        if (confused) skillIndex = confused.skillIndex;
    }

    let actionText = describePlayerSkill(skillIndex);
    if (penalty.rank > 0 && skillIndex === 2 && state.player.stamina >= state.player.maxStamina) {
        actionText = "스태미나가 부족하니까 숨을 고르자!";
    } else if (penalty.rank > 0 && state.player.stamina < skillEffects[skillIndex].staminaCost) {
        actionText = `스태미나가 넉넉하니까 ${describePlayerSkill(skillIndex)}`;
    }

    return {
        action: "skill",
        skillIndex,
        text: [
            `상대가 이번 턴에 ${enemyActionLabels[mostLikelyAction]}할 확률이 가장 높아! 우리는 ${actionText}`,
            penalty.message,
        ].filter(Boolean).join("\n"),
        score: scoreSkill(state, skillIndex, enemyProbabilities),
    };
}

export function getDisplayedEnemyActionProbabilities(probabilities, tokens) {
    if (tokens > 0) return { ...probabilities };

    const debt = Math.abs(tokens);
    const displayedConfidence = Math.max(5, 80 - debt * 20);
    const actions = Object.keys(probabilities);
    const actualAction = actions.reduce((mostLikely, action) => (
        probabilities[action] > probabilities[mostLikely] ? action : mostLikely
    ), actions[0]);
    const otherActions = actions.filter((action) => action !== actualAction);
    const otherProbability = otherActions.reduce(
        (sum, action) => sum + probabilities[action],
        0,
    );
    const remainingProbability = 100 - displayedConfidence;

    return Object.fromEntries(actions.map((action) => {
        if (action === actualAction) return [action, displayedConfidence];
        const share = otherProbability > 0
            ? probabilities[action] / otherProbability
            : 1 / otherActions.length;
        return [action, remainingProbability * share];
    }));
}
