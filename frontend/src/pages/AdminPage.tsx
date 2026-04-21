import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { PlusIcon, SaveIcon, TrashIcon } from '../components/icons';
import { createPremiumUser, deletePremiumUser, getAdminOverview, getMailTemplates, logout, updateMailTemplate } from '../api';
import { readableApiError } from '../lib/api-error';
import { LoginPage } from './LoginPage';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '../session';
import type { MailTemplate } from '../types';

export function AdminPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [premiumEmail, setPremiumEmail] = useState('');
  const [sendPremiumInvite, setSendPremiumInvite] = useState(true);
  const [lastPremiumInviteSent, setLastPremiumInviteSent] = useState(false);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, MailTemplate>>({});
  const [loggedOut, setLoggedOut] = useState(false);

  const adminOverviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
    enabled: Boolean(session?.isAdmin),
  });
  const mailTemplatesQuery = useQuery({
    queryKey: ['admin-mail-templates'],
    queryFn: getMailTemplates,
    enabled: Boolean(session?.isAdmin),
  });

  useEffect(() => {
    const nextDrafts: Record<string, MailTemplate> = {};
    for (const template of mailTemplatesQuery.data ?? []) {
      nextDrafts[template.kind] = template;
    }
    if (Object.keys(nextDrafts).length > 0) {
      setTemplateDrafts(nextDrafts);
    }
  }, [mailTemplatesQuery.data]);

  const createPremiumMutation = useMutation({
    mutationFn: ({ email, sendInvite }: { email: string; sendInvite: boolean }) => createPremiumUser(email, { sendInvite }),
    onSuccess: async () => {
      setLastPremiumInviteSent(sendPremiumInvite);
      setPremiumEmail('');
      setSendPremiumInvite(true);
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
  const deletePremiumMutation = useMutation({
    mutationFn: deletePremiumUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
  const saveTemplateMutation = useMutation({
    mutationFn: ({ kind, template }: { kind: string; template: MailTemplate }) =>
      updateMailTemplate(kind, {
        subject: template.subject,
        textBody: template.textBody,
        htmlBody: template.htmlBody,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-mail-templates'] });
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
  const mailTemplates = mailTemplatesQuery.data ?? [];

  const updateTemplateDraft = (kind: string, key: keyof MailTemplate, value: string) => {
    setTemplateDrafts((current) => ({
      ...current,
      [kind]: {
        ...(current[kind] ?? mailTemplates.find((template) => template.kind === kind) ?? {
          kind,
          subject: '',
          textBody: '',
          htmlBody: '',
        }),
        [key]: value,
      },
    }));
  };

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
              <p>Diese E-Mail-Adressen schalten Premium familienweit frei und können direkt eine Einladung per Mail erhalten.</p>
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
                  onClick={() => createPremiumMutation.mutate({ email: premiumEmail, sendInvite: sendPremiumInvite })}
                  disabled={createPremiumMutation.isPending || premiumEmail.trim() === ''}
                >
                  <PlusIcon className="action-icon" />
                  Freigeben
                </button>
              </div>
              <label className="settings-toggle settings-toggle-inline">
                <input
                  type="checkbox"
                  checked={sendPremiumInvite}
                  onChange={(event) => setSendPremiumInvite(event.target.checked)}
                />
                <span>Premium-Einladung per Mail direkt mitsenden</span>
              </label>
              {createPremiumMutation.isError ? <p className="error-copy">{readableApiError(createPremiumMutation.error)}</p> : null}
              {createPremiumMutation.isSuccess ? (
                <p className="success-copy">
                  {lastPremiumInviteSent ? 'Premium freigeschaltet und Einladung versendet.' : 'Premium freigeschaltet.'}
                </p>
              ) : null}

              <div className="family-account-list">
                {(adminOverview?.premiumUsers ?? []).map((premiumUser) => (
                  <article key={premiumUser.id} className="family-account-row">
                    <div className="family-account-copy">
                      <div className="family-account-head">
                        <strong>{premiumUser.email}</strong>
                        <span className="account-role-badge">Premium</span>
                        {premiumUser.inviteSent ? <span className="account-role-badge">Einladung gesendet</span> : null}
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
              <h2>Mail-Templates</h2>
              <p>Betreff und Inhalte für Premium-Einladung, Familien-Einladung und Wochenplan-Mails anpassen.</p>
            </div>
            <div className="profile-section-fields">
              <div className="family-account-list">
                {mailTemplates.length === 0 ? <p className="muted">Noch keine Mail-Templates geladen.</p> : null}
                {mailTemplates.map((template) => {
                  const draft = templateDrafts[template.kind] ?? template;
                  return (
                    <article key={template.kind} className="family-account-row family-account-row-stacked">
                      <div className="family-account-copy">
                        <div className="family-account-head">
                          <strong>{template.label || template.kind}</strong>
                          <span className="account-role-badge">{template.kind}</span>
                        </div>
                        {template.description ? <p>{template.description}</p> : null}
                        {template.variableHint?.length ? (
                          <p>Verwendbare Platzhalter: {template.variableHint.join(', ')}</p>
                        ) : null}
                      </div>
                      <div className="profile-section-fields">
                        <label className="field">
                          <span className="field-label">Betreff</span>
                          <input
                            className="input"
                            value={draft.subject}
                            onChange={(event) => updateTemplateDraft(template.kind, 'subject', event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Text-Version</span>
                          <textarea
                            className="input textarea"
                            rows={5}
                            value={draft.textBody}
                            onChange={(event) => updateTemplateDraft(template.kind, 'textBody', event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">HTML-Version</span>
                          <textarea
                            className="input textarea"
                            rows={5}
                            value={draft.htmlBody}
                            onChange={(event) => updateTemplateDraft(template.kind, 'htmlBody', event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => saveTemplateMutation.mutate({ kind: template.kind, template: draft })}
                          disabled={saveTemplateMutation.isPending}
                        >
                          <SaveIcon className="action-icon" />
                          Template speichern
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {saveTemplateMutation.isError ? <p className="error-copy">{readableApiError(saveTemplateMutation.error)}</p> : null}
              {saveTemplateMutation.isSuccess ? <p className="success-copy">Mail-Template gespeichert.</p> : null}
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <span className="section-index">04</span>
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
