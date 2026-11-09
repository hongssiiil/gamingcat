import { enterRoad } from "./road.js";

const battleSection = document.querySelector("#Battle");

export function enterBattle() {
    battleSection.classList.replace("screen", "screen-active");
    if (!battleStarted) {
        battleStarted = true;
        showOpeningRecommendation();
    }
}

export function exitBattle() {
    battleSection.classList.replace("screen-active", "screen");
}

const canvas = document.getElementById("battle-canvas");
const ctx = canvas.getContext("2d");
const menuSection = document.querySelector(".menu-section");
const menuText = document.getElementById("ai-recommendation");
const fightButton = document.getElementById("fight-button");
const bagButton = document.getElementById("bag-button");
const runButton = document.getElementById("run-button");
const fightSkillsDialog = document.getElementById("fight-skills-dialog");
const battleLossDialog = document.getElementById("battle-loss-dialog");
const battleLossConfirmButton = document.getElementById("battle-loss-confirm");
const fightSkillButtons = fightSkillsDialog.querySelectorAll(".fight-skill-button");
const enemyStatus = document.getElementById("enemy-status");
const playerStatus = document.getElementById("player-status");

let window_w;
let window_h;
let scale_w;
let scale_h;
let offset_x;
let offset_y;
const base_w = 1440;
const base_h = 778;

// 이미지 로드
const battleBackground = new Image();
battleBackground.src = "./images/battle/battle_bg.png";
const playerBase = new Image();
playerBase.src = "./images/battle/playerBase.png";
const enemyBase = new Image();
enemyBase.src = "./images/battle/enemyBase.png";
const player = new Image();
player.src = "./images/character/player/player_diagonal.png";
const enemy = new Image();
enemy.src = "./images/battle/wolf.png";
const cat = new Image();
cat.src = "./images/character/cat/cat_diagonal.png";

class Entity {
    constructor({ sprites, health, stamina }) {
        this.sprites = sprites;
        this.health = health;
        this.maxHealth = health;
        this.stamina = stamina;
        this.maxStamina = stamina;
    }

    drawSprite(ctx, image, x, y, scale) {
        if (!image.complete || !image.naturalWidth) return;
        ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
    }

    draw(ctx) {
        for (const sprite of this.sprites) {
            this.drawSprite(
                ctx,
                sprite.image,
                sprite.x + (sprite.offsetX || 0),
                sprite.y + (sprite.offsetY || 0),
                sprite.scale * (sprite.scaleMultiplier || 1),
            );
        }
    }
}

const battleEnemy = new Entity({
    sprites: [{ image: enemy, x: base_w * 0.57, y: base_h * 0.17, scale: 0.24 }],
    health: 100,
    stamina: 100,
});

const battlePlayer = new Entity({
    sprites: [
        { image: player, x: base_w * 0.16, y: base_h * 0.38, scale: 0.24 },
        { image: cat, x: base_w * 0.28, y: base_h * 0.58, scale: 0.15 },
    ],
    health: 100,
    stamina: 100,
});

let playerAttackAnimation = null;
let playerRestFlashUntil = 0;
let enemyAttackAnimation = null;
let playerHitFlashUntil = 0;
let battleControlsLocked = false;
let battleEnded = false;
let battleStarted = false;
let recommendationFollowCount = 0;
let currentRecommendation = null;
const battleTimeouts = new Set();

const wolfBaseDamage = 15;
const wolfCriticalDamage = 25;
const wolfBaseAccuracy = 70;
const wolfBaseCriticalChance = 30;

function scheduleBattleTimeout(callback, delay) {
    const timeoutId = window.setTimeout(() => {
        battleTimeouts.delete(timeoutId);
        callback();
    }, delay);
    battleTimeouts.add(timeoutId);
    return timeoutId;
}

function clearBattleTimeouts() {
    battleTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    battleTimeouts.clear();
}

function showOpeningRecommendation() {
    currentRecommendation = {
        action: "run",
        text: "도망가자! 이길 수 있는 상대가 아니야!",
    };
    menuText.textContent = currentRecommendation.text;
}

function getTurnRecommendation() {
    const stamina = battlePlayer.stamina;
    const playerHealth = battlePlayer.health;
    const enemyHealth = battleEnemy.health;
    const enemyStamina = battleEnemy.stamina;
    let recommendation;

    if (stamina < 30 && enemyHealth > 20) {
        recommendation = { skillIndex: 1, text: "아직 힘이 남아 있을 때 몰아붙이자! 힘껏 휘두르기!" };
    } else if (stamina < 30 && enemyHealth <= 20) {
        recommendation = { skillIndex: 1, text: "마지막 기회야! 힘껏 휘둘러서 끝내자!" };
    } else if (enemyHealth <= 20) {
        recommendation = { skillIndex: 2, text: "다음 공격을 위해 숨을 고르자!" };
    } else if (playerHealth <= 20) {
        recommendation = { skillIndex: 1, text: "위험해지기 전에 힘껏 휘둘러 끝내자!" };
    } else if (enemyStamina < 30) {
        recommendation = { skillIndex: 1, text: "늑대가 지친 지금, 힘껏 휘두르자!" };
    } else if (stamina >= 80) {
        recommendation = { skillIndex: 2, text: "스태미나가 넉넉하니까 숨을 고르고 더 채워 두자!" };
    } else if (stamina >= 50) {
        recommendation = { skillIndex: 1, text: "큰 한 방이면 전세를 뒤집을 수 있어! 힘껏 휘두르자!" };
    } else if (stamina >= 30 && enemyHealth > 40) {
        recommendation = { skillIndex: 1, text: "지금은 아껴서 공격할 때가 아니야! 힘껏 휘두르자!" };
    } else if (playerHealth <= 35 && enemyHealth <= 40) {
        recommendation = { skillIndex: 0, text: "조금만 더 버티면 돼. 일반 공격으로 압박하자!" };
    } else {
        recommendation = { skillIndex: 0, text: "안전하게 일반 공격으로 조금씩 압박하자!" };
    }

    const skill = skillEffects[recommendation.skillIndex];
    if (skill.damage > 0 && skill.damage >= enemyHealth) {
        if (enemyHealth > skillEffects[0].damage) {
            recommendation = {
                skillIndex: 0,
                text: "일반 공격으로 조금씩 압박하자!",
            };
        } else {
            recommendation = {
                skillIndex: 2,
                text: "여유를 갖고 숨을 고르자!",
            };
        }
    }

    if (
        recommendation.skillIndex === 2
        && stamina >= battlePlayer.maxStamina
        && enemyHealth > skillEffects[0].damage
    ) {
        recommendation = {
            skillIndex: 0,
            text: "일반 공격으로 조금씩 압박하자!",
        };
    }

    return {
        action: "skill",
        skillIndex: recommendation.skillIndex,
        text: recommendation.text,
    };
}

function showTurnRecommendation() {
    currentRecommendation = getTurnRecommendation();
    menuText.textContent = currentRecommendation.text;
}

function followRecommendationIfMatched(action, skillIndex) {
    const matched = currentRecommendation?.action === action
        && (action !== "skill" || currentRecommendation.skillIndex === skillIndex);
    if (matched) recommendationFollowCount += 1;
    return matched;
}

function resetBattle() {
    clearBattleTimeouts();
    if (battleLossDialog.open) battleLossDialog.close();

    battlePlayer.health = battlePlayer.maxHealth;
    battlePlayer.stamina = battlePlayer.maxStamina;
    battleEnemy.health = battleEnemy.maxHealth;
    battleEnemy.stamina = battleEnemy.maxStamina;
    playerAttackAnimation = null;
    enemyAttackAnimation = null;
    playerRestFlashUntil = 0;
    playerHitFlashUntil = 0;
    battleEnded = false;
    recommendationFollowCount = 0;
    setBattleControlsLocked(false);
    fightSkillsDialog.hidden = true;
    updateStatusBars();
    enterBattle();
    showOpeningRecommendation();
    runButton.focus();
}

function setBattleControlsLocked(locked) {
    battleControlsLocked = locked;
    fightButton.disabled = locked;
    bagButton.disabled = locked;
    runButton.disabled = locked;
    fightSkillButtons.forEach((button) => {
        button.disabled = locked;
    });
}

function finishBattle(message) {
    if (battleEnded) return;
    battleEnded = true;
    setBattleControlsLocked(true);
    fightSkillsDialog.hidden = true;
    menuText.textContent = message;
    scheduleBattleTimeout(() => {
        exitBattle();
        enterRoad();
    }, 1200);
}

function showBattleLoss() {
    if (battleEnded) return;
    battleEnded = true;
    clearBattleTimeouts();
    setBattleControlsLocked(true);
    fightSkillsDialog.hidden = true;
    enemyAttackAnimation = null;
    battleLossDialog.showModal();
    battleLossConfirmButton.focus();
}

function animatePlayerAttack(skill, hit) {
    if (skill.staminaRecovery || skill.healthRecovery || !skill.damage) return;
    playerAttackAnimation = {
        startedAt: performance.now(),
        duration: skill.name === "일반 공격" ? 170 : 430,
        heavy: skill.name !== "일반 공격",
        hit,
    };
}

function startEnemyTurn() {
    if (battleEnemy.health <= 0) {
        finishBattle("늑대를 물리쳤다!");
        return;
    }
    if (battlePlayer.health <= 0) {
        showBattleLoss();
        return;
    }

    const enemyAttackCost = 30;
    if (battleEnemy.stamina < enemyAttackCost) {
        battleEnemy.stamina = Math.min(battleEnemy.maxStamina, battleEnemy.stamina + enemyAttackCost * 1.5);
        menuText.textContent = "늑대가 숨을 고르며 스태미나를 회복했다.";
        updateStatusBars();
        scheduleBattleTimeout(() => {
            if (battlePlayer.health <= 0) {
                showBattleLoss();
                return;
            }
            showTurnRecommendation();
            setBattleControlsLocked(false);
            fightButton.focus();
        }, 520);
        return;
    }

    battleEnemy.stamina -= enemyAttackCost;
    menuText.textContent = "늑대의 공격!";
    updateStatusBars();
    scheduleBattleTimeout(() => {
        const accuracy = Math.min(100, wolfBaseAccuracy + recommendationFollowCount * 5);
        const criticalChance = Math.min(70, wolfBaseCriticalChance + recommendationFollowCount * 5);
        const hit = Math.random() * 100 < accuracy;
        enemyAttackAnimation = {
            startedAt: performance.now(),
            impactApplied: false,
            hit,
            critical: hit && Math.random() * 100 < criticalChance,
        };
        scheduleBattleTimeout(() => {
            enemyAttackAnimation = null;
            if (battlePlayer.health <= 0) {
                showBattleLoss();
            } else {
                showTurnRecommendation();
                setBattleControlsLocked(false);
                fightButton.focus();
            }
        }, 170 + 800);
    }, 600);
}

fightButton.addEventListener("click", () => {
    fightSkillsDialog.hidden = false;
    fightSkillButtons[0].focus();
});

const skillEffects = [
    { name: "일반 공격", damage: 10, staminaCost: 20, accuracy: 100 },
    { name: "힘껏 휘두르기", damage: 20, staminaCost: 30, accuracy: 70 },
    {
        name: "숨 고르기",
        damage: 0,
        staminaCost: 0,
        accuracy: 100,
        staminaRecovery: 40,
        healthRecovery: 10,
    },
];

fightSkillButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
        const skill = skillEffects[index];
        if (battleControlsLocked) return;
        if (!skill) return;
        followRecommendationIfMatched("skill", index);
        if (battlePlayer.stamina < skill.staminaCost) {
            fightSkillsDialog.hidden = true;
            setBattleControlsLocked(true);
            menuText.textContent = `${skill.name}! 스태미나가 부족해 실패했다...`;
            scheduleBattleTimeout(() => {
                startEnemyTurn();
            }, 800);
            return;
        }

        fightSkillsDialog.hidden = true;

        const resolveSkill = () => {
            battlePlayer.stamina -= skill.staminaCost;
            const previousHealth = battlePlayer.health;
            const previousStamina = battlePlayer.stamina;
            if (skill.staminaRecovery || skill.healthRecovery) {
                playerRestFlashUntil = performance.now() + 520;
            }
            const hit = Math.random() * 100 < skill.accuracy;
            animatePlayerAttack(skill, hit);
            if (hit) {
                battleEnemy.health = Math.max(0, battleEnemy.health - skill.damage);
            }
            if (skill.staminaRecovery) {
                battlePlayer.stamina = Math.min(
                    battlePlayer.maxStamina,
                    battlePlayer.stamina + skill.staminaRecovery,
                );
            }
            if (skill.healthRecovery) {
                battlePlayer.health = Math.min(
                    battlePlayer.maxHealth,
                    battlePlayer.health + skill.healthRecovery,
                );
            }

            const recoveredHealth = battlePlayer.health - previousHealth;
            const recoveredStamina = battlePlayer.stamina - previousStamina;

            menuText.textContent = !hit
                ? `${skill.name}! 빗나갔다...`
                : skill.staminaRecovery || skill.healthRecovery
                    ? `${skill.name}! 체력 ${recoveredHealth}, 스태미나 ${recoveredStamina} 회복했다.`
                    : `${skill.name}! 적에게 ${skill.damage} 피해를 줬다.`;
            updateStatusBars();

            if (skill.damage > 0) {
                scheduleBattleTimeout(() => {
                    startEnemyTurn();
                }, (skill.name === "일반 공격" ? 170 : 430) + 500);
            } else if (skill.staminaRecovery || skill.healthRecovery) {
                scheduleBattleTimeout(() => {
                    startEnemyTurn();
                }, 1020);
            } else {
                setBattleControlsLocked(false);
                fightButton.focus();
            }
        };

        if (skill.damage > 0) {
            setBattleControlsLocked(true);
            scheduleBattleTimeout(resolveSkill, 300);
        } else if (skill.staminaRecovery) {
            setBattleControlsLocked(true);
            resolveSkill();
        } else {
            resolveSkill();
            fightButton.focus();
        }
    });
});

fightSkillsDialog.addEventListener("click", (event) => {
    if (event.target === fightSkillsDialog) {
        fightSkillsDialog.hidden = true;
        fightButton.focus();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !fightSkillsDialog.hidden) {
        fightSkillsDialog.hidden = true;
        fightButton.focus();
    }
});

battleLossDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
});

battleLossConfirmButton.addEventListener("click", resetBattle);

bagButton.addEventListener("click", () => {
    if (battleControlsLocked) return;
    // 가방 버튼 클릭 시 동작
    console.log("가방 버튼 클릭됨");
    menuText.textContent = "가방을 열어서 뭐하게?";
});

runButton.addEventListener("click", () => {
    if (battleControlsLocked) return;
    followRecommendationIfMatched("run");
    // 도망가기 버튼 클릭 시 동작
    console.log("도망가기 버튼 클릭됨");
    setBattleControlsLocked(true);
    menuText.textContent = "도망을 시도한다.";
    scheduleBattleTimeout(() => {
        menuText.textContent = "도망치는데 실패했다...";
        scheduleBattleTimeout(() => {
            startEnemyTurn();
        }, 500);
    }, 1000);
});

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    window_w = window.innerWidth;
    window_h = window.innerHeight;
    const fitScale = Math.min(window_w / base_w, window_h / base_h);
    scale_w = fitScale;
    scale_h = fitScale;
    offset_x = (window_w - base_w * fitScale) / 2;
    offset_y = (window_h - base_h * fitScale) / 2;

    // Keep the menu anchored at y=544 in the 1440x778 game coordinate space.
    menuSection.style.left = `${offset_x}px`;
    menuSection.style.top = `${offset_y + 544 * fitScale}px`;
    menuSection.style.width = `${base_w * fitScale}px`;
    menuSection.style.height = `${234 * fitScale}px`;

    enemyStatus.style.left = `${offset_x + 48 * fitScale}px`;
    enemyStatus.style.top = `${offset_y + 42 * fitScale}px`;
    enemyStatus.style.width = `${340 * fitScale}px`;
    playerStatus.style.left = `${offset_x + 980 * fitScale}px`;
    playerStatus.style.top = `${offset_y + 452 * fitScale}px`;
    playerStatus.style.width = `${300 * fitScale}px`;
    document.documentElement.style.setProperty("--battle-scale", fitScale);

    canvas.style.width = `${window_w}px`;
    canvas.style.height = `${window_h}px`;

    canvas.width = Math.round(window_w * dpr);
    canvas.height = Math.round(window_h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateStatus(status, entity, type) {
    const value = entity[type];
    const max = type === "health" ? entity.maxHealth : entity.maxStamina;
    const bar = status.querySelector(`.${type}-bar`);
    const valueLabel = document.getElementById(`${status === enemyStatus ? "enemy" : "player"}-${type}-value`);
    const boundedValue = Math.max(0, Math.min(value, max));
    bar.querySelector(".status-fill").style.width = `${max > 0 ? (boundedValue / max) * 100 : 0}%`;
    bar.setAttribute("aria-valuemax", String(max));
    bar.setAttribute("aria-valuenow", String(boundedValue));
    if (valueLabel) valueLabel.textContent = `${boundedValue} / ${max}`;
}

function updateStatusBars() {
    updateStatus(enemyStatus, battleEnemy, "health");
    updateStatus(enemyStatus, battleEnemy, "stamina");
    updateStatus(playerStatus, battlePlayer, "health");
    updateStatus(playerStatus, battlePlayer, "stamina");
}

function drawBackground() {
    if (!battleBackground.complete) return;
    ctx.drawImage(battleBackground, 0, 0, base_w, base_h);
}

function drawBase() {
    if (!playerBase.complete || !enemyBase.complete) return;
    ctx.drawImage(enemyBase, base_w * 0.5, base_h * 0.35, base_w * 0.35, base_h * 0.3);
    ctx.drawImage(playerBase, base_w * 0.1, base_h * 0.6, base_w * 3 / 7, base_h * 0.1);
}

function drawEntities() {
    if (enemyAttackAnimation) {
        const elapsed = performance.now() - enemyAttackAnimation.startedAt;
        const progress = Math.min(1, elapsed / 170);
        const lunge = Math.sin(progress * Math.PI);
        const enemySprite = battleEnemy.sprites[0];
        enemySprite.offsetX = -105 * lunge;
        enemySprite.scaleMultiplier = 1 + 0.04 * lunge;
        if (elapsed >= 85 && !enemyAttackAnimation.impactApplied) {
            enemyAttackAnimation.impactApplied = true;
            if (enemyAttackAnimation.hit) {
                const damage = enemyAttackAnimation.critical
                    ? wolfCriticalDamage
                    : wolfBaseDamage;
                battlePlayer.health = Math.max(0, battlePlayer.health - damage);
                playerHitFlashUntil = performance.now() + 350;
                menuText.textContent = enemyAttackAnimation.critical
                    ? `늑대의 치명타! ${damage} 피해를 받았다.`
                    : `늑대에게 ${damage} 피해를 받았다.`;
            } else {
                menuText.textContent = "늑대의 공격을 피했다!";
            }
            updateStatusBars();
        }
        if (progress >= 1) {
            enemySprite.offsetX = 0;
            enemySprite.scaleMultiplier = 1;
        }
    }
    if (playerAttackAnimation) {
        const progress = Math.min(1, (performance.now() - playerAttackAnimation.startedAt) / playerAttackAnimation.duration);
        const animation = playerAttackAnimation;
        const playerSprite = battlePlayer.sprites[0];
        const catSprite = battlePlayer.sprites[1];
        const enemySprite = battleEnemy.sprites[0];
        const effectDelay = animation.heavy ? 150 : 90;
        const effectDuration = animation.heavy ? 400 : 300;
        const effectElapsed = performance.now() - animation.startedAt - effectDelay;
        const effectProgress = Math.max(0, Math.min(1, effectElapsed / effectDuration));
        const impactAmount = effectElapsed < 0 ? 0 : 1 - effectProgress;

        enemySprite.offsetX = 0;
        enemySprite.offsetY = 0;
        enemySprite.scaleMultiplier = 1;
        enemySprite.flash = false;
        enemySprite.shake = 0;

        if (!animation.hit) {
            // Dodge away from the player as the strike reaches the enemy.
            const dodge = Math.sin(effectProgress * Math.PI);
            enemySprite.offsetX = -100 * dodge;
            enemySprite.offsetY = -12 * dodge;
            enemySprite.scaleMultiplier = 1 - 0.04 * dodge;
        } else if (impactAmount > 0) {
            const hitPulse = Math.max(0, 1 - effectElapsed / (animation.heavy ? 190 : 135));
            enemySprite.flash = true;
            enemySprite.shake = (animation.heavy ? 20 : 8) * hitPulse;
            enemySprite.offsetX = Math.sin(effectElapsed * 0.12) * enemySprite.shake;
            enemySprite.offsetY = -5 * hitPulse;
            enemySprite.scaleMultiplier = 1 + (animation.heavy ? 0.1 : 0.04) * hitPulse;
        }

        if (!animation.heavy) {
            const lunge = Math.sin(progress * Math.PI);
            playerSprite.offsetX = 105 * lunge;
            playerSprite.scaleMultiplier = 1 + 0.04 * lunge;
            catSprite.offsetX = 58 * lunge;
        } else {
            // Wind-up: compress and lean back; impact: burst forward; recovery: settle.
            const windup = progress < 0.3 ? progress / 0.3 : 0;
            const impact = progress >= 0.3 && progress < 0.58
                ? Math.sin(((progress - 0.3) / 0.28) * Math.PI / 2)
                : progress >= 0.58 ? 1 - (progress - 0.58) / 0.42 : 0;
            playerSprite.offsetX = -24 * windup + 205 * Math.max(0, impact);
            playerSprite.scaleMultiplier = 1 - 0.04 * windup + 0.06 * Math.max(0, impact);
            catSprite.offsetX = -12 * windup + 115 * Math.max(0, impact);
            catSprite.scaleMultiplier = 1 - 0.03 * windup + 0.04 * Math.max(0, impact);
        }

        if (progress >= 1) {
            playerSprite.offsetX = 0;
            playerSprite.scaleMultiplier = 1;
            catSprite.offsetX = 0;
            catSprite.scaleMultiplier = 1;
        }
        if (progress >= 1 && effectElapsed >= effectDuration) {
            enemySprite.offsetX = 0;
            enemySprite.offsetY = 0;
            enemySprite.scaleMultiplier = 1;
            enemySprite.flash = false;
            enemySprite.shake = 0;
            playerAttackAnimation = null;
        }
    }
    const enemySprite = battleEnemy.sprites[0];
    if (enemySprite.flash && enemy.complete && enemy.naturalWidth) {
        ctx.save();
        ctx.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        ctx.drawImage(
            enemy,
            enemySprite.x + (enemySprite.offsetX || 0),
            enemySprite.y + (enemySprite.offsetY || 0),
            enemy.width * enemySprite.scale * (enemySprite.scaleMultiplier || 1),
            enemy.height * enemySprite.scale * (enemySprite.scaleMultiplier || 1),
        );
        ctx.restore();
    } else {
        battleEnemy.draw(ctx);
    }
    const playerSprite = battlePlayer.sprites[0];
    if (enemyAttackAnimation && !enemyAttackAnimation.hit) {
        const dodgeProgress = Math.min(1, (performance.now() - enemyAttackAnimation.startedAt) / 170);
        playerSprite.offsetX = -80 * Math.sin(dodgeProgress * Math.PI);
    } else if (!playerAttackAnimation) {
        playerSprite.offsetX = 0;
    }
    battlePlayer.draw(ctx);
    const playerHitTimeLeft = playerHitFlashUntil - performance.now();
    if (playerHitTimeLeft > 0) {
        const hitProgress = 1 - playerHitTimeLeft / 350;
        ctx.save();
        ctx.globalAlpha = Math.sin(hitProgress * Math.PI) * 0.85;
        ctx.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        ctx.drawImage(playerSprite.image, playerSprite.x, playerSprite.y,
            playerSprite.image.width * playerSprite.scale, playerSprite.image.height * playerSprite.scale);
        ctx.restore();
    }
    const restTimeLeft = playerRestFlashUntil - performance.now();
    if (restTimeLeft > 0) {
        const restProgress = 1 - restTimeLeft / 520;
        const glowOpacity = Math.sin(restProgress * Math.PI) * 0.72;
        ctx.save();
        ctx.globalAlpha = glowOpacity;
        ctx.filter = "sepia(1) saturate(5) hue-rotate(65deg) brightness(1.1)";
        ctx.drawImage(
            playerSprite.image,
            playerSprite.x + (playerSprite.offsetX || 0),
            playerSprite.y + (playerSprite.offsetY || 0),
            playerSprite.image.width * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
            playerSprite.image.height * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
        );
        ctx.restore();
    }
}

function draw() {
    updateStatusBars();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window_w, window_h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, window_w, window_h);
    ctx.setTransform(dpr * scale_w, 0, 0, dpr * scale_h, dpr * offset_x, dpr * offset_y);
    drawBackground();
    drawBase();
    drawEntities();
    requestAnimationFrame(draw);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
draw()
