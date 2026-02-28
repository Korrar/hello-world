import api from './client';
import type { Product, ProductListItem, PaginatedResponse } from '../types';

export async function getProducts(params: {
  page?: number;
  page_size?: number;
  search?: string;
  manufacturer?: string;
  product_type?: string;
  is_active?: boolean | null;
}): Promise<PaginatedResponse<ProductListItem>> {
  const { data } = await api.get('/api/products', { params });
  return data;
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await api.get(`/api/products/${id}`);
  return data;
}

export async function createProduct(product: Partial<Product>) {
  const { data } = await api.post('/api/products', product);
  return data;
}

export async function updateProduct(id: number, product: Partial<Product>) {
  const { data } = await api.put(`/api/products/${id}`, product);
  return data;
}

export async function deleteProduct(id: number) {
  await api.delete(`/api/products/${id}`);
}

export async function deleteProducts(ids: number[]) {
  await api.delete('/api/products', { params: { ids } });
}

export async function getFilters() {
  const { data } = await api.get('/api/products/meta/filters');
  return data as { manufacturers: string[]; product_types: string[] };
}

export async function addConfiguration(productId: number, config: Record<string, unknown>) {
  const { data } = await api.post(`/api/products/${productId}/configurations`, config);
  return data;
}

export async function deleteConfiguration(productId: number, configId: number) {
  await api.delete(`/api/products/${productId}/configurations/${configId}`);
}
