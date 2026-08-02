const pageRoutes = new Map([
  ["/", "/index.html"],
  ["/Unblind", "/Unblind/index.html"],
  ["/Unblind/", "/Unblind/index.html"],
  ["/AlbaLabs", "/AlbaLabs/index.html"],
  ["/AlbaLabs/", "/AlbaLabs/index.html"],
  ["/AlbaSpace", "/AlbaSpace/index.html"],
  ["/AlbaSpace/", "/AlbaSpace/index.html"]
]);

export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response("Static asset binding is unavailable.", { status: 500 });
    }

    const url = new URL(request.url);
    url.pathname = pageRoutes.get(url.pathname) ?? url.pathname;

    let response = await env.ASSETS.fetch(new Request(url, request));

    if (response.status === 404 && request.method === "GET") {
      url.pathname = "/404.html";
      response = await env.ASSETS.fetch(new Request(url, request));
      return new Response(response.body, {
        status: 404,
        headers: response.headers
      });
    }

    return response;
  }
};
