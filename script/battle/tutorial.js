const tutorialSteps = {
    status: {
        selector: "#player-status",
        title: "상태창을 살펴보자",
        text: "체력은 0이 되면 전투에서 쓰러져. 스태미나는 공격과 방어에 쓰이고, 숨을 고르면 다시 차올라. 상태창을 눌러 적의 체력과 스태미나도 함께 살펴봐!",
    },
    probability: {
        selector: "#battle-probability-button",
        title: "적의 행동 확률 보기",
        text: "여기서 적이 다음에 어떤 행동을 할지 확률을 볼 수 있어. 한 번 확인할 때 토큰 1개를 써. 눌러서 확인해 보자!",
    },
    recommendation: {
        selector: "#follow-recommendation-button",
        title: "내 추천 보기",
        text: "내가 적의 행동 확률을 보고 대응 행동을 추천할게. 확률을 먼저 확인하지 않았다면 토큰 2개, 확인했다면 1개가 필요해. 버튼을 눌러 내 생각을 들어봐!",
    },
    choose: {
        selector: "#choose-action-button",
        title: "직접 행동 고르기",
        text: "내 추천을 따르지 않고 네가 직접 행동을 고를 수도 있어. 버튼을 누른 뒤 원하는 행동을 하나 선택해 봐!",
    },
    skill: {
        selector: "#fight-skills-dialog",
        title: "행동을 직접 선택해 봐",
        text: "공격이나 숨 고르기처럼 원하는 행동을 골라 봐. 선택한 행동은 실제 전투에 반영되고 적도 이어서 행동해.",
    },
    directWait: {
        selector: null,
        title: "좋아, 직접 골랐어!",
        text: "네 선택으로 한 턴이 진행됐어. 이제 자동전투가 어떻게 움직이는지 살펴보자.",
    },
    automatic: {
        selector: "#battle-auto-button",
        title: "자동전투 체험하기",
        text: "자동전투에서는 내가 적의 행동 확률을 보고 대응 행동을 자동으로 실행해. 이번 체험은 한 턴만 진행하고, 턴당 토큰 2개를 써. 눌러서 확인해 보자!",
    },
    automaticWait: {
        selector: null,
        title: "자동으로 한 턴 진행 중",
        text: "적의 행동을 살펴보고 내가 대응하고 있어. 잠시 기다려 줘!",
    },
    tokens: {
        selector: ".battle-token-resources",
        title: "토큰을 확인해 보자",
        text: "토큰은 내 도움을 받을 때 사용해. 적 행동 확률은 1개, 추천 확인은 기본 2개지만 확률을 먼저 보면 1개, 자동전투는 턴마다 2개야. 토큰이 모자라도 전투는 계속할 수 있어. 토큰 표시를 눌러 안내를 마치자!",
    },
};

let active = false;
let currentStep = null;
let onComplete = () => {};
let card;
let resizeListener;

function getTarget() {
    const selector = tutorialSteps[currentStep]?.selector;
    return selector ? document.querySelector(selector) : null;
}

function render() {
    if (!active) return;
    const step = tutorialSteps[currentStep];
    const target = getTarget();
    const isSkillSelection = currentStep === "skill";
    target?.classList.toggle("battle-tutorial-skill-step", isSkillSelection);
    document.querySelectorAll(".battle-tutorial-target").forEach((element) => {
        element.classList.remove("battle-tutorial-target");
    });
    if (target && !isSkillSelection) {
        target.classList.add("battle-tutorial-target");
        if (currentStep === "status") target.tabIndex = 0;
        if (currentStep === "tokens") {
            target.tabIndex = 0;
            target.setAttribute("role", "button");
            target.setAttribute("aria-label", "토큰 사용 안내 완료");
        }
    }
    if (isSkillSelection) {
        target?.querySelector(".skill-option:not(:disabled)")?.focus({ preventScroll: true });
        card.hidden = true;
    } else {
        target?.focus({ preventScroll: true });
        card.hidden = false;
    }

    const scale = Number.parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--battle-scale")) || 1;
    const rect = isSkillSelection ? null : target?.getBoundingClientRect();

    card.innerHTML = `<img src="./images/character/cat/cat_front.png" alt="티니"><div><strong>${step.title}</strong><p>${step.text}</p></div>`;
    card.style.top = !rect
        ? "50%"
        : rect.bottom < window.innerHeight * 0.55
            ? `${Math.min(window.innerHeight - 150 * scale, rect.bottom + 18 * scale)}px`
            : "auto";
    card.style.bottom = rect && rect.bottom >= window.innerHeight * 0.55
        ? `${Math.max(14 * scale, window.innerHeight - rect.top + 18 * scale)}px`
        : "auto";
    card.style.left = "50%";
    card.style.transform = rect ? "translateX(-50%)" : "translate(-50%, -50%)";
}

function complete() {
    active = false;
    card.hidden = true;
    document.querySelectorAll(".battle-tutorial-target").forEach((element) => {
        element.classList.remove("battle-tutorial-target");
    });
    document.querySelector("#fight-skills-dialog")?.classList.remove("battle-tutorial-skill-step");
    const status = document.querySelector("#player-status");
    status?.removeAttribute("tabindex");
    const tokens = document.querySelector(".battle-token-resources");
    tokens?.removeAttribute("tabindex");
    tokens?.removeAttribute("role");
    tokens?.removeAttribute("aria-label");
    document.removeEventListener("click", handleTutorialClick, true);
    document.removeEventListener("keydown", handleTutorialKeydown, true);
    window.removeEventListener("resize", resizeListener);
    onComplete();
}

function setStep(step) {
    currentStep = step;
    if (step === "done") {
        complete();
        return;
    }
    card.hidden = false;
    render();
}

function handleTutorialClick(event) {
    if (!active) return;
    const target = getTarget();
    const isAllowedSkill = currentStep === "skill" && event.target.closest?.(".skill-option");
    const isHighlightedTarget = event.target.closest?.(".battle-tutorial-target");
    if (!target || (!isHighlightedTarget && !isAllowedSkill)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }

    if (currentStep === "status") setStep("probability");
    else if (currentStep === "probability") setStep("recommendation");
    else if (currentStep === "recommendation") setStep("choose");
    else if (currentStep === "choose") requestAnimationFrame(() => setStep("skill"));
    else if (currentStep === "skill") setStep("directWait");
    else if (currentStep === "automatic") setStep("automaticWait");
    else if (currentStep === "tokens") setStep("done");
    requestAnimationFrame(render);
}

function handleTutorialKeydown(event) {
    if (!active) return;
    const target = getTarget();
    if (currentStep === "skill") {
        if (event.key === "Tab" && target) {
            event.preventDefault();
            const options = [...target.querySelectorAll(".skill-option:not(:disabled)")];
            const currentIndex = options.indexOf(document.activeElement);
            const direction = event.shiftKey ? -1 : 1;
            options[(currentIndex + direction + options.length) % options.length]?.focus({ preventScroll: true });
        } else if (event.key === "Escape") {
            requestAnimationFrame(() => {
                if (target?.hidden) setStep("choose");
            });
        }
        return;
    }
    if (event.key === "Tab") {
        event.preventDefault();
        target?.focus({ preventScroll: true });
        return;
    }
    if (event.key === "Enter" || event.key === " ") {
        const focusIsAllowed = target === document.activeElement;
        if (!focusIsAllowed) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (currentStep === "status" || currentStep === "tokens") {
            event.preventDefault();
            target.click();
        }
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
}

export function startBattleTutorial(onFinish = () => {}) {
    if (active) {
        document.removeEventListener("click", handleTutorialClick, true);
        document.removeEventListener("keydown", handleTutorialKeydown, true);
        window.removeEventListener("resize", resizeListener);
    }
    card = document.querySelector("#battle-tutorial-card");
    onComplete = onFinish;
    active = true;
    resizeListener = render;
    document.addEventListener("click", handleTutorialClick, true);
    document.addEventListener("keydown", handleTutorialKeydown, true);
    window.addEventListener("resize", resizeListener);
    setStep("status");
}

export function advanceBattleTutorial(step) {
    if (active) setStep(step);
}

export function isBattleTutorialActive() {
    return active;
}
