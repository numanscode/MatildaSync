import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { X, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateQuantity,
    cartTotal,
    triggerCheckoutHandoff,
  } = useCollection();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsCartOpen(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="relative z-10 w-full sm:w-[420px] h-full bg-[var(--bg-primary)]/85 backdrop-blur-xl text-[var(--text-primary)] border-l border-[var(--border-main)]/20 shadow-2xl flex flex-col justify-between p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="font-display text-base font-bold lowercase tracking-tight text-[var(--text-dominant)] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[var(--border-maroon)]" />
                shopping bag ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="w-8 h-8 rounded-full bg-[var(--bg-primary)]/60 backdrop-blur-md flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-20 text-xs text-[var(--text-muted)] space-y-2">
                <p className="font-display text-xs font-bold lowercase text-[var(--text-dominant)]">your bag is empty.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={`${item.product.id}-${item.selectedVariant.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 p-3.5 shadow-xs"
                >
                  <div className="w-16 h-16 aspect-square rounded-xl overflow-hidden bg-[var(--card-inner)]/60 shrink-0">
                    <img
                      src={item.product.mainImage}
                      alt={item.product.title}
                      className="w-full h-full aspect-square object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between h-full text-xs">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-display text-xs font-bold lowercase break-words text-[var(--text-dominant)]">
                          {item.product.title}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedVariant.id)}
                          className="text-[var(--text-muted)] hover:text-red-500 font-bold p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="inline-block px-2.5 py-0.5 text-[10px] mt-1 bg-[var(--bg-primary)]/80 text-[var(--border-maroon)] font-semibold rounded-full lowercase">
                        {item.selectedVariant.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2">
                      <div className="flex items-center gap-1 bg-[var(--bg-primary)]/90 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.selectedVariant.id, -1)}
                          className="hover:text-[var(--border-maroon)] px-1"
                        >
                          -
                        </button>
                        <span className="px-1.5">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.selectedVariant.id, 1)}
                          className="hover:text-[var(--border-maroon)] px-1"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-bold text-[var(--text-dominant)]">₹ {(item.product.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Total & Checkout Handoff */}
          <div className="pt-3 space-y-3 text-xs">
            {cart.length > 0 && (
              <div className="space-y-1.5 border-t border-[var(--border-main)]/20 pt-3">
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)] lowercase">
                  <span>items subtotal</span>
                  <span className="font-semibold text-[var(--text-dominant)]">₹ {cartTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)] lowercase">
                  <span>shipping</span>
                  <span className="font-medium text-[var(--text-muted)] italic">to be calculated at next step</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-[var(--text-dominant)] pt-1.5 border-t border-[var(--border-main)]/10 lowercase">
                  <span>bag total</span>
                  <span className="text-sm font-extrabold text-[var(--border-maroon)]">₹ {cartTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {cartTotal > 2000 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-[11px] lowercase text-center font-medium">
                bag exceeds max order amount of ₹2,000 at once. please reduce quantity or place multiple orders.
              </div>
            )}

            <p className="text-[11px] text-[var(--text-muted)] lowercase italic font-serif">
              shipping charges will be calculated at checkout based on your delivery pincode.
            </p>

            <button
              disabled={cart.length === 0 || cartTotal > 2000}
              onClick={() => {
                setIsCartOpen(false);
                navigate('/app/checkout');
              }}
              className="w-full py-3.5 rounded-full bg-[var(--border-maroon)] text-white font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
            >
              <span>{cartTotal > 2000 ? 'exceeds ₹2,000 limit' : 'proceed to checkout'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

