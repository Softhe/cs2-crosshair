import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { crosshairFields, grenadeKeep, grenadeTypes, sniperFields, styleFields, type Field, type Settings } from '../model';

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
  const step = field.step ?? 1;
  const min = field.min ?? 0;
  const max = field.max ?? 255;
  const normalize = (n: number) => Number((Math.round(Math.max(min, Math.min(max, n)) / step) * step).toFixed(2));
  const commit = () => {
    // Accept a decimal comma too; the field always shows a dot, as CS2 and the config files do.
    const n = Number(draft.replace(',', '.'));
    if (draft.trim() && Number.isFinite(n)) {
      const normalized = normalize(n);
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
        // A text field with the spinbutton role: type=number would show the browser locale's decimal comma.
        type="text"
        role="spinbutton"
        inputMode={min < 0 ? 'text' : step < 1 ? 'decimal' : 'numeric'}
        autoComplete="off"
        aria-label={field.label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft}
        disabled={disabled}
        aria-describedby={field.hint ? `${field.key}-hint` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            // Step from what is typed, when it is a number, so an uncommitted edit is not thrown away.
            const typed = Number(draft.replace(',', '.'));
            const from = draft.trim() && Number.isFinite(typed) ? typed : value;
            const next = normalize(from + (e.key === 'ArrowUp' ? step : -step));
            setDraft(format(next));
            onChange(next);
          }
        }}
      />
      {/* One-unit steps for touch screens, where a short slider cannot land on an exact value. Shown only in the single-column layout. */}
      <button
        type="button"
        className="step-button step-down"
        aria-label={`Decrease ${field.label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(normalize(value - step))}
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        className="step-button step-up"
        aria-label={`Increase ${field.label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(normalize(value + step))}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Row({
  field,
  s,
  set,
  shortLabel,
}: {
  field: Field;
  s: Settings;
  set: (key: string, value: number) => void;
  /** Visible label when the group already names the subject; the controls keep `field.label` as their name. */
  shortLabel?: string;
}) {
  return (
    <>
    <div className={`setting-row${shortLabel ? ' nested' : ''}`}>
      <label htmlFor={field.key}>
        {shortLabel ?? field.label}
      </label>
      {field.options ? (
        <select
          id={field.key}
          aria-label={field.label}
          aria-describedby={field.hint ? `${field.key}-hint` : undefined}
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
    {field.hint && <p id={`${field.key}-hint`} className="code-hint setting-hint">{field.hint}</p>}
    </>
  );
}

/** Parse #rgb or #rrggbb, with or without the #, into lower-case #rrggbb. */
export function parseHex(text: string): string | null {
  const m = text.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(m)) return '#' + m;
  if (/^[0-9a-f]{3}$/.test(m)) return '#' + [...m].map((c) => c + c).join('');
  return null;
}

/** A typed hex color, applied on Enter or blur. Anything that is not a color reverts to the current value. */
function HexInput({ label, hex, onChange }: { label: string; hex: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(hex.toUpperCase());
  useEffect(() => setDraft(hex.toUpperCase()), [hex]);
  const commit = () => {
    const parsed = parseHex(draft);
    if (parsed && parsed !== hex) onChange(parsed);
    setDraft((parsed ?? hex).toUpperCase());
  };
  return (
    <input
      className="text-input hex-input"
      aria-label={label}
      value={draft}
      maxLength={7}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(hex.toUpperCase());
          e.stopPropagation();
        }
      }}
    />
  );
}

export function ColorRow({
  outline = false,
  s,
  set,
  setMany,
}: {
  outline?: boolean;
  s: Settings;
  set: (key: string, value: number) => void;
  setMany: (values: Record<string, number>) => void;
}) {
  const [open, toggle] = useState(false);
  const prefix = outline ? 'cl_crosshairoutline_' : 'cl_crosshaircolor_';
  const label = outline ? 'Outline Color and Transparency' : 'Color and Transparency';
  const channel = (suffix: string): number => s[prefix + suffix] ?? 0;
  const hex = '#' + ['r', 'g', 'b'].map((c) => channel(c).toString(16).padStart(2, '0')).join('');
  // Apply all three channels as one change so a single Undo restores the previous color.
  const setHex = (color: string) =>
    setMany(Object.fromEntries(['r', 'g', 'b'].map((c, i) => [prefix + c, parseInt(color.slice(1 + i * 2, 3 + i * 2), 16)])));
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
              onChange={(e) => setHex(e.target.value)}
            />
            <HexInput label={`${outline ? 'Outline' : 'Crosshair'} hex color`} hex={hex} onChange={setHex} />
            <div className="color-presets">
              {['#00ff00', '#00c8ff', '#ffffff', '#ffda22', '#fa3250', '#000000'].map((color) => (
                <button
                  key={color}
                  aria-label={`Set ${outline ? 'outline' : 'crosshair'} ${color}`}
                  aria-pressed={hex === color}
                  style={{ '--swatch-color': color } as CSSProperties}
                  onClick={() => setHex(color)}
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

/**
 * The rest of CS2's crosshair menu: settings the preview does not draw, kept collapsed so the crosshair
 * itself stays the focus. Links and .cfg files carry them; share codes do not.
 */
function OtherSettings({ s, set }: { s: Settings; set: (key: string, value: number) => void }) {
  return (
    <details className="settings-section other-settings">
      <summary className="section-title">
        <h2 id="other-heading">Other CS2 settings</h2>
        <span>04</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <p className="section-note">
        Spectating, sniper rifle and grenade options. Links and .cfg files keep them; share codes do not.
      </p>
      <div className="other-settings-groups">
        <section aria-labelledby="other-spectating">
          <h3 id="other-spectating">Spectating and teammates</h3>
          {crosshairFields.map((field) => <Row key={field.key} field={field} s={s} set={set} />)}
        </section>
        <section aria-labelledby="other-sniper">
          <h3 id="other-sniper">Sniper rifles</h3>
          {sniperFields.map((field) => <Row key={field.key} field={field} s={s} set={set} />)}
        </section>
        <section aria-labelledby="other-grenades">
          <h3 id="other-grenades">Grenades</h3>
          <Row field={grenadeKeep} s={s} set={set} />
          {grenadeTypes.map(([type, name]) => {
            const shown = s[`cl_grenadecrosshair_${type}`] !== 0;
            return (
              <div key={type} className="grenade-group">
                <Row field={{ key: `cl_grenadecrosshair_${type}`, label: name, options: [[1, 'Yes'], [0, 'No']] }} s={s} set={set} />
                {shown && (
                  <Row field={{ key: `cl_grenadecrosshairdelay_${type}`, label: `${name} delay (seconds)`, min: 0, max: 5, step: 0.01 }} s={s} set={set} shortLabel="Delay (seconds)" />
                )}
              </div>
            );
          })}
        </section>
      </div>
    </details>
  );
}

export function SettingsList({ s, set, load, draftSaved }: {
  s: Settings;
  set: (key: string, value: number) => void;
  load: (settings: Settings) => void;
  draftSaved: boolean;
}) {
  const setMany = (values: Record<string, number>) => load({ ...s, ...values });
  const visibleFields = styleFields(s);
  const [first, second, ...rest] = visibleFields;
  if (!first || !second) return null;
  const isShapeField = (field: Field) => shapeKeys.has(field.key) && (field.key !== 'cl_crosshair_dynamic_maxdist_splitratio' || s.cl_crosshairstyle === 9);
  return (
    <div className="editor">
      <section className="settings-section" aria-labelledby="shape-heading">
        <div className="section-title"><h2 id="shape-heading">Shape</h2><span>01</span></div>
        <Row field={first} s={s} set={set} />

        {rest.filter(isShapeField).map(field => <Row key={field.key} field={field} s={s} set={set} />)}
      </section>
      <section className="settings-section" aria-labelledby="color-heading">
        <div className="section-title"><h2 id="color-heading">Color and outline</h2><span>02</span></div>
        <ColorRow s={s} set={set} setMany={setMany} />
        <Row field={second} s={s} set={set} />
        {s.cl_crosshair_drawoutline !== 0 && <ColorRow s={s} set={set} setMany={setMany} outline />}
      </section>
      <section className="settings-section" aria-labelledby="behavior-heading">
        <div className="section-title"><h2 id="behavior-heading">Behavior and scope</h2><span>03</span></div>
        {rest.filter(field => !isShapeField(field)).map(field => <Row key={field.key} field={field} s={s} set={set} />)}
      </section>
      <OtherSettings s={s} set={set} />
      {!draftSaved && <p className="draft-state error-text" role="alert">Draft could not be saved. Export a config to keep your changes.</p>}
    </div>
  );
}
