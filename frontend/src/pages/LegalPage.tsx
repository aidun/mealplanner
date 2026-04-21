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
                Diese Seite beschreibt den aktuellen Betriebsstand von Mealplanner. Die technischen Abläufe sind
                dokumentiert; Betreiber- und Pflichtangaben werden hier aus den hinterlegten Produktionsdaten
                veröffentlicht.
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
  const contactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() || 'Noch nicht hinterlegt';
  const operatorName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim() || 'Noch nicht hinterlegt';
  const operatorAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim() || 'Noch nicht hinterlegt';

  return (
    <div className="legal-content">
      <h2>Verantwortlicher</h2>
      <p>{operatorName}</p>
      <p>{operatorAddress}</p>
      <p>Kontakt: {contactEmail}</p>

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

      <h2>Speicherdauer und Zugriff</h2>
      <p>
        Sitzungen, Profile, Familienzuordnungen, Favoriten und Pläne bleiben gespeichert, bis sie im Familienkonto
        ersetzt oder entfernt werden. Zugriff erhalten nur freigegebene Accounts innerhalb des Familienkontos.
      </p>
    </div>
  );
}

function ImprintContent() {
  const operatorName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim() || 'Noch nicht hinterlegt';
  const operatorAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim() || 'Noch nicht hinterlegt';
  const contactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() || 'Noch nicht hinterlegt';
  const hosting = import.meta.env.VITE_LEGAL_HOSTING?.trim() || 'Cloudflare Tunnel, Kubernetes Cluster';

  return (
    <div className="legal-content">
      <h2>Anbieterkennzeichnung</h2>
      <p>{operatorName}</p>
      <p>{operatorAddress}</p>
      <p>E-Mail: {contactEmail}</p>

      <h2>Technischer Betrieb</h2>
      <p>Domain: mealplanner.markushartmann.dev</p>
      <p>Hosting: {hosting}</p>

      <h2>Hinweis</h2>
      <p>
        Diese Angaben muessen vor einem dauerhaften öffentlichen Betrieb vollständig und rechtlich geprüft hinterlegt
        sein. Fehlen Betreiberdaten, ist die Veröffentlichung noch nicht abnahmebereit.
      </p>
    </div>
  );
}
