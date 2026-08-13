import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomCrosshair from '@/pages/CustomCrosshair';
import { copyToClipboard } from '@/lib/clipboard';

vi.mock('@/lib/clipboard', () => ({
	copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const VALID_CODE = 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO';
const DOT_CODE = 'CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA';

const LocationProbe = () => {
	const location = useLocation();
	return <output aria-label="current route">{location.pathname}{location.search}</output>;
};

const NavigationControls = () => {
	const navigate = useNavigate();
	return (
		<>
			<button onClick={() => navigate('/?code=invalid')}>Navigate invalid</button>
			<button onClick={() => navigate('/')}>Navigate root</button>
			<button onClick={() => navigate(`/?code=${VALID_CODE}`)}>Navigate valid</button>
		</>
	);
};

const renderStudio = (initialEntry = '/') => render(
	<MemoryRouter initialEntries={[initialEntry]}>
		<Routes>
			<Route path="*" element={<><CustomCrosshair /><LocationProbe /><NavigationControls /></>} />
		</Routes>
	</MemoryRouter>
);

describe('CS2 Crosshair Studio', () => {
	beforeEach(() => {
		vi.mocked(copyToClipboard).mockClear();
		localStorage.removeItem('cs2_studio_palette');
		delete document.documentElement.dataset.palette;
	});

	it('presents import, customization, preview, and export in one workspace', async () => {
		renderStudio();
		const controlCenter = screen.getByTestId('control-center');
		expect(screen.getByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeInTheDocument();
		expect(within(controlCenter).getByLabelText('CS2 crosshair share code')).toBeInTheDocument();
		expect(within(controlCenter).getByRole('slider', { name: 'Length' })).toBeInTheDocument();
		const sliderStack = within(controlCenter).getByTestId('slider-stack');
		expect(within(sliderStack).getAllByRole('slider')).toEqual([
			screen.getByRole('slider', { name: 'Length' }),
			screen.getByRole('slider', { name: /^Thickness$/ }),
			screen.getByRole('slider', { name: 'Gap' }),
			screen.getByRole('slider', { name: 'Outline thickness' }),
			screen.getByRole('slider', { name: 'Alpha' })
		]);
		expect(within(controlCenter).getByRole('img', { name: 'Custom crosshair preview' })).toBeInTheDocument();
		expect(within(controlCenter).getByTestId('preview-workspace')).toBeInTheDocument();
		expect(within(controlCenter).getByRole('button', { name: 'Copy command' })).toBeInTheDocument();
		expect(within(controlCenter).getByRole('button', { name: 'Download CFG' })).toBeInTheDocument();
		expect(within(controlCenter).getByLabelText(/Alias name/)).toBeInTheDocument();
		expect(await screen.findByRole('heading', { name: 'Local crosshair library' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Recent (0)' })).toBeInTheDocument();
		expect(screen.getByText('Load a share code or export your current crosshair to save it here.')).toBeInTheDocument();
		const mobileOrder = [
			within(controlCenter).getByTestId('import-controls'),
			within(controlCenter).getByTestId('customize-controls'),
			within(controlCenter).getByTestId('preview-workspace'),
			within(controlCenter).getByTestId('export-controls'),
			screen.getByTestId('local-crosshair-library')
		];
		for (let index = 1; index < mobileOrder.length; index += 1) {
			expect(mobileOrder[index - 1].compareDocumentPosition(mobileOrder[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		}
		expect(screen.queryByText('Create Custom')).not.toBeInTheDocument();
		expect(screen.queryByText('Open in converter')).not.toBeInTheDocument();
	});

	it('opens the visual color picker and keeps output in the same workspace', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Custom' }));
		expect(screen.getByText('Choose custom color')).toBeInTheDocument();
		expect(screen.getByText('#00ffff')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
	});

	it('switches between CS2 and calm Crimson palettes and persists the selection', async () => {
		const user = userEvent.setup();
		renderStudio();
		expect(screen.getByRole('button', { name: 'Tactical' })).toHaveAttribute('aria-pressed', 'true');

		await user.click(screen.getByRole('button', { name: 'CS2' }));
		expect(document.documentElement).toHaveAttribute('data-palette', 'cs2');
		expect(localStorage.getItem('cs2_studio_palette')).toBe('cs2');
		expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute('aria-pressed', 'true');

		await user.click(screen.getByRole('button', { name: 'Crimson' }));
		expect(document.documentElement).toHaveAttribute('data-palette', 'crimson');
		expect(localStorage.getItem('cs2_studio_palette')).toBe('crimson');
		expect(screen.getByRole('button', { name: 'Crimson' })).toHaveAttribute('aria-pressed', 'true');
	});

	it.each(['ultraviolet', 'ember', 'cobalt'])('falls back to Tactical when obsolete palette %s was stored', (obsoletePalette) => {
		localStorage.setItem('cs2_studio_palette', obsoletePalette);
		renderStudio();
		expect(document.documentElement).toHaveAttribute('data-palette', 'tactical');
		expect(localStorage.getItem('cs2_studio_palette')).toBe('tactical');
		expect(screen.getByRole('button', { name: 'Tactical' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('keeps all match-critical controls visible and disables only inapplicable values', async () => {
		const user = userEvent.setup();
		renderStudio();
		expect(screen.getByRole('checkbox', { name: 'Center dot' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Outline' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Use alpha' })).toBeInTheDocument();
		expect(screen.getByRole('slider', { name: 'Gap' })).toBeInTheDocument();
		expect(screen.getByRole('slider', { name: 'Thickness' })).toBeInTheDocument();
		expect(screen.getByRole('slider', { name: 'Outline thickness' })).toHaveAttribute('aria-disabled', 'true');
		expect(screen.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-valuenow', '255');
		await user.click(screen.getByRole('checkbox', { name: 'Outline' }));
		expect(screen.getByRole('slider', { name: 'Outline thickness' })).not.toHaveAttribute('aria-disabled', 'true');
		await user.click(screen.getByRole('checkbox', { name: 'Use alpha' }));
		expect(screen.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-disabled', 'true');
	});

	it('uses the requested share code and settings for the Dot preset', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Dot' }));

		expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(DOT_CODE);
		expect(screen.getByRole('slider', { name: 'Length' })).toHaveAttribute('aria-valuenow', '0');
		expect(screen.getByRole('slider', { name: 'Thickness' })).toHaveAttribute('aria-valuenow', '1');
		expect(screen.getByRole('slider', { name: 'Gap' })).toHaveAttribute('aria-valuenow', '-5');
		expect(screen.getByRole('slider', { name: 'Outline thickness' })).toHaveAttribute('aria-valuenow', '1');
		expect(screen.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-valuenow', '255');
		expect(screen.getByRole('checkbox', { name: 'Center dot' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Outline' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Use alpha' })).toBeChecked();
	});

	it('announces an invalid import without replacing the active output', async () => {
		const user = userEvent.setup();
		renderStudio();
		const input = screen.getByLabelText('CS2 crosshair share code');
		const originalCode = input.getAttribute('value');
		await user.clear(input);
		await user.type(input, 'invalid');
		await user.click(screen.getByRole('button', { name: 'Load crosshair' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Share code must start with');
		expect(screen.getByText(originalCode || '')).toBeInTheDocument();
	});

	it('shows the actual invalid URL value and recovers on later navigation', async () => {
		const user = userEvent.setup();
		renderStudio('/?code=invalid');
		expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue('invalid');
		expect(screen.getByRole('alert')).toHaveTextContent('Share code must start with');

		await user.click(screen.getByRole('button', { name: 'Navigate root' }));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect((screen.getByLabelText('CS2 crosshair share code') as HTMLInputElement).value).toMatch(/^CSGO-/);

		await user.click(screen.getByRole('button', { name: 'Navigate valid' }));
		await waitFor(() => expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE));
	});

	it('imports a code, updates the URL, and persists it across remounts', async () => {
		const user = userEvent.setup();
		const firstRender = renderStudio();
		const input = screen.getByLabelText('CS2 crosshair share code');
		await user.clear(input);
		await user.type(input, VALID_CODE);
		await user.click(screen.getByRole('button', { name: 'Load crosshair' }));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(input).toHaveValue(VALID_CODE);
		await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent(`/?code=${VALID_CODE}`));
		expect(await screen.findByRole('tab', { name: 'Recent (1)' })).toBeInTheDocument();
		const importedItem = screen.getByTestId('history-item');
		expect(importedItem).toHaveAttribute('data-activity', 'imported');
		expect(within(importedItem).getByText('Loaded')).toBeInTheDocument();
		expect(within(importedItem).getByRole('img', { name: 'Crosshair preview for saved crosshair' })).toBeInTheDocument();
		expect(within(importedItem).queryByText(VALID_CODE)).not.toBeInTheDocument();

		firstRender.unmount();
		renderStudio();
		expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE);
		expect(screen.getByRole('tab', { name: 'Recent (1)' })).toBeInTheDocument();
	});

	it('records external share-code URLs as locally loaded history', async () => {
		renderStudio(`/?code=${VALID_CODE}`);
		expect(await screen.findByRole('tab', { name: 'Recent (1)' })).toBeInTheDocument();
		const item = screen.getByTestId('history-item');
		expect(item).toHaveAttribute('data-activity', 'imported');
		expect(within(item).getByText('Loaded')).toBeInTheDocument();
		expect(within(item).getByRole('img', { name: 'Crosshair preview for saved crosshair' })).toBeInTheDocument();
		expect(within(item).queryByText(VALID_CODE)).not.toBeInTheDocument();
	});

	it('gives a URL code precedence and does not restore it after an edit', async () => {
		const user = userEvent.setup();
		localStorage.setItem('cs2_custom_crosshair_draft', 'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA');
		renderStudio(`/?code=${VALID_CODE}`);
		expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE);

		await user.click(screen.getByRole('button', { name: 'Dot' }));
		const editedCode = (screen.getByLabelText('CS2 crosshair share code') as HTMLInputElement).value;
		expect(editedCode).not.toBe(VALID_CODE);
		await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent(`/?code=${editedCode}`));
		expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(editedCode);
	});

	it('loads a preset into the editor, output, draft storage, and URL', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Dot' }));
		const generatedCode = (screen.getByLabelText('CS2 crosshair share code') as HTMLInputElement).value;
		expect(generatedCode).toMatch(/^CSGO-/);
		expect(localStorage.getItem('cs2_custom_crosshair_draft')).toBe(generatedCode);
		expect(screen.getByLabelText('current route')).toHaveTextContent(`/?code=${generatedCode}`);
	});

	it('does not leave URL synchronization pending after a no-op preset action', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Small static' }));
		await user.click(screen.getByRole('button', { name: 'Small static' }));
		await user.click(screen.getByRole('button', { name: 'Navigate valid' }));
		await waitFor(() => expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE));
	});

	it('reset restores the default route and clears the saved draft', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Dot' }));
		expect(localStorage.getItem('cs2_custom_crosshair_draft')).toMatch(/^CSGO-/);
		await user.click(screen.getByRole('button', { name: 'Reset' }));
		expect(screen.getByLabelText('current route')).toHaveTextContent(/^\/$/);
		await waitFor(() => expect(localStorage.getItem('cs2_custom_crosshair_draft')).toBeNull());
	});

	it('does not suppress a later default draft after a no-op reset', async () => {
		const user = userEvent.setup();
		renderStudio();
		const defaultCode = (screen.getByLabelText('CS2 crosshair share code') as HTMLInputElement).value;

		await user.click(screen.getByRole('button', { name: 'Reset' }));
		await user.click(screen.getByRole('button', { name: 'Dot' }));
		await user.click(screen.getByRole('button', { name: 'Small static' }));

		await waitFor(() => expect(localStorage.getItem('cs2_custom_crosshair_draft')).toBe(defaultCode));
	});

	it('copies command, code, and share link from the active studio', async () => {
		const user = userEvent.setup();
		renderStudio();
		const code = (screen.getByLabelText('CS2 crosshair share code') as HTMLInputElement).value;

		await user.click(screen.getByRole('button', { name: 'Copy code' }));
		expect(copyToClipboard).toHaveBeenLastCalledWith(code);
		expect(await screen.findByRole('tab', { name: 'Recent (1)' })).toBeInTheDocument();
		expect(screen.getByTestId('history-item')).toHaveAttribute('data-activity', 'exported');
		expect(within(screen.getByTestId('history-item')).getByText('Exported')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Share link' }));
		expect(copyToClipboard).toHaveBeenLastCalledWith(`${window.location.origin}/?code=${code}`);

		await user.click(screen.getByRole('button', { name: 'Copy command' }));
		expect(copyToClipboard).toHaveBeenLastCalledWith(expect.stringContaining('host_writeconfig'));
		expect(screen.getByRole('tab', { name: 'Recent (1)' })).toBeInTheDocument();
	});

	it('adds generated crosshairs to history and favorites without duplicate load targets', async () => {
		const user = userEvent.setup();
		renderStudio();
		await user.click(screen.getByRole('button', { name: 'Copy command' }));

		const favoriteButton = await screen.findByRole('button', { name: 'Add crosshair to favorites' });
		await user.click(favoriteButton);
		expect(await screen.findByRole('tab', { name: 'Favorites (1)' })).toBeInTheDocument();
		const recentPanel = screen.getByRole('tabpanel', { name: 'Recent (1)' });
		expect(within(recentPanel).getAllByRole('button', { name: 'Load crosshair' })).toHaveLength(1);
	});

	it('downloads the exact filename shown in the alias preview', async () => {
		const user = userEvent.setup();
		let downloadedFileName = '';
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			downloadedFileName = this.download;
		});
		const createObjectURL = vi.fn(() => 'blob:crosshair-config');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

		renderStudio();
		await user.type(screen.getByLabelText(/Alias name/), 'team green');
		expect(screen.getByText('crosshair_team_green.cfg')).toBeInTheDocument();
		expect(screen.getByText('alias "team_green" "exec crosshair_team_green.cfg"')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Download CFG' }));

		expect(downloadedFileName).toBe('crosshair_team_green.cfg');
		expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:crosshair-config');
		clickSpy.mockRestore();
	});
});
