const SECRET_KEY = "TukurForge_Tech_Core_SecretKey_1";

export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. REGLAS DE PASO LIBRE
  if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.png') || path === '/' || path === '/index' || path === '/index.html') {
      return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }

  // 2. AUTOMATIZACIÓN TOTAL (Adiós diccionario)
  // Detecta cualquier clic que use el prefijo "/abrir/"
  if (path.startsWith('/abrir/')) {
      // Extrae el nombre (ej. "modulo_1_crm") y le pega el ".html" automáticamente
      const archivoReal = path.replace('/abrir/', '') + '.html';
      
      // Lo encripta al vuelo
      let encryptedString = "";
      for (let i = 0; i < archivoReal.length; i++) {
          encryptedString += String.fromCharCode(archivoReal.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
      }
      const base64Url = btoa(encryptedString).replace(/=/g, "");
      
      // Lanza la redirección
      return Response.redirect(new URL(`/auth-${base64Url}`, request.url), 307);
  }

  // 3. FASE DE DESENCRIPTACIÓN INVISIBLE
  if (path.startsWith('/auth-')) {
      const encryptedPath = path.replace('/auth-', '');
      try {
          const decodedString = atob(encryptedPath);
          let decryptedTarget = "";
          for (let i = 0; i < decodedString.length; i++) {
              decryptedTarget += String.fromCharCode(decodedString.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
          }
          
          const cleanTarget = decryptedTarget.replace('.html', '');
          const newUrl = new URL(`/${cleanTarget}`, request.url);
          
          return new Response(null, { headers: { 'x-middleware-rewrite': newUrl.toString() } });
      } catch (error) {
          return new Response('Enlace Inválido o Caducado', { status: 404 });
      }
  }

  // 4. EL BLINDAJE ABSOLUTO
  return new Response('🛡️ ACCESO DENEGADO: Por favor ingresa desde el Portal Principal.', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}