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
        <section className="surface onboarding-surface">
          <div className="surface-header">
            <div>
              <h1>Profil anlegen</h1>
              <p>Die Angaben werden für Planerstellung, Wiederholungen und Einkaufslogik verwendet.</p>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate(formToProfile(form));
            }}
          >
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
                rows={4}
                value={form.members}
                onChange={(event) => update('members', event.target.value)}
                placeholder="Anna\nBen\nMia"
              />
            </label>

            <div className="field-group">
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

              <label className="field">
                <span className="field-label">Kochstil</span>
                <input
                  className="input"
                  value={form.cookingStyle}
                  onChange={(event) => update('cookingStyle', event.target.value)}
                  placeholder="Schnell, warm, familienfreundlich"
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">Bevorzugte Küchen</span>
              <textarea
                className="input textarea"
                rows={3}
                value={form.preferredCuisines}
                onChange={(event) => update('preferredCuisines', event.target.value)}
                placeholder="Mediterran\nAsiatisch\nDeutsch"
              />
            </label>

            <label className="field">
              <span className="field-label">Auszuschließende Zutaten</span>
              <textarea
                className="input textarea"
                rows={3}
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

            <div className="preset-grid">
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

            <div className="form-actions">
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
