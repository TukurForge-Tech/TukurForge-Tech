const SECRET_KEY = "SimuTukur_Tech_SecretKey_1";

// 1. TU DICCIONARIO DE ACTIVOS ENMASCARADOS
const diccionarioRecursos = {
    '/seguridad/SSG001': '/simu_style_global.css',
    '/seguridad/SSC002': '/simu_supabase_client.js',
    '/seguridad/SID003': '/simu_instrucciones_demo.js',
    '/seguridad/SED004': '/simu_examen_demo.js',
    '/seguridad/SDD005': '/simu_dash_demo.js'

};

export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 2. INTERCEPTOR DEL DICCIONARIO
  if (diccionarioRecursos[path]) {
      const archivoReal = diccionarioRecursos[path];
      const targetUrl = new URL(archivoReal, request.url);
      return new Response(null, { 
          headers: { 'x-middleware-rewrite': targetUrl.toString() } 
      });
  }

    // REDIRECCIÓN INTELIGENTE AL CRM (ACADEMIA)
  if (path === '/crm_vendedores' || path === '/crm_vendedores.html' || path === '/academia_crm_vendedores' || path === '/academia_crm_vendedores.html') {
      const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      
      // 👇 INYECTAMOS EL PREFIJO /abrir/ EN EL DESTINO 👇
      const destino = isLocal 
          ? 'http://localhost:3000/abrir/academia_crm_vendedores' 
          : 'https://academia.tukurforge.com/abrir/academia_crm_vendedores';
          
      return Response.redirect(destino, 301);
  }
  

  // 3. REGLAS DE PASO LIBRE
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
      
      return Response.redirect(new URL(`/auth-${base64Url}${url.search}`, request.url), 307);
  }

  // 5. FASE DE DESENCRIPTACIÓN INVISIBLE
  if (path.startsWith('/auth-')) {
      const encryptedPath = path.replace('/auth-', '');
      try {
          const decodedString = atob(encryptedPath);
          let decryptedTarget = "";
          for (let i = 0; i < decodedString.length; i++) {
              decryptedTarget += String.fromCharCode(decodedString.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
          }
          
          // FIX: Vercel usa Clean URLs, así que SÍ debemos quitarle el .html
          const cleanTarget = decryptedTarget.replace('.html', '');
          const newUrl = new URL(`/${cleanTarget}${url.search}`, request.url);

          return new Response(null, { headers: { 'x-middleware-rewrite': newUrl.toString() } });
      } catch (error) {
          return new Response('Enlace Inválido o Caducado', { status: 404 });
      }
  }

  // 6. EL BLINDAJE ABSOLUTO
  return new Response('🛡️ ACCESO DENEGADO: Por favor ingresa desde el Portal Principal de SimuTukur.', { 
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}