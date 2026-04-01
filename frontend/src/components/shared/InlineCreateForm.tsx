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
  triggerClassName = "w-full text-left text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 p-2 rounded-md transition-colors flex items-center gap-1",
  formClassName = "p-2 bg-slate-100/50 rounded-lg border border-slate-200 shadow-sm"
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
        className="mb-2 bg-white text-sm h-9"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
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
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
        >
          <X size={16} />
        </Button>
      </div>
    </form>
  );
};