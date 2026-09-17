import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '@/App';

const VALID_CODE = 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO';

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="current route">{location.pathname}{location.search}{location.hash}</output>;
};

const renderRoute = (initialEntry: string) => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <AppRoutes />
    <LocationProbe />
  </MemoryRouter>,
);

describe('application routes', () => {
  it('renders the unified studio at the root', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeInTheDocument();
  });

  it('preserves query and hash state when redirecting the compatibility route', async () => {
    renderRoute(`/custom?code=${VALID_CODE}#help`);
    await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent(`/?code=${VALID_CODE}#help`));
    expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE);
  });

  it('loads valid legacy share-code paths', async () => {
    renderRoute(`/${VALID_CODE}`);
    expect(await screen.findByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeInTheDocument();
    expect(screen.getByLabelText('CS2 crosshair share code')).toHaveValue(VALID_CODE);
  });

  it.each(['/anything', '/nested/path'])('renders the 404 page for %s', async (path) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'CS2 Crosshair Studio' })).not.toBeInTheDocument();
  });

  it('explains invalid legacy share-code paths instead of a generic 404', async () => {
    renderRoute('/CSGO-invalid');
    expect(await screen.findByRole('heading', { name: 'Invalid crosshair link' })).toBeInTheDocument();
    expect(screen.getByText(/share code in this link is incomplete or corrupted/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to the studio' })).toHaveAttribute('href', '/');
  });
});
