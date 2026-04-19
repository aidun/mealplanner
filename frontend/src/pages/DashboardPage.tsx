import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { MealBoard } from '../components/MealBoard';
import { MealInspector } from '../components/MealInspector';
import { ShoppingListPanel } from '../components/ShoppingListPanel';
import { createPlan, getCurrentPlan, getProfile, getShoppingList, regenerateMeal } from '../api';
import type { Meal } from '../types';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedMeal, setSelectedMeal] = useState<Meal | undefined>();

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

  return (
    <div className="app-shell">
      <Header
        weekStart={currentPlanQuery.data?.weekStart}
        onCreatePlan={() => createPlanMutation.mutate()}
        creatingPlan={createPlanMutation.isPending}
      />

      <main className="app-main">
        {!profileQuery.data ? (
          <section className="inline-banner">
            <div>
              <h2>Profil noch nicht eingerichtet</h2>
              <p>Erfasse Haushalt, Mitglieder und Standardvorlieben, damit die Planung gezielter läuft.</p>
            </div>
          </section>
        ) : (
          <section className="inline-banner inline-banner-ok">
            <div>
              <h2>{profileQuery.data.householdName}</h2>
              <p>{profileQuery.data.members.map((member) => member.name).join(' · ')}</p>
            </div>
          </section>
        )}

        <div className="workspace">
          <div className="workspace-main">
            <MealBoard
              days={currentPlanQuery.data?.days}
              selectedMealId={selectedMealId}
              onSelectMeal={setSelectedMeal}
            />
          </div>

          <div className="workspace-side">
            <MealInspector
              meal={selectedMeal}
              onRegenerate={handleRegenerate}
              isRegenerating={regenerateMealMutation.isPending}
            />
            <ShoppingListPanel shoppingList={shoppingListQuery.data ?? null} loading={shoppingListQuery.isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
