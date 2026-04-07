import { Button } from '@/components/ui/button';
import { STORY_POINT_OPTIONS } from './taskCardConstants';

export function FibonacciButtonRow({
  selected,
  onSelect,
  disabled,
  showNone,
  onSelectNone,
  selectedFilledClass,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
  disabled?: boolean;
  showNone: boolean;
  onSelectNone?: () => void;
  selectedFilledClass?: string;
}) {
  function handleClearSelection() {
    onSelectNone?.();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showNone && (
        <Button
          type="button"
          size="sm"
          variant={selected === null ? 'default' : 'outline'}
          disabled={disabled}
          onClick={handleClearSelection}
        >
          Sin estimar
        </Button>
      )}
      {STORY_POINT_OPTIONS.map((value) => {
        const isSelected = selected === value;
        return (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            disabled={disabled}
            className={
              isSelected && selectedFilledClass ? selectedFilledClass : ''
            }
            onClick={onSelect.bind(null, value)}
          >
            {value}
          </Button>
        );
      })}
    </div>
  );
}
