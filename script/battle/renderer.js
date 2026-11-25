import {
    battleHistoryPanel,
    enemyStatus,
    menuSection,
    playerStatus,
} from "./ui.js?v=45";

const baseWidth = 1440;
const baseHeight = 778;

const canvas = document.getElementById("battle-canvas");
const context = canvas.getContext("2d");

let battleBackground = loadImage("./images/battle/battle_bg.png");
const battleBackgrounds = new Map();
const playerImage = loadImage("./images/character/player/player_diagonal.png");
const enemyImages = {
    wolf: loadImage("./images/battle/wolf.png"),
    mole: loadImage("./images/battle/mole.png"),
};
const catImage = loadImage("./images/character/cat/cat_diagonal.png");

const enemySprite = {
    image: enemyImages.wolf,
    x: baseWidth * 0.57,
    y: baseHeight * 0.22,
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
let battleScale;
let offsetX;
let offsetY;

function loadImage(source) {
    const image = new Image();
    image.src = source;
    return image;
}

function preloadBattleBackground(source) {
    if (battleBackgrounds.has(source)) return battleBackgrounds.get(source);
    const image = loadImage(source);
    const loaded = image.decode().then(() => image);
    battleBackgrounds.set(source, loaded);
    return loaded;
}

export async function setBattleBackground(source) {
    battleBackground = await preloadBattleBackground(source);
    drawBackground();
}

export function setBattleEnemy(kind) {
    enemySprite.image = enemyImages[kind] ?? enemyImages.wolf;
    enemySprite.scale = kind === "mole" ? 0.16 : 0.24;
    enemySprite.y = baseHeight * (kind === "mole" ? 0.29 : 0.22);
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
    battleScale = fitScale;
    offsetX = (windowWidth - baseWidth * fitScale) / 2;
    offsetY = (windowHeight - baseHeight * fitScale) / 2;

    menuSection.style.left = `${offsetX}px`;
    const menuHeight = 200;
    menuSection.style.top = `${offsetY + (baseHeight - menuHeight) * fitScale}px`;
    menuSection.style.width = `${baseWidth * fitScale}px`;
    menuSection.style.height = `${menuHeight * fitScale}px`;

    battleHistoryPanel.style.left = `${offsetX + 1148 * fitScale}px`;
    battleHistoryPanel.style.top = `${offsetY + 184 * fitScale}px`;
    battleHistoryPanel.style.width = `${290 * fitScale}px`;
    battleHistoryPanel.style.height = `${310 * fitScale}px`;

    playerStatus.style.left = `${offsetX + 220 * fitScale}px`;
    playerStatus.style.top = `${offsetY + 16 * fitScale}px`;
    playerStatus.style.width = `${400 * fitScale}px`;
    playerStatus.style.height = `${140 * fitScale}px`;
    enemyStatus.style.left = `${offsetX + 820 * fitScale}px`;
    enemyStatus.style.top = `${offsetY + 16 * fitScale}px`;
    enemyStatus.style.width = `${400 * fitScale}px`;
    enemyStatus.style.height = `${140 * fitScale}px`;
    document.documentElement.style.setProperty("--battle-scale", fitScale);
    document.documentElement.style.setProperty("--battle-offset-x", `${offsetX}px`);
    document.documentElement.style.setProperty("--battle-offset-y", `${offsetY}px`);

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
    const progress = Math.min(1, elapsed / animation.duration);
    const lunge = Math.sin(progress * Math.PI);
    enemySprite.offsetX = -190 * lunge;
    enemySprite.offsetY = 10 * lunge;
    enemySprite.scaleMultiplier = 1 + 0.1 * lunge;
    if (progress >= 1) {
        enemySprite.offsetX = 0;
        enemySprite.offsetY = 0;
        enemySprite.scaleMultiplier = 1;
    }
}

function drawEnemyRoar(state) {
    const animation = state.enemyRoarAnimation;
    if (!animation) return;

    const elapsed = performance.now() - animation.startedAt;
    if (elapsed >= animation.duration) {
        state.enemyRoarAnimation = null;
        enemySprite.offsetX = 0;
        enemySprite.offsetY = 0;
        enemySprite.scaleMultiplier = 1;
        return;
    }

    const intensity = 1 - elapsed / animation.duration;
    enemySprite.offsetX = Math.sin(elapsed * 0.075) * 18 * intensity;
    enemySprite.offsetY = Math.sin(elapsed * 0.12) * 8 * intensity - 5 * intensity;
    enemySprite.scaleMultiplier = 1 + Math.abs(Math.sin(elapsed * 0.06)) * 0.1 * intensity;
}

function drawPlayerAttack(state) {
    const animation = state.playerAttackAnimation;
    if (!animation) return;

    const progress = Math.min(1, (performance.now() - animation.startedAt) / animation.duration);
    const effectDelay = animation.heavy ? 200 : 120;
    const effectDuration = animation.heavy ? 560 : 420;
    const effectElapsed = performance.now() - animation.startedAt - effectDelay;
    const effectProgress = Math.max(0, Math.min(1, effectElapsed / effectDuration));
    const impactAmount = effectElapsed < 0 ? 0 : 1 - effectProgress;

    enemySprite.offsetX = 0;
    enemySprite.offsetY = 0;
    enemySprite.scaleMultiplier = 1;
    enemySprite.flash = false;
    enemySprite.shake = 0;

    if (impactAmount > 0) {
        const hitPulse = Math.max(0, 1 - effectElapsed / (animation.heavy ? 360 : 260));
        enemySprite.flash = true;
        enemySprite.shake = (animation.heavy ? 30 : 15) * hitPulse;
        enemySprite.offsetX = Math.sin(effectElapsed * 0.1) * enemySprite.shake;
        enemySprite.offsetY = -10 * hitPulse;
        enemySprite.scaleMultiplier = 1 + (animation.heavy ? 0.18 : 0.08) * hitPulse;
    }

    if (!animation.heavy) {
        const lunge = Math.sin(progress * Math.PI);
        playerSprite.offsetX = 150 * lunge;
        playerSprite.scaleMultiplier = 1 + 0.08 * lunge;
        catSprite.offsetX = 80 * lunge;
    } else {
        const windup = progress < 0.3 ? progress / 0.3 : 0;
        const impact = progress >= 0.3 && progress < 0.58
            ? Math.sin(((progress - 0.3) / 0.28) * Math.PI / 2)
            : progress >= 0.58 ? 1 - (progress - 0.58) / 0.42 : 0;
        playerSprite.offsetX = -40 * windup + 260 * Math.max(0, impact);
        playerSprite.offsetY = -10 * windup - 8 * Math.max(0, impact);
        playerSprite.scaleMultiplier = 1 - 0.08 * windup + 0.12 * Math.max(0, impact);
        catSprite.offsetX = -22 * windup + 150 * Math.max(0, impact);
        catSprite.scaleMultiplier = 1 - 0.05 * windup + 0.08 * Math.max(0, impact);
    }

    if (progress >= 1) {
        playerSprite.offsetX = 0;
        playerSprite.offsetY = 0;
        playerSprite.scaleMultiplier = 1;
        catSprite.offsetX = 0;
        catSprite.offsetY = 0;
        catSprite.scaleMultiplier = 1;
    }
    if (progress >= 1 && effectElapsed >= effectDuration) {
        enemySprite.offsetX = 0;
        enemySprite.offsetY = 0;
        enemySprite.scaleMultiplier = 1;
        enemySprite.flash = false;
        enemySprite.shake = 0;
        state.playerAttackAnimation = null;
    }
}

function spriteBox(sprite) {
    const scale = sprite.scale * (sprite.scaleMultiplier || 1);
    const width = sprite.image.width * scale;
    const height = sprite.image.height * scale;
    const x = sprite.x + (sprite.offsetX || 0);
    const y = sprite.y + (sprite.offsetY || 0);
    return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2, top: y };
}

function drawOutlinedLabel(text, x, y, color, alpha = 1, size = 24) {
    context.save();
    context.globalAlpha = alpha;
    context.font = `bold ${size}px DungGeunMo, monospace`;
    context.textAlign = "center";
    context.lineJoin = "round";
    context.lineWidth = 6;
    context.strokeStyle = "#101712";
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
    context.restore();
}

function drawSparkles(centerX, top, progress, color, amount = 7) {
    context.save();
    for (let index = 0; index < amount; index += 1) {
        const phase = (progress * 1.35 + index / amount) % 1;
        const drift = Math.sin((phase * 2 + index) * Math.PI) * (18 + index % 3 * 9);
        const x = centerX + drift;
        const y = top + 48 - phase * 76;
        const size = 4 + (index % 3) * 2;
        context.globalAlpha = (1 - phase) * 0.9;
        context.fillStyle = color;
        context.fillRect(Math.round(x), Math.round(y), size, size);
        context.fillRect(Math.round(x - size), Math.round(y + size / 2), size * 3, 2);
        context.fillRect(Math.round(x + size / 2), Math.round(y - size), 2, size * 3);
    }
    context.restore();
}

function applyRecoveryMotion(sprite, animation, now) {
    if (!animation) return;
    const progress = (now - animation.startedAt) / animation.duration;
    if (progress >= 1) {
        sprite.offsetY = 0;
        sprite.scaleMultiplier = 1;
        return;
    }
    const breath = Math.sin(progress * Math.PI * 3);
    sprite.offsetY = -Math.max(0, breath) * 16;
    sprite.scaleMultiplier = 1 + Math.max(0, breath) * 0.08;
}

function drawShield(sprite, animation, defending, now) {
    if (!sprite.image.complete || !sprite.image.naturalWidth) return;
    const elapsed = animation ? now - animation.startedAt : 0;
    if (!defending && (!animation || elapsed >= animation.duration)) return;
    const box = spriteBox(sprite);
    const pulse = 0.5 + Math.sin(now * 0.012) * 0.16;
    context.save();
    context.globalAlpha = pulse;
    context.beginPath();
    context.moveTo(box.centerX, box.y - 15);
    context.lineTo(box.x + box.width + 20, box.y + box.height * 0.22);
    context.lineTo(box.x + box.width + 10, box.y + box.height * 0.68);
    context.lineTo(box.centerX, box.y + box.height + 18);
    context.lineTo(box.x - 10, box.y + box.height * 0.68);
    context.lineTo(box.x - 20, box.y + box.height * 0.22);
    context.closePath();
    context.fillStyle = "rgba(69, 180, 190, 0.25)";
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = "#8de3d4";
    context.stroke();
    context.lineWidth = 2;
    context.strokeStyle = "#f4e3a1";
    context.stroke();
    context.restore();
    if (animation && elapsed < 650) {
        drawOutlinedLabel("방어", box.centerX, box.y - 22 - Math.max(0, elapsed / 650) * 14, "#bff8e9", 1, 22);
    }
}

function drawPlayerAttackEffect(animation, now) {
    if (!animation || !enemySprite.image.complete || !enemySprite.image.naturalWidth) return;
    const delay = animation.heavy ? 200 : 120;
    const duration = animation.heavy ? 560 : 420;
    const elapsed = now - animation.startedAt - delay;
    if (elapsed < 0 || elapsed >= duration) return;
    const progress = elapsed / duration;
    const box = spriteBox(enemySprite);
    const radius = animation.heavy ? 76 : 52;
    context.save();
    context.globalAlpha = Math.min(1, (1 - progress) * 1.4);
    context.translate(box.centerX, box.centerY);
    context.rotate(-0.68);
    const slashCount = animation.heavy ? 4 : 2;
    for (let index = 0; index < slashCount; index += 1) {
        const offset = (index - (slashCount - 1) / 2) * (animation.heavy ? 28 : 24);
        context.fillStyle = index % 2 ? "#f4b844" : "#fff3b0";
        context.fillRect(-8 + offset, -radius, 16, radius * 2);
        context.fillStyle = "#fffdf0";
        context.fillRect(-3 + offset, -radius * 0.72, 6, radius * 1.44);
    }
    context.restore();
}

function drawEnemyAttackEffect(animation, now) {
    if (!animation || now - animation.startedAt > animation.duration + 430) return;
    if (!enemySprite.image.complete || !enemySprite.image.naturalWidth
        || !playerImage.complete || !playerImage.naturalWidth) return;
    const progress = Math.min(1, (now - animation.startedAt) / (animation.duration + 430));
    const enemy = spriteBox(enemySprite);
    const player = spriteBox(playerSprite);
    const x = enemy.centerX - (enemy.centerX - player.centerX) * progress;
    const y = enemy.centerY + (player.centerY - enemy.centerY) * progress;
    context.save();
    context.globalAlpha = Math.sin(progress * Math.PI) * 0.9;
    context.strokeStyle = "#f15e55";
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(x + 16, y - 52);
    context.lineTo(x - 12, y - 18);
    context.lineTo(x + 18, y + 8);
    context.lineTo(x - 22, y + 48);
    context.stroke();
    context.strokeStyle = "#ffe49a";
    context.lineWidth = 4;
    context.stroke();
    context.restore();
}

function drawRoarEffect(animation, now) {
    if (!animation) return;
    const elapsed = now - animation.startedAt;
    if (elapsed >= animation.duration || !enemySprite.image.complete || !enemySprite.image.naturalWidth
        || !playerImage.complete || !playerImage.naturalWidth) return;
    const enemy = spriteBox(enemySprite);
    const player = spriteBox(playerSprite);
    const progress = elapsed / animation.duration;
    const top = (enemy.centerY + player.centerY) / 2 - 68;
    context.save();
    for (let index = 0; index < 3; index += 1) {
        const phase = (progress * 1.35 + index / 3) % 1;
        const x = enemy.centerX - (enemy.centerX - player.centerX) * phase;
        context.globalAlpha = (1 - phase) * 0.9;
        context.beginPath();
        context.moveTo(x, top);
        for (let step = 0; step < 8; step += 1) {
            context.lineTo(x + (step % 2 ? -24 : 24), top + step * 18);
        }
        context.strokeStyle = "#e8586b";
        context.lineWidth = 12;
        context.stroke();
        context.strokeStyle = "#ffe394";
        context.lineWidth = 4;
        context.stroke();
    }
    context.restore();
}

function drawActionEffects(state, now) {
    drawPlayerAttackEffect(state.playerAttackAnimation, now);
    drawEnemyAttackEffect(state.enemyAttackAnimation, now);
    drawRoarEffect(state.enemyRoarAnimation, now);

    for (const [sprite, animation, defending] of [
        [playerSprite, state.playerDefenseAnimation, state.player.defending],
        [enemySprite, state.enemyDefenseAnimation, state.enemy.defending],
    ]) {
        drawShield(sprite, animation, defending, now);
    }

    for (const [sprite, animation] of [
        [playerSprite, state.playerRecoveryAnimation],
        [enemySprite, state.enemyRecoveryAnimation],
    ]) {
        if (!animation || now - animation.startedAt >= animation.duration || !sprite.image.complete) continue;
        const progress = (now - animation.startedAt) / animation.duration;
        const box = spriteBox(sprite);
        const gains = [
            animation.health > 0 ? `+${animation.health} HP` : "",
            animation.stamina > 0 ? `+${animation.stamina} SP` : "",
        ].filter(Boolean);
        drawSparkles(box.centerX, box.top, progress, "#a5ed82");
        drawOutlinedLabel(gains.join("  ") || "숨 고르기", box.centerX, box.top - 12 - progress * 28, "#c4f58d", 1 - progress * 0.45, 20);
    }

    const hit = state.playerHitAnimation;
    if (hit && now - hit.startedAt < hit.duration && playerImage.complete && playerImage.naturalWidth) {
        const progress = (now - hit.startedAt) / hit.duration;
        const box = spriteBox(playerSprite);
        drawSparkles(box.centerX, box.top, progress, hit.defended ? "#ffe394" : "#ff7569", 6);
        drawOutlinedLabel(`-${hit.damage}${hit.critical ? "!" : ""}`, box.centerX, box.top - 14 - progress * 50, hit.defended ? "#ffe394" : "#ff7569", 1 - progress * 0.25, 34);
    }
}

function drawEntities(state) {
    const now = performance.now();
    drawEnemyAttack(state.enemyAttackAnimation);
    drawPlayerAttack(state);
    drawEnemyRoar(state);
    if (state.enemyRecoveryAnimation && !state.enemyAttackAnimation
        && !state.enemyRoarAnimation && !state.playerAttackAnimation) {
        applyRecoveryMotion(enemySprite, state.enemyRecoveryAnimation, now);
    }

    if (enemySprite.flash && enemySprite.image.complete && enemySprite.image.naturalWidth) {
        context.save();
        context.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        drawSprite(enemySprite);
        context.restore();
    } else {
        drawSprite(enemySprite);
    }

    if (!state.playerAttackAnimation) {
        const hit = state.playerHitAnimation;
        const hitTimeLeft = hit ? hit.startedAt + hit.duration - now : 0;
        const hitIntensity = Math.max(0, Math.min(1, hitTimeLeft / 800));
        const roarTimeLeft = state.playerRoarHitUntil - now;
        const roarIntensity = Math.max(0, Math.min(1, roarTimeLeft / 900));
        if (hitIntensity > 0) {
            playerSprite.offsetX = -34 * hitIntensity + Math.sin(now * 0.09) * 11 * hitIntensity;
            playerSprite.offsetY = -7 * hitIntensity;
            playerSprite.scaleMultiplier = 1 - 0.05 * hitIntensity;
        } else if (roarIntensity > 0) {
            playerSprite.offsetX = Math.sin(now * 0.09) * 20 * roarIntensity - 24 * roarIntensity;
            playerSprite.offsetY = Math.sin(now * 0.15) * 8 * roarIntensity;
            playerSprite.scaleMultiplier = 1 - 0.04 * roarIntensity;
        } else if (state.playerRecoveryAnimation) {
            applyRecoveryMotion(playerSprite, state.playerRecoveryAnimation, now);
        } else {
            playerSprite.offsetX = 0;
            playerSprite.offsetY = 0;
            playerSprite.scaleMultiplier = 1;
        }
    }
    drawSprite(playerSprite);
    drawSprite(catSprite);

    const playerHitTimeLeft = state.playerHitFlashUntil - now;
    if (playerHitTimeLeft > 0 && playerImage.complete && playerImage.naturalWidth) {
        const hitProgress = 1 - playerHitTimeLeft / 650;
        context.save();
        context.globalAlpha = Math.sin(hitProgress * Math.PI) * 0.85;
        context.filter = "sepia(1) saturate(8) hue-rotate(320deg) brightness(1.15)";
        context.drawImage(
            playerImage,
            playerSprite.x + (playerSprite.offsetX || 0),
            playerSprite.y + (playerSprite.offsetY || 0),
            playerImage.width * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
            playerImage.height * playerSprite.scale * (playerSprite.scaleMultiplier || 1),
        );
        context.restore();
    }

    const restTimeLeft = state.playerRestFlashUntil - now;
    if (restTimeLeft > 0 && playerImage.complete && playerImage.naturalWidth) {
        const restProgress = 1 - restTimeLeft / 900;
        context.save();
        context.globalAlpha = Math.sin(restProgress * Math.PI) * 0.88;
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

    for (const key of ["playerRecoveryAnimation", "enemyRecoveryAnimation", "playerDefenseAnimation", "enemyDefenseAnimation", "playerHitAnimation"]) {
        const animation = state[key];
        if (animation && now - animation.startedAt >= animation.duration) state[key] = null;
    }
    drawActionEffects(state, now);
}

function draw(state) {
    const dpr = window.devicePixelRatio || 1;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, windowWidth, windowHeight);
    context.fillStyle = "#000";
    context.fillRect(0, 0, windowWidth, windowHeight);
    context.setTransform(dpr * battleScale, 0, 0, dpr * battleScale, dpr * offsetX, dpr * offsetY);
    drawBackground();
    drawEntities(state);
    window.requestAnimationFrame(() => draw(state));
}

export function startBattleRenderer(state) {
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    draw(state);
}
