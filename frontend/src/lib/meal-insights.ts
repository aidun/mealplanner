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
    reasons.push('Es nimmt einen vorhandenen Favoriten auf und variiert ihn für diese Woche.');
  } else {
    reasons.push(baseReasonForSlot(meal.slot));
  }

  if (meal.tags.includes('schnell')) {
    reasons.push('Es hält den Ablauf unter der Woche leicht.');
  }
  if (meal.tags.includes('vegetarisch')) {
    reasons.push('So bleibt die Woche an mindestens einer Stelle leicht und gemüsebetont.');
  }
  if (meal.regenerationNote) {
    reasons.push(`Berücksichtigt wurde zuletzt: ${meal.regenerationNote}.`);
  }
  if (meal.meta?.nutritionSource === 'ingredients') {
    reasons.push('Die Nährwerte sind dafür aus den Zutaten geschätzt.');
  }

  return reasons.join(' ');
}

function baseReasonForSlot(slot: string) {
  switch (slot) {
    case 'breakfast':
      return 'Es passt als ruhiger, unkomplizierter Start in den Tag.';
    case 'lunch':
      return 'Es hält die Mitte des Tages in Bewegung, ohne alles aufzuhalten.';
    case 'dinner':
      return 'Es trägt den gemeinsamen Abend für euren Haushalt.';
    case 'snack':
      return 'Es füllt die Woche dort auf, wo noch ein kleiner Puffer gut tut.';
    default:
      return 'Es passt in die aktuelle Woche und ergänzt die anderen Gerichte sinnvoll.';
  }
}
