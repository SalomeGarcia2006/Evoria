'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

type Tone = 'success' | 'error' | 'info';
type Notice = { id: number; message: string; tone: Tone };
type Prompt = { title: string; message: string; confirm?: string; tone?: Tone };
export function useFeedback() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const sequence = useRef(0);
  const resolve = useRef<((value: boolean) => void) | null>(null);
  const notify = useCallback(
    (message: string, tone: Tone = 'success') =>
      setNotice({ id: ++sequence.current, message, tone }),
    [],
  );
  const guide = useCallback(
    (message: string, title = 'Cómo continuar', tone: Tone = 'info') => {
      resolve.current?.(false);
      resolve.current = null;
      setNotice(null);
      setPrompt({ title, message, tone });
    },
    [],
  );
  const confirm = useCallback(
    (title: string, message: string, label = 'Confirmar') =>
      new Promise<boolean>((done) => {
        resolve.current?.(false);
        resolve.current = done;
        setPrompt({ title, message, confirm: label, tone: 'info' });
      }),
    [],
  );
  const close = useCallback((accepted = false) => {
    setPrompt(null);
    resolve.current?.(accepted);
    resolve.current = null;
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);
  useEffect(
    () => () => {
      resolve.current?.(false);
    },
    [],
  );
  return { notify, guide, confirm, notice, prompt, close, dismiss };
}
export function FeedbackMessages({
  feedback,
}: {
  feedback: ReturnType<typeof useFeedback>;
}) {
  if (feedback.prompt)
    return <FeedbackDialog prompt={feedback.prompt} onClose={feedback.close} />;
  if (!feedback.notice) return null;
  return (
    <FeedbackDialog
      key={feedback.notice.id}
      prompt={{
        title:
          feedback.notice.tone === 'success'
            ? '¡Operación completada!'
            : feedback.notice.tone === 'error'
              ? 'No se pudo completar la operación'
              : 'Información',
        message: feedback.notice.message,
        tone: feedback.notice.tone,
      }}
      onClose={feedback.dismiss}
    />
  );
}
function FeedbackDialog({
  prompt,
  onClose,
}: {
  prompt: Prompt;
  onClose: (accepted?: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const success = prompt.tone === 'success';
  useEffect(() => {
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      data-testid="feedback-modal"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[25rem] overflow-y-auto border-0 bg-transparent p-0 text-navy backdrop:bg-navy/50 backdrop:backdrop-blur-sm"
    >
      <div
        className={`relative mx-auto ${success ? 'event-success-modal' : 'login-alert-modal'}`}
      >
        <button
          type="button"
          aria-label="Cerrar alerta"
          className="login-alert-close"
          onClick={() => onClose(false)}
        >
          ×
        </button>
        <div
          className={success ? 'event-success-icon' : 'login-alert-icon'}
          aria-hidden="true"
        >
          {success ? '✓' : prompt.tone === 'error' ? '⚠️' : 'i'}
        </div>
        <h2
          id={`${id}-title`}
          className={success ? 'event-success-title' : 'login-alert-kicker'}
        >
          {prompt.title}
        </h2>
        <p
          id={`${id}-message`}
          role={prompt.tone === 'error' ? 'alert' : 'status'}
          className={`${success ? 'event-success-message' : 'login-alert-message'} whitespace-pre-wrap break-words`}
        >
          {prompt.message}
        </p>
        {prompt.confirm ? (
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onClose(false)}
            >
              Volver
            </Button>
            <Button type="button" onClick={() => onClose(true)}>
              {prompt.confirm}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={success ? 'event-success-button' : 'login-alert-button'}
            onClick={() => onClose(false)}
          >
            Entendido
          </button>
        )}
      </div>
    </dialog>
  );
}
