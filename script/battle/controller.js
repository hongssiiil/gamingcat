import {
    getDisplayedEnemyActionProbabilities,
    getTurnRecommendation,
} from "./recommendations.js?v=36";

export function createBattleController({ state, tokenState, flow, ui, tutorial }) {
    function acceptRecommendation() {
        if (state.controlsLocked) return;
        if (!state.recommendationRevealed) {
            if (!flow.spendToken("recommendation")) return;
            state.recommendationRevealed = true;
            state.currentRecommendation = getTurnRecommendation(
                state,
                tokenState.tokens,
                state.enemyActionProbabilities,
            );
            flow.recordTurnField("recommendation", state.currentRecommendation.text);
        }
        if (state.activeHelpView !== "recommendation") {
            state.activeHelpView = "recommendation";
            ui.showMenuMessage(state.currentRecommendation.text, "recommendation");
            ui.updateBattleActionButtons(state);
            ui.followRecommendationButton.focus();
            return;
        }
        const recommendation = state.currentRecommendation;
        if (!recommendation) return;
        if (tutorial.isBattleTutorialActive()) flow.onRecommendationSelected();
        flow.resolvePlayerSkill(recommendation.skillIndex);
    }

    function revealEnemyProbabilities() {
        if (state.controlsLocked || state.autoBattleEnabled) return;
        if (!state.probabilityRevealed) {
            if (!flow.spendToken("probability")) return;
            state.probabilityRevealed = true;
            state.displayedEnemyActionProbabilities = getDisplayedEnemyActionProbabilities(
                state.enemyActionProbabilities,
                tokenState.tokens,
            );
        }
        state.activeHelpView = "probability";
        const enemyName = state.enemyKind === "mole" ? "두더지" : "늑대";
        ui.showMenuMessage(`${enemyName}의 다음 행동 확률`);
        ui.showEnemyProbability(state.displayedEnemyActionProbabilities);
        ui.updateBattleActionButtons(state);
        ui.probabilityButton.focus();
    }

    function openActionChoices() {
        if (state.controlsLocked) return;
        ui.fightSkillsDialog.hidden = false;
        ui.fightSkillButtons[0].focus();
    }

    function bind() {
        ui.followRecommendationButton.addEventListener("click", acceptRecommendation);
        ui.chooseActionButton.addEventListener("click", openActionChoices);
        ui.probabilityButton.addEventListener("click", revealEnemyProbabilities);
        ui.autoBattleButton.addEventListener("click", flow.toggleAutoBattle);

        ui.fightSkillButtons.forEach((button, index) => {
            button.addEventListener("click", () => flow.onManualSkillSelected(index));
        });

        ui.alternateRunButton.addEventListener("click", flow.attemptEscape);
        ui.actionChoiceCancelButton.addEventListener("click", () => {
            ui.fightSkillsDialog.hidden = true;
            ui.chooseActionButton.focus();
        });

        ui.fightSkillsDialog.addEventListener("click", (event) => {
            if (event.target === ui.fightSkillsDialog) {
                ui.fightSkillsDialog.hidden = true;
                ui.chooseActionButton.focus();
            }
        });

        ui.battleHistoryPreviousButton.addEventListener("click", () => {
            if (state.historyIndex <= 0) return;
            state.historyIndex -= 1;
            ui.renderBattleHistory(state.turnHistory, state.historyIndex);
        });
        ui.battleHistoryNextButton.addEventListener("click", () => {
            if (state.historyIndex >= state.turnHistory.length - 1) return;
            state.historyIndex += 1;
            ui.renderBattleHistory(state.turnHistory, state.historyIndex);
        });

        document.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
            const movementKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
            const isActionMenuOpen = !ui.fightSkillsDialog.hidden;
            const mainActions = [
                ui.followRecommendationButton,
                ui.chooseActionButton,
                ui.probabilityButton,
                ui.autoBattleButton,
            ];
            const isMainActionFocused = mainActions.includes(document.activeElement);

            if (
                ui.battleSection.classList.contains("screen-active")
                && movementKeys.includes(key)
                && (isActionMenuOpen || isMainActionFocused)
            ) {
                const choices = isActionMenuOpen
                    ? [...ui.fightSkillButtons, ...(tutorial.isBattleTutorialActive()
                        ? []
                        : [ui.alternateRunButton, ui.actionChoiceCancelButton])]
                        .filter((button) => !button.disabled)
                    : mainActions.filter((button) => !button.disabled);
                const focusedIndex = choices.indexOf(document.activeElement);
                if (choices.length) {
                    event.preventDefault();
                    const vertical = key === "arrowup" || key === "w" ? -1
                        : key === "arrowdown" || key === "s" ? 1 : 0;
                    const horizontal = key === "arrowleft" || key === "a" ? -1
                        : key === "arrowright" || key === "d" ? 1 : 0;
                    const delta = isActionMenuOpen ? horizontal : vertical || horizontal;
                    const activeIndex = focusedIndex === -1 ? 0 : focusedIndex;
                    if (delta) choices[(activeIndex + delta + choices.length) % choices.length].focus();
                }
            }

            if (event.key === "Escape" && isActionMenuOpen) {
                event.preventDefault();
                ui.fightSkillsDialog.hidden = true;
                ui.chooseActionButton.focus();
            }
        });

        ui.battleLossDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
        });
        ui.battleVictoryDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
        });
        ui.battleVictoryConfirmButton.addEventListener("click", flow.confirmBattleVictory);
        ui.battleLossRetryButton.addEventListener("click", flow.resetBattle);
        ui.battleLossAbandonButton.addEventListener("click", flow.abandonBattle);
    }

    return { bind, acceptRecommendation, revealEnemyProbabilities };
}
