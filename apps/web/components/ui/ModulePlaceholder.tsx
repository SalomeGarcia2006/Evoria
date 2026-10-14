import { Card } from './Card';

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-teal">{description}</p>
    </Card>
  );
}
