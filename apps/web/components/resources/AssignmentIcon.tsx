type AssignmentIconName =
  | 'eventos'
  | 'cronograma'
  | 'empresas'
  | 'perfil'
  | 'inventario'
  | 'provedores'
  | 'alerta';

export function AssignmentIcon({
  name,
  small = false,
  plain = false,
}: {
  name: AssignmentIconName;
  small?: boolean;
  plain?: boolean;
}) {
  const source = `url('/icons/${name}.svg')`;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center text-muted ${plain ? 'size-4' : `rounded-xl bg-sky-blue/40 ${small ? 'size-8' : 'size-10'}`}`}
    >
      <span
        className={small ? 'size-4 bg-current' : 'size-5 bg-current'}
        style={{
          maskImage: source,
          WebkitMaskImage: source,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />
    </span>
  );
}
