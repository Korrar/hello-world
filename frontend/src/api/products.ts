import api from './client';
import type { Product, ProductListItem, PaginatedResponse, ConfiguratorOutput, SectionalElement, ProductPredicate, ProductEvent, ChoiceOverride } from '../types'

export async function getSubProducts(productId: number): Promise<ProductListItem[]> {
  const { data } = await api.get(`/api/products/${productId}/sub-products`);
  return data;
}

export async function createSubProduct(productId: number, payload: { sku: string; name: string; manufacturer?: string; brand?: string }): Promise<Product> {
  const { data } = await api.post(`/api/products/${productId}/sub-products`, payload);
  return data;
}

export async function getPresets(subProductId: number): Promise<ProductListItem[]> {
  const { data } = await api.get(`/api/products/${subProductId}/presets`);
  return data;
}

export async function createPreset(subProductId: number, payload: { sku: string; name: string }): Promise<Product> {
  const { data } = await api.post(`/api/products/${subProductId}/presets`, payload);
  return data;
}

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

export async function getDeleteInfo(id: number): Promise<{ sub_products_count: number; presets_count: number }> {
  const { data } = await api.get(`/api/products/${id}/delete-info`);
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

export async function addPredicate(productId: number, predicate: Partial<ProductPredicate>): Promise<ProductPredicate> {
  const { data } = await api.post(`/api/products/${productId}/predicates`, predicate);
  return data;
}

export async function updatePredicate(productId: number, predicateId: number, predicate: Partial<ProductPredicate>): Promise<ProductPredicate> {
  const { data } = await api.put(`/api/products/${productId}/predicates/${predicateId}`, predicate);
  return data;
}

export async function deletePredicate(productId: number, predicateId: number) {
  await api.delete(`/api/products/${productId}/predicates/${predicateId}`);
}

// --- Events ---

export async function addEvent(productId: number, event: Partial<ProductEvent>): Promise<ProductEvent> {
  const { data } = await api.post(`/api/products/${productId}/events`, event);
  return data;
}

export async function updateEvent(productId: number, eventId: number, event: Partial<ProductEvent>): Promise<ProductEvent> {
  const { data } = await api.put(`/api/products/${productId}/events/${eventId}`, event);
  return data;
}

export async function deleteEvent(productId: number, eventId: number) {
  await api.delete(`/api/products/${productId}/events/${eventId}`);
}

export async function setConfigPredicate(productId: number, configId: number, predicate: string | null) {
  await api.patch(`/api/products/${productId}/configurations/${configId}/predicate`, { predicate });
}

export async function setOptionPredicate(productId: number, optionId: number, predicate: string | null) {
  await api.patch(`/api/products/${productId}/options/${optionId}/predicate`, { predicate });
}

export async function createChoiceOverride(productId: number, data: { option_id: number; element_id?: number; configuration_id?: number; active: boolean }): Promise<ChoiceOverride> {
  const { data: result } = await api.post(`/api/products/${productId}/choice-overrides`, data);
  return result;
}

export async function updateChoiceOverride(productId: number, overrideId: number, data: { option_id: number; element_id?: number; configuration_id?: number; active: boolean }): Promise<ChoiceOverride> {
  const { data: result } = await api.put(`/api/products/${productId}/choice-overrides/${overrideId}`, data);
  return result;
}

export async function deleteChoiceOverride(productId: number, overrideId: number) {
  await api.delete(`/api/products/${productId}/choice-overrides/${overrideId}`);
}

export async function saveDefaultConfiguration(productId: number, configType: string, elements: unknown) {
  const { data } = await api.put(`/api/products/${productId}/default-configurations/${configType}`, { config_type: configType, elements });
  return data;
}

export function generateConfiguration(
  product: Product,
  globalSelections: Record<string, string>,
  elementOverrides?: Record<number, Record<string, string>>,
): ConfiguratorOutput {
  const configuration = product.sectional_elements && product.sectional_elements.length > 0
    ? {
        elements: product.sectional_elements.map(el => ({
          name: `${el.name || 'element'}_${el.element_id}`,
          variables: {
            ...globalSelections,
            ...(elementOverrides?.[el.element_id!] || {}),
          },
        })),
      }
    : { variables: { ...globalSelections } };

  return { configuration };
}
