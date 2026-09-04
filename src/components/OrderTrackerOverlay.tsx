import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrderDetails } from '../lib/supabaseClient';

export const OrderTrackerOverlay: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [statusData, setStatusData] = useState<{ status: string; tracking_info?: string; rejection_reason?: string; is_cod?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderNumber) return;

    const fetchStatus = async () => {
      setLoading(true);
      try {
        // 1. Check Supabase Database & Backend API
        const order = await getOrderDetails(orderNumber);
        if (order) {
          const isCod = order.utr_number?.toUpperCase().includes('COD');
          setStatusData({
            status: order.status || 'pending',
            tracking_info: order.tracking_number ? `${order.courier_name || 'Delhivery'}: ${order.tracking_number}` : undefined,
            rejection_reason: order.rejection_reason,
            is_cod: isCod
          });
          setLoading(false);
          return;
        }

        // 2. Check local storage
        const localStr = localStorage.getItem('matilda_local_orders');
        if (localStr) {
          const localArr = JSON.parse(localStr);
          const found = Array.isArray(localArr) ? localArr.find((o: any) => o.order_number === orderNumber) : null;
          if (found) {
            const isCod = found.utr_number?.toUpperCase().includes('COD');
            setStatusData({
              status: found.status || 'pending',
              rejection_reason: found.rejection_reason,
              is_cod: isCod
            });
            setLoading(false);
            return;
          }
        }

        // Default fallback if not found
        if (!statusData) {
          setStatusData({
            status: 'pending',
            is_cod: false
          });
        }
      } catch (err) {
        console.error('Failed to fetch status', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  if (!orderNumber) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-[var(--bg-primary)] border border-[var(--border-main)] p-6 shadow-2xl rounded-2xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xs font-micro uppercase tracking-widest text-[var(--text-secondary)] mb-1">Order Tracker</h3>
          <p className="text-lg font-display font-bold">{orderNumber}</p>
        </div>
        <button onClick={() => { searchParams.delete('order'); setSearchParams(searchParams); }} className="text-xs font-micro uppercase tracking-widest border border-[var(--border-main)] px-3 py-1 rounded-full hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors">
          Close
        </button>
      </div>

      <div className="pt-4 border-t border-[var(--border-main)]">
        {loading && !statusData ? (
          <p className="text-sm font-micro lowercase text-[var(--text-secondary)]">checking status...</p>
        ) : statusData ? (
          <div className="text-sm font-micro lowercase space-y-1">
            {statusData.status === 'pending' && (
              statusData.is_cod ? (
                <p className="text-amber-700 font-medium">order received (cash on delivery)! your order is being processed and packed at the studio. please keep exact cash ready upon delivery.</p>
              ) : (
                <p className="text-amber-600">your payment is being verified. you will receive your order confirmation shortly with the order number for tracking.</p>
              )
            )}
            {statusData.status === 'paid' && <p className="text-green-600">order confirmed! your piece is being packed at the studio.</p>}
            {statusData.status === 'rejected' && <p className="text-red-600">we couldn't process this order: {statusData.rejection_reason}. please message us.</p>}
            {statusData.status === 'shipped' && <p className="text-blue-600">your piece has been shipped! tracking: {statusData.tracking_info}</p>}
          </div>
        ) : (
          <p className="text-sm font-micro lowercase text-red-500">order not found.</p>
        )}
      </div>
    </div>
  );
};
