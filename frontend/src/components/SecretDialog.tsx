import { FormEvent, useEffect, useState } from 'react';

interface SecretDialogProps {
  open: boolean;
  initialSecret: string;
  invalid: boolean;
  onSave: (secret: string) => void;
  onClose: () => void;
}

export function SecretDialog({ open, initialSecret, invalid, onSave, onClose }: SecretDialogProps) {
  const [secret, setSecret] = useState(initialSecret);

  useEffect(() => {
    if (open) {
      setSecret(initialSecret);
    }
  }, [initialSecret, open]);

  if (!open) {
    return null;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(secret);
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="secret-dialog" role="dialog" aria-modal="true" aria-labelledby="secret-title">
        <div>
          <p className="eyebrow">Privater Zugriff</p>
          <h2 id="secret-title">API-Secret eingeben</h2>
          <p>
            Der Testcluster ist geschützt. Das Secret wird nur in diesem Browser gespeichert und als
            <span className="inline-code"> X-API-Secret</span> an die API gesendet.
          </p>
        </div>

        {invalid ? (
          <p className="error-copy">Der letzte API-Aufruf wurde abgelehnt. Prüfe das Secret und speichere erneut.</p>
        ) : null}

        <form className="secret-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">API-Secret</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Secret aus api-secrets"
              autoFocus
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="button button-primary">
              Entsperren
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
