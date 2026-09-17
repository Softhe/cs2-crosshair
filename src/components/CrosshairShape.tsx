import { memo, useMemo } from 'react';
import { getCrosshairPreviewColor, type Crosshair } from '@/lib/cs2-sharecode';
import { clampCrosshair, getCrosshairPreviewMetrics } from '@/lib/crosshair-preview';

interface CrosshairShapeProps {
	crosshair: Crosshair;
	className?: string;
	resolutionScale?: number;
	zoom?: number;
}

interface ShapeRect {
	part: 'arm' | 'dot';
	x: number;
	y: number;
	width: number;
	height: number;
}

export const CrosshairShape = memo(function CrosshairShape({ crosshair, className = '', resolutionScale = 1, zoom = 1 }: CrosshairShapeProps) {
	const { color, alpha, rects, outlineThickness, halfExtent } = useMemo(() => {
		const safeCrosshair = clampCrosshair(crosshair);
		const previewColor = getCrosshairPreviewColor(safeCrosshair);
		const { length, thickness, edgeGap, outlineThickness: outline } = getCrosshairPreviewMetrics(safeCrosshair, resolutionScale, zoom);
		const halfThickness = thickness / 2;
		const built: ShapeRect[] = [];

		if (safeCrosshair.centerDotEnabled) {
			built.push({ part: 'dot', x: -halfThickness, y: -halfThickness, width: thickness, height: thickness });
		}

		if (length > 0) {
			if (!safeCrosshair.tStyleEnabled) {
				built.push({ part: 'arm', x: -halfThickness, y: -(edgeGap + length), width: thickness, height: length });
			}
			built.push({ part: 'arm', x: -halfThickness, y: edgeGap, width: thickness, height: length });
			built.push({ part: 'arm', x: -(edgeGap + length), y: -halfThickness, width: length, height: thickness });
			built.push({ part: 'arm', x: edgeGap, y: -halfThickness, width: length, height: thickness });
		}

		// The SVG is centered on the crosshair, so half the canvas must cover the
		// farthest arm edge plus its outline. One extra pixel keeps the outline
		// from clipping at the canvas edge.
		const halfExtent = Math.max(halfThickness, edgeGap + length + outline + 1);

		return {
			color: `rgb(${previewColor.r}, ${previewColor.g}, ${previewColor.b})`,
			alpha: safeCrosshair.alphaEnabled ? safeCrosshair.alpha / 255 : 1,
			rects: built,
			outlineThickness: outline,
			halfExtent,
		};
	}, [crosshair, resolutionScale, zoom]);

	const size = halfExtent * 2;

	return (
		<div className={`relative h-full w-full ${className}`}>
			<svg
				width={size}
				height={size}
				aria-hidden="true"
				focusable="false"
				shapeRendering="crispEdges"
				style={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					transform: 'translate(-50%, -50%)',
					overflow: 'visible',
				}}
			>
				<g transform={`translate(${halfExtent}, ${halfExtent})`}>
					{outlineThickness > 0 &&
						rects.map((rect, index) => (
							<rect
								key={`outline-${rect.part}-${index}`}
								data-crosshair-part={`${rect.part}-outline`}
								x={rect.x - outlineThickness}
								y={rect.y - outlineThickness}
								width={rect.width + outlineThickness * 2}
								height={rect.height + outlineThickness * 2}
								fill="#000"
								fillOpacity={0.8}
							/>
						))}
					{rects.map((rect, index) => (
						<rect
							key={`fill-${rect.part}-${index}`}
							data-crosshair-part={rect.part}
							x={rect.x}
							y={rect.y}
							width={rect.width}
							height={rect.height}
							fill={color}
							fillOpacity={alpha}
						/>
					))}
				</g>
			</svg>
		</div>
	);
});
