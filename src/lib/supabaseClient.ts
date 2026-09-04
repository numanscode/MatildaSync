import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable reader safe for Vite, Node, and Vercel runtimes
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

export const SUPABASE_URL = 
  getEnv('VITE_SUPABASE_URL') || 
  getEnv('SUPABASE_URL') || 
  'https://utcumpugoogwsgafotlh.supabase.co';

export const SUPABASE_ANON_KEY = 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_SERVICE_ROLE_KEY') || 
  'sb_publishable_EzZ6EuXR-9_ZPf9G38Ou3Q_zGyUpOom';

console.log("[Supabase Client] Initializing with project URL:", SUPABASE_URL);

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabase();

// Local storage key for offline resilient orders
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

// 1. Submit Order with Multi-Tier Fallback (API -> Direct Supabase -> Local Cache)
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
    console.warn("Backend API checkout notice (attempting direct Supabase fallback):", apiErr);
  }

  // Attempt 2: Direct Supabase Database insert
  try {
    const client = getSupabase();
    let uploadedScreenshotUrl = fullOrder.screenshot_url;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `order_${orderNumber}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await client.storage
          .from('product-images')
          .upload(`proofs/${fileName}`, file, { cacheControl: '3600', upsert: true });

        if (!uploadErr && uploadData?.path) {
          const { data: pubData } = client.storage.from('product-images').getPublicUrl(`proofs/${fileName}`);
          if (pubData?.publicUrl) {
            uploadedScreenshotUrl = pubData.publicUrl;
          }
        }
      } catch (uploadNotice) {
        console.warn("Direct screenshot upload notice:", uploadNotice);
      }
    }

    const supabasePayload = {
      id: fullOrder.id,
      order_number: fullOrder.order_number,
      customer_name: fullOrder.customer_name,
      phone: fullOrder.phone,
      address: fullOrder.address,
      items: typeof fullOrder.items === 'string' ? JSON.parse(fullOrder.items) : fullOrder.items,
      total_amount: fullOrder.total_amount,
      utr_number: fullOrder.utr_number,
      screenshot_url: uploadedScreenshotUrl || fullOrder.screenshot_url || '',
      payment_screenshot: uploadedScreenshotUrl || fullOrder.payment_screenshot || '',
      status: 'pending',
      created_at: fullOrder.created_at,
      synced: true
    };

    const { error: insertErr } = await client
      .from('orders')
      .upsert(supabasePayload, { onConflict: 'order_number' });

    if (!insertErr) {
      markOrderSyncedInLocalStorage(orderNumber);
      return { success: true, orderNumber, source: 'supabase-direct' };
    } else {
      console.warn("Supabase direct insert notice:", insertErr.message);
    }
  } catch (sbErr) {
    console.warn("Supabase direct order insert exception:", sbErr);
  }

  // Fallback: Local storage is saved and will be auto-synced
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

// 3. Auto-Sync Worker: Pushes unsynced orders to server & Supabase
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
      unsynced.forEach(o => markOrderSyncedInLocalStorage(o.order_number));
    }
  } catch (err) {
    console.warn("Auto-sync API notice:", err);
  }

  // Also push directly to Supabase if available
  try {
    const client = getSupabase();
    for (const order of unsynced) {
      const { error } = await client.from('orders').upsert({
        ...order,
        synced: true
      }, { onConflict: 'order_number' });
      if (!error) {
        markOrderSyncedInLocalStorage(order.order_number);
        syncedCount++;
      }
    }
  } catch (e) {}

  return { syncedCount, total: localOrders.length };
}

// 4. Query Order Details across Backend API, Supabase, and LocalStorage
export async function getOrderDetails(orderNumber: string): Promise<OrderRecord | null> {
  if (!orderNumber) return null;

  // 1. Try Backend API
  try {
    const res = await fetch(`/api/orders/details?order=${encodeURIComponent(orderNumber)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // 2. Try Supabase direct query
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('orders')
      .select('*')
      .or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as OrderRecord;
    }
  } catch (e) {}

  // 3. Try LocalStorage
  const local = getLocalOrders();
  const found = local.find(o => o.order_number === orderNumber || o.id === orderNumber);
  if (found) return found;

  return null;
}
