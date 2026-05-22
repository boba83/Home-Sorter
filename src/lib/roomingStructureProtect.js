/**
 * Fraze u žutoj koloni (tip apartmana) moraju ostati jedna celina pri deljenju
 * struktura / agencija (npr. "STUDIO SA GALERIJOM", "STUDIO SUPERIOR").
 */

const MARK = '\uE000';
const MARK_END = '\uE001';

const COMPOUND_PHRASE_RES = [
    /\bSTUDIO\s+SA\s+GALERIJOM\b/gi,
    /\bSTUDIO\s+SUPERIOR\b/gi,
    /\bSTUDIO\s+DELUXE\b/gi,
    /\bSTUDIO\s+PREMIUM\b/gi,
    /\bSTUDIO\s+SA\s+TERASOM\b/gi,
    /\bSTUDIO\s+SA\s+POTKROVLJEM\b/gi,
    /\bSTUDIO\s+(?:KLASIK|CLASSIC)\b/gi,
    /\bSTUDIO\s+MAX\b/gi,
    /\bSTUDIO\s+FAMILY\b/gi,
    /\bSTUDIO\s+DUPLI\b/gi,
    /\bSTUDIO\s+MINI\b/gi,
    /\bAPARTMAN\s+SA\s+GALERIJOM\b/gi,
    /\bAPP\s+SA\s+GALERIJOM\b/gi,
    /\bAPT\s+SA\s+GALERIJOM\b/gi,
];

/**
 * @returns {{ masked: string, tokens: string[] }}
 */
export function maskCompoundStructurePhrases(input) {
    let s = String(input || '').replace(/\s+/g, ' ').trim();
    const tokens = [];
    for (const re of COMPOUND_PHRASE_RES) {
        s = s.replace(re, (m) => {
            const id = `${MARK}S${tokens.length}${MARK_END}`;
            tokens.push(m);
            return id;
        });
    }
    return { masked: s, tokens };
}

export function unmaskCompoundStructurePhrases(text, tokens) {
    let out = String(text || '');
    for (let i = 0; i < (tokens || []).length; i++) {
        out = out.split(`${MARK}S${i}${MARK_END}`).join(tokens[i]);
    }
    return out.replace(/\s+/g, ' ').trim();
}
