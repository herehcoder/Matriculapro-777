import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequestOptions {
  headers?: HeadersInit;
  [key: string]: any;
}

export const apiRequest = async (
  method: RequestMethod, 
  endpoint: string, 
  data?: any, 
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
    ...options,
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, config);
  
  return response;
};

interface GetQueryFnOptions {
  on401?: 'throw' | 'returnNull';
}

export const getQueryFn = (options: GetQueryFnOptions = {}) => {
  return async ({ queryKey }: { queryKey: (string | number)[] }): Promise<any> => {
    const endpoint = queryKey[0] as string;
    
    try {
      const response = await apiRequest('GET', endpoint);
      
      if (response.status === 401 && options.on401 === 'returnNull') {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  };
};