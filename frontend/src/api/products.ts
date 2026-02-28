import api from './client';
import type { Product, ProductListItem, PaginatedResponse, ConfiguratorOutput, SectionalElement } from '../types';

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

export async function addElement(productId: number, element: Partial<SectionalElement>): Promise<SectionalElement> {
  const { data } = await api.post(`/api/products/${productId}/elements`, element);
  return data;
}

export async function updateElement(productId: number, elementDbId: number, element: Partial<SectionalElement>): Promise<SectionalElement> {
  const { data } = await api.put(`/api/products/${productId}/elements/${elementDbId}`, element);
  return data;
}

export async function deleteElement(productId: number, elementDbId: number) {
  await api.delete(`/api/products/${productId}/elements/${elementDbId}`);
}

export function generateConfiguration(
  product: Product,
  globalSelections: Record<string, string>,
  elementOverrides?: Record<number, Record<string, string>>,
): ConfiguratorOutput {
  if (product.sectional_builder && product.sectional_elements.length > 0) {
    return {
      configuration: {
        elements: product.sectional_elements.map(el => ({
          element_id: el.element_id!,
          variables: {
            ...globalSelections,
            ...(elementOverrides?.[el.element_id!] || {}),
          },
        })),
      },
    };
  }
  return {
    configuration: {
      variables: { ...globalSelections },
    },
  };
}
