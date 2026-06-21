import { apiFetch } from './client';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDef {
  id: string;
  entity: 'deal' | 'person' | 'company';
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  position: number;
}

export function getCustomFields(token: string, entity: string) {
  return apiFetch<CustomFieldDef[]>(`/custom-fields?entity=${entity}`, { token });
}

export function createCustomField(
  token: string,
  body: { entity: string; label: string; type?: CustomFieldType; options?: string[] },
) {
  return apiFetch<CustomFieldDef>('/custom-fields', { method: 'POST', token, body: JSON.stringify(body) });
}

export function deleteCustomField(token: string, id: string) {
  return apiFetch<void>(`/custom-fields/${id}`, { method: 'DELETE', token });
}
