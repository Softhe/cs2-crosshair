import { Crosshair } from 'lucide-react';
import type { useLibrarySync } from '../library-sync';
import { SteamAccount } from '../SteamAccount';

export type View = 'editor' | 'library';

export function Header({ view, setView, favorites, onGuide, sync }: {
  view: View;
  setView: (view: View) => void;
  favorites: number;
  onGuide: (trigger: HTMLElement) => void;
  sync: ReturnType<typeof useLibrarySync>;
}) {
  return (
    <header className="header">
      <a className="brand" href="/" aria-label="delli.cc home">
        <Crosshair size={27} />
        <strong>
          delli<span>.cc</span>
        </strong>
        <span className="brand-divider" />
        <span className="brand-subtitle">CROSSHAIR STUDIO</span>
      </a>
      <nav className="menu-nav" aria-label="Studio menu">
        <button
          className={view === 'editor' ? 'active' : ''}
          aria-current={view === 'editor' ? 'page' : undefined}
          onClick={() => {
            setView('editor');
            window.scrollTo({
              top: 0,
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            });
          }}
        >
          Crosshair / Scopes
        </button>
        <button
          aria-label="Library"
          className={view === 'library' ? 'active' : ''}
          aria-current={view === 'library' ? 'page' : undefined}
          onClick={() => setView('library')}
        >
          Library
          <span className="count">{favorites}</span>
        </button>
        <button onClick={(event) => onGuide(event.currentTarget)}>Guide</button>
      </nav>
      <div className="header-actions">
        <SteamAccount
          user={sync.user}
          sessionState={sync.sessionState}
          status={sync.status}
          syncing={sync.syncing}
          signIn={`${sync.signIn}?returnTo=${encodeURIComponent(view === 'library' ? '/?view=library' : '/')}`}
          view={view}
          onOpenLibrary={() => setView('library')}
          onRetry={sync.retry}
          onSignOut={sync.signOut}
        />
      </div>
    </header>
  );
}
