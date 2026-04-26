import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { CheckIcon, PlusIcon, SaveIcon, TrashIcon } from '../components/icons';
import { createPremiumUser, deletePremiumUser, getAdminOverview, getMailTemplates, logout, resolveFeedback, updateMailTemplate } from '../api';
import { readableApiError } from '../lib/api-error';
import { LoginPage } from './LoginPage';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '../session';
import type { MailTemplate } from '../types';
import { getBuildInfo } from '../lib/build-info';

export function AdminPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const [premiumEmail, setPremiumEmail] = useState('');
  const [sendPremiumInvite, setSendPremiumInvite] = useState(true);
  const [lastPremiumInviteSent, setLastPremiumInviteSent] = useState(false);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, MailTemplate>>({});
  const [loggedOut, setLoggedOut] = useState(false);
  const buildInfo = getBuildInfo();

  const adminOverviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => getAdminOverview({ includeResolved: true }),
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
  const resolveFeedbackMutation = useMutation({
    mutationFn: resolveFeedback,
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
  const mailTemplates = mailTemplatesQuery.data ?? [];
  const feedbackEntries = adminOverview?.feedback ?? [];
  const openFeedbackCount = feedbackEntries.length;
  const premiumUserCount = adminOverview?.premiumUsers?.length ?? 0;
  const feedbackThemes = summarizeFeedbackThemes([
    ...feedbackEntries.map((entry) => entry.message),
    ...(adminOverview?.resolvedFeedback ?? []).map((entry) => entry.message),
  ]);

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
        <section className="profile-page admin-page">
          <div className="profile-page-intro profile-page-intro-split profile-page-intro-admin">
            <div className="profile-page-intro-copy">
              <span className="eyebrow">Backoffice</span>
              <h1>Betrieb, Freigaben und Feedback</h1>
              <p>Der operative Stand von `mealplanner-test` und die Punkte, die sichtbar in die Produktoberfläche zurückfließen.</p>
            </div>
            <div className="profile-intro-gallery admin-intro-gallery" aria-label="Backoffice Überblick">
              <article className="profile-intro-aside">
                <span className="eyebrow">Druck auf die UI</span>
                <strong>{openFeedbackCount} offene Rückmeldung{openFeedbackCount === 1 ? '' : 'en'}</strong>
                <p>Offene Punkte werden hier gesammelt, priorisiert und direkt wieder in sichtbare Produktarbeit übersetzt.</p>
              </article>
              <article className="profile-intro-aside">
                <span className="eyebrow">Freigaben & Tonalität</span>
                <strong>{premiumUserCount} Premium-Zugänge · {mailTemplates.length} Mail-Template{mailTemplates.length === 1 ? '' : 's'}</strong>
                <p>Freischaltungen, Mail-Tonalität und Deploy-Kontext bleiben in derselben ruhigen Betriebsansicht.</p>
              </article>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <h2>Deploy & offene Feedbacks</h2>
              <p>Aktueller ausgelieferter Stand und die Themen, die gerade sichtbar Druck auf die UI machen.</p>
            </div>
            <div className="profile-section-fields">
              <div className="admin-ops-strip" aria-label="Deployment Metadaten">
                <article className="admin-ops-hero">
                  <div className="admin-ops-copy">
                    <h2>Letzter Test-Deploy</h2>
                    <p>Der aktuell ausgelieferte Frontend-Stand für `mealplanner-test` mit Zeitstempel und Build-Kennung.</p>
                  </div>
                </article>
                <div className="profile-overview-grid admin-ops-grid">
                  <article className="profile-overview-card">
                    <strong>{buildInfo.deployedAtLabel}</strong>
                    <span>Deploy-Datum & Uhrzeit</span>
                  </article>
                  <article className="profile-overview-card">
                    <strong>{buildInfo.timezone}</strong>
                    <span>Zeitzone</span>
                  </article>
                  <article className="profile-overview-card">
                    <strong>{buildInfo.buildSha}</strong>
                    <span>Build-ID</span>
                  </article>
                </div>
              </div>
              {feedbackThemes.length > 0 ? (
                <div className="admin-feedback-themes" aria-label="Feedback Themen">
                  {feedbackThemes.map((theme) => (
                    <span key={theme} className="shopping-category-pill admin-feedback-theme">
                      {theme}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="family-account-list">
                {feedbackEntries.length === 0 ? (
                  <p className="section-note">Keine offenen Feedback-Punkte.</p>
                ) : (
                  feedbackEntries.map((entry) => (
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
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => resolveFeedbackMutation.mutate(entry.id)}
                        disabled={resolveFeedbackMutation.isPending}
                      >
                        <CheckIcon className="action-icon" />
                        Als gelöst markieren
                      </button>
                    </article>
                  ))
                )}
              </div>
              {resolveFeedbackMutation.isError ? <p className="error-copy">{readableApiError(resolveFeedbackMutation.error)}</p> : null}
              {resolveFeedbackMutation.isSuccess ? <p className="success-copy">Feedback als gelöst markiert.</p> : null}
              {(adminOverview?.resolvedFeedback ?? []).length > 0 ? (
                <details className="feedback-archive">
                  <summary>Archiv</summary>
                  <div className="family-account-list">
                    {(adminOverview?.resolvedFeedback ?? []).map((entry) => (
                      <article key={`resolved-${entry.id}`} className="family-account-row family-account-row-stacked">
                        <div className="family-account-copy">
                          <div className="family-account-head">
                            <strong>{entry.page || 'Unbekannte Seite'}</strong>
                            <span className="account-role-badge">Gelöst</span>
                            <span className="account-role-badge">
                              {entry.resolvedAt ? new Date(entry.resolvedAt).toLocaleString('de-DE') : 'Archiv'}
                            </span>
                          </div>
                          <p>{entry.message}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-copy">
              <h2>Premium-Zugänge</h2>
              <p>Diese E-Mail-Adressen schalten Premium familienweit frei und können direkt eine passende Mail erhalten.</p>
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
              <h2>Mail-Tonalität</h2>
              <p>Betreff und Inhalte für Premium, Einladungen und Wochenplan-Mails in der aktuellen Produktlinie pflegen.</p>
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
                        <details className="template-preview">
                          <summary>Vorschau</summary>
                          <div className="template-preview-grid">
                            <article className="template-preview-card">
                              <strong>Betreff</strong>
                              <p>{draft.subject}</p>
                            </article>
                            <article className="template-preview-card">
                              <strong>Text</strong>
                              <pre>{draft.textBody}</pre>
                            </article>
                            <article className="template-preview-card">
                              <strong>HTML</strong>
                              <div dangerouslySetInnerHTML={{ __html: draft.htmlBody }} />
                            </article>
                          </div>
                        </details>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => saveTemplateMutation.mutate({ kind: template.kind, template: draft })}
                          disabled={saveTemplateMutation.isPending}
                        >
                          <SaveIcon className="action-icon" />
                          Vorlage speichern
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
              <h2>Kennzahlen</h2>
              <p>Anonymisierte Aggregationen über Familien, Accounts und Generierungen.</p>
            </div>
            <div className="profile-section-fields">
              <div className="admin-stats-grid" aria-label="Admin Statistiken">
                <article className="profile-overview-card">
                  <strong>{(adminOverview?.stats?.averageActiveAccountsPerFamily ?? 0).toFixed(1)}</strong>
                  <span>Ø aktive Accounts pro Familie</span>
                </article>
                <article className="profile-overview-card">
                  <strong>{(adminOverview?.stats?.averageProfileMembersPerFamily ?? 0).toFixed(1)}</strong>
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
                    {(adminOverview?.stats?.familyDistributionByAccounts ?? []).map((bucket) => (
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
                    {(adminOverview?.stats?.familyDistributionByMembers ?? []).map((bucket) => (
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
                  {(adminOverview?.stats?.generations ?? []).map((item) => (
                    <div key={item.category} className="admin-bucket-row">
                      <span>{item.category}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function summarizeFeedbackThemes(messages: string[]) {
  const text = messages.join(' ').toLowerCase();
  const themes: string[] = [];
  if (text.includes('profil') || text.includes('onboarding')) {
    themes.push('Profil sichtbarer führen');
  }
  if (text.includes('mobile') || text.includes('header')) {
    themes.push('Mobile Kopfbereich verdichten');
  }
  if (text.includes('tag') || text.includes('tagesauswahl') || text.includes('kontext')) {
    themes.push('Mehr Kontext pro Tag');
  }
  return themes;
}
