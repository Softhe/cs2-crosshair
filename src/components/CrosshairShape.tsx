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
	const lineStyle = {
		backgroundColor: crosshairColor,
		opacity: alpha,
		position: 'absolute' as const,
		zIndex: 10,
		borderRadius: '0.5px',
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
						borderRadius: '50%',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%, -50%)',
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
						left: '50%',
						top: beforeCenter(edgeGap + length),
						transform: 'translateX(-50%)'
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
							left: '50%',
							top: fromCenter(edgeGap),
							transform: 'translateX(-50%)'
						}}
					/>
					<div
						data-crosshair-part="arm"
						style={{
							...lineStyle,
							width: `${length}px`,
							height: `${thickness}px`,
							left: beforeCenter(edgeGap + length),
							top: '50%',
							transform: 'translateY(-50%)'
						}}
					/>
					<div
						data-crosshair-part="arm"
						style={{
							...lineStyle,
							width: `${length}px`,
							height: `${thickness}px`,
							left: fromCenter(edgeGap),
							top: '50%',
							transform: 'translateY(-50%)'
						}}
					/>
				</>
			)}
		</div>
	);
};
