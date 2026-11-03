import { InventoryView } from '../../components/resources/InventoryView';

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    nuevo?: string | string[];
    recurso?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const initialCreate = query.nuevo === '1';
  const initialResourceId =
    typeof query.recurso === 'string' ? query.recurso : undefined;
  return (
    <InventoryView
      key={initialCreate ? 'new' : (initialResourceId ?? 'list')}
      initialCreate={initialCreate}
      initialResourceId={initialResourceId}
    />
  );
}
