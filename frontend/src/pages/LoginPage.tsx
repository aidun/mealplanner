import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAuthProviders } from '../api';

export function LoginPage() {
  const providersQuery = useQuery({
    queryKey: ['auth-providers'],
    queryFn: getAuthProviders,
  });
  const providers = providersQuery.data?.providers ?? [];
  const google = providers.find((provider) => provider.id === 'google');
  const apple = providers.find((provider) => provider.id === 'apple');
  const googleEnabled = google?.enabled ?? true;
  const googleStartUrl = safeAuthStartUrl(google?.startUrl, '/api/auth/google/start');
  const appleStartUrl = safeAuthStartUrl(apple?.startUrl, '/api/auth/apple/start');

  return (
    <div className="auth-shell">
      <main className="login-panel" aria-labelledby="login-title">
        <div className="login-copy">
          <p className="eyebrow">Privater Zugang</p>
          <h1 id="login-title">Mealplanner</h1>
          <p>
            Melde dich mit einem erlaubten Social Login an. Die App speichert keine Namen, E-Mail-Adressen oder
            Profilbilder aus dem Login.
          </p>
        </div>

        <div className="login-actions" aria-label="Login-Anbieter">
          {googleEnabled ? (
            <a className="button button-primary login-button" href={googleStartUrl}>
              Mit Google anmelden
            </a>
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

        {providersQuery.isError ? (
          <p className="error-copy">Login-Anbieter konnten nicht geladen werden. Bitte später erneut versuchen.</p>
        ) : null}

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
