import { ApiError } from '../api';

export function readableApiError(error: unknown, fallback = 'Das hat gerade nicht geklappt. Bitte versuche es erneut.') {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.message) as { error?: string; requestId?: string };
      if (parsed.error) {
        if (parsed.error === 'Das hat gerade nicht geklappt. Bitte versuche es erneut.') {
          return fallback;
        }
        return parsed.error;
      }
    } catch {
      return error.message || fallback;
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
