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
          Mealplanner
        </Link>
        <p className="brand-subtitle">Wochenboard für Familien, Profile und Einkaufsliste</p>
      </div>

      <div className="header-meta">
        <div className="week-chip">
          <span className="week-chip-label">Woche</span>
          <strong>{formatWeekRange(weekStart)}</strong>
        </div>

        <img
          className="header-image"
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=320&q=80"
          alt="Zubereitetes Familienessen"
        />
      </div>

      <nav className="header-actions" aria-label="Primäre Aktionen">
        <NavLink to="/onboarding" className="button button-secondary">
          Profil
        </NavLink>
        <button type="button" className="button button-primary" onClick={onCreatePlan} disabled={creatingPlan}>
          {creatingPlan ? 'Plan wird erstellt' : 'Plan generieren'}
        </button>
        <button type="button" className="button button-secondary" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Logout läuft' : 'Logout'}
        </button>
      </nav>
    </header>
  );
}
