import {
	clampCrosshair,
	crosshairToConVars,
	decodeCrosshairShareCode,
	type Crosshair,
} from '@/lib/cs2-sharecode';
import { createAliasCommand } from '@/lib/crosshair-config';

export interface ShareCodeValidationResult {
	valid: boolean;
	error?: string;
}

export type ShareCodeParseResult = { valid: true; crosshair: Crosshair } | { valid: false; error: string };

export const parseShareCode = (code: string): ShareCodeParseResult => {
	const trimmedCode = code.trim();

	if (!trimmedCode) {
		return { valid: false, error: 'Please enter a share code' };
	}

	// The share-code body is case-sensitive, but users often paste a
	// lowercase "csgo-" prefix from mobile keyboards; normalize that only.
	if (!/^csgo-/i.test(trimmedCode)) {
		return { valid: false, error: 'Share code must start with "CSGO-"' };
	}
	const normalizedCode = `CSGO-${trimmedCode.slice(5)}`;

	if (normalizedCode.split('-').length !== 6) {
		return { valid: false, error: 'Invalid format. Expected: CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX' };
	}

	try {
		return { valid: true, crosshair: clampCrosshair(decodeCrosshairShareCode(normalizedCode)) };
	} catch {
		return { valid: false, error: 'Unable to decode share code. Please verify it\'s correct.' };
	}
};

export const validateShareCode = (code: string): ShareCodeValidationResult => {
	const result = parseShareCode(code);
	return result.valid ? { valid: true } : result;
};

export const getCrosshairConVars = (shareCode: string): string => {
	const result = parseShareCode(shareCode);

	if (!result.valid) {
		throw new Error(result.error);
	}

	return crosshairToConVars(result.crosshair);
};

export const generateConfig = (shareCode: string, fileName: string, aliasName?: string): string => {
	const trimmedShareCode = shareCode.trim();
	const convars = getCrosshairConVars(trimmedShareCode);
	const aliasCommand = createAliasCommand(aliasName, fileName);

	return `// CS2 Crosshair Config - Generated from ${trimmedShareCode}
// Place this file in your CS2 config folder
// Add this to your autoexec.cfg: ${aliasCommand}

// Crosshair settings
${convars}
host_writeconfig

echo "Crosshair config loaded successfully!"`;
};

export const generateConsoleCommand = (shareCode: string): string => {
	const convars = getCrosshairConVars(shareCode);
	const commands = convars
		.split('\n')
		.map((line) => line.trim().replace(/"/g, ''))
		.filter(Boolean);

	return [...commands, 'host_writeconfig'].join('; ');
};
