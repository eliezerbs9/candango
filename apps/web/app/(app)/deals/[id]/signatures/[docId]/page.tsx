'use client';

import { useParams } from 'next/navigation';
import { DocumentBuilder } from '@/components/signatures/DocumentBuilder';

// The document builder rendered INSIDE the deal (keeps the deal header + tabs from the deal layout).
export default function DealDocumentBuilderPage() {
  const { docId } = useParams<{ docId: string }>();
  return <DocumentBuilder id={docId} />;
}
