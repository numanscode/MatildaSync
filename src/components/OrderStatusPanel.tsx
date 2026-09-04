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
  ArrowRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/status?order=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Order "${clean}" not found`);
      }

      setOrderResult(data);
    } catch (err: any) {
      setError(err?.message || 'Order not found');
      setOrderResult(null);
    } finally {
      setLoading(false);
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
          onClick={() => setIsOpen(true)}
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
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 cursor-pointer"
            />

            {/* Floating Enlarged Card anchored to top-left */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="fixed top-3 left-3 sm:top-5 sm:left-6 z-50 w-[calc(100vw-24px)] sm:w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--card-bg)] border border-[var(--border-main)] shadow-2xl p-4 sm:p-5 text-[var(--text-dominant)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]/50">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[var(--border-maroon)]" />
                  <span className="font-display text-sm sm:text-base font-bold lowercase tracking-tight">
                    track order
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-dominant)] hover:bg-[var(--border-main)]/20 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Form (No fluff text) */}
              <form onSubmit={handleSearch} className="mt-3 flex items-center gap-2">
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
                    placeholder="order number (e.g. MT-1042)"
                    className="w-full bg-[var(--bg-primary)]/40 border border-[var(--border-main)] rounded-xl py-2 pl-8 pr-3 text-xs font-mono uppercase text-[var(--text-dominant)] placeholder:text-[var(--text-muted)] placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-[var(--border-maroon)] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-medium lowercase tracking-wider hover:bg-[var(--text-dominant)] disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>track</span>
                  )}
                </button>
              </form>

              {/* Error */}
              {error && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-[11px]">{error}</span>
                </div>
              )}

              {/* Result Details */}
              {orderResult && (
                <div className="mt-4 pt-3 border-t border-[var(--border-main)]/50 space-y-3.5">
                  {/* Order ID & Stage Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-[var(--text-dominant)]">
                      {orderResult.order_number}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      orderResult.status === 'delivered'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : orderResult.status === 'shipped' || orderResult.status === 'dispatched'
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : orderResult.status === 'rejected'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : 'bg-[var(--border-maroon)]/15 text-[var(--border-maroon)]'
                    }`}>
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
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                      {orderResult.rejection_reason || 'Payment verification could not be confirmed.'}
                    </div>
                  )}

                  {/* Courier tracking dispatch info */}
                  {orderResult.tracking_number && (
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-sky-700 dark:text-sky-300 font-bold block">
                          {orderResult.courier_name || 'Delhivery'} AWB
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs font-semibold">{orderResult.tracking_number}</span>
                          <button
                            onClick={() => handleCopyTracking(orderResult.tracking_number!)}
                            className="p-0.5 text-sky-700 hover:opacity-80"
                            title="Copy"
                          >
                            {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <a
                        href={getCourierUrl(orderResult.courier_name, orderResult.tracking_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-medium hover:bg-sky-700 transition-colors flex items-center gap-1 shrink-0"
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

                  {/* View receipt link */}
                  <div className="pt-2">
                    <Link
                      to={`/order-confirmation/${orderResult.order_number}`}
                      className="w-full py-1.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] transition-colors flex items-center justify-center gap-1.5"
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
