import { redirect } from 'next/navigation';
import { pipelines } from '@/lib/mock/data';

export default function PipelinesIndex() {
  const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  redirect(`/pipelines/${def.id}`);
}
