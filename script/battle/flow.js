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
} from "./rules.js?v=40";
import { getTurnRecommendation } from "./recommendations.js?v=36";
import {
    ENEMY_INITIAL_HEALTH,
    MOLE_INITIAL_HEALTH,
    resetBattleState,
} from "./state.js?v=38";
import { consumeBattleToken, renderBattleTokens, showBattleTokenLoss } from "./token.js?v=38";
import { getBattleEncounterKind } from "./encounter.js?v=3";

export function createBattleFlow({ state, tokenState, ui, navigation, renderer, tutorial, scheduler, music={play(){},stop(){}} }) {
    const battleSounds = {
        hit: new Audio("./sounds/battle-hit.wav"),
        heal: new Audio("./sounds/battle-heal.wav"),
        block: new Audio("./sounds/battle-block.wav"),
        roar: new Audio("./sounds/battle-roar.mp3"),
    };
    Object.values(battleSounds).forEach((sound) => { sound.preload = "auto"; });

    function playBattleSound(name) {
        const sound = battleSounds[name];
        if (!sound) return;
        sound.currentTime = 0;
        sound.playbackRate = name === "roar" ? 1.15 : 1;
        sound.play().catch(() => {});
    }

    function startRoarImpactFeedback() {
        playBattleSound("roar");
        const startedAt = performance.now();
        state.enemyRoarAnimation = { startedAt, duration: 900 };
        state.playerRoarHitUntil = startedAt + 900;
        ui.flashRoarStaminaFeedback();
    }

    function updateBattleMusic() {
        if(state.ended)music.stop(state.enemyKind);
        else music.play(state.enemyKind);
    }

    let tutorialDirectTurnPending = false;
    let tutorialRecommendationTurnPending = false;
    let tutorialAutoTurnPending = false;
    let tutorialAutoPaused = false;
    let enemyActedBeforePlayer = false;

    function getEnemyName() {
        return state.enemyKind === "mole" ? "코코넛 해적" : "해적";
    }

    function setEnemyEncounter(kind) {
        state.enemyKind = kind;
        state.enemy.maxHealth = kind === "mole" ? MOLE_INITIAL_HEALTH : ENEMY_INITIAL_HEALTH;
        state.enemy.health = state.enemy.maxHealth;
        ui.enemyName.textContent = getEnemyName();
        ui.enemyPortrait.src = kind === "mole"
            ? "./images/battle/mole.png"
            : "./images/battle/wolf.png";
        ui.enemyPortrait.alt = `${getEnemyName()} 아이콘`;
        renderer.setBattleEnemy(kind);
    }

    function beginTutorialIfNeeded() {
        tutorial.stopBattleTutorial();
        tutorialDirectTurnPending = false;
        tutorialRecommendationTurnPending = false;
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        enemyActedBeforePlayer = false;
        if (state.enemyKind === "mole" && !tutorial.hasCompletedBattleTutorial?.()) {
            tutorial.startBattleTutorial(tutorial.markBattleTutorialComplete);
        }
        updateBattleMusic();
    }

    function spendToken(command) {
        const tokensBefore = tokenState.tokens;
        const spent = consumeBattleToken(tokenState, command, {
            probabilityAlreadyViewed: command === "recommendation" && state.probabilityRevealed,
        });
        if (spent) {
            navigation.saveTokens?.();
            renderBattleTokens(tokenState.tokens);
            showBattleTokenLoss(tokensBefore - tokenState.tokens);
        }
        return spent;
    }

    function refreshTokens() {
        renderBattleTokens(tokenState.tokens);
    }

    function recordTurnField(field, value) {
        if (!state.currentTurn) return;
        if (field === "outcome" && state.currentTurn.outcome) {
            state.currentTurn.outcome = `${state.currentTurn.outcome} ${value}`;
            if(state.currentTurn.playerChoice && state.enemyKind==='wolf') navigation.saveBattleChoice(state.currentTurn);
            ui.renderBattleHistory(state.turnHistory, state.historyIndex);
            return;
        }
        state.currentTurn[field] = value;
        if(state.currentTurn.playerChoice && state.enemyKind==='wolf') navigation.saveBattleChoice(state.currentTurn);
        ui.renderBattleHistory(state.turnHistory, state.historyIndex);
    }

    function recordTurnDamage(field, amount) {
        if (!state.currentTurn || amount <= 0) return;
        state.currentTurn[field] = (state.currentTurn[field] ?? 0) + amount;
        ui.renderBattleHistory(state.turnHistory, state.historyIndex);
    }

    function beginTurn() {
        enemyActedBeforePlayer = false;
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
        const tutorialOpening = state.enemyKind === "mole" && state.currentTurn.number === 1;
        state.enemyActionProbabilities = tutorialOpening
            ? { attack: 0, recover: 0, defend: 0, roar: 100 }
            : getEnemyActionProbabilities(state);
        state.plannedEnemyAction = tutorialOpening
            ? "roar"
            : chooseEnemyAction(state, Math.random() * 100, state.enemyActionProbabilities);
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

    function resolvePlannedEnemyActionBeforePlayer(continuePlayerAction) {
        if (state.plannedEnemyAction === "defend") {
            state.plannedEnemyAction = null;
            enemyActedBeforePlayer = true;
            defendEnemy(state);
            state.enemyDefenseAnimation = { startedAt: performance.now(), duration: 800 };
            recordTurnField("enemyAction", "방어");
            recordTurnField("outcome", `${getEnemyName()}가 자세를 낮춰 다음 공격의 피해를 줄일 준비를 했다.`);
            ui.showMenuMessage(`${getEnemyName()}가 방어 자세를 취했다. 다음 공격의 피해가 줄어든다.`);
            ui.updateStatusBars(state);
            scheduler.schedule(continuePlayerAction, 760);
            return;
        }

        if (state.plannedEnemyAction !== "roar") {
            continuePlayerAction();
            return;
        }

        state.plannedEnemyAction = null;
        enemyActedBeforePlayer = true;
        const drainedStamina = roarAtPlayer(state);
        startRoarImpactFeedback();
        recordTurnField("enemyAction", "포효");
        recordTurnField("outcome", `${getEnemyName()}의 포효! 플레이어 스태미나 ${drainedStamina} 감소.`);
        ui.showMenuMessage(`${getEnemyName()}의 포효! 스태미나 ${drainedStamina} 감소.`);
        ui.updateStatusBars(state);

        scheduler.schedule(() => {
            if (state.enemyKind === "mole" && state.currentTurn?.number === 1
                && tutorial.isBattleTutorialActive()) {
                tutorial.advanceBattleTutorial("roarLesson", continuePlayerAction);
                return;
            }
            continuePlayerAction();
        }, 900);
    }

    function finishPlayerAction() {
        if (state.enemy.health <= 0) {
            finishBattle(`${getEnemyName()}를 물리쳤다!`);
            return;
        }
        state.enemy.defending = false;
        state.enemyDefenseAnimation = null;
        if (!enemyActedBeforePlayer) {
            startEnemyTurn();
            return;
        }

        enemyActedBeforePlayer = false;
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

    function finishBattle(message, result = "victory") {
        if (state.ended) return;
        if (state.currentTurn && !state.currentTurn.enemyAction) {
            recordTurnField("enemyAction", "행동하지 못함");
        }
        recordTurnField("outcome", message);
        if(state.enemyKind==='wolf'){state.currentTurn.result=result;navigation.saveBattleChoice(state.currentTurn);}
        state.player.defending = false;
        state.enemy.defending = false;
        state.playerDefenseAnimation = null;
        state.enemyDefenseAnimation = null;
        state.ended = true;
        updateBattleMusic();
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        if (state.enemyKind === "mole" && state.enemy.health <= 0) {
            tutorial.markBattleTutorialComplete();
        }
        state.autoBattleEnabled = false;
        ui.setControlsLocked(state, true);
        ui.fightSkillsDialog.hidden = true;
        ui.showMenuMessage(message);
        if (result === "victory") {
            scheduler.cancel();
            ui.openBattleVictoryDialog(message);
            return;
        }
        scheduler.schedule(() => completeBattle(result), 1200);
    }

    function completeBattle(result) {
        exitBattle();
        if(state.enemyKind==='wolf')navigation.onWolfFinished(result);
        else if(navigation.onTutorialFinished)navigation.onTutorialFinished(result);
        else navigation.enterRoad();
    }

    function confirmBattleVictory() {
        if (!state.ended) return;
        ui.closeBattleVictoryDialog();
        completeBattle("victory");
    }

    function showBattleLoss() {
        if (state.ended) return;
        if (state.currentTurn && !state.currentTurn.enemyAction) {
            recordTurnField("enemyAction", "행동하지 못함");
        }
        recordTurnField("outcome", "플레이어의 체력이 0이 되어 전투를 마쳤다.");
        if(state.enemyKind==='wolf'){state.currentTurn.result='defeat';navigation.saveBattleChoice(state.currentTurn);}
        state.player.defending = false;
        state.enemy.defending = false;
        state.playerDefenseAnimation = null;
        state.enemyDefenseAnimation = null;
        state.ended = true;
        updateBattleMusic();
        state.autoBattleEnabled = false;
        tutorialAutoTurnPending = false;
        tutorialAutoPaused = false;
        scheduler.cancel();
        ui.setControlsLocked(state, true);
        ui.fightSkillsDialog.hidden = true;
        state.playerAttackAnimation = null;
        state.enemyAttackAnimation = null;
        ui.openBattleLossDialog(state.enemyKind);
    }

    function endEnemyTurn() {
        state.playerAttackAnimation = null;
        state.enemyAttackAnimation = null;
        state.player.defending = false;
        state.playerDefenseAnimation = null;
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
            const staminaBeforeRecovery = state.enemy.stamina;
            recoverEnemyStamina(state);
            state.enemyRecoveryAnimation = {
                startedAt: performance.now(),
                duration: 800,
                stamina: state.enemy.stamina - staminaBeforeRecovery,
            };
            recordTurnField("enemyAction", "숨을 고름");
            recordTurnField("outcome", `${getEnemyName()}가 숨을 고르며 스태미나를 회복했다.`);
            ui.showMenuMessage(`${getEnemyName()}가 숨을 고르며 스태미나를 회복했다.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 760);
            return;
        }

        if (action === "defend") {
            defendEnemy(state);
            state.enemyDefenseAnimation = { startedAt: performance.now(), duration: 800 };
            recordTurnField("enemyAction", "방어");
            recordTurnField("outcome", `${getEnemyName()}가 자세를 낮춰 다음 공격의 피해를 줄일 준비를 했다.`);
            ui.showMenuMessage(`${getEnemyName()}가 방어 자세를 취했다. 다음 공격의 피해가 줄어든다.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 760);
            return;
        }

        if (action === "roar") {
            const drainedStamina = roarAtPlayer(state);
            startRoarImpactFeedback();
            recordTurnField("enemyAction", "포효");
            recordTurnField("outcome", `${getEnemyName()}의 포효! 플레이어 스태미나 ${drainedStamina} 감소.`);
            ui.showMenuMessage(`${getEnemyName()}의 포효! 스태미나 ${drainedStamina} 감소.`);
            ui.updateStatusBars(state);
            scheduler.schedule(endEnemyTurn, 900);
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
                const wasDefending = state.player.defending;
                const message = applyEnemyAttackImpact(state);
                if (message) {
                    if (state.player.health < previousHealth) {
                        playBattleSound(wasDefending ? "block" : "hit");
                    }
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
        if(state.enemyKind==='wolf')Object.assign(state.currentTurn,{scene:'wolf',action:'skill',recordedAt:Date.now(),tokenUsed:false,
            accepted:state.recommendationRevealed ? state.currentRecommendation?.skillIndex===skillIndex : null});
        recordTurnField("playerChoice", skill.name);
        ui.fightSkillsDialog.hidden = true;
        ui.setControlsLocked(state, true);

        const resolve = () => {
            const enemyWasDefending = state.enemy.defending;
            const result = applyPlayerSkill(state, skillIndex, performance.now());
            if (result.damage > 0) {
                playBattleSound(enemyWasDefending ? "block" : "hit");
            }
            if (result.kind === "recovery") playBattleSound("heal");
            recordTurnDamage("enemyDamageReceived", result.damage ?? 0);
            recordTurnField("outcome", result.message);
            ui.updateStatusBars(state);

            if (result.kind === "insufficient-stamina") {
                ui.flashInsufficientStamina();
                scheduler.schedule(
                    () => ui.showMenuMessage(result.message),
                    ui.STAMINA_ERROR_FEEDBACK_MS,
                );
                scheduler.schedule(finishPlayerAction, 800);
                return;
            }

            ui.showMenuMessage(result.message);
            if (result.kind === "attack") {
                scheduler.schedule(
                    finishPlayerAction,
                    (result.skill.name === "일반 공격" ? 240 : 520) + 500,
                );
            } else if (result.kind === "recovery") {
                scheduler.schedule(finishPlayerAction, 1020);
            } else if (result.kind === "defense") {
                scheduler.schedule(finishPlayerAction, 760);
            }
        };

        resolvePlannedEnemyActionBeforePlayer(() => {
            if (skill.damage > 0 && state.player.stamina >= skill.staminaCost) {
                scheduler.schedule(resolve, 300);
            } else {
                resolve();
            }
        });
    }

    function attemptEscape() {
        if (state.controlsLocked) return;
        if(state.enemyKind==='wolf')Object.assign(state.currentTurn,{scene:'wolf',action:'run',recordedAt:Date.now(),tokenUsed:false,accepted:null});
        recordTurnField("playerChoice", "도망 시도");
        ui.fightSkillsDialog.hidden = true;
        ui.setControlsLocked(state, true);
        resolvePlannedEnemyActionBeforePlayer(() => {
            ui.showMenuMessage("도망을 시도한다.");
            scheduler.schedule(() => {
                if (Math.random() < 0.8) {
                    recordTurnField("outcome", "도망에 실패했다.");
                    ui.showMenuMessage("도망치는데 실패했다...");
                    scheduler.schedule(finishPlayerAction, 500);
                    return;
                }
                finishBattle("무사히 도망쳤다!", "escape");
            }, 1000);
        });
    }

    function runAutoBattleTurn() {
        if (!state.autoBattleEnabled || state.controlsLocked || state.ended) return;
        if (!spendToken("autoTurn")) {
            state.autoBattleEnabled = false;
            ui.setControlsLocked(state, false);
            ui.showMenuMessage("자동전투를 진행할 수 없어 멈췄어.");
            return;
        }

        if (tokenState.tokens <= 0) {
            const availableSkills = skillEffects
                .map((skill, index) => ({ skill, index }))
                .filter(({ skill }) => state.player.stamina >= skill.staminaCost);
            const randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            state.currentRecommendation = null;
            recordTurnField("recommendation", "토큰 부족으로 무작위 선택");
            resolvePlayerSkill(randomSkill.index, true);
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
        refreshTokens();
        resetBattleState(state);
        setEnemyEncounter(state.enemyKind);
        ui.setControlsLocked(state, false);
        ui.fightSkillsDialog.hidden = true;
        ui.updateStatusBars(state);
        ui.enterBattleScreen();
        beginTutorialIfNeeded();
        showTurnRecommendation();
    }

    function abandonBattle() {
        if (!state.ended) return;
        ui.closeBattleLossDialog();
        state.ended = false;
        finishBattle("무사히 도망쳤다!", "escape");
    }

    async function enterBattle(encounterKind) {
        refreshTokens();
        const battleKind = encounterKind ?? (state.started && !state.ended ? state.enemyKind : getBattleEncounterKind());
        await renderer.setBattleBackground(navigation.getCurrentRoadBattleBackground(battleKind));
        ui.playerStatusName.textContent = "나";
        ui.enterBattleScreen();
        ui.followRecommendationButton.focus();
        if (encounterKind || !state.started || state.ended) {
            scheduler.cancel();
            refreshTokens();
            setEnemyEncounter(battleKind);
            resetBattleState(state);
            ui.updateStatusBars(state);
            beginTutorialIfNeeded();
            showTurnRecommendation();
        }
        updateBattleMusic();
    }

    function exitBattle() {
        tutorial.stopBattleTutorial();
        music.stop(state.enemyKind);
        ui.exitBattleScreen();
    }

    return {
        attemptEscape,
        abandonBattle,
        enterBattle,
        exitBattle,
        onManualSkillSelected,
        onRecommendationSelected,
        confirmBattleVictory,
        recordTurnField,
        resetBattle,
        resolvePlayerSkill,
        runAutoBattleTurn,
        spendToken,
        toggleAutoBattle,
    };
}
