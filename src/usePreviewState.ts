import { useEffect, useRef, useState } from 'react';
import { useDisplayEstimate } from './display';
import { gameView, gameViewStretch } from './preferences';
import type { PreviewMode } from './preview-geometry';
import type { RenderStatus } from './preview-renderer';
import { read, write } from './storage';
import type { Notify } from './useToast';

/** How the preview is viewed: map, zoom, game view, motion and fullscreen. None of it is part of the crosshair. */
export function usePreviewState(screenHeight: number, notify: Notify) {
  const [map, setMap] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dynamic, setDynamic] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('crosshair');
  const display = useDisplayEstimate();
  // Until the visitor picks a resolution, start from their monitor's own instead of assuming one.
  const [gameViewPreference, setGameViewPreference] = useState(() =>
    gameView(read('game-view', null) ?? { width: display.width, height: display.height }));
  useEffect(() => {
    write('game-view', gameViewPreference);
  }, [gameViewPreference]);
  // The crosshair is drawn at the resolution it was made for, where one unit is one game pixel.
  // Matching the game replaces that with the configured game render and its stretch.
  const effectiveHeight = gameViewPreference.enabled ? gameViewPreference.height : screenHeight;
  const stretch = gameViewPreference.enabled ? gameViewStretch(gameViewPreference, display) : undefined;
  const [previewStatus, setPreviewStatus] = useState<RenderStatus>({ clipped: false, scale: 1 });
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === mapRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await mapRef.current?.requestFullscreen();
    } catch {
      notify('Fullscreen is unavailable in this browser. The inline preview remains usable.', 'warning');
    }
  };

  return {
    map, setMap, zoom, setZoom, dynamic, setDynamic, previewMode, setPreviewMode, display,
    gameViewPreference, setGameViewPreference, effectiveHeight, stretch, previewStatus, setPreviewStatus,
    previewExpanded, setPreviewExpanded, mapRef, fullscreen, toggleFullscreen,
  };
}
