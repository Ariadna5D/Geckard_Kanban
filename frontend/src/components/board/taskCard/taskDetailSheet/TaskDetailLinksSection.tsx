import type { ChangeEvent, KeyboardEvent } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { linkDisplayHeading, isSafeHttpUrl } from '../taskCardHelpers';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

// Muestra y edita enlaces de la tarea
export function TaskDetailLinksSection({
  readOnly,
  formBaseId,
  editLinks,
  linkDraftUrl,
  linkDraftTitle,
  linkDraftError,
  onLinkDraftUrlChange,
  onLinkDraftTitleChange,
  onSubmitLinkDraft,
  onRemoveLinkRow,
}: {
  readOnly: boolean;
  formBaseId: string;
  editLinks: { url: string; title: string }[];
  linkDraftUrl: string;
  linkDraftTitle: string;
  linkDraftError?: string | null;
  onLinkDraftUrlChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLinkDraftTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitLinkDraft: () => void;
  onRemoveLinkRow: (index: number) => void;
}) {
  // Enter en cualquiera de los campos guarda el enlace
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onSubmitLinkDraft();
  };

  return (
    <TaskDetailSection title="Enlaces" icon={Link2}>
      <div className="space-y-3">
        {!readOnly && (
          <div className="space-y-3 rounded-lg border border-dashed border-surface-300 bg-surface-50/90 p-3 dark:border-surface-600 dark:bg-surface-900/40">
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              Nuevo enlace
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor={`${formBaseId}-link-draft-title`}
                    className="text-sm font-medium text-surface-700 dark:text-surface-300"
                  >
                    Título
                  </Label>
                  <TaskDetailInfoTip
                    label="Título del enlace"
                    side="right"
                    text="Opcional. Si lo dejas vacío, se usará la URL como texto visible del enlace."
                  />
                </div>
                <Input
                  id={`${formBaseId}-link-draft-title`}
                  value={linkDraftTitle}
                  onChange={onLinkDraftTitleChange}
                  onKeyDown={onEnter}
                  placeholder="Opcional, ej. Documentación"
                  className="h-10 bg-surface-50 text-base dark:bg-surface-950"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor={`${formBaseId}-link-draft-url`}
                    className="text-sm font-medium text-surface-700 dark:text-surface-300"
                  >
                    URL
                  </Label>
                  <TaskDetailInfoTip
                    label="Dirección del enlace"
                    side="right"
                    text="Copia y pega la dirección completa que ves en la barra del navegador al abrir la página. Debe empezar por https://."
                  />
                </div>
                <Input
                  id={`${formBaseId}-link-draft-url`}
                  value={linkDraftUrl}
                  onChange={onLinkDraftUrlChange}
                  onKeyDown={onEnter}
                  placeholder="URL"
                  className="h-10 bg-surface-50 text-base dark:bg-surface-950"
                  aria-invalid={Boolean(linkDraftError)}
                  aria-describedby={
                    linkDraftError
                      ? `${formBaseId}-link-draft-url-error`
                      : undefined
                  }
                />
                {linkDraftError && (
                  <p
                    id={`${formBaseId}-link-draft-url-error`}
                    className="text-sm text-danger dark:text-red-400"
                    role="alert"
                  >
                    {linkDraftError}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="default"
              className="w-full gap-2"
              onClick={onSubmitLinkDraft}
            >
              <Plus className="size-4" />
              Añadir enlace
            </Button>
          </div>
        )}
        {editLinks.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {readOnly ? 'Sin enlaces.' : 'Aún no hay enlaces en la lista.'}
          </p>
        ) : (
          <ul
            className="divide-y divide-surface-200 rounded-md border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-900"
            aria-label="Enlaces de la tarea"
          >
            {editLinks.map((item, index) => {
              // Prepara texto y estado del enlace para pintarlo
              const text = linkDisplayHeading(item.url, item.title);
              const isSafe = isSafeHttpUrl(item.url);
              const url = item.url.trim();
              const linkClass =
                'text-base font-medium text-primary-600 underline-offset-2 hover:underline dark:text-primary-400 dark:hover:text-primary-300';
              return (
                <li
                  key={`${item.url}-${index}`}
                  className="flex items-start gap-2 px-3 py-2.5 first:rounded-t-md last:rounded-b-md"
                >
                  <Link2
                    className="mt-0.5 size-4 shrink-0 text-surface-400 dark:text-surface-500"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    {isSafe && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {text}
                      </a>
                    )}
                    {!isSafe && (
                      <span className="text-base font-medium text-surface-800 dark:text-surface-200">
                        {text}
                      </span>
                    )}
                    <p className="mt-0.5 break-all text-sm text-surface-500 dark:text-surface-400">
                      {url}
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-danger hover:bg-danger/10"
                      onClick={() => onRemoveLinkRow(index)}
                      aria-label={`Quitar enlace «${text}»`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TaskDetailSection>
  );
}
