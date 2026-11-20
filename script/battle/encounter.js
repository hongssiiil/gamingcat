let sessionTutorialComplete = false;

export function hasCompletedBattleTutorial() {
    return sessionTutorialComplete;
}

export function markBattleTutorialComplete() {
    sessionTutorialComplete = true;
    return true;
}

export function getBattleEncounterKind() {
    return hasCompletedBattleTutorial() ? "wolf" : "mole";
}
