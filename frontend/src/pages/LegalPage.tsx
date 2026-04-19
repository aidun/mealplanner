import { Link } from 'react-router-dom';

interface LegalPageProps {
  kind: 'privacy' | 'imprint';
}

export function LegalPage({ kind }: LegalPageProps) {
  const isPrivacy = kind === 'privacy';

  return (
    <div className="app-shell legal-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <Link to="/" className="brand-mark" aria-label="Mealplanner Startseite">
            Mealplanner
          </Link>
          <p className="brand-subtitle">Rechtliche Angaben</p>
        </div>
      </header>

      <main className="app-main">
        <section className="surface legal-surface">
          <div className="surface-header">
            <div>
              <p className="eyebrow">TODO: rechtlich prüfen</p>
              <h1>{isPrivacy ? 'Datenschutz' : 'Impressum'}</h1>
              <p>
                Diese Seite ist ein technischer Platzhalter. Betreiberangaben und Rechtstexte müssen vor öffentlicher
                Nutzung geprüft und ergänzt werden.
              </p>
            </div>
          </div>

          {isPrivacy ? <PrivacyContent /> : <ImprintContent />}
        </section>
      </main>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="legal-content">
      <h2>TODO: Verantwortlicher</h2>
      <p>Name, Anschrift und Kontakt des Verantwortlichen ergänzen.</p>

      <h2>TODO: Login-Daten</h2>
      <p>
        Beschreiben, dass Social Login nur zur Authentifizierung genutzt wird und keine Namen, E-Mail-Adressen oder
        Profilbilder dauerhaft gespeichert werden.
      </p>

      <h2>TODO: OpenAI-Verarbeitung</h2>
      <p>
        Beschreiben, welche Essensplanungsdaten zur Generierung verarbeitet werden und welche Aufbewahrungsregeln
        gelten.
      </p>
    </div>
  );
}

function ImprintContent() {
  return (
    <div className="legal-content">
      <h2>TODO: Anbieterkennzeichnung</h2>
      <p>Name, ladungsfähige Anschrift, Kontakt-E-Mail und weitere Pflichtangaben ergänzen.</p>

      <h2>TODO: Verantwortlichkeit</h2>
      <p>Verantwortliche Person und technische Kontaktadresse ergänzen.</p>
    </div>
  );
}
