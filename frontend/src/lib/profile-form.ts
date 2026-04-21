import type {
  MealPlanDayFormState,
  MealPlanSlotFormState,
  Member,
  MemberFormState,
  Profile,
  ProfileFormState,
} from '../types';

const SLOT_CONFIG: Array<{ slot: MealPlanSlotFormState['slot']; label: string; section: string }> = [
  { slot: 'breakfast', label: 'Frühstück', section: 'Teilnehmende Frühstück' },
  { slot: 'lunch', label: 'Mittagessen', section: 'Teilnehmende Mittagessen' },
  { slot: 'dinner', label: 'Abendessen', section: 'Teilnehmende Abendessen' },
  { slot: 'snack', label: 'Snack', section: 'Teilnehmende Snack' },
];

const WEEKDAY_CONFIG: Array<{ day: MealPlanDayFormState['day']; label: string }> = [
  { day: 'monday', label: 'Montag' },
  { day: 'tuesday', label: 'Dienstag' },
  { day: 'wednesday', label: 'Mittwoch' },
  { day: 'thursday', label: 'Donnerstag' },
  { day: 'friday', label: 'Freitag' },
  { day: 'saturday', label: 'Samstag' },
  { day: 'sunday', label: 'Sonntag' },
];

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

export function defaultMealPlanSlots(memberIds: string[] = []): MealPlanSlotFormState[] {
  return SLOT_CONFIG.map(({ slot, label }) => ({
    slot,
    label,
    enabled: slot !== 'snack',
    memberIds: [...memberIds],
  }));
}

export function defaultMealPlanDays(memberIds: string[] = []): MealPlanDayFormState[] {
  return WEEKDAY_CONFIG.map(({ day, label }) => ({
    day,
    label,
    slots: defaultMealPlanSlots(memberIds),
  }));
}

export function profileToForm(profile?: Profile | null): ProfileFormState {
  const noteSections = parseNoteSections(profile?.notes ?? '');
  const members = profile?.members?.length ? profile.members.map(memberToForm) : [emptyMember(0)];
  const memberIds = members.map((member) => member.id);
  const mealPlanDays = WEEKDAY_CONFIG.map(({ day, label }) => {
    const activeKey = `Aktive Mahlzeiten ${label}`;
    const activeSlots = parseLines(noteSections[activeKey] ?? noteSections['Aktive Mahlzeiten']).map(normalizeSlotLabel);
    return {
      day,
      label,
      slots: SLOT_CONFIG.map(({ slot, label: slotLabel, section }) => ({
        slot,
        label: slotLabel,
        enabled: activeSlots.length === 0 ? slot !== 'snack' : activeSlots.includes(slot),
        memberIds: parseParticipantIds(noteSections[`${section} ${label}`] ?? noteSections[section], members, memberIds),
      })),
    };
  });
  return {
    householdName: profile?.householdName ?? '',
    members,
    mealPlanDays,
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
  const mealPlanDays = state.mealPlanDays ?? defaultMealPlanDays(state.members.map((member) => member.id));
  const members = state.members
    .map((member, index) => formToMember(member, index))
    .filter((member) => member.name !== '');

  const noteSections: Record<string, string> = {
    'Standard-Portionen': state.servingsPerMeal,
    Kochstil: state.cookingStyle,
    Planungsregeln: state.mealPlanningRules,
    'Ausgeschlossene Zutaten': state.excludedIngredients,
  };

  for (const day of mealPlanDays) {
    noteSections[`Aktive Mahlzeiten ${day.label}`] = day.slots
      .filter((slot) => slot.enabled)
      .map((slot) => slot.label)
      .join('\n');
    for (const slot of SLOT_CONFIG) {
      noteSections[`${slot.section} ${day.label}`] = stringifyParticipants(day.slots, slot.slot, members);
    }
  }

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
    notes: formatNoteSections(noteSections),
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
  const knownTitles = [
    'Aktive Mahlzeiten',
    ...WEEKDAY_CONFIG.map(({ label }) => `Aktive Mahlzeiten ${label}`),
    ...WEEKDAY_CONFIG.flatMap(({ label }) => SLOT_CONFIG.map(({ section }) => `${section} ${label}`)),
    ...SLOT_CONFIG.map(({ section }) => section),
    'Standard-Portionen',
    'Kochstil',
    'Planungsregeln',
    'Ausgeschlossene Zutaten',
  ];
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

function parseLines(value?: string) {
  return (value ?? '')
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSlotLabel(value: string) {
  const key = value.trim().toLowerCase();
  switch (key) {
    case 'frühstück':
    case 'fruehstueck':
    case 'breakfast':
      return 'breakfast';
    case 'mittagessen':
    case 'lunch':
      return 'lunch';
    case 'abendessen':
    case 'dinner':
      return 'dinner';
    case 'snack':
    case 'snacks':
      return 'snack';
    default:
      return key as MealPlanSlotFormState['slot'];
  }
}

function parseParticipantIds(value: string | undefined, members: MemberFormState[], fallback: string[]) {
  const entries = parseLines(value);
  if (entries.length === 0) {
    return [...fallback];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const normalized = entry.trim().toLowerCase();
    const matched = members.find((member) => {
      return (
        member.id.toLowerCase() === normalized ||
        member.alias.trim().toLowerCase() === normalized ||
        member.name.trim().toLowerCase() === normalized
      );
    });
    if (matched && !out.includes(matched.id)) {
      out.push(matched.id);
    }
  }
  return out.length > 0 ? out : [...fallback];
}

function stringifyParticipants(slots: MealPlanSlotFormState[], slotName: MealPlanSlotFormState['slot'], members: Member[]) {
  const slot = slots.find((entry) => entry.slot === slotName);
  if (!slot) return '';
  const labels = slot.memberIds
    .map((memberId) => members.find((member) => member.id === memberId))
    .filter((member): member is Member => Boolean(member))
    .map((member) => member.alias || member.name);
  return labels.join('\n');
}

function syncMealPlanSlots(slots: MealPlanSlotFormState[], members: MemberFormState[]) {
  const memberIds = members.map((member) => member.id);
  if (slots.length === 0) {
    return defaultMealPlanSlots(memberIds);
  }
  return slots.map((slot) => ({
    ...slot,
    memberIds: (() => {
      const filtered = slot.memberIds.filter((memberId) => memberIds.includes(memberId));
      return filtered.length > 0 ? filtered : [...memberIds];
    })(),
  }));
}

export function syncMealPlanDays(days: MealPlanDayFormState[], members: MemberFormState[]) {
  const memberIds = members.map((member) => member.id);
  if (days.length === 0) {
    return defaultMealPlanDays(memberIds);
  }
  return days.map((day, index) => ({
    day: day.day || WEEKDAY_CONFIG[index]?.day || 'monday',
    label: day.label || WEEKDAY_CONFIG[index]?.label || 'Montag',
    slots: syncMealPlanSlots(day.slots, members),
  }));
}
