import { useEffect, useRef, useState } from 'react';

/** Widths where the editor is one column and the import, share and export panel opens as a bottom sheet. */
export const SHEET_QUERY = '(max-width: 820px)';

/**
 * Open state of the transfer sheet. While it is open the rest of the page is inert, Escape closes it,
 * and focus returns to whatever opened it. Widening the window past the sheet layout closes it.
 */
export function useTransferSheet() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  function show(from?: HTMLElement | null) {
    opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const media = matchMedia(SHEET_QUERY);
    const onMedia = () => {
      if (!media.matches) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setOpen(false);
    };
    media.addEventListener('change', onMedia);
    document.addEventListener('keydown', onKey);
    const background = [...document.querySelectorAll<HTMLElement>('.header, .workspace > :not(.transfer-panel, .sheet-backdrop), .site-footer, .mobile-actions')];
    background.forEach((element) => {
      element.inert = true;
    });
    return () => {
      media.removeEventListener('change', onMedia);
      document.removeEventListener('keydown', onKey);
      background.forEach((element) => {
        element.inert = false;
      });
      const target = opener.current;
      if (target?.isConnected) target.focus();
    };
  }, [open]);
  return { open, show, hide: () => setOpen(false) };
}
