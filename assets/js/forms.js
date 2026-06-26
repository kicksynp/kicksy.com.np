// ============================================================
// KICKSY NEPAL — FORMS.JS
// Order inquiry form & contact form validation + submission
// ============================================================

const Forms = (() => {
  // ── Validation rules ───────────────────────────────────────
  const validators = {
    required: (v) => v.trim().length > 0 || "This field is required.",
    phone: (v) =>
      /^[\d\s\+\-]{8,15}$/.test(v.trim()) || "Enter a valid phone number.",
    email: (v) =>
      !v ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
      "Enter a valid email.",
    minLength: (n) => (v) =>
      v.trim().length >= n || `Minimum ${n} characters required.`,
  };

  function validate(value, rules) {
    for (const rule of rules) {
      const result = rule(value);
      if (result !== true) return result;
    }
    return null;
  }

  function setFieldError(field, msg) {
    field.classList.add("error");
    const err = field.querySelector(".form-error");
    if (err) err.textContent = msg;
  }

  function clearFieldError(field) {
    field.classList.remove("error");
  }

  function showSpinner(btn, loading) {
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
    btn.innerHTML = loading
      ? `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Submitting…`
      : btn.dataset.originalText;
  }

  // ── reCAPTCHA helper ──────────────────────────────────────────
  // The reCAPTCHA v2 widget script auto-injects a hidden
  // <textarea name="g-recaptcha-response"> inside the form once the
  // user completes the checkbox challenge. We read that value and
  // forward it to Formspree, which validates it server-side against
  // the secret key configured in your Formspree form settings.
  // IMPORTANT: this field name is fixed by Google/Formspree — do not
  // rename it, or Formspree will not recognize the verification.
  function getCaptchaToken(form) {
    const widget = form.querySelector(".g-recaptcha");
    if (!widget) return null; // no captcha configured on this form
    const token =
      form.querySelector('[name="g-recaptcha-response"]')?.value || "";
    return {
      configured: true,
      token,
      hasSiteKey:
        widget.dataset.sitekey &&
        widget.dataset.sitekey !== "6LdWOSYtAAAAAN_tUkxDWU12nWVOzsp3pj8hxH6q",
    };
  }

  function resetCaptcha() {
    if (typeof grecaptcha !== "undefined") {
      try {
        grecaptcha.reset();
      } catch {}
    }
  }

  // ── Order Inquiry Form ─────────────────────────────────────
  function initOrderForm() {
    const form = document.getElementById("orderForm");
    if (!form) return;

    const fields = {
      name: {
        el: form.querySelector('[name="customerName"]'),
        rules: [validators.required, validators.minLength(2)],
      },
      phone: {
        el: form.querySelector('[name="customerPhone"]'),
        rules: [validators.required, validators.phone],
      },
      address: {
        el: form.querySelector('[name="customerAddress"]'),
        rules: [validators.required, validators.minLength(10)],
      },
    };

    // Live validation
    Object.values(fields).forEach(({ el }) => {
      if (!el) return;
      el.addEventListener("blur", () => validateField(el, fields));
      el.addEventListener("input", () =>
        clearFieldError(el.closest(".form-field")),
      );
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Honeypot check
      if (form.querySelector('[name="hp_field"]')?.value) return;

      let valid = true;
      Object.entries(fields).forEach(([, { el }]) => {
        const err = validateField(el, fields);
        if (err) valid = false;
      });
      if (!valid) return;

      // hCaptcha check — only enforced once a real site key is configured
      // (see the data-sitekey attribute on the .g-recaptcha div in the HTML)
      const captcha = getCaptchaToken(form);
      if (captcha?.configured && captcha.hasSiteKey && !captcha.token) {
        window.KicksyUtils?.Toast?.show(
          "Please complete the captcha verification.",
          "error",
        );
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      showSpinner(submitBtn, true);

      // Gather product data from hidden fields
      const productId = form.querySelector('[name="productId"]')?.value || "";
      const productName =
        form.querySelector('[name="productName"]')?.value || "";
      const brand = form.querySelector('[name="brand"]')?.value || "";
      const selectedSize =
        form.querySelector('[name="selectedSize"]')?.value || "";
      const selectedColor =
        form.querySelector('[name="selectedColor"]')?.value || "";
      const price = form.querySelector('[name="price"]')?.value || "";
      const note = form.querySelector('[name="note"]')?.value || "";

      const orderData = {
        productId,
        productName,
        brand,
        selectedSize,
        selectedColor,
        price,
        customerName: fields.name.el.value.trim(),
        customerPhone: fields.phone.el.value.trim(),
        customerAddress: fields.address.el.value.trim(),
        customerNote: note.trim(),
        whatsappOpened: false,
        status: "New",
        ...(captcha?.token ? { "g-recaptcha-response": captcha.token } : {}),
      };

      const result = await API.createOrder(orderData);
      showSpinner(submitBtn, false);
      resetCaptcha();

      if (result.success !== false) {
        // Show success
        form.style.display = "none";
        const success = document.getElementById("orderSuccess");
        if (success) success.classList.add("show");

        // Offer WhatsApp next
        const waBtn = document.getElementById("successWaBtn");
        if (waBtn && productId) {
          const product = await API.fetchProduct(productId).catch(() => null);
          if (product) {
            waBtn.href = CONFIG.getWhatsAppURL(
              product,
              selectedSize,
              selectedColor,
              {
                name: orderData.customerName,
                phone: orderData.customerPhone,
                address: orderData.customerAddress,
                note: orderData.customerNote,
              },
            );
            waBtn.style.display = "inline-flex";
          }
        }
        window.KicksyUtils?.Toast?.show(
          "Order submitted! We'll contact you soon.",
          "success",
        );
      } else {
        window.KicksyUtils?.Toast?.show(
          result.message || "Submission failed. Please try WhatsApp.",
          "error",
        );
      }
    });

    function validateField(el, fields) {
      const key = Object.entries(fields).find(([, v]) => v.el === el)?.[0];
      if (!key) return null;
      const { rules } = fields[key];
      const error = validate(el.value, rules);
      const wrapper = el.closest(".form-field");
      if (error) {
        setFieldError(wrapper, error);
        return error;
      } else {
        clearFieldError(wrapper);
        return null;
      }
    }
  }

  // ── Contact Form ───────────────────────────────────────────
  function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const fields = {
      name: {
        el: form.querySelector('[name="name"]'),
        rules: [validators.required, validators.minLength(2)],
      },
      phone: {
        el: form.querySelector('[name="phone"]'),
        rules: [validators.phone],
      },
      email: {
        el: form.querySelector('[name="email"]'),
        rules: [validators.email],
      },
      message: {
        el: form.querySelector('[name="message"]'),
        rules: [validators.required, validators.minLength(10)],
      },
    };

    Object.values(fields).forEach(({ el }) => {
      if (!el) return;
      el.addEventListener("input", () =>
        clearFieldError(el.closest(".form-field")),
      );
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Honeypot
      if (form.querySelector('[name="hp_website"]')?.value) return;

      let valid = true;
      Object.values(fields).forEach(({ el, rules }) => {
        const error = validate(el.value, rules);
        const wrapper = el.closest(".form-field");
        if (error) {
          setFieldError(wrapper, error);
          valid = false;
        } else clearFieldError(wrapper);
      });
      if (!valid) return;

      const captcha = getCaptchaToken(form);
      if (captcha?.configured && captcha.hasSiteKey && !captcha.token) {
        window.KicksyUtils?.Toast?.show(
          "Please complete the captcha verification.",
          "error",
        );
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      showSpinner(submitBtn, true);

      const messageData = {
        name: fields.name.el.value.trim(),
        phone: fields.phone.el?.value.trim() || "",
        email: fields.email.el?.value.trim() || "",
        message: fields.message.el.value.trim(),
        source: "contact_form",
        ...(captcha?.token ? { "g-recaptcha-response": captcha.token } : {}),
      };

      const result = await API.createMessage(messageData);
      showSpinner(submitBtn, false);
      resetCaptcha();

      if (result.success !== false) {
        form.reset();
        const success = document.getElementById("contactSuccess");
        if (success) success.classList.add("show");
        window.KicksyUtils?.Toast?.show(
          "Message sent! We'll reply soon.",
          "success",
        );
      } else {
        window.KicksyUtils?.Toast?.show(
          "Failed to send. Please reach us on WhatsApp.",
          "error",
        );
      }
    });
  }

  // ── Product detail: sync form hidden fields ────────────────
  function syncProductFields(product, size, color) {
    const form = document.getElementById("orderForm");
    if (!form || !product) return;

    const set = (name, val) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = val;
    };
    set("productId", product.id);
    set("productName", product.name);
    set("brand", product.brand);
    set("price", product.salePrice || product.price);
    set("selectedSize", size);
    set("selectedColor", color);
  }

  function init() {
    initOrderForm();
    initContactForm();
  }

  return { init, syncProductFields };
})();

document.addEventListener("DOMContentLoaded", Forms.init);
