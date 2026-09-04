export type CollectionType = 'women' | 'men';

export interface ProductVariant {
  id: string;
  name: string; // e.g., 'sz 6', 'sz 7', '18"', '20"', 'small', 'medium'
  inStock: boolean;
  stock: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  description?: string;
  oldSlug?: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  collection: 'women' | 'men' | 'both';
  category: string; // e.g., 'jewelry', 'ceramics', 'apparel', 'editorial', or custom category
  price: number;
  description: string;
  details: string[];
  mainImage: string;
  lifestyleImage: string;
  galleryImages?: string[];
  imageFit?: 'cover' | 'contain';
  variants: ProductVariant[];
  stock_count?: number;
  isFeatured?: boolean;
  hasVictorianFrame?: boolean;
  material: string;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  selectedVariant: ProductVariant;
  quantity: number;
}

export interface LookbookStory {
  id: string;
  title: string;
  subtitle: string;
  quote: string;
  image: string;
  songTitle?: string;
  artist?: string;
  audioUrl?: string;
}
