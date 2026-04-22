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
        <div className="login-stage">
          <div className="login-copy">
            <p className="eyebrow">Private Küchenplanung</p>
            <h1 id="login-title" aria-label={brand.name}>
              <AppLogo />
            </h1>
            <p className="login-lead">{brand.description}</p>
            <p className="login-editorial-note">
              Gute Wochen fühlen sich besser an, wenn Planung, Rezepte und Einkauf wie ein gemeinsamer Küchenfluss
              wirken statt wie drei getrennte Werkzeuge.
            </p>
            <div className="login-benefits" aria-label="Was Mahlio zusammenhält">
              <article className="login-benefit">
                <span>01</span>
                <div>
                  <strong>Woche mit Richtung</strong>
                  <p>Ein Plan, der Vorlieben, Tempo und Alltag zusammenzieht, bevor die Woche zerfasert.</p>
                </div>
              </article>
              <article className="login-benefit">
                <span>02</span>
                <div>
                  <strong>Rezepte zum Nachschärfen</strong>
                  <p>Gerichte bleiben anpassbar, damit Geschmack und Familienrealität nicht auseinanderlaufen.</p>
                </div>
              </article>
              <article className="login-benefit">
                <span>03</span>
                <div>
                  <strong>Einkauf ohne Reibung</strong>
                  <p>Die Liste bleibt direkt an der Woche, statt später mühsam wieder zusammengesucht zu werden.</p>
                </div>
              </article>
            </div>
          </div>

          <div className="login-actions-block">
            <div className="login-actions-copy">
              <p className="login-section-label">Zugang</p>
              <h2>Privat, direkt und ohne Verwaltungsballast.</h2>
              <p>
                Google oder Apple öffnen nur euren Bereich. Haushalt, Rollen und Küchenprofil bleiben im Produkt sauber
                getrennt.
              </p>
            </div>
            <div className="login-actions" aria-label="Login-Anbieter">
              {googleEnabled ? (
                <button
                  type="button"
                  className="button button-primary login-button"
                  onClick={() => void startGoogleLogin()}
                  disabled={startingGoogleLogin}
                >
                  {startingGoogleLogin ? 'Google Login startet…' : 'Mit Google anmelden'}
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
            <div className="login-highlights" aria-label="Produktprinzipien">
              <span>Privater Bereich</span>
              <span>Küchenprofil & Zugänge getrennt</span>
              <span>Feedback direkt im Produkt</span>
            </div>
            <p className="login-support-copy">
              {brand.name} nutzt Social Login nur für den Zugang. Woche, Rezepte, Einkauf und Einladungen bleiben im
              gemeinsamen Mahlio-Haushalt.
            </p>
          </div>
        </div>

        {providersQuery.isError ? (
          <p className="error-copy" role="alert">
            Login-Anbieter konnten nicht geladen werden. Bitte später erneut versuchen.
          </p>
        ) : null}
        {loginError ? (
          <p className="error-copy" role="alert">
            {loginError}
          </p>
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
