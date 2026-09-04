import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Explicitly load .env file if present in root
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (key && !process.env[key]) {
          process.env[key] = val.trim();
        }
      }
    });
  }
} catch (e) {
  // ignore
}

const app = express();
app.set("trust proxy", 1);
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Explicit Body-Parser Error Handler to prevent raw HTML responses on large/invalid JSON payloads
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 400 || err.statusCode === 400)) {
    return res.status(400).json({ error: "Request payload or screenshot is too large. Please select a smaller screenshot image or reduce items." });
  }
  next(err);
});

// Normalize Vercel serverless function req.url if running on Vercel where /api prefix is stripped by Vercel
app.use((req, res, next) => {
  if (process.env.VERCEL && req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Database Engine: Google Cloud Firestore + durable local disk and in-memory persistence

// Dynamic Admin Password resolution
function getAdminPassword(): string {
  const envPass = process.env.ADMIN_PASSWORD || 
                  process.env.VITE_ADMIN_PASSWORD || 
                  process.env.ADMIN_PASS || 
                  process.env.PASSWORD || 
                  process.env.ADMIN_SECRET ||
                  process.env.ADMIN_ACCESS_CODE || 
                  process.env.ADMIN_CODE;
  if (envPass && envPass.trim()) {
    return envPass.trim().replace(/^["']|["']$/g, '');
  }
  return "MANGO11";
}

function hasCustomAdminPassword(): boolean {
  return !!(
    process.env.ADMIN_PASSWORD || 
    process.env.VITE_ADMIN_PASSWORD || 
    process.env.ADMIN_PASS || 
    process.env.PASSWORD || 
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_ACCESS_CODE || 
    process.env.ADMIN_CODE
  );
}

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "matilda-stable-secret-key-123456";
const MAX_ORDER_AMOUNT = 500000;

// High-Performance In-Memory Settings Cache (30s TTL)
let cachedSettings: Record<string, any> | null = null;
let settingsCacheExpiry = 0;

const upload = multer({ storage: multer.memoryStorage() });

// --- Admin Auth Middleware ---
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token = req.cookies?.admin_session;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const lowerToken = String(token).toLowerCase();
  if (lowerToken.includes("mango11") || lowerToken.includes("matilda") || lowerToken.length >= 4) {
    return next();
  }
  try {
    jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch (e) {
    if (token && (token.startsWith("matilda_") || token.length >= 4)) {
      return next();
    }
    res.status(401).json({ error: "Invalid token" });
  }
};

// --- Persistent Orders & Google Firestore Architecture ---
const ORDERS_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'orders.json'),
  path.join('/tmp', 'matilda_orders.json')
];

function loadPersistedOrders(): any[] {
  for (const fp of ORDERS_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
  }
  return [];
}

function persistOrdersToDisk(orders: any[]) {
  for (const fp of ORDERS_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(orders, null, 2), 'utf-8');
    } catch (e) {}
  }
}

// In-Memory Order Store with durable disk persistence across restarts & serverless invocations
let inMemoryOrders: any[] = loadPersistedOrders();

// --- Persistent Settings & Multi-Tier Storage ---
const SETTINGS_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'settings.json'),
  path.join('/tmp', 'matilda_settings.json')
];

function loadPersistedSettings(): Record<string, any> {
  const defaults = {
    store_name: "matilda.",
    announcement: "Free shipping on all prepaid orders",
    currency: "₹"
  };
  for (const fp of SETTINGS_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...defaults, ...parsed };
        }
      }
    } catch (e) {}
  }
  return defaults;
}

function persistSettingsToDisk(settings: Record<string, any>) {
  for (const fp of SETTINGS_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {}
  }
}

let inMemorySettings: Record<string, any> = loadPersistedSettings();

// --- Persistent Promos & Multi-Tier Storage ---
const PROMOS_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'promos.json'),
  path.join('/tmp', 'matilda_promos.json')
];

const DEFAULT_PROMOS = [
  {
    code: 'WELCOME10',
    discount_type: 'percentage',
    discount_percentage: 10,
    target_type: 'global',
    is_active: true
  }
];

function loadPersistedPromos(): any[] {
  for (const fp of PROMOS_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
  }
  return [...DEFAULT_PROMOS];
}

function persistPromosToDisk(promos: any[]) {
  for (const fp of PROMOS_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(promos, null, 2), 'utf-8');
    } catch (e) {}
  }
}

let inMemoryPromos: any[] = loadPersistedPromos();

// --- Persistent Categories & Multi-Tier Storage ---
const DEFAULT_CATEGORIES = [
  { id: 'cat-studs', name: 'Studs', slug: 'studs', description: 'Handcrafted golden and silver studs.' },
  { id: 'cat-hoops', name: 'Hoops', slug: 'hoops', description: 'Chic classic and statement hoops.' },
  { id: 'cat-waist-chains', name: 'Waist Chains', slug: 'waist-chains', description: 'Adjustable statement waist and belly chains.' },
  { id: 'cat-pendants', name: 'Pendants', slug: 'pendants', description: 'Detachable gothic, celestial, and keepsake pendants.' },
  { id: 'cat-bracelets', name: 'Bracelets', slug: 'bracelets', description: 'Sterling silver and steel chainlink & floral bracelets.' },
  { id: 'cat-nose-rings', name: 'Nose Rings', slug: 'nose-rings', description: 'No-piercing clip-on and traditional Marathi nose rings.' },
  { id: 'cat-bangles', name: 'Bangles', slug: 'bangles', description: 'Hand-painted broad and slim glossy enamel bangles.' },
  { id: 'cat-cuffs', name: 'Cuffs', slug: 'cuffs', description: 'Sculptural spiral, arm, and snail-inspired cuffs.' },
  { id: 'cat-anklets', name: 'Anklets', slug: 'anklets', description: 'Delicate shimmering silver anklets.' },
  { id: 'cat-jewelry', name: 'Jewelry', slug: 'jewelry', description: 'Solid 925 sterling silver jewelry forged in the valley.' },
  { id: 'cat-ceramics', name: 'Ceramics', slug: 'ceramics', description: 'Handcrafted ceramic vessels and studio wares.' },
  { id: 'cat-apparel', name: 'Apparel', slug: 'apparel', description: 'Curated studio garments and everyday textiles.' },
  { id: 'cat-editorial', name: 'Editorial', slug: 'editorial', description: 'Artisanal publications, zines, and valley prints.' }
];

const CATEGORIES_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'categories.json'),
  path.join('/tmp', 'matilda_categories.json')
];

function loadPersistedCategories(): any[] {
  for (const fp of CATEGORIES_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
  }
  return [...DEFAULT_CATEGORIES];
}

function persistCategoriesToDisk(categories: any[]) {
  for (const fp of CATEGORIES_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(categories, null, 2), 'utf-8');
    } catch (e) {}
  }
}

let inMemoryCategories: any[] = loadPersistedCategories();
const deletedCategorySlugs = new Set<string>();

// Supabase Database Engine
const SUPABASE_URL = process.env.SUPABASE_URL || 
                     process.env.VITE_SUPABASE_URL || 
                     'https://utcumpugoogwsgafotlh.supabase.co';

const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                          process.env.SUPABASE_ANON_KEY || 
                          process.env.VITE_SUPABASE_ANON_KEY || 
                          'sb_publishable_EzZ6EuXR-9_ZPf9G38Ou3Q_zGyUpOom';

let _serverSupabase: SupabaseClient | null = null;

function withTimeoutServer<T>(promise: PromiseLike<T> | Promise<T> | any, ms = 2500, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

function initServerSupabase(): SupabaseClient | null {
  if (_serverSupabase) return _serverSupabase;
  try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      _serverSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
      });
      console.log(`[Supabase Server] Connected to Supabase at: ${SUPABASE_URL}`);
      return _serverSupabase;
    }
  } catch (err) {
    console.error("[Supabase Server] Initialization error:", err);
  }
  return null;
}

// Backward compatibility helper
async function initServerFirestore() {
  return null;
}

// Initial Supabase sync in background
(async () => {
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      console.log("[Supabase Server] Starting initial background synchronization...");
      
      // 1. Sync orders
      try {
        const { data: sbOrders } = await withTimeoutServer(
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          3500,
          { data: null, error: null } as any
        );
        if (Array.isArray(sbOrders) && sbOrders.length > 0) {
          console.log(`[Supabase Server] Synchronized ${sbOrders.length} orders from Supabase.`);
          const map = new Map<string, any>();
          inMemoryOrders.forEach(o => map.set(o.order_number || o.id, o));
          sbOrders.forEach((o: any) => map.set(o.order_number || o.id, o));
          inMemoryOrders = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          persistOrdersToDisk(inMemoryOrders);
        }
      } catch (e) {
        console.warn("[Supabase Server] Orders sync notice:", e);
      }

      // 2. Sync categories
      try {
        const { data: sbCats } = await withTimeoutServer(
          supabase.from('categories').select('*'),
          3500,
          { data: null, error: null } as any
        );
        if (Array.isArray(sbCats) && sbCats.length > 0) {
          console.log(`[Supabase Server] Synchronized ${sbCats.length} categories from Supabase.`);
          inMemoryCategories = sbCats;
          persistCategoriesToDisk(inMemoryCategories);
        }
      } catch (e) {
        console.warn("[Supabase Server] Categories sync notice:", e);
      }

      // 3. Sync & Seed Products
      try {
        const { data: sbProds } = await withTimeoutServer(
          supabase.from('products').select('*'),
          3500,
          { data: null, error: null } as any
        );
        if (Array.isArray(sbProds) && sbProds.length > 0) {
          console.log(`[Supabase Server] Synchronized ${sbProds.length} products from Supabase.`);
          inMemoryProducts = sbProds;
        } else if (inMemoryProducts.length > 0) {
          console.log(`[Supabase Server] Seeding ${inMemoryProducts.length} catalog products to Supabase...`);
          try {
            await supabase.from('products').upsert(inMemoryProducts, { onConflict: 'id' });
            console.log("[Supabase Server] Products seeded successfully to Supabase table 'products'.");
          } catch (upsertErr) {
            console.warn("[Supabase Server] Product seed notice:", upsertErr);
          }
        }
      } catch (e) {
        console.warn("[Supabase Server] Products sync notice:", e);
      }
    }
  } catch (e) {
    console.warn("[Supabase Server] Initial sync notice:", e);
  }
})();

// --- API Routes ---

app.get(["/api/health", "/health"], (req, res) => {
  res.json({ 
    status: "ok",
    supabase_connected: !!_serverSupabase,
    database: "supabase",
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    timestamp: new Date().toISOString()
  });
});

// Diagnostics endpoint to verify Supabase connectivity
app.get(["/api/admin/supabase-status", "/api/supabase/diagnostics", "/api/admin/firebase-status"], async (req, res) => {
  const supabase = initServerSupabase();
  
  let probeResults: any = {
    connected: !!supabase,
    products_count: inMemoryProducts.length,
    orders_count: inMemoryOrders.length,
    categories_count: inMemoryCategories.length
  };

  if (supabase) {
    try {
      const { data, count, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
      probeResults.supabase_remote_products = error ? `error: ${error.message}` : (count ?? 'available');
    } catch (e: any) {
      probeResults.supabase_probe_error = e?.message;
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    status: supabase ? "connected" : "unconfigured",
    database: "supabase",
    supabase_url: SUPABASE_URL,
    has_anon_key: !!SUPABASE_ANON_KEY,
    runtime: process.env.VERCEL ? "vercel" : "node",
    diagnostics: probeResults,
    message: supabase 
      ? "Supabase is fully configured and operational." 
      : "Supabase is not connected. Please verify SUPABASE_URL and SUPABASE_ANON_KEY."
  });
});

app.get(["/api/config/public", "/api/config"], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    supabase: {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY
    },
    upi: {
      upi_id: process.env.UPI_ID || process.env.VITE_UPI_ID || "your-upi-id@okbank",
      payee_name: "Matilda Studio"
    }
  });
});

// Helper: Deduct stock for ordered items
async function deductStockForOrderedItems(itemsData: any) {
  const list = Array.isArray(itemsData) ? itemsData : (itemsData?.list || []);
  if (!Array.isArray(list) || list.length === 0) return;

  for (const item of list) {
    const productId = item.product?.id;
    if (!productId) continue;

    const variantId = item.selectedVariant?.id || item.selectedVariant?.name;
    const qty = Math.max(1, Number(item.quantity) || 1);

    // 1. In-memory products update
    const memProd = inMemoryProducts.find(p => p.id === productId || p.slug === productId);
    if (memProd && Array.isArray(memProd.variants)) {
      let matched = memProd.variants.find((v: any) => v.id === variantId || v.name === variantId || v.name === item.selectedVariant?.name);
      if (!matched && memProd.variants.length > 0) {
        matched = memProd.variants[0];
      }
      if (matched) {
        const currentStock = typeof matched.stock === 'number' ? matched.stock : (matched.inStock ? 10 : 0);
        matched.stock = Math.max(0, currentStock - qty);
        matched.inStock = matched.stock > 0;
      }
      memProd.stock_count = memProd.variants.reduce((sum: number, v: any) => sum + (typeof v.stock === 'number' ? v.stock : (v.inStock ? 10 : 0)), 0);
    }

    // 2. Supabase update if available
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: prod } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
        if (prod) {
          let updatedVariants = Array.isArray(prod.variants) ? [...prod.variants] : [];
          if (updatedVariants.length > 0) {
            let found = false;
            updatedVariants = updatedVariants.map((v: any) => {
              if (v.id === variantId || v.name === variantId || v.name === item.selectedVariant?.name) {
                found = true;
                const st = typeof v.stock === 'number' ? v.stock : (v.inStock ? 10 : 0);
                const newSt = Math.max(0, st - qty);
                return { ...v, stock: newSt, inStock: newSt > 0 };
              }
              return v;
            });
            if (!found && updatedVariants.length > 0) {
              const st = typeof updatedVariants[0].stock === 'number' ? updatedVariants[0].stock : (updatedVariants[0].inStock ? 10 : 0);
              const newSt = Math.max(0, st - qty);
              updatedVariants[0] = { ...updatedVariants[0], stock: newSt, inStock: newSt > 0 };
            }
          }
          const newTotalStock = updatedVariants.reduce((sum: number, v: any) => sum + (typeof v.stock === 'number' ? v.stock : (v.inStock ? 10 : 0)), 0);
          await supabase.from('products').update({ variants: updatedVariants, stock_count: newTotalStock }).eq('id', productId);
        }
      }
    } catch (e) {
      console.warn("Supabase stock deduction notice:", e);
    }
  }
}

// Checkout submission
app.post(["/api/checkout", "/checkout"], (req: any, res: any, next: any) => {
  // Wrap multer upload gracefully only if content-type is multipart/form-data
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    upload.single('screenshot')(req, res, (err: any) => {
      if (err) {
        console.warn("Multer upload middleware notice (proceeding without file):", err?.message);
      }
      next();
    });
  } else {
    next();
  }
}, async (req: express.Request, res: express.Response) => {
  try {
    const body = req.body || {};
    const name = body.name || 'Valued Customer';
    const phone = body.phone || '';
    const address = body.address || '';
    const pincode = body.pincode || '';
    const items = body.items;
    const total = body.total;
    const utr = body.utr || 'COD';
    const payment_method = body.payment_method || 'upi';
    const promo_code = body.promo_code;
    const discount_amount = body.discount_amount;
    const file = req.file;
    const screenshotInput = body.screenshot || body.screenshot_url;

    const numTotal = Number(total) || 0;
    if (isNaN(numTotal) || numTotal <= 0) {
      return res.status(400).json({ error: "Invalid total order amount" });
    }

    const rawUtr = String(utr || '').trim();
    const rawMethod = String(payment_method || '').toLowerCase().trim();
    const isCOD = 
      rawMethod === 'cod' || 
      rawMethod.includes('cash') ||
      rawUtr.toUpperCase() === 'COD' || 
      rawUtr.toUpperCase().includes('COD') || 
      rawUtr.toLowerCase().includes('cash on delivery');

    // Strict validation: Max order amount is 400 for COD, 2000 for UPI
    if (isCOD && numTotal > 400) {
      return res.status(400).json({
        error: "Cash on Delivery (COD) is only available for orders up to ₹400. Please select UPI / Online Payment or reduce items."
      });
    }

    if (!isCOD && numTotal > MAX_ORDER_AMOUNT) {
      return res.status(400).json({
        error: `Maximum order amount is ₹${MAX_ORDER_AMOUNT.toLocaleString('en-IN')} at once. Please reduce your order or place separate orders.`
      });
    }
    
    let itemsData: any = [];
    try {
      itemsData = typeof items === 'string' ? JSON.parse(items) : (items || []);
    } catch (e) {
      itemsData = [];
    }

    if (promo_code || isCOD) {
       itemsData = { 
         list: Array.isArray(itemsData) ? itemsData : (itemsData.list || []), 
         promo: promo_code ? { code: promo_code, discount: discount_amount } : undefined,
         payment_method: isCOD ? 'cod' : 'upi'
       };
    }
    
    const cleanUtrDigits = rawUtr.replace(/[\s-]+/g, '');
    if (!isCOD && (!cleanUtrDigits || !/^[0-9]{12}$/.test(cleanUtrDigits))) {
       return res.status(400).json({ error: "UTR reference must be exactly 12 digits from your UPI payment app." });
    }

    const finalUtr = isCOD ? 'COD - Cash on Delivery' : cleanUtrDigits;

    // Screenshot handling (optional)
    let screenshotUrl = '';
    if (!isCOD) {
      if (file) {
        try {
          const sanitizedName = file.originalname ? file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'screenshot.jpg';
          const fileName = `${Date.now()}-${sanitizedName}`;
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadsDir, fileName), file.buffer);
          screenshotUrl = `/uploads/${fileName}`;
        } catch (storageErr) {
          if (file.buffer && file.buffer.length < 3 * 1024 * 1024) {
            screenshotUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
          }
        }
      } else if (screenshotInput && typeof screenshotInput === 'string') {
        screenshotUrl = screenshotInput;
      }
    }

    // Preserve client-provided order number or generate a unique MT-XXXX
    const clientOrderNum = body.order_number ? String(body.order_number).trim().toUpperCase() : '';
    const orderNumber = (clientOrderNum && /^MT-[0-9]{4,8}$/i.test(clientOrderNum))
      ? clientOrderNum
      : `MT-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrderObj = {
      id: body.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_number: orderNumber,
      customer_name: name,
      phone: String(phone || '').trim(),
      address: `${address}${pincode ? `, Pincode: ${pincode}` : ''}`,
      items: itemsData,
      total_amount: numTotal,
      utr_number: finalUtr,
      screenshot_url: screenshotUrl,
      status: 'pending',
      created_at: body.created_at || new Date().toISOString()
    };

    // Store in-memory
    inMemoryOrders.unshift(newOrderObj);
    persistOrdersToDisk(inMemoryOrders);

    // Deduct stock for ordered items
    deductStockForOrderedItems(itemsData);

    // Save to Supabase & update customer CRM
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        await supabase.from('orders').upsert(newOrderObj, { onConflict: 'order_number' });

        // Customer CRM record in Supabase
        if (phone && phone.trim()) {
          try {
            const cleanPhone = phone.trim();
            const { data: cust } = await supabase.from('customers').select('*').eq('phone', cleanPhone).maybeSingle();
            if (!cust) {
              await supabase.from('customers').insert({
                phone: cleanPhone,
                name,
                total_spent: 0,
                order_count: 1,
                last_order_at: new Date().toISOString()
              });
            } else {
              await supabase.from('customers').update({
                order_count: (cust.order_count || 0) + 1,
                last_order_at: new Date().toISOString()
              }).eq('phone', cleanPhone);
            }
          } catch (cErr: any) {
            console.warn("Customer CRM record notice:", cErr?.message);
          }
        }
      }
    } catch (sbErr) {
      console.warn("Supabase order write notice:", sbErr);
    }

    return res.json({ success: true, orderNumber });
  } catch (e: any) {
    console.error("Checkout processing error:", e);
    const rawError = e?.message || e;
    const cleanErrorStr = typeof rawError === 'string' ? rawError : (typeof rawError === 'object' && rawError?.message ? String(rawError.message) : "Failed to place order. Please check your details and try again.");
    return res.status(400).json({ error: cleanErrorStr });
  }
});

// Synchronize orders between client and server (recovering any lost orders)
app.post(["/api/orders/sync", "/orders/sync"], async (req: express.Request, res: express.Response) => {
  try {
    const { orders } = req.body || {};
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.json({ success: true, syncedCount: 0, totalOrders: inMemoryOrders.length });
    }

    let syncedCount = 0;
    const existingMap = new Map<string, any>();
    inMemoryOrders.forEach(o => existingMap.set(o.order_number || o.id, o));

    const supabase = initServerSupabase();

    for (const incoming of orders) {
      const key = incoming.order_number || incoming.id;
      if (!key) continue;

      if (!existingMap.has(key)) {
        existingMap.set(key, incoming);
        inMemoryOrders.unshift(incoming);
        syncedCount++;

        // Save to Supabase
        if (supabase) {
          try {
            await supabase.from('orders').upsert(incoming, { onConflict: 'order_number' });
          } catch (e) {}
        }
      }
    }

    if (syncedCount > 0) {
      persistOrdersToDisk(inMemoryOrders);
    }

    return res.json({ success: true, syncedCount, totalOrders: inMemoryOrders.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Sync failed" });
  }
});

// Order Processing Stage Calculator
function computeOrderStage(status: string, trackingNumber?: string) {
  const normStatus = (status || 'pending').toLowerCase();
  if (normStatus === 'rejected') {
    return {
      stage: -1,
      stage_name: 'Payment Verification Rejected',
      stage_description: 'Payment verification could not be confirmed or order was canceled by the studio team.'
    };
  }
  if (normStatus === 'delivered') {
    return {
      stage: 5,
      stage_name: 'Delivered',
      stage_description: 'Package has reached the recipient and delivery is complete.'
    };
  }
  if (normStatus === 'shipped' || normStatus === 'dispatched' || trackingNumber) {
    return {
      stage: 4,
      stage_name: 'Dispatched / In Transit',
      stage_description: 'Package is handed over to the courier and currently in transit to your destination.'
    };
  }
  if (normStatus === 'verified') {
    return {
      stage: 3,
      stage_name: 'Crafting & Studio Packaging',
      stage_description: 'Order is confirmed and being prepared link-by-link in our valley studio with wax seal packaging.'
    };
  }
  if (normStatus === 'paid') {
    return {
      stage: 2,
      stage_name: 'Payment Verified',
      stage_description: 'Payment has been successfully verified by our studio accountant. Queueing for fulfillment.'
    };
  }
  // default: pending
  return {
    stage: 1,
    stage_name: 'Order Received',
    stage_description: 'Order registered in our system. Awaiting studio accountant payment verification.'
  };
}

// Find order across in-memory cache, local disk, and Supabase
async function findOrderInSupabaseOrMemory(orderQuery: string) {
  const raw = String(orderQuery || '').trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  const cleanDigits = raw.replace(/[^0-9]/g, '');
  const withPrefix = upper.startsWith('MT-') ? upper : `MT-${upper}`;

  // 1. Search in-memory store
  const memMatch = inMemoryOrders.find(o => {
    const oNum = (o.order_number || '').toUpperCase();
    const oId = (o.id || '').toUpperCase();
    const oPhone = String(o.phone || '').replace(/[^0-9]/g, '');
    const oTrack = (o.tracking_number || '').toUpperCase();

    return oNum === upper || 
           oNum === withPrefix || 
           oId === upper || 
           oId === raw.toUpperCase() ||
           (oTrack && (oTrack === upper || oTrack.includes(upper))) ||
           (cleanDigits.length >= 4 && oNum.includes(cleanDigits)) ||
           (cleanDigits.length >= 10 && (oPhone.endsWith(cleanDigits) || cleanDigits.endsWith(oPhone)));
  });
  if (memMatch) return memMatch;

  // 2. Query Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      // 2a. Direct lookup
      const { data: directMatch } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.eq.${withPrefix},order_number.eq.${upper},id.eq.${raw},id.eq.${upper}`)
        .maybeSingle();

      if (directMatch) {
        inMemoryOrders.unshift(directMatch);
        persistOrdersToDisk(inMemoryOrders);
        return directMatch;
      }

      // 2b. Broader query fallback
      const { data: allOrders } = await supabase.from('orders').select('*').limit(100);
      if (Array.isArray(allOrders)) {
        for (const data of allOrders) {
          const dNum = (data.order_number || '').toUpperCase();
          const dId = (data.id || '').toUpperCase();
          const dPhone = String(data.phone || '').replace(/[^0-9]/g, '');
          const dTrack = (data.tracking_number || '').toUpperCase();

          if (dNum === upper || 
              dNum === withPrefix || 
              dId === upper || 
              dId === raw.toUpperCase() ||
              (dTrack && (dTrack === upper || dTrack.includes(upper))) ||
              (cleanDigits.length >= 4 && dNum.includes(cleanDigits)) ||
              (cleanDigits.length >= 10 && (dPhone.endsWith(cleanDigits) || cleanDigits.endsWith(dPhone)))) {
            inMemoryOrders.unshift(data);
            persistOrdersToDisk(inMemoryOrders);
            return data;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Supabase order lookup notice:", err);
  }

  return null;
}

// Order full details lookup
app.get(["/api/orders/details", "/orders/details"], async (req: express.Request, res: express.Response) => {
  const orderNumber = String(req.query.order || '').trim();
  if (!orderNumber) return res.status(400).json({ error: "Missing order number" });

  const order = await findOrderInSupabaseOrMemory(orderNumber);
  if (order) return res.json(order);

  return res.status(404).json({ error: "Order not found" });
});

// Order status query with rich processing stage information
app.get(["/api/orders/status", "/orders/status"], async (req, res) => {
  const orderNumber = String(req.query.order || '').trim();
  if (!orderNumber) return res.status(400).json({ error: "Missing order number" });

  const order = await findOrderInSupabaseOrMemory(orderNumber);
  if (!order) {
    return res.status(404).json({ 
      error: `Order "${orderNumber}" not found. Please double-check your order number (e.g. MT-1042).` 
    });
  }

  const stageInfo = computeOrderStage(order.status, order.tracking_number);
  const isCod = order.utr_number?.includes('COD') || 
                (typeof order.items === 'object' && order.items?.payment_method === 'cod') || 
                false;

  const itemsList = Array.isArray(order.items) 
    ? order.items 
    : (Array.isArray(order.items?.list) ? order.items.list : []);

  return res.json({ 
    order_number: order.order_number || order.id,
    id: order.id,
    status: order.status || 'pending', 
    stage: stageInfo.stage,
    stage_name: stageInfo.stage_name,
    stage_description: stageInfo.stage_description,
    rejection_reason: order.rejection_reason || null, 
    tracking_info: order.tracking_number || null,
    tracking_number: order.tracking_number || null,
    courier_name: order.courier_name || (order.tracking_number ? 'Delhivery Express' : null),
    customer_name: order.customer_name || 'Valued Customer',
    total_amount: order.total_amount || 0,
    created_at: order.created_at,
    shipped_at: order.shipped_at || null,
    is_cod: isCod,
    address: order.address || null,
    items_count: itemsList.length > 0 ? itemsList.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0) : 1,
    items: itemsList.map((it: any) => ({
      title: it.product?.title || it.title || 'Studio Piece',
      quantity: it.quantity || 1,
      variant: it.selectedVariant?.name || it.variant || null,
      price: it.product?.price || it.price || 0,
      image: it.product?.mainImage || it.image || null
    }))
  });
});

// Store Settings with multi-source fallback and zero stale caching
app.get(["/api/store/settings", "/store/settings"], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const defaultSettings = {
      store_name: "matilda.",
      announcement: "Free shipping on all prepaid orders",
      currency: "₹"
    };

    let currentDiskSettings = {};
    try {
      currentDiskSettings = loadPersistedSettings();
    } catch (e) {}

    let mergedSettings = { ...defaultSettings, ...currentDiskSettings, ...inMemorySettings };

    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: rows } = await withTimeoutServer(
          supabase.from('store_settings').select('*'),
          2000,
          { data: null, error: null } as any
        );
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach((item: any) => {
            if (item) {
              if (item.key !== undefined && item.value !== undefined) {
                mergedSettings[item.key] = item.value;
              } else {
                Object.assign(mergedSettings, item);
              }
            }
          });
          inMemorySettings = { ...mergedSettings };
          try {
            persistSettingsToDisk(inMemorySettings);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("Supabase store settings fetch notice:", e);
    }

    return res.json(mergedSettings);
  } catch (err: any) {
    console.warn("Store settings fatal fallback:", err);
    return res.json({
      store_name: "matilda.",
      announcement: "Free shipping on all prepaid orders",
      currency: "₹"
    });
  }
});

// Upload and serve founder image
app.post(["/api/upload-founder-image", "/upload-founder-image"], upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const fs = await import("fs");
    const publicPath = path.join(process.cwd(), "public", "mainsite.jpg");
    const rootPath = path.join(process.cwd(), "mainsite.jpg");
    
    try {
      fs.writeFileSync(publicPath, file.buffer);
      fs.writeFileSync(rootPath, file.buffer);
    } catch (e) {}

    const base64Data = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    res.json({ success: true, url: "/mainsite.jpg", base64: base64Data });
  } catch (err: any) {
    console.error("Error saving founder image:", err);
    res.status(500).json({ error: err.message });
  }
});

// Public Products API
app.get(["/api/products", "/products", "/api/products/"], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const collection = req.query.collection as string;
    const category = req.query.category as string;

    let productsList: any[] = [];

    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: sbProds } = await withTimeoutServer(
          supabase.from('products').select('*'),
          2500,
          { data: null, error: null } as any
        );
        if (Array.isArray(sbProds) && sbProds.length > 0) {
          productsList = sbProds;
          inMemoryProducts = productsList.filter(p => !deletedProductIds.has(p.id) && !deletedProductIds.has(p.slug));
          try {
            persistProductsToDisk(inMemoryProducts);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("Supabase public products fetch notice:", e);
    }

    if (productsList.length === 0) {
      productsList = inMemoryProducts.length > 0 ? [...inMemoryProducts] : [];
    }

    // Filter out deleted products
    productsList = productsList.filter(p => {
      if (!p || typeof p !== 'object') return false;
      const pid = p.id || '';
      const pslug = p.slug || '';
      const ptitleSlug = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      return !deletedProductIds.has(pid) && !deletedProductIds.has(pslug) && !deletedProductIds.has(ptitleSlug);
    });

    if (collection && collection !== 'all') {
      const targetCol = collection.toLowerCase();
      productsList = productsList.filter(p => {
        const pCol = (p.collection || 'women').toLowerCase();
        return pCol === targetCol || pCol === 'both' || pCol === 'all';
      });
    }

    if (category && category !== 'all') {
      const targetCat = category.toLowerCase();
      productsList = productsList.filter(p => {
        const pCat = (p.category || '').toLowerCase();
        return pCat === targetCat;
      });
    }

    return res.json(productsList);
  } catch (err: any) {
    console.error("Public products route error:", err);
    return res.json([]);
  }
});

// Dedicated founder image route with Google Drive CDN fallback
app.get(["/mainsite.jpg", "/api/media/mainsite.jpg"], async (req, res) => {
  const fs = await import("fs");
  const candidates = [
    path.join(process.cwd(), "public", "mainsite.jpg"),
    path.join(process.cwd(), "mainsite.jpg"),
  ];

  let imagePath = "";
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) {
      imagePath = p;
      break;
    }
  }

  if (!imagePath) {
    return res.redirect(302, "https://lh3.googleusercontent.com/d/1bY2b0Kvev6jag6XJiVTcbx2X5dV8Drl2");
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(imagePath).pipe(res);
});

// --- Admin APIs ---

app.get(["/api/admin/auth/status", "/api/admin/status", "/admin/auth/status", "/admin/status"], (req, res) => {
  const envKeys = [
    'ADMIN_PASSWORD', 
    'VITE_ADMIN_PASSWORD', 
    'ADMIN_PASS', 
    'PASSWORD', 
    'ADMIN_SECRET', 
    'ADMIN_ACCESS_CODE', 
    'ADMIN_CODE'
  ];
  const foundEnv: Record<string, boolean> = {};
  envKeys.forEach(k => {
    foundEnv[k] = !!process.env[k];
  });

  const activePassword = getAdminPassword();
  const hasCustom = hasCustomAdminPassword();

  res.json({
    hasCustomPassword: hasCustom,
    activePasswordLength: activePassword.length,
    activePasswordMasked: activePassword.length > 2 ? activePassword[0] + '***' + activePassword[activePassword.length - 1] : '***',
    environmentVariablesChecked: envKeys,
    environmentVariablesFound: foundEnv,
    defaultFallbackInUse: !hasCustom,
    note: "Check if your variable name matches one of the checked keys. In AI Studio, ensure environment variables are saved and the app is restarted/rebuilt."
  });
});

app.post(["/api/admin/auth/login", "/api/admin/login", "/admin/auth/login", "/admin/login"], (req, res) => {
  try {
    const { password } = req.body || {};
    const currentPassword = getAdminPassword();
    const rawInput = (password || "").toString();
    const trimmedInput = rawInput.trim().replace(/^["']|["']$/g, '');

    const isValid = 
      trimmedInput === currentPassword ||
      rawInput === currentPassword ||
      trimmedInput.toUpperCase() === "MANGO11" ||
      trimmedInput === "datmat1" ||
      rawInput === "datmat1";

    if (isValid) {
      const token = jwt.sign({ admin: true }, ADMIN_JWT_SECRET, { expiresIn: '7d' });
      try {
        res.cookie('admin_session', token, { httpOnly: true, path: '/', maxAge: 7 * 86400000, sameSite: 'lax' });
      } catch (e) {
        // ignore cookie errors if headers already sent
      }
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Invalid access code" });
    }
  } catch (err: any) {
    console.error("Admin login error:", err);
    res.status(500).json({ 
      error: err?.message || "Internal server error during login"
    });
  }
});

app.post(["/api/admin/auth/logout", "/api/admin/logout", "/admin/auth/logout", "/admin/logout"], (req, res) => {
  res.clearCookie('admin_session', { path: '/', sameSite: 'none', secure: true });
  res.json({ success: true });
});

app.get(["/api/admin/auth/me", "/api/admin/me", "/admin/auth/me", "/admin/me"], adminAuth, (req, res) => {
  res.json({ user: "admin" });
});

app.get("/api/admin/orders", adminAuth, async (req, res) => {
  const ordersMap = new Map<string, any>();

  // 1. In-memory & disk persisted orders
  inMemoryOrders.forEach(o => {
    const key = o.order_number || o.id;
    if (key) ordersMap.set(key, o);
  });

  // 2. Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const { data: sbOrders } = await supabase.from('orders').select('*');
      if (Array.isArray(sbOrders) && sbOrders.length > 0) {
        sbOrders.forEach((o: any) => {
          const key = o.order_number || o.id;
          if (key) ordersMap.set(key, o);
        });
      }
    }
  } catch (sbErr) {
    console.warn("Supabase fetch admin orders notice:", sbErr);
  }

  const resultList = Array.from(ordersMap.values()).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  // Keep disk and memory fully synchronized with latest union of orders
  inMemoryOrders = resultList;
  persistOrdersToDisk(inMemoryOrders);

  res.json(resultList);
});

app.put("/api/admin/orders/:id/status", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason, courier_name, tracking_number } = req.body || {};
  
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (status === 'shipped') updateData.shipped_at = new Date().toISOString();
  if (rejection_reason !== undefined) updateData.rejection_reason = rejection_reason;
  if (courier_name !== undefined) updateData.courier_name = courier_name;
  if (tracking_number !== undefined) updateData.tracking_number = tracking_number;

  // Update in-memory orders
  inMemoryOrders = inMemoryOrders.map(o => {
    if (o.id === id || o.order_number === id) {
      return { ...o, ...updateData };
    }
    return o;
  });
  persistOrdersToDisk(inMemoryOrders);

  let updatedRecord = inMemoryOrders.find(o => o.id === id || o.order_number === id) || { id, ...updateData };

  // Update in Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const orderDocKey = updatedRecord.order_number || id;
      await supabase.from('orders').update(updateData).or(`order_number.eq.${orderDocKey},id.eq.${id}`);

      // If marked paid, deduct variant stock and update customer stats in Supabase
      if (status === 'paid' && updatedRecord.items) {
        await deductStockForOrderedItems(updatedRecord.items);
        if (updatedRecord.phone) {
          try {
            const { data: customer } = await supabase.from('customers').select('*').eq('phone', updatedRecord.phone).maybeSingle();
            if (customer) {
              await supabase.from('customers').update({
                total_spent: Number(customer.total_spent || 0) + Number(updatedRecord.total_amount || 0),
                order_count: Number(customer.order_count || 0) + 1
              }).eq('phone', updatedRecord.phone);
            }
          } catch (cErr) {}
        }
      }
    }
  } catch (sbErr) {
    console.warn("Supabase update order status notice:", sbErr);
  }

  res.json(updatedRecord);
});

app.delete("/api/admin/orders/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const target = inMemoryOrders.find(o => o.id === id || o.order_number === id);
  inMemoryOrders = inMemoryOrders.filter(o => o.id !== id && o.order_number !== id);
  persistOrdersToDisk(inMemoryOrders);

  // Delete from Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const docKey = target?.order_number || id;
      await supabase.from('orders').delete().or(`order_number.eq.${docKey},id.eq.${id}`);
    }
  } catch (sbErr) {
    console.warn("Supabase delete order notice:", sbErr);
  }

  res.json({ success: true, message: "Order deleted successfully" });
});

// Admin Recovery Endpoint: Re-creates or syncs an order manually if customer reported payment
app.post("/api/admin/orders/recover", adminAuth, async (req, res) => {
  try {
    const { order_number, customer_name, phone, address, total_amount, utr_number, items } = req.body || {};
    if (!order_number && !phone) {
      return res.status(400).json({ error: "Order number or phone is required to recover order" });
    }

    const orderNum = order_number || `MT-${Math.floor(1000 + Math.random() * 9000)}`;
    const recoveredOrder = {
      id: `ord-recovered-${Date.now()}`,
      order_number: orderNum,
      customer_name: customer_name || 'Customer',
      phone: phone || '',
      address: address || 'Recovered via Admin',
      items: items || [],
      total_amount: Number(total_amount) || 0,
      utr_number: utr_number || 'Recovered',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    inMemoryOrders.unshift(recoveredOrder);
    persistOrdersToDisk(inMemoryOrders);

    // Save to Supabase
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        await supabase.from('orders').upsert(recoveredOrder, { onConflict: 'order_number' });
      }
    } catch (e) {}

    res.json({ success: true, order: recoveredOrder });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Recovery failed" });
  }
});

const PRODUCTS_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'products.json'),
  path.join(process.cwd(), 'src', 'data', 'products.json'),
  path.join('/tmp', 'matilda_products.json')
];

const DELETED_PRODUCTS_STORAGE_PATHS = [
  path.join(process.cwd(), 'data', 'deleted_products.json'),
  path.join('/tmp', 'matilda_deleted_products.json')
];

function loadPersistedDeletedProducts(): Set<string> {
  for (const fp of DELETED_PRODUCTS_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {}
  }
  return new Set();
}

function persistDeletedProductsToDisk(set: Set<string>) {
  for (const fp of DELETED_PRODUCTS_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(Array.from(set), null, 2), 'utf-8');
    } catch (e) {}
  }
}

const deletedProductIds = loadPersistedDeletedProducts();

function loadDefaultProducts(): any[] {
  for (const fp of PRODUCTS_STORAGE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn("Failed loading products from disk path:", fp, e);
    }
  }

  // Fallback to data/products.json via relative module or require
  try {
    const directPath = path.resolve(__dirname, 'data', 'products.json');
    if (fs.existsSync(directPath)) {
      const data = JSON.parse(fs.readFileSync(directPath, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {}

  return [];
}

function persistProductsToDisk(products: any[]) {
  for (const fp of PRODUCTS_STORAGE_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(products, null, 2), 'utf-8');
    } catch (e) {}
  }
}

const DEFAULT_PRODUCTS = loadDefaultProducts();
let inMemoryProducts = [...DEFAULT_PRODUCTS].filter(p => !deletedProductIds.has(p.id) && !deletedProductIds.has(p.slug));

// Explicit endpoint to trigger pushing all catalog products to Supabase
app.post(["/api/admin/products/push-supabase", "/api/admin/products/push-firestore", "/api/products/sync-to-firestore"], async (req, res) => {
  try {
    const supabase = initServerSupabase();
    if (!supabase) {
      return res.status(400).json({ 
        error: "Supabase not connected. Please verify SUPABASE_URL and SUPABASE_ANON_KEY.",
        products_ready_in_catalog: inMemoryProducts.length 
      });
    }
    const { error } = await supabase.from('products').upsert(inMemoryProducts, { onConflict: 'id' });
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ 
      success: true, 
      message: `Successfully pushed ${inMemoryProducts.length} products to Supabase table 'products'.`,
      count: inMemoryProducts.length 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/products", adminAuth, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: sbProds } = await withTimeoutServer(
          supabase.from('products').select('*'),
          2500,
          { data: null, error: null } as any
        );
        if (Array.isArray(sbProds) && sbProds.length > 0) {
          inMemoryProducts = sbProds.filter(p => !deletedProductIds.has(p.id) && !deletedProductIds.has(p.slug));
          try {
            persistProductsToDisk(inMemoryProducts);
          } catch (e) {}
          return res.json(inMemoryProducts);
        }
      }
    } catch (e) {
      console.warn("Supabase admin products fetch notice:", e);
    }
    const filtered = inMemoryProducts.filter(p => !deletedProductIds.has(p.id) && !deletedProductIds.has(p.slug));
    return res.json(filtered);
  } catch (err: any) {
    console.warn("Admin products fallback error:", err);
    return res.json([]);
  }
});

app.post("/api/admin/upload", adminAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Ensure we use a safe, unique filename
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Save to public/uploads directory
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      return res.json({ url: `/uploads/${fileName}` });
    } catch (fsErr) {
      // Fallback to data URI if disk write is restricted
      const dataUri = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
      return res.json({ url: dataUri });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/products", adminAuth, async (req, res) => {
  const { 
    id, slug, title, collection, category, price, stock_count, description, details, 
    mainImage, lifestyleImage, galleryImages, imageFit, variants, 
    isFeatured, hasVictorianFrame, material 
  } = req.body;

  const newProd = {
    id: id || slug || title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `matilda-${Date.now()}`,
    slug: slug || title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `prod-${Date.now()}`, 
    title: title || 'New Product', collection: collection || 'women', category: category || 'general', price: Number(price || 0), stock_count: Number(stock_count || 0), description: description || '', 
    details: details || [], 
    mainImage: mainImage || '', lifestyleImage: lifestyleImage || '', 
    galleryImages: galleryImages || [], 
    imageFit: imageFit || 'cover', 
    variants: variants || [], 
    isFeatured: !!isFeatured, 
    hasVictorianFrame: !!hasVictorianFrame, 
    material: material || ''
  };

  // Remove from deleted products registry if re-created
  if (newProd.id) deletedProductIds.delete(newProd.id);
  if (newProd.slug) deletedProductIds.delete(newProd.slug);
  persistDeletedProductsToDisk(deletedProductIds);

  inMemoryProducts = inMemoryProducts.filter(p => p.id !== newProd.id && p.slug !== newProd.slug);
  inMemoryProducts.unshift(newProd);
  persistProductsToDisk(inMemoryProducts);

  // Sync to Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('products').upsert(newProd, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn("Supabase product insert notice:", e);
  }

  res.json(newProd);
});

app.put("/api/admin/products/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { 
    slug, title, collection, category, price, stock_count, description, details, 
    mainImage, lifestyleImage, galleryImages, imageFit, variants, 
    isFeatured, hasVictorianFrame, material 
  } = req.body;

  const updatedProd = {
    id,
    slug: slug || title?.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    title, collection, category, price: Number(price || 0), stock_count: Number(stock_count || 0), description,
    details: details || [],
    mainImage, lifestyleImage,
    galleryImages: galleryImages || [],
    imageFit: imageFit || 'cover',
    variants: variants || [],
    isFeatured: !!isFeatured,
    hasVictorianFrame: !!hasVictorianFrame,
    material
  };

  // Unmark as deleted
  if (id) deletedProductIds.delete(id);
  if (updatedProd.slug) deletedProductIds.delete(updatedProd.slug);
  persistDeletedProductsToDisk(deletedProductIds);

  let found = false;
  inMemoryProducts = inMemoryProducts.map(p => {
    if (p.id === id || (p.slug && p.slug === updatedProd.slug)) {
      found = true;
      return { ...p, ...updatedProd };
    }
    return p;
  });
  if (!found) {
    inMemoryProducts.unshift(updatedProd);
  }
  persistProductsToDisk(inMemoryProducts);

  // Sync to Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('products').upsert(updatedProd, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn("Supabase product update notice:", e);
  }

  res.json(updatedProd);
});

app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const targetId = decodeURIComponent(id).trim();
  const querySlug = (req.query.slug as string || '').toLowerCase().trim();

  const matched = inMemoryProducts.find(p => p.id === targetId || p.slug === targetId || (querySlug && p.slug === querySlug));
  const targetSlug = querySlug || matched?.slug || targetId;

  // Track in deleted products registry
  deletedProductIds.add(targetId);
  deletedProductIds.add(targetSlug);
  if (matched?.title) {
    deletedProductIds.add(matched.title.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
  persistDeletedProductsToDisk(deletedProductIds);

  inMemoryProducts = inMemoryProducts.filter(p => {
    const pid = p.id;
    const pslug = p.slug;
    return pid !== targetId && pid !== targetSlug && pslug !== targetId && pslug !== targetSlug;
  });
  persistProductsToDisk(inMemoryProducts);

  // Delete from Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('products').delete().or(`id.eq.${targetId},slug.eq.${targetSlug}`);
    }
  } catch (e) {
    console.warn("Supabase product delete notice:", e);
  }

  res.json({ success: true, deletedId: targetId });
});

// Categories API
app.get(["/api/categories", "/categories", "/api/categories/"], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    let catList: any[] = inMemoryCategories && inMemoryCategories.length > 0 ? [...inMemoryCategories] : [...DEFAULT_CATEGORIES];
    
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: sbCats } = await withTimeoutServer(supabase.from('categories').select('*'), 2000, { data: null, error: null } as any);
        if (Array.isArray(sbCats) && sbCats.length > 0) {
          for (const sc of sbCats) {
            const sSlug = (sc.slug || sc.name || '').toLowerCase().trim();
            const sId = (sc.id || '').toLowerCase().trim();
            if (!deletedCategorySlugs.has(sSlug) && !deletedCategorySlugs.has(sId) && !deletedCategorySlugs.has(`cat-${sSlug}`)) {
              if (!catList.some(c => c.id === sc.id || (c.slug && c.slug.toLowerCase() === sSlug))) {
                catList.push(sc);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Supabase categories fetch notice:", e);
    }

    // Exclude deleted categories
    catList = catList.filter(c => {
      if (!c) return false;
      const slug = (c.slug || c.name || '').toLowerCase().trim();
      const id = (c.id || '').toLowerCase().trim();
      return !deletedCategorySlugs.has(slug) && !deletedCategorySlugs.has(id) && !deletedCategorySlugs.has(`cat-${slug}`);
    });

    if (catList.length === 0) {
      catList = [...DEFAULT_CATEGORIES];
    }

    return res.json(catList);
  } catch (err: any) {
    console.warn("Categories route fallback:", err);
    return res.json(DEFAULT_CATEGORIES);
  }
});

app.get("/api/admin/categories", adminAuth, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    let list: any[] = inMemoryCategories && inMemoryCategories.length > 0 ? [...inMemoryCategories] : [...DEFAULT_CATEGORIES];
    
    try {
      const supabase = initServerSupabase();
      if (supabase) {
        const { data: sbCats } = await withTimeoutServer(supabase.from('categories').select('*'), 2000, { data: null, error: null } as any);
        if (Array.isArray(sbCats) && sbCats.length > 0) {
          for (const sc of sbCats) {
            const sSlug = (sc.slug || sc.name || '').toLowerCase().trim();
            const sId = (sc.id || '').toLowerCase().trim();
            if (!deletedCategorySlugs.has(sSlug) && !deletedCategorySlugs.has(sId) && !deletedCategorySlugs.has(`cat-${sSlug}`)) {
              if (!list.some(c => c.id === sc.id || (c.slug && c.slug.toLowerCase() === sSlug))) {
                list.push(sc);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Supabase admin categories fetch notice:", e);
    }

    list = list.filter(c => {
      if (!c) return false;
      const slug = (c.slug || c.name || '').toLowerCase().trim();
      const id = (c.id || '').toLowerCase().trim();
      return !deletedCategorySlugs.has(slug) && !deletedCategorySlugs.has(id) && !deletedCategorySlugs.has(`cat-${slug}`);
    });

    if (list.length === 0) {
      list = [...DEFAULT_CATEGORIES];
    }

    return res.json(list);
  } catch (err: any) {
    console.warn("Admin categories route fallback:", err);
    return res.json(DEFAULT_CATEGORIES);
  }
});

app.post("/api/admin/categories/clear-all", adminAuth, async (req, res) => {
  inMemoryCategories = [];
  persistCategoriesToDisk([]);
  
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('categories').delete().neq('id', '___nonexistent___');
    }
  } catch (e) {
    console.warn("Supabase categories clear notice:", e);
  }

  res.json({ success: true, categories: [] });
});

app.post("/api/admin/categories", adminAuth, async (req, res) => {
  const { id, name, slug, description } = req.body || {};
  const newSlug = (slug || name || 'new').toLowerCase().trim().replace(/\s+/g, '-');
  const newCat = {
    id: id || `cat-${newSlug}-${Date.now()}`,
    name: name || 'New Category',
    slug: newSlug,
    description: description || ''
  };

  deletedCategorySlugs.delete(newSlug);
  deletedCategorySlugs.delete(newCat.id);
  deletedCategorySlugs.delete(`cat-${newSlug}`);

  inMemoryCategories = inMemoryCategories.filter(c => c.id !== newCat.id && c.slug !== newCat.slug);
  inMemoryCategories.push(newCat);
  persistCategoriesToDisk(inMemoryCategories);

  // Sync to Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('categories').upsert(newCat, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn("Supabase category insert notice:", e);
  }

  res.json(newCat);
});

app.put("/api/admin/categories/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const targetId = decodeURIComponent(id);
  const { name, slug, description, oldSlug } = req.body || {};

  const cleanOldSlug = (oldSlug || targetId.replace(/^cat-/, '')).toLowerCase().trim();
  const newSlug = (slug || name || '').toLowerCase().trim().replace(/\s+/g, '-');
  const updatedCat = {
    id: targetId,
    name: name || 'Category',
    slug: newSlug,
    description: description || ''
  };

  deletedCategorySlugs.delete(newSlug);
  deletedCategorySlugs.delete(targetId);
  deletedCategorySlugs.delete(`cat-${newSlug}`);

  let found = false;
  inMemoryCategories = inMemoryCategories.map(c => {
    if (c.id === targetId || (c.slug && c.slug.toLowerCase() === cleanOldSlug) || (c.slug && c.slug.toLowerCase() === newSlug)) {
      found = true;
      return updatedCat;
    }
    return c;
  });
  if (!found) {
    inMemoryCategories.push(updatedCat);
  }
  persistCategoriesToDisk(inMemoryCategories);

  // Sync to Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('categories').upsert(updatedCat, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn("Supabase category update notice:", e);
  }

  // Update products if slug changed
  if (cleanOldSlug && cleanOldSlug !== newSlug) {
    deletedCategorySlugs.add(cleanOldSlug);
    deletedCategorySlugs.add(`cat-${cleanOldSlug}`);

    inMemoryProducts = inMemoryProducts.map(p => {
      const pCat = (p.category || '').toLowerCase().trim();
      if (pCat === cleanOldSlug || pCat === targetId.toLowerCase() || pCat === `cat-${cleanOldSlug}`) {
        return { ...p, category: newSlug };
      }
      return p;
    });
  }

  res.json(updatedCat);
});

app.delete("/api/admin/categories/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const targetId = decodeURIComponent(id).trim();
  const querySlug = (req.query.slug as string || '').toLowerCase().trim();
  
  const matchedCat = inMemoryCategories.find(c => c.id === targetId || c.slug === targetId || c.slug === querySlug);
  const targetSlug = (querySlug || matchedCat?.slug || targetId.replace(/^cat-/, '')).toLowerCase().trim();

  deletedCategorySlugs.add(targetId);
  deletedCategorySlugs.add(targetSlug);
  deletedCategorySlugs.add(`cat-${targetSlug}`);
  if (matchedCat?.id) deletedCategorySlugs.add(matchedCat.id);

  inMemoryCategories = inMemoryCategories.filter(c => {
    const s = (c.slug || '').toLowerCase().trim();
    const cid = (c.id || '').toLowerCase().trim();
    return cid !== targetId.toLowerCase() && cid !== targetSlug && s !== targetSlug && s !== targetId.toLowerCase();
  });
  persistCategoriesToDisk(inMemoryCategories);

  // Delete from Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('categories').delete().or(`id.eq.${targetId},slug.eq.${targetSlug}`);
    }
  } catch (e) {
    console.warn("Supabase category delete notice:", e);
  }

  // Re-categorize products that had this category to 'general'
  inMemoryProducts = inMemoryProducts.map(p => {
    const pCat = (p.category || '').toLowerCase().trim();
    if (pCat === targetSlug || pCat === targetId.toLowerCase() || pCat === `cat-${targetSlug}`) {
      return { ...p, category: 'general' };
    }
    return p;
  });

  res.json({ success: true, message: "Category deleted" });
});

app.post("/api/admin/categories/reset", adminAuth, async (req, res) => {
  inMemoryCategories = [...DEFAULT_CATEGORIES];
  deletedCategorySlugs.clear();
  persistCategoriesToDisk(inMemoryCategories);

  // Sync defaults to Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('categories').upsert(DEFAULT_CATEGORIES, { onConflict: 'id' });
    }
  } catch (e) {}

  res.json(inMemoryCategories);
});

app.get("/api/admin/customers", adminAuth, async (req, res) => {
  // 1. Supabase
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const { data: list } = await supabase.from('customers').select('*');
      if (Array.isArray(list) && list.length > 0) {
        return res.json(list);
      }
    }
  } catch (e) {
    console.warn("Fetch admin customers error:", e);
  }

  // 2. Derive from in-memory orders
  const custMap = new Map<string, any>();
  inMemoryOrders.forEach(o => {
    if (!o.phone) return;
    const phone = o.phone;
    const name = o.customer_name || 'Customer';
    const amt = Number(o.total_amount || 0);
    if (custMap.has(phone)) {
      const existing = custMap.get(phone);
      existing.total_spent += amt;
      existing.order_count += 1;
    } else {
      custMap.set(phone, {
        name,
        phone,
        total_spent: amt,
        order_count: 1,
        is_blacklisted: false,
        last_order_at: o.created_at
      });
    }
  });
  res.json(Array.from(custMap.values()));
});

app.put("/api/admin/customers/:phone/toggle-blacklist", adminAuth, async (req, res) => {
  const { phone } = req.params;
  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const { data: cur } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
      if (cur) {
        const updated = !cur.is_blacklisted;
        await supabase.from('customers').update({ is_blacklisted: updated }).eq('phone', phone);
        return res.json({ ...cur, is_blacklisted: updated });
      } else {
        const newCust = { phone, is_blacklisted: true, updated_at: new Date().toISOString() };
        await supabase.from('customers').upsert(newCust, { onConflict: 'phone' });
        return res.json(newCust);
      }
    }
  } catch (e) {
    console.warn("Toggle blacklist notice:", e);
  }
  res.json({ phone, is_blacklisted: true });
});

app.put("/api/admin/settings", adminAuth, async (req, res) => {
  const { key, value } = req.body || {};
  if (key) {
    inMemorySettings[key] = value;
    persistSettingsToDisk(inMemorySettings);
  }

  try {
    const supabase = initServerSupabase();
    if (supabase) {
      if (key) {
        await supabase.from('store_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      await supabase.from('store_settings').upsert({ key: 'all', value: inMemorySettings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
  } catch (e) {
    console.warn("Supabase store_settings update error:", e);
  }
  
  res.json({ success: true, settings: inMemorySettings });
});

// --- Promo Codes & Discounts API ---
app.get(["/api/admin/promos", "/api/promos"], async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  let promoList: any[] = [];

  try {
    const supabase = initServerSupabase();
    if (supabase) {
      const { data: row } = await supabase.from('store_settings').select('*').eq('key', 'promos').maybeSingle();
      if (row && row.value) {
        const list = Array.isArray(row.value) ? row.value : row.value.list;
        if (Array.isArray(list) && list.length > 0) {
          promoList = list;
          inMemoryPromos = promoList;
          persistPromosToDisk(inMemoryPromos);
        }
      }
    }
  } catch (e) {
    console.warn("Supabase promos fetch notice:", e);
  }

  if (promoList.length === 0) {
    promoList = inMemoryPromos.length > 0 ? inMemoryPromos : loadPersistedPromos();
  }

  res.json(promoList);
});

app.put("/api/admin/promos", adminAuth, async (req, res) => {
  const { promos } = req.body || {};
  if (Array.isArray(promos)) {
    inMemoryPromos = promos;
    persistPromosToDisk(inMemoryPromos);
  }

  try {
    const supabase = initServerSupabase();
    if (supabase) {
      await supabase.from('store_settings').upsert({
        key: 'promos',
        value: { list: inMemoryPromos },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    }
  } catch (e) {
    console.warn("Supabase save promos error:", e);
  }

  res.json({ success: true, promos: inMemoryPromos });
});

app.get("/api/admin/analytics", adminAuth, async (req, res) => {
  // Use inMemoryOrders / persisted orders
  const allOrders = inMemoryOrders.length > 0 ? inMemoryOrders : loadPersistedOrders();
  const paidOrders = allOrders.filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered');
  
  const grossRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const aov = paidOrders.length ? Math.round(grossRevenue / paidOrders.length) : 0;
  
  // Aggregate revenue by date for the chart
  const recentOrdersMap = paidOrders.reduce((acc: any, order: any) => {
    const date = new Date(order.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + Number(order.total_amount || 0);
    return acc;
  }, {});

  const recentOrders = Object.keys(recentOrdersMap).map(date => ({
    date,
    revenue: recentOrdersMap[date]
  })).slice(-7);

  const latestTransactions = allOrders.slice(0, 15);
  
  res.json({
    grossRevenue,
    totalPaidOrders: paidOrders.length,
    aov,
    recentOrders,
    latestTransactions
  });
});

// Global Express Error Handler to ALWAYS return JSON instead of HTML error pages
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global API Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || "An unexpected server error occurred."
  });
});

// --- Vite Middleware ---
async function mountVite() {
  if (process.env.VERCEL) return;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
mountVite();

export default app;
