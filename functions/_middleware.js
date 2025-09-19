// Cloudflare Pages Functions middleware
export async function onRequest(context) {
  const { request, next } = context;

  // CORS headers for API routes
  if (request.url.includes('/api/')) {
    const response = await next();

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  }

  return next();
}