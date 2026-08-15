'use client';

import { Card } from '@mantine/core';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { useDealCtx } from '@/components/deals/DealContext';

export default function DealCustomFieldsPage() {
  const { form, setForm, save, saveBar } = useDealCtx();
  return (
    <Card withBorder radius="md" padding="lg">
      <CustomFieldsEditor
        entity="deal"
        values={form.customFields}
        onChange={(k, val) => setForm({ ...form, customFields: { ...form.customFields, [k]: val } })}
        // File fields (image/document) persist immediately — uploading/removing a file shouldn't need a manual Save.
        onCommit={(k, val) => save({ customFields: { ...form.customFields, [k]: val } })}
      />
      {saveBar}
    </Card>
  );
}
