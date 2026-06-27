/** Tipovi fajlova koje možemo prikazati u pregledaču. */
export function getInfoFilePreviewKind(file) {
    const name = (file?.name || '').toLowerCase();
    const mime = (file?.mime_type || '').toLowerCase();

    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (
        mime.startsWith('text/') ||
        /\.(txt|csv|md|log|json|xml|html?)$/i.test(name)
    ) {
        return 'text';
    }
    if (
        mime.startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
    ) {
        return 'image';
    }
    if (
        name.endsWith('.docx') ||
        mime.includes('wordprocessingml.document')
    ) {
        return 'docx';
    }
    if (
        name.endsWith('.doc') ||
        mime === 'application/msword'
    ) {
        return 'doc';
    }
    if (
        /\.(xlsx?|xls|pptx?|ppt)$/i.test(name) ||
        mime.includes('officedocument') ||
        mime.includes('ms-excel') ||
        mime.includes('ms-powerpoint')
    ) {
        return 'office';
    }
    return null;
}

export function canPreviewInfoFile(file) {
    const kind = getInfoFilePreviewKind(file);
    return kind === 'pdf' || kind === 'text' || kind === 'image' || kind === 'docx';
}

export function canEditInfoFile(file) {
    return Boolean(file?.id);
}
