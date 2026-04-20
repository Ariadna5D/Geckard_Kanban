import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

export function BillingSuccessPage() {
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const user = useAuthStore((state) => state.user);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function refreshUserAfterPayment() {
      try {
        await fetchUser();
      } finally {
        if (isMounted) {
          setIsRefreshing(false);
        }
      }
    }

    void refreshUserAfterPayment();

    return () => {
      isMounted = false;
    };
  }, [fetchUser]);

  return (
    <section className="space-y-4 p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
        Pago completado
      </h1>
      {isRefreshing ? (
        <p className="text-sm text-surface-600 dark:text-surface-400">
          Estamos actualizando tu plan...
        </p>
      ) : (
        <p className="text-sm text-surface-600 dark:text-surface-400">
          Tu plan actual es{' '}
          <span className="font-medium capitalize">
            {user?.userPlan ?? 'free'}
          </span>
          .
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            navigate('/billing/plans');
          }}
        >
          Ver planes
        </Button>
        <Button
          onClick={() => {
            navigate('/dashboard');
          }}
        >
          Ir al dashboard
        </Button>
      </div>
    </section>
  );
}
