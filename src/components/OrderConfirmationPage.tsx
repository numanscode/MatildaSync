import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Truck,
  AlertCircle,
  Copy,
  Check,
  ArrowLeft,
  ShoppingBag,
  ExternalLink,
  MapPin,
  Phone,
  CreditCard,
  Banknote,
  Search,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOrderDetails } from '../lib/supabaseClient';

interface OrderItem {
  product: {
    id: string;
    title: string;
    price: number;
    mainImage?: string;
    image_url?: string;
    category?: string;
  };
  selectedVariant?: {
    id: string;
    name: string;
  };
  quantity: number;
}

interface OrderDetails {
  id?: string;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  pincode?: string;
  items: OrderItem[] | { list?: OrderItem[]; promo?: { code?: string; discount?: number }; payment_method?: string };
  total_amount: number;
  utr_number?: string;
  screenshot_url?: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'rejected';
  rejection_reason?: string;
  courier_name?: string;
  tracking_number?: string;
  created_at?: string;
  shipped_at?: string;
}

export const OrderConfirmationPage: React.FC = () => {
  const params = useParams<{ orderNumber?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Order identifier from route params, query params, or location state
  const rawOrderNum = params.orderNumber || searchParams.get('order') || (location.state as any)?.orderNumber || '';
  
  const [orderIdInput, setOrderIdInput] = useState('');
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Auto-scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [rawOrderNum]);

  // Fetch full order data
  useEffect(() => {
    if (!rawOrderNum) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchOrderDetails = async () => {
      try {
        // 1. Fetch from Supabase Cloud Database & Backend API
        try {
          const orderData = await getOrderDetails(rawOrderNum);
          if (orderData && isMounted) {
            setOrder(orderData);
            setError(null);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Supabase order lookup notice:", e);
        }

        // 2. Check local storage
        try {
          const localStr = localStorage.getItem('matilda_local_orders');
          if (localStr) {
            const localArr = JSON.parse(localStr);
            const foundLocally = Array.isArray(localArr) ? localArr.find((o: any) => o.order_number === rawOrderNum) : null;
            if (foundLocally && isMounted) {
              setOrder(foundLocally);
              setError(null);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("LocalStorage lookup notice:", e);
        }

        // 3. Check location.state
        if (location.state && (location.state as any).orderNumber === rawOrderNum) {
          const st = location.state as any;
          if (isMounted) {
            setOrder({
              order_number: st.orderNumber,
              customer_name: st.customerName || 'Customer',
              phone: st.phone || '',
              address: `${st.address || ''}${st.pincode ? `, Pincode: ${st.pincode}` : ''}`,
              items: st.items || [],
              total_amount: st.total || 0,
              utr_number: st.paymentMethod === 'cod' ? 'COD - Cash on Delivery' : st.utr,
              status: 'pending',
              created_at: new Date().toISOString()
            });
            setError(null);
            setLoading(false);
          }
          return;
        }

        if (!order && isMounted) {
          setError('Order reference could not be found.');
        }
      } catch (err: any) {
        if (isMounted && !order) {
          setError('Order reference could not be found.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderDetails();
    const interval = setInterval(fetchOrderDetails, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rawOrderNum, location.state]);

  const handleCopyOrderNumber = () => {
    if (!order?.order_number) return;
    navigator.clipboard.writeText(order.order_number);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2000);
  };

  const handleCopyTracking = () => {
    if (!order?.tracking_number) return;
    navigator.clipboard.writeText(order.tracking_number);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderIdInput.trim()) {
      navigate(`/order-confirmation/${orderIdInput.trim().toUpperCase()}`);
      setShowSearchBox(false);
    }
  };

  // Helper to extract items array
  const parseItems = (rawItems: any): OrderItem[] => {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'object' && Array.isArray(rawItems.list)) return rawItems.list;
    if (typeof rawItems === 'string') {
      try {
        const parsed = JSON.parse(rawItems);
        return parseItems(parsed);
      } catch {
        return [];
      }
    }
    return [];
  };

  const getPromoInfo = (rawItems: any) => {
    if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems) && rawItems.promo) {
      return rawItems.promo;
    }
    return null;
  };

  const itemsList = order ? parseItems(order.items) : [];
  const promoInfo = order ? getPromoInfo(order.items) : null;
  const isCod = order?.utr_number?.toUpperCase().includes('COD') || (order?.items as any)?.payment_method === 'cod';

  // Format dates
  const formattedDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

  // Calculate items subtotal
  const itemsSubtotal = itemsList.reduce((acc, it) => acc + ((it.product?.price || (it as any).price || 0) * (it.quantity || 1)), 0);
  const promoDiscount = Number(promoInfo?.discount || (order as any)?.discount_amount || 0);
  const totalAmount = Number(order?.total_amount || 0);

  // Derive actual delivery fee charged
  const stateDeliveryFee = (location.state as any)?.deliveryFee;
  const calculatedDeliveryFee = typeof stateDeliveryFee === 'number'
    ? stateDeliveryFee
    : totalAmount > 0 && itemsSubtotal > 0
    ? Math.max(0, totalAmount - (itemsSubtotal - promoDiscount))
    : 0;

  // Status mapping for progress stepper
  const getStatusStepIndex = (status: string) => {
    switch (status) {
      case 'pending': return 1;
      case 'paid': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      case 'rejected': return -1;
      default: return 1;
    }
  };

  const currentStep = order ? getStatusStepIndex(order.status) : 1;

  // Courier direct tracking URL builder
  const getCourierTrackingUrl = (courierName?: string, trackingNum?: string) => {
    if (!trackingNum) return '';
    const courier = (courierName || 'delhivery').toLowerCase();
    if (courier.includes('delhivery')) {
      return `https://www.delhivery.com/track/package/${trackingNum}`;
    }
    if (courier.includes('blue')) {
      return `https://www.bluedart.com/tracking?trackNumber=${trackingNum}`;
    }
    if (courier.includes('post')) {
      return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'courier'} tracking ${trackingNum}`)}`;
  };

  if (loading) {
    return (
      <div className="relative z-10 pt-36 pb-24 px-4 min-h-[70vh] flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--border-maroon)] border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-[var(--text-muted)] lowercase font-mono">loading order...</p>
      </div>
    );
  }

  // If no order number was given or order was not found
  if (!rawOrderNum || (!order && error)) {
    return (
      <div className="relative z-10 pt-32 pb-24 px-4 sm:px-6 max-w-lg mx-auto min-h-[75vh] flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-main)] flex items-center justify-center text-[var(--border-maroon)] mb-5 shadow-xs">
          <Search className="w-6 h-6" />
        </div>
        
        <h1 className="font-display text-2xl sm:text-3xl font-bold lowercase tracking-tight text-[var(--text-dominant)] mb-2">
          track order
        </h1>
        <p className="text-xs text-[var(--text-muted)] mb-6 lowercase max-w-sm">
          enter your order number (e.g. <span className="font-mono font-bold text-[var(--border-maroon)]">MT-4821</span>) to view status.
        </p>

        <form onSubmit={handleLookupSubmit} className="w-full space-y-3 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. MT-4821"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-main)] text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-[var(--border-maroon)] text-[var(--text-dominant)]"
            />
            <button
              type="submit"
              disabled={!orderIdInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-bold uppercase hover:bg-[var(--text-dominant)] disabled:opacity-50 transition-colors"
            >
              track
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 text-left">{error}</p>
          )}
        </form>

        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--border-maroon)] hover:underline lowercase font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>return to store</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 pt-24 sm:pt-28 pb-20 px-3.5 sm:px-6 md:px-8 max-w-4xl mx-auto min-h-screen text-[var(--text-primary)]">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 mb-5 pb-3 border-b border-[var(--border-main)]/30">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-main)] hover:bg-[var(--border-maroon)] hover:text-white hover:border-transparent transition-all text-xs font-medium text-[var(--text-dominant)] shadow-2xs shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>back to store</span>
        </button>

        <button
          onClick={() => setShowSearchBox(!showSearchBox)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-main)] hover:border-[var(--border-maroon)] text-xs font-medium text-[var(--text-dominant)] transition-all shadow-2xs shrink-0"
        >
          <Search className="w-3.5 h-3.5 text-[var(--border-maroon)]" />
          <span className="font-sans">track another</span>
        </button>
      </div>

      {/* Quick Track Drawer/Search Popover */}
      {showSearchBox && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 p-3 sm:p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-main)] shadow-xs"
        >
          <form onSubmit={handleLookupSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Order ID (e.g. MT-8921)"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value.toUpperCase())}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-xs font-mono uppercase focus:outline-none focus:border-[var(--border-maroon)] text-[var(--text-dominant)]"
            />
            <button
              type="submit"
              disabled={!orderIdInput.trim()}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-bold uppercase hover:bg-[var(--text-dominant)] disabled:opacity-50 transition-colors shrink-0"
            >
              go
            </button>
          </form>
        </motion.div>
      )}

      {/* ORDER HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[var(--card-bg)] border border-[var(--border-main)] rounded-2xl sm:rounded-3xl p-4 sm:p-7 mb-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-[var(--border-main)]/20">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--tag-bg)] border border-[var(--border-maroon)] text-[var(--border-maroon)] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[9.5px] sm:text-[10px] uppercase font-sans tracking-wider text-[var(--border-maroon)] font-bold">
                  order confirmed
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-[var(--text-muted)] font-sans">
                  • {formattedDate}
                </span>
              </div>
              <h1 className="font-display text-lg sm:text-2xl font-bold lowercase tracking-tight text-[var(--text-dominant)] mt-0.5">
                thank you, {order?.customer_name?.split(' ')[0] || 'customer'}
              </h1>
            </div>
          </div>

          {/* Order ID Pill */}
          <div className="w-full sm:w-auto bg-[var(--bg-primary)] border border-[var(--border-main)]/70 rounded-xl sm:rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between sm:justify-start gap-3">
            <div>
              <span className="text-[9px] uppercase font-sans tracking-wider text-[var(--text-muted)] block font-medium">
                order id
              </span>
              <span className="font-sans text-sm sm:text-base font-bold text-[var(--border-maroon)]">
                {order?.order_number}
              </span>
            </div>
            <button
              onClick={handleCopyOrderNumber}
              className="p-1.5 rounded-lg border border-[var(--border-main)]/40 hover:bg-[var(--border-maroon)] hover:text-white transition-colors text-[var(--text-dominant)]"
              title="Copy order number"
            >
              {copiedOrder ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* LIVE PROGRESS STEPPER */}
        <div className="pt-4 sm:pt-5">
          {order?.status === 'rejected' ? (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs lowercase flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="space-y-1">
                <strong className="block font-bold">order status: cancelled / rejected</strong>
                <p>{order.rejection_reason || 'Please contact our studio support on WhatsApp for assistance.'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
              
              <div className={`min-h-[48px] sm:min-h-[54px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                currentStep >= 1
                  ? 'bg-[var(--bg-primary)] border-[var(--border-maroon)] shadow-2xs'
                  : 'bg-[var(--bg-primary)]/40 border-[var(--border-main)]/30 opacity-40'
              }`}>
                <span className="text-[10px] sm:text-xs font-semibold lowercase text-[var(--text-dominant)] leading-tight text-center">
                  received
                </span>
              </div>

              <div className={`min-h-[48px] sm:min-h-[54px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                currentStep >= 2
                  ? 'bg-[var(--bg-primary)] border-[var(--border-maroon)] shadow-2xs'
                  : 'bg-[var(--bg-primary)]/40 border-[var(--border-main)]/30 opacity-40'
              }`}>
                <span className="text-[10px] sm:text-xs font-semibold lowercase text-[var(--text-dominant)] leading-tight text-center">
                  {isCod ? 'cod verified' : 'verified'}
                </span>
              </div>

              <div className={`min-h-[48px] sm:min-h-[54px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                currentStep >= 3
                  ? 'bg-[var(--bg-primary)] border-[var(--border-maroon)] shadow-2xs'
                  : 'bg-[var(--bg-primary)]/40 border-[var(--border-main)]/30 opacity-40'
              }`}>
                <span className="text-[10px] sm:text-xs font-semibold lowercase text-[var(--text-dominant)] leading-tight text-center">
                  packed
                </span>
              </div>

              <div className={`min-h-[48px] sm:min-h-[54px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                currentStep >= 4
                  ? 'bg-[var(--bg-primary)] border-[var(--border-maroon)] shadow-2xs'
                  : 'bg-[var(--bg-primary)]/40 border-[var(--border-main)]/30 opacity-40'
              }`}>
                <span className="text-[10px] sm:text-xs font-semibold lowercase text-[var(--text-dominant)] leading-tight text-center">
                  dispatched
                </span>
              </div>

            </div>
          )}

          {/* DISPATCHED & TRACKING BANNER */}
          {(order?.status === 'shipped' || order?.tracking_number) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-3.5 sm:p-4 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-900">
                    shipped via {order?.courier_name || 'delhivery express'}
                  </span>
                  
                  {order?.tracking_number && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-800 font-mono">
                        AWB: <strong>{order.tracking_number}</strong>
                      </span>
                      <button
                        onClick={handleCopyTracking}
                        className="p-0.5 text-blue-700 hover:text-blue-900"
                        title="Copy Tracking Number"
                      >
                        {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {order?.tracking_number && (
                <a
                  href={getCourierTrackingUrl(order?.courier_name, order?.tracking_number)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold lowercase hover:bg-blue-700 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <span>track courier</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

        </div>
      </motion.div>

      {/* TWO-COLUMN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Items Ordered & Pricing (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Items Summary Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-main)] rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]/20">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[var(--border-maroon)]" />
                <h2 className="font-semibold text-xs lowercase text-[var(--text-dominant)]">
                  items ordered ({itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0)})
                </h2>
              </div>
            </div>

            {/* Item Rows */}
            <div className="divide-y divide-[var(--border-main)]/20">
              {itemsList.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] lowercase py-3">
                  order recorded.
                </p>
              ) : (
                itemsList.map((item, idx) => {
                  const imageSrc = item.product?.mainImage || item.product?.image_url;
                  const itemPrice = item.product?.price || (item as any).price || 0;
                  const itemTotal = itemPrice * (item.quantity || 1);

                  return (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={item.product?.title || 'Product'}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-[var(--border-main)]/30 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[var(--tag-bg)] border border-[var(--border-main)]/30 flex items-center justify-center text-[var(--border-maroon)] shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold lowercase tracking-tight text-[var(--text-dominant)] truncate">
                            {item.product?.title || (item as any).title || 'Product'}
                          </h3>
                          {item.selectedVariant?.name && (
                            <span className="text-[10px] text-[var(--border-maroon)] font-medium lowercase block">
                              variant: {item.selectedVariant.name}
                            </span>
                          )}
                          <span className="text-[11px] text-[var(--text-muted)] lowercase block">
                            qty: {item.quantity || 1}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-xs sm:text-sm text-[var(--text-dominant)]">
                          ₹{itemTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ONLY Item Price, Delivery, and Total */}
            <div className="pt-3 border-t border-[var(--border-main)]/20 space-y-2 text-xs lowercase font-sans">
              <div className="flex justify-between text-[var(--text-muted)] font-sans">
                <span className="font-sans">item price</span>
                <span className="font-semibold text-[var(--text-dominant)] font-sans">
                  ₹{itemsSubtotal.toLocaleString('en-IN')}
                </span>
              </div>

              {promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium font-sans">
                  <span className="font-sans">discount {promoInfo?.code ? `(${promoInfo.code})` : ''}</span>
                  <span className="font-sans">-₹{promoDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between text-[var(--text-muted)] font-sans">
                <span className="font-sans">delivery</span>
                {calculatedDeliveryFee > 0 ? (
                  <span className="font-semibold text-[var(--text-dominant)] font-sans">
                    ₹{calculatedDeliveryFee.toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="font-medium text-emerald-600 font-sans">free</span>
                )}
              </div>

              <div className="flex justify-between pt-2.5 border-t border-[var(--border-main)]/40 text-sm font-bold text-[var(--text-dominant)] font-sans">
                <span className="font-sans">{isCod ? 'total payable' : 'total'}</span>
                <span className="font-extrabold text-[var(--border-maroon)] font-sans">
                  ₹{(totalAmount || (itemsSubtotal - promoDiscount + calculatedDeliveryFee)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick WhatsApp Support */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-main)] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="text-xs lowercase text-[var(--text-muted)]">
              need help with this order?
            </div>
            <a
              href={`https://wa.me/919999999999?text=${encodeURIComponent(`Hi Matilda Studio, I have a question about order ${order?.order_number}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--border-maroon)] text-white text-xs font-bold lowercase hover:bg-[var(--text-dominant)] transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>chat on whatsapp</span>
            </a>
          </div>

        </div>

        {/* Right Column: Destination & Payment Details (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Shipping Address Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-main)] rounded-3xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--border-main)]/20">
              <MapPin className="w-4 h-4 text-[var(--border-maroon)]" />
              <h2 className="font-semibold text-xs lowercase text-[var(--text-dominant)]">
                delivery address
              </h2>
            </div>

            <div className="space-y-1 text-xs lowercase text-[var(--text-dominant)]">
              <p className="font-bold text-sm text-[var(--border-maroon)]">
                {order?.customer_name}
              </p>
              <p className="text-[var(--text-muted)] leading-relaxed">
                {order?.address}
              </p>
              {order?.phone && (
                <p className="text-[var(--text-muted)] font-mono pt-1">
                  +91 {order.phone}
                </p>
              )}
            </div>
          </div>

          {/* Payment Details Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-main)] rounded-3xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--border-main)]/20">
              {isCod ? (
                <Banknote className="w-4 h-4 text-[var(--border-maroon)]" />
              ) : (
                <CreditCard className="w-4 h-4 text-[var(--border-maroon)]" />
              )}
              <h2 className="font-semibold text-xs lowercase text-[var(--text-dominant)]">
                payment details
              </h2>
            </div>

            <div className="space-y-2 text-xs lowercase">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">method</span>
                <span className="font-bold text-[var(--text-dominant)] uppercase">
                  {isCod ? 'cash on delivery' : 'upi / online'}
                </span>
              </div>

              {!isCod && order?.utr_number && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">utr ref</span>
                  <span className="font-mono font-bold text-[var(--border-maroon)]">
                    {order.utr_number}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">status</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  order?.status === 'paid' || order?.status === 'shipped' || order?.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : isCod
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {order?.status === 'paid' || order?.status === 'shipped' || order?.status === 'delivered'
                    ? 'verified'
                    : isCod
                    ? 'due on delivery'
                    : 'under verification'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 rounded-2xl bg-[var(--border-maroon)] text-white text-xs font-bold lowercase hover:bg-[var(--text-dominant)] transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>continue shopping</span>
            </button>
            <button
              onClick={() => {
                setShowSearchBox(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="py-3 px-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-main)] text-[var(--text-dominant)] text-xs font-medium lowercase hover:border-[var(--border-maroon)] transition-all shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-[var(--border-maroon)]" />
              <span>track another</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
