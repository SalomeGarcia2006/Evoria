import Image from 'next/image';

export function ModuleBanner({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <section className="events-banner">
      <span className="events-banner__icon" aria-hidden="true">
        <Image src={`/icons/${icon}`} alt="" width={24} height={24} />
      </span>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </section>
  );
}
