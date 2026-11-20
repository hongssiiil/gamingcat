import {
    applyEnemyAttackImpact,
    applyPlayerSkill,
    chooseEnemyAction,
    createEnemyAttack,
    defendEnemy,
    getEnemyActionProbabilities,
    recoverEnemyStamina,
    roarAtPlayer,
    skillEffects,
    spendEnemyStamina,
} from "./rules.js?v=39";
import { getTurnRecommendation } from "./recommendations.js?v=36";
import {
    ENEMY_INITIAL_HEALTH,
    MOLE_INITIAL_HEALTH,
    resetBattleState,
} from "./state.js?v=37";
import { BATTLE_STARTING_TOKENS, consumeBattleToken, renderBattleTokens } from "./token.js?v=37";
import { getBattleEncounterKind } from "./encounter.js?v=2";

export function createBattleFlow({ state, tokenState, ui, navigation, renderer, tutorial, scheduler }) {
    let tutorialDirectTurnPending = false;
    let tutorialRecommendationTurnPending = false;
    let tutorialAutoTurnPending = false;
    let tutorialAutoPaused = false;

    function getEnemyName() {
        return state.enemyKind === "mole" ? "두더지" : "늑대";
    }

    function setEnemyEncounter(kind) {
        state.enemyKind = kind;
        state.enemy.maxHealth = kind === "mole" ? MOLE_INITIAL_HEALTH : ENEMY_INITIAL_HEALTH;
        state.enemy.health = state.enemy.maxHealth;
        ui.enemyName.textContent = getEnemyName();
        ui.enemyPortrait.src = kind === "mole"
            ? "./images/battle/mole.png"
            : "./images/character/wolf_icon.png";
        ui.enemyPortrait.alt = `${getEnemyName()} 아이콘`;
        renderer.setBattleEnemy(kind);
    }

    function beginTutorialIfNeeded() {
        tutorialDirectTurnPending = false;
        tutorialRecommendationTurnPending = false;
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        if (state.enemyKind === "mole") tutorial.startBattleTutorial();
    }

    function spendToken(command) {
        const spent = consumeBattleToken(tokenState, command, {
            probabilityAlreadyViewed: command === "recommendation" && state.probabilityRevealed,
        });
        if (spent) renderBattleTokens(tokenState.tokens);
        return spent;
    }

    function refillTokens() {
        tokenState.tokens = BATTLE_STARTING_TOKENS;
        tokenState.events = [];
        renderBattleTokens(tokenState.tokens);
    }

    function recordTurnField(field, value) {
        if (!state.currentTurn) return;
        if (field === "outcome" && state.currentTurn.outcome) {
            state.currentTurn.outcome = `${state.currentTurn.outcome} ${value}`;
            ui.renderBattleHistory(state.turnHistory, state.historyIndex);
            return;
        }
        state.currentTurn[field] = value;
        ui.renderBattleHistory(state.turnHistory, state.historyIndex);
    }

    function recordTurnDamage(field, amount) {
        if (!state.currentTurn || amount <= 0) return;
        state.currentTurn[field] = (state.currentTurn[field] ?? 0) + amount;
        ui.renderBattleHistory(state.turnHistory, state.historyIndex);
    }

    function beginTurn() {
        state.recommendationRevealed = false;
        state.probabilityRevealed = false;
        state.activeHelpView = "prompt";
        state.currentTurn = {
            number: state.turnHistory.length + 1,
            recommendation: "",
            playerChoice: "",
            enemyAction: "",
            playerDamageReceived: 0,
            enemyDamageReceived: 0,
            outcome: "",
        };
        state.turnHistory.push(state.currentTurn);
        state.historyIndex = state.turnHistory.length - 1;
        state.enemyActionProbabilities = getEnemyActionProbabilities(state);
        state.plannedEnemyAction = chooseEnemyAction(
            state,
            Math.random() * 100,
            state.enemyActionProbabilities,
        );
        state.currentRecommendation = getTurnRecommendation(
            state,
            tokenState.tokens,
            state.enemyActionProbabilities,
        );
        state.displayedEnemyActionProbabilities = null;
        ui.renderBattleHistory(state.turnHistory, state.historyIndex);
        ui.showEnemyProbability();
        ui.showMenuMessage("어떤 행동을 할까?");
        ui.updateBattleActionButtons(state);
    }

    function showTurnRecommendation() {
        beginTurn();
        if (state.autoBattleEnabled && !tutorialAutoPaused) scheduler.schedule(runAutoBattleTurn, 120);
    }

    function finishBattle(message) {
        if (state.ended) return;
        if (state.currentTurn && !state.currentTurn.enemyAction) {
            recordTurnField("enemyAction", "행동하지 못함");
        }
        recordTurnField("outcome", message);
        state.player.defending = false;
        state.enemy.defending = false;
        state.ended = true;
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        if (state.enemyKind === "mole" && state.enemy.health <= 0) {
            tutorial.markBattleTutorialComplete();
        }
        state.autoBattleEnabled = false;
        ui.setControlsLocked(state, true);
        ui.fightSkillsDialog.hidden = true;
        ui.showMenuMessage(message);
        scheduler.schedule(() => {
            exitBattle();
            navigation.enterRoad();
        }, 1200);
    }

    function showBattleLoss() {
        if (state.ended) return;
        if (state.currentTurn && !state.currentTurn.enemyAction) {
            recordTurnField("enemyAction", "행동하지 못함");
        }
        recordTurnField("outcome", "플레이어의 체력이 0이 되어 전투를 마쳤다.");
        state.player.defending = false;
        state.enemy.defending = false;
        state.ended = true;
        state.autoBattleEnabled = false;
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        scheduler.cancel();
        ui.setControlsLocked(state, true);
        ui.fightSkillsDialog.hidden = true;
        state.playerAttackAnimation = null;
        state.enemyAttackAnimation = null;
        ui.openBattleLossDialog();
    }

    function endEnemyTurn() {
        state.playerAttackAnimation = null;
        state.enemyAttackAnimation = null;
        state.player.defending = false;
        if (state.player.health <= 0) {
            showBattleLoss();
            return;
        }
        if (tutorialAutoTurnPending) {
            tutorialAutoTurnPending = false;
            tutorialAutoPaused = true;
            showTurnRecommendation();
            ui.setControlsLocked(state, false);
            ui.showMenuMessage("자동전투를 잠시 멈췄어. 중지 버튼을 눌러 봐.");
            ui.autoBattleButton.focus();
            tutorial.advanceBattleTutorial("automaticStop");
            return;
        }
        showTurnRecommendation();
        ui.setControlsLocked(state, false);
        ui.followRecommendationButton.focus();
        if (tutorialDirectTurnPending) {
            tutorialDirectTurnPending = false;
            tutorial.advanceBattleTutorial("automatic");
        }
        if (tutorialRecommendationTurnPending) {
            tutorialRecommendationTurnPending = false;
            tutorial.advanceBattleTutorial("choose");
        }
    }

    function startEnemyTurn() {
        if (state.enemy.health <= 0) {
            finishBattle(`${getEnemyName()}를 물리쳤다!`);
            return;
        }
        if (state.player.health <= 0) {
            showBattleLoss();
            return;
        }

        const action = state.plannedEnemyAction ?? chooseEnemyAction(
            state,
            Math.random() * 100,
            state.enemyActionProbabilities ?? getEnemyActionProbabilities(state),
        );
        state.plannedEnemyAction = null;
        if (action === "recover") {
            recoverEnemyStamina(state);
            recordTurnField("enemyAction", "숨을 고름");
            recordTurnField("outcome", `${getEnemyName()}가 숨을 고르며 스태미나를 회복했다.`);
            ui.showMenuMessage(`${getEnemyName()}가 숨을 고르며 스태미나를 회복했다.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 520);
            return;
        }

        if (action === "defend") {
            defendEnemy(state);
            recordTurnField("enemyAction", "방어");
            recordTurnField("outcome", `${getEnemyName()}가 자세를 낮춰 다음 공격의 피해를 줄일 준비를 했다.`);
            ui.showMenuMessage(`${getEnemyName()}가 방어 자세를 취했다. 다음 공격의 피해가 줄어든다.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 520);
            return;
        }

        if (action === "roar") {
            const drainedStamina = roarAtPlayer(state);
            recordTurnField("enemyAction", "포효");
            recordTurnField("outcome", `${getEnemyName()}의 포효! 플레이어 스태미나 ${drainedStamina} 감소.`);
            ui.showMenuMessage(`${getEnemyName()}의 포효! 스태미나 ${drainedStamina} 감소.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 620);
            return;
        }

        spendEnemyStamina(state);
        recordTurnField("enemyAction", "공격");
        ui.showMenuMessage(`${getEnemyName()}의 공격!`);
        ui.updateStatusBars(state);
        scheduler.schedule(() => {
            createEnemyAttack(state, performance.now());
            scheduler.schedule(() => {
                const previousHealth = state.player.health;
                const message = applyEnemyAttackImpact(state);
                if (message) {
                    recordTurnDamage("playerDamageReceived", previousHealth - state.player.health);
                    recordTurnField("outcome", message);
                    ui.showMenuMessage(message);
                    ui.updateStatusBars(state);
                }
            }, 85);
            scheduler.schedule(endEnemyTurn, 170 + 800);
        }, 600);
    }

    function resolvePlayerSkill(skillIndex, automatic = false) {
        if (state.controlsLocked && !automatic) return;
        const skill = skillEffects[skillIndex];
        if (!skill) return;
        recordTurnField("playerChoice", skill.name);
        ui.fightSkillsDialog.hidden = true;
        ui.setControlsLocked(state, true);

        const resolve = () => {
            const result = applyPlayerSkill(state, skillIndex, performance.now());
            recordTurnDamage("enemyDamageReceived", result.damage ?? 0);
            recordTurnField("outcome", result.message);
            ui.updateStatusBars(state);

            if (result.kind === "insufficient-stamina") {
                ui.flashInsufficientStamina();
                scheduler.schedule(
                    () => ui.showMenuMessage(result.message),
                    ui.STAMINA_ERROR_FEEDBACK_MS,
                );
                scheduler.schedule(startEnemyTurn, 800);
                return;
            }

            ui.showMenuMessage(result.message);
            if (result.kind === "attack") {
                scheduler.schedule(
                    startEnemyTurn,
                    (result.skill.name === "일반 공격" ? 170 : 430) + 500,
                );
            } else if (result.kind === "recovery") {
                scheduler.schedule(startEnemyTurn, 1020);
            } else if (result.kind === "defense") {
                scheduler.schedule(startEnemyTurn, 520);
            }
        };

        if (skill.damage > 0 && state.player.stamina >= skill.staminaCost) {
            scheduler.schedule(resolve, 300);
        } else {
            resolve();
        }
    }

    function attemptEscape() {
        if (state.controlsLocked) return;
        recordTurnField("playerChoice", "도망 시도");
        ui.fightSkillsDialog.hidden = true;
        ui.setControlsLocked(state, true);
        ui.showMenuMessage("도망을 시도한다.");
        scheduler.schedule(() => {
            if (Math.random() < 0.8) {
                recordTurnField("outcome", "도망에 실패했다.");
                ui.showMenuMessage("도망치는데 실패했다...");
                scheduler.schedule(startEnemyTurn, 500);
                return;
            }
            finishBattle("무사히 도망쳤다!");
        }, 1000);
    }

    function runAutoBattleTurn() {
        if (!state.autoBattleEnabled || state.controlsLocked || state.ended) return;
        if (!spendToken("autoTurn")) {
            state.autoBattleEnabled = false;
            ui.setControlsLocked(state, false);
            ui.showMenuMessage("자동전투를 진행할 수 없어 멈췄어.");
            return;
        }

        const recommendation = getTurnRecommendation(
            state,
            tokenState.tokens,
            state.enemyActionProbabilities,
        );
        state.currentRecommendation = recommendation;
        recordTurnField("recommendation", recommendation.text);
        resolvePlayerSkill(recommendation.skillIndex, true);
    }

    function toggleAutoBattle() {
        if (state.ended) return;
        if (state.autoBattleEnabled) {
            state.autoBattleEnabled = false;
            tutorialAutoPaused = false;
            ui.setControlsLocked(state, state.controlsLocked);
            ui.showMenuMessage("자동전투를 멈췄어. 다음 행동을 골라 줘.");
            return;
        }
        if (state.controlsLocked) return;
        state.autoBattleEnabled = true;
        if (tutorial.isBattleTutorialActive()) tutorialAutoTurnPending = true;
        ui.setControlsLocked(state, false);
        ui.showMenuMessage("자동전투를 시작할게. 매 턴 2토큰을 사용할게.");
        scheduler.schedule(runAutoBattleTurn, 120);
    }

    function onManualSkillSelected(skillIndex) {
        if (tutorial.isBattleTutorialActive() && !state.autoBattleEnabled) {
            tutorialDirectTurnPending = true;
        }
        resolvePlayerSkill(skillIndex);
    }

    function onRecommendationSelected() {
        if (tutorial.isBattleTutorialActive()) tutorialRecommendationTurnPending = true;
    }

    function resetBattle() {
        scheduler.cancel();
        ui.closeBattleLossDialog();
        refillTokens();
        resetBattleState(state);
        setEnemyEncounter(state.enemyKind);
        ui.setControlsLocked(state, false);
        ui.fightSkillsDialog.hidden = true;
        ui.updateStatusBars(state);
        ui.enterBattleScreen();
        beginTurn();
        ui.followRecommendationButton.focus();
        beginTutorialIfNeeded();
    }

    async function enterBattle() {
        await renderer.setBattleBackground(navigation.getCurrentRoadBattleBackground());
        ui.playerStatusName.textContent = "나";
        ui.enterBattleScreen();
        ui.followRecommendationButton.focus();
        if (!state.started || state.ended) {
            refillTokens();
            setEnemyEncounter(getBattleEncounterKind());
            resetBattleState(state);
            ui.updateStatusBars(state);
            beginTurn();
            beginTutorialIfNeeded();
        }
    }

    function exitBattle() {
        ui.exitBattleScreen();
    }

    return {
        attemptEscape,
        enterBattle,
        exitBattle,
        onManualSkillSelected,
        onRecommendationSelected,
        recordTurnField,
        resetBattle,
        resolvePlayerSkill,
        runAutoBattleTurn,
        spendToken,
        toggleAutoBattle,
    };
}
