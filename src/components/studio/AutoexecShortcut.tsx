import { ClipboardCopy, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AutoexecShortcutProps {
	aliasName: string;
	onAliasNameChange: (value: string) => void;
	fileName: string;
	aliasCommand: string;
	onCopyAlias: () => void;
}

export const AutoexecShortcut = ({ aliasName, onAliasNameChange, fileName, aliasCommand, onCopyAlias }: AutoexecShortcutProps) => {
	const hasAlias = Boolean(aliasName.trim());
	return (
		<div className="rounded-lg border border-white/10 bg-background/35">
			<div className="space-y-3 p-4">
				<span className="flex items-center gap-2"><TerminalSquare className="h-4 w-4 text-primary" /><span className="text-sm font-semibold text-foreground">CFG & autoexec shortcut</span></span>
				<label htmlFor="aliasName" className="text-sm font-medium text-foreground">Alias name <span aria-hidden="true" className="font-normal text-muted-foreground">(optional)</span></label>
				<Input id="aliasName" value={aliasName} onChange={(event) => onAliasNameChange(event.target.value)} placeholder="team green" className="border-white/10 bg-background/70 font-mono" />
			</div>
			<details className="border-t border-white/10">
				<summary className="cursor-pointer list-none px-4 py-3 text-xs text-muted-foreground">
					<span>Instructions</span>
				</summary>
				<div className="space-y-3 border-t border-white/10 p-4">
					<p className="text-xs text-muted-foreground">Download the CFG, then copy its alias into autoexec.cfg.</p>
					<div className="space-y-1 text-xs text-muted-foreground"><p>File: <code className="text-foreground">{fileName}</code></p>{hasAlias && <p>Autoexec alias: <code className="break-all text-foreground">{aliasCommand}</code></p>}</div>
					{hasAlias && <Button onClick={onCopyAlias} variant="ghost" size="sm" className="w-full"><ClipboardCopy className="h-4 w-4" />Copy autoexec alias</Button>}
				</div>
			</details>
		</div>
	);
};
