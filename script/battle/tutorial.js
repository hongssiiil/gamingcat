const tutorialSteps = {
    intro: {
        selector: null,
        title: "낯선 적이 나타났어",
        text: "코코넛 해적을 만났네. 전투 방법을 알려줄게.",
    },
    health: {
        selector: "#player-status .health-bar",
        title: "체력",
        text: "체력이 0이 되면 쓰러져.",
    },
    stamina: {
        selector: "#player-status .stamina-bar",
        title: "스태미나",
        text: "공격과 방어에 쓰고, 숨을 고르면 회복해.",
    },
    probability: {
        selector: "#battle-probability-button",
        title: "적의 행동 확률 보기",
        text: "적의 다음 행동을 확인해. 토큰 1개가 필요해.",
    },
    recommendation: {
        selector: "#follow-recommendation-button",
        title: "내 추천 보기",
        text: "적의 행동에 맞춰 추천할게. 2토큰, 확률 확인 후엔 1토큰이야.",
    },
    recommendationFollow: {
        selector: "#follow-recommendation-button",
        title: "추천대로 행동해 보기",
        text: "버튼을 다시 눌러 추천대로 행동해 봐.",
    },
    recommendationWait: {
        selector: null,
        title: "",
        text: "",
    },
    roarLesson: {
        selector: null,
        title: "포효",
        text: "코코넛 해적이 먼저 포효해 스태미나를 20 줄였어.",
    },
    choose: {
        selector: "#choose-action-button",
        title: "직접 행동 고르기",
        text: "직접 행동을 고를 수도 있어. 눌러서 골라 봐.",
    },
    skill: {
        selector: "#fight-skills-dialog",
        title: "행동을 직접 선택해 봐",
        text: "원하는 행동을 하나 골라 봐.",
    },
    directWait: {
        selector: null,
        title: "좋아, 직접 골랐어!",
        text: "네 선택으로 한 턴이 진행됐어.",
    },
    automaticIntro: {
        selector: null,
        title: "티니가 대신 행동해",
        text: "적의 행동을 보고 대응 행동을 골라.",
    },
    automatic: {
        selector: "#battle-auto-button",
        title: "자동전투 체험하기",
        text: "눌러서 한 턴 진행해 봐.",
    },
    automaticWait: {
        selector: null,
        title: "",
        text: "",
    },
    automaticCost: {
        selector: null,
        title: "자동전투 비용",
        text: "한 턴마다 토큰 2개를 써.",
    },
    automaticStop: {
        selector: "#battle-auto-button",
        title: "자동전투 멈추기",
        text: "버튼을 다시 눌러 멈춰 봐.",
    },
    tokens: {
        selector: ".battle-token-resources",
        title: "토큰",
        text: "티니의 도움을 받을 때 사용해.",
    },
};

let active = false;
let currentStep = null;
let onComplete = () => { };
let onRoarLessonContinue = () => { };
let card;
let resizeListener;
let waitTimer;
let queuedStep = null;
const WAIT_STEP_DELAY = 4500;
const waitSteps = new Set(["directWait"]);

function getTarget() {
    const selector = tutorialSteps[currentStep]?.selector;
    return selector ? document.querySelector(selector) : null;
}

function render() {
    if (!active) return;
    const step = tutorialSteps[currentStep];
    if (currentStep === "recommendationWait" || currentStep === "automaticWait") {
        card.hidden = true;
        return;
    }
    const target = getTarget();
    const isSkillSelection = currentStep === "skill";
    target?.classList.toggle("battle-tutorial-skill-step", isSkillSelection);
    document.querySelectorAll(".battle-tutorial-target").forEach((element) => {
        element.classList.remove("battle-tutorial-target");
    });
    if (target && !isSkillSelection) {
        target.classList.add("battle-tutorial-target");
        if (currentStep === "health" || currentStep === "stamina") target.tabIndex = 0;
        if (currentStep === "tokens") {
            target.tabIndex = 0;
            target.setAttribute("role", "button");
            target.setAttribute("aria-label", "토큰 안내 완료");
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
    if (currentStep === "intro") card.focus({ preventScroll: true });
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
    window.clearTimeout(waitTimer);
    queuedStep = null;
    active = false;
    document.querySelector(".menu-section")?.classList.remove(
        "is-battle-tutorial",
        "is-tutorial-message-visible",
    );
    onRoarLessonContinue = () => { };
    card.hidden = true;
    document.querySelectorAll(".battle-tutorial-target").forEach((element) => {
        element.classList.remove("battle-tutorial-target");
    });
    document.querySelector("#fight-skills-dialog")?.classList.remove("battle-tutorial-skill-step");
    document.querySelector("#player-status .health-bar")?.removeAttribute("tabindex");
    document.querySelector("#player-status .stamina-bar")?.removeAttribute("tabindex");
    const tokens = document.querySelector(".battle-token-resources");
    tokens?.removeAttribute("tabindex");
    tokens?.removeAttribute("role");
    tokens?.removeAttribute("aria-label");
    document.removeEventListener("click", handleTutorialClick, true);
    document.removeEventListener("keydown", handleTutorialKeydown, true);
    window.removeEventListener("resize", resizeListener);
    onComplete();
}

function setStep(step, force = false) {
    if (!force && waitSteps.has(currentStep) && step !== currentStep) {
        queuedStep = step;
        window.clearTimeout(waitTimer);
        waitTimer = window.setTimeout(() => {
            const nextStep = queuedStep;
            queuedStep = null;
            setStep(nextStep, true);
        }, WAIT_STEP_DELAY);
        return;
    }
    currentStep = step;
    if (step === "done") {
        complete();
        return;
    }
    card.hidden = false;
    render();
}

function activateCurrentStep() {
    if (!active) return;
    if (waitSteps.has(currentStep)) {
        if (queuedStep) {
            const nextStep = queuedStep;
            queuedStep = null;
            window.clearTimeout(waitTimer);
            setStep(nextStep, true);
        }
        return;
    }
    if (currentStep === "intro") {
        setStep("health");
        return;
    }
    const informationalNextSteps = {
        health: "stamina",
        stamina: "probability",
        automaticIntro: "automatic",
        automaticCost: "automaticStop",
    };
    if (informationalNextSteps[currentStep]) {
        setStep(informationalNextSteps[currentStep]);
        return;
    }
    if (currentStep === "roarLesson") {
        const continuePlayerAction = onRoarLessonContinue;
        onRoarLessonContinue = () => { };
        continuePlayerAction();
        return;
    }
    const target = getTarget();
    if (currentStep === "skill") {
        target?.querySelector(".skill-option:not(:disabled)")?.click();
        return;
    }
    target?.click();
}

function handleTutorialClick(event) {
    if(event.target.closest?.('#music-controls'))return;
    if (!active) return;
    if (currentStep === "intro") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStep("health");
        return;
    }
    if (waitSteps.has(currentStep)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        activateCurrentStep();
        return;
    }
    const target = getTarget();
    const isAllowedSkill = currentStep === "skill" && event.target.closest?.(".skill-option");
    const isHighlightedTarget = event.target.closest?.(".battle-tutorial-target");
    if (!target || (!isHighlightedTarget && !isAllowedSkill)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        activateCurrentStep();
        return;
    }

    if (currentStep === "health") setStep("stamina");
    else if (currentStep === "stamina") setStep("probability");
    else if (currentStep === "probability") setStep("recommendation");
    else if (currentStep === "recommendation") setStep("recommendationFollow");
    else if (currentStep === "recommendationFollow") setStep("recommendationWait");
    else if (currentStep === "choose") requestAnimationFrame(() => setStep("skill"));
    else if (currentStep === "skill") setStep("directWait");
    else if (currentStep === "automatic") setStep("automaticWait");
    else if (currentStep === "automaticStop") setStep("tokens");
    else if (currentStep === "tokens") setStep("done");
    requestAnimationFrame(render);
}

function handleTutorialKeydown(event) {
    if(event.target.closest?.('#music-controls'))return;
    if (!active) return;
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        activateCurrentStep();
        return;
    }
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
    event.preventDefault();
    event.stopImmediatePropagation();
}

export function startBattleTutorial(onFinish = () => { }) {
    window.clearTimeout(waitTimer);
    queuedStep = null;
    if (active) {
        document.removeEventListener("click", handleTutorialClick, true);
        document.removeEventListener("keydown", handleTutorialKeydown, true);
        window.removeEventListener("resize", resizeListener);
    }
    card = document.querySelector("#battle-tutorial-card");
    onComplete = onFinish;
    onRoarLessonContinue = () => { };
    active = true;
    document.querySelector(".menu-section")?.classList.add("is-battle-tutorial");
    document.querySelector(".menu-section")?.classList.remove("is-tutorial-message-visible");
    resizeListener = render;
    document.addEventListener("click", handleTutorialClick, true);
    document.addEventListener("keydown", handleTutorialKeydown, true);
    window.addEventListener("resize", resizeListener);
    setStep("intro");
}

export function advanceBattleTutorial(step, onContinue = () => { }) {
    if (!active) {
        onContinue();
        return;
    }
    if (step === "roarLesson") onRoarLessonContinue = onContinue;
    if (step === "automatic" && currentStep === "directWait") {
        setStep("automaticIntro");
        return;
    }
    if (step === "automaticStop" && currentStep === "automaticWait") {
        setStep("automaticCost");
        return;
    }
    setStep(step);
}

export function isBattleTutorialActive() {
    return active;
}

export function stopBattleTutorial() {
    if (active) complete();
}
