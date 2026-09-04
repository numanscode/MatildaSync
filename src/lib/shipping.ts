/**
 * Shipping & Courier Calculation Engine
 * Origin Pincode: 193101 (Baramulla / Sopore, Jammu & Kashmir)
 * Courier Partner: Delhivery
 * Rule: Calculated base courier rate according to destination zone/distance + ₹10 markup, rounded to whole rupees.
 * Reference: 193101 -> 190001 (Srinagar) = ₹40 rounded (₹30 base + ₹10).
 */

export interface PincodeInfo {
  success: boolean;
  pincode: string;
  city: string;
  district: string;
  state: string;
  postOffice?: string;
}

export interface ShippingCalculation {
  baseRate: number;
  deliveryFee: number; // baseRate + 10 rounded
  zone: string;
  zoneLabel: string;
  estimatedDays: string;
  origin: string;
  destinationText: string;
}

const ORIGIN_PINCODE = '193101';

// In-memory cache for pincode lookup to maximize speed & reduce internet requests
const pincodeCache = new Map<string, PincodeInfo>();

/**
 * Fetch free postal details from India Post API
 */
export async function lookupPincode(pincode: string): Promise<PincodeInfo | null> {
  const cleanPin = pincode.replace(/\D/g, '').trim();
  if (cleanPin.length !== 6) return null;

  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin)!;
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (!res.ok) throw new Error('Failed to fetch postal data');
    const data = await res.json();

    if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const info: PincodeInfo = {
        success: true,
        pincode: cleanPin,
        city: po.District || po.Block || po.Circle || '',
        district: po.District || '',
        state: po.State || '',
        postOffice: po.Name || '',
      };
      pincodeCache.set(cleanPin, info);
      return info;
    }
  } catch (err) {
    console.warn('Pincode lookup error:', err);
  }

  return null;
}

/**
 * Calculate Delhivery shipping based on origin 193101 to destination pincode / state
 */
export function calculateDelhiveryShipping(pincode: string, stateName?: string, districtName?: string): ShippingCalculation {
  const cleanPin = (pincode || '').replace(/\D/g, '').trim();
  const prefix2 = cleanPin.slice(0, 2);
  const prefix3 = cleanPin.slice(0, 3);
  const stateLower = (stateName || '').toLowerCase().trim();

  let baseRate = 50; // default North/Central fallback
  let zone = 'National';
  let zoneLabel = 'Standard National';
  let estimatedDays = '3-5 business days';

  // Zone 1: Local / Intra Jammu & Kashmir & Ladakh (Pincodes 190xxx - 194xxx)
  // Benchmark: 193101 to 190001 (Srinagar) = ₹30 base + ₹10 = ₹40 rounded
  if (
    ['190', '191', '192', '193', '194'].includes(prefix3) ||
    stateLower.includes('jammu') ||
    stateLower.includes('kashmir') ||
    stateLower.includes('ladakh')
  ) {
    baseRate = 30;
    zone = 'Local J&K';
    zoneLabel = 'Local J&K Courier';
    estimatedDays = '1-2 business days';
  }
  // Zone 2: North Zone (Punjab, HP, Chandigarh, Delhi, Haryana) -> Pincodes 11-18
  else if (
    ['11', '12', '13', '14', '15', '16', '17', '18'].includes(prefix2) ||
    ['punjab', 'delhi', 'haryana', 'chandigarh', 'himachal pradesh'].some(s => stateLower.includes(s))
  ) {
    baseRate = 50;
    zone = 'North India';
    zoneLabel = 'North Zone Air/Surface';
    estimatedDays = '2-4 business days';
  }
  // Zone 3: North-Central & West (UP, Uttarakhand, Rajasthan, Gujarat, MP) -> Pincodes 20-34, 38-39, 45-48
  else if (
    ['20', '21', '22', '23', '24', '25', '26', '27', '28', '30', '31', '32', '33', '34', '38', '39', '45', '46', '47', '48'].includes(prefix2) ||
    ['uttar pradesh', 'uttarakhand', 'rajasthan', 'gujarat', 'madhya pradesh'].some(s => stateLower.includes(s))
  ) {
    baseRate = 60;
    zone = 'Western / Central';
    zoneLabel = 'Central & West Express';
    estimatedDays = '3-5 business days';
  }
  // Zone 4: Maharashtra & East (Mumbai, Pune, Kolkata, Bihar, Jharkhand, Odisha, West Bengal) -> Pincodes 40-44, 70-72, 80-85
  else if (
    ['40', '41', '42', '43', '44', '70', '71', '72', '80', '81', '82', '83', '84', '85'].includes(prefix2) ||
    ['maharashtra', 'west bengal', 'bihar', 'jharkhand', 'odisha'].some(s => stateLower.includes(s))
  ) {
    baseRate = 65;
    zone = 'Metros & East';
    zoneLabel = 'Regional Express';
    estimatedDays = '3-5 business days';
  }
  // Zone 5: South India (Karnataka, Tamil Nadu, Telangana, Andhra Pradesh, Kerala, Goa) -> Pincodes 50-69
  else if (
    ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69'].includes(prefix2) ||
    ['karnataka', 'tamil nadu', 'telangana', 'andhra pradesh', 'kerala', 'goa'].some(s => stateLower.includes(s))
  ) {
    baseRate = 75;
    zone = 'South India';
    zoneLabel = 'South Zone Express';
    estimatedDays = '4-6 business days';
  }
  // Zone 6: North-East, Special & Islands (Assam, Meghalaya, Tripura, Manipur, Nagaland, Arunachal, Mizoram, Sikkim, Andaman, Lakshadweep) -> Pincodes 73-79, 744, 682
  else if (
    ['73', '74', '75', '76', '77', '78', '79'].includes(prefix2) ||
    ['assam', 'meghalaya', 'manipur', 'tripura', 'nagaland', 'arunachal pradesh', 'mizoram', 'sikkim', 'andaman', 'lakshadweep'].some(s => stateLower.includes(s))
  ) {
    baseRate = 90;
    zone = 'Special / North-East';
    zoneLabel = 'Special Air Express';
    estimatedDays = '5-7 business days';
  }

  // Delivery fee rule: Base rate + ₹10, rounded to whole rupees
  const deliveryFee = Math.round(baseRate + 10);

  const destinationText = districtName && stateName 
    ? `${districtName}, ${stateName}`
    : stateName || (cleanPin ? `PIN ${cleanPin}` : 'All India');

  return {
    baseRate,
    deliveryFee,
    zone,
    zoneLabel,
    estimatedDays,
    origin: ORIGIN_PINCODE,
    destinationText,
  };
}
