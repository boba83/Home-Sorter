/**
 * Boravišna taksa: broj kalendarskih noći × 2 € (isti pravilnik kao u RoomCard).
 * Prihvata dd.MM.yyyy ili yyyy-MM-dd (npr. <input type="date">).
 */
export function calculateRoomTaxEuro(stayFrom, stayTo) {
    if (!stayFrom || !stayTo) return 0;
    const sf = String(stayFrom).trim();
    const st = String(stayTo).trim();
    let fromDate;
    let toDate;
    if (sf.includes('.')) {
        const [day, month, year] = sf.split('.').filter(Boolean);
        if (!day || !month || !year) return 0;
        fromDate = new Date(year, month - 1, day);
    } else {
        fromDate = new Date(sf);
    }
    if (st.includes('.')) {
        const [day, month, year] = st.split('.').filter(Boolean);
        if (!day || !month || !year) return 0;
        toDate = new Date(year, month - 1, day);
    } else {
        toDate = new Date(st);
    }
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 0;
    const nights = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, nights * 2);
}
