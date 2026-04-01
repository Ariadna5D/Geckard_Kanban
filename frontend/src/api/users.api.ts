import api from './axios.instance';

export interface UserInviteSearchResult {
  id: string;
  username: string;
  email: string;
}

export const searchUsersForInviteRequest = async (
  q: string,
): Promise<UserInviteSearchResult[]> => {
  const response = await api.get<UserInviteSearchResult[]>('/users/search', {
    params: { q },
  });
  return response.data;
};
