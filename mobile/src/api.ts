import Constants from 'expo-constants';

import type { AssetColor, AssetIcon } from './categories';

export type TxType = 'income' | 'expense';

export type Asset = {
  id: number;
  name: string;
  icon: AssetIcon;
  color: AssetColor;
  balance: number; // kopecks
  transactions_count: number;
  created_at: string;
};

export type Transaction = {
  id: number;
  asset_id: number;
  asset_name: string;
  type: TxType;
  amount: number; // kopecks, always positive
  category: string | null;
  comment: string;
  is_initial: boolean;
  occurred_at: string;
  created_at: string;
};

export type Summary = {
  total_balance: number;
  assets_count: number;
  income: number;
  expense: number;
};

export type CategoryStats = {
  total: number;
  items: { category: string | null; amount: number }[];
};

export type Category = {
  id: string;
  type: TxType;
  name: string;
  icon: string;
  color: string;
  transactions_count: number;
};

/** What the user can change; the type is set once, on create. */
export type CategoryInput = { name: string; icon: string; color: string };

export type User = { id: number; email: string; created_at: string };

export type AuthResponse = { token: string; user: User };

export type Range = { from?: string; to?: string };

export type NewAsset = { name: string; icon: AssetIcon; color: AssetColor; initial_balance: number };

export type NewTransaction = {
  asset_id: number;
  type: TxType;
  amount: number;
  category: string;
  comment: string;
  occurred_at: string;
};

export type TransactionQuery = Range & {
  asset_id?: number;
  type?: TxType;
  category?: string;
  limit?: number;
};

/**
 * API base URL. Set EXPO_PUBLIC_API_URL to override; otherwise in development
 * the app talks to port 8080 on the machine that runs Metro, which works both
 * in the simulator and on a phone in the same Wi-Fi network.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8080`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// The session token is kept here by the auth provider (src/auth.tsx) and
// sent with every request.
let sessionToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

/** Called when the server rejects the token, so the app can sign out. */
export function setOnSessionExpired(fn: (() => void) | null) {
  onSessionExpired = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, `Нет связи с сервером (${API_URL})`);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && sessionToken && !path.startsWith('/api/auth/login')) onSessionExpired?.();
    throw new ApiError(res.status, body?.error ?? `Ошибка сервера (${res.status})`, body?.fields ?? {});
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),

  summary: (r: Range) => request<Summary>(`/api/summary${query(r)}`),
  categoryStats: (r: Range, type: TxType) => request<CategoryStats>(`/api/stats/categories${query({ ...r, type })}`),

  assets: () => request<Asset[]>('/api/assets'),
  asset: (id: number) => request<Asset>(`/api/assets/${id}`),
  createAsset: (input: NewAsset) => request<Asset>('/api/assets', { method: 'POST', body: JSON.stringify(input) }),
  deleteAsset: (id: number) => request<void>(`/api/assets/${id}`, { method: 'DELETE' }),

  categories: () => request<Category[]>('/api/categories'),
  createCategory: (type: TxType, input: CategoryInput) =>
    request<Category>('/api/categories', { method: 'POST', body: JSON.stringify({ type, ...input }) }),
  updateCategory: (id: string, input: CategoryInput) =>
    request<Category>(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCategory: (id: string) => request<void>(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  transactions: (q: TransactionQuery) => request<Transaction[]>(`/api/transactions${query(q)}`),
  createTransaction: (input: NewTransaction) =>
    request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(input) }),
  deleteTransaction: (id: number) => request<void>(`/api/transactions/${id}`, { method: 'DELETE' }),
};
