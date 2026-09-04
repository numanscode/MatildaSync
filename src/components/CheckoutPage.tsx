import React, { useState, useEffect } from 'react';
import { useCollection } from '../context/CollectionContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, UploadCloud, Truck, Loader2, QrCode, Banknote, ShieldCheck } from 'lucide-react';
import { lookupPincode, calculateDelhiveryShipping, ShippingCalculation } from '../lib/shipping';
import { submitOrder, getGoogleFirestore } from '../lib/googleDatabase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, isCartOpen, setIsCartOpen, clearCart } = useCollection();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    pincode: '',
    utr: ''
  });
  
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod'>('upi');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  
  const [saleActive, setSaleActive] = useState(false);
  const [saleDiscountPercent, setSaleDiscountPercent] = useState(0);
  const [saleType, setSaleType] = useState('percentage');
  const [saleDiscountAmount, setSaleDiscountAmount] = useState(0);

  // Delhivery Dynamic Shipping State
  const [shippingCalc, setShippingCalc] = useState<ShippingCalculation | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeSuccessMsg, setPincodeSuccessMsg] = useState<string | null>(null);

  const [upiConfig] = useState({ upi_id: import.meta.env.VITE_UPI_ID || 'your-upi-id@okbank', payee_name: 'Matilda Studio' });
  
  useEffect(() => {
    if (isCartOpen) setIsCartOpen(false);

    // Fetch store settings from Backend API & Firestore with graceful fallback
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/store/settings');
        if (res.ok) {
          const settingsObj = await res.json();
          if (settingsObj.sale_active === 'true' || settingsObj.sale_active === true) {
            setSaleActive(true);
            setSaleDiscountPercent(Number(settingsObj.sale_discount_percent) || 0);
            if (settingsObj.sale_type) setSaleType(settingsObj.sale_type);
            if (settingsObj.sale_discount_amount) setSaleDiscountAmount(Number(settingsObj.sale_discount_amount) || 0);
          }
          if (settingsObj.promos) {
            try {
              const parsed = typeof settingsObj.promos === 'string' ? JSON.parse(settingsObj.promos) : settingsObj.promos;
              setAvailablePromos(parsed);
            } catch(e) {}
          }
          return;
        }
      } catch (e) {}

      // Google Cloud Firestore fallback
      try {
        const db = getGoogleFirestore();
        if (db) {
          const saleSnap = await getDoc(doc(db, 'store_settings', 'sale'));
          if (saleSnap.exists()) {
            const data = saleSnap.data();
            if (data?.sale_active === 'true' || data?.sale_active === true) {
              setSaleActive(true);
              setSaleDiscountPercent(Number(data.sale_discount_percent) || 0);
              if (data.sale_type) setSaleType(data.sale_type);
              if (data.sale_discount_amount) setSaleDiscountAmount(Number(data.sale_discount_amount) || 0);
            }
          }
          const promoSnap = await getDoc(doc(db, 'store_settings', 'promos'));
          if (promoSnap.exists()) {
            const pData = promoSnap.data()?.value;
            if (pData) {
              const parsed = typeof pData === 'string' ? JSON.parse(pData) : pData;
              setAvailablePromos(parsed);
            }
          }
        }
      } catch (e) {}

      // Local fallback for store settings
      try {
        const localSettings = localStorage.getItem('matilda_store_settings');
        if (localSettings) {
          const d = JSON.parse(localSettings);
          if (d.sale_active === 'true' || d.sale_active === true) {
            setSaleActive(true);
            setSaleDiscountPercent(Number(d.sale_discount_percent) || 0);
            if (d.sale_type) setSaleType(d.sale_type);
            if (d.sale_discount_amount) setSaleDiscountAmount(Number(d.sale_discount_amount) || 0);
          }
        }
        const localPromos = localStorage.getItem('matilda_promos');
        if (localPromos) {
          setAvailablePromos(JSON.parse(localPromos));
        }
      } catch(e) {}
    };

    loadSettings();
  }, [isCartOpen, setIsCartOpen]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Instant shipping calculation and internet postal data lookup when 6 digits entered
    if (name === 'pincode') {
      const cleanPin = value.replace(/\D/g, '').trim();
      if (cleanPin.length === 6) {
        handlePincodeLookup(cleanPin);
      } else {
        setPincodeSuccessMsg(null);
        // Fallback calculation using current state if available
        setShippingCalc(calculateDelhiveryShipping(cleanPin, formData.state, formData.city));
      }
    }
  };

  const handlePincodeLookup = async (pin: string) => {
    setPincodeLoading(true);
    setPincodeSuccessMsg(null);
    try {
      const info = await lookupPincode(pin);
      if (info && info.success) {
        setFormData(prev => ({
          ...prev,
          city: prev.city || info.city || info.district,
          state: prev.state || info.state,
        }));
        const calc = calculateDelhiveryShipping(pin, info.state, info.city || info.district);
        setShippingCalc(calc);
        setPincodeSuccessMsg(`${info.district || info.city}, ${info.state}`);
      } else {
        // Fallback based on numerical pincode prefix
        const calc = calculateDelhiveryShipping(pin, formData.state, formData.city);
        setShippingCalc(calc);
      }
    } catch (err) {
      const calc = calculateDelhiveryShipping(pin, formData.state, formData.city);
      setShippingCalc(calc);
    } finally {
      setPincodeLoading(false);
    }
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiConfig.upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPromo = () => {
    setPromoError('');
    if (!promoCodeInput.trim()) return;
    
    if (saleActive) {
      setPromoError('Promo codes cannot be combined with global sales.');
      return;
    }

    const validPromo = availablePromos.find(p => p.code.toLowerCase() === promoCodeInput.trim().toLowerCase() && p.is_active);
    if (validPromo) {
      setAppliedPromo(validPromo);
      setPromoCodeInput('');
    } else {
      setPromoError('Invalid or inactive promo code');
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
  };

  const itemsSubtotal = cartTotal;
  const cleanPincode = formData.pincode.replace(/\D/g, '').trim();
  const isPincodeValid = cleanPincode.length === 6;
  const deliveryFee = (cart.length > 0 && isPincodeValid && shippingCalc) ? shippingCalc.deliveryFee : 0;
  
  // Calculate discount: Global sale takes precedence, then applied promo
  let discountAmount = 0;
  let activeDiscountLabel = '';
  
  if (saleActive) {
    if ((!saleType || saleType === 'percentage') && saleDiscountPercent > 0) {
      discountAmount = itemsSubtotal * (saleDiscountPercent / 100);
      activeDiscountLabel = `GLOBAL SALE (${saleDiscountPercent}% OFF)`;
    } else if (saleType === 'fixed' && saleDiscountAmount > 0) {
      discountAmount = Math.min(itemsSubtotal, saleDiscountAmount);
      activeDiscountLabel = `GLOBAL SALE (₹${saleDiscountAmount} OFF)`;
    }
  } else if (appliedPromo) {

    let eligibleTotal = itemsSubtotal;
    let eligibleItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    if (appliedPromo.target_type === 'specific' && Array.isArray(appliedPromo.target_products)) {
      eligibleTotal = cart
        .filter(item => appliedPromo.target_products!.includes(item.product.id))
        .reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      eligibleItemsCount = cart
        .filter(item => appliedPromo.target_products!.includes(item.product.id))
        .reduce((sum, item) => sum + item.quantity, 0);
    }

    if (!appliedPromo.discount_type || appliedPromo.discount_type === 'percentage') {
      discountAmount = eligibleTotal * (appliedPromo.discount_percentage / 100);
      activeDiscountLabel = `${appliedPromo.code} (${appliedPromo.discount_percentage}% OFF)`;
    } else if (appliedPromo.discount_type === 'fixed') {
      discountAmount = Math.min(eligibleTotal, appliedPromo.discount_amount);
      activeDiscountLabel = `${appliedPromo.code} (₹${appliedPromo.discount_amount} OFF)`;
    } else if (appliedPromo.discount_type === 'bogo') {
      const buyQty = appliedPromo.bogo_buy || 1;
      const getQty = appliedPromo.bogo_get || 1;
      let freeItems = Math.floor(eligibleItemsCount / (buyQty + getQty)) * getQty;
      
      let eligibleItems = cart.filter(item => 
        appliedPromo.target_type === 'specific' ? appliedPromo.target_products!.includes(item.product.id) : true
      ).flatMap(item => Array(item.quantity).fill(item.product.price)).sort((a, b) => a - b);

      let bogoDiscount = 0;
      for (let i = 0; i < freeItems && i < eligibleItems.length; i++) {
        bogoDiscount += eligibleItems[i];
      }
      discountAmount = bogoDiscount;
      activeDiscountLabel = `${appliedPromo.code} (BOGO APPLIED)`;
    }

  }
  
  const finalTotal = Math.max(0, itemsSubtotal - discountAmount + deliveryFee);

  const MAX_UPI_AMOUNT = 2000;
  const MAX_COD_AMOUNT = 400;

  const isCOD = paymentMethod === 'cod';
  const isCodEligible = finalTotal <= MAX_COD_AMOUNT;
  const isOverLimit = isCOD ? !isCodEligible : finalTotal > MAX_UPI_AMOUNT;

  const getErrorMessage = (err: any): string => {
    if (!err) return 'An error occurred while placing your order. Please try again.';
    if (typeof err === 'string') return err;
    if (typeof err.error === 'string') return err.error;
    if (typeof err.error === 'object' && err.error && typeof err.error.message === 'string') return err.error.message;
    if (typeof err.message === 'string') return err.message;
    if (typeof err.message === 'object' && err.message && typeof err.message.message === 'string') return err.message.message;
    try {
      const str = JSON.stringify(err);
      if (str && str !== '{}' && !str.includes('[object Object]')) return str;
    } catch {
      // ignore
    }
    return 'An error occurred while placing your order. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPincodeValid) {
      setError('please enter a valid 6-digit pincode to calculate shipping.');
      return;
    }

    if (isCOD && !isCodEligible) {
      setError(`cash on delivery is only available for orders up to ₹${MAX_COD_AMOUNT}. please choose UPI or reduce items.`);
      return;
    }

    if (!isCOD && finalTotal > MAX_UPI_AMOUNT) {
      setError(`maximum order amount is ₹${MAX_UPI_AMOUNT.toLocaleString('en-IN')} at once. please reduce items in your bag or place separate orders.`);
      return;
    }

    if (!isCOD && !/^[0-9]{12}$/.test(formData.utr)) {
      setError('utr must be exactly 12 digits.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const fullAddress = `${formData.street}${formData.apartment ? `, ${formData.apartment}` : ''}, ${formData.city}, ${formData.state}`;
      
      let screenshotBase64 = '';
      if (!isCOD && file) {
        try {
          screenshotBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } catch (e) {
          console.warn("Screenshot read notice:", e);
        }
      }

      let finalOrderNumber = `MT-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalUtr = isCOD ? 'COD - Cash on Delivery' : formData.utr;

      const jsonPayload = {
        name: formData.name,
        phone: formData.phone,
        address: fullAddress,
        pincode: formData.pincode,
        payment_method: paymentMethod,
        utr: isCOD ? 'COD' : formData.utr,
        total: finalTotal,
        promo_code: appliedPromo ? appliedPromo.code : undefined,
        discount_amount: appliedPromo ? discountAmount : undefined,
        items: cart,
        screenshot: screenshotBase64
      };

      // Multi-Engine Unified Checkout Submit (Backend API -> Google Firestore -> Local Durable Store)
      const orderRecord = {
        order_number: finalOrderNumber,
        customer_name: formData.name,
        phone: formData.phone,
        address: `${fullAddress}, Pincode: ${formData.pincode}`,
        items: {
          list: cart,
          promo: appliedPromo ? { code: appliedPromo.code, discount: discountAmount } : null,
          payment_method: paymentMethod
        },
        total_amount: finalTotal,
        utr_number: finalUtr,
        payment_screenshot: screenshotBase64 || '',
        screenshot_url: screenshotBase64 || '',
        status: 'pending' as const,
        created_at: new Date().toISOString()
      };

      try {
        const subRes = await submitOrder(orderRecord, file);
        if (subRes && subRes.orderNumber) {
          finalOrderNumber = subRes.orderNumber;
          orderRecord.order_number = finalOrderNumber;
        }
      } catch (submitErr) {
        console.warn('submitOrder exception (order preserved locally):', submitErr);
      }
      
      clearCart();
      navigate(`/order-confirmation/${finalOrderNumber}`, {
        state: {
          orderNumber: finalOrderNumber,
          customerName: formData.name,
          phone: formData.phone,
          address: fullAddress,
          pincode: formData.pincode,
          paymentMethod,
          utr: formData.utr,
          total: finalTotal,
          items: [...cart],
          promo: appliedPromo,
          discountAmount,
          deliveryFee,
          justPlaced: true
        }
      });
    } catch (err: any) {
      let friendlyError = getErrorMessage(err);
      const lower = friendlyError.toLowerCase();
      if (lower.includes('json') || lower.includes('unexpected token') || lower.includes('is not valid') || lower.includes('[object object]')) {
        friendlyError = 'Server error while placing order. Please try again or refresh the page.';
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="relative z-10 pt-32 pb-16 px-4 md:px-8 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <button 
          onClick={() => navigate('/')} 
          className="absolute top-24 left-4 sm:left-8 w-10 h-10 rounded-full bg-[var(--bg-primary)]/60 backdrop-blur-md flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="max-w-lg w-full mx-auto space-y-6">
          <h1 className="font-display text-3xl font-bold lowercase tracking-tight text-[var(--text-dominant)]">your cart is empty.</h1>
          <button 
            onClick={() => navigate('/')} 
            className="px-8 py-3.5 rounded-full bg-[var(--border-maroon)] text-white font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] transition-all shadow-sm text-sm"
          >
            return to shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 pt-28 pb-24 px-4 sm:px-6 md:px-12 max-w-6xl mx-auto min-h-screen">
      
      <button 
        onClick={() => navigate('/')} 
        className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 hover:bg-[var(--border-maroon)] hover:text-white hover:border-transparent transition-all font-medium text-xs lowercase tracking-wide group shadow-sm text-[var(--text-dominant)]"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:text-white transition-colors" />
        back to shop
      </button>

      <div className="mb-12">
        <h1 className="font-display text-4xl sm:text-5xl font-bold lowercase tracking-tight text-[var(--text-dominant)]">checkout.</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Left Column: Shipping */}
        <div className="lg:col-span-7">
          <section className="bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-[var(--border-main)]/10 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-xl font-bold lowercase text-[var(--text-dominant)] mb-8 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--border-maroon)] text-white flex items-center justify-center text-xs">1</span>
              shipping details
            </h2>
            <form id="checkout-form" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-1">
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">full name</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div className="sm:col-span-1">
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">whatsapp number</label>
                  <input required type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">street address</label>
                  <input required type="text" name="street" value={formData.street} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">apartment, suite (optional)</label>
                  <input type="text" name="apartment" value={formData.apartment} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div className="sm:col-span-1">
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">city</label>
                  <input required type="text" name="city" value={formData.city} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div className="sm:col-span-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">state</label>
                    <input required type="text" name="state" value={formData.state} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                  </div>
                  <div>
                    <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)] flex items-center justify-between">
                      <span>pincode</span>
                      {pincodeLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--border-maroon)]" />}
                    </label>
                    <input 
                      required 
                      type="text" 
                      name="pincode" 
                      placeholder="e.g. 190001" 
                      maxLength={6}
                      value={formData.pincode} 
                      onChange={handleInputChange} 
                      className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" 
                    />
                  </div>
                </div>

                {/* Delhivery Courier Live Calculation Card */}
                <div className="sm:col-span-2 mt-1">
                  <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-main)]/20 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-display font-bold text-[var(--text-dominant)] lowercase">
                        <Truck className="w-4 h-4 text-[var(--border-maroon)]" />
                        <span>delhivery courier express</span>
                      </div>
                      {isPincodeValid && shippingCalc ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--border-maroon)]/10 text-[var(--border-maroon)] font-bold text-[11px]">
                          ₹{shippingCalc.deliveryFee} shipping
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] italic lowercase">
                          pincode required
                        </span>
                      )}
                    </div>

                    {isPincodeValid && shippingCalc ? (
                      <div className="text-[11px] text-[var(--text-muted)] space-y-1 lowercase pt-1 border-t border-[var(--border-main)]/10">
                        <div className="flex items-center justify-between">
                          <span>destination:</span>
                          <span className="font-medium text-[var(--text-dominant)]">
                            {pincodeSuccessMsg || shippingCalc.destinationText}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--text-muted)] lowercase italic pt-0.5">
                        please enter pincode to calculate shipping charges.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Payment Method & Details */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-[var(--border-main)]/10 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="font-display text-xl font-bold lowercase text-[var(--text-dominant)] mb-6 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--border-maroon)] text-white flex items-center justify-center text-xs">2</span>
              payment method
            </h2>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => { setPaymentMethod('upi'); setError(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'border-[var(--border-maroon)] bg-[var(--bg-primary)] ring-1 ring-[var(--border-maroon)] shadow-sm'
                    : 'border-[var(--border-main)]/20 bg-[var(--bg-primary)]/40 hover:border-[var(--border-main)]/40 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <QrCode className={`w-4 h-4 ${paymentMethod === 'upi' ? 'text-[var(--border-maroon)]' : 'text-[var(--text-muted)]'}`} />
                  <span className={`w-2 h-2 rounded-full ${paymentMethod === 'upi' ? 'bg-[var(--border-maroon)]' : 'bg-transparent'}`} />
                </div>
                <div>
                  <p className="font-display text-xs font-bold lowercase text-[var(--text-dominant)]">UPI / Online</p>
                  <p className="text-[10px] text-[var(--text-muted)] lowercase">scan QR or UPI app</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setPaymentMethod('cod'); setError(''); }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer relative overflow-hidden ${
                  paymentMethod === 'cod'
                    ? 'border-[var(--border-maroon)] bg-[var(--bg-primary)] ring-1 ring-[var(--border-maroon)] shadow-sm'
                    : 'border-[var(--border-main)]/20 bg-[var(--bg-primary)]/40 hover:border-[var(--border-main)]/40 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Banknote className={`w-4 h-4 ${paymentMethod === 'cod' ? 'text-[var(--border-maroon)]' : 'text-[var(--text-muted)]'}`} />
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--border-maroon)]/10 text-[var(--border-maroon)]">
                    ≤ ₹400
                  </span>
                </div>
                <div>
                  <p className="font-display text-xs font-bold lowercase text-[var(--text-dominant)]">Cash on Delivery</p>
                  <p className="text-[10px] text-[var(--text-muted)] lowercase">pay in cash on arrival</p>
                </div>
              </button>
            </div>

            {/* Total Summary Box */}
            <div className="mb-6 w-full space-y-2 bg-[var(--bg-primary)]/70 p-4 rounded-2xl border border-[var(--border-main)]/15 text-xs">
              <div className="flex justify-between items-center text-[var(--text-muted)] lowercase gap-3">
                <span className="shrink-0">items subtotal</span>
                <span className="font-semibold text-[var(--text-dominant)] shrink-0">₹{itemsSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-muted)] lowercase gap-3">
                <span className="shrink-0">shipping</span>
                {isPincodeValid && shippingCalc ? (
                  <span className="font-semibold text-[var(--text-dominant)] shrink-0">₹{deliveryFee}</span>
                ) : (
                  <span className="font-medium italic text-[var(--text-muted)] text-[11px] text-right">
                    calculated by pincode
                  </span>
                )}
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-700 lowercase font-medium gap-3">
                  <span className="shrink-0">{activeDiscountLabel}</span>
                  <span className="shrink-0">-₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-main)]/15 text-sm font-bold lowercase text-[var(--text-dominant)] gap-3">
                <span className="shrink-0">total payable</span>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-display font-extrabold text-[var(--border-maroon)]">
                    ₹{finalTotal.toLocaleString('en-IN')}
                  </span>
                  {!isPincodeValid && <span className="text-[11px] font-normal text-[var(--text-muted)] ml-1.5 block sm:inline">(+ shipping)</span>}
                </div>
              </div>
            </div>

            {/* COD Specific Info Card */}
            {isCOD ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                  isCodEligible 
                    ? 'bg-amber-500/5 border-amber-600/20 text-[var(--text-dominant)]' 
                    : 'bg-red-500/5 border-red-500/20 text-red-700'
                }`}>
                  <div className="flex items-center gap-2 font-display font-bold lowercase">
                    <ShieldCheck className="w-4 h-4 text-[var(--border-maroon)] shrink-0" />
                    <span>cash on delivery terms</span>
                  </div>
                  {isCodEligible ? (
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed lowercase">
                      no advance payment required. your piece will be packed at the studio and dispatched. please keep exact cash of <strong className="font-semibold text-[var(--text-dominant)]">₹{finalTotal.toLocaleString('en-IN')}</strong> ready at the time of delivery.
                    </p>
                  ) : (
                    <div className="text-[11px] space-y-1 leading-relaxed">
                      <p className="font-semibold">
                        COD is only available for orders up to ₹400.
                      </p>
                      <p className="text-[var(--text-muted)]">
                        Your current order total is ₹{finalTotal.toLocaleString('en-IN')}. Please choose UPI / Online payment or reduce items in bag.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* UPI Specific QR & Details */
              <div className="flex flex-col xl:flex-row items-center xl:items-start gap-6">
                <div className="bg-white p-3 rounded-3xl border border-[var(--border-main)]/10 shadow-sm shrink-0">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=${upiConfig.upi_id}&pn=${encodeURIComponent(upiConfig.payee_name)}&am=${finalTotal}&cu=INR`)}`} 
                    alt="UPI QR Code" 
                    className="w-[120px] h-[120px] rounded-xl" 
                  />
                </div>
                <div className="flex flex-col items-center xl:items-start w-full space-y-3">
                  <div className="flex items-center w-full border border-[var(--border-main)]/20 bg-[var(--bg-primary)]/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-xs">
                    <span className="py-3 px-4 text-xs flex-1 text-center xl:text-left font-mono font-medium text-[var(--text-dominant)]">{upiConfig.upi_id}</span>
                    <button type="button" onClick={copyUpi} className="py-3 px-4 bg-[var(--border-main)]/10 hover:bg-[var(--border-maroon)] hover:text-white transition-all flex items-center justify-center min-w-[50px] text-[var(--text-dominant)]">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Mobile Deep Link Button */}
                  <a 
                    href={`upi://pay?pa=${upiConfig.upi_id}&pn=${encodeURIComponent(upiConfig.payee_name)}&am=${finalTotal}&cu=INR`}
                    className="md:hidden w-full bg-[var(--border-maroon)] text-white py-3.5 rounded-2xl flex items-center justify-center font-display font-bold lowercase tracking-wide shadow-md hover:opacity-90 transition-opacity text-xs"
                  >
                    Pay Now with UPI App (₹{finalTotal})
                  </a>
                </div>
              </div>
            )}
            
            {/* Promo Code Section */}
            <div className="mt-6 pt-6 border-t border-[var(--border-main)]/10">
              <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">promo code</label>
              
              {saleActive ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-5 py-3.5">
                  <span className="font-micro uppercase tracking-widest text-xs text-green-700 font-bold">GLOBAL SALE APPLIED</span>
                </div>
              ) : appliedPromo ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-5 py-3.5">
                  <span className="font-micro uppercase tracking-widest text-xs text-green-700 font-bold">{appliedPromo.code}</span>
                  <button type="button" onClick={removePromo} className="text-xs font-medium text-red-500 hover:text-red-700 lowercase">remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={promoCodeInput} onChange={e => setPromoCodeInput(e.target.value.toUpperCase())} className="flex-1 bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-body text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs uppercase transition-all" placeholder="Enter code" />
                  <button type="button" onClick={applyPromo} className="px-6 rounded-2xl bg-[var(--border-main)]/10 hover:bg-[var(--border-maroon)] hover:text-white transition-all font-medium text-xs lowercase">apply</button>
                </div>
              )}
              {promoError && <p className="text-red-500 font-micro text-[10px] mt-2 ml-1">{promoError}</p>}
            </div>
          </section>

          {/* Proof Section (Only required for UPI) */}
          {!isCOD && (
            <section className="bg-[var(--bg-primary)]/40 backdrop-blur-xl border border-[var(--border-main)]/10 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-xl font-bold lowercase text-[var(--text-dominant)] mb-8 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[var(--border-maroon)] text-white flex items-center justify-center text-xs">3</span>
                proof
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">12-digit UTR</label>
                  <input form="checkout-form" required={!isCOD} type="text" name="utr" value={formData.utr} onChange={handleInputChange} className="w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 rounded-2xl px-5 py-3.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-maroon)] shadow-xs transition-all" />
                </div>
                
                <div>
                  <label className="block font-display text-xs font-bold lowercase mb-2 pl-1 text-[var(--text-dominant)]">screenshot upload (optional)</label>
                  <div className="relative bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-main)]/20 border-dashed rounded-2xl hover:bg-[var(--border-main)]/5 transition-colors p-8 flex flex-col items-center justify-center gap-3 cursor-pointer shadow-xs">
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadCloud className="w-8 h-8 text-[var(--border-maroon)]/70" />
                    <p className="font-display font-medium text-xs lowercase text-center text-[var(--text-secondary)]">
                      {file ? file.name : 'drag or click to upload'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
          
          <div className="pt-2">
            {isCOD && !isCodEligible && (
              <div className="text-amber-800 bg-amber-50 font-display font-medium text-xs lowercase p-4 rounded-2xl border border-amber-200 mb-4 text-center">
                cash on delivery is only available for orders up to ₹{MAX_COD_AMOUNT}. please choose UPI or reduce items.
              </div>
            )}

            {!isCOD && finalTotal > MAX_UPI_AMOUNT && (
              <div className="text-amber-800 bg-amber-50 font-display font-medium text-xs lowercase p-4 rounded-2xl border border-amber-200 mb-4 text-center">
                the maximum order amount is ₹{MAX_UPI_AMOUNT.toLocaleString('en-IN')} at once. please reduce items in your bag or place separate orders.
              </div>
            )}

            {error && <div className="text-red-500 bg-red-50 font-display font-medium text-xs lowercase p-4 rounded-2xl border border-red-200 mb-4 text-center">{error}</div>}
            
            <button 
              form="checkout-form" 
              type="submit" 
              disabled={loading || isOverLimit} 
              className="w-full py-4 bg-[var(--border-maroon)] text-white font-medium lowercase tracking-wide text-sm rounded-full hover:bg-[var(--text-dominant)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {loading 
                ? 'processing...' 
                : isCOD 
                  ? (isCodEligible ? 'place order (cash on delivery)' : `exceeds ₹${MAX_COD_AMOUNT} COD limit`) 
                  : (finalTotal > MAX_UPI_AMOUNT ? `exceeds ₹${MAX_UPI_AMOUNT} limit` : 'complete order (UPI)')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

