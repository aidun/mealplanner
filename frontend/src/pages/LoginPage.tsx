import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAuthProviders } from '../api';
import { AppLogo } from '../components/AppLogo';
import { readableApiError } from '../lib/api-error';
import { useState } from 'react';
import { brand } from '../brand';

const previewDays = [
  { label: 'Mo', title: 'Pasta al Limone', note: 'mit Brokkoli & Burrata', active: true },
  { label: 'Di', title: 'Ofengemüse-Bowl', note: 'Tahini, Kräuter, warm serviert', active: false },
  { label: 'Mi', title: 'Tomatensuppe', note: 'mit geröstetem Brot', active: false },
  { label: 'Do', title: 'Kartoffel-Tacos', note: 'mit Limette & Salat', active: false },
] as const;

const previewIngredients = ['Zitronen', 'Brokkoli', 'Burrata', 'Pasta', 'Basilikum'] as const;
const previewShopping = ['Zitronen 2 Stk', 'Brokkoli 1 Kopf', 'Burrata 2 Kugeln', 'Pasta 500 g'] as const;

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
          <section className="login-copy">
            <div className="login-brand-lockup">
              <AppLogo markOnly className="login-brand-mark" />
              <div className="login-brand-copy">
                <p className="eyebrow">{brand.category}</p>
                <h1 id="login-title">{brand.name}</h1>
                <p className="login-brand-slogan">{brand.slogan}</p>
              </div>
            </div>

            <div className="login-intro">
              <p className="login-promise">{brand.promise}</p>
              <h2 className="login-entry-headline">{brand.entryHeadline}</h2>
              <p className="login-lead">{brand.entrySubline}</p>
            </div>

            <div className="login-actions-block">
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
                  <a className="button button-secondary login-button login-button-secondary" href={appleStartUrl}>
                    Mit Apple anmelden
                  </a>
                ) : null}
              </div>
              <p className="login-support-copy">{brand.supportNote}</p>
            </div>

            <div className="login-benefits" aria-label="Was Mahlio im Blick hält">
              {brand.proofPoints.map((point) => (
                <article key={point.title} className="login-benefit">
                  <strong>{point.title}</strong>
                  <p>{point.description}</p>
                </article>
              ))}
            </div>

            <nav className="legal-links" aria-label="Rechtliches">
              <Link to="/datenschutz">Datenschutz</Link>
              <Link to="/impressum">Impressum</Link>
            </nav>
          </section>

          <section className="login-preview" aria-label="Produktvorschau">
            <div className="login-preview-copy">
              <p className="login-section-label">Am Tisch gedacht</p>
              <h2>Eine ruhige Wochenfläche statt drei getrennter Baustellen.</h2>
              <p>Plan, Rezept und Einkauf liegen in einer einzigen Komposition, damit die Woche schneller greifbar wird.</p>
            </div>

            <div className="entry-tableau">
              <div className="entry-tableau-overview">
                <div>
                  <span className="entry-preview-label">Nächste Woche</span>
                  <strong>Zitronenpasta mit Brokkoli</strong>
                </div>
                <p>Montagabend · 4 Portionen · direkt an der Einkaufsspur</p>
              </div>

              <div className="entry-tableau-grid">
                <div className="entry-tableau-week" aria-label="Woche">
                  {previewDays.map((day) => (
                    <article
                      key={day.label}
                      className={`entry-tableau-day${day.active ? ' entry-tableau-day-active' : ''}`}
                    >
                      <span>{day.label}</span>
                      <strong>{day.title}</strong>
                      <small>{day.note}</small>
                    </article>
                  ))}
                </div>

                <div className="entry-tableau-focus" aria-label="Gericht im Fokus">
                  <div className="entry-tableau-recipe">
                    <span className="entry-preview-section-title">Gericht im Fokus</span>
                    <h3>Pasta al Limone mit Brokkoli und Burrata</h3>
                    <p>Cremig, hell und schnell genug für einen vollen Montag.</p>
                    <div className="entry-tableau-ingredients" aria-label="Zutaten im Rezept">
                      {previewIngredients.map((ingredient) => (
                        <span key={ingredient}>{ingredient}</span>
                      ))}
                    </div>
                  </div>

                  <div className="entry-tableau-shopping" aria-label="Einkauf">
                    <div className="entry-tableau-shopping-head">
                      <span className="entry-preview-section-title">Einkaufsspur</span>
                      <strong>Mit einem Griff auf der Liste</strong>
                    </div>
                    <ul>
                      {previewShopping.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="entry-tableau-foot">
                <span>Woche zuerst</span>
                <span>Rezepte bleiben im Kontext</span>
                <span>Einkauf hängt an derselben Woche</span>
              </div>
            </div>
          </section>
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
