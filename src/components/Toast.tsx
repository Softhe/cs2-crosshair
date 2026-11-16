import { AlertCircle, AlertTriangle, Check, Info, X } from 'lucide-react';
import type { Tone } from '../useToast';

const icons = { error: AlertCircle, warning: AlertTriangle, success: Check, info: Info };

export function Toast({ text, tone, onDismiss }: { text: string; tone: Tone; onDismiss: () => void }) {
  if (!text) return null;
  const Icon = icons[tone];
  return (
    <div className={`toast toast-${tone}`} data-tone={tone} role="status">
      <Icon size={18} />
      <span>{text}</span>
      <button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
