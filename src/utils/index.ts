


export function createPageUrl(pageName: string) {
    const [page, query] = pageName.split('?');
    const path = '/' + page.replace(/ /g, '').toLowerCase();
    return query ? `${path}?${query}` : path;
}