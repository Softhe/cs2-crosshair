import { ClipboardCopy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrosshairShape } from '@/components/CrosshairShape';
import type { Crosshair } from '@/lib/cs2-sharecode';

interface MobileQuickActionsProps {
	crosshair: Crosshair;
	onCopy: () => void;
	onDownload: () => void;
}

const openFullPreview = () => {
	const disclosure = document.querySelector<HTMLDetailsElement>('[data-testid="mobile-preview-disclosure"]');
	if (!disclosure) return;
	disclosure.open = true;
	disclosure.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export const MobileQuickActions = ({ crosshair, onCopy, onDownload }: MobileQuickActionsProps) => (
	<div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl" data-testid="mobile-quick-actions">
		<div className="mx-auto flex max-w-md items-center gap-2">
			{/* Live mini preview: the full preview sits below the sliders on phones,
			    so this keeps the crosshair visible while tuning. */}
			<button
				type="button"
				onClick={openFullPreview}
				aria-label="Open live preview"
				data-testid="mobile-mini-preview"
				className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border border-white/15 bg-[linear-gradient(135deg,#bca27d,#74614c_65%,#39322b)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<CrosshairShape crosshair={crosshair} zoom={2} />
			</button>
			<div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
				<Button onClick={onCopy} aria-label="Quick copy command" className="bg-primary px-2 text-primary-foreground hover:bg-primary/90"><ClipboardCopy className="h-4 w-4" />Copy<span className="hidden min-[360px]:inline">command</span></Button>
				<Button onClick={onDownload} aria-label="Quick download CFG" variant="outline" className="border-accent/40 bg-accent/10 px-2 text-foreground"><Download className="h-4 w-4" />CFG</Button>
			</div>
		</div>
	</div>
);
