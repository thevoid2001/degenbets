export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Try serving the static file first
    const staticResponse = await env.ASSETS.fetch(request);
    if (staticResponse.status !== 404) return staticResponse;

    // Rewrite dynamic routes to pre-rendered placeholder pages
    let fallbackPath = null;
    if (path.startsWith("/market/")) fallbackPath = "/market/0/index.html";
    else if (path.startsWith("/trader/")) fallbackPath = "/trader/0/index.html";
    else if (path.startsWith("/creator/")) fallbackPath = "/creator/0/index.html";

    if (fallbackPath) {
      const fallbackUrl = new URL(fallbackPath, url.origin);
      const fallbackResponse = await env.ASSETS.fetch(fallbackUrl.toString());
      // Return the content but preserve the original URL (200 rewrite)
      return new Response(fallbackResponse.body, {
        status: 200,
        headers: fallbackResponse.headers,
      });
    }

    return staticResponse;
  },
};
