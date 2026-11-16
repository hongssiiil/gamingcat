import { NOTES } from './content.js';

export const FOREST_SIGN = { id: 'sign', x: 550, y: 470, site: '표지판' };
export const SEARCH_DISTANCE = 70;
// The prompt and E/click interactions share a single nearest-target rule.
export function nearbyForestTarget(player) {
    let nearest = null;
    let distance = SEARCH_DISTANCE;
    for (const target of [...NOTES, FOREST_SIGN]) {
        const next = Math.hypot(target.x - player.x, target.y - player.y);
        if (next <= distance) { nearest = target; distance = next; }
    }
    return nearest;
}
export function discoverNote(state, note) {
    if (!NOTES.some(n => n.id === note.id) || state.notes.includes(note.id)) return false;
    state.notes.push(note.id);
    state.events.push({ type: 'note', id: note.id });
    return true;
}
