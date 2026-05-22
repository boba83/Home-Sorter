import { maskCompoundStructurePhrases, unmaskCompoundStructurePhrases } from './roomingStructureProtect.js';

/** Uklanja dupli telefon iz napomene ako je isti kao contact_phone. */
export function stripPhoneFromNotesText(notes, phone) {
    if (!notes?.trim() || !phone?.trim()) return (notes || '').trim();
    let n = notes.trim();
    const p = phone.trim();
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    n = n.replace(new RegExp(esc, 'gi'), ' ');
    n = n.replace(/\d{2,3}\s*\/\s*\d{6,}/g, (m) => {
        const norm = (s) => s.replace(/\D/g, '');
        return norm(m) === norm(p) ? ' ' : m;
    });
    return n.replace(/\s{2,}/g, ' ').replace(/^[,/|•\-\s]+|[,/|•\-\s]+$/g, '').trim();
}

/** Da li string liči na opis smeštaja (ne samo NA/DA kolona iz PDF-a). */
export function structureLooksInformative(s) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2) return false;
    if (/^(NA|DA|N\/A)$/i.test(t)) return false;
    return (
        /[\d/]|STUDIO|APP|APT|DUPLEX|APARTMENT|APARTMAN|ROOM|\+{2}|\b(?:TOURIST|TRAVEL|TURS|D\.O\.O\.)\b/i.test(
            t,
        )
    );
}

function looksLikeRoomStructure(s) {
    return structureLooksInformative(s);
}

/**
 * Odvaja agenciju sa kraja room_structure (isti princip kao PDF tail).
 * Koristi se za prikaz i za usklađivanje sa notes iz baze.
 */
export function peelStructureAndAgency(structure) {
    let t = (structure || '').replace(/\s+/g, ' ').trim();
    if (!t) return { structure: '', agency: '' };

    if (/\b(?:BUS\s+PAK|AUTOBUS)\b/i.test(t)) {
        t = t.replace(/\s*(?:BUS\s+PAK|AUTOBUS)\s*/gi, ' ').trim();
    }

    const { masked, tokens } = maskCompoundStructurePhrases(t);
    const work = masked;

    const unwrap = (struct, agency = '') => ({
        structure: unmaskCompoundStructurePhrases(struct, tokens).trim(),
        agency: unmaskCompoundStructurePhrases(agency || '', tokens).trim(),
    });

    // 1) ... TOURIST|TRAVEL + D.O.O. na kraju (npr. "1/2+1 MATIC TOURIST D.O.O." bez reči STUDIO)
    const dooTail = work.match(
        /^(.+)\s+((?:[A-ZŠĐČĆŽšđčćž][A-Za-zŠĐČĆŽšđčćž0-9.-]*\s+){1,5}(?:TOURIST|TRAVEL)\s+D\.O\.O\.)$/i,
    );
    if (dooTail && dooTail[2].length >= 10 && looksLikeRoomStructure(dooTail[1])) {
        return unwrap(dooTail[1].trim(), dooTail[2].trim());
    }

    // 2) Posle STUDIO/APP/DUPLEX (strože)
    const dooStudio = work.match(
        /^(.+?\b(?:STUDIO|APP|APT|DUPLEX|\+{2})\b)\s+((?:[A-ZŠĐČĆŽ][A-Za-zŠĐČĆŽ.]+\s+){1,4}(?:TOURIST|TRAVEL)\s+D\.O\.O\.)$/i,
    );
    if (dooStudio && dooStudio[2].length >= 12) {
        return unwrap(dooStudio[1].trim(), dooStudio[2].trim());
    }

    // 3) Posle STUDIO/APP/DUPLEX: ... TRAVEL (npr. "GLOBO TURS TRAVEL")
    const travelAfterType = work.match(
        /^(.+?\b(?:STUDIO|APP|APT|DUPLEX|\+{2})\b)\s+((?:[A-Za-zŠĐČĆŽšđčćž][A-Za-zŠĐČĆŽšđčćž0-9.-]*\s+){1,5}TRAVEL(?:\s+D\.O\.O\.)?)$/i,
    );
    if (travelAfterType && travelAfterType[2].trim().length > 6) {
        return unwrap(travelAfterType[1].trim(), travelAfterType[2].trim());
    }

    // 4) Jedna reč + TRAVEL na kraju
    const travelTail = work.match(/\s+[A-Za-zŠĐČĆŽšđčćž]+\s+TRAVEL(?:\s+D\.O\.O\.)?$/i);
    if (travelTail && travelTail.index > 0) {
        const left = work.slice(0, travelTail.index).trim();
        const right = work.slice(travelTail.index).trim();
        if (looksLikeRoomStructure(left) && right.length > 6) {
            return unwrap(left, right);
        }
    }

    return unwrap(work, '');
}

export function computeStructureAndNotesBlock(structure, notes, phone) {
    const rawFull = (structure || '').replace(/\s+/g, ' ').trim();
    let struct = rawFull;
    const nb = stripPhoneFromNotesText(notes, phone).trim();

    // Ne skidaj sufiks ako bi ostalo smeće (npr. napomena "X" skinuta sa "…DA" → "DA").
    if (nb && struct.toLowerCase().endsWith(nb.toLowerCase())) {
        const candidate = struct.slice(0, struct.length - nb.length).replace(/\s+$/, '').trim();
        if (structureLooksInformative(candidate)) {
            struct = candidate;
            return { structureDisplay: struct, notesBlock: nb };
        }
    }

    const peeled = peelStructureAndAgency(struct);
    if (peeled.agency) {
        let structureDisplay = peeled.structure;
        if (!structureLooksInformative(structureDisplay) && structureLooksInformative(rawFull)) {
            structureDisplay = rawFull;
        }
        return {
            structureDisplay,
            notesBlock: nb || peeled.agency,
        };
    }

    let structureDisplay = struct;
    if (!structureLooksInformative(structureDisplay) && structureLooksInformative(rawFull)) {
        structureDisplay = rawFull;
    }
    return { structureDisplay, notesBlock: nb };
}
