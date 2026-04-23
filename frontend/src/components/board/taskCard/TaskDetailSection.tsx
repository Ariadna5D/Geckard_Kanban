import { type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function TaskDetailSection({
  title,
  icon: Icon,
  defaultOpen = false,
  /** Contenido a la derecha del título (p. ej. icono de ayuda); no debe propagar el clic al acordeón. */
  titleAccessory,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  titleAccessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group rounded-lg border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
    >
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-surface-100/80 dark:hover:bg-surface-800/80">
        <CollapsibleTrigger
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm font-semibold text-surface-800 outline-none dark:text-surface-200"
        >
          <span className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <Icon
                className="size-4 shrink-0 text-primary-600 dark:text-primary-400"
                aria-hidden
              />
            ) : null}
            <span>{title}</span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-surface-500 transition-transform duration-200 group-data-[state=open]:rotate-180 dark:text-surface-400"
            aria-hidden
          />
        </CollapsibleTrigger>
        {titleAccessory ? <span className="inline-flex shrink-0">{titleAccessory}</span> : null}
      </div>
      <CollapsibleContent className="border-t border-surface-200 px-4 py-3 dark:border-surface-700">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
