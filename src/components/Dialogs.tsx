import { ArrowUpRight, X } from "lucide-react";
import type { Settings } from "../model";
import { useDisplayEstimate } from "../display";
import type { RenderStatus } from "../preview-renderer";
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
              Preview scale
              <select
                aria-label="Preview scale"
                value={targetHeight}
                onChange={(e) => setTargetHeight(Number(e.target.value))}
              >
                <option value="-1">Monitor size (estimated)</option>
                <option value="0">CSS pixels</option>
                <option value="1080">Estimated 1080p</option>
                <option value="1440">Estimated 1440p</option>
                <option value="2160">Estimated 2160p</option>
              </select>
            </label>
            {targetHeight === -1 && (
              <label>
                Display height
                <input
                  className="display-height"
                  aria-label="Display height in physical pixels"
                  type="number"
                  min="240"
                  max="8640"
                  step="1"
                  value={
                    displayHeightDraft ??
                    String(displayHeight || display.height)
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
              </label>
            )}
            <label>
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
                    ? "Estimated target-resolution size; game-pixel calibration is pending."
                    : "Reference height is exported metadata in CSS-pixel mode."}
            </span>
            <details className="preview-details">
              <summary>Preview details</summary>
              <p className="display-note">
                Display estimate {display.width} × {display.height} · pixel
                ratio {display.dpr.toFixed(2)}. Correct display height if
                needed. Fullscreen centers the crosshair on the screen. At 1×,
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
            through the display pixel ratio; this mapping has not been
            calibrated against game captures. Dynamic motion, recoil, quadrant
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
