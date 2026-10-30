import { useState } from "react";
import { gameResolutionGroups, gameResolutions, gameViewStretch, type GameView } from "../preferences";
import type { PreferenceSyncStatus } from "../preference-sync";

const syncLabels: Record<PreferenceSyncStatus, string> = {
  local: "Saved on this device. Sign in with Steam to sync it.",
  loading: "Loading from Steam…",
  pending: "Saving to Steam…",
  synced: "Synced to your Steam account.",
  error: "Steam sync unavailable. Saved on this device.",
};

function SideInput({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step="1"
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = Number(e.target.value);
        if (Number.isInteger(next) && next >= min && next <= max) onCommit(next);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function GameViewOptions({ view, setView, monitor, syncStatus }: {
  view: GameView;
  setView: (value: GameView) => void;
  monitor: { width: number; height: number };
  syncStatus: PreferenceSyncStatus;
}) {
  const monitorListed = gameResolutions.some(([w, h]) => w === monitor.width && h === monitor.height);
  const preset = gameResolutions.some(([w, h]) => w === view.width && h === view.height)
    || (!monitorListed && view.width === monitor.width && view.height === monitor.height);
  const [custom, setCustom] = useState(!preset);
  const [sx, sy] = gameViewStretch(view, monitor);
  return (
    <div className="game-view-options">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={view.enabled}
          onChange={(e) => setView({ ...view, enabled: e.target.checked })}
        />
        Match my in-game size
      </label>
      {view.enabled && (
        <>
          <label>
            CS2 resolution
            <select
              aria-label="CS2 resolution"
              value={custom || !preset ? "custom" : `${view.width}x${view.height}`}
              onChange={(e) => {
                if (e.target.value === "custom") return setCustom(true);
                const [width, height] = e.target.value.split("x").map(Number);
                setCustom(false);
                setView({ ...view, width: width!, height: height! });
              }}
            >
              {!monitorListed && (
                <optgroup label="Your monitor">
                  <option value={`${monitor.width}x${monitor.height}`}>{monitor.width} × {monitor.height}</option>
                </optgroup>
              )}
              {gameResolutionGroups.map((group) => {
                // Like CS2, offer only modes the monitor can show, but never hide the current choice.
                const sizes = group.sizes.filter(([w, h]) => (w <= monitor.width && h <= monitor.height) || (w === view.width && h === view.height));
                return sizes.length ? (
                  <optgroup key={group.label} label={group.label}>
                    {sizes.map(([w, h]) => (
                      <option key={`${w}x${h}`} value={`${w}x${h}`}>{w} × {h}</option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              <option value="custom">Custom…</option>
            </select>
          </label>
          {(custom || !preset) && (
            <span className="game-view-custom">
              <SideInput label="CS2 width" value={view.width} min={320} max={15360} onCommit={(width) => setView({ ...view, width })} />
              ×
              <SideInput label="CS2 height" value={view.height} min={240} max={8640} onCommit={(height) => setView({ ...view, height })} />
            </span>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={view.stretched}
              onChange={(e) => setView({ ...view, stretched: e.target.checked })}
            />
            Stretched to fill the monitor
          </label>
          <small className="game-view-note">
            Monitor {monitor.width} × {monitor.height} (estimated). Each game pixel shows as{" "}
            {sx.toFixed(2)} × {sy.toFixed(2)} screen pixels.
          </small>
          <small className="game-view-note" role="status">{syncLabels[syncStatus]}</small>
        </>
      )}
    </div>
  );
}
