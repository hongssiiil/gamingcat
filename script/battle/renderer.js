import { enemyStatus, menuSection, playerStatus } from "./ui.js";

const baseWidth = 1440;
const baseHeight = 778;

const canvas = document.getElementById("battle-canvas");
const context = canvas.getContext("2d");

let battleBackground = loadImage("./images/battle/battle_bg.png");
const playerImage = loadImage("./images/character/player/player_diagonal.png");
const enemyImage = loadImage("./images/battle/wolf.png");
const catImage = loadImage("./images/character/cat/cat_diagonal.png");

const enemySprite = {
    image: enemyImage,
    x: baseWidth * 0.57,
    y: baseHeight * 0.17,
    scale: 0.24,
    offsetX: 0,
    offsetY: 0,
    scaleMultiplier: 1,
    flash: false,
    shake: 0,
};
const playerSprite = {
    image: playerImage,
    x: baseWidth * 0.16,
    y: baseHeight * 0.38,
    scale: 0.24,
    offsetX: 0,
    offsetY: 0,
    scaleMultiplier: 1,
};
const catSprite = {
    image: catImage,
    x: baseWidth * 0.28,
    y: baseHeight * 0.58,
    scale: 0.15,
    offsetX: 0,
    offsetY: 0,
    scaleMultiplier: 1,
};

let windowWidth;
let windowHeight;
let scaleWidth;
let scaleHeight;
let offsetX;
let offsetY;

function loadImage(source) {
    const image = new Image();
    image.src = source;
    return image;
}

export function setBattleBackground(source) {
    const nextBackground = loadImage(source);
    nextBackground.addEventListener("load", () => {
        battleBackground = nextBackground;
        drawBackground();
    }, { once: true });
}

function drawSprite(sprite) {
    if (!sprite.image.complete || !sprite.image.naturalWidth) return;
    context.drawImage(
        sprite.image,
        sprite.x + (sprite.offsetX || 0),
        sprite.y + (sprite.offsetY || 0),
        sprite.image.width * sprite.scale * (sprite.scaleMultiplier || 1),
        sprite.image.height * sprite.scale * (sprite.scaleMultiplier || 1),
    );
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;
    const fitScale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
    scaleWidth = fitScale;
    scaleHeight = fitScale;
    offsetX = (windowWidth - baseWidth * fitScale) / 2;
    offsetY = (windowHeight - baseHeight * fitScale) / 2;

    menuSection.style.left = `${offsetX}px`;
    menuSection.style.top = `${offsetY + 544 * fitScale}px`;
    menuSection.style.width = `${baseWidth * fitScale}px`;
    menuSection.style.height = `${234 * fitScale}px`;

    enemyStatus.style.left = `${offsetX + 48 * fitScale}px`;
    enemyStatus.style.top = `${offsetY + 42 * fitScale}px`;
    enemyStatus.style.width = `${340 * fitScale}px`;
    playerStatus.style.left = `${offsetX + 980 * fitScale}px`;
    playerStatus.style.top = `${offsetY + 452 * fitScale}px`;
    playerStatus.style.width = `${300 * fitScale}px`;
    document.documentElement.style.setProperty("--battle-scale", fitScale);

    canvas.style.width = `${windowWidth}px`;
    canvas.style.height = `${windowHeight}px`;
    canvas.width = Math.round(windowWidth * dpr);
    canvas.height = Math.round(windowHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBackground() {
    if (!battleBackground.complete) return;
    context.drawImage(battleBackground, 0, 0, baseWidth, baseHeight);
}

function drawEnemyAttack(animation) {
    if (!animation) return;

    const elapsed = performance.now() - animation.startedAt;
    const progress = Math.min(1, elapsed / 170);
    const lunge = Math.sin(progress * Math.PI);
    enemySprite.offsetX = -105 * lunge;
    enemySprite.scaleMultiplier = 1 + 0.04 * lunge;
    if (progress >= 1) {
        enemySprite.offsetX = 0;
        enemySprite.scaleMultiplier = 1;
    }
}

function drawPlayerAttack(animation) {
    if (!animation) return;

    const progress = Math.min(1, (performance.now() - animation.startedAt) / animation.duration);
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
    }
}

function drawEntities(state) {
    drawEnemyAttack(state.enemyAttackAnimation);
    drawPlayerAttack(state.playerAttackAnimation);

    if (enemySprite.flash && enemyImage.complete && enemyImage.naturalWidth) {
        context.save();
        context.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        drawSprite(enemySprite);
        context.restore();
    } else {
        drawSprite(enemySprite);
    }

    if (state.enemyAttackAnimation && !state.enemyAttackAnimation.hit) {
        const dodgeProgress = Math.min(1, (performance.now() - state.enemyAttackAnimation.startedAt) / 170);
        playerSprite.offsetX = -80 * Math.sin(dodgeProgress * Math.PI);
    } else if (!state.playerAttackAnimation) {
        playerSprite.offsetX = 0;
    }
    drawSprite(playerSprite);
    drawSprite(catSprite);

    const playerHitTimeLeft = state.playerHitFlashUntil - performance.now();
    if (playerHitTimeLeft > 0 && playerImage.complete && playerImage.naturalWidth) {
        const hitProgress = 1 - playerHitTimeLeft / 350;
        context.save();
        context.globalAlpha = Math.sin(hitProgress * Math.PI) * 0.85;
        context.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        context.drawImage(
            playerImage,
            playerSprite.x,
            playerSprite.y,
            playerImage.width * playerSprite.scale,
            playerImage.height * playerSprite.scale,
        );
        context.restore();
    }

    const restTimeLeft = state.playerRestFlashUntil - performance.now();
    if (restTimeLeft > 0 && playerImage.complete && playerImage.naturalWidth) {
        const restProgress = 1 - restTimeLeft / 520;
        context.save();
        context.globalAlpha = Math.sin(restProgress * Math.PI) * 0.72;
        context.filter = "sepia(1) saturate(5) hue-rotate(65deg) brightness(1.1)";
        context.drawImage(
            playerImage,
            playerSprite.x + (playerSprite.offsetX || 0),
            playerSprite.y + (playerSprite.offsetY || 0),
            playerImage.width * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
            playerImage.height * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
        );
        context.restore();
    }
}

function draw(state) {
    const dpr = window.devicePixelRatio || 1;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, windowWidth, windowHeight);
    context.fillStyle = "#000";
    context.fillRect(0, 0, windowWidth, windowHeight);
    context.setTransform(dpr * scaleWidth, 0, 0, dpr * scaleHeight, dpr * offsetX, dpr * offsetY);
    drawBackground();
    drawEntities(state);
    window.requestAnimationFrame(() => draw(state));
}

export function startBattleRenderer(state) {
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    draw(state);
}
