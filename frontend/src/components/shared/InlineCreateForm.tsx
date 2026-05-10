import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InlineCreateFormProps {
  actionText: string;
  placeholder?: string;
  onSubmit: (value: string) => Promise<void> | void;
  triggerClassName?: string;
  formClassName?: string;
  inputClassName?: string;
  formExtra?: ReactNode;
}

// Muestra un formulario rapido para crear elementos
export const InlineCreateForm = ({
  actionText,
  placeholder = 'Título...',
  onSubmit,
  triggerClassName =
    'flex w-full items-center gap-1 rounded-md p-2 text-left text-base text-surface-600 transition-colors hover:bg-primary-500/10 hover:text-primary-700 dark:text-surface-400 dark:hover:bg-primary-500/15 dark:hover:text-primary-300',
  formClassName =
    'rounded-lg border border-surface-200 bg-surface-100 p-2 shadow-sm dark:border-surface-800 dark:bg-surface-950',
  inputClassName = 'mb-2 h-9 bg-surface-50 text-base dark:bg-surface-900',
  formExtra,
}: InlineCreateFormProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Al abrir el form ponemos foco para escribir sin click extra
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    // Enviamos texto limpio y cerramos el modo edicion
    await onSubmit(value.trim());
    setValue('');
    setIsEditing(false);
  };

  function handleStartEditing() {
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setValue('');
  }

  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
  }

  if (!isEditing) {
    return (
      <button type="button" onClick={handleStartEditing} className={triggerClassName}>
        <Plus size={16} />
        <span>{actionText}</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className={formClassName}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleValueChange}
        placeholder={placeholder}
        className={inputClassName}
      />
      {formExtra ? <div className="mb-2 text-base">{formExtra}</div> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 text-sm">
          Guardar
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={handleCancelEditing}
          className="size-8 p-0 text-surface-500 hover:bg-surface-200 hover:text-surface-800 dark:text-surface-400 dark:hover:bg-surface-700 dark:hover:text-surface-50"
        >
          <X size={16} />
        </Button>
      </div>
    </form>
  );
};