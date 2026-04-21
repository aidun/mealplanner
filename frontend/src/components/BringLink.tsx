import { useEffect, useMemo, useState } from 'react';
import { getBringExportUrl, type BringExportScope } from '../api';

interface BringLinkProps {
  planId?: string;
  scope?: BringExportScope;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function BringLink({ planId, scope = {}, label, className, disabled }: BringLinkProps) {
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
        if (!response?.url) throw new Error('missing bring export url');
        setUrl(response.url);
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
  const text = state === 'loading' ? 'Bring wird vorbereitet' : label;

  return (
    <a
      className={classes}
      href={url || undefined}
      aria-disabled={state !== 'ready'}
      data-state={state}
      onClick={(event) => {
        if (state !== 'ready') event.preventDefault();
      }}
    >
      {state === 'failed' ? 'Bring nicht verfügbar' : text}
    </a>
  );
}
