import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Gift, UsersRound, Zap } from 'lucide-react';
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

const PLAN_CARDS: PlanCardInfo[] = [
  {
    id: 'free',
    title: 'Free',
    price: '0 EUR / mes',
    description: 'Para arrancar y organizar trabajo sin coste.',
    features: [
      'Tableros, columnas y tarjetas ilimitadas',
      'Gestion de sprint basica',
      'Hasta 10 colaboradores',
    ],
    ctaLabel: 'Plan gratis',
  },
  {
    id: 'pro',
    title: 'Pro',
    price: '6 EUR / mes',
    description: 'Ideal para la mayoria de equipos que estan creciendo.',
    features: [
      'Todo lo del plan Free',
      'Colaboradores ilimitados',
      'Resumen de sprint con graficos',
    ],
    ctaLabel: 'Comprar Pro',
    isPopular: true,
  },
  {
    id: 'team',
    title: 'Team',
    price: '20 EUR / mes',
    description: 'Para equipos que necesitan mas visibilidad y analitica.',
    features: [
      'Todo lo del plan Pro',
      'Estadisticas por usuario',
      'Mejor seguimiento de equipo',
    ],
    ctaLabel: 'Comprar Team',
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

  async function handleCheckout(plan: CheckoutPlan) {
    setErrorMessage('');
    setLoadingPlan(plan);
    try {
      const response = await createCheckoutSessionRequest(plan);
      window.location.href = response.url;
    } catch (error) {
      setErrorMessage('No se pudo iniciar el pago. Intentalo de nuevo.');
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
          Recomendado: Pro (mejor equilibrio para la mayoria de casos).
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
                'group relative flex min-h-[21rem] flex-col rounded-xl border p-6 shadow-sm transition-all duration-300 ease-out dark:bg-surface-900 sm:min-h-[22rem] md:min-h-[26rem] md:p-8 lg:min-h-[28rem] motion-reduce:transition-colors motion-reduce:duration-200 ' +
                (isPopularPlan
                  ? 'border-primary-500 bg-primary-500/5 ring-2 ring-primary-500/30 hover:shadow-xl hover:ring-primary-500/50 md:-translate-y-1 md:hover:-translate-y-2 motion-reduce:md:translate-y-0 motion-reduce:md:hover:translate-y-0'
                  : 'border-surface-200 bg-surface-50 hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-lg dark:border-surface-700 dark:hover:border-primary-500/35 motion-reduce:hover:translate-y-0')
              }
            >
              {isPopularPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                  Mas popular
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
                className="mt-8 w-full transition-[transform,box-shadow] duration-200 ease-out hover:enabled:shadow-md hover:enabled:brightness-[1.03] active:enabled:scale-[0.99] motion-reduce:hover:enabled:brightness-100 motion-reduce:active:enabled:scale-100 md:mt-10"
                onClick={() => {
                  if (plan.id !== 'free') {
                    void handleCheckout(plan.id);
                  }
                }}
                disabled={disabled}
              >
                {loadingPlan === plan.id && plan.id !== 'free'
                  ? 'Redirigiendo...'
                  : isCurrentPlan
                    ? 'Plan actual'
                    : plan.id === 'free'
                      ? plan.ctaLabel
                      : plan.ctaLabel}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
