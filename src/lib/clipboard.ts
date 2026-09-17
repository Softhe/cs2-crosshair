// Clipboard utility with fallback support for older browsers

/**
 * Copy text to clipboard with automatic fallback for browsers
 * that don't support the modern Clipboard API
 */
export const copyToClipboard = async (text: string): Promise<void> => {
	// Try modern Clipboard API first
	if (navigator.clipboard && navigator.clipboard.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// Permission denial is routine (HTTP, iframes, revoked
			// permission); fall through to execCommand silently.
		}
	}

	// Fallback method using execCommand (works in more browsers)
	return copyToClipboardFallback(text);
};

/**
 * Fallback clipboard copy method using deprecated execCommand
 * Works in older browsers and situations where Clipboard API is restricted
 */
const copyToClipboardFallback = (text: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		const textArea = document.createElement('textarea');
		textArea.value = text;

		// Make the textarea invisible but functional
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		textArea.style.opacity = '0';

		document.body.appendChild(textArea);

		try {
			textArea.focus();
			textArea.select();

			// For iOS devices
			if (navigator.userAgent.match(/ipad|iphone/i)) {
				const range = document.createRange();
				range.selectNodeContents(textArea);
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
					selection.addRange(range);
				}
				textArea.setSelectionRange(0, 999999);
			}

			const successful = document.execCommand('copy');
			document.body.removeChild(textArea);

			if (successful) {
				resolve();
			} else {
				reject(new Error('execCommand copy failed'));
			}
		} catch (err) {
			document.body.removeChild(textArea);
			reject(err);
		}
	});
};

/**
 * Read text from clipboard
 * Throws a user-safe error when the API is missing or permission is denied.
 */
export const readFromClipboard = async (): Promise<string> => {
	if (!navigator.clipboard || !navigator.clipboard.readText) {
		throw new Error('Clipboard reading is not available in this browser.');
	}

	try {
		return await navigator.clipboard.readText();
	} catch (error) {
		throw new Error('Failed to read from clipboard. Permission may be required.', { cause: error });
	}
};
