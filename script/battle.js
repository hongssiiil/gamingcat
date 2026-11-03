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
player.src = "./images/battle/player.png";
const enemy = new Image();
enemy.src = "./images/battle/enemy.png";

fightButton.addEventListener("click", () => {
    // 싸우기 버튼 클릭 시 동작
    console.log("싸우기 버튼 클릭됨");
    menuText.textContent = "이길 수 없다니까?\n뭘 싸워!";
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

    canvas.style.width = `${window_w}px`;
    canvas.style.height = `${window_h}px`;

    canvas.width = Math.round(window_w * dpr);
    canvas.height = Math.round(window_h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    if (!player.complete || !enemy.complete) return;
    ctx.drawImage(enemy, base_w * 0.57, base_h * 0.17, enemy.width * 1.5, enemy.height * 1.5);
    ctx.drawImage(player, base_w * 0.23, base_h * 0.484, player.width * 1.5, player.height * 1.5);
}

function draw() {
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

