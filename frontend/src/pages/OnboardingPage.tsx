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
  skipProfileOnboarding,
  updateFamilyAccountSettings,
  updateFamilyMemberLink,
} from '../api';
import { readableApiError } from '../lib/api-error';
import { defaultMealPlanDays, emptyMember, formToProfile, profileToForm, syncMealPlanDays } from '../lib/profile-form';
import type { FamilyAccount, MemberFormState, ProfileFormState } from '../types';
import { useSession } from '../session';
import { brand } from '../brand';

const EMPTY_FORM: ProfileFormState = {
  householdName: '',
  members: [emptyMember(0)],
  mealPlanDays: defaultMealPlanDays(['person-1']),
  servingsPerMeal: '',
  preferredCuisines: '',
  excludedIngredients: '',
  preferredStores: '',
  shoppingNotes: '',
  cookingStyle: '',
  mealPlanningRules: '',
  breakfastPresets: '',
  lunchPresets: '',
  dinnerPresets: '',
  snackPresets: '',
};

const GUIDED_ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Start' },
  { id: 'household', label: 'Familie' },
  { id: 'members', label: 'Menschen' },
  { id: 'taste', label: 'Geschmack' },
  { id: 'rhythm', label: 'Alltag' },
  { id: 'finish', label: 'Fertig' },
];

const GUIDED_WEEK_PREVIEW = [
  { label: 'Mo', title: 'Pasta mit Gemüse', note: 'schnell nach Kita und Arbeit' },
  { label: 'Di', title: 'Ofengemüse', note: 'wenig Abwasch, alles auf einem Blech' },
  { label: 'Mi', title: 'Suppe & Brot', note: 'warm, einfach, familiennah' },
] as const;

const GUIDED_SHOPPING_PREVIEW = ['Gemüse für zwei Abende', 'ein Einkauf statt Einzelideen', 'Rezepte direkt am Tag'] as const;

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const joinedFamily = searchParams.get('family') === 'joined';
  const welcomeDialogRequested = searchParams.get('welcome') === '1';
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(Boolean(session?.onboardingRequired || welcomeDialogRequested));
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedOnboardingDismissed, setGuidedOnboardingDismissed] = useState(false);
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
      setForm(seedProfileForm(profileToForm(profileQuery.data), session?.email, familyQuery.data?.accounts));
      setHasEdited(false);
    }
  }, [familyQuery.data?.accounts, profileQuery.data, session?.email]);

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
        queryClient.invalidateQueries({ queryKey: ['session'] }),
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
  const skipOnboardingMutation = useMutation({
    mutationFn: skipProfileOnboarding,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/', { replace: true });
    },
  });

  useEffect(() => {
    if ((session?.onboardingRequired || welcomeDialogRequested) && !guidedOnboardingDismissed) {
      setShowWelcomeDialog(true);
      setGuidedStep(0);
    }
  }, [guidedOnboardingDismissed, session?.onboardingRequired, welcomeDialogRequested]);

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

  const familyMembersForAssignments = useMemo(() => {
    const merged = new Map<string, { id: string; name: string; alias?: string; role?: string }>();
    for (const member of form.members) {
      const id = member.id.trim();
      const name = member.name.trim();
      if (!id || !name) continue;
      merged.set(id, {
        id,
        name,
        alias: member.alias.trim() || undefined,
        role: member.role.trim() || undefined,
      });
    }
    for (const member of familyQuery.data?.members ?? []) {
      const id = member.id.trim();
      const name = member.name.trim();
      if (!id || !name) continue;
      const current = merged.get(id);
      merged.set(id, {
        id,
        name,
        alias: member.alias?.trim() || current?.alias,
        role: current?.role,
      });
    }
    return Array.from(merged.values());
  }, [familyQuery.data?.members, form.members]);

  const memberOptions = familyMembersForAssignments.map((member) => ({
    id: member.id,
    label: member.alias?.trim() || member.name,
  }));

  const linkedMembers = useMemo(() => {
    const byId = new Map(familyMembersForAssignments.map((member) => [member.id, member]));
    return (familyQuery.data?.accounts ?? []).map((account) => {
      const linked = account.linkedMemberId ? byId.get(account.linkedMemberId) : undefined;
      return {
        ...account,
        linkedLabel: linked ? linked.alias?.trim() || linked.name.trim() : account.linkedMemberId || '',
        unassigned: !account.linkedMemberId,
        unresolvedLink: Boolean(account.linkedMemberId && !linked),
      };
    });
  }, [familyMembersForAssignments, familyQuery.data?.accounts]);
  const visibleAccounts = useMemo(() => {
    if (linkedMembers.length > 0) {
      return linkedMembers;
    }
    if (!session?.authenticated || !session.userID || !session.email) {
      return [];
    }
    return [
      {
        userId: session.userID,
        email: session.email,
        role: familyQuery.data?.personal ? 'owner' : '',
        linkedMemberId: '',
        settings: {
          weeklyPlanEmailEnabled: true,
          recipeEmailEnabled: true,
        },
        linkedLabel: '',
        unassigned: true,
        unresolvedLink: false,
      },
    ];
  }, [familyQuery.data?.personal, linkedMembers, session?.authenticated, session?.email, session?.userID]);
  const familyRoster = useMemo(
    () =>
      familyMembersForAssignments.map((member, index) => ({
        id: member.id,
        label: member.alias?.trim() || member.name.trim() || `Mitglied ${index + 1}`,
        role: member.role?.trim() || 'Haushaltsmitglied',
        accounts: visibleAccounts.filter((account) => account.linkedMemberId === member.id),
      })),
    [familyMembersForAssignments, visibleAccounts]
  );
  const visibleAccountsCount = visibleAccounts.length;
  const linkedAccountsCount = visibleAccounts.filter((account) => account.linkedMemberId).length;
  const unassignedAccountsCount = visibleAccounts.filter((account) => account.unassigned).length;
  const favorites = favoritesQuery.data ?? [];
  const inviteSentByEmail = Boolean((inviteMutation.data as { emailSent?: boolean } | undefined)?.emailSent);
  const canManageFamilyMail = Boolean(session?.isPremium || session?.isAdmin);
  const namedMembersCount = form.members.filter((member) => member.name.trim() !== '').length;
  const activeMealSlotsCount = form.mealPlanDays.reduce((sum, day) => sum + day.slots.filter((slot) => slot.enabled).length, 0);
  const hasUnconfiguredProfile = !form.householdName.trim() && namedMembersCount === 0;

  const closeWelcomeDialog = () => {
    setShowWelcomeDialog(false);
    setGuidedOnboardingDismissed(true);
    setGuidedStep(0);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('welcome');
      return next;
    }, { replace: true });
  };

  const startWelcomeFlow = () => setGuidedStep(1);

  const statusMessage = useMemo(() => {
    if (saveMutation.isPending) return 'Wir merken eure Vorlieben.';
    if (saveMutation.isError) return readableApiError(saveMutation.error, 'Eure Vorlieben konnten gerade nicht gespeichert werden.');
    if (saveMutation.isSuccess && !hasEdited) return 'Gespeichert. Der nächste Wochenplan nutzt euren Familiengeschmack.';
    if (hasEdited) return 'Noch nicht gespeichert.';
    return '';
  }, [hasEdited, saveMutation.error, saveMutation.isError, saveMutation.isPending, saveMutation.isSuccess]);

  const hasNamedMembers = namedMembersCount > 0;
  const guidedOnboardingActive = showWelcomeDialog;
  const primaryMember = form.members.find((member) => member.name.trim() !== '') ?? form.members[0];
  const guidedProgressPercent = `${Math.round((guidedStep / (GUIDED_ONBOARDING_STEPS.length - 1)) * 100)}%`;

  const completeGuidedOnboarding = async (mode: 'dashboard' | 'profile') => {
    await saveMutation.mutateAsync(formToProfile(form));
    closeWelcomeDialog();
    if (mode === 'dashboard') {
      navigate('/', { replace: true });
      return;
    }
    setActiveTab('family');
  };

  const canAdvanceGuidedStep = (() => {
    switch (guidedStep) {
      case 1:
        return form.householdName.trim() !== '';
      case 2:
        return hasNamedMembers;
      default:
        return true;
    }
  })();

  if (guidedOnboardingActive) {
    return (
      <div className="app-shell guided-onboarding-app-shell">
        <main className="app-main guided-onboarding-main">
          <section className="guided-onboarding-shell" aria-labelledby="guided-onboarding-title">
            <div className="guided-onboarding-topbar">
              <button type="button" className="brand-mark brand-button" onClick={() => navigate('/')}>
                <AppLogo />
              </button>
              <div className="guided-onboarding-topbar-copy">
                <strong>Ersteinrichtung</strong>
                <span>Überspringbar, kurz und nur für einen guten Start.</span>
              </div>
              <span className="guided-onboarding-step-badge">
                {guidedStep === 0 ? 'ca. 1 Minute' : `Schritt ${guidedStep} / ${GUIDED_ONBOARDING_STEPS.length - 1}`}
              </span>
            </div>
            <div className="guided-onboarding-card">
              <div className="guided-onboarding-progress" aria-label="Onboarding Fortschritt">
                <div className="guided-onboarding-progress-meta">
                  <span>{guidedStep === 0 ? 'Kurzer Einstieg' : guidedStep === GUIDED_ONBOARDING_STEPS.length - 1 ? 'Fast geschafft' : `Frage ${guidedStep} von ${GUIDED_ONBOARDING_STEPS.length - 2}`}</span>
                  <strong>{GUIDED_ONBOARDING_STEPS[guidedStep]?.label ?? 'Start'}</strong>
                </div>
                <div className="guided-onboarding-progress-track" aria-hidden="true">
                  <span className="guided-onboarding-progress-fill" style={{ width: guidedProgressPercent }} />
                </div>
                <div className="guided-onboarding-progress-labels">
                  {GUIDED_ONBOARDING_STEPS.map((step, index) => (
                    <span
                      key={step.id}
                      className={`guided-onboarding-progress-pill${index === guidedStep ? ' guided-onboarding-progress-pill-active' : ''}${index < guidedStep ? ' guided-onboarding-progress-pill-complete' : ''}`}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>

              {guidedStep === 0 ? (
                <div className="guided-onboarding-panel">
                  <div className="guided-onboarding-hero">
                    <div className="guided-onboarding-copy">
                      <span className="eyebrow">Erster Einstieg</span>
                      <h1 id="guided-onboarding-title">Ein paar lockere Fragen, dann passt die Woche schon deutlich besser.</h1>
                      <p className="guided-onboarding-lead">
                        Wir fragen kurz, wer bei euch mitisst und was bei euch gut ankommt. Du kannst jederzeit überspringen
                        oder später in Ruhe nachschärfen.
                      </p>
                    </div>
                    <div className="guided-onboarding-showcase" aria-label="Produktvorschau">
                      <div className="guided-onboarding-showcase-week">
                        <span className="guided-onboarding-showcase-label">Schon nach wenigen Antworten</span>
                        {GUIDED_WEEK_PREVIEW.map((entry) => (
                          <article key={entry.label} className="guided-onboarding-showcase-day">
                            <span>{entry.label}</span>
                            <strong>{entry.title}</strong>
                            <small>{entry.note}</small>
                          </article>
                        ))}
                      </div>
                      <div className="guided-onboarding-showcase-note">
                        <span className="guided-onboarding-showcase-label">Was dabei zusammenkommt</span>
                        <ul>
                          {GUIDED_SHOPPING_PREVIEW.map((entry) => (
                            <li key={entry}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="guided-onboarding-teasers">
                    <article>
                      <strong>Wer isst mit?</strong>
                      <span>Eine Person reicht zum Start. Mehr geht jederzeit später.</span>
                    </article>
                    <article>
                      <strong>Wie soll es schmecken?</strong>
                      <span>Ein paar Vorlieben und No-Gos genügen für die erste sinnvolle Woche.</span>
                    </article>
                    <article>
                      <strong>Wie viel Detail jetzt?</strong>
                      <span>Nur das Nötigste jetzt. Feinschliff bleibt im Profil.</span>
                    </article>
                  </div>
                  <div className="guided-onboarding-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => skipOnboardingMutation.mutate()}
                      disabled={skipOnboardingMutation.isPending}
                    >
                      {skipOnboardingMutation.isPending ? 'Wird übersprungen' : 'Erstmal überspringen'}
                    </button>
                    <button type="button" className="button button-primary" onClick={startWelcomeFlow}>
                      Los geht's
                    </button>
                  </div>
                  {skipOnboardingMutation.isError ? (
                    <p className="error-copy">{readableApiError(skipOnboardingMutation.error, 'Der Einstieg konnte gerade nicht übersprungen werden.')}</p>
                  ) : null}
                </div>
              ) : null}

              {guidedStep === 1 ? (
                <div className="guided-onboarding-panel">
                  <span className="eyebrow">Frage 1</span>
                  <h1 id="guided-onboarding-title">Wie nennt ihr euren Esstisch?</h1>
                  <p className="guided-onboarding-lead">
                    Das ist der Name, unter dem eure gemeinsamen Wochen und Vorlieben laufen. Er darf ruhig einfach sein.
                  </p>
                  <label className="field guided-onboarding-field">
                    <span className="field-label">Familienname</span>
                    <input
                      className="input guided-onboarding-input"
                      autoComplete="organization"
                      value={form.householdName}
                      onChange={(event) => update('householdName', event.target.value)}
                      placeholder="Familie Weber"
                    />
                  </label>
                  <p className="guided-onboarding-hint">Wenn du allein startest, reicht auch etwas wie „Markus' Küche“.</p>
                </div>
              ) : null}

              {guidedStep === 2 ? (
                <div className="guided-onboarding-panel">
                  <span className="eyebrow">Frage 2</span>
                  <h1 id="guided-onboarding-title">Wer isst meistens mit?</h1>
                  <p className="guided-onboarding-lead">
                    Wir brauchen nur die Menschen, die im Plan wirklich auftauchen sollen. Eine Person reicht zum Start.
                  </p>
                  <div className="guided-onboarding-member-list">
                    {form.members.map((member, index) => (
                      <article key={`${member.id}-${index}`} className="guided-onboarding-member-card">
                        <div className="guided-onboarding-member-head">
                          <strong>{member.name.trim() || `Person ${index + 1}`}</strong>
                          {form.members.length > 1 ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removeMember(index)}
                              aria-label={`${member.name.trim() || `Person ${index + 1}`} entfernen`}
                            >
                              <TrashIcon className="action-icon" />
                            </button>
                          ) : null}
                        </div>
                        <div className="guided-onboarding-member-grid">
                          <label className="field">
                            <span className="field-label">Name</span>
                            <input
                              className="input"
                              autoComplete="name"
                              value={member.name}
                              onChange={(event) => updateMember(index, 'name', event.target.value)}
                              placeholder="Anna"
                            />
                          </label>
                          <label className="field">
                            <span className="field-label">Im Plan ansprechen als</span>
                            <input
                              className="input"
                              autoComplete="nickname"
                              value={member.alias}
                              onChange={(event) => updateMember(index, 'alias', event.target.value)}
                              placeholder="Mama, Ben, Oma"
                            />
                          </label>
                          <label className="field guided-onboarding-member-grid-wide">
                            <span className="field-label">Kurz beschrieben</span>
                            <input
                              className="input"
                              value={member.role}
                              onChange={(event) => updateMember(index, 'role', event.target.value)}
                              placeholder="Erwachsen, Kind, Gast"
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="guided-onboarding-inline-actions">
                    <button type="button" className="button button-secondary" onClick={addMember}>
                      <PlusIcon className="action-icon" />
                      Noch eine Person
                    </button>
                  </div>
                </div>
              ) : null}

              {guidedStep === 3 ? (
                <div className="guided-onboarding-panel">
                  <span className="eyebrow">Frage 3</span>
                  <h1 id="guided-onboarding-title">Worauf soll {brand.name} beim Kochen achten?</h1>
                  <p className="guided-onboarding-lead">
                    Ein paar Stichworte reichen. Denk eher an Alltag, Geschmack und Dinge, die direkt raus sollen.
                  </p>
                  <div className="guided-onboarding-stack">
                    <label className="field guided-onboarding-field">
                      <span className="field-label">Was kocht ihr gern?</span>
                      <textarea
                        className="input textarea guided-onboarding-input"
                        rows={4}
                        value={form.preferredCuisines}
                        onChange={(event) => update('preferredCuisines', event.target.value)}
                        placeholder={'Mediterran\nPasta\nSchnell unter der Woche'}
                      />
                    </label>
                    <label className="field guided-onboarding-field">
                      <span className="field-label">Was soll lieber nicht auftauchen?</span>
                      <textarea
                        className="input textarea guided-onboarding-input"
                        rows={4}
                        value={form.excludedIngredients}
                        onChange={(event) => update('excludedIngredients', event.target.value)}
                        placeholder={'Keine Erdnüsse\nKeine rohen Zwiebeln'}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {guidedStep === 4 ? (
                <div className="guided-onboarding-panel">
                  <span className="eyebrow">Frage 4</span>
                  <h1 id="guided-onboarding-title">Wie soll sich eure Woche anfühlen?</h1>
                  <p className="guided-onboarding-lead">
                    Hier geht es um Tempo, Aufwand und kleine Leitplanken. Nicht perfekt, nur hilfreich.
                  </p>
                  <div className="guided-onboarding-stack">
                    <label className="field guided-onboarding-field">
                      <span className="field-label">Euer Kochstil im Alltag</span>
                      <textarea
                        className="input textarea guided-onboarding-input"
                        rows={4}
                        value={form.cookingStyle}
                        onChange={(event) => update('cookingStyle', event.target.value)}
                        placeholder="Frisch, unkompliziert, wenig Abwasch"
                      />
                    </label>
                    <label className="field guided-onboarding-field">
                      <span className="field-label">Wichtige Regeln für die Woche</span>
                      <textarea
                        className="input textarea guided-onboarding-input"
                        rows={4}
                        value={form.mealPlanningRules}
                        onChange={(event) => update('mealPlanningRules', event.target.value)}
                        placeholder="Unter der Woche maximal 30 Minuten, freitags gern etwas Besonderes"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {guidedStep === 5 ? (
                <div className="guided-onboarding-panel">
                  <span className="eyebrow">Startklar</span>
                  <h1 id="guided-onboarding-title">Das reicht für einen guten Start.</h1>
                  <p className="guided-onboarding-lead">
                    {brand.name} hat jetzt genug Kontext für eine deutlich passendere Woche. Feinschliff, Einladungen und
                    Tageslogik kannst du später immer noch im Detailprofil anpassen.
                  </p>
                  <div className="guided-onboarding-summary">
                    <article>
                      <span>Familie</span>
                      <strong>{form.householdName.trim() || 'Noch offen'}</strong>
                    </article>
                    <article>
                      <span>Mitesser</span>
                      <strong>{namedMembersCount || 0}</strong>
                    </article>
                    <article>
                      <span>Erste Hauptperson</span>
                      <strong>{primaryMember?.alias.trim() || primaryMember?.name.trim() || 'Noch offen'}</strong>
                    </article>
                  </div>
                  <div className="guided-onboarding-actions guided-onboarding-actions-final">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => completeGuidedOnboarding('profile')}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? 'Wird gespeichert' : 'Noch kurz ins Detailprofil'}
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => completeGuidedOnboarding('dashboard')}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? 'Wird gespeichert' : 'Mit diesem Start zur Woche'}
                    </button>
                  </div>
                  {saveMutation.isError ? (
                    <p className="error-copy">{readableApiError(saveMutation.error, 'Der Einstieg konnte gerade nicht gespeichert werden.')}</p>
                  ) : null}
                </div>
              ) : null}

              {guidedStep > 0 && guidedStep < GUIDED_ONBOARDING_STEPS.length ? (
                <div className="guided-onboarding-footer">
                  <button type="button" className="button button-secondary" onClick={() => setGuidedStep((current) => Math.max(0, current - 1))}>
                    Zurueck
                  </button>
                  <div className="guided-onboarding-footer-meta">
                    <span>{guidedStep} von {GUIDED_ONBOARDING_STEPS.length - 1} Fragen</span>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setGuidedStep((current) => Math.min(GUIDED_ONBOARDING_STEPS.length - 1, current + 1))}
                      disabled={!canAdvanceGuidedStep}
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <button type="button" className="brand-mark brand-button" onClick={() => navigate('/')}>
            <AppLogo />
          </button>
          <p className="brand-subtitle">Eure Familie, eure Lieblingsgerichte und euer Wochenrhythmus.</p>
        </div>
      </header>

      <main className="app-main">
        <section className="profile-page">
          <div className="profile-page-intro profile-page-intro-split">
            <div className="profile-page-intro-copy">
              <span className="eyebrow">Familienküche</span>
              <h1>Was eure Familie gern isst</h1>
              <p>Sagt {brand.name}, wer am Tisch sitzt, was gern gegessen wird und welche Alltagsregeln eure Woche leichter machen.</p>
              <div className="profile-overview-grid" aria-label="Haushaltsübersicht">
                <div className="profile-overview-card">
                  <strong>{namedMembersCount}</strong>
                  <span>Mitesser</span>
                </div>
                <div className="profile-overview-card">
                  <strong>{favorites.length}</strong>
                  <span>Lieblingsgerichte</span>
                </div>
                <div className="profile-overview-card">
                  <strong>{activeMealSlotsCount}</strong>
                  <span>Essenszeiten</span>
                </div>
              </div>
            </div>
            <div className="profile-intro-gallery" aria-label="Einordnung und Wirkung">
              <figure className="profile-intro-photo profile-intro-photo-family">
                <img src="/brand/mahlio-photo-library.png" alt="" />
              </figure>
              <article className="profile-intro-aside">
                <span className="eyebrow">Für euren Tisch</span>
                <strong>Eine Woche passt besser, wenn {brand.name} eure Vorlieben kennt.</strong>
                <p>Namen, Lieblingsgerichte, No-Gos und Einkaufsgewohnheiten helfen, Vorschläge familiennah zu planen.</p>
              </article>
            </div>
          </div>

          <nav className="profile-tab-nav" aria-label="Bereiche für Haushalt und Familie">
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
              Vorlieben
            </button>
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'favorites' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Lieblingsgerichte
            </button>
            <button
              type="button"
              className={`profile-tab-button${activeTab === 'invites' ? ' profile-tab-button-active' : ''}`}
              onClick={() => setActiveTab('invites')}
            >
              Einladen
            </button>
          </nav>

          {statusMessage ? (
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
          ) : null}

          {joinedFamily ? (
            <div className="status-strip status-strip-success" role="status" aria-live="polite">
              <span>Familienbereich aktiv. Vorlieben, Lieblingsgerichte und Einladungen liegen jetzt an einem Ort.</span>
            </div>
          ) : null}

          {hasUnconfiguredProfile ? (
            <div className="status-strip" role="status" aria-live="polite">
              <span>Ein paar Namen und Vorlieben reichen schon, damit die Woche deutlich passender wird.</span>
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
                <h2 id="household-section">Wer sitzt mit am Tisch?</h2>
                <p>Tragt die Menschen ein, für die {brand.name} planen soll: Portionen, Lieblingsessen und Dinge, die nicht auf den Tisch kommen.</p>
              </div>
              <div className="profile-section-fields">
                <label className="field">
                  <span className="field-label">Familienname</span>
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
                      <span>{member.role.trim() || 'Familienmitglied'}</span>
                    </div>
                  ))}
                </div>

                <div className="member-editor-list">
                  {form.members.map((member, index) => (
                    <article key={`${member.id}-${index}`} className="member-editor-card">
                      <div className="member-editor-header">
                        <div>
                          <strong>{member.alias.trim() || member.name.trim() || `Mitglied ${index + 1}`}</strong>
                          <p>{member.role.trim() || 'Noch keine Rolle am Tisch'}</p>
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
                          <span className="field-label">Name</span>
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
                          <span className="field-label">Name im Wochenplan</span>
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
                          <span className="field-label">Rolle am Tisch</span>
                          <input
                            className="input"
                            name={`member-role-${index}`}
                            value={member.role}
                            onChange={(event) => updateMember(index, 'role', event.target.value)}
                            placeholder="Erwachsen, Kind, Gast"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Ungefähres Tagesziel</span>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={member.caloriesTarget}
                            onChange={(event) => updateMember(index, 'caloriesTarget', event.target.value)}
                            placeholder="2000"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Isst gern</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.likes}
                            onChange={(event) => updateMember(index, 'likes', event.target.value)}
                            placeholder="Pasta, Bowls, Ofengemüse"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Mag nicht so</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.dislikes}
                            onChange={(event) => updateMember(index, 'dislikes', event.target.value)}
                            placeholder="Oliven, zu scharf"
                          />
                        </label>
                        <label className="field member-grid-wide">
                          <span className="field-label">Wichtig beim Essen</span>
                          <textarea
                            className="input textarea"
                            rows={3}
                            value={member.restrictions}
                            onChange={(event) => updateMember(index, 'restrictions', event.target.value)}
                            placeholder="Kein Gluten, keine Tomaten"
                          />
                        </label>
                        <p className="profile-inline-note member-grid-wide">
                          Wenn etwas wirklich nicht auf den Teller darf, hier klar notieren. Allergien und Unverträglichkeiten bitte vor Einkauf und Kochen zusätzlich prüfen.
                        </p>
                        <p className="profile-inline-note member-grid-wide">
                          Marken, Lieblingsprodukte und heikle Zutaten helfen, damit die Vorschläge besser zu eurem Alltag passen.
                        </p>
                        <p className="profile-inline-note member-grid-wide">
                          Der Name im Wochenplan ist die kurze Form, die später bei Portionen und Vorlieben auftaucht.
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="member-editor-actions">
                  <button type="button" className="button button-secondary" onClick={addMember}>
                    <PlusIcon className="action-icon" />
                    Person hinzufügen
                  </button>
                </div>

                <label className="field">
                  <span className="field-label">Portionen pro Mahlzeit</span>
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
                <h2 id="family-section">Wer darf mitplanen?</h2>
                <p>Wenn mehrere Menschen mitplanen, könnt ihr ihre Logins den passenden Personen am Tisch zuordnen.</p>
              </div>
              <div className="profile-section-fields">
                <div className="family-overview" aria-label="Familienkonto Übersicht">
                  <strong>{familyQuery.data?.personal ? 'Persönlicher Bereich' : 'Gemeinsames Familienkonto'}</strong>
                  {familyQuery.data?.mergedWarning ? <p>{familyQuery.data.mergedWarning}</p> : null}
                  <div className="family-summary-row">
                    <span>{linkedAccountsCount} von {visibleAccountsCount} Logins verbunden</span>
                    <span>{namedMembersCount} Mitesser</span>
                    {unassignedAccountsCount > 0 ? (
                      <span>
                        {unassignedAccountsCount} {unassignedAccountsCount === 1 ? 'Einladung braucht' : 'Einladungen brauchen'} noch eine Person
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="family-roster" aria-label="Wer gehört zum Familienkonto">
                  {familyRoster.length > 0 ? familyRoster.map((member) => (
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
                  )) : (
                    <article className="family-roster-card family-roster-card-placeholder">
                      <div>
                        <strong>Noch niemand eingetragen</strong>
                        <p>Lege oben zuerst fest, wer im Familienplan auftauchen soll.</p>
                      </div>
                    </article>
                  )}
                </div>

                <div className="family-account-list">
                  {visibleAccounts.length > 0 ? (
                    visibleAccounts.map((account) => (
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
                              : 'Noch keiner Person zugeordnet'}
                          </p>
                          {account.unresolvedLink ? (
                            <p className="muted">Gespeicherte Zuordnung vorhanden, aber die Person ist im aktuellen Profil noch nicht sichtbar.</p>
                          ) : null}
                        </div>
                        <label className="field">
                          <span className="field-label">Zugeordnete Person</span>
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
                  ) : null}
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
                <h2 id="taste-section">Geschmack & No-Gos</h2>
                <p>Was bei euch gut ankommt, was draußen bleibt und wie viel Aufwand in eure Woche passt.</p>
              </div>
              <div className="profile-section-fields two-column">
                <div className="meal-plan-settings member-grid-wide">
                  <div className="meal-plan-settings-copy">
                    <strong>Wann esst ihr zusammen?</strong>
                    <p>Wählt, an welchen Tagen Frühstück, Mittag, Abendessen oder Snacks wirklich geplant werden sollen.</p>
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
                  <span className="field-label">Was kommt bei euch gut an?</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.preferredCuisines}
                    onChange={(event) => update('preferredCuisines', event.target.value)}
                    placeholder={'Mediterran\nSchnell\nFamilientauglich'}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Kommt nicht auf den Teller</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.excludedIngredients}
                    onChange={(event) => update('excludedIngredients', event.target.value)}
                    placeholder={'Keine Erdnüsse\nKeine rohen Zwiebeln'}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Wo ihr gern einkauft</span>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={form.preferredStores}
                    onChange={(event) => update('preferredStores', event.target.value)}
                    placeholder={'Rewe\nEdeka\nWochenmarkt'}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Einkauf & Vorräte</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.shoppingNotes}
                    onChange={(event) => update('shoppingNotes', event.target.value)}
                    placeholder="500 g Pasta möglichst aufbrauchen, angebrochene Sahne am nächsten Tag einplanen."
                  />
                </label>
                <label className="field">
                  <span className="field-label">So kocht ihr gern</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.cookingStyle}
                    onChange={(event) => update('cookingStyle', event.target.value)}
                    placeholder="Alltagstauglich, frisch, wenig Abwasch"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Was in eure Woche passen muss</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.mealPlanningRules}
                    onChange={(event) => update('mealPlanningRules', event.target.value)}
                    placeholder="Unter der Woche maximal 30 Minuten, freitags etwas Besonderes"
                  />
                </label>
                <p className="profile-inline-note two-column-note">
                  Saison, Lieblingsgerichte und kleine Wochengewohnheiten helfen später bei stimmigeren Vorschlägen.
                </p>
              </div>
            </section>

            <section className={`profile-section${activeTab !== 'rules' ? ' profile-section-hidden' : ''}`} aria-labelledby="defaults-section">
              <div className="profile-section-copy">
                <span className="section-index">04</span>
                <h2 id="defaults-section">Vorlieben pro Tageszeit</h2>
                <p>Damit Frühstück, Mittagessen, Abendessen und Snacks zu euch passen.</p>
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
                <h2 id="favorites-section">Lieblingsgerichte</h2>
                <p>Gerichte, die bei euch funktionieren, bleiben hier gesammelt und geben der nächsten Woche eine vertraute Richtung.</p>
              </div>
              <div className="profile-section-fields">
                <div className="family-overview" aria-label="Lieblingsgerichte Übersicht">
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
                          aria-label={`${favorite.meal.title} aus Lieblingsgerichten entfernen`}
                          title="Lieblingsgericht entfernen"
                        >
                          <TrashIcon className="action-icon" />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Noch keine Lieblingsgerichte gespeichert.</p>
                )}
              </div>
            </section>

            <section className={`profile-section${activeTab !== 'invites' ? ' profile-section-hidden' : ''}`} aria-labelledby="invites-section">
              <div className="profile-section-copy">
                <span className="section-index">06</span>
                <h2 id="invites-section">Familie einladen</h2>
                <p>Holt weitere Menschen an euren gemeinsamen Tisch, damit sie mitplanen und Rezepte sehen können.</p>
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
                <strong>Für die nächste {brand.name}-Woche merken</strong>
                <p>Vorlieben, No-Gos und Familienrhythmus fließen in die nächsten Vorschläge ein.</p>
              </div>
              <button type="submit" className="button button-primary" disabled={saveMutation.isPending}>
                <SaveIcon className="action-icon" />
                {saveMutation.isPending ? 'Wird gemerkt' : 'Für unsere Woche merken'}
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

function seedProfileForm(
  form: ProfileFormState,
  sessionEmail?: string,
  accounts?: FamilyAccount[]
): ProfileFormState {
  const accountEmail = [sessionEmail, ...(accounts ?? []).map((account) => account.email ?? '')]
    .map((value) => (value ?? '').trim())
    .find(Boolean);
  if (!accountEmail) {
    return form;
  }

  const suggestion = deriveSeedFromEmail(accountEmail);
  const nextMembers = form.members.length > 0 ? [...form.members] : [emptyMember(0)];
  const firstMember = nextMembers[0] ?? emptyMember(0);
  const seededFirstMember = {
    ...firstMember,
    name: firstMember.name.trim() || suggestion.memberName,
    alias: firstMember.alias.trim() || suggestion.alias,
  };
  nextMembers[0] = seededFirstMember;

  return {
    ...form,
    householdName: form.householdName.trim() || suggestion.householdName,
    members: nextMembers,
    mealPlanDays: syncMealPlanDays(form.mealPlanDays, nextMembers),
  };
}

function deriveSeedFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart
    .replace(/\+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titled = toTitleCase(cleaned);
  const memberName = titled || 'Person 1';
  const firstWord = memberName.split(' ')[0] || memberName;
  return {
    memberName,
    alias: firstWord,
    householdName: `Haushalt ${firstWord}`,
  };
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .map((part) => {
      if (!part) {
        return '';
      }
      return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
    })
    .filter(Boolean)
    .join(' ');
}
