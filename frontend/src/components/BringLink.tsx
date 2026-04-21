import { useEffect, useMemo, useState } from 'react';
import { getBringExportUrl, type BringExportScope } from '../api';
import { BringIcon } from './icons';

interface BringLinkProps {
  planId?: string;
  scope?: BringExportScope;
  label: string;
  className?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}

export function BringLink({ planId, scope = {}, label, className, disabled, hideLabel = false }: BringLinkProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [url, setUrl] = useState('');
  const scopeKey = useMemo(() => `${scope.day ?? ''}|${scope.meal ?? ''}`, [scope.day, scope.meal]);
  const active = Boolean(planId && !disabled);

  useEffect(() => {
    let cancelled = false;
    setUrl('');
    if (!active || !planId) {
      setState('idle');
      return;
    }
    setState('loading');
    getBringExportUrl(planId, scope)
      .then((response) => {
        if (cancelled) return;
        const target = response?.pageUrl || response?.url;
        if (!target) throw new Error('missing bring export url');
        setUrl(target);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [active, planId, scopeKey]);

  const classes = className ?? 'button button-primary bring-export-button';

  return (
    <a
      className={classes}
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={state !== 'ready'}
      data-state={state}
      onClick={(event) => {
        if (state !== 'ready') event.preventDefault();
      }}
      aria-label={state === 'failed' ? 'Bring nicht verfügbar' : label}
      title={state === 'failed' ? 'Bring nicht verfügbar' : label}
    >
      <BringIcon className="action-icon" />
      <span className={hideLabel ? 'sr-only' : undefined}>{state === 'failed' ? 'Bring nicht verfügbar' : label}</span>
    </a>
  );
}
