export interface UserBase {
  uid: string;
  email: string;
  role: 'client' | 'artisan';
  firstName: string;
  lastName: string;
  phone?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client extends UserBase {
  role: 'client';
  savedArtisans?: string[]; // UIDs des artisans favoris
  activeDevis?: string[]; // IDs des devis actifs
}

export interface Artisan extends UserBase {
  role: 'artisan';
  businessName: string;
  metiers: string[]; // ['plomberie', 'électricité', etc.]
  description: string;
  location: {
    address: string;
    city: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  verified: boolean;
  rating: number;
  reviewCount: number;
  availability: boolean;
  portfolio: PortfolioItem[];
  certifications?: string[]; // URLs des certificats
  siret?: string;
  insurance?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
  };
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  images: string[]; // URLs Cloudinary/Firebase Storage
  metier: string;
  completedAt: Date;
}

export interface Devis {
  id: string;
  clientId: string;
  artisanId: string;
  metier: string;
  title: string;
  description: string;
  status: 'pending' | 'quoted' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  clientLocation?: {
    address: string;
    city: string;
    postalCode: string;
  };
  estimatedPrice?: number;
  estimatedDuration?: string;
  artisanResponse?: {
    price: number;
    duration: string;
    notes: string;
    respondedAt: Date;
  };
  scheduledDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Avis {
  id: string;
  artisanId: string;
  clientId: string;
  devisId: string;
  rating: number; // 1-5
  comment: string;
  response?: {
    message: string;
    respondedAt: Date;
  };
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participants: {
    clientId: string;
    artisanId: string;
  };
  devisId?: string;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
