import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Truck, 
  Check, 
  Copy, 
  ExternalLink, 
  X, 
  AlertCircle, 
  ArrowRight,
  MessageCircle,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLocalOrders, getOrderDetails } from '../lib/supabaseClient';

interface OrderItemSummary {
  title: string;
  quantity: number;
  variant?: string | null;
  price: number;
  image?: string | null;
}

interface OrderStatusResult {
  order_number: string;
  id?: string;
  status: string;
  stage: number;
  stage_name: string;
  stage_description: string;
  rejection_reason?: string | null;
  tracking_info?: string | null;
  tracking_number?: string | null;
  courier_name?: string | null;
  customer_name: string;
  total_amount: number;
  created_at: string;
  shipped_at?: string | null;
  is_cod: boolean;
  address?: string | null;
  items_count: number;
  items: OrderItemSummary[];
}

const STAGES = [
  { step: 1, label: 'placed' },
  { step: 2, label: 'verified' },
  { step: 3, label: 'packaging' },
  { step: 4, label: 'dispatched' },
  { step: 5, label: 'delivered' }
];

export const OrderStatusPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderStatusResult | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Read local browser orders when panel opens
  useEffect(() => {
    if (isOpen) {
      try {
        const locals = getLocalOrders();
        if (Array.isArray(locals) && locals.length > 0) {
          setRecentOrders(locals);
        }
      } catch (e) {}
    }
  }, [isOpen]);

  // Clean and normalize order query
  const normalizeQuery = (input: string): string => {
    const trimmed = input.trim().replace(/^[#\s]+/, '');
    if (/^\d{3,6}$/.test(trimmed)) {
      return `MT-${trimmed}`;
    }
    const match = trimmed.match(/^MT[\s_-]?(\d+)$/i);
    if (match) {
      return `MT-${match[1]}`;
    }
    return trimmed;
  };

  const executeLookup = async (targetCode: string) => {
    const clean = normalizeQuery(targetCode);
    if (!clean) return;

    setLoading(true);
    setError(null);

    // 1. Instant match from LocalStorage (zero latency for current shopper)
    try {
      const locals = getLocalOrders();
      const localMatch = locals.find(
        (o: any) =>
          o.order_number?.toUpperCase() === clean.toUpperCase() ||
          o.id?.toUpperCase() === clean.toUpperCase() ||
          o.phone?.replace(/[^0-9]/g, '').endsWith(clean.replace(/[^0-9]/g, ''))
      );

      if (localMatch) {
        const isCod =
          localMatch.utr_number?.toUpperCase().includes('COD') ||
          (typeof localMatch.items === 'object' && localMatch.items?.payment_method === 'cod') ||
          false;
        const itemsList = Array.isArray(localMatch.items)
          ? localMatch.items
          : Array.isArray(localMatch.items?.list)
          ? localMatch.items.list
          : [];

        let stg = 1;
        let stgName = 'Order Received';
        let stgDesc = 'Order registered in our system. Awaiting studio accountant payment verification.';
        if (localMatch.status === 'delivered') {
          stg = 5;
          stgName = 'Delivered';
          stgDesc = 'Package has been safely delivered to customer.';
        } else if (localMatch.status === 'shipped' || localMatch.tracking_number) {
          stg = 4;
          stgName = 'Dispatched / In Transit';
          stgDesc = 'Package is handed over to the courier and currently in transit to your destination.';
        } else if ((localMatch.status as string) === 'paid' || (localMatch.status as string) === 'verified') {
          stg = 2;
          stgName = 'Payment Verified';
          stgDesc = 'Payment has been successfully verified. Packaging at the studio.';
        }

        setOrderResult({
          order_number: localMatch.order_number || clean,
          id: localMatch.id,
          status: localMatch.status || 'pending',
          stage: stg,
          stage_name: stgName,
          stage_description: stgDesc,
          rejection_reason: localMatch.rejection_reason || null,
          tracking_info: localMatch.tracking_number || null,
          tracking_number: localMatch.tracking_number || null,
          courier_name: localMatch.courier_name || (localMatch.tracking_number ? 'Delhivery Express' : null),
          customer_name: localMatch.customer_name || 'Valued Customer',
          total_amount: localMatch.total_amount || 0,
          created_at: localMatch.created_at || new Date().toISOString(),
          shipped_at: (localMatch as any).shipped_at || null,
          is_cod: isCod,
          address: localMatch.address || null,
          items_count: itemsList.length > 0 ? itemsList.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1,
          items: itemsList.map((it: any) => ({
            title: it.product?.title || it.title || 'Studio Piece',
            quantity: it.quantity || 1,
            variant: it.selectedVariant?.name || it.variant || null,
            price: it.product?.price || it.price || 0,
            image: it.product?.mainImage || it.image || null
          }))
        });
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Local check notice:', e);
    }

    // 2. Query Server API (/api/orders/status)
    try {
      const res = await fetch(`/api/orders/status?order=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        setOrderResult(data);
        setLoading(false);
        return;
      }
    } catch (apiErr) {
      console.warn('Server status lookup warning:', apiErr);
    }

    // 3. Client-side Supabase direct fallback
    try {
      const sbOrder = await getOrderDetails(clean);
      if (sbOrder) {
        const isCod =
          sbOrder.utr_number?.toUpperCase().includes('COD') ||
          (typeof sbOrder.items === 'object' && (sbOrder.items as any)?.payment_method === 'cod') ||
          false;
        const itemsList = Array.isArray(sbOrder.items)
          ? sbOrder.items
          : Array.isArray((sbOrder.items as any)?.list)
          ? (sbOrder.items as any).list
          : [];

        let stg = 1;
        let stgName = 'Order Received';
        let stgDesc = 'Order registered in our system. Awaiting payment verification.';
        if (sbOrder.status === 'delivered') {
          stg = 5;
          stgName = 'Delivered';
          stgDesc = 'Delivered to your address.';
        } else if (sbOrder.status === 'shipped' || sbOrder.tracking_number) {
          stg = 4;
          stgName = 'Dispatched / In Transit';
          stgDesc = 'Handed over to courier and on its way.';
        } else if (sbOrder.status === 'paid') {
          stg = 2;
          stgName = 'Payment Verified';
          stgDesc = 'Payment confirmed by the studio.';
        }

        setOrderResult({
          order_number: sbOrder.order_number || clean,
          id: sbOrder.id,
          status: sbOrder.status || 'pending',
          stage: stg,
          stage_name: stgName,
          stage_description: stgDesc,
          rejection_reason: sbOrder.rejection_reason || null,
          tracking_info: sbOrder.tracking_number || null,
          tracking_number: sbOrder.tracking_number || null,
          courier_name: sbOrder.courier_name || (sbOrder.tracking_number ? 'Delhivery Express' : null),
          customer_name: sbOrder.customer_name || 'Valued Customer',
          total_amount: sbOrder.total_amount || 0,
          created_at: sbOrder.created_at || new Date().toISOString(),
          shipped_at: (sbOrder as any).shipped_at || null,
          is_cod: isCod,
          address: sbOrder.address || null,
          items_count: itemsList.length > 0 ? itemsList.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1,
          items: itemsList.map((it: any) => ({
            title: it.product?.title || it.title || 'Studio Piece',
            quantity: it.quantity || 1,
            variant: it.selectedVariant?.name || it.variant || null,
            price: it.product?.price || it.price || 0,
            image: it.product?.mainImage || it.image || null
          }))
        });
        setLoading(false);
        return;
      }
    } catch (sbErr) {
      console.warn('Supabase fallback lookup error:', sbErr);
    }

    // 4. Truly not found
    setError(`No order found for "${clean}". Please verify your order number or phone number.`);
    setOrderResult(null);
    setLoading(false);
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      executeLookup(query);
    }
  };

  const handleCopyTracking = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const getCourierUrl = (courierName?: string | null, trackNum?: string | null) => {
    if (!trackNum) return '#';
    const c = (courierName || '').toLowerCase();
    if (c.includes('delhivery')) return `https://www.delhivery.com/track/package/${trackNum}`;
    if (c.includes('bluedart')) return `https://www.bluedart.com/tracking?trackNumber=${trackNum}`;
    if (c.includes('post')) return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'courier'} tracking ${trackNum}`)}`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="relative">
      {/* Collapsed really small button on top left */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={() => {
            setIsOpen(true);
            setError(null);
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[var(--card-bg)]/90 backdrop-blur-md border border-[var(--border-main)]/60 hover:border-[var(--border-maroon)] text-[var(--text-dominant)] text-[11px] sm:text-xs font-medium lowercase tracking-wide shadow-2xs transition-all cursor-pointer"
          title="Track order"
        >
          <Truck className="w-3.5 h-3.5 text-[var(--border-maroon)] shrink-0" />
          <span>track order</span>
        </motion.button>
      )}

      {/* Enlarged Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for easy click-away dismissal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-50 cursor-pointer"
            />

            {/* Floating Enlarged Card anchored to top-left */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="fixed top-3 left-3 sm:top-5 sm:left-6 z-50 w-[calc(100vw-24px)] sm:w-[430px] max-h-[88vh] overflow-y-auto rounded-2xl bg-[var(--card-bg)] border border-[var(--border-main)] shadow-2xl p-4 sm:p-5 text-[var(--text-dominant)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--border-maroon)]/10 flex items-center justify-center text-[var(--border-maroon)]">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-display text-sm sm:text-base font-bold lowercase tracking-tight block">
                      track order
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] lowercase block font-sans">
                      live studio updates & courier dispatch
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-dominant)] hover:bg-[var(--border-main)]/20 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearch} className="mt-3.5 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="order number or phone"
                    className="w-full bg-[var(--card-inner)]/80 border border-[var(--border-main)] rounded-xl py-2.5 pl-8.5 pr-8 text-xs font-mono uppercase text-[var(--text-dominant)] placeholder:text-[var(--text-muted)] placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-[var(--border-maroon)] focus:ring-1 focus:ring-[var(--border-maroon)]/25 transition-all shadow-2xs"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setError(null);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-dominant)] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-semibold lowercase tracking-wider hover:bg-[var(--text-dominant)] disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>track</span>
                  )}
                </button>
              </form>

              {/* Recent Orders in This Browser (if any) */}
              {recentOrders.length > 0 && !orderResult && (
                <div className="mt-3 pt-2.5 border-t border-[var(--border-main)]/30">
                  <span className="text-[10px] text-[var(--text-muted)] lowercase font-medium block mb-1.5">
                    your recent orders:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentOrders.slice(0, 3).map((ro) => (
                      <button
                        key={ro.order_number || ro.id}
                        type="button"
                        onClick={() => {
                          setQuery(ro.order_number);
                          executeLookup(ro.order_number);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--border-maroon)]/10 hover:bg-[var(--border-maroon)] hover:text-white text-[var(--border-maroon)] text-[11px] font-mono font-medium transition-colors cursor-pointer"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{ro.order_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Notice with Helpful WhatsApp Support Action */}
              {error && (
                <div className="mt-3.5 p-3 rounded-xl bg-[var(--border-maroon)]/8 border border-[var(--border-maroon)]/20 text-[var(--text-dominant)] text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[var(--border-maroon)] shrink-0 mt-0.5" />
                    <div className="flex-1 text-[11px] leading-relaxed">
                      <p className="font-semibold text-[var(--border-maroon)]">{error}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        If you recently placed your order, it may take 1-2 minutes to register. You can also message our studio directly.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <a
                      href={`https://wa.me/917051227533?text=${encodeURIComponent(`Hi Matilda team, I need help tracking my order (${query.trim() || 'order inquiry'}).`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--border-maroon)] text-white text-[11px] font-semibold hover:bg-[var(--text-dominant)] transition-colors shadow-2xs"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>chat on whatsapp</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Result Details */}
              {orderResult && (
                <div className="mt-4 pt-3 border-t border-[var(--border-main)]/50 space-y-3.5">
                  {/* Order ID & Stage Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider block">
                        {orderResult.is_cod ? 'cash on delivery' : 'prepaid UPI'}
                      </span>
                      <span className="font-mono font-bold text-sm sm:text-base text-[var(--text-dominant)]">
                        {orderResult.order_number}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[var(--border-maroon)]/10 text-[var(--border-maroon)] border border-[var(--border-maroon)]/25">
                      {orderResult.stage_name}
                    </span>
                  </div>

                  {/* 5-Stage Stepper */}
                  {orderResult.status !== 'rejected' && (
                    <div className="py-2">
                      <div className="relative flex items-center justify-between">
                        {/* Connecting line */}
                        <div className="absolute top-2.5 left-2 right-2 h-0.5 bg-[var(--border-main)]/50 z-0" />
                        <div 
                          className="absolute top-2.5 left-2 h-0.5 bg-[var(--border-maroon)] z-0 transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, ((orderResult.stage - 1) / (STAGES.length - 1)) * 100))}%`
                          }}
                        />

                        {STAGES.map((s) => {
                          const isComplete = orderResult.stage > s.step;
                          const isCurrent = orderResult.stage === s.step;

                          return (
                            <div key={s.step} className="relative z-10 flex flex-col items-center">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                                isComplete || isCurrent
                                  ? 'bg-[var(--border-maroon)] text-white'
                                  : 'bg-[var(--card-bg)] border border-[var(--border-main)] text-[var(--text-muted)]'
                              }`}>
                                {isComplete ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
                              </div>
                              <span className={`text-[9px] mt-1 font-medium lowercase ${
                                isCurrent ? 'text-[var(--border-maroon)] font-bold' : 'text-[var(--text-muted)]'
                              }`}>
                                {s.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="mt-2.5 text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {orderResult.stage_description}
                      </p>
                    </div>
                  )}

                  {/* Rejection notice */}
                  {orderResult.status === 'rejected' && (
                    <div className="p-3 rounded-xl bg-[var(--border-maroon)]/10 border border-[var(--border-maroon)]/25 text-[var(--border-maroon)] text-xs font-medium">
                      {orderResult.rejection_reason || 'Payment verification could not be confirmed.'}
                    </div>
                  )}

                  {/* Courier tracking dispatch info */}
                  {orderResult.tracking_number && (
                    <div className="p-2.5 rounded-xl bg-[var(--card-inner)]/80 border border-[var(--border-main)] text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--border-maroon)] font-bold block">
                          {orderResult.courier_name || 'Delhivery'} AWB
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-[var(--text-dominant)]">{orderResult.tracking_number}</span>
                          <button
                            onClick={() => handleCopyTracking(orderResult.tracking_number!)}
                            className="p-0.5 text-[var(--border-maroon)] hover:opacity-80 cursor-pointer"
                            title="Copy"
                          >
                            {copiedTracking ? <Check className="w-3 h-3 text-[var(--border-maroon)]" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <a
                        href={getCourierUrl(orderResult.courier_name, orderResult.tracking_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[var(--border-maroon)] text-white text-[10px] font-medium hover:bg-[var(--text-dominant)] transition-colors flex items-center gap-1 shrink-0"
                      >
                        <span>courier</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  {/* Customer and total */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-main)]/40 text-[10px]">
                    <div>
                      <span className="text-[var(--text-muted)] block uppercase">customer</span>
                      <span className="font-medium text-[var(--text-dominant)] truncate block mt-0.5">
                        {orderResult.customer_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block uppercase">total</span>
                      <span className="font-bold text-[var(--border-maroon)] block mt-0.5">
                        ₹{orderResult.total_amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block uppercase">date</span>
                      <span className="font-medium text-[var(--text-dominant)] block mt-0.5">
                        {formatDate(orderResult.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons: view receipt or track another */}
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderResult(null);
                        setQuery('');
                        setError(null);
                      }}
                      className="w-full py-1.5 rounded-xl border border-[var(--border-main)] hover:border-[var(--border-maroon)] text-[var(--text-dominant)] text-xs font-medium lowercase tracking-wide transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-[var(--border-maroon)]" />
                      <span>track another</span>
                    </button>
                    <Link
                      to={`/order-confirmation/${orderResult.order_number}`}
                      onClick={() => setIsOpen(false)}
                      className="w-full py-1.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>view receipt</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Export as OrderStatusSearchBar for backwards compatibility if referenced
export const OrderStatusSearchBar = OrderStatusPanel;
