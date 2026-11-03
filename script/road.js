const roadSection = document.querySelector("#Road");

export function enterRoad() {
    roadSection.classList.replace("screen", "screen-active");
}

export function exitRoad() {
    roadSection.classList.replace("screen-active", "screen");
}


