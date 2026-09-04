import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  Copy, 
  Check, 
  ExternalLink, 
  X,
  RotateCcw,
  Sparkles
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
  { step: 1, label: 'Order Placed', shortDesc: 'Received & Logged' },
  { step: 2, label: 'Payment Verified', shortDesc: 'Confirmed by Studio' },
  { step: 3, label: 'Studio Packaging', shortDesc: 'Wax Seal & Quality Checked' },
  { step: 4, label: 'Dispatched', shortDesc: 'In Transit with Courier' },
  { step: 5, label: 'Delivered', shortDesc: 'Safely Arrived' }
];

export const OrderStatusSearchBar: React.FC<{
  className?: string;
  compact?: boolean;
}> = ({ className = '', compact = false }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderStatusResult | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/status?order=${encodeURIComponent(cleanQuery)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Order not found. Please double check your order number.');
      }

      setOrderResult(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to query order status. Please check your order code.');
      setOrderResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setError(null);
    setOrderResult(null);
  };

  const handleCopyTracking = (trackNum: string) => {
    navigator.clipboard.writeText(trackNum);
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Search Bar Input Container */}
      <form onSubmit={handleSearch} className="relative w-full max-w-xl mx-auto">
        <div className="relative flex items-center bg-[var(--card-bg)]/95 backdrop-blur-md rounded-2xl border border-[var(--border-main)] shadow-sm hover:border-[var(--border-maroon)]/50 focus-within:border-[var(--border-maroon)] transition-all p-1.5 sm:p-2">
          <div className="pl-3 sm:pl-3.5 pr-2 text-[var(--border-maroon)] pointer-events-none flex items-center">
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            placeholder="track order (e.g. MT-1042)"
            className="flex-1 bg-transparent py-2 sm:py-2.5 px-2 text-xs sm:text-sm font-body text-[var(--text-dominant)] placeholder:text-[var(--text-muted)] focus:outline-none uppercase tracking-wider"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 mr-1 text-[var(--text-muted)] hover:text-[var(--text-dominant)] transition-colors rounded-full"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[var(--border-maroon)] text-white text-xs sm:text-xs font-semibold lowercase tracking-wider hover:bg-[var(--text-dominant)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>querying...</span>
              </>
            ) : (
              <>
                <span>track</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </motion.button>
        </div>

        {/* Subtle helper caption */}
        <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-[var(--text-muted)] tracking-wide">
          <span className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-[var(--border-maroon)]" />
            live Firestore tracking
          </span>
          <span>check your order confirmation SMS or receipt</span>
        </div>
      </form>

      {/* Error state alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="max-w-xl mx-auto mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] opacity-80 mt-0.5">
                Orders typically start with <strong className="font-mono">MT-</strong> followed by 4 digits. If you just checked out, please allow a moment for the database to sync.
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-amber-700 dark:text-amber-300 hover:opacity-75 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Order Stage Result Card */}
      <AnimatePresence>
        {orderResult && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto mt-6 rounded-3xl bg-[var(--card-bg)] border border-[var(--border-main)] shadow-xl p-5 sm:p-7 relative overflow-hidden"
          >
            {/* Top Bar: Order Identifier & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[var(--border-main)]/60">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--border-maroon)] block">
                  processing status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-display font-bold text-lg sm:text-2xl text-[var(--text-dominant)] tracking-tight font-mono">
                    {orderResult.order_number}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border-main)]/30 text-[var(--text-muted)] font-mono">
                    {orderResult.is_cod ? 'Cash on Delivery' : 'Prepaid UPI'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  orderResult.status === 'delivered'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : orderResult.status === 'shipped' || orderResult.status === 'dispatched'
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                    : orderResult.status === 'verified'
                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                    : orderResult.status === 'paid'
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/20'
                    : orderResult.status === 'rejected'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {orderResult.stage_name}
                </span>

                <button
                  onClick={handleReset}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-dominant)] rounded-lg hover:bg-[var(--border-main)]/20 transition-colors"
                  title="Close & track another"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rejection notice if payment verification failed */}
            {orderResult.status === 'rejected' && (
              <div className="my-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-rose-200">
                <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Verification Notice
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  {orderResult.rejection_reason || 'The transaction UTR could not be matched with studio deposits. Please contact support via WhatsApp or email.'}
                </p>
              </div>
            )}

            {/* 5-Stage Visual Progression Stepper */}
            {orderResult.status !== 'rejected' && (
              <div className="py-6 sm:py-7">
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-4 left-4 right-4 h-1 bg-[var(--border-main)]/50 rounded-full z-0" />
                  <div 
                    className="absolute top-4 left-4 h-1 bg-[var(--border-maroon)] rounded-full z-0 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((orderResult.stage - 1) / (STAGES.length - 1)) * 100))}%`
                    }}
                  />

                  {/* Steps */}
                  <div className="relative z-10 flex items-start justify-between">
                    {STAGES.map((s) => {
                      const isComplete = orderResult.stage > s.step;
                      const isCurrent = orderResult.stage === s.step;

                      return (
                        <div key={s.step} className="flex flex-col items-center text-center max-w-[80px] sm:max-w-[100px]">
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                              isComplete
                                ? 'bg-[var(--border-maroon)] text-white'
                                : isCurrent
                                ? 'bg-[var(--border-maroon)] text-white ring-4 ring-[var(--border-maroon)]/20 scale-110'
                                : 'bg-[var(--card-bg)] border-2 border-[var(--border-main)] text-[var(--text-muted)]'
                            }`}
                          >
                            {isComplete ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <span>{s.step}</span>
                            )}
                          </div>

                          <span className={`text-[10px] sm:text-xs font-semibold mt-2 leading-tight ${
                            isCurrent ? 'text-[var(--border-maroon)] font-bold' : 'text-[var(--text-dominant)]'
                          }`}>
                            {s.label}
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)] mt-0.5 hidden sm:block">
                            {s.shortDesc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Stage Description Banner */}
                <div className="mt-6 p-3.5 rounded-2xl bg-[var(--border-main)]/15 border border-[var(--border-main)]/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--border-maroon)]/10 text-[var(--border-maroon)] flex items-center justify-center shrink-0">
                    {orderResult.stage >= 4 ? (
                      <Truck className="w-4 h-4" />
                    ) : orderResult.stage >= 2 ? (
                      <Package className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[var(--text-dominant)]">
                      {orderResult.stage_description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Courier Tracking Dispatch Card (if shipped) */}
            {orderResult.tracking_number && (
              <div className="mb-5 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-sky-800 dark:text-sky-300 block">
                      {orderResult.courier_name || 'Delhivery Express'} Tracking
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-bold text-sky-950 dark:text-sky-100">
                        {orderResult.tracking_number}
                      </span>
                      <button
                        onClick={() => handleCopyTracking(orderResult.tracking_number!)}
                        className="p-1 text-sky-700 hover:text-sky-900 transition-colors"
                        title="Copy AWB number"
                      >
                        {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <a
                  href={getCourierUrl(orderResult.courier_name, orderResult.tracking_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>track on courier</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Order snapshot grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4 border-t border-[var(--border-main)]/60 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Customer</span>
                <span className="font-medium text-[var(--text-dominant)] mt-0.5 block">{orderResult.customer_name}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Date Placed</span>
                <span className="font-medium text-[var(--text-dominant)] mt-0.5 block">{formatDate(orderResult.created_at)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Total Amount</span>
                <span className="font-bold text-[var(--border-maroon)] mt-0.5 block">₹{orderResult.total_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[var(--border-main)]/60 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-dominant)] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>track another order</span>
              </button>

              <Link
                to={`/order-confirmation/${orderResult.order_number}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--border-maroon)] text-white text-xs font-semibold lowercase tracking-wider hover:bg-[var(--text-dominant)] transition-all shadow-xs"
              >
                <span>view full receipt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
