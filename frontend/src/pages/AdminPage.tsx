import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { PlusIcon, TrashIcon } from '../components/icons';
import { createPremiumUser, deletePremiumUser, getAdminOverview, logout } from '../api';
import { readableApiError } from '../lib/api-error';
import { LoginPage } from './LoginPage';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useSession } from '../session';

export function AdminPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [premiumEmail, setPremiumEmail] = useState('');
  const [loggedOut, setLoggedOut] = useState(false);

  const adminOverviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
    enabled: Boolean(session?.isAdmin),
  });

  const createPremiumMutation = useMutation({
    mutationFn: createPremiumUser,
    onSuccess: async () => {
      setPremiumEmail('');
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
  const deletePremiumMutation = useMutation({
    mutationFn: deletePremiumUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      queryClient.setQueryData(['session'], { authenticated: false });
      setLoggedOut(true);
    },
  });

  if (loggedOut) {
    return <LoginPage />;
  }
  if (!session?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const adminOverview = adminOverviewQuery.data;

  return (
    <div className="app-shell">
      <Header onLogout={() => logoutMutation.mutate()} loggingOut={logoutMutation.isPending} isAdmin showCreatePlan={false} />
      <main className="app-main">
        <section className="profile-page">
          <div className="profile-page-intro">
            <span className="eyebrow">Admin</span>
            <h1>Admin</h1>
            <p>Premium-Freigaben und anonymisierte Kennzahlen für Mealplanner.</p>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <span className="section-index">01</span>
              <h2>Premium-Freigaben</h2>
              <p>Diese E-Mail-Adressen dürfen sich anmelden und ersetzen die bisherige Freigabe über Konfiguration.</p>
            </div>
            <div className="profile-section-fields">
              <div className="premium-entry-row">
                <label className="field">
                  <span className="field-label">Premium-Mail freigeben</span>
                  <input
                    className="input"
                    type="email"
                    name="premiumEmail"
                    autoComplete="email"
                    inputMode="email"
                    value={premiumEmail}
                    onChange={(event) => setPremiumEmail(event.target.value)}
                    placeholder="nutzer@example.com"
                  />
                </label>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => createPremiumMutation.mutate(premiumEmail)}
                  disabled={createPremiumMutation.isPending || premiumEmail.trim() === ''}
                >
                  <PlusIcon className="action-icon" />
                  Freigeben
                </button>
              </div>
              {createPremiumMutation.isError ? <p className="error-copy">{readableApiError(createPremiumMutation.error)}</p> : null}

              <div className="family-account-list">
                {(adminOverview?.premiumUsers ?? []).map((premiumUser) => (
                  <article key={premiumUser.id} className="family-account-row">
                    <div className="family-account-copy">
                      <div className="family-account-head">
                        <strong>{premiumUser.email}</strong>
                        <span className="account-role-badge">Premium</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => deletePremiumMutation.mutate(premiumUser.id)}
                      aria-label={`${premiumUser.email} entfernen`}
                      title="Premium-Freigabe entfernen"
                    >
                      <TrashIcon className="action-icon" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <span className="section-index">02</span>
              <h2>Kennzahlen</h2>
              <p>Anonymisierte Aggregationen über Familien, Accounts und Generierungen.</p>
            </div>
            <div className="profile-section-fields">
              <div className="admin-stats-grid" aria-label="Admin Statistiken">
                <article className="profile-overview-card">
                  <strong>{(adminOverview?.stats.averageActiveAccountsPerFamily ?? 0).toFixed(1)}</strong>
                  <span>Ø aktive Accounts pro Familie</span>
                </article>
                <article className="profile-overview-card">
                  <strong>{(adminOverview?.stats.averageProfileMembersPerFamily ?? 0).toFixed(1)}</strong>
                  <span>Ø eingetragene Personen pro Familie</span>
                </article>
              </div>

              <div className="admin-bucket-grid">
                <article className="member-editor-card">
                  <div className="member-editor-header">
                    <div>
                      <strong>Familien nach aktiven Accounts</strong>
                      <p>Anonymisierte Verteilung über alle Familien.</p>
                    </div>
                  </div>
                  <div className="admin-bucket-list">
                    {(adminOverview?.stats.familyDistributionByAccounts ?? []).map((bucket) => (
                      <div key={`accounts-${bucket.label}`} className="admin-bucket-row">
                        <span>{bucket.label}</span>
                        <strong>{bucket.count}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="member-editor-card">
                  <div className="member-editor-header">
                    <div>
                      <strong>Familien nach eingetragenen Personen</strong>
                      <p>Gezählt aus den gespeicherten Profilmitgliedern.</p>
                    </div>
                  </div>
                  <div className="admin-bucket-list">
                    {(adminOverview?.stats.familyDistributionByMembers ?? []).map((bucket) => (
                      <div key={`members-${bucket.label}`} className="admin-bucket-row">
                        <span>{bucket.label}</span>
                        <strong>{bucket.count}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <article className="member-editor-card">
                <div className="member-editor-header">
                  <div>
                    <strong>Generierungen nach Kategorie</strong>
                    <p>Cron-Läufe und Neugenerierungen nach Art, anonym aggregiert.</p>
                  </div>
                </div>
                <div className="admin-bucket-list">
                  {(adminOverview?.stats.generations ?? []).map((item) => (
                    <div key={item.category} className="admin-bucket-row">
                      <span>{item.category}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <span className="section-index">03</span>
              <h2>Feedback</h2>
              <p>Aktuelle Rueckmeldungen aus der Premium-Feedbackbox.</p>
            </div>
            <div className="profile-section-fields">
              <div className="family-account-list">
                {(adminOverview?.feedback ?? []).length === 0 ? (
                  <p className="section-note">Noch kein Feedback eingegangen.</p>
                ) : (
                  (adminOverview?.feedback ?? []).map((entry) => (
                    <article key={entry.id} className="family-account-row family-account-row-stacked">
                      <div className="family-account-copy">
                        <div className="family-account-head">
                          <strong>{entry.page || 'Unbekannte Seite'}</strong>
                          <span className="account-role-badge">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString('de-DE') : 'Neu'}
                          </span>
                        </div>
                        <p>{entry.message}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
