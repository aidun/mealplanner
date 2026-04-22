import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAuthProviders } from '../api';
import { AppLogo } from '../components/AppLogo';
import { readableApiError } from '../lib/api-error';
import { useState } from 'react';
import { brand } from '../brand';

export function LoginPage() {
  const [loginError, setLoginError] = useState('');
  const [startingGoogleLogin, setStartingGoogleLogin] = useState(false);
  const providersQuery = useQuery({
    queryKey: ['auth-providers'],
    queryFn: getAuthProviders,
  });
  const providers = providersQuery.data?.providers ?? [];
  const google = providers.find((provider) => provider.id === 'google');
  const apple = providers.find((provider) => provider.id === 'apple');
  const googleEnabled = google?.enabled ?? false;
  const googleStartUrl = safeAuthStartUrl(google?.startUrl, '/api/auth/google/start');
  const appleStartUrl = safeAuthStartUrl(apple?.startUrl, '/api/auth/apple/start');

  const startGoogleLogin = async () => {
    setLoginError('');
    setStartingGoogleLogin(true);
    try {
      const response = await fetch(googleStartUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error || 'Google Login konnte nicht gestartet werden.');
      }
      window.location.assign(payload.redirectUrl);
    } catch (error) {
      setLoginError(readableApiError(error, 'Google Login konnte nicht gestartet werden.'));
      setStartingGoogleLogin(false);
    }
  };

  return (
    <div className="auth-shell">
      <main className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <p className="eyebrow">Privater Zugang</p>
          <h1 id="login-title" aria-label={brand.name}>
            <AppLogo />
          </h1>
          <p className="login-lead">
            Ruhige Wochenplanung, abgestimmte Rezepte und ein Einkauf, der wirklich zum Familienalltag passt. Der
            Login schützt nur euren Bereich und hält den Einstieg bewusst schlank.
          </p>
          <div className="login-hero-panel">
            <strong>Weniger Verwaltungsgefühl, mehr Familienküche.</strong>
            <p>Planen, verfeinern und mitnehmen, ohne zwischen mehreren Oberflächen den Faden zu verlieren.</p>
          </div>
          <div className="login-highlights" aria-label="Vorteile">
            <span>Woche gemeinsam führen</span>
            <span>Rezepte im Alltag anpassen</span>
            <span>Einkauf direkt mitnehmen</span>
          </div>
        </div>

        <div className="login-actions-block">
          <p className="login-section-label">Anmelden</p>
          <div className="login-actions" aria-label="Login-Anbieter">
            {googleEnabled ? (
              <button type="button" className="button button-primary login-button" onClick={() => void startGoogleLogin()} disabled={startingGoogleLogin}>
                {startingGoogleLogin ? 'Google Login startet' : 'Mit Google anmelden'}
              </button>
            ) : (
              <button type="button" className="button button-primary login-button" disabled>
                Mit Google anmelden
              </button>
            )}

            {apple?.enabled && appleStartUrl ? (
              <a className="button button-secondary login-button" href={appleStartUrl}>
                Mit Apple anmelden
              </a>
            ) : null}
          </div>
          <p className="login-support-copy">
            {brand.name} nutzt Social Login nur für den Zugang. Profile, Familienkonto und Wochenpläne bleiben davon fachlich getrennt.
          </p>
        </div>

        {providersQuery.isError ? (
          <p className="error-copy">Login-Anbieter konnten nicht geladen werden. Bitte später erneut versuchen.</p>
        ) : null}
        {loginError ? <p className="error-copy">{loginError}</p> : null}

        <nav className="legal-links" aria-label="Rechtliches">
          <Link to="/datenschutz">Datenschutz</Link>
          <Link to="/impressum">Impressum</Link>
        </nav>
      </main>
    </div>
  );
}

function safeAuthStartUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  if (!candidate.startsWith('/api/auth/')) {
    return fallback;
  }
  if (candidate.startsWith('//') || candidate.includes('\\')) {
    return fallback;
  }
  return candidate;
}
