import type { ObservabilitySnapshot, StudioEventName } from '@/lib/observability';

export type FeedbackRating = 'easy' | 'difficult';

export interface FeedbackPayload {
	rating: FeedbackRating;
	notes?: string;
	appVersion: string;
	viewport: ObservabilitySnapshot['viewport'];
	events: Partial<Record<StudioEventName, number>>;
	performance?: { lcp?: number; cls?: number };
}

const REPOSITORY_ISSUES_URL = 'https://github.com/Softhe/cs2-crosshair/issues/new';
const MAX_NOTES_LENGTH = 1200;
const ALLOWED_EVENTS: StudioEventName[] = [
	'studio_loaded',
	'preset_selected',
	'import_succeeded',
	'import_failed',
	'copy_command',
	'copy_code',
	'share_link',
	'download_cfg',
	'palette_changed',
	'history_loaded',
	'guide_dismissed',
	'feedback_easy',
	'feedback_difficult',
	'app_error',
];

export const sanitizeFeedbackNotes = (notes: string): string => notes
	.split('')
	.filter((character) => {
		const code = character.charCodeAt(0);
		return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
	})
	.join('')
	.trim()
	.slice(0, MAX_NOTES_LENGTH);

export const createFeedbackPayload = (
	rating: FeedbackRating,
	notes: string,
	snapshot: ObservabilitySnapshot,
	appVersion: string,
): FeedbackPayload => {
	const events: FeedbackPayload['events'] = {};
	for (const name of ALLOWED_EVENTS) {
		const count = snapshot.events[name];
		if (typeof count === 'number' && Number.isFinite(count) && count > 0) events[name] = Math.floor(count);
	}

	const sanitizedNotes = sanitizeFeedbackNotes(notes);
	return {
		rating,
		...(sanitizedNotes ? { notes: sanitizedNotes } : {}),
		appVersion,
		viewport: snapshot.viewport,
		events,
		...(snapshot.performance.lcp !== undefined || snapshot.performance.cls !== undefined
			? { performance: { ...snapshot.performance } }
			: {}),
	};
};

export const formatFeedbackIssueBody = (payload: FeedbackPayload): string => {
	const eventLines = Object.entries(payload.events)
		.map(([name, count]) => `- ${name}: ${count}`)
		.join('\n') || '- No recorded studio actions';
	const performanceLines = [
		payload.performance?.lcp !== undefined ? `- LCP: ${payload.performance.lcp} ms` : '- LCP: unavailable',
		payload.performance?.cls !== undefined ? `- CLS: ${payload.performance.cls}` : '- CLS: unavailable',
	].join('\n');

	return [
		'## Experience',
		`Rating: **${payload.rating === 'easy' ? 'Easy' : 'Difficult'}**`,
		'',
		'## Notes',
		payload.notes || '_No additional notes provided._',
		'',
		'## Coarse diagnostics (reviewed before sharing)',
		`- App version: ${payload.appVersion}`,
		`- Viewport: ${payload.viewport}`,
		performanceLines,
		'',
		'### Session event counts',
		eventLines,
		'',
		'> This report intentionally excludes crosshair codes, settings, aliases, URLs, and saved history.',
	].join('\n');
};

export const buildFeedbackIssueUrl = (payload: FeedbackPayload): string => {
	const parameters = new URLSearchParams({
		title: `[Studio feedback] ${payload.rating === 'easy' ? 'Easy experience' : 'Difficult experience'}`,
		body: formatFeedbackIssueBody(payload),
		labels: 'feedback',
	});
	return `${REPOSITORY_ISSUES_URL}?${parameters.toString()}`;
};
