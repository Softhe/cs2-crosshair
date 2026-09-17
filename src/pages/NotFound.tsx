import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Crosshair } from 'lucide-react';

interface NotFoundProps {
  invalidShareCode?: boolean;
}

const NotFound = ({ invalidShareCode = false }: NotFoundProps) => {
  const location = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-card/80 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
        <Crosshair className="mx-auto mb-5 h-10 w-10 text-primary" aria-hidden="true" />
        <p className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-primary">{invalidShareCode ? 'Invalid code' : '404'}</p>
        <h1 className="mb-3 text-3xl font-semibold text-foreground">{invalidShareCode ? 'Invalid crosshair link' : 'Page not found'}</h1>
        {invalidShareCode ? (
          <p className="mb-7 text-muted-foreground">
            The share code in this link is incomplete or corrupted, so it cannot be decoded. Ask for a fresh link or start from scratch in the studio.
          </p>
        ) : (
          <p className="mb-7 text-muted-foreground">
            There is no studio page at <code className="break-all text-foreground">{location.pathname}</code>.
          </p>
        )}
        <Link className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to the studio
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
