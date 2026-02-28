import api from './client';
import type { BulkImportResult } from '../types';

export async function importFile(file: File): Promise<BulkImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/import/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function importJson(rows: Record<string, unknown>[]): Promise<BulkImportResult> {
  const { data } = await api.post('/api/import/json', rows);
  return data;
}

export async function importFromApi(url: string): Promise<BulkImportResult> {
  const { data } = await api.post('/api/import/api-fetch', null, { params: { url } });
  return data;
}
