import { getSupabase, syncUnsyncedOrders } from './supabaseClient';
import { broadcastSync } from './syncChannel';

function withTimeout<T>(promise: Promise<T>, ms = 3000, fallbackVal: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackVal), ms))
  ]);
}

export function getAdminToken(): string {
  return localStorage.getItem('admin_token') || 'matilda_auth_ok';
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// --- Orders API ---
export async function fetchAllOrders(): Promise<any[]> {
  let ordersMap = new Map<string, any>();

  // Run background auto-sync for any pending local orders
  syncUnsyncedOrders().catch(() => {});

  // 1. Fetch from Express Backend API (reads from disk + Supabase)
  try {
    const res = await withTimeout(fetch('/api/admin/orders', {
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    }), 3500, null as any);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach(order => {
          const key = order.order_number || order.id;
          if (key) ordersMap.set(key, order);
        });
      }
    }
  } catch (err) {
    console.warn('API admin orders fetch notice:', err);
  }

  // 2. Fetch directly from Supabase with timeout
  try {
    const client = getSupabase();
    const { data: sbOrders, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (!error && Array.isArray(sbOrders)) {
      sbOrders.forEach((order: any) => {
        const key = order.order_number || order.id;
        if (key && !ordersMap.has(key)) {
          ordersMap.set(key, order);
        }
      });
    }
  } catch (sbErr) {
    console.warn('Supabase admin orders fetch notice:', sbErr);
  }

  // 3. Fallback / Merge from LocalStorage
  try {
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      const localArr = JSON.parse(localStr);
      if (Array.isArray(localArr)) {
        localArr.forEach((item: any) => {
          const key = item.order_number || item.id;
          if (key && !ordersMap.has(key)) {
            ordersMap.set(key, item);
          }
        });
      }
    }
  } catch (err) {
    console.warn('LocalStorage orders merge notice:', err);
  }

  // Return sorted by created_at descending
  return Array.from(ordersMap.values()).sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });
}

export async function updateOrderStatus(id: string, status: string, additionalData: any = {}): Promise<any> {
  const updateData = { status, ...additionalData, updated_at: new Date().toISOString() };

  // 1. Express Backend
  try {
    const res = await withTimeout(fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updateData)
    }), 3500, null as any);
    if (res && res.ok) {
      const updated = await res.json();
      broadcastSync({ type: 'ORDERS_UPDATED', timestamp: Date.now() });
      return updated;
    }
  } catch (e) {
    console.warn('Backend order update notice:', e);
  }

  // 2. Direct Supabase update
  try {
    const client = getSupabase();
    await client
      .from('orders')
      .update(updateData)
      .or(`id.eq.${id},order_number.eq.${id}`);
  } catch (sbErr) {
    console.warn('Supabase order update notice:', sbErr);
  }

  // 3. Update Local Storage
  try {
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      const orders = JSON.parse(localStr);
      if (Array.isArray(orders)) {
        const updated = orders.map((o: any) => {
          if (o.id === id || o.order_number === id) {
            return { ...o, ...updateData };
          }
          return o;
        });
        localStorage.setItem('matilda_local_orders', JSON.stringify(updated));
      }
    }
  } catch (e) {}

  broadcastSync({ type: 'ORDERS_UPDATED', timestamp: Date.now() });
  return { id, ...updateData };
}

export async function deleteAdminOrder(id: string): Promise<boolean> {
  // 1. Express Backend
  try {
    await withTimeout(fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    }), 3500, null as any);
  } catch (e) {
    console.warn('Backend order delete notice:', e);
  }

  // 2. Supabase delete
  try {
    const client = getSupabase();
    await client
      .from('orders')
      .delete()
      .or(`id.eq.${id},order_number.eq.${id}`);
  } catch (sbErr) {
    console.warn('Supabase order delete notice:', sbErr);
  }

  // 3. Local Storage update
  try {
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      const orders = JSON.parse(localStr);
      if (Array.isArray(orders)) {
        const filtered = orders.filter((o: any) => o.id !== id && o.order_number !== id);
        localStorage.setItem('matilda_local_orders', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  broadcastSync({ type: 'ORDERS_UPDATED', timestamp: Date.now() });
  return true;
}

export async function pushOrdersToCloud(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch('/api/admin/orders/push-supabase', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Push local orders directly to Supabase
  try {
    const client = getSupabase();
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      const orders = JSON.parse(localStr);
      if (Array.isArray(orders) && orders.length > 0) {
        for (const order of orders) {
          await client.from('orders').upsert({
            ...order,
            synced: true
          }, { onConflict: 'order_number' });
        }
        return { success: true, count: orders.length, message: `Synced ${orders.length} orders directly to Supabase.` };
      }
    }
  } catch (sbErr: any) {
    return { success: false, count: 0, message: sbErr.message || 'Supabase sync failed' };
  }

  return { success: true, count: 0, message: 'All orders are synchronized.' };
}

// --- Deleted Products Local Set ---
export function getLocalDeletedProductIds(): Set<string> {
  try {
    const saved = localStorage.getItem('matilda_deleted_products');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set<string>();
}

export function recordDeletedProductId(id?: string, slug?: string) {
  try {
    const current = getLocalDeletedProductIds();
    if (id) current.add(id);
    if (slug) current.add(slug);
    localStorage.setItem('matilda_deleted_products', JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function unmarkDeletedProductId(id?: string, slug?: string) {
  try {
    const current = getLocalDeletedProductIds();
    if (id) current.delete(id);
    if (slug) current.delete(slug);
    localStorage.setItem('matilda_deleted_products', JSON.stringify(Array.from(current)));
  } catch (e) {}
}

// --- Products API ---
export async function fetchPublicProducts(collectionName?: string, category?: string): Promise<any[]> {
  const deletedSet = getLocalDeletedProductIds();

  // 1. Try server API with timeout
  try {
    const queryParams = new URLSearchParams();
    if (collectionName) queryParams.set('collection', collectionName);
    if (category) queryParams.set('category', category);
    queryParams.set('_t', Date.now().toString());
    const queryString = `?${queryParams.toString()}`;

    const res = await withTimeout(fetch(`/api/products${queryString}`, { cache: 'no-store' }), 3500, null as any);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.filter((p: any) => !deletedSet.has(p.id) && !deletedSet.has(p.slug));
      }
    }
  } catch (e) {
    console.warn('Public products fetch notice:', e);
  }

  // 2. Direct Supabase fallback
  try {
    const client = getSupabase();
    let queryBuilder = client.from('products').select('*');
    if (collectionName && collectionName !== 'all') {
      queryBuilder = queryBuilder.ilike('collection', `%${collectionName}%`);
    }
    if (category && category !== 'all') {
      queryBuilder = queryBuilder.ilike('category', `%${category}%`);
    }

    const { data: sbProds, error } = await queryBuilder;
    if (!error && Array.isArray(sbProds)) {
      return sbProds.filter((p: any) => !deletedSet.has(p.id) && !deletedSet.has(p.slug));
    }
  } catch (sbErr) {
    console.warn('Supabase public products fetch notice:', sbErr);
  }

  return [];
}

export async function fetchAdminProducts(): Promise<any[]> {
  const deletedSet = getLocalDeletedProductIds();

  try {
    const res = await withTimeout(fetch(`/api/admin/products?_t=${Date.now()}`, {
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      cache: 'no-store'
    }), 3500, null as any);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.filter((p: any) => !deletedSet.has(p.id) && !deletedSet.has(p.slug));
      }
    }
  } catch (e) {
    console.warn('API products fetch notice:', e);
  }

  return fetchPublicProducts();
}

export async function saveAdminProduct(prod: any, isEdit: boolean): Promise<any> {
  unmarkDeletedProductId(prod.id, prod.slug);

  const url = isEdit ? `/api/admin/products/${encodeURIComponent(prod.id)}` : '/api/admin/products';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await withTimeout(fetch(url, {
      method,
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(prod)
    }), 3500, null as any);
    if (res && res.ok) {
      const saved = await res.json();
      if (saved) {
        broadcastSync({ type: 'CATALOGUE_UPDATED', timestamp: Date.now() });
        return saved;
      }
    }
  } catch (e) {
    console.warn('Backend product save notice:', e);
  }

  // Direct Supabase upsert
  try {
    const client = getSupabase();
    await client.from('products').upsert(prod, { onConflict: 'id' });
  } catch (sbErr) {
    console.warn('Supabase product save notice:', sbErr);
  }

  broadcastSync({ type: 'CATALOGUE_UPDATED', timestamp: Date.now() });
  return prod;
}

export async function deleteAdminProduct(id: string, slug?: string): Promise<boolean> {
  recordDeletedProductId(id, slug);

  const querySlug = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  try {
    await withTimeout(fetch(`/api/admin/products/${encodeURIComponent(id)}${querySlug}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    }), 3500, null as any);
  } catch (e) {
    console.warn('Backend product delete notice:', e);
  }

  // Direct Supabase delete
  try {
    const client = getSupabase();
    await client.from('products').delete().or(`id.eq.${id},slug.eq.${id}`);
    if (slug && slug !== id) {
      await client.from('products').delete().eq('slug', slug);
    }
  } catch (sbErr) {
    console.warn('Supabase product delete notice:', sbErr);
  }

  broadcastSync({ type: 'CATALOGUE_UPDATED', timestamp: Date.now() });
  return true;
}

// --- Categories API ---
export async function fetchPublicCategories(): Promise<any[]> {
  let cats: any[] | null = null;

  // 1. Fetch via Express API endpoint
  try {
    const res = await fetch(`/api/categories?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        cats = data;
      }
    }
  } catch (e) {
    console.warn('Public categories fetch notice:', e);
  }

  // 2. Direct Supabase fallback
  if (cats === null) {
    try {
      const client = getSupabase();
      const { data: sbCats, error } = await client.from('categories').select('*');
      if (!error && Array.isArray(sbCats) && sbCats.length > 0) {
        cats = sbCats;
      }
    } catch (e) {}
  }

  // 3. LocalStorage fallback
  if (cats === null) {
    try {
      const saved = localStorage.getItem('matilda_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          cats = parsed;
        }
      }
    } catch (e) {}
  }

  const DEFAULT_CLIENT_CATEGORIES = [
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

  const finalCats = (cats && cats.length > 0) ? cats : DEFAULT_CLIENT_CATEGORIES;

  // Normalize format
  return finalCats.map((c: any, idx: number) => {
    const name = c.name || c.title || 'Category';
    const slug = (c.slug || name.toLowerCase().replace(/\s+/g, '-')).toLowerCase().trim();
    return {
      id: c.id || `cat-${slug}-${idx}`,
      name,
      slug,
      description: c.description || ''
    };
  });
}

export async function saveAdminCategory(category: any, isEdit: boolean): Promise<any> {
  const url = isEdit ? `/api/admin/categories/${encodeURIComponent(category.id)}` : '/api/admin/categories';
  const method = isEdit ? 'PUT' : 'POST';

  const dbCat = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || ''
  };

  // 1. Write to Express API
  try {
    const res = await fetch(url, {
      method,
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(dbCat)
    });
    if (res.ok) {
      const saved = await res.json();
      if (saved) {
        dbCat.id = saved.id || dbCat.id;
      }
    }
  } catch (e) {
    console.warn('Backend category save notice:', e);
  }

  // 2. Direct Supabase
  try {
    const client = getSupabase();
    await client.from('categories').upsert(dbCat, { onConflict: 'id' });
  } catch (sbErr) {
    console.warn('Supabase category save notice:', sbErr);
  }

  broadcastSync({ type: 'CATEGORIES_UPDATED', timestamp: Date.now() });
  return dbCat;
}

export async function deleteAdminCategory(id: string, slug?: string): Promise<boolean> {
  const cleanSlug = slug || id.replace(/^cat-/, '').toLowerCase().trim();
  const queryParam = slug ? `?slug=${encodeURIComponent(slug)}` : '';

  // 1. Express API delete
  try {
    await fetch(`/api/admin/categories/${encodeURIComponent(id)}${queryParam}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
  } catch (e) {
    console.warn('Backend category delete notice:', e);
  }

  // 2. Direct Supabase delete
  try {
    const client = getSupabase();
    await client.from('categories').delete().or(`id.eq.${id},slug.eq.${cleanSlug}`);
  } catch (sbErr) {
    console.warn('Supabase category delete notice:', sbErr);
  }

  // 3. Clear from LocalStorage fallback
  try {
    const saved = localStorage.getItem('matilda_categories');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => c.id !== id && c.slug !== cleanSlug && c.id !== cleanSlug);
        localStorage.setItem('matilda_categories', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  broadcastSync({ type: 'CATEGORIES_UPDATED', timestamp: Date.now() });
  return true;
}

export async function resetAdminCategories(): Promise<any[]> {
  try {
    localStorage.removeItem('matilda_categories');
  } catch (e) {}

  try {
    const client = getSupabase();
    await client.from('categories').delete().neq('id', '___non_existent___');
  } catch (e) {}

  try {
    await fetch('/api/admin/categories/clear-all', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
  } catch (e) {}

  broadcastSync({ type: 'CATEGORIES_UPDATED', timestamp: Date.now() });
  return [];
}

// --- Customers API ---
export async function fetchAdminCustomers(): Promise<any[]> {
  try {
    const res = await fetch('/api/admin/customers', {
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}

  try {
    const client = getSupabase();
    const { data: sbCustomers, error } = await client.from('customers').select('*');
    if (!error && Array.isArray(sbCustomers)) {
      return sbCustomers;
    }
  } catch (e) {}

  return [];
}

export async function toggleCustomerBlacklist(phone: string): Promise<any> {
  try {
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(phone)}/toggle-blacklist`, {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  try {
    const client = getSupabase();
    const { data: found } = await client.from('customers').select('*').eq('phone', phone).maybeSingle();
    if (found) {
      const newStatus = !found.is_blacklisted;
      await client.from('customers').update({ is_blacklisted: newStatus }).eq('phone', phone);
      return { ...found, is_blacklisted: newStatus };
    }
  } catch (e) {}

  return null;
}

// --- Promo Codes & Discounts API ---
export async function fetchAdminPromos(): Promise<any[]> {
  try {
    const res = await fetch('/api/admin/promos', {
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}

  try {
    const client = getSupabase();
    const { data: settingsData } = await client
      .from('store_settings')
      .select('promo_codes')
      .eq('id', 'promos')
      .maybeSingle();

    if (settingsData && Array.isArray(settingsData.promo_codes)) {
      return settingsData.promo_codes;
    }
  } catch (e) {}

  try {
    const local = localStorage.getItem('matilda_promos');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  return [
    {
      code: 'WELCOME10',
      discount_type: 'percentage',
      discount_percentage: 10,
      target_type: 'global',
      is_active: true
    }
  ];
}

export async function saveAdminPromos(promos: any[]): Promise<boolean> {
  try {
    await fetch('/api/admin/promos', {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ promos })
    });
  } catch (e) {}

  try {
    const client = getSupabase();
    await client.from('store_settings').upsert({
      id: 'promos',
      promo_codes: promos,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {}

  try {
    localStorage.setItem('matilda_promos', JSON.stringify(promos));
  } catch (e) {}

  broadcastSync({ type: 'PROMOS_UPDATED', timestamp: Date.now() });
  return true;
}

export const deleteOrderRecord = deleteAdminOrder;
