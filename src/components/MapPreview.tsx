import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
import { paintRasterFrame, type RasterFrame, type RenderStatus } from "../preview-renderer";
import type { GameView } from "../preferences";
import type { PreferenceSyncStatus } from "../preference-sync";
import { GameViewOptions } from "./GameViewOptions";
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
export type MapPreviewProps = {
  s: Settings;
  map: number;
  setMap: (value: number) => void;
  zoom: number;
  setZoom: (value: number) => void;
  effectiveHeight: number;
  stretch?: [number, number];
  gameView: GameView;
  setGameView: (value: GameView) => void;
  gameViewSync: PreferenceSyncStatus;
  display: { width: number; height: number };
  dynamic: boolean;
  previewMode: PreviewMode;
  setPreviewMode: (value: PreviewMode) => void;
  fullscreen: boolean;
  modal: "help" | null;
  previewStatus: RenderStatus;
  mapRef: RefObject<HTMLDivElement | null>;
  setPreviewStatus: (value: RenderStatus) => void;
  toggleFullscreen: () => void;
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
  stretch,
  gameView,
  setGameView,
  gameViewSync,
  display,
  dynamic,
  previewMode,
  setPreviewMode,
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
}: MapPreviewProps & {
  previewExpanded: boolean;
  setPreviewExpanded: (value: boolean) => void;
  setDynamic: (value: boolean) => void;
}) {
  // A crosshair too large for the preview is drawn smaller; say so instead of leaving the zoom label wrong.
  const shown = previewStatus.magnification ?? zoom, fitted = shown < zoom - 1e-6;
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const detailRef = useRef<HTMLCanvasElement>(null), rasterRef = useRef<RasterFrame | null>(null);
  const [detailClipped, setDetailClipped] = useState(false);
  const paintDetail = useCallback((frame: RasterFrame) => {
    rasterRef.current = frame;
    if (detailRef.current) setDetailClipped(paintRasterFrame(frame, detailRef.current, 4));
  }, []);
  useEffect(() => {
    const canvas = detailRef.current;
    if (!canvas) return;
    const resize = new ResizeObserver(() => { if (rasterRef.current) paintDetail(rasterRef.current); });
    resize.observe(canvas);
    return () => resize.disconnect();
  }, [paintDetail]);
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
  // Fullscreen hides the toolbar, so the zoom choices are repeated over the map there.
  const zoomButtons = (
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
  );
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
        <small className="preview-target">{gameView.enabled ? <>{gameView.width}×{gameView.height}<span className="wide-label">{gameView.stretched ? " stretched" : " in game"}</span></> : <>{effectiveHeight}p<span className="wide-label"> as designed</span></>}</small>
        {zoomButtons}
        <button
          className="fullscreen-button"
          aria-label="Fullscreen game-size preview"
          title="Fullscreen"
          onClick={() => void toggleFullscreen()}
        >
          <Maximize size={15} />
        </button>
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
            <GameViewOptions view={gameView} setView={setGameView} monitor={display} syncStatus={gameViewSync} />
            <select
              aria-label="Preview mode"
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
            >
              <option value="crosshair">Crosshair</option>
              <option value="scope">Scope dot</option>
            </select>
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
                {gameView.enabled
                  ? `${gameView.width} × ${gameView.height}${gameView.stretched ? " stretched" : ""}`
                  : `${effectiveHeight}p as designed`}
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
          stretch={stretch}
          dynamic={dynamic}
          mode={previewMode}
          fit
          paused={modal !== null}
          onStatus={setPreviewStatus}
          onFrame={paintDetail}
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
        {fullscreen && (
          <div className="fullscreen-controls">
            {zoomButtons}
            <button
              className="exit-fullscreen"
              aria-label="Exit fullscreen preview"
              onClick={() => void toggleFullscreen()}
            >
              <Minimize size={15} />
              Exit fullscreen
            </button>
          </div>
        )}
        <div className="detail-preview">
          <span>{detailClipped ? "4× detail · cropped" : "4× detail"}</span>
          <div>
            <canvas ref={detailRef} className="crosshair-canvas" aria-hidden="true" />
          </div>
        </div>
        <div className="preview-actions">
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
      {previewStatus.clipped ? (
        <div className="clipping-warning" role="status">
          <AlertTriangle size={16} />
          <span>This crosshair is too large to preview completely.</span>
        </div>
      ) : fitted && (
        <div className="fit-note" role="status">
          Too large for {zoom}×, so it is shown at {Number(shown.toFixed(2))}× to fit.
        </div>
      )}
    </section>
  );
}
