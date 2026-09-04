/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CollectionProvider, useCollection } from './context/CollectionContext';
import { Preloader } from './components/Preloader';
import { Navbar } from './components/Navbar';
import { GlobalBackground } from './components/GlobalBackground';
import { Hero } from './components/Hero';
import { ProductGrid } from './components/ProductGrid';
import { AboutUs } from './components/AboutUs';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';

// Lazy load non-critical and heavy components
const CheckoutPage = lazy(() => import('./components/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('./components/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
const ProductModal = lazy(() => import('./components/ProductModal').then(m => ({ default: m.ProductModal })));
const SayHelloModal = lazy(() => import('./components/SayHelloModal').then(m => ({ default: m.SayHelloModal })));
const CheckoutHandoff = lazy(() => import('./components/CheckoutHandoff').then(m => ({ default: m.CheckoutHandoff })));

// Lazy load admin module
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLogin = lazy(() => import('./components/admin/pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminOrders = lazy(() => import('./components/admin/pages/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminAnalytics = lazy(() => import('./components/admin/pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminProducts = lazy(() => import('./components/admin/pages/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminCategories = lazy(() => import('./components/admin/pages/AdminCategories').then(m => ({ default: m.AdminCategories })));
const AdminCustomers = lazy(() => import('./components/admin/pages/AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminDiscounts = lazy(() => import('./components/admin/pages/AdminDiscounts').then(m => ({ default: m.AdminDiscounts })));
const AdminSales = lazy(() => import('./components/admin/pages/AdminSales').then(m => ({ default: m.AdminSales })));

// Performance Optimizations: Memoize static layout structures
const MemoizedGlobalBackground = React.memo(GlobalBackground);
const MemoizedPreloader = React.memo(Preloader);
const MemoizedNavbar = React.memo(Navbar);
const MemoizedFooter = React.memo(Footer);
const MemoizedCartDrawer = React.memo(CartDrawer);

const SuspenseFallback: React.FC = () => (
  <div className="min-h-[40vh] flex items-center justify-center p-8 text-xs font-mono lowercase text-[var(--text-muted)] animate-pulse">
    loading...
  </div>
);

interface PageTransitionProps {
  children: React.ReactNode;
  pathname: string;
}

const PageTransition: React.FC<PageTransitionProps> = React.memo(({ children, pathname }) => {
  const isCheckout = pathname === '/checkout' || pathname === '/app/checkout';
  const isOrder = pathname.startsWith('/order');
  const isAdmin = pathname.startsWith('/admin');

  // Motion variants tailored for silky smooth slide and fade transitions
  const variants = isCheckout
    ? {
        initial: { opacity: 0, x: 28, scale: 0.99 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: -20, scale: 0.99 },
      }
    : isOrder
    ? {
        initial: { opacity: 0, y: 20, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -16, scale: 0.98 },
      }
    : {
        // Home page default transition
        initial: { opacity: 0, y: 12, scale: 0.995 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -12, scale: 0.995 },
      };

  if (isAdmin) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full transform-gpu will-change-transform"
    >
      {children}
    </motion.div>
  );
});

const AppLayout: React.FC = () => {
  const { viewMode } = useCollection();

  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  // Reset scroll position on route change for clean navigation
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  // If visiting homepage with ?order=MT-XXXX, redirect directly to the dedicated confirmation page
  const orderQuery = new URLSearchParams(location.search).get('order');
  if (location.pathname === '/' && orderQuery) {
    return <Navigate to={`/order-confirmation/${orderQuery}`} replace />;
  }

  return (
    <div className="min-h-screen relative font-body selection:bg-[var(--border-main)] selection:text-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Global Background Layer */}
      {!isAdmin && <MemoizedGlobalBackground />}

      {/* Global Preloader */}
      {!isAdmin && <MemoizedPreloader />}

      {/* Global Header Navigation Bar */}
      {!isAdmin && <MemoizedNavbar />}

      <Suspense fallback={<SuspenseFallback />}>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={isAdmin ? '/admin' : location.pathname} pathname={location.pathname}>
            <Routes location={location}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="analytics" replace />} />
                <Route path="login" element={<AdminLogin />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="discounts" element={<AdminDiscounts />} />
                <Route path="sales" element={<AdminSales />} />
              </Route>
              
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/app/checkout" element={<CheckoutPage />} />
              
              {/* Dedicated Order Confirmation & Live Tracking Pages */}
              <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
              <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
              <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
              <Route path="/order-success/:orderNumber" element={<OrderConfirmationPage />} />
              <Route path="/order-success" element={<OrderConfirmationPage />} />
              <Route path="/order" element={<OrderConfirmationPage />} />
              
              <Route path="/" element={
                <>
                  {/* Main Page Layout based on viewMode with animated mode switching */}
                  <AnimatePresence mode="wait">
                    {viewMode === 'brand' ? (
                      <motion.div
                        key="brand-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="transform-gpu"
                      >
                        <Hero />
                        <AboutUs />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="shop-view"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="transform-gpu"
                      >
                        <ProductGrid />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Footer */}
                  <MemoizedFooter />
                </>
              } />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </Suspense>

      {/* Cart Drawer */}
      {!isAdmin && <MemoizedCartDrawer />}

      {/* Lazy Suspense for Client Overlays */}
      {!isAdmin && (
        <Suspense fallback={null}>
          <SearchModal />
          <ProductModal />
          <CheckoutHandoff />
          <SayHelloModal />
        </Suspense>
      )}
    </div>
  );
};

export default function App() {
  return (
    <CollectionProvider>
      <AppLayout />
    </CollectionProvider>
  );
}

