import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudioFeedback } from '@/components/StudioFeedback';

describe('StudioFeedback', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	it('keeps the rating local until the user reviews a GitHub issue', async () => {
		const user = userEvent.setup();
		render(<StudioFeedback />);
		await user.click(screen.getByRole('button', { name: 'Easy' }));
		expect(localStorage.getItem('cs2_studio_feedback')).toBe('easy');
		expect(screen.queryByRole('link', { name: 'Open GitHub issue' })).not.toBeInTheDocument();

		await user.type(await screen.findByLabelText('Optional note'), 'Clear and quick');
		await user.click(screen.getByRole('button', { name: 'Review GitHub issue' }));
		const preview = await screen.findByTestId('feedback-issue-preview');
		expect(preview).toHaveTextContent('Clear and quick');
		expect(preview).toHaveTextContent('excludes crosshair codes');
		const issueLink = screen.getByRole('link', { name: 'Open GitHub issue' });
		expect(issueLink).toHaveAttribute('target', '_blank');
		expect(issueLink.getAttribute('href')).toMatch(/^https:\/\/github\.com\/Softhe\/cs2-crosshair\/issues\/new\?/);
	});
});
