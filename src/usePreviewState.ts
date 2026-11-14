import { useEffect, useRef, useState } from 'react';
import { PREVIEW_RESOLUTION_VERSION, previewResolution, previewTargetHeight, useDisplayEstimate } from './display';
import { gameView, gameViewStretch } from './preferences';
import type { PreviewMode } from './preview-geometry';
import type { RenderStatus } from './preview-renderer';
import { read, write } from './storage';
import type { Notify } from './useToast';

/** How the preview is viewed: map, zoom, resolution, game view, motion and fullscreen. None of it is part of the crosshair. */
export function usePreviewState(screenHeight: number, notify: Notify) {
  const [map, setMap] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dynamic, setDynamic] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('crosshair');
  const display = useDisplayEstimate();
  const [savedResolution] = useState(() => previewResolution(read('preview-resolution', null)));
  const [displayHeight, setDisplayHeight] = useState(savedResolution.customHeight);
  const [displayHeightDraft, setDisplayHeightDraft] = useState<string | null>(null);
  const [targetHeight, setTargetHeight] = useState(savedResolution.targetHeight);
  // Until the visitor picks a resolution, start from their monitor's own instead of assuming one.
  const [gameViewPreference, setGameViewPreference] = useState(() =>
    gameView(read('game-view', null) ?? { width: display.width, height: display.height }));
  useEffect(() => {
    write('game-view', gameViewPreference);
  }, [gameViewPreference]);
  useEffect(() => {
    write('preview-resolution', { targetHeight, customHeight: displayHeight, version: PREVIEW_RESOLUTION_VERSION });
  }, [targetHeight, displayHeight]);
  // Matching the game replaces the inspection resolution with the configured game render and its stretch.
  const effectiveHeight = gameViewPreference.enabled
    ? gameViewPreference.height
    : previewTargetHeight(targetHeight, screenHeight, display.height, displayHeight);
  const stretch = gameViewPreference.enabled ? gameViewStretch(gameViewPreference, display) : undefined;
  const [fit, setFit] = useState(false);
  const [phase, setPhase] = useState(0);
  const [inspectSplit, setInspectSplit] = useState(false);
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
    displayHeight, setDisplayHeight, displayHeightDraft, setDisplayHeightDraft, targetHeight, setTargetHeight,
    gameViewPreference, setGameViewPreference, effectiveHeight, stretch,
    fit, setFit, phase, setPhase, inspectSplit, setInspectSplit, previewStatus, setPreviewStatus,
    previewExpanded, setPreviewExpanded, mapRef, fullscreen, toggleFullscreen,
  };
}
