import { describe, expect, it } from 'vitest';
import {
	crosshairToConVars,
	decodeCrosshairShareCode,
	encodeCrosshair,
	getCrosshairPreviewColor,
	InvalidCrosshairShareCode,
	InvalidShareCode,
	type Crosshair,
} from '@/lib/cs2-sharecode';

interface CrosshairFixture {
	name: string;
	code: string;
	expected: Crosshair;
}

// Real share codes exposed by the product's Example action. Keeping the decoded
// values here makes this a regression corpus instead of a self-referential
// encode/decode test.
const CROSSHAIR_CORPUS: CrosshairFixture[] = [
	{
		name: 'small green static',
		code: 'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA',
		expected: {
			gap: -4, outline: 1, red: 0, green: 255, blue: 0, alpha: 255,
			splitDistance: 3, fixedCrosshairGap: 3, color: 4, outlineEnabled: false,
			innerSplitAlpha: 0, outerSplitAlpha: 1, splitSizeRatio: 1, thickness: 1,
			centerDotEnabled: false, deployedWeaponGapEnabled: false, alphaEnabled: true,
			tStyleEnabled: false, style: 4, length: 1,
		},
	},
	{
		name: 'translucent custom-color static',
		code: 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO',
		expected: {
			gap: -3.5, outline: 1, red: 0, green: 255, blue: 255, alpha: 200,
			splitDistance: 3, fixedCrosshairGap: 3, color: 5, outlineEnabled: false,
			innerSplitAlpha: 0, outerSplitAlpha: 1, splitSizeRatio: 1, thickness: 1,
			centerDotEnabled: false, deployedWeaponGapEnabled: false, alphaEnabled: true,
			tStyleEnabled: false, style: 4, length: 1,
		},
	},
	{
		name: 'outlined center dot',
		code: 'CSGO-sXMJy-i8zaz-T4jvf-G8Ay7-b2D7K',
		expected: {
			gap: -3, outline: 0, red: 0, green: 238, blue: 144, alpha: 255,
			splitDistance: 3, fixedCrosshairGap: 3, color: 4, outlineEnabled: true,
			innerSplitAlpha: 0, outerSplitAlpha: 1, splitSizeRatio: 1, thickness: 1.5,
			centerDotEnabled: true, deployedWeaponGapEnabled: false, alphaEnabled: true,
			tStyleEnabled: false, style: 4, length: 0,
		},
	},
];

describe('CS2 crosshair share-code corpus', () => {
	it.each(CROSSHAIR_CORPUS)('decodes and byte-round-trips $name', ({ code, expected }) => {
		const decoded = decodeCrosshairShareCode(code);
		expect(decoded).toEqual(expected);
		expect(encodeCrosshair(decoded)).toBe(code);
	});

	it('maps decoded values to the expected CS2 console variables', () => {
		const convars = crosshairToConVars(decodeCrosshairShareCode(CROSSHAIR_CORPUS[2].code));
		expect(convars).toContain('cl_crosshair_drawoutline "1"');
		expect(convars).toContain('cl_crosshairdot "1"');
		expect(convars).toContain('cl_crosshairsize "0"');
		expect(convars).toContain('cl_crosshairthickness "1.5"');
		expect(convars).toContain('cl_crosshairstyle "4"');
	});

	it.each([
		'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA',
		'CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA',
		'CSGO-sXMJy-i8zaz-T4jvf-G8Ay7-b2D7K',
	])('round-trips representative share code %s through editor state', (code) => {
		expect(encodeCrosshair(decodeCrosshairShareCode(code))).toBe(code);
	});

	it.each(CROSSHAIR_CORPUS)('emits every supported convar for $name', ({ code }) => {
		const convars = crosshairToConVars(decodeCrosshairShareCode(code));
		for (const name of [
			'cl_crosshair_drawoutline', 'cl_crosshair_dynamic_maxdist_splitratio', 'cl_crosshair_dynamic_splitalpha_innermod',
			'cl_crosshair_dynamic_splitalpha_outermod', 'cl_crosshair_dynamic_splitdist', 'cl_crosshair_outlinethickness',
			'cl_crosshair_t', 'cl_crosshairalpha', 'cl_crosshaircolor', 'cl_crosshaircolor_b', 'cl_crosshaircolor_g',
			'cl_crosshaircolor_r', 'cl_crosshairdot', 'cl_crosshairgap', 'cl_crosshairgap_useweaponvalue', 'cl_crosshairsize',
			'cl_crosshairstyle', 'cl_crosshairthickness', 'cl_crosshairusealpha', 'cl_fixedcrosshairgap',
		]) {
			expect(convars).toContain(`${name} "`);
		}
	});

	it('distinguishes malformed codes from checksum failures', () => {
		expect(() => decodeCrosshairShareCode('not-a-share-code')).toThrow(InvalidShareCode);
		expect(() => decodeCrosshairShareCode('CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPB')).toThrow(InvalidCrosshairShareCode);
	});

	it('clamps out-of-range values instead of wrapping bytes when encoding', () => {
		const decoded = decodeCrosshairShareCode('CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA');
		const clamped = decodeCrosshairShareCode(encodeCrosshair({ ...decoded, gap: 20, length: 30, thickness: -4, alpha: 900 }));
		expect(clamped.gap).toBe(10);
		expect(clamped.length).toBe(10);
		expect(clamped.thickness).toBe(0.5);
		expect(clamped.alpha).toBe(255);
	});

	it('maps the built-in palette to canonical RGB colors', () => {
		expect(getCrosshairPreviewColor({ color: 0, red: 0, green: 0, blue: 0 })).toEqual({ r: 255, g: 0, b: 0 });
		expect(getCrosshairPreviewColor({ color: 1, red: 0, green: 0, blue: 0 })).toEqual({ r: 0, g: 255, b: 0 });
		expect(getCrosshairPreviewColor({ color: 2, red: 0, green: 0, blue: 0 })).toEqual({ r: 255, g: 255, b: 0 });
		expect(getCrosshairPreviewColor({ color: 3, red: 0, green: 0, blue: 0 })).toEqual({ r: 0, g: 0, b: 255 });
		expect(getCrosshairPreviewColor({ color: 4, red: 0, green: 0, blue: 0 })).toEqual({ r: 0, g: 255, b: 255 });
		expect(getCrosshairPreviewColor({ color: 5, red: 12, green: 34, blue: 56 })).toEqual({ r: 12, g: 34, b: 56 });
	});
});
