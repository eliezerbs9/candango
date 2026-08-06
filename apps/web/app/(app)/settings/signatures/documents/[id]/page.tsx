'use client';

import { useParams } from 'next/navigation';
import { DocumentBuilder } from '@/components/signatures/DocumentBuilder';

export default function DocumentTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <DocumentBuilder id={id} />;
}
