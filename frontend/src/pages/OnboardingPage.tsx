import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createFamilyInvite, getProfile, saveProfile } from '../api';
import { formToProfile, profileToForm } from '../lib/profile-form';
import type { ProfileFormState } from '../types';

const EMPTY_FORM: ProfileFormState = {
  householdName: '',
  members: '',
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
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

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
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createFamilyInvite,
  });

  const update = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setHasEdited(true);
  };

  const statusMessage = useMemo(() => {
    if (saveMutation.isPending) return 'Profil wird gespeichert.';
    if (saveMutation.isError) return errorMessage(saveMutation.error);
    if (saveMutation.isSuccess && !hasEdited) return 'Profil gespeichert. Der nächste Wochenplan nutzt diese Angaben.';
    if (hasEdited) return 'Ungespeicherte Änderungen.';
    return 'Bereit zum Speichern.';
  }, [hasEdited, saveMutation.error, saveMutation.isError, saveMutation.isPending, saveMutation.isSuccess]);

  const profileExists = Boolean(profileQuery.data?.updatedAt);

  return (
    <div className="app-shell">
      <header className="app-header compact-header">
        <div className="brand-block">
          <button type="button" className="brand-mark brand-button" onClick={() => navigate('/')}>
            Mealplanner
          </button>
          <p className="brand-subtitle">Profil-Onboarding für die Familienplanung</p>
        </div>
      </header>

      <main className="app-main">
        <section className="profile-page">
          <div className="profile-page-intro">
            <span className="eyebrow">Profil</span>
            <h1>{profileExists ? 'Profil bearbeiten' : 'Profil anlegen'}</h1>
            <p>Personen, Alltag, Vorlieben und feste Regeln für den nächsten Familienplan.</p>
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
                <p>Name, Personen und grobe Mengenlogik.</p>
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

                <label className="field">
                  <span className="field-label">Mitglieder</span>
                  <textarea
                    className="input textarea"
                    rows={5}
                    value={form.members}
                    onChange={(event) => update('members', event.target.value)}
                    placeholder={'Anna: vegetarisch, mag Bowls\nBen: Pasta, mild\nMia: keine Tomaten'}
                  />
                </label>

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
                <p>Erstelle einen Einladungslink für eine Person. Beim Annehmen geht ihr persönlicher Account im Familienkonto auf.</p>
              </div>
              <div className="profile-section-fields">
                <p className="panel-feedback" role="note">
                  Hinweis: Beim Erstellen und Annehmen der Einladung wird der persönliche Account der eingeladenen Person in dieses Familienkonto überführt. Das Profil wird sinnvoll zusammengeführt.
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
                    <p>{inviteMutation.data.warningText}</p>
                  </div>
                ) : null}
                {inviteMutation.isError ? <p className="error-copy">{errorMessage(inviteMutation.error)}</p> : null}
              </div>
            </section>

            <section className="profile-section" aria-labelledby="taste-section">
              <div className="profile-section-copy">
                <span className="section-index">03</span>
                <h2 id="taste-section">Geschmack</h2>
                <p>Küchen, Kochstil und Zutaten, die draußen bleiben.</p>
              </div>
              <div className="profile-section-fields two-column">
                <label className="field">
                  <span className="field-label">Kochstil</span>
                  <input
                    className="input"
                    value={form.cookingStyle}
                    onChange={(event) => update('cookingStyle', event.target.value)}
                    placeholder="Schnell, warm, familienfreundlich"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Bevorzugte Küchen</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.preferredCuisines}
                    onChange={(event) => update('preferredCuisines', event.target.value)}
                    placeholder="Mediterran\nAsiatisch\nDeutsch"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Auszuschließende Zutaten</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.excludedIngredients}
                    onChange={(event) => update('excludedIngredients', event.target.value)}
                    placeholder="Koriander\nSellerie"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Planungsregeln</span>
                  <textarea
                    className="input textarea"
                    rows={4}
                    value={form.mealPlanningRules}
                    onChange={(event) => update('mealPlanningRules', event.target.value)}
                    placeholder="Wochentags schnell, am Wochenende etwas ausführlicher."
                  />
                </label>
              </div>
            </section>

            <section className="profile-section" aria-labelledby="preset-section">
              <div className="profile-section-copy">
                <span className="section-index">04</span>
                <h2 id="preset-section">Mahlzeiten</h2>
                <p>Lieblingsgerichte und feste Ideen für Frühstück, Mittag, Abendessen und Snacks.</p>
              </div>
              <div className="profile-section-fields preset-grid">
                <label className="field">
                  <span className="field-label">Frühstücks-Presets</span>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={form.breakfastPresets}
                    onChange={(event) => update('breakfastPresets', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Mittags-Presets</span>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={form.lunchPresets}
                    onChange={(event) => update('lunchPresets', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Abendessen-Presets</span>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={form.dinnerPresets}
                    onChange={(event) => update('dinnerPresets', event.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Snack-Presets</span>
                  <textarea
                    className="input textarea"
                    rows={3}
                    value={form.snackPresets}
                    onChange={(event) => update('snackPresets', event.target.value)}
                  />
                </label>
              </div>
            </section>

            <div className="profile-save-bar">
              <div>
                <strong>Profil speichern</strong>
                <p aria-live="polite">{statusMessage}</p>
              </div>
              <button type="submit" className="button button-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Wird gespeichert' : saveMutation.isSuccess && !hasEdited ? 'Gespeichert' : 'Profil speichern'}
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
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      return error.message;
    }
    return error.message;
  }
  return 'Profil konnte nicht gespeichert werden.';
}
