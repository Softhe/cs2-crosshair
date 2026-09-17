import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { parseShareCode } from '@/lib/crosshair-output';
import { decodeUrlShareCode } from '@/lib/share-url';
import Index from '@/pages/Index';

const NotFound = lazy(() => import("./pages/NotFound"));

const PageFallback = () => (
  <main className="flex min-h-screen items-center justify-center px-4" aria-busy="true">
    <p className="text-sm text-muted-foreground">Loading page…</p>
  </main>
);

export const LegacyShareCodeRoute = () => {
  const { shareCode = '' } = useParams();
  const decodedShareCode = decodeUrlShareCode(shareCode);

  if (parseShareCode(decodedShareCode).valid) return <Index />;
  return decodedShareCode.startsWith('CSGO-') ? <NotFound invalidShareCode /> : <NotFound />;
};

export const CustomCompatibilityRedirect = () => {
  const { hash, search } = useLocation();
  return <Navigate to={{ pathname: '/', search, hash }} replace />;
};

export const AppRoutes = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/custom" element={<CustomCompatibilityRedirect />} />
      <Route path="/:shareCode" element={<LegacyShareCodeRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
