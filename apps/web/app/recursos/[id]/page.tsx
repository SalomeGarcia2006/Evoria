import { redirect } from 'next/navigation';

export default async function RecursoRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect('/inventario/' + encodeURIComponent(id));
}
