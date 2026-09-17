const clampChannel = (value: number): number => {
	if (!Number.isFinite(value)) return 0;
	return Math.round(Math.min(255, Math.max(0, value)));
};

export const rgbToHex = (red: number, green: number, blue: number): string => {
	return `#${[red, green, blue].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;
};

export const hexToRgb = (hex: string): { red: number; green: number; blue: number } | null => {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
	if (!match) return null;

	return {
		red: Number.parseInt(match[1], 16),
		green: Number.parseInt(match[2], 16),
		blue: Number.parseInt(match[3], 16),
	};
};
