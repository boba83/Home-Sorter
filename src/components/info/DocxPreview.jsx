import { useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';

export default function DocxPreview({ blob }) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || !blob) return;

        el.innerHTML = '';
        let cancelled = false;

        renderAsync(blob, el, undefined, {
            className: 'docx-preview',
            inWrapper: true,
        }).catch((err) => {
            if (!cancelled) {
                el.innerHTML = '';
                const p = document.createElement('p');
                p.className = 'p-4 text-sm text-red-600';
                p.textContent = err?.message || 'Pregled Word dokumenta nije uspeo.';
                el.appendChild(p);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [blob]);

    return (
        <div
            ref={ref}
            className="docx-preview-host min-h-[320px] max-h-[70vh] overflow-auto bg-white"
        />
    );
}
