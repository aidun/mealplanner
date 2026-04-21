import type { Member, MemberFormState, Profile, ProfileFormState } from '../types';

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

export function emptyMember(index: number): MemberFormState {
  return {
    id: `person-${index + 1}`,
    name: '',
    alias: '',
    role: '',
    caloriesTarget: '',
    likes: '',
    dislikes: '',
    restrictions: '',
  };
}

export function profileToForm(profile?: Profile | null): ProfileFormState {
  const noteSections = parseNoteSections(profile?.notes ?? '');
  return {
    householdName: profile?.householdName ?? '',
    members: profile?.members?.length ? profile.members.map(memberToForm) : [emptyMember(0)],
    servingsPerMeal: noteSections['Standard-Portionen'] ?? '',
    preferredCuisines: joinLines(profile?.presets),
    excludedIngredients: noteSections['Ausgeschlossene Zutaten'] ?? '',
    cookingStyle: noteSections['Kochstil'] ?? profile?.notes ?? '',
    mealPlanningRules: noteSections['Planungsregeln'] ?? '',
    breakfastPresets: objectToBlock(profile?.defaults?.breakfast),
    lunchPresets: objectToBlock(profile?.defaults?.lunch),
    dinnerPresets: objectToBlock(profile?.defaults?.dinner),
    snackPresets: objectToBlock(profile?.defaults?.snacks),
  };
}

export function formToProfile(state: ProfileFormState): Profile {
  const members = state.members
    .map((member, index) => formToMember(member, index))
    .filter((member) => member.name !== '');

  return {
    householdName: state.householdName.trim(),
    members,
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

function memberToForm(member: Member): MemberFormState {
  return {
    id: member.id,
    name: member.name ?? '',
    alias: member.alias ?? '',
    role: member.role ?? '',
    caloriesTarget: member.caloriesTarget ? String(member.caloriesTarget) : '',
    likes: member.likes ?? '',
    dislikes: member.dislikes ?? '',
    restrictions: member.restrictions ?? '',
  };
}

function formToMember(member: MemberFormState, index: number): Member {
  const name = member.name.trim();
  return {
    id: slugify(member.id || member.alias || name) || `person-${index + 1}`,
    name,
    alias: member.alias.trim(),
    role: member.role.trim(),
    caloriesTarget: member.caloriesTarget.trim() ? Number(member.caloriesTarget) : undefined,
    likes: member.likes.trim(),
    dislikes: member.dislikes.trim(),
    restrictions: member.restrictions.trim(),
  };
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
