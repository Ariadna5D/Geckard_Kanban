import api from './axios.instance';

export type CheckoutPlan = 'pro' | 'team';

interface CreateCheckoutSessionResponse {
  url: string;
}

export async function createCheckoutSessionRequest(
  plan: CheckoutPlan,
): Promise<CreateCheckoutSessionResponse> {
  const response = await api.post<CreateCheckoutSessionResponse>(
    '/billing/checkout-session',
    { plan },
  );
  return response.data;
}

export async function createCustomerPortalSessionRequest(): Promise<CreateCheckoutSessionResponse> {
  const response =
    await api.post<CreateCheckoutSessionResponse>('/billing/customer-portal');
  return response.data;
}
