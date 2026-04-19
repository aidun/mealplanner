import type { Member, Profile, ProfileFormState } from '../types';

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(values?: string[]) {
  return values?.join('\n') ?? '';
}

function objectToBlock(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join('\n');
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => String(entry))
      .join('\n');
  }

  return value == null ? '' : String(value);
}

export function profileToForm(profile?: Profile | null): ProfileFormState {
  return {
    householdName: profile?.householdName ?? '',
    members: joinLines(profile?.members.map(formatMemberLine)),
    servingsPerMeal: '',
    preferredCuisines: joinLines(profile?.presets),
    excludedIngredients: joinLines(
      profile?.members.flatMap((member) => splitLines(member.restrictions ?? '').map((entry) => `${member.name}: ${entry}`))
    ),
    cookingStyle: profile?.notes ?? '',
    mealPlanningRules: profile?.notes ?? '',
    breakfastPresets: objectToBlock(profile?.defaults?.breakfast),
    lunchPresets: objectToBlock(profile?.defaults?.lunch),
    dinnerPresets: objectToBlock(profile?.defaults?.dinner),
    snackPresets: objectToBlock(profile?.defaults?.snacks),
  };
}

export function formToProfile(state: ProfileFormState): Profile {
  return {
    householdName: state.householdName.trim(),
    members: splitLines(state.members).map((line, index) => parseMemberLine(line, index)),
    defaults: {
      breakfast: state.breakfastPresets.trim(),
      lunch: state.lunchPresets.trim(),
      dinner: state.dinnerPresets.trim(),
      snacks: state.snackPresets.trim(),
    },
    presets: splitLines(state.preferredCuisines),
    notes: [state.cookingStyle, state.mealPlanningRules, state.excludedIngredients]
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join('\n'),
  };
}

function parseMemberLine(line: string, index: number): Member {
  const [namePart, detailsPart = ''] = line.split(':', 2);
  const name = (namePart ?? '').trim();
  const details = detailsPart.trim();
  const caloriesMatch = details.match(/(\d{3,4})\s*(kcal|kalorien)?/i);
  return {
    id: slugify(name) || `person-${index + 1}`,
    name,
    caloriesTarget: caloriesMatch ? Number(caloriesMatch[1]) : undefined,
    likes: details,
  };
}

function formatMemberLine(member: Member) {
  const details = [member.likes, member.dislikes ? `Mag nicht: ${member.dislikes}` : '', member.restrictions]
    .filter(Boolean)
    .join('; ');
  return details ? `${member.name}: ${details}` : member.name;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
