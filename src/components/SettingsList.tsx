import { useEffect, useState } from 'react';
import { styleFields, type Field, type Settings } from '../model';

export function NumberControl({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: Field;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const format = (n: number) => ((field.step ?? 1) < 1 ? n.toFixed(2) : String(n));
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value, field.step]);
  const commit = () => {
    const n = Number(draft);
    const step = field.step ?? 1;
    if (draft.trim() && Number.isFinite(n)) {
      const clamped = Math.max(field.min ?? 0, Math.min(field.max ?? 255, n));
      const normalized = Number((Math.round(clamped / step) * step).toFixed(2));
      setDraft(format(normalized));
      onChange(normalized);
    } else setDraft(format(value));
  };
  return (
    <div className="number-controls">
      <input
        type="range"
        aria-label={`${field.label} slider`}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        className="numeric"
        type="number"
        aria-label={field.label}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

export function Row({
  field,
  s,
  set,
}: {
  field: Field;
  s: Settings;
  set: (key: string, value: number) => void;
}) {
  return (
    <div className="setting-row">
      <label htmlFor={field.key}>
        {field.label}
        {['Style', 'Thickness', 'Length', 'Gap'].includes(field.label) && (
          <small>{field.label === 'Style' ? 'NEW' : 'UPDATED'}</small>
        )}
      </label>
      {field.options ? (
        <select
          id={field.key}
          aria-label={field.label}
          value={s[field.key] ?? 0}
          onChange={(e) => set(field.key, Number(e.target.value))}
        >
          {field.options.map(([n, label]) => (
            <option key={n} value={n}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <NumberControl field={field} value={s[field.key] ?? 0} onChange={(value) => set(field.key, value)} />
      )}
    </div>
  );
}

export function ColorRow({
  outline = false,
  s,
  set,
}: {
  outline?: boolean;
  s: Settings;
  set: (key: string, value: number) => void;
}) {
  const [open, toggle] = useState(false);
  const prefix = outline ? 'cl_crosshairoutline_' : 'cl_crosshaircolor_';
  const label = outline ? 'Outline Color and Transparency' : 'Color and Transparency';
  const channel = (suffix: string): number => s[prefix + suffix] ?? 0;
  const hex = '#' + ['r', 'g', 'b'].map((c) => channel(c).toString(16).padStart(2, '0')).join('');
  return (
    <>
      <div className="setting-row">
        <span>
          {label}
          {!outline && <small>UPDATED</small>}
        </span>
        <button className="swatch" aria-label={`Edit ${label}`} aria-expanded={open} onClick={() => toggle(!open)}>
          <span style={{ backgroundColor: hex, opacity: channel('a') / 255 }} />
        </button>
      </div>
      {open && (
        <div className="color-panel">
          <div className="color-top">
            <input
              type="color"
              aria-label={outline ? 'Outline color' : 'Crosshair color'}
              value={hex}
              onChange={(e) =>
                ['r', 'g', 'b'].forEach((c, i) => set(prefix + c, parseInt(e.target.value.slice(1 + i * 2, 3 + i * 2), 16)))
              }
            />
            <code>{hex.toUpperCase()}</code>
            <div className="color-presets">
              {['#00ff00', '#00c8ff', '#ffffff', '#ffda22', '#fa3250', '#000000'].map((color) => (
                <button
                  key={color}
                  aria-label={`Set ${outline ? 'outline' : 'crosshair'} ${color}`}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    ['r', 'g', 'b'].forEach((c, i) => set(prefix + c, parseInt(color.slice(1 + i * 2, 3 + i * 2), 16)))
                  }
                />
              ))}
            </div>
          </div>
          {['r', 'g', 'b', 'a'].map((c, i) => (
            <div className="setting-row compact" key={c}>
              <span>{['Red', 'Green', 'Blue', 'Opacity'][i]}</span>
              <NumberControl
                field={{
                  key: prefix + c,
                  label: `${outline ? 'Outline' : 'Crosshair'} ${['red', 'green', 'blue', 'opacity'][i]}`,
                  min: 0,
                  max: 255,
                }}
                value={channel(c)}
                onChange={(n) => set(prefix + c, n)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function SettingsList({ s, set }: { s: Settings; set: (key: string, value: number) => void }) {
  const visibleFields = styleFields(s);
  const [first, second, ...rest] = visibleFields;
  if (!first || !second) return null;
  return (
    <section className="settings-section">
      <div className="section-title">
        <h2>Style Settings</h2>
        <span>01</span>
      </div>
      <Row field={first} s={s} set={set} />
      <ColorRow s={s} set={set} />
      <Row field={second} s={s} set={set} />
      {s.cl_crosshair_drawoutline !== 0 && <ColorRow s={s} set={set} outline />}
      {rest.map((field) => (
        <Row key={field.key} field={field} s={s} set={set} />
      ))}
    </section>
  );
}
