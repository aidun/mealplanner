import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getProfile, saveProfile } from '../api';
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

  useEffect(() => {
    if (profileQuery.data) {
      setForm(profileToForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      navigate('/');
    },
  });

  const update = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
            <h1>Profil anlegen</h1>
            <p>Alles, was die Planung persönlicher macht: Personen, Alltag, Vorlieben und feste Regeln.</p>
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

            <section className="profile-section" aria-labelledby="taste-section">
              <div className="profile-section-copy">
                <span className="section-index">02</span>
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
                <span className="section-index">03</span>
                <h2 id="preset-section">Mahlzeiten</h2>
                <p>Vorgaben pro Tageszeit, die OpenAI als Leitplanke nutzt.</p>
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
                <p>Änderungen gelten für die nächste Planerstellung und Regeneration.</p>
              </div>
              <button type="submit" className="button button-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Wird gespeichert' : 'Profil speichern'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
