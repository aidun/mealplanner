import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import { CheckIcon, CopyIcon, HeartIcon, MailIcon, PlusIcon, SaveIcon, TrashIcon } from '../components/icons';
import {
  createFamilyInvite,
  deleteFavorite,
  getFamily,
  getFavorites,
  getProfile,
  saveProfile as persistProfile,
  saveProfile,
  updateFamilyAccountSettings,
  updateFamilyMemberLink,
} from '../api';
import { readableApiError } from '../lib/api-error';
import { defaultMealPlanDays, emptyMember, formToProfile, profileToForm, syncMealPlanDays } from '../lib/profile-form';
import type { MemberFormState, ProfileFormState } from '../types';
import { useSession } from '../session';

const EMPTY_FORM: ProfileFormState = {
  householdName: '',
  members: [emptyMember(0)],
  mealPlanDays: defaultMealPlanDays(['person-1']),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const joinedFamily = searchParams.get('family') === 'joined';
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCopyState, setInviteCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [lastLinkedAccountEmail, setLastLinkedAccountEmail] = useState('');
  const [linkSuccessMessage, setLinkSuccessMessage] = useState('');
  const activeTab = parseProfileTab(searchParams.get('tab'));
  const setActiveTab = (tab: 'family' | 'rules' | 'favorites' | 'invites') => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === 'family') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
  const familyQuery = useQuery({
    queryKey: ['family'],
    queryFn: getFamily,
  });
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
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
    mutationFn: async (payload: { accountUserId: string; memberId: string }) => {
      const needsSave = hasEdited;
      setLinkSuccessMessage('');
      if (hasEdited) {
        await persistProfile(formToProfile(form));
      }
      const family = await updateFamilyMemberLink(payload);
      return { family, needsSave, accountEmail: lastLinkedAccountEmail };
    },
    onSuccess: async (result) => {
      setLinkSuccessMessage(
        result.needsSave
          ? `${result.accountEmail || 'Die Zuordnung'} wurde aktualisiert und das Profil dabei gespeichert.`
          : result.accountEmail
            ? `${result.accountEmail} wurde aktualisiert.`
            : 'Zuordnung gespeichert.'
      );
      setHasEdited(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['family'] }),
      ]);
    },
  });
  const accountSettingsMutation = useMutation({
    mutationFn: updateFamilyAccountSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['family'] });
    },
  });
  const deleteFavoriteMutation = useMutation({
    mutationFn: deleteFavorite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
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

  const updateMealSlot = (
    dayName: ProfileFormState['mealPlanDays'][number]['day'],
    slotName: ProfileFormState['mealPlanDays'][number]['slots'][number]['slot'],
    updater: (
      slot: ProfileFormState['mealPlanDays'][number]['slots'][number]
    ) => ProfileFormState['mealPlanDays'][number]['slots'][number]
  ) => {
    setForm((current) => ({
      ...current,
      mealPlanDays: current.mealPlanDays.map((day) =>
        day.day === dayName
          ? { ...day, slots: day.slots.map((slot) => (slot.slot === slotName ? updater(slot) : slot)) }
          : day
      ),
    }));
    setHasEdited(true);
  };

  const addMember = () => {
    setForm((current) => ({
      ...current,
      members: [...current.members, emptyMember(current.members.length)],
      mealPlanDays: syncMealPlanDays(current.mealPlanDays, [...current.members, emptyMember(current.members.length)]),
    }));
    setHasEdited(true);
  };

  const removeMember = (index: number) => {
    setForm((current) => ({
      ...current,
      members: current.members.length > 1 ? current.members.filter((_, memberIndex) => memberIndex !== index) : current.members,
      mealPlanDays: syncMealPlanDays(
        current.mealPlanDays,
        current.members.length > 1 ? current.members.filter((_, memberIndex) => memberIndex !== index) : current.members
      ),
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
        unassigned: !linked,
      };
    });
  }, [familyQuery.data?.accounts, form.members]);
  const familyRoster = useMemo(
    () =>
      form.members.map((member, index) => ({
        id: member.id,
        label: member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`,
        role: member.role.trim() || 'Profilmitglied',
        accounts: linkedMembers.filter((account) => account.linkedMemberId === member.id),
      })),
    [form.members, linkedMembers]
  );
  const linkedAccountsCount = linkedMembers.filter((account) => account.linkedMemberId).length;
  const unassignedAccountsCount = linkedMembers.filter((account) => account.unassigned).length;
  const favorites = favoritesQuery.data ?? [];
  const inviteSentByEmail = Boolean((inviteMutation.data as { emailSent?: boolean } | undefined)?.emailSent);
  const canManageFamilyMail = Boolean(session?.isPremium || session?.isAdmin);

  const statusMessage = useMemo(() => {
    if (saveMutation.isPending) return 'Profil wird gespeichert.';
    if (saveMutation.isError) return readableApiError(saveMutation.error);
    if (saveMutation.isSuccess && !hasEdited) return 'Profil gespeichert. Der nächste Wochenplan nutzt diese Angaben.';
    if (hasEdited) return 'Ungespeicherte Änderungen.';
    return 'Bereit zum Speichern.';
  }, [hasEdited, saveMutation.error, saveMutation.isError, saveMutation.isPending, saveMutation.isSuccess]);

  return (
    <div className="app-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <button type="button" className="brand-mark brand-button" onClick={() => navigate('/')}>
            <AppLogo />
          </button>
          <p className="brand-subtitle">Mitglieder, Aliase und Regeln für kommende Wochen.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="profile-page">
          <div className="profile-page-intro">
            <span className="eyebrow">Profil</span>
            <h1>Familienkonto pflegen</h1>
            <p>Hier liegen Mitglieder, verknüpfte Logins und die Regeln, nach denen neue Wochen geplant werden.</p>
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

          <nav className="profile-tab-nav" aria-label="Profilbereiche">
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'family' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('family')}
            >
              Familie
            </button>
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'rules' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              Planungsregeln
            </button>
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'favorites' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favoriten
            </button>
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'invites' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('invites')}
            >
              Einladungen
            </button>
          </nav>

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
              <span>Familienkonto aktiv. Das gemeinsame Profil wurde geladen und die Logins können jetzt sauber Personen zugeordnet werden.</span>
            </div>
          ) : null}

          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate(formToProfile(form));
            }}
          >
            <section className={`profile-section${activeTab !== 'family' ? ' profile-section-hidden' : ''}`} aria-labelledby="household-section">
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
                    name="householdName"
                    autoComplete="organization"
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
                            className="icon-button"
                            onClick={() => removeMember(index)}
                            aria-label={`${member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`} entfernen`}
                            title="Mitglied entfernen"
                          >
                            <TrashIcon className="action-icon" />
                          </button>
                        ) : null}
                      </div>

                      <div className="profile-section-fields member-grid">
                        <label className="field">
                          <span className="field-label">Name im Profil</span>
                          <input
                            className="input"
                            name={`member-name-${index}`}
                            autoComplete="name"
                            value={member.name}
                            onChange={(event) => updateMember(index, 'name', event.target.value)}
                            placeholder="Anna Weber"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Anrede im Plan</span>
                          <input
                            className="input"
                            name={`member-alias-${index}`}
                            autoComplete="nickname"
                            value={member.alias}
                            onChange={(event) => updateMember(index, 'alias', event.target.value)}
                            placeholder="Mama, Papa, Ben"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Beschreibung</span>
                          <input
                            className="input"
                            name={`member-role-${index}`}
                            value={member.role}
                            onChange={(event) => updateMember(index, 'role', event.target.value)}
                            placeholder="Erwachsen, Kind, Gast"
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
                        <p className="profile-inline-note member-grid-wide">
                          Allergien und Unverträglichkeiten werden in Rezepten nicht verbindlich geprüft. Bitte jede
                          Zutat vor dem Kochen noch einmal kontrollieren.
                        </p>
                        <p className="profile-inline-note member-grid-wide">
                          Name bleibt die eindeutige Person im Profil. Die Anrede wird in Prompts und im Plan bevorzugt
                          verwendet, wenn sie gesetzt ist.
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="member-editor-actions">
                  <button type="button" className="button button-secondary" onClick={addMember}>
                    <PlusIcon className="action-icon" />
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

            <section className={`profile-section${activeTab !== 'family' ? ' profile-section-hidden' : ''}`} aria-labelledby="family-section">
              <div className="profile-section-copy">
                <span className="section-index">02</span>
                <h2 id="family-section">Familienkonto</h2>
                <p>Login-Mails sichtbar halten, Accounts zuordnen und Einladungen versenden.</p>
              </div>
              <div className="profile-section-fields">
                <div className="family-overview" aria-label="Familienkonto Übersicht">
                  <strong>{familyQuery.data?.personal ? 'Persönlicher Bereich' : 'Gemeinsames Familienkonto'}</strong>
                  {familyQuery.data?.mergedWarning ? <p>{familyQuery.data.mergedWarning}</p> : null}
                  <div className="family-summary-row">
                    <span>{linkedAccountsCount} von {linkedMembers.length} Logins zugeordnet</span>
                    <span>{memberOptions.length} Profilmitglieder aktiv</span>
                    {unassignedAccountsCount > 0 ? <span>{unassignedAccountsCount} Logins brauchen noch eine Zuordnung</span> : null}
                  </div>
                </div>

                <div className="family-roster" aria-label="Wer gehört zum Familienkonto">
                  {familyRoster.map((member) => (
                    <article key={member.id} className="family-roster-card">
                      <div>
                        <strong>{member.label}</strong>
                        <p>{member.role}</p>
                      </div>
                      {member.accounts.length > 0 ? (
                        <div className="family-roster-mails">
                          {member.accounts.map((account) => (
                            <span key={`${member.id}-${account.userId}`} className="family-mail-chip">
                              {account.email || 'Keine Mail'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Noch kein Login zugeordnet.</p>
                      )}
                    </article>
                  ))}
                </div>

                <div className="family-account-list">
                  {linkedMembers.length > 0 ? (
                    linkedMembers.map((account) => (
                      <article
                        key={account.userId}
                        className={`family-account-row${account.unassigned ? ' family-account-row-unassigned' : ''}`}
                      >
                        <div className="family-account-copy">
                          <div className="family-account-head">
                            <strong>{account.email || 'Keine Mail verfügbar'}</strong>
                            <span className="account-role-badge">
                              {account.role === 'owner' ? 'Eigentümer' : 'Mitglied'}
                            </span>
                            {account.unassigned ? <span className="account-warning-badge">Zuordnung offen</span> : null}
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
                            onChange={(event) => {
                              setLastLinkedAccountEmail(account.email || 'Dieses Login');
                              linkMutation.mutate({
                                accountUserId: account.userId,
                                memberId: event.target.value,
                              });
                            }}
                          >
                            <option value="">Nicht zugewiesen</option>
                            {memberOptions.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="family-account-settings">
                          <div className="family-account-settings-copy">
                            <strong>E-Mail-Versand</strong>
                            <p>
                              {canManageFamilyMail
                                ? 'Wochenplan- und Rezept-Mails für dieses Login steuern.'
                                : 'Premium gilt familienweit. Mailschalter werden sichtbar, sobald dieses Familienkonto Premium aktiv hat.'}
                            </p>
                          </div>
                          <label className="settings-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(account.settings?.weeklyPlanEmailEnabled)}
                              disabled={!canManageFamilyMail || accountSettingsMutation.isPending}
                              onChange={(event) =>
                                accountSettingsMutation.mutate({
                                  accountUserId: account.userId,
                                  settings: {
                                    weeklyPlanEmailEnabled: event.target.checked,
                                    recipeEmailEnabled: Boolean(account.settings?.recipeEmailEnabled),
                                  },
                                })
                              }
                            />
                            <span>Wochenplan-Mail</span>
                          </label>
                          <label className="settings-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(account.settings?.recipeEmailEnabled)}
                              disabled={!canManageFamilyMail || accountSettingsMutation.isPending}
                              onChange={(event) =>
                                accountSettingsMutation.mutate({
                                  accountUserId: account.userId,
                                  settings: {
                                    weeklyPlanEmailEnabled: Boolean(account.settings?.weeklyPlanEmailEnabled),
                                    recipeEmailEnabled: event.target.checked,
                                  },
                                })
                              }
                            />
                            <span>Rezept-Mail</span>
                          </label>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="muted">Noch keine verknüpften Login-Accounts sichtbar.</p>
                  )}
                </div>
                {linkMutation.isError ? <p className="error-copy">{readableApiError(linkMutation.error)}</p> : null}
                {linkMutation.isSuccess ? (
                  <p className="success-copy">{linkSuccessMessage || 'Zuordnung gespeichert.'}</p>
                ) : null}
                {accountSettingsMutation.isError ? (
                  <p className="error-copy">{readableApiError(accountSettingsMutation.error)}</p>
                ) : null}
                {accountSettingsMutation.isSuccess ? (
                  <p className="success-copy">Mail-Einstellungen gespeichert.</p>
                ) : null}

              </div>
            </section>

            <section className={`profile-section${activeTab !== 'rules' ? ' profile-section-hidden' : ''}`} aria-labelledby="taste-section">
              <div className="profile-section-copy">
                <span className="section-index">03</span>
                <h2 id="taste-section">Planungsstil</h2>
                <p>Küchen, Kochstil und Zutaten, die draußen bleiben.</p>
              </div>
              <div className="profile-section-fields two-column">
                <div className="meal-plan-settings member-grid-wide">
                  <div className="meal-plan-settings-copy">
                    <strong>Mahlzeiten pro Tag</strong>
                    <p>Lege für Montag bis Sonntag fest, welche Mahlzeiten erzeugt werden und wer jeweils mitessen soll.</p>
                  </div>
                  <div className="meal-plan-slot-list">
                    {form.mealPlanDays.map((day) => (
                      <section key={day.day} className="meal-plan-day-card" aria-label={day.label}>
                        <div className="meal-plan-day-head">
                          <strong>{day.label}</strong>
                          <span>{day.slots.filter((slot) => slot.enabled).length} Mahlzeiten aktiv</span>
                        </div>
                        <div className="meal-plan-slot-list">
                          {day.slots.map((slot) => (
                            <article
                              key={`${day.day}-${slot.slot}`}
                              className={`meal-plan-slot-card${slot.enabled ? ' meal-plan-slot-card-active' : ''}`}
                            >
                              <label className="meal-plan-slot-head">
                                <input
                                  type="checkbox"
                                  checked={slot.enabled}
                                  onChange={(event) =>
                                    updateMealSlot(day.day, slot.slot, (current) => ({
                                      ...current,
                                      enabled: event.target.checked,
                                    }))
                                  }
                                />
                                <span>{slot.label}</span>
                              </label>
                              <div className="meal-plan-members" aria-label={`${day.label} ${slot.label} Teilnehmende`}>
                                {form.members.map((member, index) => {
                                  const memberLabel = member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`;
                                  return (
                                    <label
                                      key={`${day.day}-${slot.slot}-${member.id}-${index}`}
                                      className={`meal-plan-member-chip${slot.memberIds.includes(member.id) ? ' meal-plan-member-chip-active' : ''}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={slot.memberIds.includes(member.id)}
                                        disabled={!slot.enabled}
                                        onChange={(event) =>
                                          updateMealSlot(day.day, slot.slot, (current) => ({
                                            ...current,
                                            memberIds: event.target.checked
                                              ? [...current.memberIds, member.id].filter(
                                                  (value, memberIndex, values) => values.indexOf(value) === memberIndex
                                                )
                                              : current.memberIds.filter((memberId) => memberId !== member.id),
                                          }))
                                        }
                                      />
                                      <span>{memberLabel}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
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
                <p className="profile-inline-note two-column-note">
                  Hinweis: Auch bei klaren Regeln und Ausschlüssen prüft Mealplanner Rezepte nicht als rechtssicheren
                  Allergie-Check. Kritische Zutaten müssen vor dem Einkauf und Kochen manuell bestätigt werden.
                </p>
              </div>
            </section>

            <section className={`profile-section${activeTab !== 'rules' ? ' profile-section-hidden' : ''}`} aria-labelledby="defaults-section">
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

            <section className={`profile-section${activeTab !== 'favorites' ? ' profile-section-hidden' : ''}`} aria-labelledby="favorites-section">
              <div className="profile-section-copy">
                <span className="section-index">05</span>
                <h2 id="favorites-section">Favoriten</h2>
                <p>Gespeicherte Gerichte liegen hier gesammelt und können direkt bereinigt werden.</p>
              </div>
              <div className="profile-section-fields">
                <div className="family-overview" aria-label="Favoriten Übersicht">
                  <strong>{favorites.length} gespeicherte Rezepte</strong>
                  <p>Diese Sammlung wird beim Planen als bevorzugte Richtung wiederverwendet.</p>
                </div>
                {favorites.length > 0 ? (
                  <div className="favorite-settings-list">
                    {favorites.map((favorite) => (
                      <article key={favorite.id} className="favorite-settings-row">
                        <div className="favorite-settings-copy">
                          <div className="favorite-settings-head">
                            <span className="favorite-pill-icon" aria-hidden="true">
                              <HeartIcon className="meal-favorite-icon" />
                            </span>
                            <strong>{favorite.meal.title}</strong>
                          </div>
                          <p>
                            {favorite.meal.slot || 'Mahlzeit'}
                            {favorite.meal.tags?.[0] ? ` · ${favorite.meal.tags[0]}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => deleteFavoriteMutation.mutate(favorite.id)}
                          disabled={deleteFavoriteMutation.isPending}
                          aria-label={`${favorite.meal.title} aus Favoriten entfernen`}
                          title="Favorit entfernen"
                        >
                          <TrashIcon className="action-icon" />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Noch keine Favoriten gespeichert.</p>
                )}
              </div>
            </section>

            <section className={`profile-section${activeTab !== 'invites' ? ' profile-section-hidden' : ''}`} aria-labelledby="invites-section">
              <div className="profile-section-copy">
                <span className="section-index">06</span>
                <h2 id="invites-section">Einladungen</h2>
                <p>Neue Logins ins Familienkonto holen und sauber zusammenführen.</p>
              </div>
              <div className="profile-section-fields">
                <p className="panel-feedback" role="note">
                  Hinweis: Beim Erstellen und Annehmen der Einladung wird der persönliche Account der eingeladenen Person
                  in dieses Familienkonto überführt. Das Profil wird sinnvoll zusammengeführt.
                </p>
                <label className="field">
                  <span className="field-label">E-Mail-Adresse für Einladung</span>
                  <input
                    className="input"
                    type="email"
                    name="inviteEmail"
                    autoComplete="email"
                    inputMode="email"
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
                  <MailIcon className="action-icon" />
                  {inviteMutation.isPending ? 'Einladung wird per E-Mail versendet' : 'Einladung per E-Mail senden'}
                </button>
                {inviteMutation.data?.inviteLink ? (
                  <div className="invite-result">
                    <strong>Einladungslink</strong>
                    <a href={inviteMutation.data.inviteLink}>{inviteMutation.data.inviteLink}</a>
                    <button
                      type="button"
                      className={`icon-button${inviteCopyState === 'copied' ? ' icon-button-active' : ''}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteMutation.data!.inviteLink);
                          setInviteCopyState('copied');
                        } catch {
                          setInviteCopyState('failed');
                        }
                      }}
                      aria-label={inviteCopyState === 'copied' ? 'Einladungslink kopiert' : 'Einladungslink kopieren'}
                      title={inviteCopyState === 'copied' ? 'Einladungslink kopiert' : 'Einladungslink kopieren'}
                    >
                      {inviteCopyState === 'copied' ? <CheckIcon className="action-icon" /> : <CopyIcon className="action-icon" />}
                    </button>
                    <p>
                      {inviteSentByEmail
                        ? 'Die Einladung wurde per E-Mail verschickt und kann bei Bedarf auch direkt geteilt werden.'
                        : 'Der Link ist bereit. Die E-Mail konnte gerade nicht verschickt werden.'}
                    </p>
                    <p>{inviteMutation.data.warningText}</p>
                    {inviteCopyState === 'failed' ? <p className="error-copy">Link konnte nicht kopiert werden.</p> : null}
                  </div>
                ) : null}
                {inviteMutation.isError ? <p className="error-copy">{readableApiError(inviteMutation.error)}</p> : null}
              </div>
            </section>

            <div className="profile-save-bar">
              <div>
                <strong>Speichern und für die nächste Woche nutzen</strong>
                <p>Aliase und Profilzuordnungen werden in zukünftigen Prompts wiederverwendet.</p>
              </div>
              <button type="submit" className="button button-primary" disabled={saveMutation.isPending}>
                <SaveIcon className="action-icon" />
                {saveMutation.isPending ? 'Profil wird gespeichert' : 'Profil speichern'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function parseProfileTab(value: string | null): 'family' | 'rules' | 'favorites' | 'invites' {
  if (value === 'rules' || value === 'favorites' || value === 'invites') {
    return value;
  }
  return 'family';
}
