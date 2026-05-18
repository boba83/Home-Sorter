
export type HouseLike = {
    member_user_ids?: string[];
    responsible_person?: string | null;
};

export type UserLike = {
    id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
};

export function userDisplayName(user: UserLike | null | undefined): string {
    const parts = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    return parts || user?.full_name || user?.email || '';
}

function namesMatch(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Kuća je dodeljena korisniku (član ili odgovorna osoba). */
export function isHouseAssignedToUser(house: HouseLike | null | undefined, user: UserLike | null | undefined): boolean {
    if (!house || !user?.id) return false;
    return isHouseAssignedToUserId(house, user.id, user);
}

/** Provera dodele po ID-u (radi i pre učitavanja liste korisnika). */
export function isHouseAssignedToUserId(
    house: HouseLike | null | undefined,
    userId: string | null | undefined,
    user?: UserLike | null,
): boolean {
    if (!house || !userId) return false;
    const memberIds = house.member_user_ids || [];
    if (memberIds.includes(userId)) return true;
    const name = user ? userDisplayName(user).trim() : '';
    if (name && house.responsible_person && namesMatch(String(house.responsible_person), name)) {
        return true;
    }
    return false;
}

export function createPageUrl(pageName: string) {
    const [page, query] = pageName.split('?');
    const path = '/' + page.replace(/ /g, '');
    return query ? `${path}?${query}` : path;
}