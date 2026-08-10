import { describe, expect, it } from 'vitest';
import { buildFeedbackIssueUrl, createFeedbackPayload, formatFeedbackIssueBody, sanitizeFeedbackNotes } from '@/lib/feedback';
import type { ObservabilitySnapshot } from '@/lib/observability';

const snapshot: ObservabilitySnapshot = {
	events: { import_succeeded: 2, app_error: 1 },
	viewport: 'small',
	startedAt: '2026-01-01T00:00:00.000Z',
	performance: { lcp: 840, cls: 0.01 },
};

describe('feedback issue helpers', () => {
	it('sanitizes and limits notes', () => {
		expect(sanitizeFeedbackNotes(' \u0000 useful note \n')).toBe('useful note');
		expect(sanitizeFeedbackNotes('x'.repeat(1300))).toHaveLength(1200);
	});

	it('copies only allow-listed coarse diagnostics', () => {
		const unsafeSnapshot = { ...snapshot, events: { ...snapshot.events, shareCode: 99 } } as unknown as ObservabilitySnapshot;
		const payload = createFeedbackPayload('difficult', 'Needs work', unsafeSnapshot, '2.0.0');
		expect(payload.events).toEqual({ import_succeeded: 2, app_error: 1 });
		expect(payload).not.toHaveProperty('startedAt');
		expect(payload.notes).toBe('Needs work');
	});

	it('formats missing diagnostics without exposing private state', () => {
		const payload = createFeedbackPayload('easy', '', { ...snapshot, events: {}, performance: {} }, '2.0.0');
		const body = formatFeedbackIssueBody(payload);
		expect(body).toContain('LCP: unavailable');
		expect(body).toContain('No recorded studio actions');
		expect(body).not.toContain('CSGO-');
	});

	it('encodes the title and reviewed body in a GitHub issue URL', () => {
		const payload = createFeedbackPayload('easy', 'Fast & clear', snapshot, '2.0.0');
		const url = new URL(buildFeedbackIssueUrl(payload));
		expect(url.origin + url.pathname).toBe('https://github.com/Softhe/cs2-crosshair/issues/new');
		expect(url.searchParams.get('title')).toContain('Easy experience');
		expect(url.searchParams.get('body')).toContain('Fast & clear');
		expect(url.searchParams.get('labels')).toBe('feedback');
	});
});
