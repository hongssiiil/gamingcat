import test from "node:test";
import assert from "node:assert/strict";
import { BATTLE_STARTING_TOKENS, consumeBattleToken } from "./token.js";

test("Battle recommendation costs two tokens and other help actions cost one", () => {
    const state = { tokens: BATTLE_STARTING_TOKENS, events: [] };

    for (const command of ["recommendation", "probability", "autoTurn"]) {
        assert.equal(consumeBattleToken(state, command), true);
    }

    assert.equal(state.tokens, 6);
    assert.deepEqual(state.events.map((event) => event.cost), [2, 1, 1]);
});

test("Unknown Battle token commands do not charge", () => {
    const state = { tokens: 0, events: [] };

    assert.equal(consumeBattleToken(state, "unknown"), false);
    assert.equal(state.tokens, 0);
    assert.deepEqual(state.events, []);
});
