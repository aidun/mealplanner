import { Link, NavLink } from 'react-router-dom';
import { AppLogo } from './AppLogo';
import { LogoutIcon, PlusIcon, ShieldIcon, UserIcon } from './icons';
import { formatWeekRange, formatWeekRangeCompact } from '../lib/format';

interface HeaderProps {
  weekStart?: string;
  onCreatePlan?: () => void;
  creatingPlan?: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  isAdmin?: boolean;
  showCreatePlan?: boolean;
}

export function Header({
  weekStart,
  onCreatePlan,
  creatingPlan = false,
  onLogout,
  loggingOut,
  isAdmin = false,
  showCreatePlan = true,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-overview">
        <div className="brand-block">
          <Link to="/" className="brand-mark" aria-label="Mealplanner Startseite">
            <AppLogo />
          </Link>
          <p className="brand-subtitle">Woche planen, Gerichte anpassen, Einkauf mitnehmen.</p>
        </div>

        <div className="header-meta">
          <div className="week-chip">
            <span className="week-chip-label">Aktuelle Woche</span>
            <strong className="week-chip-value week-chip-value-default">{formatWeekRange(weekStart)}</strong>
            <strong className="week-chip-value week-chip-value-compact">{formatWeekRangeCompact(weekStart)}</strong>
          </div>
        </div>
      </div>

      <nav className="header-actions" aria-label="Primäre Aktionen">
        {showCreatePlan ? (
          <button type="button" className="button button-primary header-primary-action" onClick={onCreatePlan} disabled={creatingPlan}>
            <PlusIcon className="action-icon" />
            {creatingPlan ? 'Wochenplan wird erstellt…' : 'Wochenplan erstellen'}
          </button>
        ) : null}
        <div className="header-secondary-actions">
          <NavLink to="/onboarding" className="button button-secondary">
            <UserIcon className="action-icon" />
            Profil
          </NavLink>
          {isAdmin ? (
            <NavLink to="/admin" className="button button-secondary">
              <ShieldIcon className="action-icon" />
              Admin
            </NavLink>
          ) : null}
          <button type="button" className="button button-secondary" onClick={onLogout} disabled={loggingOut}>
            <LogoutIcon className="action-icon" />
            {loggingOut ? 'Abmeldung läuft…' : 'Abmelden'}
          </button>
        </div>
      </nav>
    </header>
  );
}
