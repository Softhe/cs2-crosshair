import { useEffect, useState, type CSSProperties } from 'react';
import { presets, styleFields, type Field, type Settings } from '../model';
import { Preview } from '../Preview';
import { settingsKey } from '../storage';

const shapeKeys = new Set(['cl_crosshair_thickness', 'cl_crosshairdot', 'cl_crosshair_length', 'cl_crosshair_gap', 'cl_crosshair_t', 'cl_crosshair_dynamic_maxdist_splitratio']);

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
        style={{ '--range-fill': `${100 * (value - (field.min ?? 0)) / (((field.max ?? 255) - (field.min ?? 0)) || 1)}%` } as CSSProperties}
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
        id={field.key}
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
                  aria-pressed={hex === color}
                  style={{ '--swatch-color': color } as CSSProperties}
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

export function SettingsList({ s, set, load, notify, draftSaved }: {
  s: Settings;
  set: (key: string, value: number) => void;
  load: (settings: Settings) => void;
  notify: (text: string, tone?: 'success' | 'warning' | 'error' | 'info') => void;
  draftSaved: boolean;
}) {
  const visibleFields = styleFields(s);
  const [first, second, ...rest] = visibleFields;
  if (!first || !second) return null;
  const isShapeField = (field: Field) => shapeKeys.has(field.key) && (field.key !== 'cl_crosshair_dynamic_maxdist_splitratio' || s.cl_crosshairstyle === 9);
  return (
    <div className="editor">
      <section className="settings-section" aria-labelledby="shape-heading">
        <div className="section-title"><h2 id="shape-heading">Shape</h2><span>01</span></div>
        <Row field={first} s={s} set={set} />
        <details className="starting-presets">
          <summary>Choose a starting point</summary>
          <div className="preset-grid">
            {presets.map(preset => (
              <button className="preset" key={preset.name} aria-pressed={settingsKey(preset.settings) === settingsKey(s)} onClick={() => { load(preset.settings); notify(`${preset.name} preset loaded.`, 'success'); }}>
                <div className="preset-preview"><Preview settings={preset.settings} zoom={1} decorative /></div>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </details>
        {rest.filter(isShapeField).map(field => <Row key={field.key} field={field} s={s} set={set} />)}
      </section>
      <section className="settings-section" aria-labelledby="color-heading">
        <div className="section-title"><h2 id="color-heading">Color and outline</h2><span>02</span></div>
        <ColorRow s={s} set={set} />
        <Row field={second} s={s} set={set} />
        {s.cl_crosshair_drawoutline !== 0 && <ColorRow s={s} set={set} outline />}
      </section>
      <section className="settings-section" aria-labelledby="behavior-heading">
        <div className="section-title"><h2 id="behavior-heading">Behavior and scope</h2><span>03</span></div>
        {rest.filter(field => !isShapeField(field)).map(field => <Row key={field.key} field={field} s={s} set={set} />)}
      </section>
      <p className="draft-state" role="status">{draftSaved ? 'Draft saved on this device.' : 'Draft could not be saved. Export a config to keep your changes.'}</p>
    </div>
  );
}
