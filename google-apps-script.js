// ============================================================
// KICKSY NEPAL — GOOGLE APPS SCRIPT
// Save as: google-apps-script.js (paste into Apps Script editor)
//
// DEPLOYMENT STEPS:
// 1. Go to script.google.com → New Project
// 2. Paste this entire file replacing the default code
// 3. Click Deploy → New Deployment → Web App
// 4. Execute as: Me | Who has access: Anyone
// 5. Click Deploy → Copy the Web App URL
// 6. Paste that URL into assets/js/config.js → GOOGLE_SCRIPT_URL
// ============================================================

const SHEET_NAME = {
  PRODUCTS:         "Products",
  LEATHER_PRODUCTS: "LeatherProducts",
  ORDERS:           "Orders",
  TESTIMONIALS:     "Testimonials",
  OFFERS:           "Offers",
  COUPONS:          "Coupons",
  MESSAGES:         "Messages",
  SETTINGS:         "SiteSettings",
};

// ── Entry point: GET ───────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || "";
    const id     = e.parameter.id    || "";

    switch (action) {
      case "products":        return jsonResponse({ success: true, data: getProducts() });
      case "leatherProducts": return jsonResponse({ success: true, data: getLeatherProducts() });
      case "product":         return jsonResponse({ success: true, data: findProductById(id) });
      case "testimonials":    return jsonResponse({ success: true, data: getActiveTestimonials() });
      case "offers":          return jsonResponse({ success: true, data: getActiveOffers() });
      case "siteSettings":    return jsonResponse({ success: true, data: getSiteSettings() });
      case "debug":           return jsonResponse({ success: true, data: getDebugInfo() });
      default:                return jsonResponse({ success: false, message: "Unknown action" });
    }
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

// ── Entry point: POST ──────────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";

    switch (action) {
      case "createOrder":   return jsonResponse(handleCreateOrder(body));
      case "createMessage": return jsonResponse(handleCreateMessage(body));
      default:              return jsonResponse({ success: false, message: "Unknown action" });
    }
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

// ── JSON response helper ───────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Get sheet data as array of objects ────────────────────
function getSheetData(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const [headers, ...rows] = sheet.getDataRange().getValues();
  // Trim header names — guards against trailing/leading spaces from
  // copy-pasting headers (e.g. "available " would otherwise not match
  // the "available" property lookups used everywhere below).
  const cleanHeaders = headers.map(h => String(h).trim());

  return rows
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .map(row => {
      const obj = {};
      cleanHeaders.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
      return obj;
    });
}

// ── Append a row to a sheet ────────────────────────────────
function appendRow(sheetName, data, headers) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const row = headers.map(h => data[h] !== undefined ? data[h] : "");
  sheet.appendRow(row);
}

// ── Products (shoes) ─────────────────────────────────────────
function getProducts() {
  return getSheetData(SHEET_NAME.PRODUCTS)
    .filter(isAvailable)
    .map(p => sanitizeProduct(p, "shoe"));
}

// ── Leather Goods (separate tab, simplified schema) ──────────
function getLeatherProducts() {
  return getSheetData(SHEET_NAME.LEATHER_PRODUCTS)
    .filter(isAvailable)
    .map(p => sanitizeProduct(p, "leather"));
}

// A product is considered available unless its `available` cell is
// EXPLICITLY set to FALSE (text "FALSE"/"false" or an unchecked
// checkbox = boolean false). A completely blank cell (most common
// when a new row is added and the column wasn't filled in yet)
// defaults to AVAILABLE so new products don't silently disappear.
function isAvailable(p) {
  const v = p.available;
  if (v === "" || v === null || v === undefined) return true;
  return parseBoolean(v);
}

// ── Find a single product by ID across BOTH tabs ─────────────
function findProductById(id) {
  if (!id) throw new Error("Product ID required");

  const shoes = getSheetData(SHEET_NAME.PRODUCTS);
  const shoeMatch = shoes.find(p => String(p.id) === String(id));
  if (shoeMatch) return sanitizeProduct(shoeMatch, "shoe");

  const leather = getSheetData(SHEET_NAME.LEATHER_PRODUCTS);
  const leatherMatch = leather.find(p => String(p.id) === String(id));
  if (leatherMatch) return sanitizeProduct(leatherMatch, "leather");

  throw new Error(`Product "${id}" not found`);
}

// Never expose cost/profit data; tag productType based on source tab
function sanitizeProduct(p, productType) {
  const safe = Object.assign({}, p);
  delete safe.costPrice;
  delete safe.profit;
  safe.productType = productType;
  return safe;
}

// ── Debug helper ──────────────────────────────────────────────
// Visit <YOUR_SCRIPT_URL>?action=debug in a browser to see exactly
// what this script reads from your sheets — useful for diagnosing
// "products not showing" issues (wrong tab name, header typos,
// available flag, etc.)
function getDebugInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const productsSheet = ss.getSheetByName(SHEET_NAME.PRODUCTS);
  const leatherSheet  = ss.getSheetByName(SHEET_NAME.LEATHER_PRODUCTS);

  const productsRaw = getSheetData(SHEET_NAME.PRODUCTS);
  const leatherRaw  = getSheetData(SHEET_NAME.LEATHER_PRODUCTS);

  return {
    productsTab: {
      sheetFound:      !!productsSheet,
      sheetName:       SHEET_NAME.PRODUCTS,
      headerRow:       productsSheet ? productsSheet.getDataRange().getValues()[0] : [],
      totalRows:       productsRaw.length,
      availableRows:   productsRaw.filter(isAvailable).length,
      firstRowSample:  productsRaw[0] || null,
    },
    leatherProductsTab: {
      sheetFound:      !!leatherSheet,
      sheetName:       SHEET_NAME.LEATHER_PRODUCTS,
      headerRow:       leatherSheet ? leatherSheet.getDataRange().getValues()[0] : [],
      totalRows:       leatherRaw.length,
      availableRows:   leatherRaw.filter(isAvailable).length,
      firstRowSample:  leatherRaw[0] || null,
    },
  };
}

// ── Testimonials ───────────────────────────────────────────
function getActiveTestimonials() {
  return getSheetData(SHEET_NAME.TESTIMONIALS)
    .filter(t => parseBoolean(t.active));
}

// ── Offers ─────────────────────────────────────────────────
function getActiveOffers() {
  const now = new Date();
  return getSheetData(SHEET_NAME.OFFERS)
    .filter(o => {
      if (!parseBoolean(o.active)) return false;
      if (o.startDate && new Date(o.startDate) > now) return false;
      if (o.endDate   && new Date(o.endDate)   < now) return false;
      return true;
    })
    .sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));
}

// ── Site settings ──────────────────────────────────────────
function getSiteSettings() {
  const rows = getSheetData(SHEET_NAME.SETTINGS);
  const settings = {};
  rows.forEach(row => { if (row.key) settings[row.key] = row.value; });
  return settings;
}

// ── Create order ───────────────────────────────────────────
function handleCreateOrder(data) {
  const validation = validateOrder(data);
  if (!validation.valid) return { success: false, message: validation.message };

  const orderId = generateOrderId();
  const headers = [
    "timestamp", "orderId", "productId", "productName", "brand",
    "selectedSize", "selectedColor", "price", "customerName",
    "customerPhone", "customerAddress", "customerNote", "whatsappOpened", "status"
  ];

  appendRow(SHEET_NAME.ORDERS, {
    timestamp:       new Date().toISOString(),
    orderId:         orderId,
    productId:       String(data.productId    || ""),
    productName:     String(data.productName  || ""),
    brand:           String(data.brand        || ""),
    selectedSize:    String(data.selectedSize || ""),
    selectedColor:   String(data.selectedColor|| ""),
    price:           Number(data.price)       || 0,
    customerName:    String(data.customerName || ""),
    customerPhone:   String(data.customerPhone|| ""),
    customerAddress: String(data.customerAddress || ""),
    customerNote:    String(data.customerNote || ""),
    whatsappOpened:  Boolean(data.whatsappOpened),
    status:          "New",
  }, headers);

  return { success: true, orderId, message: "Order received successfully." };
}

function validateOrder(data) {
  // Allow WhatsApp-only logs (minimal validation)
  if (data.whatsappOpened) return { valid: true };
  // Full form submission requires customer details
  if (!data.customerName  || String(data.customerName).trim().length < 2)
    return { valid: false, message: "Customer name is required." };
  if (!data.customerPhone || String(data.customerPhone).trim().length < 8)
    return { valid: false, message: "Valid phone number is required." };
  if (!data.customerAddress || String(data.customerAddress).trim().length < 5)
    return { valid: false, message: "Delivery address is required." };
  return { valid: true };
}

function generateOrderId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `KSY-${ts}-${rand}`;
}

// ── Create message ─────────────────────────────────────────
function handleCreateMessage(data) {
  if (!data.name || String(data.name).trim().length < 2)
    return { success: false, message: "Name is required." };
  if (!data.message || String(data.message).trim().length < 5)
    return { success: false, message: "Message is required." };

  const headers = ["timestamp", "name", "phone", "email", "message", "source"];
  appendRow(SHEET_NAME.MESSAGES, {
    timestamp: new Date().toISOString(),
    name:      String(data.name    || "").trim(),
    phone:     String(data.phone   || "").trim(),
    email:     String(data.email   || "").trim(),
    message:   String(data.message || "").trim(),
    source:    String(data.source  || "contact_form"),
  }, headers);

  return { success: true, message: "Message received. We'll get back to you soon." };
}

// ── Helpers ────────────────────────────────────────────────
function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string")  return value.trim().toLowerCase() === "true";
  return Boolean(value);
}
