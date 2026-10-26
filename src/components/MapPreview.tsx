import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize,
  Minimize,
  RotateCcw,
  Undo2,
  Play,
  Pause,
  AlertTriangle,
} from "lucide-react";
import { Preview } from "../Preview";
import type { Settings } from "../model";
import type { PreviewMode } from "../preview-geometry";
import type { RenderStatus } from "../preview-renderer";
const maps = [
  "dust2",
  "nuke",
  "mirage",
  "ancient",
  "anubis",
  "cache",
  "inferno",
];
const mapNames = [
  "Dust II",
  "Nuke",
  "Mirage",
  "Ancient",
  "Anubis",
  "Cache",
  "Inferno",
];
// Fit can shrink the detail view below 4×; label the scale it actually shows.
function detailLabel(magnification: number) {
  return Math.abs(magnification - 4) < 0.05
    ? "4× detail"
    : `${magnification.toFixed(1)}× detail (fit)`;
}
export type MapPreviewProps = {
  s: Settings;
  map: number;
  setMap: (value: number) => void;
  zoom: number;
  setZoom: (value: number) => void;
  effectiveHeight: number;
  dynamic: boolean;
  previewMode: PreviewMode;
  setPreviewMode: (value: PreviewMode) => void;
  phase: number;
  fit: boolean;
  inspectSplit: boolean;
  fullscreen: boolean;
  modal: "help" | "preview" | null;
  previewStatus: RenderStatus;
  mapRef: RefObject<HTMLDivElement | null>;
  setPreviewStatus: (value: RenderStatus) => void;
  toggleFullscreen: () => void;
  setModal: (value: "preview" | null) => void;
  goBack: () => void;
  reset: () => void;
  canUndo: boolean;
};

export function MapPreview({
  s,
  map,
  setMap,
  zoom,
  setZoom,
  effectiveHeight,
  dynamic,
  previewMode,
  setPreviewMode,
  phase,
  fit,
  inspectSplit,
  fullscreen,
  modal,
  previewStatus,
  mapRef,
  setPreviewStatus,
  toggleFullscreen,
  goBack,
  reset,
  canUndo,
  previewExpanded,
  setPreviewExpanded,
  setDynamic,
  setFit,
  onInspect,
}: MapPreviewProps & {
  previewExpanded: boolean;
  setPreviewExpanded: (value: boolean) => void;
  setDynamic: (value: boolean) => void;
  setFit: (value: boolean) => void;
  onInspect: (button: HTMLButtonElement) => void;
}) {
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const [detailMagnification, setDetailMagnification] = useState(4);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const options = optionsRef.current;
      if (
        modal === null && options && event.target instanceof Node &&
        !options.contains(event.target)
      ) {
        options.open = false;
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      const options = optionsRef.current;
      if (event.key === "Escape" && modal === null && options?.open) {
        options.open = false;
        options.querySelector("summary")?.focus();
        event.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [modal]);
  return (
    <section className="preview-section" aria-label="Crosshair preview">
      <div className="preview-toolbar">
        <button
          className="mobile-preview-toggle"
          aria-label={previewExpanded ? "Compact preview" : "Expand preview"}
          aria-expanded={previewExpanded}
          onClick={() => setPreviewExpanded(!previewExpanded)}
        >
          <span>
            {previewExpanded ? "Compact" : "Expand"}
            <span className="wide-label"> preview</span>
          </span>
        </button>
        <span>
          <span className="live-dot" />
          LIVE PREVIEW
        </span>
        <div className="zoom-buttons">
          {[1, 2, 4, 8].map((n) => (
            <button
              key={n}
              className={zoom === n ? "active" : ""}
              onClick={() => setZoom(n)}
              aria-label={`${n}x preview zoom`}
              aria-pressed={zoom === n}
            >
              {n}×
            </button>
          ))}
        </div>
        <details
          ref={optionsRef}
          className="preview-options"
          onToggle={(event) => {
            // On short viewports the panel can open below the fold; bring it into view.
            if (event.currentTarget.open)
              event.currentTarget
                .querySelector(".preview-options-panel")
                ?.scrollIntoView({ block: "nearest" });
          }}
        >
          <summary aria-label="Preview options">
            <span><span className="wide-label">Preview </span>options</span> <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="preview-options-panel">
            <button
              className="preview-settings-button"
              aria-label="Inspect preview"
              aria-haspopup="dialog"
              onClick={(event) => {
                onInspect(event.currentTarget);
              }}
            >
              <span>Inspect<span className="wide-label"> preview</span></span>
            </button>
            <select
              aria-label="Preview mode"
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
            >
              <option value="crosshair">Crosshair</option>
              <option value="scope">Scope dot</option>
            </select>
            <button
              className="fullscreen-button"
              aria-label="Fullscreen game-size preview"
              onClick={() => void toggleFullscreen()}
            >
              <Maximize size={15} />
              <span>Fullscreen</span>
            </button>
            <button
              className="dynamic-button"
              aria-pressed={dynamic}
              onClick={() => setDynamic(!dynamic)}
            >
              {dynamic ? <Pause size={14} /> : <Play size={14} />}{" "}
              {dynamic ? "Stop" : "Start"} Dynamic Preview
            </button>

            <div className="preview-caption">
              <span>Estimated preview. Verify the final crosshair in CS2.</span>
              <span>
                {zoom}x /{" "}
                {effectiveHeight ? `${effectiveHeight}p target` : "CSS pixels"}
                {fit ? " / Fit enabled" : ""}
              </span>
            </div>
          </div>
        </details>
      </div>
      <div
        ref={mapRef}
        className="map-preview"
        style={{ backgroundImage: `url(/maps/${maps[map]}.webp)` }}
      >
        <div className="map-label">
          <span>{mapNames[map]}</span>
          <small>CROSSHAIR PREVIEW</small>
        </div>
        <Preview
          settings={s}
          zoom={zoom}
          targetHeight={effectiveHeight || undefined}
          dynamic={dynamic}
          mode={previewMode}
          phase={phase}
          fit={fit}
          inspectSplit={inspectSplit}
          paused={modal !== null}
          onStatus={setPreviewStatus}
        />
        <button
          className="map-arrow previous"
          aria-label="Previous map"
          onClick={() => setMap((map + 6) % 7)}
        >
          <ChevronLeft size={28} />
        </button>
        <button
          className="map-arrow next"
          aria-label="Next map"
          onClick={() => setMap((map + 1) % 7)}
        >
          <ChevronRight size={28} />
        </button>
        <div className="detail-preview">
          <span>{detailLabel(detailMagnification)}</span>
          <div>
            <Preview
              onStatus={(status) => setDetailMagnification(status.magnification ?? 4)}
              settings={s}
              zoom={4}
              targetHeight={effectiveHeight || undefined}
              mode={previewMode}
              phase={phase}
              inspectSplit={inspectSplit}
              fit
              decorative
              paused
            />
          </div>
        </div>
        <div className="preview-actions">
          {fullscreen && (
            <button
              className="exit-fullscreen"
              aria-label="Exit fullscreen preview"
              onClick={() => void toggleFullscreen()}
            >
              <Minimize size={15} />
              Exit fullscreen
            </button>
          )}
          <div>
            <button
              aria-label="Undo Changes"
              onClick={goBack}
              disabled={!canUndo}
            >
              <Undo2 size={14} />
              <span>Undo Changes</span>
            </button>
            <button aria-label="Reset crosshair" onClick={reset}>
              <RotateCcw size={14} />
              <span>Reset crosshair</span>
            </button>
          </div>
        </div>
      </div>
      {previewStatus.clipped && (
        <div className="clipping-warning" role="status">
          <AlertTriangle size={16} />
          <span>Crosshair exceeds preview bounds.</span>
          <button onClick={() => setFit(true)}>Fit preview</button>
        </div>
      )}
    </section>
  );
}
