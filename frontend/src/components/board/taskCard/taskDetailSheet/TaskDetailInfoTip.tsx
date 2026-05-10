import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TaskDetailInfoTipProps = {
  text: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
};

// Muestra una ayuda breve en tooltip para el usuario
export function TaskDetailInfoTip({
  text,
  label = "Más información",
  className,
  iconClassName,
  side = "top",
}: TaskDetailInfoTipProps) {
  // Prepara clases del boton y del icono
  let buttonClassName =
    "inline-flex shrink-0 cursor-help rounded-sm border border-transparent bg-transparent p-1 text-surface-500 hover:bg-surface-200/70 hover:text-surface-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:text-surface-400 dark:hover:bg-surface-800/80 dark:hover:text-surface-200";
  if (className) {
    buttonClassName = `${buttonClassName} ${className}`;
  }

  let iconClass = "pointer-events-none size-5";
  if (iconClassName) {
    iconClass = `${iconClass} ${iconClassName}`;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={buttonClassName}
          aria-label={label}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Info className={iconClass} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-left text-base leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
