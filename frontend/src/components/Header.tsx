import { Link, NavLink } from 'react-router-dom';
import { AppLogo } from './AppLogo';
import { LogoutIcon, PlusIcon, UserIcon } from './icons';
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
          <AppLogo />
        </Link>
        <p className="brand-subtitle">Der Familienplan für jeden Tag</p>
      </div>

      <div className="header-meta">
        <div className="week-chip">
          <span className="week-chip-label">Woche</span>
          <strong>{formatWeekRange(weekStart)}</strong>
        </div>
      </div>

      <nav className="header-actions" aria-label="Primäre Aktionen">
        <NavLink to="/onboarding" className="button button-secondary">
          <UserIcon className="action-icon" />
          Profil
        </NavLink>
        <button type="button" className="button button-primary" onClick={onCreatePlan} disabled={creatingPlan}>
          <PlusIcon className="action-icon" />
          {creatingPlan ? 'Wochenplan wird erstellt' : 'Wochenplan erstellen'}
        </button>
        <button type="button" className="button button-secondary" onClick={onLogout} disabled={loggingOut}>
          <LogoutIcon className="action-icon" />
          {loggingOut ? 'Abmeldung läuft' : 'Abmelden'}
        </button>
      </nav>
    </header>
  );
}
