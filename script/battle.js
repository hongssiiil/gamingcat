const battleSection = document.querySelector("#Battle");

export function enterBattle() {
    battleSection.classList.replace("screen", "screen-active");
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
            this.drawSprite(ctx, sprite.image, sprite.x, sprite.y, sprite.scale);
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
    health: 70,
    stamina: 100,
});

fightButton.addEventListener("click", () => {
    fightSkillsDialog.hidden = false;
    fightSkillButtons[0].focus();
});

const skillEffects = [
    { name: "일반 공격", damage: 10, staminaCost: 5 },
    { name: "힘껏 휘두르기", damage: 20, staminaCost: 9 },
    { name: "숨 고르기", damage: 0, staminaCost: 0, staminaRecovery: 20 },
];

fightSkillButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
        const skill = skillEffects[index];
        if (!skill || battlePlayer.stamina < skill.staminaCost) {
            menuText.textContent = "스태미나가 부족해!";
            return;
        }

        battlePlayer.stamina -= skill.staminaCost;
        battleEnemy.health = Math.max(0, battleEnemy.health - skill.damage);
        if (skill.staminaRecovery) {
            battlePlayer.stamina = Math.min(
                battlePlayer.maxStamina,
                battlePlayer.stamina + skill.staminaRecovery,
            );
        }

        menuText.textContent = skill.staminaRecovery
            ? `${skill.name}! 스태미나를 회복했어.`
            : `${skill.name}! 적에게 ${skill.damage} 피해를 줬어.`;
        updateStatusBars();
        fightSkillsDialog.hidden = true;
        fightButton.focus();
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

bagButton.addEventListener("click", () => {
    // 가방 버튼 클릭 시 동작
    console.log("가방 버튼 클릭됨");
    menuText.textContent = "가방을 열어서 뭐하게?";
});

runButton.addEventListener("click", () => {
    // 도망가기 버튼 클릭 시 동작
    console.log("도망가기 버튼 클릭됨");
    menuText.textContent = "잘 생각했어!";
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
    battleEnemy.draw(ctx);
    battlePlayer.draw(ctx);
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

