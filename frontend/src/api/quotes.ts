import api from './client';
import type { Quote, QuoteListItem, PaginatedResponse, QuoteItem } from '../types';

export async function getQuotes(params: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<QuoteListItem>> {
  const { data } = await api.get('/api/quotes', { params });
  return data;
}

export async function getQuote(id: number): Promise<Quote> {
  const { data } = await api.get(`/api/quotes/${id}`);
  return data;
}

export async function createQuote(quote: Record<string, unknown>) {
  const { data } = await api.post('/api/quotes', quote);
  return data;
}

export async function updateQuote(id: number, quote: Record<string, unknown>) {
  const { data } = await api.put(`/api/quotes/${id}`, quote);
  return data;
}

export async function deleteQuote(id: number) {
  await api.delete(`/api/quotes/${id}`);
}

export async function addQuoteItem(quoteId: number, item: Partial<QuoteItem>) {
  const { data } = await api.post(`/api/quotes/${quoteId}/items`, item);
  return data;
}

export async function deleteQuoteItem(quoteId: number, itemId: number) {
  await api.delete(`/api/quotes/${quoteId}/items/${itemId}`);
}
