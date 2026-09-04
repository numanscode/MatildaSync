import React, { useEffect, useState, useMemo } from 'react';
import { fetchAllOrders } from '../../../lib/adminApi';
import { useAdminProducts } from '../../../hooks/useAdminProducts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Users, 
  Clock, 
  CheckCircle,
  Truck,
  ArrowUpRight,
  RefreshCw,
  Percent,
  Database,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  Activity
} from 'lucide-react';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';

export const AdminAnalytics: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const { products } = useAdminProducts();
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  const checkDatabaseStatus = async () => {
    setIsCheckingDb(true);
    try {
      const res = await fetch('/api/admin/firebase-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn("Database status check notice:", e);
    } finally {
      setIsCheckingDb(false);
    }
  };

  const handlePushToFirestore = async () => {
    setIsPushing(true);
    setPushStatus(null);
    try {
      const res = await fetch('/api/admin/products/push-firestore', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPushStatus(`✅ ${data.message || 'Synced successfully'}`);
        checkDatabaseStatus();
      } else {
        setPushStatus(`❌ ${data.error || 'Failed to push'}`);
      }
    } catch (err: any) {
      setPushStatus(`❌ Sync error: ${err?.message || 'Network error'}`);
    } finally {
      setIsPushing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const allOrders = await fetchAllOrders();
      setOrders(allOrders);
      checkDatabaseStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    checkDatabaseStatus();
  }, []);

  // Compute analytics
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'shipped');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const rejectedOrders = orders.filter(o => o.status === 'rejected');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    // Payment methods breakdown
    let codCount = 0;
    let upiCount = 0;
    orders.forEach(o => {
      const utr = String(o.utr_number || o.utr || '').toUpperCase();
      const method = String(o.payment_method || '').toLowerCase();
      if (utr.includes('COD') || method === 'cod') {
        codCount++;
      } else {
        upiCount++;
      }
    });

    // Top selling products computation
    const productFrequency: { [title: string]: { qty: number; revenue: number } } = {};
    orders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : (o.items?.list || []);
      items.forEach((item: any) => {
        const title = item.product?.title || item.title || 'Studio Item';
        const price = Number(item.product?.price || item.price || 0);
        const qty = Number(item.quantity || 1);
        if (!productFrequency[title]) {
          productFrequency[title] = { qty: 0, revenue: 0 };
        }
        productFrequency[title].qty += qty;
        productFrequency[title].revenue += price * qty;
      });
    });

    const topSelling = Object.entries(productFrequency)
      .map(([title, data]) => ({ title, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Recent performance activity
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);

    return {
      totalOrders,
      paidCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      rejectedCount: rejectedOrders.length,
      totalRevenue,
      averageOrderValue,
      codCount,
      upiCount,
      topSelling,
      recentOrders
    };
  }, [orders]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">store intelligence.</h2>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            real-time sales performance, conversion metrics, payment splits, and item velocity
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 border border-[var(--border-admin)] rounded-full text-[var(--border-admin)] hover:bg-[var(--border-admin-subtle)]/40 transition-all font-micro uppercase tracking-wider text-[10px]"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Total Revenue"
          value={`₹${metrics.totalRevenue.toLocaleString('en-IN')}`}
          subValue="Completed / dispatched transactions"
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          trend={{ value: 'Realized', isPositive: true }}
        />
        <AdminStatCard
          label="Avg Order Value"
          value={`₹${metrics.averageOrderValue.toLocaleString('en-IN')}`}
          subValue="Mean revenue per basket"
          icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        />
        <AdminStatCard
          label="Orders Processed"
          value={metrics.totalOrders}
          subValue={`${metrics.paidCount} fulfilled · ${metrics.pendingCount} pending`}
          icon={<ShoppingBag className="w-4 h-4 text-amber-600" />}
        />
        <AdminStatCard
          label="Catalogue Volume"
          value={products.length}
          subValue="Live products listed"
          icon={<Package className="w-4 h-4 text-purple-600" />}
        />
      </div>

      {/* Analytics Mid-Row: Payment Breakdown + Order Pipeline Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Payment Channels */}
        <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">Payment Method Distribution</h3>
            <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mb-6">
              UPI Prepaid vs Cash on Delivery Ratio
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-gray-700">UPI / Prepaid</span>
                  <span className="text-gray-900">
                    {metrics.upiCount} orders ({metrics.totalOrders > 0 ? Math.round((metrics.upiCount / metrics.totalOrders) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.totalOrders > 0 ? (metrics.upiCount / metrics.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-gray-700">Cash on Delivery (COD)</span>
                  <span className="text-gray-900">
                    {metrics.codCount} orders ({metrics.totalOrders > 0 ? Math.round((metrics.codCount / metrics.totalOrders) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.totalOrders > 0 ? (metrics.codCount / metrics.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-micro uppercase tracking-wider">
            <span>Verified prepaid rate</span>
            <span className="font-bold text-emerald-600">
              {metrics.totalOrders > 0 ? Math.round((metrics.upiCount / metrics.totalOrders) * 100) : 0}% prepaid
            </span>
          </div>
        </div>

        {/* Pipeline Health */}
        <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">Fulfillment Pipeline</h3>
            <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mb-6">
              Stage lifecycle of all logged customer orders
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
                <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                <span className="font-display text-xl font-bold text-amber-900 block">{metrics.pendingCount}</span>
                <span className="font-micro uppercase tracking-widest text-[9px] text-amber-700">Pending</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                <span className="font-display text-xl font-bold text-emerald-900 block">{metrics.paidCount}</span>
                <span className="font-micro uppercase tracking-widest text-[9px] text-emerald-700">Fulfilled</span>
              </div>
              <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 text-center">
                <span className="font-display text-xl font-bold text-red-900 block pt-5">{metrics.rejectedCount}</span>
                <span className="font-micro uppercase tracking-widest text-[9px] text-red-700">Rejected</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-micro uppercase tracking-wider">
            <span>Fulfillment efficiency</span>
            <span className="font-bold text-gray-900">
              {metrics.totalOrders > 0 ? Math.round((metrics.paidCount / metrics.totalOrders) * 100) : 0}% success rate
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Top Selling Items + Recent Orders Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Selling Products */}
        <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-6 shadow-xs">
          <h3 className="font-display text-lg font-bold text-gray-900 mb-1">Top Selling Jewellery</h3>
          <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mb-4">
            Most frequently purchased items across all orders
          </p>

          <div className="space-y-3">
            {metrics.topSelling.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100 hover:bg-gray-100/70 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold text-gray-400 w-4">{idx + 1}.</span>
                  <div>
                    <p className="font-bold text-xs text-gray-900 line-clamp-1">{item.title}</p>
                    <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500">{item.qty} units sold</p>
                  </div>
                </div>
                <span className="font-bold font-display text-xs text-[var(--border-admin)]">
                  ₹{item.revenue.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            {metrics.topSelling.length === 0 && (
              <p className="p-8 text-center text-gray-400 font-micro uppercase tracking-widest text-xs">
                No sales logged yet.
              </p>
            )}
          </div>
        </div>

        {/* Recent Stream */}
        <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-6 shadow-xs">
          <h3 className="font-display text-lg font-bold text-gray-900 mb-1">Recent Activity</h3>
          <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mb-4">
            Latest incoming customer transactions
          </p>

          <div className="space-y-3">
            {metrics.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-900">{order.order_number}</span>
                    <AdminBadge variant={order.status as any}>{order.status}</AdminBadge>
                  </div>
                  <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mt-0.5">
                    {order.customer_name} &middot; {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span className="font-bold font-display text-xs text-gray-900">
                  ₹{Number(order.total_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            {metrics.recentOrders.length === 0 && (
              <p className="p-8 text-center text-gray-400 font-micro uppercase tracking-widest text-xs">
                No orders logged yet.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Cloud Database (Firebase / Firestore) Diagnostics Panel */}
      <div className="bg-white/90 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
              dbStatus?.status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-gray-900">Firestore Cloud Database Status</h3>
                {dbStatus?.status === 'connected' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-emerald-100 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Live & Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-amber-100 text-amber-700 font-semibold">
                    <AlertCircle className="w-3 h-3" /> Unconfigured / Local Mode
                  </span>
                )}
              </div>
              <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mt-0.5">
                Runtime: {dbStatus?.runtime || 'detecting...'} · Project: {dbStatus?.project_id || '(not configured)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkDatabaseStatus}
              disabled={isCheckingDb}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-mono hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${isCheckingDb ? 'animate-spin' : ''}`} />
              <span>{isCheckingDb ? 'Checking...' : 'Run Diagnostics'}</span>
            </button>
            <button
              onClick={handlePushToFirestore}
              disabled={isPushing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--border-admin)] text-white rounded-xl text-xs font-mono hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{isPushing ? 'Syncing...' : 'Push Catalog to Firestore'}</span>
            </button>
          </div>
        </div>

        {pushStatus && (
          <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs font-mono">
            {pushStatus}
          </div>
        )}

        {/* Diagnostic Key Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 text-[10px] block uppercase">FIREBASE_PROJECT_ID</span>
            <span className={dbStatus?.env_vars_detected?.FIREBASE_PROJECT_ID || dbStatus?.env_vars_detected?.VITE_FIREBASE_PROJECT_ID ? 'text-emerald-600 font-bold' : 'text-red-500'}>
              {dbStatus?.env_vars_detected?.FIREBASE_PROJECT_ID || dbStatus?.env_vars_detected?.VITE_FIREBASE_PROJECT_ID ? '✓ Detected' : '✗ Missing'}
            </span>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 text-[10px] block uppercase">FIREBASE_API_KEY</span>
            <span className={dbStatus?.env_vars_detected?.FIREBASE_API_KEY || dbStatus?.env_vars_detected?.VITE_FIREBASE_API_KEY ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
              {dbStatus?.env_vars_detected?.FIREBASE_API_KEY || dbStatus?.env_vars_detected?.VITE_FIREBASE_API_KEY ? '✓ Detected' : '○ Optional'}
            </span>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 text-[10px] block uppercase">Products in Cloud DB</span>
            <span className="text-gray-900 font-bold">
              {dbStatus?.diagnostics?.firestore_remote_products !== undefined ? dbStatus.diagnostics.firestore_remote_products : 'N/A'}
            </span>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-400 text-[10px] block uppercase">Vercel Environment</span>
            <span className="text-gray-900 font-bold">
              {dbStatus?.runtime === 'vercel' ? 'Vercel Serverless' : 'Cloud Run / Dev'}
            </span>
          </div>
        </div>

        {dbStatus?.status !== 'connected' && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              How to configure Firestore on Vercel:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-amber-800 pl-1">
              <li>Open your Vercel Project Dashboard → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
              <li>Add <code>FIREBASE_PROJECT_ID</code> (e.g., <code>your-firebase-project-id</code>).</li>
              <li>Add <code>FIREBASE_API_KEY</code> and <code>FIREBASE_AUTH_DOMAIN</code> (optional, recommended).</li>
              <li>Redeploy or promote your deployment on Vercel.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
