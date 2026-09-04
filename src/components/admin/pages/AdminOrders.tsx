import React, { useEffect, useState, useMemo } from 'react';
import { 
  fetchAllOrders, 
  updateOrderStatus, 
  deleteOrderRecord 
} from '../../../lib/adminApi';
import { syncUnsyncedOrders } from '../../../lib/supabaseClient';
import { 
  Eye, 
  Truck, 
  MessageCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Send, 
  Edit3, 
  Trash2, 
  XCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  DollarSign,
  Phone,
  RotateCw
} from 'lucide-react';
import { AdminModal } from '../shared/AdminModal';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { AdminSearch } from '../shared/AdminSearch';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'upi'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Shipping Modal State
  const [shippingModalOrder, setShippingModalOrder] = useState<any>(null);
  const [courierName, setCourierName] = useState('Delhivery Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [updatingShipment, setUpdatingShipment] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rejection Modal State
  const [rejectionModalOrder, setRejectionModalOrder] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('Invalid UPI UTR / Payment Not Received');
  const [sendRejectionWhatsApp, setSendRejectionWhatsApp] = useState(false);
  const [updatingRejection, setUpdatingRejection] = useState(false);

  // Deletion Modal State
  const [deleteModalOrder, setDeleteModalOrder] = useState<any>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const loadedOrders = await fetchAllOrders();
      setOrders(loadedOrders);
    } catch (e) {
      console.error("Error fetching orders:", e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncUnsyncedOrders();
      await fetchOrders(false);
    } catch (e) {
      console.warn("Manual sync notice:", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);

    // Live polling every 10 seconds so all customer checkouts immediately show on desk
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 10000);

    const onFocus = () => {
      fetchOrders(false);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleUpdateStatus = async (id: string, status: string, additionalData: any = {}) => {
    try {
      const updateData = await updateOrderStatus(id, status, additionalData);

      // Sync state locally
      setOrders(prev => prev.map(o => (o.id === id || o.order_number === id) ? { ...o, ...updateData } : o));
      if (selectedOrder && (selectedOrder.id === id || selectedOrder.order_number === id)) {
        setSelectedOrder({ ...selectedOrder, ...updateData });
      }

      return updateData;
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteModalOrder) return;
    setDeletingOrder(true);
    try {
      const idToDelete = deleteModalOrder.id || deleteModalOrder.order_number;
      await deleteOrderRecord(idToDelete);

      setOrders(prev => prev.filter(o => o.id !== idToDelete && o.order_number !== idToDelete));
      if (selectedOrder && (selectedOrder.id === idToDelete || selectedOrder.order_number === idToDelete)) {
        setSelectedOrder(null);
      }

      setDeleteModalOrder(null);
    } catch (e) {
      console.error(e);
      alert('Error deleting order record.');
    } finally {
      setDeletingOrder(false);
    }
  };

  const getCleanPhone = (phoneStr: string) => {
    const raw = (phoneStr || '').replace(/[^0-9]/g, '');
    return raw.length === 10 ? `91${raw}` : raw.replace(/^91/, '91');
  };

  const isCodOrder = (order: any): boolean => {
    if (!order) return false;
    const utr = String(order.utr_number || order.utr || '').toUpperCase();
    const method = String(
      order.payment_method || 
      (order.items && !Array.isArray(order.items) && order.items.payment_method) || 
      ''
    ).toLowerCase();
    return utr.includes('COD') || method === 'cod';
  };

  const getItemsSummaryText = (order: any) => {
    let itemsText = '';
    const itemsList = Array.isArray(order.items) ? order.items : (order.items?.list || []);
    itemsList.forEach((item: any) => {
      const title = item.product?.title || item.title || 'Studio Item';
      const variant = item.selectedVariant?.name ? ` (${item.selectedVariant.name})` : '';
      itemsText += `• ${item.quantity || 1}x ${title}${variant}\n`;
    });
    return itemsText || '• 1x Matilda Studio Jewellery Piece\n';
  };

  // WhatsApp Preset: Order Confirmation (UPI Prepaid vs COD)
  const sendConfirmation = (order: any) => {
    const isCod = isCodOrder(order);
    const itemsText = getItemsSummaryText(order);
    const trackingLink = `${window.location.origin}/order-confirmation/${order.order_number}`;

    let text = '';
    if (isCod) {
      text = `Hi ${order.customer_name || 'there'}, ✨\n\nThank you for shopping with Matilda Studio! ❤️\n\nYour Cash on Delivery (COD) order has been confirmed, and is now being packed with love and care at our studio.\n\n*Order Details:*\n• *Order Number:* ${order.order_number}\n• *Payment Method:* Cash on Delivery (COD 💵)\n• *Amount Payable on Delivery:* ₹${order.total_amount} (Please keep exact cash ready)\n\n*Items in Order:*\n${itemsText}\n*Live Status Tracker:*\n${trackingLink}\n\nWe will notify you with dispatch and tracking details as soon as it's handed over to our courier partner. 🕊️\n\nWarm regards,\nMatilda Studio`;
    } else {
      text = `Hi ${order.customer_name || 'there'}, ✨\n\nThank you for shopping with Matilda Studio! ❤️\n\nYour UPI payment of ₹${order.total_amount} has been successfully verified, and your prepaid order is now being packed with love and care at our studio.\n\n*Order Details:*\n• *Order Number:* ${order.order_number}\n• *Payment Method:* UPI / Online Prepaid (Verified ✅)\n• *Total Paid:* ₹${order.total_amount}\n\n*Items in Order:*\n${itemsText}\n*Live Status Tracker:*\n${trackingLink}\n\nWe will notify you with the tracking details as soon as it's handed over to our courier partner. 🕊️\n\nWarm regards,\nMatilda Studio`;
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${getCleanPhone(order.phone)}?text=${encoded}`, '_blank');
  };

  // WhatsApp Preset: Shipped / Dispatched with Tracking Details (UPI Prepaid vs COD)
  const sendShippedNotification = (order: any, courier = order.courier_name || 'Delhivery Express', tracking = order.tracking_number) => {
    const isCod = isCodOrder(order);
    const itemsText = getItemsSummaryText(order);
    const liveTrackingUrl = `${window.location.origin}/order-confirmation/${order.order_number}`;
    
    // Direct courier tracking link
    const courierTrackUrl = tracking
      ? (courier?.toLowerCase().includes('delhivery')
          ? `https://www.delhivery.com/track/package/${tracking}`
          : courier?.toLowerCase().includes('blue')
          ? `https://www.bluedart.com/tracking?trackNumber=${tracking}`
          : courier?.toLowerCase().includes('post')
          ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`
          : `https://www.google.com/search?q=${encodeURIComponent(`${courier} tracking ${tracking}`)}`)
      : '';

    let text = '';
    if (isCod) {
      text = `Hi ${order.customer_name || 'there'}! ✨\n\nGreat news! Your Cash on Delivery (COD) Matilda Studio order *${order.order_number}* has been shipped and is on its way to you! 📦🕊️\n\n*Dispatch Details:*\n• *Courier Partner:* ${courier || 'Delhivery Express'}\n• *Tracking AWB:* ${tracking || 'In Transit'}\n${courierTrackUrl ? `• *Direct Tracking Link:* ${courierTrackUrl}\n` : ''}• *Payment Status:* Cash on Delivery (COD)\n• *Cash to Collect:* ₹${order.total_amount} (Please pay exact cash to the delivery agent 💵)\n\n*Items in Package:*\n${itemsText}\n*Live Studio Tracker:*\n${liveTrackingUrl}\n\nEstimated delivery is 3-5 business days. Please keep ₹${order.total_amount} ready for delivery. Feel free to message us here if you have any questions!\n\nWith love,\nMatilda Studio ❤️`;
    } else {
      text = `Hi ${order.customer_name || 'there'}! ✨\n\nGreat news! Your prepaid Matilda Studio order *${order.order_number}* has been shipped and is on its way to you! 📦🕊️\n\n*Dispatch Details:*\n• *Courier Partner:* ${courier || 'Delhivery Express'}\n• *Tracking AWB:* ${tracking || 'In Transit'}\n${courierTrackUrl ? `• *Direct Tracking Link:* ${courierTrackUrl}\n` : ''}• *Payment Status:* Paid via UPI Prepaid (No payment required on delivery ✅)\n\n*Items in Package:*\n${itemsText}\n*Live Studio Tracker:*\n${liveTrackingUrl}\n\nEstimated delivery is 3-5 business days. Please feel free to message us here if you have any questions!\n\nWith love,\nMatilda Studio ❤️`;
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${getCleanPhone(order.phone)}?text=${encoded}`, '_blank');
  };

  // WhatsApp Preset: Rejection Notification (UPI Prepaid vs COD)
  const sendRejectionNotification = (order: any, reason: string) => {
    const isCod = isCodOrder(order);
    let text = '';
    if (isCod) {
      text = `Hi ${order.customer_name || 'there'},\n\nRegarding your Cash on Delivery (COD) Matilda Studio order *${order.order_number}*:\n\nWe could not process this COD order due to the following reason:\n• *Reason:* ${reason}\n\nIf you would like to switch to UPI prepaid payment or update your delivery details, please reply to this chat and our team will gladly assist you.\n\nWarm regards,\nMatilda Studio`;
    } else {
      text = `Hi ${order.customer_name || 'there'},\n\nRegarding your prepaid Matilda Studio order *${order.order_number}*:\n\nWe could not process this order due to the following reason:\n• *Reason:* ${reason}\n\nIf you have already made the UPI payment or feel this is an error, please reply to this chat with your payment screenshot or transaction reference (${order.utr_number || 'N/A'}) and our team will gladly assist you.\n\nWarm regards,\nMatilda Studio`;
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${getCleanPhone(order.phone)}?text=${encoded}`, '_blank');
  };

  const openShippingModal = (order: any) => {
    setShippingModalOrder(order);
    setCourierName(order.courier_name || 'Delhivery Express');
    setTrackingNumber(order.tracking_number || '');
  };

  const handleConfirmShipment = async (sendWhatsApp: boolean) => {
    if (!shippingModalOrder) return;
    setUpdatingShipment(true);
    try {
      const updatedCourier = courierName.trim() || 'Delhivery Express';
      const updatedTracking = trackingNumber.trim();
      const orderId = shippingModalOrder.id || shippingModalOrder.order_number;
      
      await handleUpdateStatus(orderId, 'shipped', {
        courier_name: updatedCourier,
        tracking_number: updatedTracking
      });

      if (sendWhatsApp) {
        sendShippedNotification(shippingModalOrder, updatedCourier, updatedTracking);
      }

      setShippingModalOrder(null);
    } finally {
      setUpdatingShipment(false);
    }
  };

  const openRejectionModal = (order: any) => {
    setRejectionModalOrder(order);
    const isCod = isCodOrder(order);
    setRejectionReason(
      order.rejection_reason || (isCod ? 'Unverified Contact Number / Address' : 'Invalid UPI UTR / Payment Not Received')
    );
    setSendRejectionWhatsApp(false);
  };

  const handleConfirmRejection = async () => {
    if (!rejectionModalOrder) return;
    setUpdatingRejection(true);
    try {
      const finalReason = rejectionReason.trim() || 'Order rejected by store';
      const orderId = rejectionModalOrder.id || rejectionModalOrder.order_number;
      await handleUpdateStatus(orderId, 'rejected', {
        rejection_reason: finalReason
      });

      if (sendRejectionWhatsApp) {
        sendRejectionNotification(rejectionModalOrder, finalReason);
      }

      setRejectionModalOrder(null);
    } finally {
      setUpdatingRejection(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered orders calculation with case-insensitivity and full field search
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const normStatus = (o.status || 'pending').toLowerCase().trim();
      const matchesStatus = filter === 'All' || normStatus === filter.toLowerCase();
      
      const isCod = isCodOrder(o);
      const matchesPayment = 
        paymentFilter === 'all' ? true :
        paymentFilter === 'cod' ? isCod : !isCod;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesStatus && matchesPayment;

      const oNum = (o.order_number || '').toLowerCase();
      const oId = (o.id || '').toLowerCase();
      const custName = (o.customer_name || '').toLowerCase();
      const phone = String(o.phone || '').replace(/[^0-9]/g, '');
      const cleanQDigits = q.replace(/[^0-9]/g, '');
      const utr = String(o.utr_number || o.utr || '').toLowerCase();
      const track = (o.tracking_number || '').toLowerCase();
      const addr = (o.address || '').toLowerCase();

      const matchesSearch = 
        oNum.includes(q) ||
        oId.includes(q) ||
        custName.includes(q) ||
        utr.includes(q) ||
        track.includes(q) ||
        addr.includes(q) ||
        (cleanQDigits.length >= 4 && phone.includes(cleanQDigits)) ||
        (o.phone && String(o.phone).includes(q));

      return matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, filter, paymentFilter, searchQuery]);

  // Key metrics for top banner
  const orderStats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => (o.status || 'pending').toLowerCase().trim() === 'pending').length;
    const paid = orders.filter(o => (o.status || '').toLowerCase().trim() === 'paid').length;
    const shipped = orders.filter(o => (o.status || '').toLowerCase().trim() === 'shipped').length;
    const delivered = orders.filter(o => (o.status || '').toLowerCase().trim() === 'delivered').length;
    const rejected = orders.filter(o => (o.status || '').toLowerCase().trim() === 'rejected').length;
    const revenue = orders
      .filter(o => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'paid' || s === 'shipped' || s === 'delivered';
      })
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    return { total, pending, paid, shipped, delivered, rejected, revenue };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">order desk.</h2>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono tracking-wider font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </div>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            real-time order tracking, verification, dispatch logistics, and customer whatsapp notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-50 transition-all font-micro uppercase tracking-wider text-[10px]"
            title="Reconcile and sync local backup orders to cloud"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[var(--border-admin)]' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Cloud & Backups'}</span>
          </button>

          <button
            onClick={() => fetchOrders(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-[var(--border-admin)] rounded-full text-[var(--border-admin)] hover:bg-[var(--border-admin-subtle)]/40 transition-all font-micro uppercase tracking-wider text-[10px] font-bold"
            title="Refresh Orders"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Orders Quick KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <AdminStatCard 
          label="Total Orders" 
          value={orderStats.total} 
          subValue="All recorded orders" 
        />
        <AdminStatCard 
          label="Pending Review" 
          value={orderStats.pending} 
          subValue="Action required" 
          className={orderStats.pending > 0 ? "border-amber-300 bg-amber-50/40" : ""}
        />
        <AdminStatCard 
          label="Ready To Ship" 
          value={orderStats.paid} 
          subValue="Payment confirmed" 
          className={orderStats.paid > 0 ? "border-emerald-300 bg-emerald-50/40" : ""}
        />
        <AdminStatCard 
          label="In Transit" 
          value={orderStats.shipped} 
          subValue="With courier partner" 
        />
        <AdminStatCard 
          label="Confirmed Revenue" 
          value={`₹${orderStats.revenue.toLocaleString('en-IN')}`} 
          subValue="Verified order volume" 
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="flex-1 max-w-md">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search order #, customer, phone, UTR, AWB..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex flex-wrap bg-gray-100/80 p-1 rounded-full border border-gray-200">
            {['All', 'Pending', 'Paid', 'Shipped', 'Delivered', 'Rejected'].map(f => {
              const count = orders.filter(o => {
                const s = (o.status || 'pending').toLowerCase().trim();
                return f === 'All' || s === f.toLowerCase();
              }).length;
              return (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-micro uppercase tracking-wider transition-all ${
                    filter === f 
                      ? 'bg-[var(--border-admin)] text-white font-bold shadow-xs' 
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>

          {/* Payment Type Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-micro uppercase tracking-wider text-gray-700 outline-none focus:border-[var(--border-admin)]"
          >
            <option value="all">All Payments</option>
            <option value="upi">UPI / Online Only</option>
            <option value="cod">Cash on Delivery (COD)</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="font-micro uppercase tracking-widest text-xs py-16 text-center text-gray-400 animate-pulse">
          loading live orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white/50 border border-dashed border-gray-300 rounded-3xl p-12 text-center text-gray-400 font-micro uppercase tracking-widest text-xs">
          no orders found matching your search and filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map(order => {
            const isCod = isCodOrder(order);
            const itemsCount = Array.isArray(order.items) ? order.items.length : (order.items?.list?.length || 1);

            return (
              <div key={order.id} className="bg-white/85 backdrop-blur-md border border-[var(--border-admin)] rounded-3xl p-5 sm:p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all relative">
                
                {/* Header: Order Number & Action Icons */}
                <div className="flex justify-between items-start border-b border-[var(--border-admin-subtle)] pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-[var(--text-dominant)]">{order.order_number}</h3>
                      <button
                        onClick={() => copyToClipboard(order.order_number, order.id)}
                        className="text-gray-400 hover:text-[var(--border-admin)] transition-colors p-1"
                        title="Copy Order ID"
                      >
                        {copiedId === order.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="font-micro uppercase tracking-widest text-[9px] text-gray-500 mt-0.5">
                      {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-1.5 rounded-full hover:bg-[var(--border-admin-subtle)] text-gray-500 hover:text-[var(--border-admin)] transition-all"
                      title="View Full Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteModalOrder(order)}
                      className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                      title="Delete Order Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Order Info */}
                <div className="text-xs space-y-2 font-body text-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-micro uppercase tracking-wider text-[10px]">status</span>
                    <AdminBadge variant={order.status as any}>
                      {order.status}
                    </AdminBadge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-micro uppercase tracking-wider text-[10px]">payment</span>
                    {isCod ? (
                      <span className="font-micro uppercase tracking-widest text-[9px] px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold">
                        COD (Cash)
                      </span>
                    ) : (
                      <span className="font-micro uppercase tracking-widest text-[9px] px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-medium">
                        UPI / Online
                      </span>
                    )}
                  </div>

                  <div className="pt-1">
                    <p className="font-semibold text-sm text-[var(--text-dominant)]">{order.customer_name}</p>
                    <p className="text-gray-500 font-mono text-[11px]">+91 {order.phone}</p>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span className="text-gray-500 text-[11px]">{itemsCount} item{itemsCount > 1 ? 's' : ''}</span>
                    <span className="font-bold text-sm text-[var(--border-admin)]">₹{Number(order.total_amount || 0).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Rejection Note if rejected */}
                  {order.status === 'rejected' && order.rejection_reason && (
                    <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 text-red-700 text-[11px] leading-tight">
                      <span className="font-bold block uppercase font-micro text-[9px] text-red-800">rejection reason:</span>
                      {order.rejection_reason}
                    </div>
                  )}

                  {/* Shipped Tracking Badge if available */}
                  {order.status === 'shipped' && order.tracking_number && (
                    <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-mono text-blue-800 truncate">{order.courier_name || 'Delhivery'}: {order.tracking_number}</span>
                      </div>
                      <button
                        onClick={() => openShippingModal(order)}
                        className="text-blue-600 hover:text-blue-800 p-0.5"
                        title="Edit Tracking"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-auto pt-3 border-t border-[var(--border-admin-subtle)] space-y-2">
                  {(() => {
                    const normStatus = (order.status || 'pending').toLowerCase().trim();
                    return (
                      <>
                        {/* Status: Pending */}
                        {normStatus === 'pending' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => handleUpdateStatus(order.id || order.order_number, 'paid')} 
                              className="border border-green-600 bg-green-50 text-green-700 font-micro uppercase tracking-widest text-[9px] py-2 rounded-full hover:bg-green-600 hover:text-white transition-colors font-bold"
                            >
                              accept (paid)
                            </button>
                            <button 
                              onClick={() => openRejectionModal(order)} 
                              className="border border-red-500 text-red-600 bg-red-50 font-micro uppercase tracking-widest text-[9px] py-2 rounded-full hover:bg-red-600 hover:text-white transition-colors font-bold"
                            >
                              reject
                            </button>
                          </div>
                        )}

                        {/* Status: Paid */}
                        {normStatus === 'paid' && (
                          <div className="space-y-1.5">
                            <button 
                              onClick={() => sendConfirmation(order)} 
                              className="w-full flex items-center justify-center gap-1.5 border border-emerald-600 text-emerald-700 bg-emerald-50 font-micro uppercase tracking-widest text-[9px] py-2 rounded-full hover:bg-emerald-600 hover:text-white transition-all font-bold"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>{isCodOrder(order) ? 'whatsapp cod confirmed' : 'whatsapp upi confirmed'}</span>
                            </button>
                            <button 
                              onClick={() => openShippingModal(order)} 
                              className="w-full flex items-center justify-center gap-1.5 border border-blue-600 text-white bg-blue-600 font-micro uppercase tracking-widest text-[9px] py-2 rounded-full hover:bg-blue-700 transition-all font-bold shadow-xs"
                            >
                              <Truck className="w-3 h-3" />
                              <span>mark as shipped</span>
                            </button>
                          </div>
                        )}

                        {/* Status: Shipped */}
                        {normStatus === 'shipped' && (
                          <div className="space-y-1.5">
                            <button 
                              onClick={() => sendShippedNotification(order)} 
                              className="w-full flex items-center justify-center gap-1.5 border border-blue-600 text-blue-700 bg-blue-50 font-micro uppercase tracking-widest text-[9px] py-2 rounded-full hover:bg-blue-600 hover:text-white transition-all font-bold"
                              title="Send Shipped Notification WhatsApp Message"
                            >
                              <Send className="w-3 h-3" />
                              <span>whatsapp shipped notice</span>
                            </button>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button 
                                onClick={() => openShippingModal(order)} 
                                className="flex items-center justify-center gap-1 border border-gray-300 text-gray-700 bg-white font-micro uppercase tracking-widest text-[9px] py-1.5 rounded-full hover:border-[var(--border-admin)] transition-all"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>tracking</span>
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(order.id || order.order_number, 'delivered')} 
                                className="flex items-center justify-center gap-1 border border-emerald-600 bg-emerald-50 text-emerald-700 font-micro uppercase tracking-widest text-[9px] py-1.5 rounded-full hover:bg-emerald-600 hover:text-white transition-all font-bold"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>delivered</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Status: Delivered */}
                        {normStatus === 'delivered' && (
                          <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-micro uppercase tracking-widest text-[9px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>order delivered successfully</span>
                          </div>
                        )}

                        {/* Status: Rejected */}
                        {normStatus === 'rejected' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => openRejectionModal(order)}
                              className="border border-red-300 text-red-700 bg-red-50/50 font-micro uppercase tracking-widest text-[9px] py-1.5 rounded-full hover:bg-red-100 transition-colors"
                            >
                              edit reason
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order.id || order.order_number, 'pending')}
                              className="border border-gray-300 text-gray-700 bg-white font-micro uppercase tracking-widest text-[9px] py-1.5 rounded-full hover:border-[var(--border-admin)] transition-colors"
                            >
                              reopen
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Direct WhatsApp Chat Link */}
                  <a 
                    href={`https://wa.me/${getCleanPhone(order.phone)}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="w-full flex items-center justify-center gap-1.5 text-center border border-[var(--border-admin)] text-[var(--border-admin)] font-micro uppercase tracking-widest text-[9px] py-1.5 rounded-full hover:bg-[var(--border-admin)] hover:text-white transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>direct whatsapp chat</span>
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      <AdminModal
        isOpen={!!rejectionModalOrder}
        onClose={() => setRejectionModalOrder(null)}
        title="reject order"
        subtitle={rejectionModalOrder ? `order ${rejectionModalOrder.order_number} • ${rejectionModalOrder.customer_name}` : ''}
        icon={<XCircle className="w-5 h-5 text-red-600" />}
      >
        {rejectionModalOrder && (
          <div className="space-y-4 font-body text-xs">
            <div>
              <label className="block font-micro uppercase tracking-wider text-[10px] text-gray-600 mb-1.5">
                quick rejection presets ({isCodOrder(rejectionModalOrder) ? 'COD Order' : 'UPI Prepaid Order'})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(isCodOrder(rejectionModalOrder)
                  ? [
                      'Unverified Contact Number / Address',
                      'COD Not Available for Destination',
                      'Item Out of Stock',
                      'Duplicate Order Placed',
                      'Customer Requested Cancellation'
                    ]
                  : [
                      'Invalid UPI UTR / Payment Not Received',
                      'Incomplete Payment Proof',
                      'Item Out of Stock',
                      'Duplicate Order Placed',
                      'Customer Requested Cancellation'
                    ]
                ).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className={`px-2.5 py-1 rounded-full text-[10px] border transition-all text-left ${
                      rejectionReason === preset
                        ? 'bg-red-600 text-white border-red-600 font-bold'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-micro uppercase tracking-wider text-[10px] text-gray-600 mb-1.5">
                rejection explanation (visible to customer)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason why this order is being rejected..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-red-600 focus:outline-none text-xs text-gray-800 resize-none"
              />
            </div>

            {/* Send WhatsApp Rejection Notice Option */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
              <div className="text-[11px] text-gray-700">
                <span className="font-bold block">Notify via WhatsApp</span>
                <span className="text-gray-500 text-[10px]">Open WhatsApp chat with pre-written rejection details</span>
              </div>
              <input
                type="checkbox"
                checked={sendRejectionWhatsApp}
                onChange={(e) => setSendRejectionWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                disabled={updatingRejection || !rejectionReason.trim()}
                onClick={handleConfirmRejection}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-micro uppercase tracking-widest text-[10px] font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>confirm order rejection</span>
              </button>

              <button
                disabled={updatingRejection}
                onClick={() => setRejectionModalOrder(null)}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-micro uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all"
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* DISPATCH & MARK SHIPPED MODAL */}
      <AdminModal
        isOpen={!!shippingModalOrder}
        onClose={() => setShippingModalOrder(null)}
        title={shippingModalOrder?.status === 'shipped' ? 'update dispatch details' : 'mark order shipped'}
        subtitle={shippingModalOrder ? `order ${shippingModalOrder.order_number} • ${shippingModalOrder.customer_name}` : ''}
        icon={<Truck className="w-5 h-5 text-blue-600" />}
      >
        {shippingModalOrder && (
          <div className="space-y-4 font-body text-xs">
            {/* Courier Partner Selection */}
            <div>
              <label className="block font-micro uppercase tracking-wider text-[10px] text-gray-600 mb-1.5">
                courier partner
              </label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Delhivery Express"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-blue-600 focus:outline-none text-sm text-gray-800"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Delhivery Express', 'Blue Dart', 'India Post (Speed Post)', 'DTDC', 'Shadowfax'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourierName(c)}
                    className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                      courierName === c 
                        ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {c.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking Number / AWB */}
            <div>
              <label className="block font-micro uppercase tracking-wider text-[10px] text-gray-600 mb-1.5">
                tracking number / awb
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value.trim())}
                placeholder="e.g. 128947192837 or AWB8921"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-blue-600 focus:outline-none font-mono text-sm uppercase text-gray-800"
              />
            </div>

            {/* Preview of Shipped WhatsApp Message */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600 space-y-1">
              <span className="font-bold text-gray-800 flex items-center gap-1">
                <Send className="w-3 h-3 text-emerald-600" />
                <span>WhatsApp Shipped Preset ({isCodOrder(shippingModalOrder) ? 'COD' : 'UPI Prepaid'}) Preview</span>
              </span>
              <p className="italic text-gray-500 line-clamp-3">
                {isCodOrder(shippingModalOrder)
                  ? `"Hi ${shippingModalOrder.customer_name}! Great news! Your Cash on Delivery (COD) order ${shippingModalOrder.order_number} has been shipped via ${courierName || 'Delhivery Express'}... Amount to collect: ₹${shippingModalOrder.total_amount}"`
                  : `"Hi ${shippingModalOrder.customer_name}! Great news! Your prepaid order ${shippingModalOrder.order_number} has been shipped via ${courierName || 'Delhivery Express'}... Paid via UPI Prepaid"`}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                disabled={updatingShipment}
                onClick={() => handleConfirmShipment(true)}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-micro uppercase tracking-widest text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{shippingModalOrder.status === 'shipped' ? 'save & send whatsapp update' : 'mark shipped & send whatsapp'}</span>
              </button>

              <button
                disabled={updatingShipment}
                onClick={() => handleConfirmShipment(false)}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-micro uppercase tracking-widest text-[10px] hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                save tracking only (no whatsapp)
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* FULL ORDER DETAIL MODAL */}
      <AdminModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `order ${selectedOrder.order_number}` : ''}
        subtitle={selectedOrder ? `placed on ${new Date(selectedOrder.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}` : ''}
        maxWidth="2xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-body text-xs">
              
              {/* Left Column: Customer & Payment */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-400 mb-2 border-b pb-1">Customer Details</h4>
                  <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                  <p><strong>Phone:</strong> +91 {selectedOrder.phone}</p>
                  <p><strong>Address:</strong> {selectedOrder.address}</p>
                  {selectedOrder.pincode && <p><strong>Pincode:</strong> {selectedOrder.pincode}</p>}
                </div>

                <div>
                  <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-400 mb-2 border-b pb-1">Payment Info</h4>
                  <p><strong>Payment Type:</strong> {selectedOrder.utr_number?.includes('COD') ? 'Cash on Delivery' : 'Online / UPI'}</p>
                  <p><strong>UTR Reference:</strong> <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{selectedOrder.utr_number}</span></p>
                  <p><strong>Total Amount:</strong> ₹{selectedOrder.total_amount}</p>
                  {selectedOrder.items && !Array.isArray(selectedOrder.items) && selectedOrder.items.promo && (
                     <p className="text-green-600 font-semibold"><strong>Promo Applied:</strong> {selectedOrder.items.promo.code} (₹{selectedOrder.items.promo.discount} off)</p>
                  )}
                  <p className="flex items-center gap-2 mt-1">
                    <strong>Current Status:</strong> 
                    <AdminBadge variant={selectedOrder.status as any}>{selectedOrder.status}</AdminBadge>
                  </p>
                  {selectedOrder.rejection_reason && (
                    <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700">
                      <strong>Rejection Reason:</strong> {selectedOrder.rejection_reason}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-400 mb-2 border-b pb-1">Dispatch & Logistics</h4>
                  <p><strong>Courier:</strong> {selectedOrder.courier_name || 'Delhivery Express'}</p>
                  <p><strong>Tracking Number:</strong> {selectedOrder.tracking_number || 'Not added yet'}</p>
                  {selectedOrder.shipped_at && (
                    <p className="text-gray-500"><strong>Shipped At:</strong> {new Date(selectedOrder.shipped_at).toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
              
              {/* Right Column: Ordered Items & Proof */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-400 mb-2 border-b pb-1">Ordered Items</h4>
                  <ul className="space-y-2 mb-4">
                    {(() => {
                      const itemsArray = Array.isArray(selectedOrder.items) ? selectedOrder.items : (selectedOrder.items?.list || []);
                      return itemsArray.map((item: any, idx: number) => (
                        <li key={idx} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <div>
                            <p className="font-bold text-gray-800">{item.product?.title || item.title || 'Studio Item'}</p>
                            {item.selectedVariant && <p className="text-[11px] text-gray-500">Variant: {item.selectedVariant.name}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-gray-500">Qty: {item.quantity || 1}</p>
                            <p className="font-bold text-gray-800">₹{(item.product?.price || item.price || 0) * (item.quantity || 1)}</p>
                          </div>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>

                {selectedOrder.screenshot_url && (
                  <div>
                    <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-400 mb-2 border-b pb-1">Payment Proof Screenshot</h4>
                    <a href={selectedOrder.screenshot_url} target="_blank" rel="noreferrer" className="block border border-gray-200 rounded-xl overflow-hidden p-1 hover:border-[var(--border-admin)] transition-colors group">
                      <img src={selectedOrder.screenshot_url} alt="Proof" className="w-full h-44 object-cover rounded-lg group-hover:scale-[1.01] transition-transform" />
                    </a>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const normSelectedStatus = (selectedOrder.status || 'pending').toLowerCase().trim();
                  return (
                    <>
                      {normSelectedStatus === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(selectedOrder.id || selectedOrder.order_number, 'paid')} 
                            className="px-3.5 py-2 border border-green-600 bg-green-50 text-green-700 font-micro uppercase tracking-widest text-[9px] rounded-full hover:bg-green-600 hover:text-white transition-colors font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>accept (paid)</span>
                          </button>
                          <button 
                            onClick={() => openRejectionModal(selectedOrder)} 
                            className="px-3.5 py-2 border border-red-500 text-red-600 bg-red-50 font-micro uppercase tracking-widest text-[9px] rounded-full hover:bg-red-600 hover:text-white transition-colors font-bold flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>reject order</span>
                          </button>
                        </>
                      )}

                      {normSelectedStatus === 'paid' && (
                        <button
                          onClick={() => sendConfirmation(selectedOrder)}
                          className="px-3.5 py-2 border border-emerald-600 text-emerald-700 bg-emerald-50 rounded-full font-micro uppercase tracking-widest text-[9px] hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 font-bold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{isCodOrder(selectedOrder) ? 'whatsapp cod order confirmed' : 'whatsapp upi payment verified'}</span>
                        </button>
                      )}

                      {normSelectedStatus === 'shipped' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id || selectedOrder.order_number, 'delivered')}
                          className="px-3.5 py-2 border border-emerald-600 text-emerald-700 bg-emerald-50 rounded-full font-micro uppercase tracking-widest text-[9px] hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 font-bold"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>mark delivered</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const orderToShip = selectedOrder;
                          setSelectedOrder(null);
                          openShippingModal(orderToShip);
                        }}
                        className="px-3.5 py-2 border border-blue-600 text-blue-700 bg-blue-50 rounded-full font-micro uppercase tracking-widest text-[9px] hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>{normSelectedStatus === 'shipped' ? 'resend / edit shipping' : 'mark as shipped'}</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteModalOrder(selectedOrder)}
                  className="px-4 py-2 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-micro uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all"
                >
                  delete record
                </button>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="px-6 py-2 border border-gray-300 rounded-full font-micro uppercase tracking-widest text-[10px] hover:bg-gray-50"
                >
                  close
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      {/* PERMANENT ORDER DELETION CONFIRM MODAL */}
      <AdminConfirmModal
        isOpen={!!deleteModalOrder}
        onClose={() => setDeleteModalOrder(null)}
        onConfirm={handleDeleteOrder}
        title="delete order record?"
        message={`Are you sure you want to permanently remove order ${deleteModalOrder?.order_number}? This cannot be undone.`}
        confirmLabel="Permanently Delete"
        isDestructive={true}
        loading={deletingOrder}
      />
    </div>
  );
};
