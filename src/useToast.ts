import { useEffect, useState } from 'react';

export type Tone = 'success' | 'warning' | 'error' | 'info';
export type Notify = (text: string, tone?: Tone) => void;

/** One notification at a time. Errors stay longer: they usually need an action, not just a glance. */
export function useToast(first: () => { text: string; tone: Tone }) {
  const [initial] = useState(first);
  const [toast, setToast] = useState(initial.text);
  const [toastTone, setToastTone] = useState<Tone>(initial.tone);
  const notify: Notify = (text, tone = 'info') => {
    setToastTone(tone);
    setToast(text);
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), toastTone === 'error' ? 15000 : 7000);
    return () => clearTimeout(timer);
  }, [toast, toastTone]);
  return { toast, toastTone, notify, setToast };
}
