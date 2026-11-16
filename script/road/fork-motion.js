const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function forkPoint(lane, progress, startY = 250) {
    const x = 110 + 770 * progress;
    // Match the drawn fork: the shared path stays straight through x=300,
    // then bends toward the selected branch until x=530.
    return { x, y: startY + ([120, 250, 380][lane] - startY) * clamp((x - 300) / 230, 0, 1) };
}

export function createForkMotion(fork, startY = 250) {
    return {
        startY,
        player: forkPoint(fork.lane, fork.progress, startY),
        cat: forkPoint(fork.lane, Math.max(0, fork.progress - 0.08), startY),
    };
}

export function updateForkMotion(motion, fork, recommended, dt, moving = false) {
    const surprised = moving && fork.lane !== recommended && fork.progress > 0.03 && fork.resistance < 1;
    const playerTarget = forkPoint(fork.lane, fork.progress, motion.startY);
    const leading = fork.lane === recommended;
    const catTarget = forkPoint(fork.lane, clamp(fork.progress + (leading ? 0.14 : surprised ? -0.18 : -0.08), 0, 1), motion.startY);
    // Exponential following stays continuous across lane/reaction changes and frame rates.
    for (const [key, target, rate] of [['player', playerTarget, 18], ['cat', catTarget, surprised ? 2.5 : 7]]) {
        const amount = 1 - Math.exp(-rate * dt);
        const dx = (target.x - motion[key].x) * amount, dy = (target.y - motion[key].y) * amount;
        const limit = Math.min(1, 280 * dt / (Math.hypot(dx, dy) || 1));
        motion[key].x += dx * limit;
        motion[key].y += dy * limit;
    }
    return surprised;
}
