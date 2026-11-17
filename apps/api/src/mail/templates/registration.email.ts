export function registrationEmail(code: string) {
  return {
    subject: 'Verifica tu correo en Evoria',
    text: `Tu código de verificación en Evoria es ${code}. Caduca en 10 minutos. Si no solicitaste este registro, ignora este correo.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;padding:32px 16px;background:#f3f5fb;font-family:Arial,sans-serif;color:#14213d"><div style="max-width:500px;margin:auto;background:white;border-radius:16px;padding:32px"><h1>Verifica tu correo</h1><p>Usa este código para completar tu registro en Evoria:</p><p style="font-size:32px;letter-spacing:7px;color:#4035a5;font-weight:bold">${code}</p><p>El código caduca en 10 minutos. Si no solicitaste el registro, ignora este mensaje.</p></div></body></html>`,
  };
}
