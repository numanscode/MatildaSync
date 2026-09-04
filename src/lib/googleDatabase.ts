import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  updateDoc, 
  deleteDoc,
  Firestore 
} from 'firebase/firestore';

// Environment variable reader safe for both browser (Vite) and Node/Vercel runtimes
function getEnv(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]).trim();
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch (e) {}
  return '';
}

// Firebase configuration resolution with dynamic fallback
let cachedConfigStr = '';
try {
  if (typeof localStorage !== 'undefined') {
    cachedConfigStr = localStorage.getItem('matilda_firebase_config') || '';
  }
} catch (e) {}

let parsedCachedConfig: any = null;
try {
  if (cachedConfigStr) parsedCachedConfig = JSON.parse(cachedConfigStr);
} catch (e) {}

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || getEnv('FIREBASE_API_KEY') || parsedCachedConfig?.apiKey || '',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('FIREBASE_AUTH_DOMAIN') || parsedCachedConfig?.authDomain || '',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID') || getEnv('GOOGLE_CLOUD_PROJECT') || parsedCachedConfig?.projectId || '',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('FIREBASE_STORAGE_BUCKET') || parsedCachedConfig?.storageBucket || '',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('FIREBASE_MESSAGING_SENDER_ID') || parsedCachedConfig?.messagingSenderId || '',
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID') || parsedCachedConfig?.appId || ''
};

console.log("[Firebase Client] Initial configuration scan:", {
  hasProjectId: !!firebaseConfig.projectId,
  projectId: firebaseConfig.projectId ? `${firebaseConfig.projectId.substring(0, 4)}***` : '(none)',
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  configSource: firebaseConfig.projectId 
    ? (getEnv('VITE_FIREBASE_PROJECT_ID') ? 'Vite bundle env' : (getEnv('FIREBASE_PROJECT_ID') ? 'process.env' : 'localStorage cache'))
    : 'pending API discovery'
});

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

// Background fetch to load Firebase credentials from backend Express server if not in browser env
if (typeof window !== 'undefined' && !firebaseConfig.projectId) {
  console.log("[Firebase Client] Project ID missing in bundle. Fetching public config from /api/config/public...");
  fetch('/api/config/public')
    .then(r => {
      console.log(`[Firebase Client] /api/config/public response status: ${r.status}`);
      return r.ok ? r.json() : null;
    })
    .then(data => {
      if (data?.firebase?.projectId) {
        console.log("[Firebase Client] Received server Firebase configuration:", {
          projectId: data.firebase.projectId,
          authDomain: data.firebase.authDomain,
          hasApiKey: !!data.firebase.apiKey
        });
        Object.assign(firebaseConfig, data.firebase);
        try {
          localStorage.setItem('matilda_firebase_config', JSON.stringify(data.firebase));
        } catch (e) {}
        getGoogleFirestore();
      } else {
        console.warn("[Firebase Client] /api/config/public did not return a projectId. Ensure FIREBASE_PROJECT_ID is set in Vercel settings.");
      }
    })
    .catch((err) => {
      console.warn("[Firebase Client] /api/config/public fetch failed:", err);
    });
}

export function getGoogleFirestore(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  
  if (firebaseConfig.projectId) {
    try {
      console.log(`[Firebase Client] Initializing Firestore for project: "${firebaseConfig.projectId}"...`);
      if (getApps().length > 0) {
        firebaseApp = getApp();
        console.log("[Firebase Client] Reusing existing initialized FirebaseApp instance.");
      } else {
        firebaseApp = initializeApp(firebaseConfig);
        console.log("[Firebase Client] Created new FirebaseApp instance successfully.");
      }
      firestoreDb = getFirestore(firebaseApp);
      console.log("[Firebase Client] Firestore instance connected successfully.");

      // Expose to window for live DevTools diagnostics
      if (typeof window !== 'undefined') {
        (window as any).__firebaseDebug = {
          config: { ...firebaseConfig, apiKey: firebaseConfig.apiKey ? '***' : '' },
          connected: true,
          db: firestoreDb
        };
      }

      return firestoreDb;
    } catch (err) {
      console.error("[Firebase Client] Firestore client initialization error:", err);
    }
  } else {
    console.warn("[Firebase Client] Firestore initialization skipped: No projectId found. Set FIREBASE_PROJECT_ID in environment.");
  }
  return null;
}

export const firestore = getGoogleFirestore();

// Local Storage Order Cache Key
const LOCAL_STORAGE_KEY = 'matilda_local_orders';

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  items: any;
  total_amount: number;
  utr_number: string;
  screenshot_url?: string;
  payment_screenshot?: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'rejected' | 'cancelled';
  courier_name?: string;
  tracking_number?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
  synced?: boolean;
}

// 1. Submit Order with Multi-Engine Fallback (API -> Firestore -> Local Storage)
export async function submitOrder(orderData: Partial<OrderRecord>, file?: File | null): Promise<{ success: boolean; orderNumber: string; source: string }> {
  const orderNumber = orderData.order_number || `MT-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const rawUtr = String(orderData.utr_number || '').trim();
  const isCodOrder = 
    rawUtr.toUpperCase().includes('COD') || 
    rawUtr.toLowerCase().includes('cash on delivery') ||
    (typeof orderData.items === 'object' && (orderData.items as any)?.payment_method === 'cod');

  const fullOrder: OrderRecord = {
    id: orderData.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    order_number: orderNumber,
    customer_name: orderData.customer_name || 'Valued Customer',
    phone: orderData.phone || '',
    address: orderData.address || '',
    items: orderData.items || [],
    total_amount: Number(orderData.total_amount) || 0,
    utr_number: orderData.utr_number || (isCodOrder ? 'COD - Cash on Delivery' : 'COD'),
    screenshot_url: orderData.screenshot_url || '',
    payment_screenshot: orderData.payment_screenshot || '',
    status: 'pending',
    created_at: orderData.created_at || new Date().toISOString(),
    synced: false
  };

  // Always cache immediately in LocalStorage
  saveOrderToLocalStorage(fullOrder);

  // Attempt 1: Call Backend API (/api/checkout)
  try {
    const formData = new FormData();
    formData.append('name', fullOrder.customer_name);
    formData.append('phone', fullOrder.phone);
    formData.append('address', fullOrder.address);
    formData.append('total', String(fullOrder.total_amount));
    formData.append('utr', fullOrder.utr_number);
    formData.append('payment_method', isCodOrder ? 'cod' : 'upi');
    formData.append('order_number', fullOrder.order_number);
    formData.append('items', typeof fullOrder.items === 'string' ? fullOrder.items : JSON.stringify(fullOrder.items));
    if (file) {
      formData.append('screenshot', file);
    } else if (fullOrder.screenshot_url) {
      formData.append('screenshot_url', fullOrder.screenshot_url);
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const returnedNumber = data.orderNumber || orderNumber;
      markOrderSyncedInLocalStorage(returnedNumber);
      return { success: true, orderNumber: returnedNumber, source: 'backend-api' };
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson && errJson.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (apiErr: any) {
    if (apiErr && apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('network') && !apiErr.message.includes('Failed to fetch')) {
      throw apiErr;
    }
    console.warn("Backend API checkout notice (attempting direct Google Firestore fallback):", apiErr);
  }

  // Attempt 2: Direct Google Cloud Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      await setDoc(doc(db, 'orders', orderNumber), {
        ...fullOrder,
        synced: true
      });
      markOrderSyncedInLocalStorage(orderNumber);
      return { success: true, orderNumber, source: 'google-firestore' };
    } catch (fsErr) {
      console.warn("Direct Firestore insert notice:", fsErr);
    }
  }

  // Fallback: Local storage is already preserved and auto-syncer will sync as soon as connected
  return { success: true, orderNumber, source: 'local-backup' };
}

// 2. Local Storage Handlers
export function getLocalOrders(): OrderRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveOrderToLocalStorage(order: OrderRecord) {
  try {
    const orders = getLocalOrders();
    const existingIndex = orders.findIndex(o => o.order_number === order.order_number || o.id === order.id);
    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
      orders.unshift(order);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

export function markOrderSyncedInLocalStorage(orderNumber: string) {
  try {
    const orders = getLocalOrders();
    const updated = orders.map(o => {
      if (o.order_number === orderNumber || o.id === orderNumber) {
        return { ...o, synced: true };
      }
      return o;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
}

// 3. Auto-Sync Worker: Pushes any unsynced local orders to the server & Google Firestore
export async function syncUnsyncedOrders(): Promise<{ syncedCount: number; total: number }> {
  const localOrders = getLocalOrders();
  const unsynced = localOrders.filter(o => !o.synced);
  if (unsynced.length === 0) return { syncedCount: 0, total: localOrders.length };

  let syncedCount = 0;

  try {
    const res = await fetch('/api/orders/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: unsynced })
    });

    if (res.ok) {
      const data = await res.json();
      syncedCount = data.syncedCount || unsynced.length;
      // Mark as synced locally
      unsynced.forEach(o => markOrderSyncedInLocalStorage(o.order_number));
    }
  } catch (err) {
    console.warn("Auto-sync API notice:", err);
  }

  // Also sync to Google Firestore if available
  const db = getGoogleFirestore();
  if (db && unsynced.length > 0) {
    for (const order of unsynced) {
      try {
        await setDoc(doc(db, 'orders', order.order_number), {
          ...order,
          synced: true
        });
        markOrderSyncedInLocalStorage(order.order_number);
        syncedCount++;
      } catch (e) {}
    }
  }

  return { syncedCount, total: localOrders.length };
}

// 4. Query Order by Order Number across all tiers
export async function getOrderDetails(orderNumber: string): Promise<OrderRecord | null> {
  if (!orderNumber) return null;

  // 1. Try Backend API
  try {
    const res = await fetch(`/api/orders/details?order=${encodeURIComponent(orderNumber)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // 2. Try Google Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'orders', orderNumber));
      if (docSnap.exists()) {
        return docSnap.data() as OrderRecord;
      }
    } catch (e) {}
  }

  // 3. Try LocalStorage
  const local = getLocalOrders();
  const found = local.find(o => o.order_number === orderNumber || o.id === orderNumber);
  if (found) return found;

  return null;
}
