import React, { useEffect, useState, useMemo } from 'react';
import { fetchAdminCustomers, toggleCustomerBlacklist, fetchAllOrders } from '../../../lib/adminApi';
import { Users, UserX, ShieldCheck, Phone, RefreshCw, MessageCircle } from 'lucide-react';
import { AdminSearch } from '../shared/AdminSearch';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blacklisted'>('all');
  const [pendingTogglePhone, setPendingTogglePhone] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let customerList = await fetchAdminCustomers();
      if (!customerList || customerList.length === 0) {
        const orders = await fetchAllOrders();
        const custMap = new Map<string, any>();
        orders.forEach(o => {
          if (!o.phone) return;
          const phone = o.phone;
          const name = o.customer_name || 'Customer';
          const amt = Number(o.total_amount || 0);
          if (custMap.has(phone)) {
            const existing = custMap.get(phone);
            existing.total_spent += amt;
            existing.order_count += 1;
          } else {
            custMap.set(phone, {
              name,
              phone,
              total_spent: amt,
              order_count: 1,
              is_blacklisted: false,
              last_order_at: o.created_at
            });
          }
        });
        customerList = Array.from(custMap.values());
      }
      setCustomers(customerList);
    } catch (err) {
      console.warn('Customers fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleBlacklist = async () => {
    if (!pendingTogglePhone) return;
    setToggling(true);
    try {
      const updated = await toggleCustomerBlacklist(pendingTogglePhone);
      if (updated) {
        setCustomers(prev => prev.map(c => c.phone === pendingTogglePhone ? { ...c, is_blacklisted: updated.is_blacklisted } : c));
      } else {
        setCustomers(prev => prev.map(c => c.phone === pendingTogglePhone ? { ...c, is_blacklisted: !c.is_blacklisted } : c));
      }
      setPendingTogglePhone(null);
    } catch (err) {
      console.error("Error toggling customer blacklist:", err);
    } finally {
      setToggling(false);
    }
  };

  const getCleanPhone = (phoneStr: string) => {
    const raw = (phoneStr || '').replace(/[^0-9]/g, '');
    return raw.length === 10 ? `91${raw}` : raw.replace(/^91/, '91');
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(searchQuery.trim()));

      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'blacklisted' ? !!c.is_blacklisted : !c.is_blacklisted;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => !c.is_blacklisted).length;
    const blacklisted = customers.filter(c => !!c.is_blacklisted).length;
    const totalLTV = customers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);

    return { total, active, blacklisted, totalLTV };
  }, [customers]);

  const targetCustomer = customers.find(c => c.phone === pendingTogglePhone);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">customer crm.</h2>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            client lifetime value, order frequency, phone verification, and blacklist controls
          </p>
        </div>
        <button
          onClick={fetchCustomers}
          className="flex items-center gap-1.5 px-4 py-2 border border-[var(--border-admin)] rounded-full text-[var(--border-admin)] hover:bg-[var(--border-admin-subtle)]/40 transition-all font-micro uppercase tracking-wider text-[10px]"
          title="Refresh Customers"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Total Clients" value={stats.total} subValue="Shoppers with orders" />
        <AdminStatCard label="Active Clients" value={stats.active} subValue="Permitted to checkout" />
        <AdminStatCard label="Blacklisted" value={stats.blacklisted} subValue="Restricted from COD" className={stats.blacklisted > 0 ? "border-red-200 bg-red-50/30" : ""} />
        <AdminStatCard label="Cumulative Spend" value={`₹${stats.totalLTV.toLocaleString('en-IN')}`} subValue="Customer gross LTV" />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex-1 max-w-md">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by customer name or phone number..."
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-micro uppercase tracking-wider text-gray-700 outline-none focus:border-[var(--border-admin)]"
          >
            <option value="all">All Clients ({customers.length})</option>
            <option value="active">Active Only ({stats.active})</option>
            <option value="blacklisted">Blacklisted ({stats.blacklisted})</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left font-body text-xs min-w-[750px]">
            <thead className="bg-[var(--border-admin-subtle)]/40 border-b border-[var(--border-admin-subtle)] font-micro text-[9px] uppercase tracking-widest text-gray-600">
              <tr>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Total Spent</th>
                <th className="p-4">Orders</th>
                <th className="p-4">Account Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map(c => (
                <tr key={c.phone} className="hover:bg-white transition-colors">
                  <td className="p-4 font-bold text-sm text-gray-900">{c.name}</td>
                  <td className="p-4 font-mono text-xs text-gray-600">+91 {c.phone}</td>
                  <td className="p-4 font-bold font-display text-sm text-[var(--border-admin)]">
                    ₹{Number(c.total_spent || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-4 font-mono text-xs">
                    {c.order_count} order{c.order_count > 1 ? 's' : ''}
                  </td>
                  <td className="p-4">
                    <AdminBadge variant={c.is_blacklisted ? 'rejected' : 'active'}>
                      {c.is_blacklisted ? 'Blacklisted' : 'Active Account'}
                    </AdminBadge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a 
                        href={`https://wa.me/${getCleanPhone(c.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Direct WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button 
                        onClick={() => setPendingTogglePhone(c.phone)}
                        className={`text-[9px] font-micro uppercase tracking-wider border rounded-full px-3 py-1 transition-all ${
                          c.is_blacklisted 
                            ? 'border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold' 
                            : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                        }`}
                      >
                        {c.is_blacklisted ? 'Unblock' : 'Blacklist'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 font-micro uppercase tracking-widest text-xs">
                    {loading ? 'Loading customer CRM records...' : 'No customers found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blacklist Confirmation Modal */}
      <AdminConfirmModal
        isOpen={!!pendingTogglePhone}
        onClose={() => setPendingTogglePhone(null)}
        onConfirm={handleToggleBlacklist}
        title={targetCustomer?.is_blacklisted ? `unblock ${targetCustomer?.name}?` : `blacklist ${targetCustomer?.name}?`}
        message={
          targetCustomer?.is_blacklisted
            ? `This customer will be permitted to place orders and utilize Cash on Delivery again.`
            : `Blacklisting this customer will mark their future orders for immediate flag and prevent unauthorized COD attempts.`
        }
        confirmLabel={targetCustomer?.is_blacklisted ? 'Confirm Unblock' : 'Confirm Blacklist'}
        isDestructive={!targetCustomer?.is_blacklisted}
        loading={toggling}
      />
    </div>
  );
};
