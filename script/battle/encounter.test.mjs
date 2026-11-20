import test from "node:test";
import assert from "node:assert/strict";
import {
    BATTLE_TUTORIAL_STORAGE_KEY,
    getBattleEncounterKind,
    hasCompletedBattleTutorial,
    markBattleTutorialComplete,
} from "./encounter.js";

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
    };
}

test("new players enter the mole tutorial until they win it", () => {
    const storage = createStorage();
    assert.equal(hasCompletedBattleTutorial(storage), false);
    assert.equal(getBattleEncounterKind(storage), "mole");
    assert.equal(markBattleTutorialComplete(storage), true);
    assert.equal(storage.getItem(BATTLE_TUTORIAL_STORAGE_KEY), "true");
    assert.equal(getBattleEncounterKind(storage), "wolf");
});

test("unavailable storage safely keeps the tutorial encounter", () => {
    const storage = {
        getItem() { throw new Error("storage denied"); },
        setItem() { throw new Error("storage denied"); },
    };
    return import("./encounter.js?storage-denied").then((encounter) => {
        assert.equal(encounter.getBattleEncounterKind(storage), "mole");
        assert.equal(encounter.markBattleTutorialComplete(storage), false);
        assert.equal(encounter.getBattleEncounterKind(storage), "wolf");
    });
});
