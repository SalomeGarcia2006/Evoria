import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { createHash } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator';
import { ProviderServiceWorkflow } from './provider-service-workflow.service';

export class ProviderConfirmationLinkDto {
  @IsMongoId() serviceId!: string;
  @IsString() @Length(64, 64) token!: string;
}
export class ProviderConfirmationResponseDto extends ProviderConfirmationLinkDto {
  @IsIn(['aceptar', 'rechazar']) decision!: 'aceptar' | 'rechazar';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

// The token is carried in the URL fragment, never in a query string/access log.
// A GET renders only a generic page: email scanners cannot accept a service.
const script = `const params=new URLSearchParams(location.hash.slice(1));
const credentials={serviceId:params.get('id'),token:params.get('token')};
history.replaceState(null,'',location.pathname);
const output=document.getElementById('details'), actions=document.getElementById('actions');
async function request(path,body){const response=await fetch(location.pathname.replace(/\\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(Array.isArray(result.message)?result.message.join(' '):result.message||'No se pudo procesar la solicitud.');return result.data;}
const labels={pendiente:'Pendiente de tu respuesta',aceptado_sin_saldo:'Aceptaste. La empresa tiene hasta 24 horas para disponer del presupuesto. El servicio todavía no está asignado.',confirmado:'Servicio asignado',rechazado:'Rechazaste el servicio',vencido:'La solicitud venció',cancelado:'El servicio fue cancelado'};
function show(data){output.textContent='Evento: '+data.eventName+'\\nServicio: '+data.serviceName+'\\nDescripción: '+(data.description||'—')+'\\nInicio: '+data.startDate+' '+(data.startTime||'')+'\\nFin: '+(data.endDate||'—')+' '+(data.endTime||'')+'\\nMonto: '+data.agreedAmountCop.toLocaleString('es-CO')+' COP\\nEstado: '+(labels[data.status]||data.status)+'\\nVence: '+new Date(data.responseExpiresAt).toLocaleString();actions.hidden=!data.canRespond;}
if(!credentials.serviceId||!credentials.token)output.textContent='Vuelve a abrir el enlace de tu correo para consultar la solicitud.';
else request('/details',credentials).then(show).catch(error=>{output.textContent=error.message;});
for(const button of document.querySelectorAll('button'))button.addEventListener('click',async()=>{for(const b of document.querySelectorAll('button'))b.disabled=true;try{show(await request('/respond',{...credentials,decision:button.value,reason:document.getElementById('reason').value}));}catch(error){output.textContent=error.message;actions.hidden=true;}finally{for(const b of document.querySelectorAll('button'))b.disabled=false;}});`;
const hash = createHash('sha256').update(script).digest('base64');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmación de servicio · EVORIA</title></head><body><main><h1>Confirmación de servicio</h1><p>Revisa las condiciones antes de responder. Abrir este enlace no acepta la solicitud.</p><pre id="details">Consultando solicitud…</pre><section id="actions" hidden><label>Motivo del rechazo (opcional) <textarea id="reason" maxlength="1000"></textarea></label><p><button type="button" value="aceptar">Aceptar servicio</button> <button type="button" value="rechazar">Rechazar servicio</button></p></section><noscript>Activa JavaScript para revisar y responder a la solicitud.</noscript></main><script>${script}</script></body></html>`;

@Public()
@Controller('provider-service-confirmation')
export class ProviderServiceConfirmationController {
  constructor(private readonly workflow: ProviderServiceWorkflow) {}
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'sha256-${hash}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  )
  page() {
    return html;
  }

  @Post('details')
  @Header('Cache-Control', 'no-store')
  async details(@Body() dto: ProviderConfirmationLinkDto) {
    return {
      data: await this.workflow.inspect(dto.serviceId, dto.token),
      message: 'Solicitud consultada.',
    };
  }

  @Post('respond')
  @Header('Cache-Control', 'no-store')
  async respond(@Body() dto: ProviderConfirmationResponseDto) {
    return {
      data: await this.workflow.respond(
        dto.serviceId,
        dto.token,
        dto.decision,
        dto.reason,
      ),
      message: 'Respuesta registrada.',
    };
  }
}
