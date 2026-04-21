import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createFamilyInvite,
  getFamily,
  getProfile,
  saveProfile,
  updateFamilyMemberLink,
} from '../api';
import { emptyMember, formToProfile, profileToForm } from '../lib/profile-form';
import type { MemberFormState, ProfileFormState } from '../types';

const EMPTY_FORM: ProfileFormState = {
  householdName: '',
  members: [emptyMember(0)],
  servingsPerMeal: '',
  preferredCuisines: '',
  excludedIngredients: '',
  cookingStyle: '',
  mealPlanningRules: '',
  breakfastPresets: '',
  lunchPresets: '',
  dinnerPresets: '',
  snackPresets: '',
};

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const joinedFamily = new URLSearchParams(location.search).get('family') === 'joined';
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCopyState, setInviteCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
  const familyQuery = useQuery({
    queryKey: ['family'],
    queryFn: getFamily,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(profileToForm(profileQuery.data));
      setHasEdited(false);
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async (savedProfile) => {
      if (savedProfile) {
        setForm(profileToForm(savedProfile));
      }
      setHasEdited(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['family'] }),
      ]);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createFamilyInvite,
  });

  const linkMutation = useMutation({
    mutationFn: updateFamilyMemberLink,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family'] });
    },
  });

  const update = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setHasEdited(true);
  };

  const updateMember = (index: number, key: keyof MemberFormState, value: string) => {
    setForm((current) => ({
      ...current,
      members: current.members.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [key]: value } : member
      ),
    }));
    setHasEdited(true);
  };

  const addMember = () => {
    setForm((current) => ({
      ...current,
      members: [...current.members, emptyMember(current.members.length)],
    }));
    setHasEdited(true);
  };

  const removeMember = (index: number) => {
    setForm((current) => ({
      ...current,
      members: current.members.length > 1 ? current.members.filter((_, memberIndex) => memberIndex !== index) : current.members,
    }));
    setHasEdited(true);
  };

  const memberOptions = form.members
    .filter((member) => member.name.trim() !== '')
    .map((member) => ({
      id: member.id.trim() || member.alias.trim() || member.name.trim(),
      label: member.alias.trim() || member.name.trim(),
    }));

  const linkedMembers = useMemo(() => {
    const byId = new Map(form.members.map((member) => [member.id.trim(), member]));
    return (familyQuery.data?.accounts ?? []).map((account) => {
      const linked = account.linkedMemberId ? byId.get(account.linkedMemberId) : undefined;
      return {
        ...account,
        linkedLabel: linked ? linked.alias.trim() || linked.name.trim() : '',
      };
    });
  }, [familyQuery.data?.accounts, form.members]);
  const linkedAccountsCount = linkedMembers.filter((account) => account.linkedMemberId).length;

  const statusMessage = useMemo(() => {
    if (saveMutation.isPending) return 'Profil wird gespeichert.';
    if (saveMutation.isError) return errorMessage(saveMutation.error);
    if (saveMutation.isSuccess && !hasEdited) return 'Profil gespeichert. Der nächste Wochenplan nutzt diese Angaben.';
    if (hasEdited) return 'Ungespeicherte Änderungen.';
    return 'Bereit zum Speichern.';
  }, [hasEdited, saveMutation.error, saveMutation.isError, saveMutation.isPending, saveMutation.isSuccess]);

  return (
    <div className="app-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <button type="button" className="brand-mark brand-button" onClick={() => navigate('/')}>
            Mealplanner
          </button>
          <p className="brand-subtitle">Familie, Aliase und Regeln fuer kommende Wochen.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="profile-page">
          <div className="profile-page-intro">
            <span className="eyebrow">Profil</span>
            <h1>Familienkonto pflegen</h1>
            <p>Mitglieder, Aliase, verknuepfte Logins und die Regeln fuer eure kommenden Wochen.</p>
            <div className="profile-overview-grid" aria-label="Profilübersicht">
              <div className="profile-overview-card">
                <strong>{form.members.length}</strong>
                <span>Mitglieder im Profil</span>
              </div>
              <div className="profile-overview-card">
                <strong>{familyQuery.data?.accounts?.length ?? 0}</strong>
                <span>Verknüpfte Logins</span>
              </div>
              <div className="profile-overview-card">
                <strong>{familyQuery.data?.personal ? 'Privat' : 'Familie'}</strong>
                <span>{familyQuery.data?.name || form.householdName || 'Konto'}</span>
              </div>
            </div>
          </div>

          <div
            className={`status-strip${saveMutation.isError ? ' status-strip-error' : ''}${saveMutation.isSuccess && !hasEdited ? ' status-strip-success' : ''}`}
            role={saveMutation.isError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <span>{statusMessage}</span>
            {saveMutation.isSuccess && !hasEdited ? (
              <button type="button" className="button button-secondary" onClick={() => navigate('/')}>
                Zum Wochenplan
              </button>
            ) : null}
          </div>

          {joinedFamily ? (
            <div className="status-strip status-strip-success" role="status" aria-live="polite">
              <span>Familienkonto aktiv. Das gemeinsame Profil wurde geladen.</span>
            </div>
          ) : null}

          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate(formToProfile(form));
            }}
          >
            <section className="profile-section" aria-labelledby="household-section">
              <div className="profile-section-copy">
                <span className="section-index">01</span>
                <h2 id="household-section">Haushalt</h2>
                <p>Name, Mitglieder und Mengenlogik für eure gemeinsamen Rezepte.</p>
              </div>
              <div className="profile-section-fields">
                <label className="field">
                  <span className="field-label">Haushaltsname</span>
                  <input
                    className="input"
                    value={form.householdName}
                    onChange={(event) => update('householdName', event.target.value)}
                    placeholder="Familie Weber"
                  />
                </label>

                <div className="member-roster" aria-label="Mitgliederübersicht">
                  {form.members.map((member, index) => (
                    <div key={`roster-${member.id}-${index}`} className="member-pill">
                      <strong>{member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`}</strong>
                      <span>{member.role.trim() || 'Profilmitglied'}</span>
                    </div>
                  ))}
                </div>

                <div className="member-editor-list">
                  {form.members.map((member, index) => (
                    <article key={`${member.id}-${index}`} className="member-editor-card">
                      <div className="member-editor-header">
                        <div>
                          <strong>{member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`}</strong>
                          <p>{member.role.trim() || 'Noch keine Rolle gesetzt'}</p>
                        </div>
                        {form.members.length > 1 ? (
                          <button
                            type="button"
                            className="button button-secondary compact-action"
                            onClick={() => removeMember(index)}
                          >
                            Entfernen
                          </button>
                        ) : null}
                      </div>

                      <div className="profile-section-fields member-grid">
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input
                            className="input"
                            value={member.name}
                            onChange={(event) => updateMember(index, 'name', event.target.value)}
                            placeholder="Anna"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Alias</span>
                          <input
                            className="input"
                            value={member.alias}
                            onChange={(event) => updateMember(index, 'alias', event.target.value)}
                            placeholder="Mama, Markus, Alex"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Rolle</span>
                          <input
                            className="input"
                            value={member.role}
                            onChange={(event) => updateMember(index, 'role', event.target.value)}
                            placeholder="Erwachsen, Kind"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Kalorienziel</span>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={member.caloriesTarget}
                            onChange={(event) => updateMember(index, 'caloriesTarget', event.target.value)}
                            placeholder="2000"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Mag gern</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.likes}
                            onChange={(event) => updateMember(index, 'likes', event.target.value)}
                            placeholder="Pasta, Bowls, Ofengemüse"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Mag nicht</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.dislikes}
                            onChange={(event) => updateMember(index, 'dislikes', event.target.value)}
                            placeholder="Oliven, zu scharf"
                          />
                        </label>
                        <label className="field member-grid-wide">
                          <span className="field-label">Einschränkungen</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.restrictions}
                            onChange={(event) => updateMember(index, 'restrictions', event.target.value)}
                            placeholder="Kein Gluten, keine Tomaten"
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="member-editor-actions">
                  <button type="button" className="button button-secondary" onClick={addMember}>
                    Mitglied hinzufügen
                  </button>
                </div>

                <label className="field">
                  <span className="field-label">Standard-Portionen</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.servingsPerMeal}
                    onChange={(event) => update('servingsPerMeal', event.target.value)}
                    placeholder="4"
                  />
                </label>
              </div>
            </section>

            <section className="profile-section" aria-labelledby="family-section">
              <div className="profile-section-copy">
                <span className="section-index">02</span>
                <h2 id="family-section">Familienkonto</h2>
                <p>Login-Mails sichtbar halten, Accounts zuordnen und Einladungen teilen.</p>
              </div>
              <div className="profile-section-fields">
                <div className="family-overview" aria-label="Familienkonto Übersicht">
                  <strong>{familyQuery.data?.personal ? 'Persönlicher Bereich' : 'Gemeinsames Familienkonto'}</strong>
                  {familyQuery.data?.mergedWarning ? <p>{familyQuery.data.mergedWarning}</p> : null}
                  <div className="family-summary-row">
                    <span>{linkedAccountsCount} von {linkedMembers.length} Logins zugeordnet</span>
                    <span>{memberOptions.length} Profilmitglieder aktiv</span>
                  </div>
                </div>

                <div className="family-account-list">
                  {linkedMembers.length > 0 ? (
                    linkedMembers.map((account) => (
                      <article key={account.userId} className="family-account-row">
                        <div className="family-account-copy">
                          <div className="family-account-head">
                            <strong>{account.email || 'Keine Mail verfügbar'}</strong>
                            <span className="account-role-badge">
                              {account.role === 'owner' ? 'Eigentümer' : 'Mitglied'}
                            </span>
                          </div>
                          <p>
                            {account.linkedLabel
                              ? `Verknüpft mit ${account.linkedLabel}`
                              : 'Noch keinem Profilmitglied zugeordnet'}
                          </p>
                        </div>
                        <label className="field">
                          <span className="field-label">Zugeordnetes Profilmitglied</span>
                          <select
                            className="input"
                            value={account.linkedMemberId ?? ''}
                            onChange={(event) =>
                              linkMutation.mutate({
                                accountUserId: account.userId,
                                memberId: event.target.value,
                              })
                            }
                          >
                            <option value="">Nicht zugewiesen</option>
                            {memberOptions.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    ))
                  ) : (
                    <p className="muted">Noch keine verknüpften Login-Accounts sichtbar.</p>
                  )}
                </div>
                {linkMutation.isError ? <p className="error-copy">{errorMessage(linkMutation.error)}</p> : null}
                {linkMutation.isSuccess ? <p className="success-copy">Zuordnung gespeichert.</p> : null}

                <p className="panel-feedback" role="note">
                  Hinweis: Beim Erstellen und Annehmen der Einladung wird der persönliche Account der eingeladenen Person
                  in dieses Familienkonto überführt. Das Profil wird sinnvoll zusammengeführt.
                </p>
                <label className="field">
                  <span className="field-label">E-Mail-Adresse für Einladung</span>
                  <input
                    className="input"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => inviteMutation.mutate(inviteEmail)}
                  disabled={inviteMutation.isPending || inviteEmail.trim() === ''}
                >
                  {inviteMutation.isPending ? 'Einladung entsteht' : 'Einladungslink erstellen'}
                </button>
                {inviteMutation.data?.inviteLink ? (
                  <div className="invite-result">
                    <strong>Einladungslink</strong>
                    <a href={inviteMutation.data.inviteLink}>{inviteMutation.data.inviteLink}</a>
                    <button
                      type="button"
                      className="button button-secondary compact-action"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteMutation.data!.inviteLink);
                          setInviteCopyState('copied');
                        } catch {
                          setInviteCopyState('failed');
                        }
                      }}
                    >
                      {inviteCopyState === 'copied' ? 'Link kopiert' : 'Link kopieren'}
                    </button>
                    <p>{inviteMutation.data.warningText}</p>
                    {inviteCopyState === 'failed' ? <p className="error-copy">Link konnte nicht kopiert werden.</p> : null}
                  </div>
                ) : null}
                {inviteMutation.isError ? <p className="error-copy">{errorMessage(inviteMutation.error)}</p> : null}
              </div>
            </section>

            <section className="profile-section" aria-labelledby="taste-section">
              <div className="profile-section-copy">
                <span className="section-index">03</span>
                <h2 id="taste-section">Planungsstil</h2>
                <p>Küchen, Kochstil und Zutaten, die draußen bleiben.</p>
              </div>
              <div className="profile-section-fields two-column">
                <label className="field">
                  <span className="field-label">Bevorzugte Küchen & Themen</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.preferredCuisines}
                    onChange={(event) => update('preferredCuisines', event.target.value)}
                    placeholder={'Mediterran\nSchnell\nFamilientauglich'}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Ausgeschlossene Zutaten</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.excludedIngredients}
                    onChange={(event) => update('excludedIngredients', event.target.value)}
                    placeholder={'Keine Erdnüsse\nKeine rohen Zwiebeln'}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Kochstil</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.cookingStyle}
                    onChange={(event) => update('cookingStyle', event.target.value)}
                    placeholder="Alltagstauglich, frisch, wenig Abwasch"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Planungsregeln</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.mealPlanningRules}
                    onChange={(event) => update('mealPlanningRules', event.target.value)}
                    placeholder="Unter der Woche maximal 30 Minuten, freitags etwas Besonderes"
                  />
                </label>
              </div>
            </section>

            <section className="profile-section" aria-labelledby="defaults-section">
              <div className="profile-section-copy">
                <span className="section-index">04</span>
                <h2 id="defaults-section">Mahlzeiten-Defaults</h2>
                <p>Diese Texte gehen direkt in die Planungslogik ein.</p>
              </div>
              <div className="profile-section-fields preset-grid">
                <label className="field">
                  <span className="field-label">Frühstück</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.breakfastPresets}
                    onChange={(event) => update('breakfastPresets', event.target.value)}
                    placeholder="Schnell, nicht zu süß, gut vorbereitbar"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Mittag</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.lunchPresets}
                    onChange={(event) => update('lunchPresets', event.target.value)}
                    placeholder="Gut mitzunehmen oder aufzuwärmen"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Abendessen</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.dinnerPresets}
                    onChange={(event) => update('dinnerPresets', event.target.value)}
                    placeholder="Gemeinsames warmes Essen"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Snacks</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.snackPresets}
                    onChange={(event) => update('snackPresets', event.target.value)}
                    placeholder="Nur wenn sinnvoll für Alltag oder Kalorienziel"
                  />
                </label>
              </div>
            </section>

            <div className="profile-save-bar">
              <div>
                <strong>Speichern und für die nächste Woche nutzen</strong>
                <p>Aliase und Profilzuordnungen werden in zukünftigen Prompts wiederverwendet.</p>
              </div>
              <button type="submit" className="button button-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Profil wird gespeichert' : 'Profil speichern'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      return parsed.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return 'Aktion konnte nicht ausgeführt werden.';
}
