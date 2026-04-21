import { describe, expect, it } from 'vitest';
import { formToProfile, profileToForm } from '../lib/profile-form';
import type { ProfileFormState } from '../types';

describe('profile form mapping', () => {
  it('keeps form-only planning fields separated in profile notes', () => {
    const form: ProfileFormState = {
      householdName: 'Familie Weber',
      members: [
        {
          id: 'anna',
          name: 'Anna',
          alias: 'Mama',
          role: 'Erwachsen',
          caloriesTarget: '',
          likes: '',
          dislikes: '',
          restrictions: '',
        },
        {
          id: 'ben',
          name: 'Ben',
          alias: '',
          role: 'Kind',
          caloriesTarget: '',
          likes: '',
          dislikes: '',
          restrictions: '',
        },
      ],
      mealPlanDays: [
        {
          day: 'monday',
          label: 'Montag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: false, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'tuesday',
          label: 'Dienstag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'wednesday',
          label: 'Mittwoch',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'thursday',
          label: 'Donnerstag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'friday',
          label: 'Freitag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'saturday',
          label: 'Samstag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
        {
          day: 'sunday',
          label: 'Sonntag',
          slots: [
            { slot: 'breakfast', label: 'Frühstück', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'lunch', label: 'Mittagessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'dinner', label: 'Abendessen', enabled: true, memberIds: ['anna', 'ben'] },
            { slot: 'snack', label: 'Snack', enabled: false, memberIds: ['ben'] },
          ],
        },
      ],
      servingsPerMeal: '4',
      preferredCuisines: 'Mediterran\nAsiatisch',
      excludedIngredients: 'Koriander\nSellerie',
      cookingStyle: 'Schnell und warm',
      mealPlanningRules: 'Wochentags unter 30 Minuten',
      breakfastPresets: 'Oats',
      lunchPresets: 'Bowl',
      dinnerPresets: 'Pasta',
      snackPresets: 'Obst',
    };

    const profile = formToProfile(form);
    const roundtrip = profileToForm(profile);

    expect(roundtrip.servingsPerMeal).toBe('4');
    expect(roundtrip.cookingStyle).toBe('Schnell und warm');
    expect(roundtrip.mealPlanningRules).toBe('Wochentags unter 30 Minuten');
    expect(roundtrip.excludedIngredients).toBe('Koriander\nSellerie');
    expect(roundtrip.cookingStyle).not.toContain('Wochentags unter 30 Minuten');
    expect(roundtrip.members[0]?.alias).toBe('Mama');
    expect(roundtrip.mealPlanDays.find((day) => day.day === 'monday')?.slots.find((slot) => slot.slot === 'lunch')?.enabled).toBe(false);
    expect(roundtrip.mealPlanDays.find((day) => day.day === 'monday')?.slots.find((slot) => slot.slot === 'breakfast')?.memberIds).toEqual(['anna']);
    expect(roundtrip.mealPlanDays.find((day) => day.day === 'tuesday')?.slots.find((slot) => slot.slot === 'lunch')?.memberIds).toEqual(['anna']);
  });
});
