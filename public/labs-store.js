(() => {
  const PRODUCTS = {
    "smartglasses-dev-kit": {
      id: "smartglasses-dev-kit",
      name: "Alba Smartglasses Dev Kit",
      price: 5900,
      image: "../assets/armazon.png",
      sku: "ALBA-SG-01"
    }
  };

  const CART_KEY = "alba-labs-cart-v1";
  const drawer = document.querySelector("[data-cart-drawer]");
  const overlay = document.querySelector("[data-cart-overlay]");
  const itemsNode = document.querySelector("[data-cart-items]");
  const emptyNode = document.querySelector("[data-cart-empty]");
  const footerNode = document.querySelector("[data-cart-footer]");
  const totalNode = document.querySelector("[data-cart-total]");
  const checkoutButton = document.querySelector("[data-cart-checkout]");
  const toast = document.querySelector("[data-cart-toast]");
  const notice = document.querySelector("[data-checkout-notice]");
  let cart = loadCart();
  let toastTimer;

  function loadCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY));
      if (!value || typeof value !== "object") return {};
      return Object.fromEntries(Object.entries(value).filter(([id, quantity]) => PRODUCTS[id] && Number.isInteger(quantity) && quantity > 0));
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value) + " MXN";
  }

  function getCount() {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  }

  function getTotal() {
    return Object.entries(cart).reduce((sum, [id, quantity]) => sum + PRODUCTS[id].price * quantity, 0);
  }

  function renderCart() {
    const count = getCount();
    document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = String(count); });
    emptyNode.hidden = count > 0;
    footerNode.hidden = count === 0;
    itemsNode.innerHTML = "";

    Object.entries(cart).forEach(([id, quantity]) => {
      const product = PRODUCTS[id];
      const item = document.createElement("article");
      item.className = "cart-item";
      item.innerHTML = `
        <div class="cart-item-image"><img src="${product.image}" alt=""></div>
        <div class="cart-item-copy">
          <small>${product.sku}</small>
          <h3>${product.name}</h3>
          <strong>${formatMoney(product.price)}</strong>
          <div class="quantity-control" aria-label="Cantidad">
            <button type="button" data-cart-decrease="${id}" aria-label="Reducir cantidad">−</button>
            <span>${quantity}</span>
            <button type="button" data-cart-increase="${id}" aria-label="Aumentar cantidad">+</button>
          </div>
          <button class="remove-item" type="button" data-cart-remove="${id}">Eliminar</button>
        </div>`;
      itemsNode.appendChild(item);
    });

    totalNode.textContent = formatMoney(getTotal());
    saveCart();
  }

  function openCart() {
    drawer.classList.add("open");
    overlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open");
    drawer.querySelector("[data-cart-close]")?.focus();
  }

  function closeCart() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cart-open");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.addCart;
      cart[id] = Math.min((cart[id] || 0) + 1, 5);
      renderCart();
      showToast("Smartglasses agregados al carrito.");
      openCart();
    });
  });

  document.querySelectorAll("[data-cart-open]").forEach((button) => button.addEventListener("click", openCart));
  document.querySelector("[data-cart-close]")?.addEventListener("click", closeCart);
  overlay?.addEventListener("click", closeCart);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeCart(); });

  itemsNode?.addEventListener("click", (event) => {
    const increase = event.target.closest("[data-cart-increase]");
    const decrease = event.target.closest("[data-cart-decrease]");
    const remove = event.target.closest("[data-cart-remove]");
    if (increase) cart[increase.dataset.cartIncrease] = Math.min((cart[increase.dataset.cartIncrease] || 0) + 1, 5);
    if (decrease) {
      const id = decrease.dataset.cartDecrease;
      cart[id] = Math.max((cart[id] || 1) - 1, 0);
      if (!cart[id]) delete cart[id];
    }
    if (remove) delete cart[remove.dataset.cartRemove];
    if (increase || decrease || remove) renderCart();
  });

  checkoutButton?.addEventListener("click", async () => {
    const quantity = cart["smartglasses-dev-kit"] || 0;
    if (!quantity) return;
    checkoutButton.disabled = true;
    checkoutButton.classList.add("loading");
    checkoutButton.firstChild.textContent = "Preparando pago ";
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ id: "smartglasses-dev-kit", quantity }] })
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "No fue posible iniciar el pago.");
      window.location.assign(result.url);
    } catch (error) {
      showToast(error.message || "No fue posible conectar con Stripe.");
      checkoutButton.disabled = false;
      checkoutButton.classList.remove("loading");
      checkoutButton.firstChild.textContent = "Continuar a pago seguro ";
    }
  });

  const checkoutState = new URLSearchParams(window.location.search).get("checkout");
  if (checkoutState === "success") {
    cart = {};
    saveCart();
    notice.hidden = false;
    notice.className = "checkout-notice success";
    notice.textContent = "Pago recibido. Stripe enviará la confirmación de tu compra.";
  } else if (checkoutState === "cancelled") {
    notice.hidden = false;
    notice.className = "checkout-notice cancelled";
    notice.textContent = "El pago fue cancelado. Tus productos siguen en el carrito.";
  }

  renderCart();
})();
