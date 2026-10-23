import { useEffect, useState } from 'react';

export function usePresentationMode(buttonSelector: string) {
  const [presenting, setPresenting] = useState(false);
  useEffect(() => {
    if (!presenting) return;
    const exit = () => {
      setPresenting(false);
      requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>(buttonSelector)?.focus({ preventScroll: true }),
      );
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) exit();
    };
    const message = (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>(
        'iframe[title="LivingShield 3D township model"]',
      );
      if (
        frame &&
        event.origin === window.location.origin &&
        event.source === frame.contentWindow &&
        event.data?.type === 'hydrogrid:exit-presentation'
      )
        exit();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('message', message);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('message', message);
    };
  }, [presenting, buttonSelector]);
  return [presenting, setPresenting] as const;
}
