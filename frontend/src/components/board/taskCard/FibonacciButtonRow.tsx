import { Button } from '@/components/ui/button';
import { STORY_POINT_OPTIONS } from './taskCardConstants';

export function FibonacciButtonRow({
  selected,
  onSelect,
  disabled,
  onClear,
  selectedFilledClass,
  unselectedClass,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
  disabled?: boolean;
  /** Si el usuario pulsa de nuevo la fibonacci ya elegida, se quita el voto */
  onClear?: () => void;
  selectedFilledClass?: string;
  unselectedClass?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STORY_POINT_OPTIONS.map((item) => {
        const isSelected = selected === item;
        let buttonClassName =
          'border-surface-300 bg-surface-50 text-surface-700 hover:border-violet-400/70 hover:bg-violet-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-violet-500/55 dark:hover:bg-violet-500/10';
        if (unselectedClass) {
          buttonClassName = unselectedClass;
        }
        if (isSelected) {
          buttonClassName =
            selectedFilledClass ??
            'border-violet-700 bg-violet-600 text-white shadow-md ring-2 ring-violet-500/40 hover:bg-violet-700 dark:border-violet-300 dark:bg-violet-500 dark:ring-violet-300/30 dark:hover:bg-violet-400';
        }
        return (
          <Button
            key={item}
            type="button"
            size="xs"
            variant={isSelected ? 'default' : 'outline'}
            disabled={disabled}
            className={`h-8 min-w-9 shrink-0 px-2.5 text-sm ${buttonClassName}`}
            onClick={() => {
              if (isSelected) {
                onClear?.();
                return;
              }
              onSelect(item);
            }}
          >
            {item}
          </Button>
        );
      })}
    </div>
  );
}
