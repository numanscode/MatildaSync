import { getGoogleFirestore, syncUnsyncedOrders } from './googleDatabase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
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

  // 1. Fetch from Express Backend API (reads from disk + Firestore + Supabase)
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

  // 2. Fetch directly from Google Cloud Firestore with timeout
  const db = getGoogleFirestore();
  if (db) {
    try {
      const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(150));
      const snap = await withTimeout(getDocs(q), 3000, null as any);
      if (snap) {
        snap.forEach((d: any) => {
          const order = d.data();
          const key = order.order_number || order.id;
          if (key && !ordersMap.has(key)) {
            ordersMap.set(key, order);
          }
        });
      }
    } catch (fsErr) {
      console.warn('Firestore admin orders fetch notice:', fsErr);
    }
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
    await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
  } catch (e) {
    console.warn('Backend update status notice:', e);
  }

  // 2. Google Cloud Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      await updateDoc(doc(db, 'orders', id), updateData);
    } catch (e) {}
  }

  // 3. LocalStorage
  try {
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      let localArr = JSON.parse(localStr);
      if (Array.isArray(localArr)) {
        localArr = localArr.map((o: any) => (o.id === id || o.order_number === id) ? { ...o, ...updateData } : o);
        localStorage.setItem('matilda_local_orders', JSON.stringify(localArr));
      }
    }
  } catch (e) {}

  return updateData;
}

export async function deleteOrderRecord(id: string): Promise<boolean> {
  // 1. Express Backend
  try {
    await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
  } catch (e) {
    console.warn('Backend delete order notice:', e);
  }

  // 2. Google Cloud Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (e) {}
  }

  // 3. LocalStorage
  try {
    const localStr = localStorage.getItem('matilda_local_orders');
    if (localStr) {
      let localArr = JSON.parse(localStr);
      if (Array.isArray(localArr)) {
        localArr = localArr.filter((o: any) => o.id !== id && o.order_number !== id);
        localStorage.setItem('matilda_local_orders', JSON.stringify(localArr));
      }
    }
  } catch (e) {}

  return true;
}

// --- Analytics API ---
export async function fetchAnalyticsData(): Promise<any> {
  try {
    const res = await fetch('/api/admin/analytics', {
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Analytics API notice:', e);
  }

  // Fallback calculation from orders
  const orders = await fetchAllOrders();
  const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered');
  const grossRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const aov = paidOrders.length ? Math.round(grossRevenue / paidOrders.length) : 0;

  const recentOrdersMap: Record<string, number> = {};
  paidOrders.forEach((o: any) => {
    const date = new Date(o.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    recentOrdersMap[date] = (recentOrdersMap[date] || 0) + Number(o.total_amount || 0);
  });

  const recentOrders = Object.keys(recentOrdersMap).map(date => ({
    date,
    revenue: recentOrdersMap[date]
  })).slice(-7);

  return {
    grossRevenue,
    totalPaidOrders: paidOrders.length,
    aov,
    recentOrders,
    latestTransactions: orders.slice(0, 15)
  };
}

// --- Deleted Products Registry Helper ---
export function getLocalDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem('matilda_deleted_products');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set();
}

export function recordDeletedProductId(id: string, slug?: string) {
  try {
    const current = getLocalDeletedProductIds();
    if (id) current.add(id);
    if (slug) current.add(slug);
    localStorage.setItem('matilda_deleted_products', JSON.stringify(Array.from(current)));

    // Clean up local products cache
    const prodStr = localStorage.getItem('matilda_products');
    if (prodStr) {
      const prods = JSON.parse(prodStr);
      if (Array.isArray(prods)) {
        const filtered = prods.filter((p: any) => p.id !== id && (!slug || p.slug !== slug));
        localStorage.setItem('matilda_products', JSON.stringify(filtered));
      }
    }
  } catch (e) {}
}

export function unmarkDeletedProductId(id: string, slug?: string) {
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

  // 2. Google Cloud Firestore fallback
  const db = getGoogleFirestore();
  if (db) {
    try {
      const snapshot = await withTimeout(getDocs(collection(db, 'products')), 3000, null as any);
      if (snapshot) {
        const cloudList = snapshot.docs
          .map((doc: any) => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => !deletedSet.has(p.id) && !deletedSet.has(p.slug));
        return cloudList;
      }
    } catch (e) {}
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

  // Google Cloud Firestore sync
  const db = getGoogleFirestore();
  if (db) {
    try {
      await withTimeout(setDoc(doc(db, 'products', prod.id), prod, { merge: true }), 3000, null as any);
    } catch (e) {
      console.warn('Firestore product save notice:', e);
    }
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

  // Google Cloud Firestore delete
  const db = getGoogleFirestore();
  if (db) {
    try {
      await withTimeout(deleteDoc(doc(db, 'products', id)), 3000, null as any);
      if (slug && slug !== id) {
        await withTimeout(deleteDoc(doc(db, 'products', slug)).catch(() => {}), 3000, null as any);
      }
    } catch (e) {
      console.warn('Firestore product delete notice:', e);
    }
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

  // 2. Google Cloud Firestore fallback
  if (cats === null) {
    const db = getGoogleFirestore();
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        if (!snap.empty) {
          cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {}
    }
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

  // 2. Google Cloud Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      await setDoc(doc(db, 'categories', dbCat.id), dbCat, { merge: true });
    } catch (e) {
      console.warn('Firestore category save notice:', e);
    }
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

  // 2. Google Cloud Firestore
  const db = getGoogleFirestore();
  if (db) {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      console.warn('Firestore category delete notice:', e);
    }
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

  const db = getGoogleFirestore();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'categories'));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (e) {}
  }

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

  const db = getGoogleFirestore();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'customers'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {}
  }

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

  const db = getGoogleFirestore();
  if (db) {
    try {
      const custRef = doc(db, 'customers', phone);
      const snap = await getDocs(query(collection(db, 'customers')));
      // Toggle in Firestore
      const found = snap.docs.find(d => d.id === phone || d.data().phone === phone);
      if (found) {
        const isBlacklisted = !found.data().is_blacklisted;
        await updateDoc(found.ref, { is_blacklisted: isBlacklisted });
        return { ...found.data(), is_blacklisted: isBlacklisted };
      }
    } catch (e) {}
  }

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

  const db = getGoogleFirestore();
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'store_settings', 'promos'));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.list)) return data.list;
      }
    } catch (e) {}
  }

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

  const db = getGoogleFirestore();
  if (db) {
    try {
      await setDoc(doc(db, 'store_settings', 'promos'), {
        list: promos,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (e) {}
  }

  try {
    localStorage.setItem('matilda_promos', JSON.stringify(promos));
  } catch (e) {}

  broadcastSync({ type: 'PROMOS_UPDATED', timestamp: Date.now() });
  return true;
}
