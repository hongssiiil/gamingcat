const roadSection = document.querySelector("#Road");
const roadViewport = document.querySelector("#road-viewport");
const roadWorld = document.querySelector("#road-world");
const roadMap = document.querySelector("#road-map");
const roadSign = document.querySelector("#road-sign");
const roadSignTrigger = document.querySelector("#road-sign-trigger");
const roadSignOverlay = document.querySelector("#road-sign-overlay");
const roadSignCopy = document.querySelector("#road-sign-copy");
const roadSignClose = document.querySelector("#road-sign-close");
const roadSignConfirm = document.querySelector("#road-sign-confirm");
const playerActor = document.querySelector("#road-player");
const playerSprite = document.querySelector("#road-player-sprite");
const catActor = document.querySelector("#road-cat");
const catSprite = document.querySelector("#road-cat-sprite");
const grandmotherActor = document.querySelector("#road-grandmother");
const dialog = document.querySelector("#road-dialog");
const dialogText = document.querySelector("#road-dialog-text");
const dialogPortrait = document.querySelector("#road-dialog-portrait");
const dialogPortraitImage = document.querySelector("#road-dialog-portrait-image");
const dialogSpeaker = document.querySelector("#road-dialog-speaker");
const dialogChoices = document.querySelector("#road-dialog-choices");
const nameScreen = document.querySelector("#road-name-screen");
const playerNameInput = document.querySelector("#road-player-name");
const nameError = document.querySelector("#road-name-error");

const MOVE_KEYS = new Set([
    "arrowup", "arrowdown", "arrowleft", "arrowright",
    "w", "a", "s", "d",
]);
const MOVE_SPEED = 345;
const WALK_FRAME_INTERVAL = 0.175;
const ZOOM_LEVEL = 1.5;
const INTERACTION_DISTANCE = 132;
const TOUCH_DISTANCE = 42;
const PLAYER_WIDTH = 78;
const PLAYER_HEIGHT = 86;
const ROAD_SIGN_POSITION = { x: 400, yRatio: 0.647 };
const FOREST_WALK_BEFORE_DIALOG = 96;
const SIGN_INTERACTION_DISTANCE = 118;
const CAT_ENTRY_SPEED = 180;
const CAT_FOLLOW_SPEED = 145;
const CAT_RECOMMENDATION_OFFSET = 210;
const CAT_FOLLOW_DELAY = 1.5;
const CAT_FOLLOW_START_DISTANCE = 12;
const FOREST_ROUTE_ENTRY_DISTANCE = 72;
const FOREST_ROUTE_POINTS = {
    up: { x: 0.43, y: 0.24 },
    right: { x: 1.0, y: 0.65 },
    down: { x: 0.48, y: 1.0 },
};
const ANCIENT_SIGN_TEXT = "(@#$^*&$*&#@(^(*&)#*$)(*&(@#& ?\n^ : @&#)!(@*&#\n> : (#*@(*#(*@))@\nU : *%(*&(*#(*@";
const FOREST_ROUTES = [
    {
        key: "up",
        title: "위쪽 길",
        description: "부모의 의사를 존중해 혼자 살게 두고 개입을 최소화한다.",
    },
    {
        key: "right",
        title: "오른쪽 길",
        description: "부모의 거부에도 불구하고 요양시설에 강제 입소시킨다.",
    },
    {
        key: "down",
        title: "아래쪽 길",
        description: "자녀 중 한 명이 직장과 개인 삶을 포기하고 들어가 상주 돌봄을 수행한다.",
    },
];
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
const DIALOGUE_ENTRIES = {
    grandmother: {
        speaker: "grandmother",
        text: "우리 소중한 {name} 왔구나. 할머니가 나이가 있는데 텃밭일을 하느라 좀 피곤하구나… 가끔은 은퇴하고 싶다는 생각도 드네.",
    },
};
const SPEAKER_PORTRAITS = {
    grandmother: {
        src: "./images/character/grandmother/grandmother.png",
        alt: "할머니 초상화",
    },
    player: {
        src: "./images/character/player/player.png",
        alt: "플레이어 초상화",
    },
    cat: {
        src: "./images/character/cat/cat.png",
        alt: "티니 초상화",
    },
};
const TYPEWRITER_DELAY = 55;

export const journeyChoiceHistory = [];
try {
    const savedChoices = JSON.parse(sessionStorage.getItem("gamingCatJourneyChoices") || "[]");
    if (Array.isArray(savedChoices)) journeyChoiceHistory.push(...savedChoices);
} catch {
    // The scene remains playable when browser storage is unavailable.
}

const spritePaths = {
    idle: "./images/character/player/player.png",
    front: "./images/character/player/player_front.png",
    back: "./images/character/player/player_back.png",
    side: "./images/character/player/player_side.png",
    diagonal: "./images/character/player/player_diagonal.png",
    frontWalkLeft: "./images/character/player/player-front-walk-frame.png",
    frontWalkRight: "./images/character/player/player-front-walk-frame-right-forward.png",
    backWalkLeft: "./images/character/player/player_back_left.png",
    backWalkRight: "./images/character/player/player_back_right.png",
    sideWalk: "./images/character/player/player-side-walk-frame.png",
};
const WALK_SEQUENCES = {
    front: [spritePaths.front, spritePaths.frontWalkLeft, spritePaths.front, spritePaths.frontWalkRight],
    back: [spritePaths.back, spritePaths.backWalkLeft, spritePaths.back, spritePaths.backWalkRight],
    side: [spritePaths.side, spritePaths.sideWalk],
};
const catSpritePaths = {
    front: "./images/character/cat/cat_front.png",
    frontWalkA: "./images/character/cat/cat-front-squash-more.png",
    frontWalkB: "./images/character/cat/cat-front-mid-bounce-consistent.png",
    back: "./images/character/cat/cat_back.png",
    backWalkA: "./images/character/cat/cat-back-squash-more.png",
    backWalkB: "./images/character/cat/cat_back_squash.png",
    side: "./images/character/cat/cat_side.png",
    sideWalkA: "./images/character/cat/cat-side-squash-more.png",
    sideWalkB: "./images/character/cat/cat-side-squash.png",
    diagonal: "./images/character/cat/cat_diagonal.png",
};

const pressedKeys = new Set();
const player = { x: 744, y: 842 };
const cat = { x: 684, y: 842 };
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
let walkAnimationDirection = null;
let walkAnimationElapsed = 0;
let walkAnimationFrameIndex = 0;
let catFacing = "front";
let catFacingLeft = false;
let catWalkDirection = null;
let catWalkElapsed = 0;
let catWalkFrameIndex = 0;
let catVisible = false;
let catMotion = { mode: "hidden", targetX: 0, targetY: 0, waitElapsed: 0 };
let dialogOpen = false;
let signOverlayOpen = false;
let signOverlayOnClose = null;
let suppressTouchDialog = false;
let typewriterTimer = null;
let typedCharacters = 0;
let playerName = "";
let storyStarted = false;
let activeLine = null;
let dialogueQueue = [];
let choicesVisible = false;
let resumeConcern = false;
let forestScenePhase = "not-arrived";
let forestWalkDistance = 0;
let forestSignTranslated = false;
let selectedForestRoute = null;
let forestBattlePortalEntered = false;

export function getCurrentRoadBattleBackground() {
    return currentMap === "whiteRoad"
        ? "./images/battle/battle_bg_white.png"
        : "./images/battle/battle_bg_green.png";
}

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

function updateWalkAnimation(movement, deltaSeconds) {
    const direction = movement.x === 0 && movement.y > 0
        ? "front"
        : movement.x === 0 && movement.y < 0
            ? "back"
            : movement.y === 0 && movement.x > 0
                ? "sideRight"
                : movement.y === 0 && movement.x < 0
                    ? "sideLeft"
                    : null;

    if (direction) {
        if (walkAnimationDirection !== direction) {
            walkAnimationDirection = direction;
            walkAnimationElapsed = 0;
            walkAnimationFrameIndex = 0;
        }

        const baseFacing = direction.startsWith("side") ? "side" : direction;
        const sequence = WALK_SEQUENCES[baseFacing];
        walkAnimationElapsed += deltaSeconds;
        while (walkAnimationElapsed >= WALK_FRAME_INTERVAL) {
            walkAnimationElapsed -= WALK_FRAME_INTERVAL;
            walkAnimationFrameIndex = (walkAnimationFrameIndex + 1) % sequence.length;
        }

        facing = baseFacing;
        facingLeft = direction === "sideLeft";
        playerSprite.src = sequence[walkAnimationFrameIndex];
        playerSprite.classList.toggle("is-facing-left", facingLeft);
        return;
    }

    if (walkAnimationDirection === null) return;

    const stoppedDirection = walkAnimationDirection;
    walkAnimationDirection = null;
    walkAnimationElapsed = 0;
    walkAnimationFrameIndex = 0;
    if (movement.x === 0 && movement.y === 0) {
        const baseFacing = stoppedDirection.startsWith("side") ? "side" : stoppedDirection;
        facing = baseFacing;
        facingLeft = stoppedDirection === "sideLeft";
        playerSprite.src = spritePaths[baseFacing];
        playerSprite.classList.toggle("is-facing-left", facingLeft);
    }
}

function updateCatAnimation(movement, deltaSeconds) {
    const direction = movement.x === 0 && movement.y > 0
        ? "front"
        : movement.x === 0 && movement.y < 0
            ? "back"
            : movement.y === 0 && movement.x !== 0
                ? "side"
                : movement.x !== 0 && movement.y !== 0
                    ? "diagonal"
                    : null;

    if (!direction) {
        catWalkDirection = null;
        catWalkElapsed = 0;
        catWalkFrameIndex = 0;
        catActor.classList.remove("is-diagonal-walking");
        catSprite.src = catSpritePaths[catFacing];
        catSprite.classList.toggle("is-facing-left", catFacingLeft);
        return;
    }

    if (direction !== catWalkDirection) {
        catWalkDirection = direction;
        catWalkElapsed = 0;
        catWalkFrameIndex = 0;
    }

    catFacing = direction;
    catFacingLeft = direction === "side" ? movement.x < 0 : direction === "diagonal" && movement.x < 0;
    catActor.classList.toggle("is-diagonal-walking", direction === "diagonal");

    if (direction === "diagonal") {
        catSprite.src = catSpritePaths.diagonal;
    } else {
        const frames = direction === "front"
            ? [catSpritePaths.frontWalkA, catSpritePaths.frontWalkB]
            : direction === "back"
                ? [catSpritePaths.backWalkA, catSpritePaths.backWalkB]
                : [catSpritePaths.sideWalkA, catSpritePaths.sideWalkB];
        catWalkElapsed += deltaSeconds;
        while (catWalkElapsed >= WALK_FRAME_INTERVAL) {
            catWalkElapsed -= WALK_FRAME_INTERVAL;
            catWalkFrameIndex = (catWalkFrameIndex + 1) % frames.length;
        }
        catSprite.src = frames[catWalkFrameIndex];
    }
    catSprite.classList.toggle("is-facing-left", catFacingLeft);
}

function updateActorPositions() {
    playerActor.style.left = `${player.x}px`;
    playerActor.style.top = `${player.y}px`;
    catActor.hidden = !catVisible || currentMap !== "whiteRoad";
    catActor.style.left = `${cat.x}px`;
    catActor.style.top = `${cat.y}px`;
    // Top-down depth follows the actors' foot positions: the lower actor is drawn in front.
    const playerIsInFront = player.y >= cat.y;
    playerActor.style.zIndex = playerIsInFront ? "3" : "2";
    catActor.style.zIndex = playerIsInFront ? "2" : "3";
    roadSign.style.left = `${ROAD_SIGN_POSITION.x}px`;
    roadSign.style.top = `${worldHeight * ROAD_SIGN_POSITION.yRatio}px`;
    roadSign.hidden = currentMap !== "whiteRoad";
    roadSignTrigger.style.left = `${ROAD_SIGN_POSITION.x}px`;
    roadSignTrigger.style.top = `${worldHeight * ROAD_SIGN_POSITION.yRatio}px`;
    roadSignTrigger.hidden = currentMap !== "whiteRoad"
        || !canInteractWithSignInCurrentPhase()
        || signOverlayOpen
        || Math.hypot(player.x - ROAD_SIGN_POSITION.x, player.y - worldHeight * ROAD_SIGN_POSITION.yRatio) > SIGN_INTERACTION_DISTANCE;
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
        cat.x = clamp(player.x - 60, PLAYER_WIDTH / 2, worldWidth - PLAYER_WIDTH / 2);
        cat.y = player.y;
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
    if (forestScenePhase === "not-arrived") {
        forestScenePhase = "walking-to-intro";
        forestWalkDistance = 0;
        catVisible = false;
        catMotion.mode = "hidden";
    }
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

function distanceToSign() {
    return Math.hypot(player.x - ROAD_SIGN_POSITION.x, player.y - worldHeight * ROAD_SIGN_POSITION.yRatio);
}

function canInteractWithSignInCurrentPhase() {
    return forestScenePhase === "waiting-sign"
        || (forestSignTranslated && ["exploring-routes", "route-selected"].includes(forestScenePhase));
}

function recordForestRoute(route) {
    const routeData = FOREST_ROUTES.find((entry) => entry.key === route);
    if (!routeData) return;

    const record = {
        scene: "forest-entrance",
        path: routeData.key,
        label: routeData.title,
        description: routeData.description,
        recommended: "right",
    };
    journeyChoiceHistory.push(record);
    try {
        sessionStorage.setItem("gamingCatJourneyChoices", JSON.stringify(journeyChoiceHistory));
    } catch {
        // Keep the in-memory record even when browser storage is unavailable.
    }
}

function renderSignCopy(translated) {
    roadSignCopy.replaceChildren();
    if (!translated) {
        const script = document.createElement("pre");
        script.className = "ancient-script";
        script.textContent = ANCIENT_SIGN_TEXT;
        roadSignCopy.append(script);
        return;
    }

    const question = document.createElement("p");
    question.textContent = "기억력 감퇴와 사고 위험이 반복되는 고령의 부모님. 가족의 불안은 커지지만, 부모님은 “평생 살아온 집에서 내 방식대로 마지막을 맞이하겠다”며 시설 입소와 동거를 완강히 거부하신다. 당신은 어떤 길을 선택하겠습니까?";
    roadSignCopy.append(question);
    for (const route of FOREST_ROUTES) {
        const heading = document.createElement("h3");
        heading.textContent = route.title;
        const description = document.createElement("p");
        description.textContent = route.description;
        roadSignCopy.append(heading, description);
    }
}

function openSignOverlay(translated, onClose = null) {
    signOverlayOpen = true;
    signOverlayOnClose = onClose;
    renderSignCopy(translated);
    roadSignOverlay.hidden = false;
    roadSignConfirm.focus();
    updateActorPositions();
}

function interactWithSign() {
    if (currentMap !== "whiteRoad" || !canInteractWithSignInCurrentPhase() || distanceToSign() > SIGN_INTERACTION_DISTANCE) return;
    if (forestScenePhase === "waiting-sign") {
        forestScenePhase = "ancient-sign-open";
        openSignOverlay(false, beginAfterSignThoughts);
        return;
    }
    openSignOverlay(true);
}

function closeSignOverlay() {
    if (!signOverlayOpen) return;
    signOverlayOpen = false;
    roadSignOverlay.hidden = true;
    const onClose = signOverlayOnClose;
    signOverlayOnClose = null;
    updateActorPositions();
    if (onClose) onClose();
    if (!dialogOpen) roadViewport.focus({ preventScroll: true });
}

function beginForestWalkIntro() {
    forestScenePhase = "walk-intro";
    dialogueQueue = [
        { speaker: "player", text: "가라고 해서 왔는데 내가 어디를 가는지 모르겠네." },
        {
            speaker: "player",
            text: "저기 표지판이 있어. 가보자!",
            onComplete: () => {
                forestScenePhase = "waiting-sign";
                closeDialog();
                updateActorPositions();
            },
        },
    ];
    showLine(dialogueQueue.shift());
}

function beginAfterSignThoughts() {
    forestScenePhase = "after-sign-thoughts";
    dialogueQueue = [
        { speaker: "player", text: "뭐라고 쓰여 있는 거지? 질문에 맞는 답으로 갈림길을 선택해야 하는 것 같아… 근데 무슨 소리인지 모르겠어." },
        {
            speaker: "player",
            text: "내가 선택하는 것이 맞을까? 내가 잘못된 길을 선택하면 어떡하지? 어디로 가야 할지 모르겠어.",
            onComplete: beginCatEntrance,
        },
    ];
    showLine(dialogueQueue.shift());
}

function beginCatEntrance() {
    closeDialog();
    forestScenePhase = "cat-entering";
    catVisible = true;
    cat.x = Math.min(worldWidth - PLAYER_WIDTH / 2, player.x + roadViewport.clientWidth / Math.max(cameraScale, 0.1) / 2 + 48);
    cat.y = player.y;
    catMotion = { mode: "entering", targetX: player.x + 54, targetY: player.y, waitElapsed: 0 };
    updateActorPositions();
}

function beginTinaEncounter() {
    forestScenePhase = "tina-dialogue";
    catMotion.mode = "near-player";
    dialogueQueue = [
        { speaker: "player", text: "넌 누구야?" },
        { speaker: "cat", text: "난 티니야. 고양이지. 숲속의 모든 기록과 길을 알고 있다고 주위에서 그러더라. 너무 믿지는 말고~" },
        {
            speaker: "cat",
            text: "일단 내가 그 표지판을 해석해 줄게~",
            onComplete: () => {
                closeDialog();
                forestSignTranslated = true;
                forestScenePhase = "translated-sign";
                openSignOverlay(true, beginTinaRecommendation);
            },
        },
    ];
    showLine({ speaker: "cat", text: "표지판을 못 읽어서 헤매고 있나 보네." });
}

function beginTinaRecommendation() {
    forestScenePhase = "recommendation";
    dialogueQueue = [];
    catMotion.mode = "moving-to-recommendation-wait";
    catMotion.targetX = clamp(cat.x + CAT_RECOMMENDATION_OFFSET, PLAYER_WIDTH / 2, worldWidth - PLAYER_WIDTH / 2);
    catMotion.targetY = cat.y;
    showLine({
        speaker: "cat",
        text: "흠.. 이 상황에서는 오른쪽 길을 추천해~ 네 죄책감보다 사고 위험을 막는 것이 더 효율적이야.",
        onComplete: () => {
            forestScenePhase = "exploring-routes";
            closeDialog();
            armCatFollowAfterRecommendation();
        },
    });
}

function startCatWaitingForPlayerMovement() {
    catMotion.mode = "waiting-for-player-movement";
    catMotion.waitElapsed = 0;
    catMotion.playerMovedDistance = 0;
    catMotion.lastPlayerX = player.x;
    catMotion.lastPlayerY = player.y;
}

function armCatFollowAfterRecommendation() {
    catMotion.followArmed = true;
    if (catMotion.mode === "waiting-for-recommendation") {
        startCatWaitingForPlayerMovement();
    }
}

function recordForestRouteAtPlayerPosition() {
    const route = FOREST_ROUTES.find(({ key }) => {
        const routePoint = FOREST_ROUTE_POINTS[key];
        return Math.hypot(
            player.x - worldWidth * routePoint.x,
            player.y - worldHeight * routePoint.y,
        ) <= FOREST_ROUTE_ENTRY_DISTANCE;
    });
    if (!route) {
        forestBattlePortalEntered = false;
        return;
    }

    if (!selectedForestRoute && forestScenePhase === "exploring-routes") {
        selectedForestRoute = route.key;
        forestScenePhase = "route-selected";
        recordForestRoute(route.key);
    }
    if (forestBattlePortalEntered) return;

    forestBattlePortalEntered = true;
    // TEMP FOREST BATTLE TRANSITION START
    window.dispatchEvent(new CustomEvent("gamingcat:temporary-forest-battle"));
    // TEMP FOREST BATTLE TRANSITION END
}

function faceCatTowardPlayer() {
    const dx = player.x - cat.x;
    const dy = player.y - cat.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        catFacing = "side";
        catFacingLeft = dx < 0;
    } else {
        catFacing = dy < 0 ? "back" : "front";
        catFacingLeft = false;
    }
    updateCatAnimation({ x: 0, y: 0 }, 0);
}

function updateCatMotion(deltaSeconds) {
    if (!catVisible || currentMap !== "whiteRoad") return;
    if (catMotion.mode === "waiting-for-player-movement") {
        const playerStep = Math.hypot(player.x - catMotion.lastPlayerX, player.y - catMotion.lastPlayerY);
        catMotion.playerMovedDistance += playerStep;
        catMotion.lastPlayerX = player.x;
        catMotion.lastPlayerY = player.y;
        faceCatTowardPlayer();
        if (catMotion.playerMovedDistance >= CAT_FOLLOW_START_DISTANCE) {
            catMotion.mode = "waiting-to-follow";
            catMotion.waitElapsed = 0;
        }
        return;
    }
    if (catMotion.mode === "waiting-to-follow") {
        catMotion.waitElapsed += deltaSeconds;
        if (catMotion.waitElapsed >= CAT_FOLLOW_DELAY) catMotion.mode = "following-player";
        faceCatTowardPlayer();
        return;
    }
    if (catMotion.mode === "near-player" || catMotion.mode === "waiting-for-recommendation" || catMotion.mode === "hidden") {
        if (catMotion.mode !== "hidden") faceCatTowardPlayer();
        else updateCatAnimation({ x: 0, y: 0 }, deltaSeconds);
        return;
    }

    let targetX = catMotion.targetX;
    let targetY = catMotion.targetY;
    if (catMotion.mode === "entering") {
        targetX = player.x + 54;
        targetY = player.y;
    }
    if (catMotion.mode === "following-player") {
        if (selectedForestRoute === "up") {
            targetX = player.x;
            targetY = player.y + 58;
        } else if (selectedForestRoute === "down") {
            targetX = player.x;
            targetY = player.y - 58;
        } else {
            targetX = player.x - 58;
            targetY = player.y;
        }
    }

    const dx = targetX - cat.x;
    const dy = targetY - cat.y;
    const distance = Math.hypot(dx, dy);
    const arrivalDistance = catMotion.mode === "entering"
        ? 12
        : catMotion.mode === "following-player"
            ? 1
            : 8;
    if (distance <= arrivalDistance) {
        cat.x = targetX;
        cat.y = targetY;
        if (catMotion.mode === "entering") {
            catMotion.mode = "near-player";
            beginTinaEncounter();
        } else if (catMotion.mode === "moving-to-recommendation-wait") {
            catMotion.mode = "waiting-for-recommendation";
            faceCatTowardPlayer();
            if (catMotion.followArmed) startCatWaitingForPlayerMovement();
        }
        updateActorPositions();
        updateCatAnimation({ x: 0, y: 0 }, deltaSeconds);
        return;
    }

    const speed = catMotion.mode === "following-player"
        ? Math.max(CAT_FOLLOW_SPEED, (MOVE_SPEED / Math.max(cameraScale, 0.1)) * 1.25)
        : catMotion.mode === "entering"
            ? Math.max(CAT_ENTRY_SPEED, Math.hypot(getMovement().x, getMovement().y) * MOVE_SPEED / cameraScale + CAT_ENTRY_SPEED)
            : CAT_ENTRY_SPEED;
    const moveDistance = Math.min(distance, speed * deltaSeconds);
    const movement = { x: dx / distance, y: dy / distance };
    cat.x += movement.x * moveDistance;
    cat.y += movement.y * moveDistance;
    updateActorPositions();
    updateCatAnimation(movement, deltaSeconds);
}

function setDialogueSpeaker(speaker) {
    const portrait = SPEAKER_PORTRAITS[speaker];
    dialogSpeaker.textContent = speaker === "system" ? "안내" : speaker === "grandmother" ? "할머니" : speaker === "player" ? playerName : speaker === "cat" ? "티니" : "";
    dialogSpeaker.hidden = !dialogSpeaker.textContent;
    if (!portrait) {
        dialogPortrait.hidden = true;
        dialogPortraitImage.removeAttribute("src");
        dialogPortraitImage.alt = "";
        return;
    }

    dialogPortraitImage.src = portrait.src;
    dialogPortraitImage.alt = portrait.alt;
    dialogPortrait.hidden = false;
}

dialogPortraitImage.addEventListener("error", () => {
    dialogPortrait.hidden = true;
});

function showLine(line) {
    activeLine = line;
    dialogOpen = true;
    dialog.hidden = false;
    dialog.classList.remove("has-route-choice");
    dialogChoices.hidden = true;
    dialogChoices.replaceChildren();
    choicesVisible = false;
    setDialogueSpeaker(line.speaker);
    dialogText.textContent = "";
    typedCharacters = 0;
    window.clearInterval(typewriterTimer);
    typewriterTimer = window.setInterval(() => {
        typedCharacters += 1;
        dialogText.textContent = line.text.slice(0, typedCharacters);
        if (typedCharacters >= line.text.length) {
            window.clearInterval(typewriterTimer);
            typewriterTimer = null;
        }
    }, TYPEWRITER_DELAY);
}

function showChoices(options) {
    window.clearInterval(typewriterTimer);
    typewriterTimer = null;
    choicesVisible = true;
    dialogChoices.replaceChildren();
    const isRouteChoice = options.some((option) => Boolean(option.route));
    dialogChoices.classList.toggle("is-route-choice", isRouteChoice);
    dialog.classList.toggle("has-route-choice", isRouteChoice);
    for (const option of options) {
        const button = document.createElement("button");
        button.type = "button";
        if (option.route) {
            const title = document.createElement("span");
            title.className = "road-route-title";
            title.textContent = option.title;
            const description = document.createElement("span");
            description.className = "road-route-description";
            description.textContent = option.description;
            button.append(title, description);
        } else {
            button.textContent = option.label;
        }
        button.addEventListener("click", () => {
            if (!choicesVisible) return;
            choicesVisible = false;
            dialogChoices.hidden = true;
            option.onSelect?.();
            showLine({
                speaker: "player",
                text: option.spokenText || option.label,
                closeAfterComplete: option.closeAfterComplete,
                onComplete: option.onComplete,
            });
            dialogueQueue = option.next();
        }, { once: true });
        dialogChoices.append(button);
    }
    dialogChoices.hidden = false;
}

function advanceDialogue() {
    if (!dialogOpen || choicesVisible) return;
    if (typewriterTimer) {
        window.clearInterval(typewriterTimer);
        typewriterTimer = null;
        dialogText.textContent = activeLine.text;
        return;
    }
    if (activeLine?.onComplete) {
        const onComplete = activeLine.onComplete;
        activeLine.onComplete = null;
        onComplete();
        return;
    }
    if (activeLine?.closeAfterComplete) {
        resumeConcern = true;
        storyStarted = false;
        closeDialog();
        return;
    }
    const next = dialogueQueue.shift();
    if (!next) {
        closeDialog();
        return;
    }
    if (next.choices) showChoices(next.choices);
    else showLine(next);
}

function beginGrandmotherStory() {
    const opening = DIALOGUE_ENTRIES.grandmother.text.replace("{name}", playerName);
    storyStarted = true;
    dialogueQueue = [
        { speaker: "player", text: "할머니. 건강 조심하세요." },
        { speaker: "grandmother", text: "철수 어멈한테 들었는데 철수는 벌써 시험에 합격해서 공직이 되었단다. 네 나이 때쯤이면 집안을 빛낼 만한 일을 하나쯤 하곤 하지…" },
        {
            choices: [
                { label: "저도 그 정도는 할 수 있어요.", next: () => [{ speaker: "grandmother", text: "그래, 네가 해낼 거라고 믿는단다. 그러면 저 숲을 건너 사냥꾼 칭호를 받는 건 어떠니?" }, ...commonProposal] },
                { label: "하지만 저는 겁이 나요. 자신이 없어요.", next: () => [{ speaker: "grandmother", text: "겁이 나는 건 당연해. 하지만 다들 처음엔 그랬단다. 민수도, 영희도 결국 해냈어. 너도 할 수 있을 거야." }, ...commonProposal] },
            ]
        },
    ];
    showLine({ speaker: "grandmother", text: opening });
}

const commonProposal = [
    { speaker: "grandmother", text: "정부에서 저 숲을 건너기만 하고 보고만 하면, 마을 경비에 지원할 기회를 주겠대. 집안의 큰 자랑이 될 거야." },
    { speaker: "player", text: "아니, 이건 기회지 된다는 보장도 아니지 않아요?" },
    { speaker: "grandmother", text: "그래도 이건 기본이야. 아무튼 어떻게 생각하니?" },
    {
        choices: [
            { label: "당연히 갈 수 있어요.", next: () => [{ speaker: "grandmother", text: "숲으로 가려면 오른쪽 끝에 갈색길로 가렴. 네가 해낼 거라는 걸 모두에게 보여주렴." }] },
            { label: "저는 아직 고민할 시간이 필요해요.", next: () => comparisonRound() },
        ]
    },
];

const comparisons = ["민호는 당근 코인 대박 났다는데…", "영희는 달걀 연구실에 합격했다는데…", "지금 나이가 몇인데 아직도 고민하니…", "영호는 양털 회사 최종 합격했다는데…"];
let comparisonIndex = 0;
function comparisonRound() {
    const comparison = comparisons[comparisonIndex++ % comparisons.length];
    return [
        { speaker: "grandmother", text: comparison },
        {
            choices: [
                { label: "숲에 갈게요, 그럼.", next: () => [{ speaker: "grandmother", text: "숲으로 가려면 오른쪽 끝에 갈색길로 가렴. 네가 해낼 거라는 걸 모두에게 보여주렴." }] },
                { label: "그래도 무서워.", closeAfterComplete: true, next: () => [] },
            ]
        },
    ];
}

function openDialog() {
    if (dialogOpen) return;
    if (resumeConcern) {
        resumeConcern = false;
        storyStarted = true;
        dialogueQueue = comparisonRound();
        showLine(dialogueQueue.shift());
        return;
    }
    if (storyStarted) return;
    beginGrandmotherStory();
}

function closeDialog() {
    if (!dialogOpen) return;
    dialogOpen = false;
    window.clearInterval(typewriterTimer);
    typewriterTimer = null;
    dialogPortrait.hidden = true;
    dialogSpeaker.hidden = true;
    dialogChoices.hidden = true;
    dialogChoices.replaceChildren();
    dialogChoices.classList.remove("is-route-choice");
    dialog.classList.remove("has-route-choice");
    choicesVisible = false;
    dialog.hidden = true;
    if (distanceToGrandmother() <= TOUCH_DISTANCE) {
        suppressTouchDialog = true;
    }
    if (isRoadActive()) roadViewport.focus({ preventScroll: true });
}

function handleRoadKeyDown(event) {
    if (!isRoadActive()) return;
    if (event.target === playerNameInput) return;

    const key = getKeyName(event);
    if (signOverlayOpen) {
        if (event.code === "Escape") {
            event.preventDefault();
            closeSignOverlay();
        } else if (event.code === "Space" || event.code === "Enter") {
            if (event.target instanceof HTMLButtonElement) return;
            event.preventDefault();
            closeSignOverlay();
        }
        return;
    }
    if (event.code === "F2") {
        event.preventDefault();
        collisionDebugVisible = !collisionDebugVisible;
        updateCollisionDebugOverlay();
        return;
    }
    if (key === "e") {
        event.preventDefault();
        if (!dialogOpen && currentMap === "whiteRoad") {
            interactWithSign();
        } else if (!dialogOpen && currentMap === "home" && distanceToGrandmother() <= INTERACTION_DISTANCE) {
            openDialog();
        }
        return;
    }

    if (event.code === "Space") {
        if (dialogOpen) {
            if (choicesVisible && event.target instanceof HTMLButtonElement) return;
            event.preventDefault();
            advanceDialogue();
        } else if (event.target === roadViewport && currentMap === "whiteRoad") {
            event.preventDefault();
            interactWithSign();
        } else if (event.target === roadViewport && currentMap === "home" && distanceToGrandmother() <= INTERACTION_DISTANCE) {
            event.preventDefault();
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
    const movement = getMovement();
    if (dialogOpen) {
        updateWalkAnimation({ x: 0, y: 0 }, deltaSeconds);
        return;
    }
    if (movement.x === 0 && movement.y === 0) {
        updateWalkAnimation(movement, deltaSeconds);
        return;
    }

    const previousX = player.x;
    const previousY = player.y;
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

    const actualMovement = {
        x: Math.sign(player.x - previousX),
        y: Math.sign(player.y - previousY),
    };
    updateWalkAnimation(actualMovement, deltaSeconds);
    updateActorPositions();
    if (actualMovement.x === 0 && actualMovement.y === 0) return;

    if (currentMap === "whiteRoad" && forestScenePhase === "walking-to-intro") {
        forestWalkDistance += Math.hypot(player.x - previousX, player.y - previousY);
        if (forestWalkDistance >= FOREST_WALK_BEFORE_DIALOG) {
            beginForestWalkIntro();
            return;
        }
    }

    if (currentMap === "whiteRoad") recordForestRouteAtPlayerPosition();

    if (currentMap === "home" && !homePortalArmed && !isInsideHomeExitZoneBounds()) {
        homePortalArmed = true;
    }

    if (isInsideHomeExitZone()) {
        transitionToWhiteRoad();
        return;
    }
    if (isInsideWhiteRoadReturnZone() && forestScenePhase !== "walking-to-intro") {
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
        updateCatMotion(deltaSeconds);
        updateCamera();
    }

    window.requestAnimationFrame(renderFrame);
}

window.addEventListener("keydown", handleRoadKeyDown);
window.addEventListener("keyup", handleRoadKeyUp);
roadSignTrigger.addEventListener("click", interactWithSign);
roadSignClose.addEventListener("click", closeSignOverlay);
roadSignConfirm.addEventListener("click", closeSignOverlay);
roadSignOverlay.addEventListener("click", (event) => {
    if (event.target === roadSignOverlay) closeSignOverlay();
});
nameScreen.addEventListener("submit", (event) => {
    event.preventDefault();
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        nameError.hidden = false;
        playerNameInput.focus();
        return;
    }
    journeyChoiceHistory.length = 0;
    try {
        sessionStorage.removeItem("gamingCatJourneyChoices");
    } catch {
        // Starting a new journey does not depend on browser storage.
    }
    nameError.hidden = true;
    nameScreen.hidden = true;
    roadViewport.focus({ preventScroll: true });
    showLine({ speaker: "system", text: "할머니에게로 가보자!" });
    dialogueQueue = [];
});
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


