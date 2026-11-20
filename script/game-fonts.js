export const BODY_FONT = '"DungGeunMo", monospace';
export const EMPHASIS_FONT = '"NeoDGMCode", "DungGeunMo", monospace';
// Canvas bitmaps must not cache fallback glyphs before the local fonts arrive.
export const gameFontsReady = Promise.all([
    document.fonts.load('14px "DungGeunMo"'),
    document.fonts.load('14px "NeoDGMCode"'),
]).catch(() => {});
