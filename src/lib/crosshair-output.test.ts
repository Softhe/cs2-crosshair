import { describe, expect, it } from 'vitest';
import { generateConfig, generateConsoleCommand, parseShareCode, validateShareCode } from '@/lib/crosshair-output';

const VALID_CODE = 'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA';
const DOT_CODE = 'CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA';

describe('crosshair output', () => {
	it('validates empty, malformed, and valid share codes', () => {
		expect(validateShareCode('')).toEqual({ valid: false, error: 'Please enter a share code' });
		expect(validateShareCode('wAD3c')).toMatchObject({ valid: false });
		expect(validateShareCode('CSGO-aaaaa-bbbbb')).toMatchObject({ valid: false });
		expect(validateShareCode(VALID_CODE)).toEqual({ valid: true });
	});

	it('parses once and returns clamped editor state', () => {
		const parsed = parseShareCode(`  ${VALID_CODE}  `);
		expect(parsed.valid).toBe(true);
		if (parsed.valid) {
			expect(parsed.crosshair).toEqual(expect.objectContaining({ color: 4, length: 1, gap: -4 }));
		}
		expect(parseShareCode('')).toEqual({ valid: false, error: 'Please enter a share code' });
		expect(parseShareCode('CSGO-aaaaa-bbbbb').valid).toBe(false);
	});

	it('accepts a lowercase share-code prefix without changing the body', () => {
		const lower = parseShareCode(VALID_CODE.replace('CSGO-', 'csgo-'));
		const upper = parseShareCode(VALID_CODE);
		expect(lower).toEqual(upper);
		expect(parseShareCode('csgo-aaaaa-bbbbb').valid).toBe(false);
	});

	it('generates a single-line console command', () => {
		const command = generateConsoleCommand(VALID_CODE);
		expect(command).toContain('cl_crosshairstyle');
		expect(command).toMatch(/; host_writeconfig$/);
		expect(command).not.toContain('\n');
	});

	it('generates a config with a sanitized alias handoff', () => {
		const config = generateConfig(VALID_CODE, 'crosshair_og_small.cfg', 'og small');
		expect(config).toContain('alias "og_small" "exec crosshair_og_small.cfg"');
		expect(config).toContain('host_writeconfig');
	});

	it('preserves every requested Dot setting in the downloaded config', () => {
		const config = generateConfig(DOT_CODE, 'crosshair_dot.cfg', 'dot');
		expect(config).toContain('cl_crosshairdot "1"');
		expect(config).toContain('cl_crosshairgap "-5"');
		expect(config).toContain('cl_crosshairsize "0"');
		expect(config).toContain('cl_crosshairthickness "1"');
		expect(config).toContain('cl_crosshair_drawoutline "1"');
		expect(config).toContain('cl_crosshair_outlinethickness "1"');
		expect(config).toContain('cl_crosshairusealpha "1"');
		expect(config).toContain('cl_crosshairalpha "255"');
		expect(config).toContain('alias "dot" "exec crosshair_dot.cfg"');
	});
});
