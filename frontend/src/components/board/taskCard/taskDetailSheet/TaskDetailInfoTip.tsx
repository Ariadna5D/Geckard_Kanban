import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TaskDetailInfoTipProps = {
  /** Contenido del tooltip (frase o párrafo corto). */
  text: string;
  /** Etiqueta accesible; por defecto «Más información». */
  label?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Ayuda contextual: solo tooltip (shadcn/Radix), sin acción al pulsar.
 * Evita `role="button"` + `.click()` que propagaban eventos raros (p. ej. con Sheet no modal).
 */
export function TaskDetailInfoTip({
  text,
  label = "Más información",
  className,
  iconClassName,
  side = "top",
}: TaskDetailInfoTipProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 cursor-help rounded-sm border border-transparent bg-transparent p-0.5 text-surface-500 hover:bg-surface-200/70 hover:text-surface-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:text-surface-400 dark:hover:bg-surface-800/80 dark:hover:text-surface-200",
            className,
          )}
          aria-label={label}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Info
            className={cn("pointer-events-none size-3.5", iconClassName)}
            aria-hidden
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-left">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
