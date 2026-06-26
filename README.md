# Kicksy Nepal — Complete Setup & Deployment Guide

Premium online shoe store | HTML + CSS + Vanilla JS + Google Sheets + Cloudflare Pages

---

## 📁 Project Structure

```
kicksy-nepal/
├── index.html                 # Homepage
├── shop.html                  # Shop / shoe listing
├── leather.html               # Leather Goods listing (wallets, sleeves, etc.)
├── product.html               # Product detail page (shared by shoes + leather)
├── about.html                 # About page
├── contact.html               # Contact + FAQ page
├── terms.html                 # Terms & Conditions page
├── 404.html                   # Custom 404 page
├── _redirects                 # Cloudflare Pages clean-URL routing rules
├── serve.js                   # Zero-dependency local dev server (clean URLs, matches production)
├── sitemap.xml                # SEO sitemap (includes per-product URLs)
├── robots.txt                 # Search crawler rules
├── site.webmanifest           # PWA manifest (icons, theme color)
├── google-apps-script.js      # Google Apps Script backend (paste into Apps Script)
├── README.md                  # This file
└── assets/
    ├── css/
    │   └── styles.css         # Full stylesheet with CSS variables + animations
    ├── js/
    │   ├── config.js          # ⚠️ All config: WhatsApp, API URL, site settings, sample data
    │   ├── api.js             # Google Sheets API layer with caching & fallback
    │   ├── main.js            # Navigation, homepage sections, scroll animations
    │   ├── shop.js            # Shop page: filtering, sorting, pagination (shoes)
    │   ├── leather.js         # Leather Goods page: category filtering, sorting, pagination
    │   ├── product.js         # Product detail: gallery, selectors, stock (shared)
    │   ├── forms.js           # Order & contact form validation + submission
    │   └── seo.js             # Dynamic SEO/meta tag + breadcrumb schema updates
    └── images/
        ├── favicon.svg            # Source favicon (K monogram, brand colors)
        ├── favicon.ico            # Multi-size ICO (16/32/48px)
        ├── favicon-16x16.png
        ├── favicon-32x32.png
        ├── favicon-48x48.png
        ├── apple-touch-icon.png   # 180×180 for iOS home screen
        ├── icon-192.png           # PWA icon
        ├── icon-512.png           # PWA icon + schema logo
        └── og-image.jpg           # 1200×630 social share image (auto-generated)
```

---

## ⚡ Placeholders — Replace Before Launch

| File | Variable | What to Replace |
|------|----------|-----------------|
| `assets/js/config.js` | `WHATSAPP_NUMBER` | Your WhatsApp number with country code (no +) |
| `assets/js/config.js` | `GOOGLE_SCRIPT_URL` | Your deployed Apps Script Web App URL |
| `assets/js/config.js` | `FORMSPREE_ENDPOINT` | Your Formspree form endpoint (e.g. `https://formspree.io/f/xxxxxxxx`) — sends order/contact email notifications |
| `contact.html` and `product.html` | `YOUR_RECAPTCHA_SITE_KEY` | Your Google reCAPTCHA v2 site key (see "CAPTCHA setup" below) — required only if you've enabled reCAPTCHA in your Formspree form settings |
| `assets/js/config.js` | `SITE_URL` | `https://kicksy.com.np` (or your domain) |
| `assets/js/config.js` | `INSTAGRAM_URL` | Your Instagram URL |
| `assets/js/config.js` | `FACEBOOK_URL` | Your Facebook page URL |
| `assets/js/config.js` | `TIKTOK_URL` | Your TikTok URL |
| `assets/images/og-image.jpg` | — | Optional: replace with a real product photo (1200×630px) for richer social previews |
| `assets/images/favicon.svg` + generated icons | — | Optional: replace with your real logo (regenerate PNGs/ICO if changed) |
| `assets/images/favicon-leather.svg` + `favicon-leather-32x32.png` + `favicon-leather-16x16.png` + `apple-touch-icon-leather.png` | — | **Required for the dynamic Leather favicon to work.** These files don't exist yet in this template — generate them from your Kicksy Leather logo (same process as the regular favicon: export an SVG, then generate the PNG sizes) and drop them into `assets/images/`. `leather.html` and any leather product viewed on `product.html` will automatically pick them up once the files exist; until then, the browser will just silently fail to load that specific icon and may fall back to the regular favicon or a blank tab icon. |
| All `.html` files | WhatsApp links | Update `wa.me/9779763374989` to your number |
| `sitemap.xml` | `lastmod` dates + product `id`s | Update dates and add/remove product URLs as your catalog changes |

---

## 🐛 Bug Fixes Applied (Audit Log)

This codebase has been audited for bugs. Key fixes applied:

1. **Duplicate filter element IDs** — the mobile filter drawer and desktop sidebar shared identical IDs (`brandFilters`, `priceMin`, `availToggle`, etc.), so on mobile the filter controls silently did nothing. Fixed by giving the mobile drawer unique IDs and rewriting `shop.js` to keep both sets in sync via shared classes (`.js-brand-filters`, `.js-price-min`, etc.).
2. **Order form fields never populated** — `Forms.syncProductFields()` was defined but never called, so order inquiries submitted from the product page had empty `productId`/`size`/`color`/`price` fields in Google Sheets. Fixed by calling it after render and on every color/size selection.
3. **Color/size combo bug** — switching color while a now-out-of-stock size was selected left the order button active for an invalid combination. Fixed: selecting a size unavailable for the new color auto-deselects it.
4. **Shop URL state loss** — `min`/`max` price filters and multi-select brand/size/color filters were written to the URL but never read back, so refreshing or sharing a filtered shop link lost those filters. Fixed.
5. **Duplicate JSON key** in sample New Balance stock data (`"42"` appeared twice, `"44"` was missing for the Navy colorway) — corrected.
6. **`robots.txt` blocked `/assets/js/`** — since this site renders all product/shop content via JavaScript, this prevented Googlebot from indexing dynamic content correctly. Fixed: JS is now crawlable.
7. **`seo.js` was loaded but never used** on the shop page, and `product.js` had a partially-duplicated SEO update function. Consolidated: `seo.js` now handles meta/OG/Twitter/canonical/breadcrumb schema for both shop and product pages.
8. Removed dead/duplicate CSS rules (old `.faq-a` display toggle superseded by the new grid-based animation, duplicate `.stats-grid`, `.toast`, `.search-box`, `.coupon-banner` definitions merged).

---

## 🗄️ Google Sheets Setup

### Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → Create a new spreadsheet
2. Name it: **Kicksy Nepal**
3. Create these tabs (sheet names are case-sensitive):

### Tab: Products (Shoes)

> ⚠️ **Architecture note:** Shoes and leather goods now live in **two separate sheet tabs** — `Products` (shoes) and `LeatherProducts` (wallets, sleeves, etc.). Each tab is fetched independently (`shop.html` reads only `Products`; `leather.html` reads only `LeatherProducts`), so the two categories can never cross-contaminate each other's listings regardless of what's in either sheet. The backend automatically tags every product with `productType: "shoe"` or `"leather"` based on which tab it came from — **you do not need a `productType` column in either sheet.**

Add this exact header row in row 1:

```
id | sku | name | brand | category | gender | price | salePrice | costPrice | profit | description | shortDescription | image1 | image2 | image3 | image4 | image5 | sizes | colors | stockJson | available | featured | bestSeller | dailyPick | newArrival | tags | rating | reviewCount | deliveryInfo | createdAt | updatedAt
```

**Sample data row:**

| id | sku | name | brand | category | gender | price | salePrice | costPrice | profit | description | shortDescription | image1 | image2 | image3 | image4 | image5 | sizes | colors | stockJson | available | featured | bestSeller | dailyPick | newArrival | tags | rating | reviewCount | deliveryInfo | createdAt | updatedAt |
|----|-----|------|-------|----------|--------|-------|-----------|-----------|--------|-------------|------------------|--------|--------|--------|-------|--------|-----------|-----------|----------|------------|-----------|------------|------|--------|-------------|--------------|-----------|-----------|
| nike-air-force-1-001 | NK-AF1-001 | Air Force 1 Low | Nike | Lifestyle | Unisex | 12000 | 9500 | 0 | 0 | The Nike Air Force 1 Low is a timeless classic... | Iconic low-top sneaker with Air cushioning. | https://... | https://... | | 39,40,41,42,43,44 | White,Black | {"White":{"39":3,"40":5,"41":4},"Black":{"39":2,"40":4,"41":3}} | TRUE | TRUE | TRUE | FALSE | FALSE | classic,low-top,lifestyle | 4.8 | 124 | 3–5 working days | 2025-01-01 | 2025-01-01 |

**Field notes:**
- `id` — unique, URL-friendly (lowercase, hyphens only)
- `category` — free-text style category (e.g. "Lifestyle", "Running", "Basketball")
- `price` — original/old price (shown struck through)
- `salePrice` — current selling price (shown prominently)
- `costPrice` / `profit` — internal only, NEVER shown on frontend
- `sizes` — comma-separated EU sizes: `39,40,41,42,43`
- `colors` — comma-separated: `Black,White,Beige`
- `stockJson` — JSON tracking stock per color/size:
  ```json
  {"Black":{"40":2,"41":1},"White":{"39":3,"42":2}}
  ```
- `available` — `TRUE` / `FALSE`
- `featured`, `bestSeller`, `dailyPick`, `newArrival` — `TRUE` / `FALSE`

---

### Tab: LeatherProducts (Leather Goods)

A **separate tab** for wallets, card holders, sunglasses cases, laptop/phone/keyring sleeves, belts, pouches, etc. Powers `leather.html`. Uses a **leaner schema** than `Products` — no `gender`, `costPrice`, `profit`, or `updatedAt` columns needed.

Add this exact header row in row 1:

```
id | sku | name | brand | category | price | salePrice | description | shortDescription | image1 | image2 | image3 | image4 | image5 | sizes | colors | stockJson | available | featured | bestSeller | dailyPick | newArrival | customizable | tags | rating | reviewCount | deliveryInfo | createdAt
```

> ✨ **New column:** `customizable` (`TRUE`/`FALSE`) — set to `TRUE` for items where you offer custom sizing on request (e.g. belts, laptop sleeves). Shows a "Customizable" badge on the product card and product page, plus a "Ask about custom sizing on WhatsApp" link next to the size selector.

**Sample data rows:**

| id | sku | name | brand | category | price | salePrice | description | shortDescription | image1 | sizes | colors | stockJson | available | featured | bestSeller | dailyPick | newArrival | customizable | tags | rating | reviewCount | deliveryInfo | createdAt |
|----|-----|------|-------|----------|-------|-----------|-------------|------------------|--------|-------|--------|-----------|-----------|----------|------------|-----------|------------|--------------|------|--------|-------------|--------------|-----------|
| leather-bifold-wallet-001 | LW-BF-001 | Classic Bifold Wallet | Kicksy Leather | Wallets | 3500 | 2499 | Handcrafted from full-grain leather... | Slim full-grain leather bifold with 6 card slots. | https://... | *(empty)* | Brown,Black,Tan | {"Brown":{"-":8},"Black":{"-":6},"Tan":{"-":4}} | TRUE | TRUE | TRUE | FALSE | FALSE | FALSE | wallet,leather,bifold | 4.8 | 64 | 3–5 working days | 2025-04-01 |
| leather-laptop-sleeve-13-001 | LW-LS13-001 | Laptop Sleeve 13-inch | Kicksy Leather | Laptop Sleeves | 5500 | 3999 | Protect your laptop in style... | Premium leather sleeve for 13-inch laptops. | https://... | 13-inch,14-inch,15-inch | Brown,Black,Grey | {"Brown":{"13-inch":4,"14-inch":3,"15-inch":2},...} | TRUE | TRUE | TRUE | FALSE | FALSE | TRUE | laptop,sleeve,leather | 4.9 | 38 | 3–5 working days | 2025-04-12 |

**Field notes:**
- `id` — unique, URL-friendly (lowercase, hyphens only). Recommended prefix: `leather-`
- `category` — the **filterable sub-category** shown on the Leather Goods page: `Wallets`, `Card Holders`, `Sunglasses Cases`, `Laptop Sleeves`, `Phone Sleeves`, `Keyring Sleeves`, `Belts`, `Pouches`. Add new categories freely — they're picked up automatically by the filter UI.
- `price` / `salePrice` — same as Products tab
- `sizes` — comma-separated. Use for goods with real variants (e.g. laptop sleeves: `13-inch,14-inch,15-inch`, belts: `32,34,36,38,40`). **Leave empty** for goods with no size variant (wallets, card holders, sunglasses cases, keyring sleeves) — the size selector won't render and stock falls back to the `available` flag.
- `colors` — comma-separated: `Brown,Black,Tan`
- `stockJson` — same format as Products. For items with no size variant, use `"-"` as the size key:
  ```json
  {"Brown":{"-":8},"Black":{"-":6}}
  ```
  If `stockJson` is left empty (`{}` or blank), stock status falls back to the `available` TRUE/FALSE flag.
- `available`, `featured`, `bestSeller`, `dailyPick`, `newArrival`, `customizable` — `TRUE` / `FALSE`, same as Products (leave `available` blank to default to TRUE)

---

### Tab: Orders

Header row:
```
timestamp | orderId | productId | productName | brand | selectedSize | selectedColor | price | customerName | customerPhone | customerAddress | customerNote | whatsappOpened | status
```

Leave rows empty — orders will be added automatically by the Apps Script.

---

### Email notifications (Formspree)

Order/contact submissions are sent to [Formspree](https://formspree.io), which emails you the moment someone places an order or sends a message. The site also attempts to log the same submission to your Google Sheet for record-keeping.

**Why Formspree is the primary channel:** Google Apps Script Web Apps don't reliably support CORS for `POST` requests with a JSON body sent from a browser — the request can be blocked by the browser even though the script itself would have run fine, since Apps Script doesn't respond to the CORS preflight `OPTIONS` request. Because of this, the Sheets write is treated as **best-effort**: it's attempted in the background, but the customer-facing success/failure message is based on Formspree's response, since Formspree is built to handle browser form submissions correctly.

- Configured in `assets/js/config.js` → `FORMSPREE_ENDPOINT`
- If Formspree succeeds, the customer sees "Order submitted!" / "Message sent!" — even if the Sheets write happens to fail in the background (a warning is logged quietly to the browser console in that case, e.g. `Sheets order logging failed... Failed to fetch`)
- If Formspree itself fails (e.g. you've exceeded the free tier's 50 submissions/month, or it's briefly down), the customer is told to try WhatsApp instead — this is the one signal you should actually treat as "did this order really go through"
- Order emails get the subject line `🛍️ New Order — <product name>`; contact messages get `✉️ New Contact Message — Kicksy Nepal`
- **Always double-check your Formspree dashboard or inbox** as the source of truth for orders — the Google Sheet `Orders`/`Messages` tabs are a convenience copy, not guaranteed to capture every submission given the CORS limitation above

### CAPTCHA setup (Google reCAPTCHA v2)

Both the contact form (`contact.html`) and the order form (`product.html`) include a reCAPTCHA v2 checkbox widget, matching Formspree's reCAPTCHA option (Settings → your form → Spam Filtering). To activate it:

1. Go to [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin), create a new site, choose **reCAPTCHA v2 → "I'm not a robot" Checkbox**, and add your domain (`kicksy.com.np`, plus `localhost` if you want to test locally)
2. Copy the **Site Key** and paste it into the `data-sitekey="YOUR_RECAPTCHA_SITE_KEY"` attribute in both `contact.html` and `product.html` (search for `YOUR_RECAPTCHA_SITE_KEY`)
3. Copy the **Secret Key** and paste it into your Formspree form's Settings → Spam Filtering → reCAPTCHA field
4. Until you complete step 2, the captcha widget is effectively inactive and submissions work exactly as before (no false blocking) — once a real site key is in place, the form will require the checkbox to be completed before submitting

**Why hCaptcha doesn't work here:** if you ever see the error *"The sitekey for the hcaptcha is incorrect"*, it means the front-end is loading hCaptcha's widget/script while your Formspree dashboard has **reCAPTCHA** enabled (or vice versa) — these are two separate, incompatible services, and Formspree only validates whichever one is actually selected in your form's settings. The site is configured for reCAPTCHA by default since that's Formspree's default option; if you'd prefer to switch to hCaptcha instead (its free tier is 10,000 verifications/month, more generous than reCAPTCHA's free tier as of 2026), you'd need to: change the script tag back to `https://js.hcaptcha.com/1/api.js`, change `g-recaptcha`/`data-sitekey` to `h-captcha`/`data-sitekey` with your hCaptcha site key, change the field name back to `h-captcha-response` in `assets/js/forms.js`, and switch your Formspree form's setting from reCAPTCHA to hCaptcha.

---

### Tab: Testimonials

Header row:
```
id | customerName | customerImage | review | productName | rating | active
```

Sample data:
```
t1 | Priya Shrestha | | Ordered Nike Air Force 1s and they arrived perfectly. Quality is premium at a great price! | Nike Air Force 1 Low | 5 | TRUE
t2 | Rohan Tamang | | Fast delivery to Pokhara! Easy WhatsApp ordering. Will buy again. | Adidas Stan Smith | 5 | TRUE
t3 | Sita Gurung | | Great quality shoes and always genuine. 10/10 recommend! | Converse Chuck Taylor | 5 | TRUE
```

---

### Tab: Offers

Header row:
```
id | title | description | badgeText | image | active | priority | startDate | endDate
```

Sample:
```
o1 | Free Delivery This Week | Free delivery on orders above Rs. 8000 | FREE DELIVERY | | TRUE | 1 | | 
```

---

### Tab: Coupons

Header row:
```
id | title | description | type | value | active | note
```

Sample:
```
c1 | 4th Order Discount | 10% off on your 4th order | percent | 10 | TRUE | Mention when ordering on WhatsApp
```

---

### Tab: Messages

Header row:
```
timestamp | name | phone | email | message | source
```

Leave empty — contact form messages will be added automatically.

---

### Tab: SiteSettings

> ⚠️ **Tab name must be exactly `SiteSettings`** (capital S, capital S). Google Sheets tab names are matched case-sensitively by the Apps Script — naming it `Sitesettings`, `sitesettings`, or `Site Settings` (with a space) will cause `getSheetByName()` to return nothing, and the feature will silently do nothing (the site will just keep showing its hardcoded fallback text — nothing will break, but your sheet edits won't appear).

Header row:
```
key | value
```

Add rows for whichever fields you want to manage from the sheet instead of hardcoded HTML. Only `whatsappDisplay`, `email`, `address`, and `deliveryNote` are currently wired up to actually appear anywhere on the site (in the footer's Contact column, across all pages) — add more rows freely, but they'll only take visual effect once you also add a matching `data-site-setting="yourKey"` attribute to an element in the HTML (see "How this connects to the front-end" below).

```
whatsappDisplay | +977 976 337 4989
email | info@kicksy.com.np
address | Kathmandu, Nepal
deliveryNote | Nationwide Delivery
```

**How this connects to the front-end:**
- `assets/js/api.js` → `fetchSiteSettings()` calls the Apps Script (`?action=siteSettings`), which returns every row in this tab as a flat `{key: value}` object
- `assets/js/main.js` → `initSiteSettings()` runs on every page load, finds every element with a `data-site-setting="someKey"` attribute, and replaces its text with `settings[someKey]` — but only if that key exists and is non-empty in the sheet
- If the sheet is empty, the tab is missing/misnamed, or the Apps Script is unreachable, every element simply keeps its original hardcoded text — this integration is fully optional and **cannot break the site**, even if you never touch the sheet at all
- To wire up an additional field (e.g. a delivery-timeframe sentence on the About page), add the row to the sheet, then add `data-site-setting="deliveryTimeframe"` to the relevant HTML element and it will pick up the value automatically on next page load — no further JS changes needed

---

## 🚀 Google Apps Script Setup

### Step 1: Open Apps Script
1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete all default code in the editor

### Step 2: Paste the Script
1. Open `google-apps-script.js` from this project
2. Copy the entire contents
3. Paste into the Apps Script editor
4. Click **Save** (Ctrl+S or ⌘+S)

### Step 3: Deploy as Web App
1. Click **Deploy → New Deployment**
2. Click the gear icon ⚙️ next to "Type" → select **Web App**
3. Fill in:
   - **Description:** `Kicksy Nepal API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

### Step 4: Authorize
- Click **Authorize access** when prompted
- Choose your Google account
- Click **Advanced → Go to Kicksy Nepal (unsafe)** → **Allow**

### Step 5: Update config.js
Open `assets/js/config.js` and replace:
```javascript
GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
```
with your actual deployed URL.

### ⚠️ Re-deploying after changes
When you update the Apps Script code, you must create a **New Deployment** (not update existing) or your changes won't take effect. Each new deployment gets a new URL.

---

## 💻 Running Locally

### ⚠️ Important: clean URLs need a clean-URL-aware server
This project's internal links use clean URLs (`/about` instead of `about.html`). Cloudflare Pages handles this automatically in production, but most simple local dev tools do **not** — they only know about real files on disk, so clicking a nav link locally can show **"Cannot GET /about"** or a plain 404, even though the live site works fine. This is a local-preview-only limitation, not a bug in the site itself.

### Option 1: `serve.js` (recommended — matches production exactly)
A zero-dependency local server is included that replicates Cloudflare Pages' clean-URL behavior precisely:
```bash
cd kicksy-nepal
node serve.js
# Open: http://localhost:8080
```
This correctly serves `/about` → `about.html`, `/leather` → `leather.html`, `/product?id=...` → `product.html`, falls back to `404.html` for anything that doesn't match, and still serves `about.html` directly too (so any bookmarked old-style links keep working). Requires only Node.js — no `npm install` needed.

### Option 2: Open directly (no server)
```
Double-click index.html
```
Works for basic browsing, but clean URLs (`/about`, `/leather`, etc.) won't resolve at all this way, since there's no server translating them — you'd need to manually open `about.html` instead. Some browsers may also block local file requests entirely (CORS), in which case products won't load. Use Option 1 instead if you hit either issue.

### Option 3: Plain static servers (⚠️ clean URLs will NOT work)
```bash
python -m http.server 8080      # /about will 404
npx serve .                      # /about will 404 unless you pass --clean-urls (or it's auto-enabled in your version — behavior varies)
```
These serve files by their literal name only. If you use one of these and need to test a specific page, browse to the `.html` filename directly (`http://localhost:8080/about.html`) rather than the clean path.

**The site will use sample products from config.js when the API is unavailable — this is normal and expected during local development.**

---

## 📦 GitHub Setup

### Step 1: Create GitHub repository
1. Go to [github.com](https://github.com) → **New repository**
2. Name: `kicksy-nepal` (or any name)
3. Set to **Public**
4. Don't initialise with README (you already have one)
5. Click **Create repository**

### Step 2: Push your code
```bash
cd kicksy-nepal
git init
git add .
git commit -m "Initial commit — Kicksy Nepal website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kicksy-nepal.git
git push -u origin main
```

---

## ☁️ Cloudflare Pages Deployment

### Step 1: Connect to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create Application** → **Pages**
3. Click **Connect to Git** → **GitHub**
4. Authorise Cloudflare to access your GitHub
5. Select your `kicksy-nepal` repository
6. Click **Begin setup**

### Step 2: Build settings
| Setting | Value |
|---------|-------|
| Project name | `kicksy-nepal` |
| Production branch | `main` |
| Build command | *(leave empty)* |
| Build output directory | `/` |
| Root directory | `/` |

Click **Save and Deploy**.

### Step 3: Custom domain (kicksy.com.np)
1. After deployment, go to your Pages project
2. Click **Custom domains** → **Set up a custom domain**
3. Enter: `kicksy.com.np`
4. Cloudflare will show DNS records to add
5. If your domain is on Cloudflare: records are added automatically
6. If on another registrar: add the CNAME record they show you

**DNS record to add:**
```
Type: CNAME
Name: @ (or kicksy.com.np)
Target: kicksy-nepal.pages.dev
```

### Step 4: 404 handling
Cloudflare Pages automatically serves `404.html` for missing pages. ✅

### Step 4.5: Clean URLs (no `.html` in the address bar)
Cloudflare Pages automatically serves every `.html` file at its extensionless path — `about.html` is reachable at both `/about.html` and `/about`, with the `.html` version redirecting (308) to the clean one. This usually requires zero configuration. As a safety net, this project also includes a `_redirects` file at the project root that explicitly rewrites `/about` → `/about.html` (and the same for every other page) — Cloudflare Pages reads this format natively, so it's a guaranteed fallback in case the automatic behavior is ever disabled or doesn't apply to your specific project setup. (`.htaccess` is an Apache-specific mechanism and has no effect on Cloudflare Pages — don't use it here.)

If you deploy and still see "Cannot GET /about" or a 404 on a clean URL on the **live** site specifically (not just locally — see "Running Locally" below for that case), double check: the `_redirects` file made it into your deployed build (it must sit at the project root, same level as `index.html`); your Cloudflare Pages project's "Build output directory" setting is `/` and not a subfolder; and that you're not running a Cloudflare Worker or Pages Function in front of the site that intercepts the request before Pages' static routing ever sees it.

All internal `<a href>` links across every page already use the clean form (e.g. `href="/leather"` instead of `href="leather.html"`) — so links inside the site always go straight to the clean URL rather than round-tripping through a redirect.

One nuance worth knowing: the **extensionless** path (`/leather`, no trailing slash) is what's auto-handled. A **trailing-slash folder-style** URL (`/leather/`) is a different request — Cloudflare would look for `leather/index.html`, which doesn't exist in this project's flat file structure, and that specific form would 404. Always link to `/leather`, not `/leather/`.

### Step 5: Verify deployment
Visit your site URL and confirm:
- [ ] Homepage loads with products
- [ ] Shop page filters work
- [ ] Product detail opens correctly
- [ ] WhatsApp button opens with correct message
- [ ] Order form submits to Google Sheets
- [ ] Contact form submits to Google Sheets

---

## 🔄 Updating Products

1. Open your Google Sheet
2. Go to the **Products** tab
3. Add/edit/remove product rows
4. Changes reflect on the website within **5 minutes** (cache TTL)
5. To force immediate refresh: clear browser cache or wait for TTL

**Image hosting — Recommended: ImageKit.io**

This project uses [ImageKit.io](https://imagekit.io) for product image hosting and delivery (free tier: 20GB storage + 20GB bandwidth/month). Benefits:
- On-the-fly resizing, cropping, and format conversion via URL parameters (no manual image processing)
- Automatic WebP/AVIF delivery to supporting browsers (`f-auto`)
- Built-in CDN for fast global delivery

**Setup:**
1. Sign up at [imagekit.io](https://imagekit.io) and note your URL endpoint: `https://ik.imagekit.io/your_imagekit_id`
2. Upload product photos via Dashboard → Media Library (organize in folders, e.g. `/products/nike-air-force-1-001/`)
3. Copy each image's URL and paste into the Products tab's `image1`/`image2`/`image3` columns, appending transformation params

**Recommended transformation params for product images (4:3, ~800×600):**
```
https://ik.imagekit.io/your_imagekit_id/products/nike-air-force-1-001/front.jpg?tr=w-800,h-600,fo-auto,q-80,f-auto
```

| Param | Meaning |
|-------|---------|
| `w-800,h-600` | resize to 800×600 |
| `fo-auto` | smart crop focus |
| `q-80` | quality 80% |
| `f-auto` | auto-serve WebP/AVIF |

**For hero/large images:**
```
https://ik.imagekit.io/your_imagekit_id/hero/best-seller.jpg?tr=w-1200,q-85,f-auto
```

If switching the homepage hero/about images to ImageKit, also update the `<link rel="preconnect">` and `<link rel="preload">` tags in `index.html`/`about.html` from `images.unsplash.com` to `ik.imagekit.io`.

**Other image hosting options (alternatives):**
- Upload to Google Drive → get shareable link (change `/view` to `/uc?export=view`)
- Use [imgbb.com](https://imgbb.com) for free hosting
- Use [Cloudinary](https://cloudinary.com) free tier for optimised images
- Use [Unsplash](https://unsplash.com) for placeholder/hero images

**Image URL format for Google Drive:**
```
https://drive.google.com/uc?export=view&id=YOUR_FILE_ID
```

---

## 🎨 Customisation

### Changing colours
Edit `assets/css/styles.css` — look for `:root` at the top:
```css
:root {
  --bg:      #F7F1E8;   /* Background */
  --accent:  #B58A5A;   /* Gold accent */
  --primary: #161616;   /* Main text */
  /* ... */
}
```

### Changing the WhatsApp number
Update in `assets/js/config.js`:
```javascript
WHATSAPP_NUMBER: "9779763374989",
```
Also search-replace `9779763374989` in all `.html` files.

### Changing products per page
```javascript
PRODUCTS_PER_PAGE: 12,  // in config.js
```

### Changing cache duration
```javascript
CACHE_TTL: 5 * 60 * 1000,  // 5 minutes, in config.js
```

---

## 📸 Image Guidelines

| Use | Size | Format |
|-----|------|--------|
| OG/social image | 1200×630px | JPG |
| Product images | 800×600px (4:3) | JPG/WebP |
| Hero image | 1200×900px | JPG/WebP |
| Daily picks | 600×600px (1:1) | JPG/WebP |

**Optimisation tips:**
- Compress all images at [squoosh.app](https://squoosh.app) before uploading
- Use WebP format where possible (30-40% smaller than JPG)
- Keep product images under 200KB each
- Use consistent aspect ratios across product images

---

## ⚡ Performance & SEO Highlights

This build includes the following optimizations out of the box:

**Performance**
- Hero image uses `fetchpriority="high"` + `<link rel="preload">` to improve Largest Contentful Paint (LCP)
- All below-fold images use `loading="lazy"`
- Fonts use `display=swap` with `preconnect` to Google Fonts and the image CDN
- Single combined stylesheet (no per-page CSS requests / waterfall)
- localStorage caching of products/testimonials/offers (5-min TTL) reduces repeat API calls
- Lightweight CSS-only animations (transform/opacity), GPU-accelerated, respect `prefers-reduced-motion`
- `IntersectionObserver`-based scroll reveals (no scroll-event listeners)

**SEO**
- Unique `<title>`, meta description, canonical, Open Graph, and Twitter Card tags on every page
- `JSON-LD` structured data: `ShoeStore` (homepage), `Product` + `BreadcrumbList` (product pages, dynamic), `BreadcrumbList` (shop/about/contact), `FAQPage` (contact)
- `sitemap.xml` includes individual product URLs for indexing — update this list as your catalog grows
- `robots.txt` allows full crawling, including JS (required since content renders dynamically)
- Favicon + Apple touch icon + PWA manifest for richer search/share/home-screen appearance
- Semantic HTML, descriptive `alt` text on all images, single `<h1>` per page

**To verify after deploy:**
- Run [PageSpeed Insights](https://pagespeed.web.dev) on homepage, shop, and a product page
- Run [Google Rich Results Test](https://search.google.com/test/rich-results) on homepage (ShoeStore), a product page (Product + Breadcrumb), and contact page (FAQPage)
- Submit `sitemap.xml` to [Google Search Console](https://search.google.com/search-console)

---

## 🚀 Launch Checklist

### Before launch
- [ ] Replace `WHATSAPP_NUMBER` in `config.js` with real number
- [ ] Replace `GOOGLE_SCRIPT_URL` in `config.js` with deployed Apps Script URL
- [ ] Confirm `FORMSPREE_ENDPOINT` in `config.js` matches your Formspree form, and verify the email account on Formspree (check your inbox for their verification email)
- [ ] Submit a test order and a test contact message — confirm both the Google Sheet row AND the Formspree email notification arrive
- [ ] Update `SITE_URL` in `config.js` to `https://kicksy.com.np`
- [ ] Update social media URLs in `config.js`
- [ ] Replace `9779763374989` in all HTML files with real WhatsApp number
- [ ] Add real product data to Google Sheets (Products tab — shoes)
- [ ] Create a `LeatherProducts` tab with the header row shown above and add real leather goods data
- [ ] Re-deploy the Apps Script after pasting the updated `google-apps-script.js` (New Deployment → same Web App)
- [ ] Replace placeholder Unsplash images on `leather.html` (hero, category showcase) with real product photos
- [ ] Add real testimonials to Google Sheets (Testimonials tab)
- [ ] Upload an OG image to `assets/images/og-image.jpg`
- [ ] Update hero image URL in `index.html`
- [ ] Test WhatsApp order button opens correct message (verify leather goods show 👜/Variant, shoes show 👟/Size)
- [ ] Test order form submits and appears in Google Sheets
- [ ] Test contact form submits and appears in Google Sheets
- [ ] Update `sitemap.xml` with current date

### Testing
- [ ] Test on mobile (iPhone + Android)
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test with slow 3G (Chrome DevTools → Network throttle)
- [ ] Test shop filters (brand, size, color, price, search)
- [ ] Test product gallery image switching
- [ ] Test 404 page (`kicksy.com.np/nonexistent`)
- [ ] Run [PageSpeed Insights](https://pagespeed.web.dev) — aim for 90+
- [ ] Run [Google Rich Results Test](https://search.google.com/test/rich-results) on product page
- [ ] Submit sitemap to [Google Search Console](https://search.google.com/search-console)

### After launch
- [ ] Submit sitemap: `https://kicksy.com.np/sitemap.xml` to Google Search Console
- [ ] Set up Google Analytics (add tracking code to `<head>` of all pages)
- [ ] Monitor Google Sheets Orders tab daily
- [ ] Respond to WhatsApp orders promptly

---

## 🔒 Security Notes

- **Never commit** real API credentials or private keys to GitHub
- The Google Apps Script URL is public by design (needed for static hosting)
- `costPrice` and `profit` columns are stripped server-side in Apps Script — they are never sent to the frontend
- Honeypot fields on forms help reduce spam bots
- Input is sanitised before rendering (XSS protection)
- Consider adding Apps Script rate limiting if spam becomes an issue

---

## 🐛 Troubleshooting

**Products not loading:**
- Check `GOOGLE_SCRIPT_URL` in `config.js` is correct
- Make sure Apps Script is deployed as Web App with access set to "Anyone"
- Open browser console (F12) and check for errors
- The site automatically falls back to sample products if API fails

**WhatsApp button not working:**
- Verify `WHATSAPP_NUMBER` has no spaces, +, or dashes
- Format: `9779763374989` (country code + number)

**Order form not submitting to Google Sheets:**
- Verify the Apps Script URL is correct in `config.js`
- Check the Google Sheet has the correct tab names (case-sensitive)
- Check Apps Script logs: Extensions → Apps Script → Executions

**Filters not working:**
- Open browser console — look for JavaScript errors
- Make sure all JS files are loading (check Network tab)

**Images not showing:**
- Verify image URLs in Google Sheet are publicly accessible
- Google Drive images: use `uc?export=view` format, not the regular share link
- Test image URL directly in browser

**Changes to Google Sheet not showing:**
- Cache TTL is 5 minutes — wait and refresh
- Or clear `localStorage` in browser console: `localStorage.clear()`

---

## 📊 Google Analytics Setup (Optional)

Add inside `<head>` of all HTML pages, before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
Replace `G-XXXXXXXXXX` with your Measurement ID from [Google Analytics](https://analytics.google.com).

---

## 📱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Styling | Custom CSS with CSS Variables (no framework) |
| Fonts | Google Fonts: Playfair Display + Inter |
| Backend/DB | Google Sheets + Google Apps Script |
| Hosting | Cloudflare Pages (free tier) |
| CDN | Cloudflare (automatic) |
| Ordering | WhatsApp Business API (wa.me links) |
| Images | Externally hosted (Google Drive / Imgbb / Cloudinary) |

**No Node.js, no npm, no build tools required.** ✅

---

## 📞 Support

For technical help with this codebase, refer to:
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Google Apps Script Docs](https://developers.google.com/apps-script)
- [MDN Web Docs](https://developer.mozilla.org)

---

*Built for Kicksy Nepal — Premium Shoes, Affordable Prices*
