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
              <p className="eyebrow">Rechtliches</p>
              <h1>{isPrivacy ? 'Datenschutz' : 'Impressum'}</h1>
              <p>
                Diese Seite beschreibt den aktuellen technischen Stand der App. Betreiberangaben und die finale
                rechtliche Prüfung müssen vor einem dauerhaften öffentlichen Betrieb ergänzt werden.
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
      <h2>Verantwortlicher</h2>
      <p>Betreibername, ladungsfähige Anschrift und direkte Kontaktmöglichkeit ergänzen.</p>

      <h2>Login-Daten</h2>
      <p>
        Die App nutzt Social Login nur für den Zugang. Aus dem Login werden dauerhaft nur die technisch nötigen
        Zuordnungen gespeichert; Namen, Profilbilder und ähnliche Profildaten sind nicht Teil der Planungslogik.
      </p>

      <h2>Profil- und Planungsdaten</h2>
      <p>
        Gespeichert werden Haushaltsprofil, Familienmitglieder, Aliase, Regeln, Favoriten und erzeugte Wochenpläne.
        Diese Daten werden für Planung, Regeneration, Einkaufsliste und Familienfunktionen verwendet.
      </p>

      <h2>OpenAI-Verarbeitung</h2>
      <p>
        Für die Generierung werden Profil- und Planungsdaten an den konfigurierten OpenAI-Dienst übermittelt. Nährwerte
        bleiben Alltagsschätzungen und sind nicht medizinisch verbindlich.
      </p>
    </div>
  );
}

function ImprintContent() {
  return (
    <div className="legal-content">
      <h2>Anbieterkennzeichnung</h2>
      <p>Vollständiger Name, ladungsfähige Anschrift, Kontakt-E-Mail und weitere Pflichtangaben ergänzen.</p>

      <h2>Technischer Betrieb</h2>
      <p>Domain, Hosting, verantwortliche Kontaktadresse und die zuständige Ansprechperson ergänzen.</p>

      <h2>Hinweis</h2>
      <p>Diese Seite ersetzt keine rechtliche Prüfung. Vor dauerhaftem öffentlichen Betrieb sollte der Text final geprüft werden.</p>
    </div>
  );
}
