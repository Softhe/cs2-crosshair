import { ArrowUpRight, X } from "lucide-react";
import type { Settings } from "../model";
import { useDisplayEstimate } from "../display";
import type { RenderStatus } from "../preview-renderer";
import type { PreviewMode } from "../preview-geometry";
import { write } from "../storage";
import type { RefObject } from "react";
export type DialogsProps = {
  modal: "help" | "preview" | null;
  setModal: (value: "help" | "preview" | null) => void;
  dynamic: boolean;
  setDynamic: (value: boolean) => void;
  targetHeight: number;
  setTargetHeight: (value: number) => void;
  display: ReturnType<typeof useDisplayEstimate>;
  displayHeight: number;
  setDisplayHeight: (value: number) => void;
  displayHeightDraft: string | null;
  setDisplayHeightDraft: (value: string | null) => void;
  fit: boolean;
  setFit: (value: boolean) => void;
  phase: number;
  setPhase: (value: number) => void;
  inspectSplit: boolean;
  setInspectSplit: (value: boolean) => void;
  previewStatus: RenderStatus;
  effectiveHeight: number;
  matchingGame: boolean;
  previewMode: PreviewMode;
  s: Settings;
  rating: number;
  setRating: (value: number) => void;
  note: string;
  setNote: (value: string) => void;
};

export function Dialogs({
  dialogRef,
  modal,
  setModal,
  setDynamic,
  targetHeight,
  setTargetHeight,
  display,
  displayHeight,
  setDisplayHeight,
  displayHeightDraft,
  setDisplayHeightDraft,
  fit,
  setFit,
  phase,
  setPhase,
  inspectSplit,
  setInspectSplit,
  previewStatus,
  effectiveHeight,
  matchingGame,
  previewMode,
  s,
  rating,
  setRating,
  note,
  setNote,
}: DialogsProps & { dialogRef: RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog
      aria-labelledby="studio-dialog-title"
      ref={dialogRef}
      onCancel={() => setModal(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setModal(null);
      }}
      className="modal"
    >
      <div className="modal-header">
        <h2 id="studio-dialog-title">
          {modal === "preview" ? "Inspect preview" : "Using the studio"}
        </h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={() => setModal(null)}
        >
          <X size={20} />
        </button>
      </div>

      {modal === "preview" && (
        <div className="modal-content preview-settings-dialog">
          <div className="preview-controls">
            <label>
              Game resolution
              <select
                aria-label="Preview scale"
                disabled={matchingGame}
                value={targetHeight}
                onChange={(e) => setTargetHeight(Number(e.target.value))}
              >
                <option value="-1">Use monitor estimate</option>
                <option value="-2">Custom game render height</option>
                <option value="0">CSS pixels</option>
                <option value="720">1280 × 720</option>
                <option value="1080">1920 × 1080</option>
                <option value="1440">2560 × 1440</option>
                <option value="2160">3840 × 2160</option>
              </select>
            </label>
            {matchingGame && (
              <p className="display-note">
                Match my in-game size is on in Preview options, so the preview uses that resolution instead.
              </p>
            )}
            {!matchingGame && targetHeight === -2 && (
              <label>
                Game render height
                <span className="display-height-field">
                  <input
                    className="display-height"
                    aria-label="Game render height in physical pixels"
                    type="number"
                    min="240"
                    max="8640"
                    step="1"
                    value={
                      displayHeightDraft ??
                      String(displayHeight)
                    }
                    onChange={(e) => {
                      setDisplayHeightDraft(e.target.value);
                      const value = Number(e.target.value);
                      if (
                        Number.isInteger(value) &&
                        value >= 240 &&
                        value <= 8640
                      )
                        setDisplayHeight(value);
                    }}
                    onBlur={() => setDisplayHeightDraft(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  px
                </span>
              </label>
            )}
            <p className="display-note">Match the resolution selected in CS2, including when the game runs in a window. The browser cannot detect the game resolution. Preview changes leave crosshair codes and exports unchanged.</p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={fit}
                onChange={(e) => setFit(e.target.checked)}
              />
              Fit crosshair in preview
            </label>
            <label>
              Inspection phase
              <input
                type="range"
                style={
                  { "--range-fill": `${phase * 100}%` } as React.CSSProperties
                }
                aria-label="Inspection phase"
                min="0"
                max="1"
                step="0.01"
                value={phase}
                onChange={(e) => {
                  setDynamic(false);
                  setPhase(Number(e.target.value));
                }}
              />
            </label>
            {s.cl_crosshairstyle === 2 && (
              <label>
                <input
                  type="checkbox"
                  checked={inspectSplit}
                  onChange={(e) => setInspectSplit(e.target.checked)}
                />
                Inspect split arms
              </label>
            )}
            <span aria-live="polite">
              {previewStatus.clipped
                ? "Crosshair exceeds preview bounds. Enable fit to see the full shape."
                : fit
                  ? "Fit view may reduce magnification; exported settings are unchanged."
                  : effectiveHeight
                    ? previewMode === "crosshair" && s.cl_crosshairstyle === 4 && s.cl_crosshair_gap >= 0
                      ? "Static Cross pixels match measured CS2 captures at this target."
                      : "Estimated target-resolution size; only Static Cross is calibrated against game captures."
                    : "Reference height is exported metadata in CSS-pixel mode."}
            </span>
            <details className="preview-details">
              <summary>Preview details</summary>
              <p className="display-note">
                GPU sharpening and game post-processing can change crosshair colors and edges.
                This preview shows the crosshair before those effects.
              </p>
              <p className="display-note">
                Display estimate {display.width} × {display.height} · pixel
                ratio {display.dpr.toFixed(2)}. Monitor estimates can differ from the game render resolution. Fullscreen centers the crosshair on the screen. At 1×,
                image size does not shrink the crosshair; 2×–8× magnify it for
                editing.
              </p>
            </details>
          </div>
        </div>
      )}
      {modal === "help" && (
        <div className="modal-content help-content">
          <h3>From the studio to CS2</h3>
          <ol>
            <li>Choose a style and adjust its settings.</li>
            <li>Copy the CS2 share code.</li>
            <li>
              In CS2, open Settings → Crosshair / Scopes → Share or Import.
              Paste and import.
            </li>
          </ol>
          <h3>Configs and aliases</h3>
          <p>
            Place the downloaded .cfg file in{" "}
            <code>Counter-Strike Global Offensive/game/csgo/cfg</code>. Without
            an alias, type <code>exec crosshair.cfg</code> in the CS2 console.
            An alias such as <code>team_green</code> under Advanced export names
            the download <code>crosshair_team_green.cfg</code>. Add the copied
            autoexec shortcut to <code>autoexec.cfg</code>, then type{" "}
            <code>team_green</code> in the console.
          </p>
          <h3>Preview accuracy</h3>
          <p>
            The preview uses real game backgrounds. CSS-pixel mode shows editor
            magnification. Estimated resolution modes scale by target height
            divided by exported reference height and convert physical pixels
            through the display pixel ratio. Static Cross with a nonnegative
            gap matches measured game captures; other styles are approximate.
            GPU sharpening can change colors and edges. Dynamic motion, recoil, quadrant
            geometry and scope rendering are browser approximations. The
            animation exercises the configured spread limit; it does not model
            weapon inaccuracy, spread or the game's 64-pixel baseline. Verify
            the final crosshair in CS2.
          </p>
          <h3>Give yourself a note</h3>
          <p>Feedback stays on this device.</p>
          <div className="rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                aria-label={`Rate ease of use ${n} out of 5`}
                aria-pressed={rating === n}
                className={n === rating ? "active" : ""}
                key={n}
                onClick={() => {
                  setRating(n);
                  write("rating", n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Local feedback note"
            className="import-area"
            placeholder="A note for next time…"
            maxLength={1000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              write("feedback-note", e.target.value);
            }}
          />
          <a
            className="issue-link"
            href={`https://github.com/Softhe/cs2-crosshair/issues/new?title=${encodeURIComponent("Crosshair studio feedback")}&body=${encodeURIComponent("Feedback about the new crosshair studio.\n\nDescribe the issue here. No settings or local data have been attached.")}`}
            target="_blank"
            rel="noreferrer"
          >
            Open an issue draft
            <ArrowUpRight size={15} />
          </a>
          <p className="section-note">
            The issue draft contains no crosshair, alias, library or feedback
            data. Review it before submitting.
          </p>
        </div>
      )}
    </dialog>
  );
}
