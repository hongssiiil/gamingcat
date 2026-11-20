export const BATTLE_TUTORIAL_STORAGE_KEY = "gamingcat-battle-tutorial-complete";
let sessionTutorialComplete = false;

export function hasCompletedBattleTutorial(storage) {
    if (sessionTutorialComplete) return true;
    try {
        return (storage ?? globalThis.localStorage)?.getItem(BATTLE_TUTORIAL_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function markBattleTutorialComplete(storage) {
    sessionTutorialComplete = true;
    try {
        (storage ?? globalThis.localStorage)?.setItem(BATTLE_TUTORIAL_STORAGE_KEY, "true");
        return true;
    } catch {
        return false;
    }
}

export function getBattleEncounterKind(storage = globalThis.localStorage) {
    return hasCompletedBattleTutorial(storage) ? "wolf" : "mole";
}
