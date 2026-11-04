'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';

type Tone = 'success' | 'error' | 'info';
type Notice = { id: number; message: string; tone: Tone };
type Prompt = { title: string; message: string; confirm?: string };
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
  const guide = useCallback((message: string, title = 'Cómo continuar') => {
    resolve.current?.(false);
    resolve.current = null;
    setPrompt({ title, message });
  }, []);
  const confirm = useCallback(
    (title: string, message: string, label = 'Confirmar') =>
      new Promise<boolean>((done) => {
        resolve.current?.(false);
        resolve.current = done;
        setPrompt({ title, message, confirm: label });
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
  return (
    <>
      {feedback.notice && (
        <Snackbar
          key={feedback.notice.id}
          notice={feedback.notice}
          onClose={feedback.dismiss}
        />
      )}
      {feedback.prompt && (
        <FeedbackDialog prompt={feedback.prompt} onClose={feedback.close} />
      )}
    </>
  );
}
function Snackbar({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = ref.current;
    element?.showPopover();
    return () => {
      if (element?.isConnected) element.hidePopover();
    };
  }, []);
  useEffect(() => {
    if (paused || notice.tone === 'error') return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [paused, notice.tone, onClose]);
  const style =
    notice.tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-900'
      : notice.tone === 'success'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
        : 'border-sky-blue bg-white text-navy';
  return (
    <div
      ref={ref}
      popover="manual"
      data-testid="snackbar"
      className={`pointer-events-none fixed inset-auto bottom-4 left-4 right-4 z-[100] m-0 w-auto max-w-xl rounded-xl border p-4 shadow-xl sm:left-auto sm:w-[28rem] ${style}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 font-bold">
          {notice.tone === 'error'
            ? '!'
            : notice.tone === 'success'
              ? '✓'
              : 'i'}
        </span>
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
          className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm"
        >
          {notice.message}
        </p>
        <button
          type="button"
          aria-label="Cerrar notificación"
          className="pointer-events-auto shrink-0 rounded px-2 text-xl focus-visible:outline-2"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
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
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-11/12 max-w-lg overflow-y-auto rounded-2xl border border-sky-blue bg-white p-6 text-navy shadow-2xl backdrop:bg-navy/60"
    >
      <h2 id={`${id}-title`} className="text-xl font-bold">
        {prompt.title}
      </h2>
      <p
        id={`${id}-message`}
        className="mt-4 whitespace-pre-wrap break-words text-sm leading-6"
      >
        {prompt.message}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {prompt.confirm && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onClose(false)}
          >
            Volver
          </Button>
        )}
        <Button type="button" onClick={() => onClose(!!prompt.confirm)}>
          {prompt.confirm ?? 'Entendido'}
        </Button>
      </div>
    </dialog>
  );
}
