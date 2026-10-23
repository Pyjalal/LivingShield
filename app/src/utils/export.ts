export function downloadCSV(rows: readonly Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows
    .map((r: Record<string, unknown>) =>
      keys
        .map((k) => {
          const v = r[k];
          const s = v == null ? '' : String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(','),
    )
    .join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : filename + '.csv');
}

export function downloadPNG(element: HTMLElement, filename: string) {
  const frameImages = [...element.querySelectorAll('iframe')].map((frame) => {
    try {
      const viewport = frame.contentWindow as
        (Window & { TK?: { world?: { captureFrame?: () => string } } }) | null;
      const image = viewport?.TK?.world?.captureFrame?.();
      return image
        ? { image, credit: frame.contentDocument?.querySelector('footer')?.textContent ?? '' }
        : null;
    } catch {
      return null;
    }
  });
  import('dom-to-image-more').then((domtoimage) => {
    domtoimage
      .toBlob(element, {
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: { zoom: '1' },
        onclone: (clone: HTMLElement) => {
          const sourceSelects = [...element.querySelectorAll('select')];
          [...clone.querySelectorAll('select')].forEach((select, index) => {
            const values = new Set(
              [...sourceSelects[index].selectedOptions].map((option) => option.value),
            );
            [...select.options].forEach((option) => {
              if (values.has(option.value)) option.setAttribute('selected', '');
              else option.removeAttribute('selected');
            });
          });
          [...clone.querySelectorAll('iframe')].forEach((frame, index) => {
            const snapshot = frameImages[index];
            if (!snapshot) return;
            const replacement = document.createElement('div');
            replacement.style.cssText = frame.style.cssText;
            replacement.style.position = 'relative';
            const image = document.createElement('img');
            image.src = snapshot.image;
            image.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill';
            const credit = document.createElement('span');
            credit.textContent = snapshot.credit;
            credit.style.cssText =
              'position:absolute;bottom:0;right:0;max-width:100%;background:#fffffff0;color:#244346;padding:4px 6px;font:9px Arial,sans-serif';
            replacement.append(image, credit);
            frame.replaceWith(replacement);
          });
        },
      })
      .then((blob: Blob) => {
        if (blob) triggerDownload(blob, filename.endsWith('.png') ? filename : filename + '.png');
      });
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
