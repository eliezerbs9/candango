import { apiFetch } from './client';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'image' | 'document';

export interface CustomFieldDef {
  id: string;
  entity: 'deal' | 'person' | 'company';
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  requiredFromStageId: string | null;
  requiredForWon: boolean;
  position: number;
}

/** A built-in field shown on the Fields page (essential column or integration value). */
export interface SystemFieldDef {
  key: string;
  label: string;
  type: string;
  group: 'core' | 'integration';
  integration?: 'quickbooks';
}

export interface CustomFieldSchema {
  system: SystemFieldDef[];
  integration: SystemFieldDef[];
  custom: CustomFieldDef[];
}

export interface CustomFieldBody {
  entity: string;
  label?: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  requiredFromStageId?: string | null;
  requiredForWon?: boolean;
  position?: number;
}

export function getCustomFields(token: string, entity: string) {
  return apiFetch<CustomFieldDef[]>(`/custom-fields?entity=${entity}`, { token });
}

export function getCustomFieldSchema(token: string, entity: string) {
  return apiFetch<CustomFieldSchema>(`/custom-fields/schema?entity=${entity}`, { token });
}

export function createCustomField(token: string, body: CustomFieldBody) {
  return apiFetch<CustomFieldDef>('/custom-fields', { method: 'POST', token, body: JSON.stringify(body) });
}

export function updateCustomField(token: string, id: string, body: Partial<CustomFieldBody>) {
  return apiFetch<CustomFieldDef>(`/custom-fields/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
}

export function deleteCustomField(token: string, id: string) {
  return apiFetch<void>(`/custom-fields/${id}`, { method: 'DELETE', token });
}
