import type { RefObject } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, RotateCcw, Undo2 } from 'lucide-react';
import { Preview } from '../Preview';
import type { Settings } from '../model';
import type { PreviewMode } from '../preview-geometry';
import type { RenderStatus } from '../preview-renderer';

export const maps = ['dust2', 'nuke', 'mirage', 'ancient', 'anubis', 'cache', 'inferno'];
export const mapNames = ['Dust II', 'Nuke', 'Mirage', 'Ancient', 'Anubis', 'Cache', 'Inferno'];

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
  modal: 'help' | 'preview' | null;
  previewStatus: RenderStatus;
  mapRef: RefObject<HTMLDivElement | null>;
  setPreviewStatus: (value: RenderStatus) => void;
  toggleFullscreen: () => void;
  setModal: (value: 'preview' | null) => void;
  goBack: () => void;
  reset: () => void;
  canUndo: boolean;
};

export function MapPreview(p: MapPreviewProps) {
  return (
    <>
      <div className="preview-toolbar">
        <span>
          <span className="live-dot" />
          LIVE PREVIEW
        </span>
        <div>
          <button
            className="preview-settings-button"
            aria-haspopup="dialog"
            onClick={() => p.setModal('preview')}
          >
            Preview settings
          </button>
          <select
            aria-label="Preview mode"
            value={p.previewMode}
            onChange={(e) => p.setPreviewMode(e.target.value as PreviewMode)}
          >
            <option value="crosshair">Crosshair</option>
            <option value="scope">Scope dot</option>
          </select>
          <button
            className="fullscreen-button"
            aria-label="Fullscreen game-size preview"
            onClick={() => void p.toggleFullscreen()}
          >
            <Maximize size={15} />
            <span>Fullscreen</span>
          </button>
          <span className="toolbar-divider" />
          <div className="zoom-buttons">
            {[1, 2, 4, 8].map((n) => (
              <button
                key={n}
                className={p.zoom === n ? 'active' : ''}
                onClick={() => p.setZoom(n)}
                aria-label={`${n}x preview zoom`}
                aria-pressed={p.zoom === n}
              >
                {n}×
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={p.mapRef}
        className="map-preview"
        style={{ backgroundImage: `url(/maps/${maps[p.map]}.webp)` }}
      >
        <div className="map-label">
          <span>{mapNames[p.map]}</span>
          <small>CROSSHAIR PREVIEW</small>
        </div>
        <Preview
          settings={p.s}
          zoom={p.zoom}
          targetHeight={p.effectiveHeight || undefined}
          dynamic={p.dynamic}
          mode={p.previewMode}
          phase={p.phase}
          fit={p.fit}
          inspectSplit={p.inspectSplit}
          paused={p.modal !== null}
          onStatus={p.setPreviewStatus}
        />
        <button className="map-arrow previous" aria-label="Previous map" onClick={() => p.setMap((p.map + 6) % 7)}>
          <ChevronLeft size={28} />
        </button>
        <button className="map-arrow next" aria-label="Next map" onClick={() => p.setMap((p.map + 1) % 7)}>
          <ChevronRight size={28} />
        </button>
        <div className="detail-preview">
          <span>4× detail</span>
          <div>
            <Preview
              settings={p.s}
              zoom={4}
              targetHeight={p.effectiveHeight || undefined}
              mode={p.previewMode}
              phase={p.phase}
              inspectSplit={p.inspectSplit}
              fit
              decorative
              paused
            />
          </div>
        </div>
        <div className="preview-actions">
          {p.fullscreen && (
            <button
              className="exit-fullscreen"
              aria-label="Exit fullscreen preview"
              onClick={() => void p.toggleFullscreen()}
            >
              <Minimize size={15} />
              Exit fullscreen
            </button>
          )}
          <div>
            <button aria-label="Undo Changes" onClick={p.goBack} disabled={!p.canUndo}>
              <Undo2 size={14} />
              <span>Undo Changes</span>
            </button>
            <button aria-label="Reset crosshair" onClick={p.reset}>
              <RotateCcw size={14} />
              <span>Reset crosshair</span>
            </button>
          </div>
        </div>
      </div>
      <div className="preview-caption">
        <span>
          {p.effectiveHeight
            ? `${p.zoom}× ${p.zoom === 1 ? 'game-size estimate' : 'inspection'} · ${p.effectiveHeight}p target · ${p.s.cl_crosshair_screen_height}p reference`
            : `${p.zoom}× CSS-pixel inspection`}{' '}
          · {p.previewStatus.scale.toFixed(2)} CSS px per unit
        </span>
        <span>Centered on the preview · geometry is approximate</span>
      </div>
    </>
  );
}
