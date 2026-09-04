import fs from 'fs';
import path from 'path';

// Standard RFC 4180 compliant CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [];
        }
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [];
        }
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function safeJSON(str: string, fallback: any) {
  if (!str) return fallback;
  const trimmed = str.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    try {
      // try unescaping if needed
      return JSON.parse(trimmed.replace(/""/g, '"'));
    } catch {
      return fallback;
    }
  }
}

async function run() {
  const csvPath = path.join(process.cwd(), 'products_input.csv');
  const csvRaw = fs.readFileSync(csvPath, 'utf8');

  const rows = parseCSV(csvRaw);
  if (rows.length < 2) {
    console.error("No product rows found in CSV");
    return;
  }

  const header = rows[0].map(h => h.trim());
  console.log("Header columns:", header);

  const products: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5 || !row.some(cell => cell.trim().length > 0)) continue;

    const rowObj: Record<string, string> = {};
    header.forEach((col, idx) => {
      rowObj[col] = row[idx] !== undefined ? row[idx] : '';
    });

    const title = (rowObj['title'] || '').trim();
    let id = (rowObj['id'] || '').trim();
    let slug = (rowObj['slug'] || '').trim();

    if (!slug) {
      slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prod-${Date.now()}`;
    }
    if (!id) {
      id = slug;
    }

    const price = Number(rowObj['price']) || 0;
    const collection = (rowObj['collection'] || 'women').trim().toLowerCase();
    const category = (rowObj['category'] || 'jewelry').trim().toLowerCase();
    const description = (rowObj['description'] || '').trim();
    const material = (rowObj['material'] || '').trim();
    const isFeatured = String(rowObj['isFeatured']).toLowerCase() === 'true';
    const hasVictorianFrame = String(rowObj['hasVictorianFrame']).toLowerCase() === 'true';
    const stock_count = Number(rowObj['stock_count']) || 0;
    const imageFit = (rowObj['imageFit'] || 'cover').trim().toLowerCase() as 'cover' | 'contain';

    const details = safeJSON(rowObj['details'], []);
    const galleryImages = safeJSON(rowObj['galleryImages'], []);
    let variants = safeJSON(rowObj['variants'], [
      { id: 'v1', name: 'Free size', stock: stock_count, inStock: stock_count > 0 }
    ]);

    // Ensure variants have proper fields
    variants = variants.map((v: any, vIdx: number) => ({
      id: v.id || `v-${vIdx + 1}`,
      name: v.name || 'Free size',
      stock: typeof v.stock === 'number' ? v.stock : (v.inStock !== false ? 1 : 0),
      inStock: v.inStock !== undefined ? !!v.inStock : ((v.stock || 0) > 0)
    }));

    const product = {
      id,
      slug,
      title: title.toLowerCase(), // keep stylish lowercase per studio aesthetic
      collection: (collection === 'men' || collection === 'women' || collection === 'both') ? collection : 'women',
      category,
      price,
      description,
      details: Array.isArray(details) ? details : [details].filter(Boolean),
      mainImage: (rowObj['mainImage'] || '').trim(),
      lifestyleImage: (rowObj['lifestyleImage'] || (rowObj['mainImage'] || '')).trim(),
      galleryImages: Array.isArray(galleryImages) ? galleryImages : [],
      imageFit,
      variants,
      stock_count,
      isFeatured,
      hasVictorianFrame,
      material,
      created_at: rowObj['created_at'] || new Date().toISOString(),
      updated_at: rowObj['updated_at'] || new Date().toISOString()
    };

    products.push(product);
  }

  console.log(`Parsed ${products.length} products successfully.`);

  // 1. Write to src/data/products.ts
  const tsContent = `// Auto-generated Matilda Studio Products Catalog
import { Product } from '../types';

export const PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};
`;

  fs.writeFileSync(path.join(process.cwd(), 'src', 'data', 'products.ts'), tsContent, 'utf8');
  console.log("Updated src/data/products.ts with new product catalog!");

  // 2. Also write a JSON file for easy backend reference
  fs.writeFileSync(path.join(process.cwd(), 'src', 'data', 'products.json'), JSON.stringify(products, null, 2), 'utf8');

  // 3. Push to Google Cloud Firestore if credentials are configured
  const projectId = process.env.FIREBASE_PROJECT_ID || 
                    process.env.VITE_FIREBASE_PROJECT_ID || 
                    process.env.GOOGLE_CLOUD_PROJECT || 
                    '';

  console.log(`Checking Firestore sync (Project ID: ${projectId || 'not set'})...`);

  if (projectId) {
    try {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');

      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || ''
      };

      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = getFirestore(app);

      console.log(`Pushing ${products.length} products to Firestore collection 'products'...`);
      for (const p of products) {
        await setDoc(doc(db, 'products', p.id), p, { merge: true });
        console.log(` ✓ Synced: ${p.title} (${p.id})`);
      }
      console.log(" Successfully pushed all products to Firestore!");
    } catch (fsErr) {
      console.warn("Notice: Firestore push encountered an issue (check credentials):", fsErr);
    }
  } else {
    console.log("Notice: No FIREBASE_PROJECT_ID is currently in environment. Products saved to local database & ready to push to Firestore whenever credentials are provided.");
  }
}

run().catch(console.error);
