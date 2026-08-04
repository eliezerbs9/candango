'use client';

import { Card } from '@mantine/core';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { useDealCtx } from '@/components/deals/DealContext';

export default function DealCustomFieldsPage() {
  const { form, setForm, saveBar } = useDealCtx();
  return (
    <Card withBorder radius="md" padding="lg">
      <CustomFieldsEditor
        entity="deal"
        values={form.customFields}
        onChange={(k, val) => setForm({ ...form, customFields: { ...form.customFields, [k]: val } })}
      />
      {saveBar}
    </Card>
  );
}
