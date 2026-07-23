const SECRET_KEY = "TukurForge_Tech_Core_SecretKey_1";

// 1. TU DICIOMARIO DE ACTIVOS ENMASCARADOS (Aquí vive tu nomenclatura ACM001)
const diccionarioRecursos = {
    '/seguridad/ACM001': '/academia_centro_mando.js',
    '/seguridad/SCM002': '/supabase-client.js',
    // '/seguridad/GLB001': '/global.css'  <-- Aquí agregarás tu CSS global después
};

export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 2. INTERCEPTOR DEL DICCIONARIO DE RECURSOS (Protege tus JS y CSS)
  if (diccionarioRecursos[path]) {
      const archivoReal = diccionarioRecursos[path];
      const targetUrl = new URL(archivoReal, request.url);
      return new Response(null, { 
          headers: { 'x-middleware-rewrite': targetUrl.toString() } 
      });
  }

  // 3. REGLAS DE PASO LIBRE (Imágenes, estilos, scripts y favicon)
  if (path.endsWith('.png') || path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.ico') || path === '/' || path === '/index' || path === '/index.html') {
      return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }

  // 4. AUTOMATIZACIÓN DE APERTURA (Prefijo /abrir/)
  if (path.startsWith('/abrir/')) {
      const archivoReal = path.replace('/abrir/', '') + '.html';
      
      let encryptedString = "";
      for (let i = 0; i < archivoReal.length; i++) {
          encryptedString += String.fromCharCode(archivoReal.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
      }
      const base64Url = btoa(encryptedString).replace(/=/g, "");
      
      return Response.redirect(new URL(`/auth-${base64Url}`, request.url), 307);
  }

  // 5. FASE DE DESENCRIPTACIÓN INVISIBLE (Para las vistas protegidas)
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

  // 6. EL BLINDAJE ABSOLUTO
  return new Response('🛡️ ACCESO DENEGADO: Por favor ingresa desde el Portal Principal.', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}