import test from "node:test";
import assert from "node:assert/strict";
import { BATTLE_STARTING_TOKENS, consumeBattleToken } from "./token.js";

test("Battle starts with thirty tokens; recommendation, probability and auto costs apply", () => {
    const state = { tokens: BATTLE_STARTING_TOKENS, events: [] };

    assert.equal(BATTLE_STARTING_TOKENS, 30);
    assert.equal(consumeBattleToken(state, "recommendation"), true);
    assert.equal(consumeBattleToken(state, "probability"), true);
    assert.equal(consumeBattleToken(state, "recommendation", { probabilityAlreadyViewed: true }), true);
    assert.equal(consumeBattleToken(state, "autoTurn"), true);

    assert.equal(state.tokens, 24);
    assert.deepEqual(state.events.map((event) => event.cost), [2, 1, 1, 2]);
});

test("recommendation costs one token after this turn's probabilities were viewed", () => {
    const state = { tokens: BATTLE_STARTING_TOKENS, events: [] };
    assert.equal(consumeBattleToken(state, "probability"), true);
    assert.equal(consumeBattleToken(state, "recommendation", { probabilityAlreadyViewed: true }), true);
    assert.deepEqual(state.events.map((event) => event.cost), [1, 1]);
    assert.equal(state.tokens, 28);
});

test("Unknown Battle token commands do not charge", () => {
    const state = { tokens: 0, events: [] };

    assert.equal(consumeBattleToken(state, "unknown"), false);
    assert.equal(state.tokens, 0);
    assert.deepEqual(state.events, []);
});
