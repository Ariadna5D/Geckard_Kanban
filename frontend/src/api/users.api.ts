import api from './axios.instance';

export interface UserInviteSearchResult {
  id: string;
  username: string;
  email: string;
}

export const searchUsersForInviteRequest = async (
  queryText: string,
): Promise<UserInviteSearchResult[]> => {
  // Busca usuarios para invitar sin traer lista completa
  const response = await api.get<UserInviteSearchResult[]>('/users/search', {
    params: { text: queryText },
  });
  return response.data;
};
