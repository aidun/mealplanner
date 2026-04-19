import type { Nutrition } from '../types';

export function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function formatWeekRange(weekStart?: string) {
  if (!weekStart) return 'Aktuelle Woche';
  const start = new Date(weekStart);
  if (Number.isNaN(start.getTime())) return 'Aktuelle Woche';
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function formatNutrition(nutrition?: Nutrition) {
  if (!nutrition) return '';
  const parts = [
    nutrition.calories ? `${nutrition.calories} kcal` : '',
    nutrition.proteinG ? `${nutrition.proteinG} g Protein` : '',
    nutrition.carbsG ? `${nutrition.carbsG} g KH` : '',
    nutrition.fatG ? `${nutrition.fatG} g Fett` : '',
  ].filter(Boolean);
  return parts.join(' • ');
}
