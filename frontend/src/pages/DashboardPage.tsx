import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { LoginPage } from './LoginPage';
import {
  createPlan,
  getCurrentPlan,
  getProfile,
  getShoppingList,
  logout,
  regenerateMeal,
} from '../api';
import type { Meal } from '../types';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedMeal, setSelectedMeal] = useState<Meal | undefined>();
  const [loggedOut, setLoggedOut] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const currentPlanQuery = useQuery({
    queryKey: ['current-plan'],
    queryFn: getCurrentPlan,
  });

  const shoppingListQuery = useQuery({
    queryKey: ['shopping-list', currentPlanQuery.data?.id],
    queryFn: () => getShoppingList(currentPlanQuery.data!.id),
    enabled: Boolean(currentPlanQuery.data?.id),
  });

  const createPlanMutation = useMutation({
    mutationFn: () => createPlan({}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['current-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    },
  });

  const regenerateMealMutation = useMutation({
    mutationFn: ({ planId, mealId, note }: { planId: string; mealId: string; note: string }) =>
      regenerateMeal(planId, mealId, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['current-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
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

  const selectedMealId = selectedMeal?.id;

  const allMeals = useMemo(() => currentPlanQuery.data?.days.flatMap((day) => day.meals) ?? [], [
    currentPlanQuery.data,
  ]);

  useEffect(() => {
    if (!selectedMeal && allMeals[0]) {
      setSelectedMeal(allMeals[0]);
    }
  }, [allMeals, selectedMeal]);

  useEffect(() => {
    if (selectedMealId && !allMeals.some((meal) => meal.id === selectedMealId)) {
      setSelectedMeal(allMeals[0]);
    }
  }, [allMeals, selectedMealId]);

  const handleRegenerate = (note: string) => {
    const plan = currentPlanQuery.data;
    if (!plan || !selectedMeal) return;

    regenerateMealMutation.mutate({
      planId: plan.id,
      mealId: selectedMeal.id,
      note,
    });
  };

  const profile = profileQuery.data;
  const profileMembers = profile?.members ?? [];
  const profilePresets = profile?.presets ?? [];

  return loggedOut ? (
    <LoginPage />
  ) : (
    <div className="app-shell">
      <Header
        weekStart={currentPlanQuery.data?.weekStart}
        onCreatePlan={() => createPlanMutation.mutate()}
        creatingPlan={createPlanMutation.isPending}
        onLogout={() => {
          setLoggedOut(true);
          logoutMutation.mutate();
        }}
        loggingOut={logoutMutation.isPending}
      />

      <main className="app-main">
        <section className="profile-studio" aria-labelledby="profile-studio-title">
          <div className="profile-studio-copy">
            <span className="eyebrow">Familienprofil</span>
            <h1 id="profile-studio-title">{profile ? profile.householdName : 'Profil noch nicht eingerichtet'}</h1>
            <p>
              {profile
                ? 'Vorlieben, Alltag und Einschränkungen steuern die nächste Planung.'
                : 'Erfasse Haushalt, Personen und Essensregeln, damit die Planung direkt passt.'}
            </p>
            <div className="profile-chip-row" aria-label="Profilzusammenfassung">
              {profileMembers.length > 0 ? (
                profileMembers.map((member) => (
                  <span key={member.id} className="profile-chip">
                    {member.name}
                  </span>
                ))
              ) : (
                <span className="profile-chip profile-chip-muted">Keine Personen hinterlegt</span>
              )}
              {profilePresets.slice(0, 4).map((preset) => (
                <span key={preset} className="profile-chip profile-chip-accent">
                  {preset}
                </span>
              ))}
            </div>
          </div>

          <div className="profile-studio-actions">
            <div className="profile-stat">
              <span>{profileMembers.length}</span>
              <strong>Personen</strong>
            </div>
            <div className="profile-stat">
              <span>{profilePresets.length}</span>
              <strong>Presets</strong>
            </div>
            <Link to="/onboarding" className="button button-primary profile-cta">
              Profil bearbeiten
            </Link>
          </div>
        </section>

        <div className="workspace">
          <div className="workspace-main">
            <MealBoard
              days={currentPlanQuery.data?.days}
              selectedMealId={selectedMealId}
              onSelectMeal={setSelectedMeal}
            />
          </div>

          <div className="workspace-side">
            <ShoppingListPanel
              planId={currentPlanQuery.data?.id}
              shoppingList={shoppingListQuery.data ?? null}
              loading={shoppingListQuery.isLoading}
            />
            <MealInspector
              meal={selectedMeal}
              onRegenerate={handleRegenerate}
              isRegenerating={regenerateMealMutation.isPending}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
