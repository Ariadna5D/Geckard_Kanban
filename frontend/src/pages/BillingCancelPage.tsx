import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function BillingCancelPage() {
  const navigate = useNavigate();

  return (
    <section className="space-y-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
        Pago cancelado
      </h1>
      <p className="text-sm text-surface-600 dark:text-surface-400">
        No se ha realizado ningun cargo. Puedes volver a intentarlo cuando
        quieras.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            navigate('/dashboard');
          }}
        >
          Volver al dashboard
        </Button>
        <Button
          onClick={() => {
            navigate('/billing/plans');
          }}
        >
          Ver planes
        </Button>
      </div>
    </section>
  );
}
