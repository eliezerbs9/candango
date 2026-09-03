'use client';

import { DealPhotos } from '@/components/deals/DealPhotos';
import { useDealCtx } from '@/components/deals/DealContext';

export default function DealPhotosPage() {
  const { deal } = useDealCtx();
  return <DealPhotos dealId={deal.id} dealTitle={deal.title} />;
}
