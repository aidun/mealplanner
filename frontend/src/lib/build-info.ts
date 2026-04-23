const rawDeployedAt = import.meta.env.VITE_DEPLOYED_AT?.trim() ?? '';
const rawTimezone = import.meta.env.VITE_DEPLOY_TIMEZONE?.trim() ?? 'UTC';
const rawBuildSha = import.meta.env.VITE_BUILD_SHA?.trim() ?? '';

export function getBuildInfo() {
  const deployedAt = parseDeployedAt(rawDeployedAt);

  return {
    buildSha: rawBuildSha || 'lokal',
    deployedAt,
    deployedAtLabel: deployedAt ? formatDeployDate(deployedAt, rawTimezone) : 'Lokaler Build',
    timezone: deployedAt ? rawTimezone : 'lokal',
  };
}

function parseDeployedAt(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDeployDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(value);
}
