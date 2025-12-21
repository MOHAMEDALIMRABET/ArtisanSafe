export interface User {
  id: string;
  email: string;
  role: 'client' | 'artisan';
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: Date;
}

export interface Artisan extends User {
  role: 'artisan';
  businessName: string;
  metiers: string[]; // plomberie, électricité, menuiserie, maçonnerie
  description: string;
  location: {
    address: string;
    city: string;
    postalCode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  portfolio: PortfolioItem[];
  verified: boolean;
  rating?: number;
  reviewCount: number;
  availability: boolean;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  images: string[];
  completedAt: Date;
}

export interface Devis {
  id: string;
  clientId: string;
  artisanId: string;
  metier: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  estimatedPrice?: number;
  estimatedDuration?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Avis {
  id: string;
  artisanId: string;
  clientId: string;
  devisId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
