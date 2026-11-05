import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type NewAsset, type NewTransaction, type Range, type TransactionQuery } from './api';

export const keys = {
  summary: (r: Range) => ['summary', r] as const,
  stats: (r: Range) => ['stats', r] as const,
  assets: ['assets'] as const,
  asset: (id: number) => ['assets', id] as const,
  transactions: (q: TransactionQuery) => ['transactions', q] as const,
};

export const useSummary = (r: Range) => useQuery({ queryKey: keys.summary(r), queryFn: () => api.summary(r) });
export const useCategoryStats = (r: Range) => useQuery({ queryKey: keys.stats(r), queryFn: () => api.categoryStats(r) });
export const useAssets = () => useQuery({ queryKey: keys.assets, queryFn: api.assets });
export const useAsset = (id: number) => useQuery({ queryKey: keys.asset(id), queryFn: () => api.asset(id) });
export const useTransactions = (q: TransactionQuery) =>
  useQuery({ queryKey: keys.transactions(q), queryFn: () => api.transactions(q) });

// Any change to money affects balances, history and stats at once,
// so mutations simply refetch everything that is on screen.
function useInvalidateAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

export function useCreateAsset() {
  const onSuccess = useInvalidateAll();
  return useMutation({ mutationFn: (input: NewAsset) => api.createAsset(input), onSuccess });
}

export function useDeleteAsset() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteAsset(id),
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: keys.asset(id) });
      return client.invalidateQueries();
    },
  });
}

export function useCreateTransaction() {
  const onSuccess = useInvalidateAll();
  return useMutation({ mutationFn: (input: NewTransaction) => api.createTransaction(input), onSuccess });
}

export function useDeleteTransaction() {
  const onSuccess = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.deleteTransaction(id), onSuccess });
}
