import { describe, expect, it } from 'vitest';
import { hexToRgb, rgbToHex } from '@/lib/color';

describe('color conversion', () => {
	it('converts RGB channels to a normalized hex color', () => {
		expect(rgbToHex(12, 128, 240)).toBe('#0c80f0');
		expect(rgbToHex(-10, 300, 12.4)).toBe('#00ff0c');
		expect(rgbToHex(NaN, Infinity, -Infinity)).toBe('#000000');
	});

	it('converts valid hex colors and rejects invalid values', () => {
		expect(hexToRgb('#0c80f0')).toEqual({ red: 12, green: 128, blue: 240 });
		expect(hexToRgb('ffffff')).toEqual({ red: 255, green: 255, blue: 255 });
		expect(hexToRgb('#fff')).toBeNull();
	});
});
