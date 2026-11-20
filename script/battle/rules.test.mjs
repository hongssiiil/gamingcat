import test from "node:test";
import assert from "node:assert/strict";
import { createBattleState } from "./state.js";
import {
    applyEnemyAttackImpact,
    applyPlayerSkill,
    createEnemyAttack,
    skillEffects,
} from "./rules.js";

test("heavy swing always hits and no skill advertises an accuracy roll", () => {
    const state = createBattleState();
    state.player.stamina = skillEffects[1].staminaCost;

    const result = applyPlayerSkill(state, 1, 0);

    assert.equal(result.damage, 20);
    assert.equal(state.enemy.health, 100);
    assert.equal("accuracy" in skillEffects[1], false);
    assert.equal("hit" in state.playerAttackAnimation, false);
});

test("enemy attacks always deal damage while defense only halves it", () => {
    const state = createBattleState();
    state.player.defending = true;

    createEnemyAttack(state, 0);
    const message = applyEnemyAttackImpact(state);
    const damage = 100 - state.player.health;

    assert.ok([10, 18].includes(damage));
    assert.match(message, /방어/);
    assert.equal(state.player.defending, false);
    assert.equal("hit" in state.enemyAttackAnimation, false);
});
