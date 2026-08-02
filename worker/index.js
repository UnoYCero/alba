const pageRoutes = new Map([
  ["/", "/index.html"],
  ["/Unblind", "/Unblind/index.html"],
  ["/Unblind/", "/Unblind/index.html"],
  ["/AlbaLabs", "/AlbaLabs/index.html"],
  ["/AlbaLabs/", "/AlbaLabs/index.html"],
  ["/AlbaSpace", "/AlbaSpace/index.html"],
  ["/AlbaSpace/", "/AlbaSpace/index.html"]
]);

const storeProducts = {
  "smartglasses-dev-kit": {
    name: "Alba Smartglasses Dev Kit",
    description: "Smartglasses modulares open source de Alba Labs",
    unitAmount: 590000,
    currency: "mxn"
  }
};

async function createCheckoutSession(request, env) {
  if (!env?.STRIPE_SECRET_KEY) {
    return Response.json({ error: "El pago con Stripe está pendiente de configuración." }, { status: 503 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "La solicitud de compra no es válida." }, { status: 400 });
  }

  const requestedItem = Array.isArray(payload?.items) ? payload.items[0] : null;
  const product = storeProducts[requestedItem?.id];
  const quantity = Number(requestedItem?.quantity);
  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    return Response.json({ error: "El producto o la cantidad no son válidos." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    mode: "payment",
    locale: "es",
    success_url: `${origin}/AlbaLabs/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/AlbaLabs/?checkout=cancelled`,
    customer_creation: "always",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "true",
    "shipping_address_collection[allowed_countries][0]": "MX",
    "line_items[0][quantity]": String(quantity),
    "line_items[0][price_data][currency]": product.currency,
    "line_items[0][price_data][unit_amount]": String(product.unitAmount),
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][product_data][description]": product.description,
    "metadata[store]": "alba-labs",
    "metadata[product_id]": requestedItem.id
  });

  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const stripeSession = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeSession.url) {
      console.error("Stripe Checkout error", stripeSession?.error?.type, stripeSession?.error?.code);
      return Response.json({ error: "Stripe no pudo preparar el pago." }, { status: 502 });
    }
    return Response.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe connection error", error?.message);
    return Response.json({ error: "No fue posible conectar con Stripe." }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/api/checkout" && request.method === "POST") {
      return createCheckoutSession(request, env);
    }

    if (!env?.ASSETS?.fetch) {
      return new Response("Static asset binding is unavailable.", { status: 500 });
    }

    const url = requestUrl;
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
