import { Link } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';

interface LegalPageProps {
  kind: 'privacy' | 'imprint';
}

const LEGAL_DEFAULTS = {
  operatorName: 'Markus Hartmann',
  operatorAddress: '56323 Waldesch, Deutschland',
  contactEmail: 'info@markushartmann.dev',
  hosting: 'Cloudflare Tunnel, Kubernetes Cluster',
} as const;

export function LegalPage({ kind }: LegalPageProps) {
  const isPrivacy = kind === 'privacy';

  return (
    <div className="app-shell legal-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <Link to="/" className="brand-mark" aria-label="Familienküche Startseite">
            <AppLogo />
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
  const contactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() || LEGAL_DEFAULTS.contactEmail;
  const operatorName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim() || LEGAL_DEFAULTS.operatorName;
  const operatorAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim() || LEGAL_DEFAULTS.operatorAddress;

  return (
    <div className="legal-content">
      <h2>Verantwortlicher</h2>
      <p>{operatorName}</p>
      <p>{operatorAddress}</p>
      <p>Kontakt: {contactEmail}</p>

      <h2>Login-Daten</h2>
      <p>
        Mealplanner nutzt Social Login nur für den Zugang zum privaten Familienkonto. Dauerhaft gespeichert werden
        nur die technisch nötigen Zuordnungen der freigegebenen Accounts; Namen, Profilbilder und ähnliche
        Provider-Profildaten werden nicht für die Rezeptplanung verwendet.
      </p>

      <h2>Profil- und Planungsdaten</h2>
      <p>
        Gespeichert werden Haushaltsprofil, Familienmitglieder, Aliase, Regeln, Favoriten und erzeugte Wochenpläne.
        Diese Daten werden für Planung, Regeneration, Einkaufsliste und Familienfunktionen verwendet.
      </p>

      <h2>OpenAI-Verarbeitung</h2>
      <p>
        Für die Generierung von Wochenplänen, Rezeptvarianten und Profilzusammenführungen werden relevante Profil- und
        Planungsdaten an den konfigurierten OpenAI-Dienst übermittelt. Nährwerte bleiben Alltagsschätzungen und sind
        nicht medizinisch oder diätetisch verbindlich.
      </p>

      <h2>Hosting und Protokolle</h2>
      <p>
        Die App wird unter `mealplanner.markushartmann.dev` über Cloudflare und einen Kubernetes-Cluster betrieben.
        Beim Zugriff können technisch notwendige Verbindungs- und Fehlerprotokolle anfallen, um den sicheren Betrieb
        und die Fehleranalyse zu ermöglichen.
      </p>

      <h2>Speicherdauer und Zugriff</h2>
      <p>
        Sitzungen, Profile, Familienzuordnungen, Favoriten und Pläne bleiben gespeichert, bis sie im Familienkonto
        ersetzt oder entfernt werden. Zugriff erhalten nur freigegebene Accounts innerhalb des jeweiligen
        Familienkontos.
      </p>
    </div>
  );
}

function ImprintContent() {
  const operatorName = import.meta.env.VITE_LEGAL_OPERATOR_NAME?.trim() || LEGAL_DEFAULTS.operatorName;
  const operatorAddress = import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS?.trim() || LEGAL_DEFAULTS.operatorAddress;
  const contactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() || LEGAL_DEFAULTS.contactEmail;
  const hosting = import.meta.env.VITE_LEGAL_HOSTING?.trim() || LEGAL_DEFAULTS.hosting;

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
        Mealplanner ist ein privates Planungsangebot. Die technische Betriebsform und die Kontaktangaben sind hier
        abgebildet; weitergehende rechtliche Pflichtangaben werden bei Bedarf ergänzt.
      </p>
    </div>
  );
}
