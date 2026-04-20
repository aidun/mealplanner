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
  const noteSections = parseNoteSections(profile?.notes ?? '');
  return {
    householdName: profile?.householdName ?? '',
    members: joinLines(profile?.members.map(formatMemberLine)),
    servingsPerMeal: noteSections['Standard-Portionen'] ?? '',
    preferredCuisines: joinLines(profile?.presets),
    excludedIngredients:
      noteSections['Ausgeschlossene Zutaten'] ??
      joinLines(profile?.members.flatMap((member) => splitLines(member.restrictions ?? '').map((entry) => `${member.name}: ${entry}`))),
    cookingStyle: noteSections['Kochstil'] ?? profile?.notes ?? '',
    mealPlanningRules: noteSections['Planungsregeln'] ?? '',
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
    notes: formatNoteSections({
      'Standard-Portionen': state.servingsPerMeal,
      Kochstil: state.cookingStyle,
      Planungsregeln: state.mealPlanningRules,
      'Ausgeschlossene Zutaten': state.excludedIngredients,
    }),
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

function formatNoteSections(sections: Record<string, string>) {
  return Object.entries(sections)
    .map(([title, value]) => [title, value.trim()] as const)
    .filter(([, value]) => value !== '')
    .map(([title, value]) => `${title}:\n${value}`)
    .join('\n\n');
}

function parseNoteSections(notes: string) {
  const sections: Record<string, string> = {};
  const knownTitles = ['Standard-Portionen', 'Kochstil', 'Planungsregeln', 'Ausgeschlossene Zutaten'];
  let currentTitle = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (currentTitle) {
      sections[currentTitle] = currentLines.join('\n').trim();
    }
  };

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const title = knownTitles.find((candidate) => line === `${candidate}:`);
    if (title) {
      flush();
      currentTitle = title;
      currentLines = [];
      continue;
    }
    if (currentTitle) {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}
