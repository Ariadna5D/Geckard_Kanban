import api from './axios.instance';

export type CheckoutPlan = 'pro' | 'team';

interface CreateCheckoutSessionResponse {
  url: string;
}

export async function createCheckoutSessionRequest(
  plan: CheckoutPlan,
): Promise<CreateCheckoutSessionResponse> {
  // Inicia checkout en backend y devuelve url de stripe
  const response = await api.post<CreateCheckoutSessionResponse>(
    '/billing/checkout-session',
    { plan },
  );
  return response.data;
}

export async function createCustomerPortalSessionRequest(): Promise<CreateCheckoutSessionResponse> {
  // Pide enlace al portal del cliente para gestionar suscripcion
  const response =
    await api.post<CreateCheckoutSessionResponse>('/billing/customer-portal');
  return response.data;
}
