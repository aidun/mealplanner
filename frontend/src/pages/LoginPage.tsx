import { useState } from 'react';
import { AppLogo } from '../components/AppLogo';
import { login, register } from '../api';
import { readableApiError } from '../lib/api-error';
import { brand } from '../brand';

type Mode = 'login' | 'register';

const previewDays = [
  { label: 'Mo', title: 'Zitronenpasta', note: 'schnell nach dem Sport', active: true },
  { label: 'Di', title: 'Blechlachs', note: 'mit Kartoffeln und Erbsen', active: false },
  { label: 'Mi', title: 'Tomatensuppe', note: 'mit warmem Käsebrot', active: false },
  { label: 'Do', title: 'Gnocchi-Pfanne', note: 'wenig Abwasch, viel Gemüse', active: false },
] as const;

const previewIngredients = ['Zitronen', 'Brokkoli', 'Burrata', 'Pasta', 'Basilikum'] as const;
const previewShopping = ['Zitronen 2 Stk', 'Brokkoli 1 Kopf', 'Burrata 2 Kugeln', 'Pasta 500 g'] as const;

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      window.location.assign('/');
    } catch (err) {
      setError(readableApiError(err, mode === 'login' ? 'Anmeldung fehlgeschlagen.' : 'Registrierung fehlgeschlagen.'));
    } finally {
      setLoading(false);
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
              <h2 className="login-entry-headline">{brand.entryHeadline}</h2>
              <p className="login-lead">{brand.entrySubline}</p>
            </div>

            <div className="login-actions-block">
              <div className="login-mode-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => { setMode('login'); setError(''); }}
                  className={mode === 'login' ? 'active' : ''}
                >
                  Anmelden
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => { setMode('register'); setError(''); }}
                  className={mode === 'register' ? 'active' : ''}
                >
                  Registrieren
                </button>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="login-form" noValidate>
                <label htmlFor="email">E-Mail</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
                <label htmlFor="password">Passwort</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  disabled={loading}
                  minLength={8}
                />
                <button
                  type="submit"
                  className="button button-primary login-button"
                  disabled={loading}
                >
                  {loading
                    ? mode === 'login' ? 'Anmelden…' : 'Registrieren…'
                    : mode === 'login' ? 'Anmelden' : 'Registrieren'}
                </button>
              </form>

              {error ? (
                <p className="error-copy" role="alert">{error}</p>
              ) : null}
            </div>
          </section>

          <section className="login-preview" aria-label="Produktvorschau">
            <div className="entry-tableau">
              <div className="entry-tableau-overview">
                <div>
                  <span className="entry-preview-label">Nächste Woche</span>
                  <strong>Zitronenpasta, Blechlachs und eine Suppe für Mittwoch</strong>
                </div>
                <p>Vier Abende, die zusammenpassen und direkt auf den Einkauf einzahlen.</p>
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
                    <p>Cremig, hell und schnell genug für einen vollen Montag mit Kindern und spätem Feierabend.</p>
                    <div className="entry-tableau-ingredients" aria-label="Zutaten im Rezept">
                      {previewIngredients.map((ingredient) => (
                        <span key={ingredient}>{ingredient}</span>
                      ))}
                    </div>
                  </div>

                  <div className="entry-tableau-shopping" aria-label="Einkauf">
                    <div className="entry-tableau-shopping-head">
                      <span className="entry-preview-section-title">Einkauf</span>
                      <strong>Ein Einkauf für mehrere Abende</strong>
                    </div>
                    <ul>
                      {previewShopping.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
