import test from "node:test";
import assert from "node:assert/strict";
import {
    getBattleEncounterKind,
    hasCompletedBattleTutorial,
    markBattleTutorialComplete,
} from "./encounter.js";

test("tutorial completion only affects the current page session", async () => {
    const currentPage = await import("./encounter.js?current-page");
    assert.equal(currentPage.hasCompletedBattleTutorial(), false);
    assert.equal(currentPage.getBattleEncounterKind(), "mole");
    assert.equal(currentPage.markBattleTutorialComplete(), true);
    assert.equal(currentPage.getBattleEncounterKind(), "wolf");

    const refreshedPage = await import("./encounter.js?refreshed-page");
    assert.equal(refreshedPage.hasCompletedBattleTutorial(), false);
    assert.equal(refreshedPage.getBattleEncounterKind(), "mole");
});
