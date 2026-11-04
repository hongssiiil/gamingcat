const roadSection = document.querySelector("#Road");
const roadViewport = document.querySelector("#road-viewport");
const roadWorld = document.querySelector("#road-world");
const roadMap = document.querySelector("#road-map");
const playerActor = document.querySelector("#road-player");
const playerSprite = document.querySelector("#road-player-sprite");
const grandmotherActor = document.querySelector("#road-grandmother");
const dialog = document.querySelector("#road-dialog");
const dialogText = document.querySelector("#road-dialog-text");

const MOVE_KEYS = new Set([
    "arrowup", "arrowdown", "arrowleft", "arrowright",
    "w", "a", "s", "d",
]);
const MOVE_SPEED = 230;
const ZOOM_LEVEL = 1.5;
const INTERACTION_DISTANCE = 132;
const TOUCH_DISTANCE = 42;
const PLAYER_WIDTH = 78;
const PLAYER_HEIGHT = 86;
const MAP_BOTTOM_CROP = 96;
const MAP_PATHS = {
    home: "./images/backgrounds/home.png",
    whiteRoad: "./images/backgrounds/road_white.png",
};
const HOME_EXIT_ZONE = {
    left: 0.78,
    right: 0.86,
    top: 0.6,
    bottom: 0.7,
};
const WHITE_ROAD_RETURN_ZONE = {
    left: 0,
    right: 0.08,
    top: 0.4,
    bottom: 0.78,
};
const HOME_COLLISION_RECTS = [
    { x: 496, y: 252, width: 438, height: 390, label: "집" },
];
const PLAYER_COLLISION_HALF_WIDTH = 13;
const PLAYER_COLLISION_HALF_HEIGHT = 8;
const GRANDMOTHER_LINE = "오른쪽 끝에 숨겨진 길을 찾아보렴";
const TYPEWRITER_DELAY = 55;

const spritePaths = {
    idle: "./images/character/player/player.png",
    front: "./images/character/player/player_front.png",
    back: "./images/character/player/player_back.png",
    side: "./images/character/player/player_side.png",
    diagonal: "./images/character/player/player_diagonal.png",
};

const pressedKeys = new Set();
const player = { x: 744, y: 842 };
const grandmother = { x: 816, y: 724 };

let worldWidth = 1448;
let worldHeight = 1086;
let currentMap = "home";
let pendingSpawn = null;
let homeReturnY = 0;
let homePortalArmed = true;
let collisionDebugVisible = false;
let homeOuterBlackMask = null;
let blackDebugCanvas = null;
let cameraScale = 1;
let lastFrameTime = 0;
let facing = "idle";
let facingLeft = false;
let dialogOpen = false;
let suppressTouchDialog = false;
let typewriterTimer = null;
let typedCharacters = 0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function canOccupyHomePosition(x, y) {
    if (isHomeBlackPixel(x, y)) return false;

    return !HOME_COLLISION_RECTS.some(({ x: left, y: top, width, height }) => (
        x + PLAYER_COLLISION_HALF_WIDTH > left
        && x - PLAYER_COLLISION_HALF_WIDTH < left + width
        && y + PLAYER_COLLISION_HALF_HEIGHT > top
        && y - PLAYER_COLLISION_HALF_HEIGHT < top + height
    ));
}

function isHomeBlackPixel(x, y) {
    if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight) return true;
    if (!homeOuterBlackMask) return false;

    return homeOuterBlackMask[Math.floor(y) * worldWidth + Math.floor(x)] === 1;
}

function cacheHomeCollisionPixels() {
    if (currentMap !== "home" || !roadMap.naturalWidth || !roadMap.naturalHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = roadMap.naturalWidth;
    canvas.height = roadMap.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(roadMap, 0, 0);
    try {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const pixelCount = canvas.width * canvas.height;
        const exteriorMask = new Uint8Array(pixelCount);
        const queue = new Int32Array(pixelCount);
        let queueStart = 0;
        let queueEnd = 0;
        const isBlack = (index) => pixels[index + 3] < 16
            || (pixels[index] < 24 && pixels[index + 1] < 24 && pixels[index + 2] < 24);
        const addExteriorPixel = (pixelIndex) => {
            if (exteriorMask[pixelIndex] || !isBlack(pixelIndex * 4)) return;
            exteriorMask[pixelIndex] = 1;
            queue[queueEnd++] = pixelIndex;
        };

        for (let x = 0; x < canvas.width; x += 1) {
            addExteriorPixel(x);
            addExteriorPixel((canvas.height - 1) * canvas.width + x);
        }
        for (let y = 1; y < canvas.height - 1; y += 1) {
            addExteriorPixel(y * canvas.width);
            addExteriorPixel(y * canvas.width + canvas.width - 1);
        }

        while (queueStart < queueEnd) {
            const pixelIndex = queue[queueStart++];
            const x = pixelIndex % canvas.width;
            const y = Math.floor(pixelIndex / canvas.width);
            if (x > 0) addExteriorPixel(pixelIndex - 1);
            if (x + 1 < canvas.width) addExteriorPixel(pixelIndex + 1);
            if (y > 0) addExteriorPixel(pixelIndex - canvas.width);
            if (y + 1 < canvas.height) addExteriorPixel(pixelIndex + canvas.width);
        }
        homeOuterBlackMask = exteriorMask;

        const debugPixels = context.createImageData(canvas.width, canvas.height);
        for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
            if (exteriorMask[pixelIndex]) {
                const imageDataIndex = pixelIndex * 4;
                debugPixels.data[imageDataIndex] = 255;
                debugPixels.data[imageDataIndex + 1] = 40;
                debugPixels.data[imageDataIndex + 2] = 40;
                debugPixels.data[imageDataIndex + 3] = 115;
            }
        }
        blackDebugCanvas.width = canvas.width;
        blackDebugCanvas.height = canvas.height;
        blackDebugCanvas.getContext("2d").putImageData(debugPixels, 0, 0);
    } catch {
        homeOuterBlackMask = null;
    }
}

function createCollisionDebugOverlay() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const canvas = document.createElement("canvas");
    canvas.classList.add("road-black-debug");
    canvas.setAttribute("aria-hidden", "true");
    roadWorld.append(canvas);
    blackDebugCanvas = canvas;

    const svg = document.createElementNS(svgNamespace, "svg");
    svg.classList.add("road-collision-debug");
    svg.setAttribute("aria-hidden", "true");
    for (const rect of HOME_COLLISION_RECTS) {
        const box = document.createElementNS(svgNamespace, "rect");
        box.setAttribute("x", rect.x);
        box.setAttribute("y", rect.y);
        box.setAttribute("width", rect.width);
        box.setAttribute("height", rect.height);
        box.classList.add("road-obstacle-debug");
        svg.append(box);
    }
    roadWorld.append(svg);
    return svg;
}

const collisionDebugOverlay = createCollisionDebugOverlay();

function updateCollisionDebugOverlay() {
    const show = collisionDebugVisible && currentMap === "home";
    collisionDebugOverlay.classList.toggle("is-visible", show);
    blackDebugCanvas.classList.toggle("is-visible", show);
    collisionDebugOverlay.setAttribute(
        "viewBox",
        `0 0 ${worldWidth} ${roadMap.naturalHeight || worldHeight}`,
    );
}

function getKeyName(event) {
    if (event.code.startsWith("Key")) return event.code.slice(3).toLowerCase();
    return event.key.toLowerCase();
}

function isRoadActive() {
    return roadSection.classList.contains("screen-active");
}

function getMovement() {
    const up = pressedKeys.has("arrowup") || pressedKeys.has("w");
    const down = pressedKeys.has("arrowdown") || pressedKeys.has("s");
    const left = pressedKeys.has("arrowleft") || pressedKeys.has("a");
    const right = pressedKeys.has("arrowright") || pressedKeys.has("d");

    return {
        x: Number(right) - Number(left),
        y: Number(down) - Number(up),
    };
}

function setFacingFromMovement(movement) {
    if (movement.x === 0 && movement.y === 0) return;

    if (movement.x !== 0 && movement.y !== 0) {
        facing = "diagonal";
        facingLeft = movement.x < 0;
    } else if (movement.x !== 0) {
        facing = "side";
        facingLeft = movement.x < 0;
    } else if (movement.y < 0) {
        facing = "back";
        facingLeft = false;
    } else {
        facing = "front";
        facingLeft = false;
    }

    playerSprite.src = spritePaths[facing];
    playerSprite.classList.toggle("is-facing-left", facingLeft);
}

function updateActorPositions() {
    playerActor.style.left = `${player.x}px`;
    playerActor.style.top = `${player.y}px`;
    grandmotherActor.style.left = `${grandmother.x}px`;
    grandmotherActor.style.top = `${grandmother.y}px`;
}

function updateWorldSize() {
    worldWidth = roadMap.naturalWidth || worldWidth;
    const bottomCrop = currentMap === "home" ? MAP_BOTTOM_CROP : 0;
    worldHeight = Math.max((roadMap.naturalHeight || worldHeight) - bottomCrop, 1);
    roadWorld.style.width = `${worldWidth}px`;
    roadWorld.style.height = `${worldHeight}px`;
    cacheHomeCollisionPixels();
    updateCollisionDebugOverlay();

    if (pendingSpawn) {
        player.x = pendingSpawn.map === "whiteRoad"
            ? PLAYER_WIDTH / 2 + 60
            : worldWidth * (HOME_EXIT_ZONE.left - 0.05);
        player.y = pendingSpawn.map === "whiteRoad"
            ? worldHeight * 0.64
            : clamp(homeReturnY, PLAYER_HEIGHT, worldHeight);
        grandmotherActor.hidden = pendingSpawn.map !== "home";
        pendingSpawn = null;
    }

    player.x = clamp(player.x, PLAYER_WIDTH / 2, worldWidth - PLAYER_WIDTH / 2);
    player.y = clamp(player.y, PLAYER_HEIGHT, worldHeight);
    updateActorPositions();
    updateCamera();
}

function isInsideHomeExitZoneBounds() {
    return player.x >= worldWidth * HOME_EXIT_ZONE.left
        && player.x <= worldWidth * HOME_EXIT_ZONE.right
        && player.y >= worldHeight * HOME_EXIT_ZONE.top
        && player.y <= worldHeight * HOME_EXIT_ZONE.bottom;
}

function isInsideHomeExitZone() {
    return currentMap === "home" && homePortalArmed && isInsideHomeExitZoneBounds();
}

function isInsideWhiteRoadReturnZone() {
    if (currentMap !== "whiteRoad") return false;

    return player.x >= worldWidth * WHITE_ROAD_RETURN_ZONE.left
        && player.x <= worldWidth * WHITE_ROAD_RETURN_ZONE.right
        && player.y >= worldHeight * WHITE_ROAD_RETURN_ZONE.top
        && player.y <= worldHeight * WHITE_ROAD_RETURN_ZONE.bottom;
}

function transitionToWhiteRoad() {
    if (currentMap !== "home") return;

    homeReturnY = player.y;
    currentMap = "whiteRoad";
    homePortalArmed = false;
    pendingSpawn = { map: "whiteRoad" };
    pressedKeys.clear();
    roadMap.src = MAP_PATHS.whiteRoad;
}

function transitionToHome() {
    if (currentMap !== "whiteRoad") return;

    currentMap = "home";
    homePortalArmed = false;
    pendingSpawn = { map: "home" };
    pressedKeys.clear();
    roadMap.src = MAP_PATHS.home;
}

function updateCamera() {
    const viewportWidth = roadViewport.clientWidth;
    const viewportHeight = roadViewport.clientHeight;
    if (!viewportWidth || !viewportHeight) return;

    const fitScale = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight);
    cameraScale = fitScale * ZOOM_LEVEL;
    const scaledWidth = worldWidth * cameraScale;
    const scaledHeight = worldHeight * cameraScale;
    const cameraX = clamp(
        viewportWidth / 2 - player.x * cameraScale,
        viewportWidth - scaledWidth,
        0,
    );
    const cameraY = clamp(
        viewportHeight / 2 - player.y * cameraScale,
        viewportHeight - scaledHeight,
        0,
    );

    roadWorld.style.transform = `translate3d(${cameraX}px, ${cameraY}px, 0) scale(${cameraScale})`;
}

function distanceToGrandmother() {
    return Math.hypot(player.x - grandmother.x, player.y - grandmother.y);
}

function openDialog() {
    if (dialogOpen) return;
    dialogOpen = true;
    dialog.hidden = false;
    dialogText.textContent = "";
    typedCharacters = 0;
    window.clearInterval(typewriterTimer);
    typewriterTimer = window.setInterval(() => {
        typedCharacters += 1;
        dialogText.textContent = GRANDMOTHER_LINE.slice(0, typedCharacters);
        if (typedCharacters >= GRANDMOTHER_LINE.length) {
            window.clearInterval(typewriterTimer);
            typewriterTimer = null;
        }
    }, TYPEWRITER_DELAY);
}

function closeDialog() {
    if (!dialogOpen) return;
    dialogOpen = false;
    window.clearInterval(typewriterTimer);
    typewriterTimer = null;
    dialog.hidden = true;
    if (distanceToGrandmother() <= TOUCH_DISTANCE) {
        suppressTouchDialog = true;
    }
    if (isRoadActive()) roadViewport.focus({ preventScroll: true });
}

function handleRoadKeyDown(event) {
    if (!isRoadActive()) return;

    const key = getKeyName(event);
    if (event.code === "F2") {
        event.preventDefault();
        collisionDebugVisible = !collisionDebugVisible;
        updateCollisionDebugOverlay();
        return;
    }
    if (key === "e") {
        event.preventDefault();
        if (!dialogOpen && distanceToGrandmother() <= INTERACTION_DISTANCE) {
            openDialog();
        }
        return;
    }

    if (event.code === "Space") {
        event.preventDefault();
        if (dialogOpen) {
            closeDialog();
        } else if (distanceToGrandmother() <= INTERACTION_DISTANCE) {
            openDialog();
        }
        return;
    }

    if (!MOVE_KEYS.has(key)) return;
    event.preventDefault();
    if (dialogOpen) return;

    pressedKeys.add(key);
    setFacingFromMovement(getMovement());
}

function handleRoadKeyUp(event) {
    pressedKeys.delete(getKeyName(event));
}

function updatePlayer(deltaSeconds) {
    if (dialogOpen) return;

    const movement = getMovement();
    if (movement.x === 0 && movement.y === 0) return;

    const length = Math.hypot(movement.x, movement.y);
    const speed = MOVE_SPEED / cameraScale;
    const nextX = clamp(
        player.x + (movement.x / length) * speed * deltaSeconds,
        PLAYER_COLLISION_HALF_WIDTH,
        worldWidth - PLAYER_COLLISION_HALF_WIDTH,
    );
    const nextY = clamp(
        player.y + (movement.y / length) * speed * deltaSeconds,
        PLAYER_COLLISION_HALF_HEIGHT,
        worldHeight,
    );

    if (currentMap !== "home" || canOccupyHomePosition(nextX, player.y)) player.x = nextX;
    if (currentMap !== "home" || canOccupyHomePosition(player.x, nextY)) player.y = nextY;

    updateActorPositions();

    if (currentMap === "home" && !homePortalArmed && !isInsideHomeExitZoneBounds()) {
        homePortalArmed = true;
    }

    if (isInsideHomeExitZone()) {
        transitionToWhiteRoad();
        return;
    }
    if (isInsideWhiteRoadReturnZone()) {
        transitionToHome();
        return;
    }

    const distance = distanceToGrandmother();
    if (distance > TOUCH_DISTANCE) {
        suppressTouchDialog = false;
    } else if (!suppressTouchDialog) {
        openDialog();
    }
}

function renderFrame(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
    lastFrameTime = timestamp;

    if (isRoadActive()) {
        updatePlayer(deltaSeconds);
        updateCamera();
    }

    window.requestAnimationFrame(renderFrame);
}

window.addEventListener("keydown", handleRoadKeyDown);
window.addEventListener("keyup", handleRoadKeyUp);
window.addEventListener("blur", () => pressedKeys.clear());
window.addEventListener("resize", updateCamera);
roadMap.addEventListener("load", updateWorldSize);

if (roadMap.complete) updateWorldSize();
updateActorPositions();
window.requestAnimationFrame(renderFrame);

export function enterRoad() {
    roadSection.classList.replace("screen", "screen-active");
    updateCamera();
    roadViewport.focus({ preventScroll: true });
}

export function exitRoad() {
    roadSection.classList.replace("screen-active", "screen");
    pressedKeys.clear();
    closeDialog();
}


