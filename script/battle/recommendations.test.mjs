import test from "node:test";
import assert from "node:assert/strict";
import { createBattleState } from "./state.js";
import {
    getDisplayedEnemyActionProbabilities,
    getTurnRecommendation,
} from "./recommendations.js";

test("recommendations become deliberately wrong when tokens reach zero or debt", () => {
    const state = createBattleState();
    const funded = getTurnRecommendation(state, 10);
    const zeroTokens = getTurnRecommendation(state, 0);
    const debt = getTurnRecommendation(state, -5);

    assert.equal(funded.skillIndex, 3);
    assert.equal(zeroTokens.skillIndex, 2);
    assert.equal(debt.skillIndex, 2);
    for (const recommendation of [funded, zeroTokens, debt]) {
        assert.equal(recommendation.action, "skill");
        assert.ok(Number.isInteger(recommendation.skillIndex));
        assert.ok(recommendation.skillIndex >= 0 && recommendation.skillIndex <= 3);
    }
    assert.match(zeroTokens.text, /스태미나가 부족하니까 숨을 고르자/);
    assert.match(debt.text, /엉뚱한 말을/);
});

test("positive tokens keep recommendations legal, while debt can recommend an unaffordable skill", () => {
    const state = createBattleState();
    state.player.stamina = 10;

    assert.equal(getTurnRecommendation(state, 10).skillIndex, 3);
    const confused = getTurnRecommendation(state, 0);
    assert.ok([0, 1].includes(confused.skillIndex));
    assert.ok(state.player.stamina < [20, 30][confused.skillIndex]);
    assert.match(confused.text, /스태미나가 넉넉/);
});

test("displayed enemy probabilities drift farther from reality as debt grows", () => {
    const attack = { attack: 100, recover: 0 };
    assert.deepEqual(getDisplayedEnemyActionProbabilities(attack, 1), attack);
    assert.deepEqual(getDisplayedEnemyActionProbabilities(attack, 0), { attack: 80, recover: 20 });
    assert.deepEqual(getDisplayedEnemyActionProbabilities(attack, -1), { attack: 60, recover: 40 });
    assert.deepEqual(getDisplayedEnemyActionProbabilities(attack, -2), { attack: 40, recover: 60 });
    assert.deepEqual(getDisplayedEnemyActionProbabilities(attack, -4), { attack: 5, recover: 95 });

    assert.deepEqual(
        getDisplayedEnemyActionProbabilities({ attack: 0, recover: 100 }, 0),
        { attack: 20, recover: 80 },
    );
});
