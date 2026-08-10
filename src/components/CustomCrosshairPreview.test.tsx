import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomCrosshairPreview } from '@/components/CustomCrosshairPreview';
import { decodeCrosshairShareCode, encodeCrosshair } from '@/lib/cs2-sharecode';

const CROSSHAIR = decodeCrosshairShareCode('CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO');

describe('CustomCrosshairPreview preferences', () => {
	beforeEach(() => {
		localStorage.removeItem('cs2_preview_resolution');
		localStorage.removeItem('cs2_preview_zoom');
	});

	it('defaults to automatic exact scale and persists manual controls', async () => {
		const user = userEvent.setup();
		render(<CustomCrosshairPreview crosshair={CROSSHAIR} />);

		const resolution = screen.getByRole('combobox', { name: 'Preview resolution' });
		expect(resolution).toHaveValue('auto');
		expect(screen.getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'true');

		await user.selectOptions(resolution, '2560x1440');
		await user.click(screen.getByRole('button', { name: '4× inspect' }));
		expect(localStorage.getItem('cs2_preview_resolution')).toBe('2560x1440');
		expect(localStorage.getItem('cs2_preview_zoom')).toBe('4x');
		expect(screen.getByText(/2560×1440 · 4× inspection/)).toBeInTheDocument();
	});

	it('falls back from invalid stored values', () => {
		localStorage.setItem('cs2_preview_resolution', 'invalid');
		localStorage.setItem('cs2_preview_zoom', '8x');
		render(<CustomCrosshairPreview crosshair={CROSSHAIR} />);
		expect(screen.getByRole('combobox', { name: 'Preview resolution' })).toHaveValue('auto');
		expect(screen.getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('never changes the crosshair data or share code', async () => {
		const user = userEvent.setup();
		const originalCode = encodeCrosshair(CROSSHAIR);
		render(<CustomCrosshairPreview crosshair={CROSSHAIR} />);
		await user.selectOptions(screen.getByRole('combobox', { name: 'Preview resolution' }), '1280x960-stretched');
		await user.click(screen.getByRole('button', { name: '4× inspect' }));
		expect(encodeCrosshair(CROSSHAIR)).toBe(originalCode);
	});
});
