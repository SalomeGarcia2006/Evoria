import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'evoria_access_token';

export function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/eventos/:path*',
    '/recursos/:path*',
    '/inventario/:path*',
    '/presupuestos/:path*',
    '/cronograma/:path*',
    '/alertas/:path*',
    '/reportes/:path*',
    '/auditoria/:path*',
    '/usuarios/:path*',
    '/perfiles/:path*',
    '/empresas/:path*',
  ],
};
