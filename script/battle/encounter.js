const TUTORIAL_COMPLETION_KEY = "gamingCatBattleTutorialSeen";

function readTutorialCompletion() {
    try {
        return globalThis.sessionStorage?.getItem(TUTORIAL_COMPLETION_KEY) === "true";
    } catch {
        return false;
    }
}

let sessionTutorialComplete = readTutorialCompletion();

export function hasCompletedBattleTutorial() {
    return sessionTutorialComplete;
}

export function markBattleTutorialComplete() {
    sessionTutorialComplete = true;
    try {
        globalThis.sessionStorage?.setItem(TUTORIAL_COMPLETION_KEY, "true");
    } catch {
        // Keep the in-memory completion for environments without session storage.
    }
    return true;
}

export function resetBattleTutorialCompletion() {
    sessionTutorialComplete = false;
    try {
        globalThis.sessionStorage?.removeItem(TUTORIAL_COMPLETION_KEY);
    } catch {
        // Reset the in-memory completion even when session storage is unavailable.
    }
}

export function getBattleEncounterKind() {
    return hasCompletedBattleTutorial() ? "wolf" : "mole";
}
