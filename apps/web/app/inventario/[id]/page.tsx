import { redirect } from 'next/navigation';

export default async function RecursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect('/inventario?recurso=' + encodeURIComponent(id));
}
