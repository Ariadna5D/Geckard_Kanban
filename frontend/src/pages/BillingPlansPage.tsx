import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Gift, UsersRound, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CheckoutPlan,
  createCheckoutSessionRequest,
} from '@/api/billing.api';
import { useAuthStore } from '@/store/useAuthStore';

interface PlanCardInfo {
  id: 'free' | CheckoutPlan;
  title: string;
  price: string;
  description: string;
  features: string[];
  ctaLabel: string;
  isPopular?: boolean;
}

type PlanKey = PlanCardInfo['id'];

interface PlanComparisonRow {
  label: string;
  values: Record<PlanKey, boolean | string>;
}

const PLAN_CARDS: PlanCardInfo[] = [
  {
    id: 'free',
    title: 'Free',
    price: '0 EUR / mes',
    description: 'Para personas y equipos pequeños que quieren avanzar sin coste.',
    features: [
      'Kanban completo con tareas y columnas',
      'Flujo completo de sprint (iniciar, editar, cerrar y cancelar)',
      'Resumen básico al cerrar sprint',
      'Hasta 10 colaboradores',
      'Hasta 4 sprints cerrados por tablero',
    ],
    ctaLabel: 'Empezar gratis',
  },
  {
    id: 'pro',
    title: 'Pro',
    price: '6 EUR / mes',
    description: 'Ideal para equipos que quieren escalar colaboración y visibilidad.',
    features: [
      'Todo lo del plan Free',
      'Colaboradores ilimitados',
      'Dashboard completo del sprint cerrado',
      'Hasta 10 sprints cerrados por tablero',
    ],
    ctaLabel: 'Pasar a Pro',
    isPopular: true,
  },
  {
    id: 'team',
    title: 'Team',
    price: '20 EUR / mes',
    description: 'Para equipos en crecimiento que necesitan continuidad sin límites.',
    features: [
      'Todo lo del plan Pro',
      'Sprints cerrados ilimitados por tablero',
      'Pensado para equipos con más ciclos de entrega',
    ],
    ctaLabel: 'Pasar a Team',
  },
];

const PLAN_COMPARISON_ROWS: PlanComparisonRow[] = [
  {
    label: 'Kanban completo (tableros, columnas y tarjetas)',
    values: { free: true, pro: true, team: true },
  },
  {
    label: 'Flujo completo de sprint (iniciar, editar, cerrar, cancelar)',
    values: { free: true, pro: true, team: true },
  },
  {
    label: 'Resumen básico de cierre de sprint',
    values: { free: true, pro: true, team: true },
  },
  {
    label: 'Dashboard completo de sprint cerrado (gráficos)',
    values: { free: false, pro: true, team: true },
  },
  {
    label: 'Colaboradores por tablero',
    values: { free: 'Hasta 10', pro: 'Ilimitados', team: 'Ilimitados' },
  },
  {
    label: 'Sprints cerrados guardados por tablero',
    values: { free: 'Hasta 4', pro: 'Hasta 10', team: 'Ilimitados' },
  },
  {
    label: 'Historial de actividad',
    values: { free: 'Corto', pro: 'Ampliado', team: 'Completo' },
  },
];

const PLAN_TITLE_ICONS: Record<PlanCardInfo['id'], LucideIcon> = {
  free: Gift,
  pro: Zap,
  team: UsersRound,
};

export function BillingPlansPage() {
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Cargamos usuario para saber plan actual antes de mostrar botones
    void fetchUser();
  }, [fetchUser]);

  function normalizePlanForComparison(
    currentPlan: string | undefined,
  ): 'free' | 'pro' | 'team' {
    if (currentPlan === 'pro' || currentPlan === 'team') {
      return currentPlan;
    }
    return 'free';
  }

  function canBuyPlan(targetPlan: 'free' | CheckoutPlan): boolean {
    // Reglas simples para evitar comprar plan repetido o bajar desde aqui
    if (targetPlan === 'free') {
      return false;
    }
    const currentPlan = normalizePlanForComparison(user?.userPlan);
    if (currentPlan === 'team') {
      return false;
    }
    if (currentPlan === 'pro' && targetPlan === 'pro') {
      return false;
    }
    return true;
  }

  function renderComparisonCell(value: boolean | string) {
    // En tabla mostramos check x o texto segun tipo de valor
    if (typeof value === 'boolean') {
      return value ? (
        <span
          className="inline-flex items-center justify-center font-medium text-primary-700 dark:text-primary-300"
          aria-label="Incluido"
          title="Incluido"
        >
          <Check className="size-4" />
        </span>
      ) : (
        <span
          className="inline-flex items-center justify-center font-medium text-surface-500 dark:text-surface-400"
          aria-label="No incluido"
          title="No incluido"
        >
          <X className="size-4" />
        </span>
      );
    }
    return <span className="font-medium">{value}</span>;
  }

  function checkoutButtonText(
    isCurrentPlan: boolean,
    planId: PlanCardInfo['id'],
    loadingCurrentPlan: CheckoutPlan | null,
    ctaLabel: string,
  ): string {
    if (loadingCurrentPlan === planId && planId !== 'free') {
      return 'Abriendo pago...';
    }
    if (isCurrentPlan) {
      return 'Plan actual';
    }
    return ctaLabel;
  }

  async function handleCheckout(plan: CheckoutPlan) {
    setErrorMessage('');
    setLoadingPlan(plan);
    try {
      // Pedimos url de checkout y redirigimos a Stripe
      const response = await createCheckoutSessionRequest(plan);
      window.location.href = response.url;
    } catch (error) {
      setErrorMessage('No se pudo iniciar el pago. Inténtalo de nuevo.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:px-6 md:space-y-14 md:px-10 md:py-20 lg:py-24">
      <header className="space-y-2 md:space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-surface-900 dark:text-surface-100 md:text-3xl">
          Planes
        </h1>
        <p className="text-sm text-surface-600 dark:text-surface-400 md:text-base">
          Tu plan actual es{' '}
          <span className="font-medium capitalize">
            {normalizePlanForComparison(user?.userPlan)}
          </span>
          .
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400 md:text-sm">
          Elige el plan según el tamaño de tu equipo y el historial que quieras conservar.
        </p>
      </header>

      {errorMessage !== '' ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 pb-4 md:grid-cols-3 md:gap-8 md:pb-8">
        {PLAN_CARDS.map((plan) => {
          const disabled = !canBuyPlan(plan.id) || loadingPlan !== null;
          const currentPlan = normalizePlanForComparison(user?.userPlan);
          const isCurrentPlan = currentPlan === plan.id;
          const isPopularPlan = plan.isPopular === true;
          const TitleIcon = PLAN_TITLE_ICONS[plan.id];
          return (
            <article
              key={plan.id}
              className={
                'group relative flex min-h-80 flex-col rounded-xl border p-6 shadow-sm transition-all duration-300 ease-out dark:bg-surface-900 sm:min-h-88 md:min-h-96 md:p-8 motion-reduce:transition-colors motion-reduce:duration-200 ' +
                (isPopularPlan
                  ? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/30 hover:shadow-xl hover:ring-primary-500/50 md:-translate-y-1 md:hover:-translate-y-2 motion-reduce:md:translate-y-0 motion-reduce:md:hover:translate-y-0'
                  : 'border-surface-200 bg-surface-50 hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-lg dark:border-surface-700 dark:hover:border-primary-500/35 motion-reduce:hover:translate-y-0')
              }
            >
              {/* Badge visual para destacar plan recomendado */}
              {isPopularPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                  Más popular
                </div>
              ) : null}

              <h2 className="flex items-center gap-3 text-xl font-semibold text-surface-900 transition-colors duration-300 group-hover:text-primary-800 dark:text-surface-100 dark:group-hover:text-primary-300">
                <span
                  className={
                    'flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-md motion-reduce:group-hover:scale-100 ' +
                    (isPopularPlan
                      ? 'border-primary-400/40 bg-primary-500/15 text-primary-700 group-hover:border-primary-500/55 group-hover:bg-primary-500/25 dark:border-primary-500/30 dark:bg-primary-500/20 dark:text-primary-300 dark:group-hover:bg-primary-500/30'
                      : 'border-surface-200 bg-white text-surface-700 group-hover:border-primary-400/50 group-hover:text-primary-700 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200 dark:group-hover:border-primary-500/40 dark:group-hover:text-primary-400')
                  }
                  aria-hidden
                >
                  <TitleIcon
                    className="size-5 transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100"
                    strokeWidth={2}
                  />
                </span>
                <span className="leading-tight">{plan.title}</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-surface-600 dark:text-surface-400 md:mt-4">
                {plan.description}
              </p>
              <p className="mt-4 text-lg font-medium text-primary-700 transition-colors duration-300 group-hover:text-primary-800 dark:text-primary-400 dark:group-hover:text-primary-300 md:mt-5">
                {plan.price}
              </p>

              <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-surface-700 dark:text-surface-300 md:mt-8 md:space-y-3.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary-600 transition-colors duration-300 group-hover:text-primary-700 dark:text-primary-400 dark:group-hover:text-primary-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-8 w-full transition duration-200 ease-out hover:enabled:shadow-md hover:enabled:brightness-105 active:enabled:scale-95 motion-reduce:hover:enabled:brightness-100 motion-reduce:active:enabled:scale-100 md:mt-10"
                onClick={() => {
                  if (plan.id !== 'free') {
                    // Solo pro y team lanzan checkout
                    void handleCheckout(plan.id);
                  }
                }}
                disabled={disabled}
              >
                {checkoutButtonText(
                  isCurrentPlan,
                  plan.id,
                  loadingPlan,
                  plan.ctaLabel,
                )}
              </Button>
            </article>
          );
        })}
      </div>

      <section className="space-y-4 pb-8">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 md:text-xl">
            Comparativa detallada
          </h2>
          <p className="text-xs text-surface-500 dark:text-surface-400 md:text-sm">
            Los límites de sprints cerrados aplican al historial por tablero y no incluyen el sprint activo.
          </p>
        </header>

        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900">
          <table className="min-w-screen-sm w-full text-sm">
            <thead className="bg-surface-100 dark:bg-surface-800/80">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-200">
                  Característica
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-200">
                  Free
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-200">
                  Pro
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-200">
                  Team
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.label}
                  className="border-t border-surface-200 dark:border-surface-700"
                >
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                    {renderComparisonCell(row.values.free)}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                    {renderComparisonCell(row.values.pro)}
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                    {renderComparisonCell(row.values.team)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
