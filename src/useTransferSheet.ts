import { useEffect, useRef, useState } from 'react';

/** Widths where the editor is one column and the import, share and export panel opens as a bottom sheet. */
export const SHEET_QUERY = '(max-width: 820px)';

/**
 * Open state of the transfer sheet. While it is open the rest of the page is inert, Escape closes it,
 * and focus returns to whatever opened it. Widening the window past the sheet layout closes it.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Tab and Shift+Tab wrap inside the open sheet. The page behind is inert, but the toast stays outside the
 * inert set so its live region still announces, so without this loop Tab could leave the dialog.
 */
function keepFocusInside(event: KeyboardEvent) {
  const panel = document.getElementById('transfer-panel');
  if (!panel) return;
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    // Skip what a closed disclosure hides: Chromium still gives it layout boxes.
    (element) => element.getClientRects().length > 0 && !element.closest('details:not([open]) > :not(summary)'),
  );
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (!panel.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

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
      if (event.key === 'Tab') keepFocusInside(event);
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
