export const BATTLE_TOKEN_COSTS = Object.freeze({
    recommendation: 2,
    probability: 1,
    autoTurn: 2,
});

export const BATTLE_STARTING_TOKENS = 30;

export function consumeBattleToken(state, command, { probabilityAlreadyViewed = false } = {}) {
    if (!Object.hasOwn(BATTLE_TOKEN_COSTS, command)) return false;

    const cost = command === "recommendation" && probabilityAlreadyViewed
        ? 1
        : BATTLE_TOKEN_COSTS[command];
    state.tokens -= cost;
    state.events ??= [];
    state.events.push({
        type: "help",
        stage: "battle",
        command,
        cost,
        tokens: state.tokens,
    });
    return true;
}

export function renderBattleTokens(tokens, root = document.querySelector("#Battle")) {
    if (!root) return null;

    let resources = root.querySelector(".battle-token-resources");
    if (!resources) {
        resources = document.createElement("div");
        resources.className = "battle-token-resources";
        resources.setAttribute("aria-live", "polite");
        const count = document.createElement("span");
        count.className = "battle-token-count";
        const debt = document.createElement("span");
        debt.className = "battle-token-debt";
        debt.hidden = true;
        resources.append(count, debt);
        root.append(resources);
    }

    const count = resources.querySelector(".battle-token-count");
    const debt = resources.querySelector(".battle-token-debt");
    count.textContent = `토큰 ${tokens}`;
    debt.hidden = tokens >= 0;
    debt.textContent = `AI DEBT ${Math.max(0, -tokens)}`;

    return resources;
}
