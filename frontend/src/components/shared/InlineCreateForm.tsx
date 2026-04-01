import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InlineCreateFormProps {
  actionText: string;
  placeholder?: string;
  onSubmit: (value: string) => Promise<void> | void;
  // Permite sobreescribir estilos según dónde lo uses
  triggerClassName?: string; 
  formClassName?: string;
}

export const InlineCreateForm = ({ 
  actionText, 
  placeholder = "Title...", 
  onSubmit,
  triggerClassName = "flex w-full items-center gap-1 rounded-md p-2 text-left text-sm text-surface-600 transition-colors hover:bg-primary-500/10 hover:text-primary-700 dark:text-surface-400 dark:hover:bg-primary-500/15 dark:hover:text-primary-300",
  formClassName = "rounded-lg border border-surface-200 bg-surface-100 p-2 shadow-sm dark:border-surface-800 dark:bg-surface-950"
}: InlineCreateFormProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus al hacer clic en el botón fantasma
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    
    await onSubmit(value.trim());
    setValue('');
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className={triggerClassName}>
        <Plus size={16} />
        <span>{actionText}</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="mb-2 h-9 bg-surface-50 text-sm dark:bg-surface-900"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 text-xs">
          Save
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={() => { 
            setIsEditing(false); 
            setValue(''); 
          }} 
          className="size-8 p-0 text-surface-500 hover:bg-surface-200 hover:text-surface-800 dark:text-surface-400 dark:hover:bg-surface-700 dark:hover:text-surface-50"
        >
          <X size={16} />
        </Button>
      </div>
    </form>
  );
};