import { getCrosshairPreviewColor, type Crosshair } from '@/lib/cs2-sharecode';
import { clampCrosshair, getCrosshairPreviewMetrics } from '@/lib/crosshair-preview';

interface CrosshairShapeProps {
	crosshair: Crosshair;
	className?: string;
	resolutionScale?: number;
	zoom?: number;
}

export const CrosshairShape = ({ crosshair, className = '', resolutionScale = 1, zoom = 1 }: CrosshairShapeProps) => {
	const safeCrosshair = clampCrosshair(crosshair);
	const color = getCrosshairPreviewColor(safeCrosshair);
	const crosshairColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
	const alpha = safeCrosshair.alphaEnabled ? safeCrosshair.alpha / 255 : 1;
	const { length, thickness, edgeGap, outlineThickness } = getCrosshairPreviewMetrics(safeCrosshair, resolutionScale, zoom);
	const fromCenter = (offset: number) => `calc(50% ${offset < 0 ? '-' : '+'} ${Math.abs(offset)}px)`;
	const beforeCenter = (offset: number) => `calc(50% ${offset < 0 ? '+' : '-'} ${Math.abs(offset)}px)`;
	const centeredStart = (size: number) => `calc(50% - ${Math.floor(size / 2)}px)`;
	const lineStyle = {
		backgroundColor: crosshairColor,
		opacity: alpha,
		position: 'absolute' as const,
		zIndex: 10,
		...(outlineThickness > 0 && { boxShadow: `0 0 0 ${outlineThickness}px rgba(0, 0, 0, 0.8)` })
	};

	return (
		<div className={`relative h-full w-full ${className}`}>
			{safeCrosshair.centerDotEnabled && (
				<div
					data-crosshair-part="dot"
					style={{
						...lineStyle,
						width: `${thickness}px`,
						height: `${thickness}px`,
						left: centeredStart(thickness),
						top: centeredStart(thickness),
						zIndex: 20
					}}
				/>
			)}
			{!safeCrosshair.tStyleEnabled && length > 0 && (
				<div
					data-crosshair-part="arm"
					style={{
						...lineStyle,
						width: `${thickness}px`,
						height: `${length}px`,
						left: centeredStart(thickness),
						top: beforeCenter(edgeGap + length),
					}}
				/>
			)}
			{length > 0 && (
				<>
					<div
						data-crosshair-part="arm"
						style={{
							...lineStyle,
							width: `${thickness}px`,
							height: `${length}px`,
							left: centeredStart(thickness),
							top: fromCenter(edgeGap),
						}}
					/>
					<div
						data-crosshair-part="arm"
						style={{
							...lineStyle,
							width: `${length}px`,
							height: `${thickness}px`,
							left: beforeCenter(edgeGap + length),
							top: centeredStart(thickness),
						}}
					/>
					<div
						data-crosshair-part="arm"
						style={{
							...lineStyle,
							width: `${length}px`,
							height: `${thickness}px`,
							left: fromCenter(edgeGap),
							top: centeredStart(thickness),
						}}
					/>
				</>
			)}
		</div>
	);
};
