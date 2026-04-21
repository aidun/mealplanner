import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createFeedback } from '../api';
import { readableApiError } from '../lib/api-error';
import { MailIcon } from './icons';

const maxLength = 2000;

export function FeedbackWidget() {
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const trimmedMessage = message.trim();
  const count = trimmedMessage.length;

  const feedbackMutation = useMutation({
    mutationFn: ({ message, page }: { message: string; page: string }) => createFeedback(message, page),
    onSuccess: () => {
      setMessage('');
    },
  });

  const statusCopy = useMemo(() => {
    if (feedbackMutation.isSuccess) {
      return 'Feedback gespeichert. Ich kann das spaeter mit dir durchgehen.';
    }
    if (feedbackMutation.isError) {
      return readableApiError(feedbackMutation.error, 'Feedback konnte nicht gespeichert werden.');
    }
    return '';
  }, [feedbackMutation.error, feedbackMutation.isError, feedbackMutation.isSuccess]);

  return (
    <aside className={`feedback-widget${open ? ' feedback-widget-open' : ''}`} aria-label="Premium Feedback">
      <div className="feedback-widget-card">
        <button
          type="button"
          className="feedback-widget-toggle"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="feedback-widget-panel"
        >
          <span className="feedback-widget-toggle-copy">
            <MailIcon className="action-icon" />
            Direktes Feedback
          </span>
          <span className="feedback-widget-toggle-state">{open ? 'Schließen' : 'Öffnen'}</span>
        </button>
        {open ? (
          <div id="feedback-widget-panel" className="feedback-widget-panel">
            <p className="feedback-widget-copy">
              Schreib auf, was hakt oder was besser werden sollte. Ich kann das spaeter auslesen und mit dir bewerten.
            </p>
            <label className="field">
              <span className="sr-only">Feedback</span>
              <textarea
                className="input textarea feedback-widget-textarea"
                name="feedback"
                autoComplete="off"
                rows={5}
                maxLength={maxLength}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Schreib hier direkt aus dem laufenden Planungsflow."
              />
            </label>
            <div className="feedback-widget-footer">
              <span className="feedback-widget-counter">{count}/{maxLength}</span>
              <button
                type="button"
                className="button button-primary"
                onClick={() => feedbackMutation.mutate({ message: trimmedMessage, page: `${location.pathname}${location.search}` })}
                disabled={feedbackMutation.isPending || trimmedMessage === ''}
              >
                <MailIcon className="action-icon" />
                {feedbackMutation.isPending ? 'Wird gesendet' : 'Feedback senden'}
              </button>
            </div>
            {statusCopy ? (
              <p
                className={`feedback-widget-status${feedbackMutation.isError ? ' feedback-widget-status-error' : ' feedback-widget-status-success'}`}
                role={feedbackMutation.isError ? 'alert' : 'status'}
              >
                {statusCopy}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
