import type { Ingredient, Meal } from '../types';

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  Gluten: ['weizen', 'mehl', 'brot', 'pasta', 'nudel', 'semmel', 'bulgur', 'couscous', 'hafer'],
  Milch: ['milch', 'sahne', 'butter', 'joghurt', 'kaese', 'mozzarella', 'parmesan', 'quark'],
  Ei: ['ei', 'eier', 'mayonnaise'],
  Erdnuss: ['erdnuss', 'peanut'],
  Nuesse: ['mandel', 'haselnuss', 'walnuss', 'cashew', 'pistazie', 'nuss'],
  Soja: ['soja', 'tofu', 'tempeh', 'edamame'],
  Fisch: ['lachs', 'thunfisch', 'kabeljau', 'forelle', 'fisch'],
  Krebstiere: ['garnele', 'shrimp', 'krabbe', 'hummer', 'krebs'],
  Sellerie: ['sellerie'],
  Senf: ['senf'],
  Sesam: ['sesam', 'tahin'],
};

export function detectCriticalAllergens(ingredients: Ingredient[]) {
  const haystack = ingredients
    .map((ingredient) => `${ingredient.name} ${ingredient.note ?? ''}`.toLowerCase())
    .join(' ');

  const detected: string[] = [];
  for (const [label, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword)) && !detected.includes(label)) {
      detected.push(label);
    }
  }
  return detected;
}

export function inferSelectionReason(meal: Meal) {
  const reasons: string[] = [];

  if (meal.meta?.favoriteReuse === 'direct') {
    reasons.push('Es wurde aus eurer gespeicherten Sammlung wieder aufgenommen.');
  } else if (meal.meta?.favoriteReuse === 'variant') {
    reasons.push('Es greift einen vorhandenen Favoriten auf und variiert ihn fuer diese Woche.');
  } else {
    reasons.push(baseReasonForSlot(meal.slot));
  }

  if (meal.tags.includes('schnell')) {
    reasons.push('Der Ablauf bleibt alltagstauglich und schnell.');
  }
  if (meal.tags.includes('vegetarisch')) {
    reasons.push('Die Woche behaelt damit eine leichte, gemuesebetonte Mahlzeit.');
  }
  if (meal.regenerationNote) {
    reasons.push(`Die letzte Anpassung beruecksichtigt: ${meal.regenerationNote}.`);
  }
  if (meal.meta?.nutritionSource === 'ingredients') {
    reasons.push('Die Naehrwerte wurden aus den Zutaten fuer dieses Rezept geschaetzt.');
  }

  return reasons.join(' ');
}

function baseReasonForSlot(slot: string) {
  switch (slot) {
    case 'breakfast':
      return 'Es passt als frueher, unkomplizierter Start in den Tag.';
    case 'lunch':
      return 'Es stuetzt die Mitte des Tages, ohne den Ablauf zu blockieren.';
    case 'dinner':
      return 'Es ist auf eine gemeinsame Abendmahlzeit fuer den Haushalt ausgerichtet.';
    case 'snack':
      return 'Es fuellt nur dort auf, wo der Wochenplan noch einen kleinen Puffer braucht.';
    default:
      return 'Es passt in den aktuellen Wochenrhythmus und ergaenzt die anderen Gerichte sinnvoll.';
  }
}
