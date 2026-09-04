import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Box, 
  Users, 
  Tag, 
  LogOut, 
  Sparkles, 
  Menu, 
  X, 
  Megaphone, 
  FolderTree,
  ExternalLink 
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    if (window.location.pathname === '/admin/login') return false;
    return !!localStorage.getItem('admin_token');
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/admin/login') {
      setAuthenticated(false);
      return;
    }
    
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAuthenticated(true);
    } else {
      setAuthenticated(false);
      navigate('/admin/login');
    }
  }, [location.pathname, navigate]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (authenticated === null && location.pathname !== '/admin/login') {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center font-micro tracking-widest text-[#1A1A1A] uppercase text-xs">
        authenticating session...
      </div>
    );
  }

  const NAV_LINKS = [
    { label: 'Dashboard', path: '/admin/analytics', icon: LayoutDashboard },
    { label: 'Orders Desk', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Products', path: '/admin/products', icon: Box },
    { label: 'Categories', path: '/admin/categories', icon: FolderTree },
    { label: 'Customer CRM', path: '/admin/customers', icon: Users },
    { label: 'Promo Codes', path: '/admin/discounts', icon: Tag },
    { label: 'Sales & Banners', path: '/admin/sales', icon: Megaphone },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#1A1A1A] font-body flex" style={{
      '--bg-admin': '#F4F4F5',
      '--bg-card': '#FFFFFF',
      '--border-admin': '#722F37',
      '--border-admin-subtle': 'rgba(114, 47, 55, 0.15)',
      '--text-admin': '#1A1A1A'
    } as React.CSSProperties}>
      
      {authenticated && location.pathname !== '/admin/login' && (
        <>
          {/* Mobile Header Overlay */}
          <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 z-40 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[var(--border-admin)] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h1 className="font-display font-bold text-lg lowercase tracking-tighter text-black">matilda studio.</h1>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -mr-2 text-gray-600 hover:text-black">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Backdrop for mobile menu */}
          {mobileMenuOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 top-16" 
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar Navigation */}
          <aside className={`w-64 bg-white/95 backdrop-blur-md border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-50 shadow-xs transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } lg:top-0 top-16`}>
            
            <div className="hidden lg:flex p-6 border-b border-gray-100 items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--border-admin)] flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-lg lowercase tracking-tighter text-black leading-none">matilda.</h1>
                  <span className="font-micro uppercase tracking-widest text-[8px] text-[var(--border-admin)] font-semibold">Store Management</span>
                </div>
              </div>
              <Link 
                to="/" 
                target="_blank"
                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                title="Open Public Storefront"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
              {NAV_LINKS.map(link => {
                const active = location.pathname.includes(link.path);
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.path}
                    to={link.path} 
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-micro uppercase tracking-widest text-[10px] transition-all ${
                      active 
                        ? 'bg-[var(--border-admin)] text-white shadow-xs font-semibold' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-black'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="p-3 border-t border-gray-100 mt-auto">
              <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--border-admin)]/5 border border-[var(--border-admin)]/10 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--border-admin)] flex items-center justify-center text-white font-display font-bold text-xs shadow-inner shrink-0">
                    D
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-bold text-xs text-gray-900 tracking-tight truncate">Duha Admin</span>
                    <span className="font-micro text-[8px] text-[var(--border-admin)] uppercase tracking-widest font-semibold truncate">Active Session</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    localStorage.removeItem('admin_token');
                    setAuthenticated(false);
                    navigate('/admin/login');
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                  title="Sign out of Admin Desk"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
      
      <main className={`flex-1 min-w-0 overflow-x-hidden ${authenticated && location.pathname !== '/admin/login' ? 'lg:ml-64 pt-16 lg:pt-0' : ''}`}>
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
