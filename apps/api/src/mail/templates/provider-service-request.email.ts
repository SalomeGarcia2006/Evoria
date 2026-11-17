export type ProviderServiceRequestEmail = {
  companyName: string;
  eventName: string;
  serviceName: string;
  startDate: string;
  startTime: string | null;
  amountCop: number;
  responseUrl: string;
  responseExpiresAt: Date;
  description?: string | null;
  endDate?: string | null;
  endTime?: string | null;
};

/** Plain text avoids interpreting names or service descriptions as HTML. */
export function providerServiceRequestEmail(
  input: ProviderServiceRequestEmail,
) {
  const amount = new Intl.NumberFormat('es-CO').format(input.amountCop);
  return {
    subject: 'Solicitud de servicio de EVORIA',
    text: [
      `${input.companyName} solicita tu respuesta para un servicio.`,
      '',
      `Evento: ${input.eventName}`,
      `Servicio: ${input.serviceName}`,
      ...(input.description ? [`Descripción: ${input.description}`] : []),
      `Inicio: ${input.startDate}${input.startTime ? ` ${input.startTime}` : ''}`,
      `Monto acordado: $${amount} COP`,
      ...(input.endDate
        ? [`Fin: ${input.endDate}${input.endTime ? ` ${input.endTime}` : ''}`]
        : []),
      '',
      'Revisa la solicitud y decide si aceptas o rechazas:',
      input.responseUrl,
      '',
      'La solicitud vence 24 horas después de su emisión.',
      `Vencimiento (UTC): ${input.responseExpiresAt.toISOString()}`,
      'Abrir el enlace no confirma el servicio.',
    ].join('\n'),
  };
}
