import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrosshairShape } from '@/components/CrosshairShape';
import { CROSSHAIR_PREVIEW_FIXTURES } from '@/lib/crosshair-preview-fixtures';

describe.each(CROSSHAIR_PREVIEW_FIXTURES)('CrosshairShape fixture: $name', ({ crosshair, expected }) => {
	it('renders the expected visual parts and styles', () => {
		const { container } = render(<div style={{ width: 400, height: 300 }}><CrosshairShape crosshair={crosshair} /></div>);
		const arms = container.querySelectorAll('[data-crosshair-part="arm"]');
		const dot = container.querySelector('[data-crosshair-part="dot"]');
		expect(arms).toHaveLength(crosshair.length === 0 ? 0 : expected.arms);
		expect(Boolean(dot)).toBe(expected.dot);
		const visiblePart = dot ?? arms[0];
		if (!visiblePart) return;
		expect(Number(visiblePart.getAttribute('fill-opacity'))).toBeCloseTo(expected.opacity, 4);
		const outlines = container.querySelectorAll('[data-crosshair-part="arm-outline"], [data-crosshair-part="dot-outline"]');
		expect(outlines.length > 0).toBe(expected.outline);
		if (crosshair.color === 5) expect(visiblePart.getAttribute('fill')).toBe('rgb(126, 32, 210)');
	});
});

describe('CrosshairShape rendering accuracy', () => {
	it('keeps the outline opaque when the crosshair itself is translucent', () => {
		const [fixture] = CROSSHAIR_PREVIEW_FIXTURES.filter((item) => item.name === 'partial alpha');
		const { container } = render(
			<div style={{ width: 400, height: 300 }}>
				<CrosshairShape crosshair={{ ...fixture.crosshair, outlineEnabled: true, outline: 2 }} />
			</div>,
		);
		const fill = container.querySelector('[data-crosshair-part="arm"]');
		const outline = container.querySelector('[data-crosshair-part="arm-outline"]');
		expect(fill?.getAttribute('fill-opacity')).toBeCloseTo(128 / 255, 4);
		// The outline must not inherit the crosshair alpha the way a CSS
		// box-shadow with element opacity would.
		expect(outline?.getAttribute('fill-opacity')).toBe('0.8');
	});

	it('centers arms symmetrically around the canvas middle', () => {
		const [fixture] = CROSSHAIR_PREVIEW_FIXTURES.filter((item) => item.name === 'compact negative gap');
		const { container } = render(
			<div style={{ width: 400, height: 300 }}>
				<CrosshairShape crosshair={{ ...fixture.crosshair, thickness: 3 }} />
			</div>,
		);
		const arms = [...container.querySelectorAll('[data-crosshair-part="arm"]')];
		const vertical = arms.filter((arm) => Number(arm.getAttribute('height')) > Number(arm.getAttribute('width')));
		const horizontal = arms.filter((arm) => Number(arm.getAttribute('width')) > Number(arm.getAttribute('height')));
		expect(vertical).toHaveLength(2);
		expect(horizontal).toHaveLength(2);
		const top = vertical.reduce((a, b) => (Number(a.getAttribute('y')) < Number(b.getAttribute('y')) ? a : b));
		const bottom = vertical.reduce((a, b) => (Number(a.getAttribute('y')) > Number(b.getAttribute('y')) ? a : b));
		const left = horizontal.reduce((a, b) => (Number(a.getAttribute('x')) < Number(b.getAttribute('x')) ? a : b));
		const right = horizontal.reduce((a, b) => (Number(a.getAttribute('x')) > Number(b.getAttribute('x')) ? a : b));
		// Odd thicknesses previously drifted half a pixel because positioning
		// used Math.floor(size / 2); the centered coordinate system stays exact.
		expect(Number(top.getAttribute('y')) + Number(top.getAttribute('height'))).toBeCloseTo(-Number(bottom.getAttribute('y')), 6);
		expect(Number(left.getAttribute('x')) + Number(left.getAttribute('width'))).toBeCloseTo(-Number(right.getAttribute('x')), 6);
	});
});
