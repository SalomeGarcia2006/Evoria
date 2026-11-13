export function googleChangeCodeEmail(code: string) {
  return {
    subject: 'Código para cambiar tu cuenta de Google en Evoria',
    text: `Tu código para cambiar la cuenta de Google vinculada a Evoria es ${code}. Caduca en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.`,
    html: `<!doctype html>
<html lang="es">
  <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f3f5fb;font-family:Arial,Helvetica,sans-serif;color:#14213d">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu código para cambiar la cuenta de Google en Evoria caduca en 10 minutos.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f5fb">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e3e8f3;border-radius:18px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#14213d;color:#ffffff">
            <p style="margin:0 0 18px;font-size:18px;font-weight:700;letter-spacing:2px">EVORIA<span style="color:#12b5a6">.</span></p>
            <p style="margin:0 0 8px;color:#a3ece1;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Seguridad de tu cuenta</p>
            <h1 style="margin:0;font-size:26px;line-height:1.3">Cambia tu cuenta de Google</h1>
          </td></tr>
          <tr><td style="padding:32px">
            <p style="margin:0 0 24px;color:#5d6b86;font-size:16px;line-height:1.6">Recibimos una solicitud para cambiar la cuenta de Google vinculada a Evoria. Ingresa este código en Mi perfil para continuar:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f5fb;border:1px solid #e3e8f3;border-left:4px solid #12b5a6;border-radius:12px">
              <tr><td align="center" style="padding:24px 8px;color:#14213d;font-size:32px;font-weight:700;letter-spacing:7px;white-space:nowrap">${code}</td></tr>
            </table>
            <p style="margin:20px 0 0;color:#5d6b86;font-size:14px;line-height:1.6">Este código caduca en <strong style="color:#14213d">10 minutos</strong> y solo se puede usar una vez.</p>
            <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e3e8f3;color:#5d6b86;font-size:13px;line-height:1.6">Si no solicitaste este cambio, ignora este correo. Tu cuenta seguirá vinculada como hasta ahora. No compartas este código con nadie.</p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;color:#5d6b86;font-size:12px">Evoria · Gestión de eventos</p>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
