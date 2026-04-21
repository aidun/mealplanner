import { Link, NavLink } from 'react-router-dom';
import { formatWeekRange } from '../lib/format';

interface HeaderProps {
  weekStart?: string;
  onCreatePlan: () => void;
  creatingPlan: boolean;
  onLogout: () => void;
  loggingOut: boolean;
}

export function Header({
  weekStart,
  onCreatePlan,
  creatingPlan,
  onLogout,
  loggingOut,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <Link to="/" className="brand-mark" aria-label="Mealplanner Startseite">
          Familienküche
        </Link>
        <p className="brand-subtitle">Woche für Woche entspannt kochen</p>
      </div>

      <div className="header-meta">
        <div className="week-chip">
          <span className="week-chip-label">Woche</span>
          <strong>{formatWeekRange(weekStart)}</strong>
        </div>

        <div className="header-plate" aria-hidden="true">
          <span />
        </div>
      </div>

      <nav className="header-actions" aria-label="Primäre Aktionen">
        <NavLink to="/onboarding" className="button button-secondary">
          Profil
        </NavLink>
        <button type="button" className="button button-primary" onClick={onCreatePlan} disabled={creatingPlan}>
          {creatingPlan ? 'Wird gekocht' : 'Neue Woche'}
        </button>
        <button type="button" className="button button-secondary" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Logout läuft' : 'Logout'}
        </button>
      </nav>
    </header>
  );
}
