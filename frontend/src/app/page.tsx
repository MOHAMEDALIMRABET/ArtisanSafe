import Link from 'next/link';
import { Button } from '@/components/ui';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] via-[#3D5A73] to-[#2C3E50]">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Trouvez l'artisan parfait pour vos travaux
          </h1>
          <p className="text-xl text-[#E9ECEF] mb-8">
            ArtisanSafe connecte les particuliers avec des artisans qualifiés et vérifiés. 
            Demandez des devis, comparez et choisissez en toute confiance.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Commencer gratuitement
              </Button>
            </Link>
            <Link href="/connexion">
              <button className="w-full sm:w-auto bg-white text-[#2C3E50] hover:bg-[#D1D5DB] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 border-2 border-white shadow-lg hover:shadow-xl">
                Se connecter
              </button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-[#FFC107] rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#2C3E50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[#2C3E50]">Artisans vérifiés</h3>
            <p className="text-gray-600">
              Tous nos artisans sont vérifiés (SIRET, certifications) pour votre sécurité
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Devis gratuits</h3>
            <p className="text-gray-600">
              Recevez et comparez plusieurs devis sans engagement de votre part
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="w-12 h-12 bg-[#28A745] rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Avis clients</h3>
            <p className="text-gray-600">
              Consultez les avis authentiques des clients pour faire le bon choix
            </p>
          </div>
        </div>

        {/* CTA for Artisans */}
        <div className="mt-20 bg-gradient-to-r from-[#FF6B00] to-[#E56100] rounded-2xl p-8 md:p-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Vous êtes artisan ?
            </h2>
            <p className="text-lg mb-6 text-orange-100">
              Rejoignez notre plateforme et développez votre activité. 
              Inscription gratuite, commission uniquement sur les prestations réalisées.
            </p>
            <Link href="/inscription">
              <button className="bg-white text-[#FF6B00] hover:bg-[#E9ECEF] hover:text-[#E56100] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                Créer mon profil artisan
              </button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">1000+</div>
            <div className="text-white">Artisans</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">5000+</div>
            <div className="text-white">Clients satisfaits</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">10k+</div>
            <div className="text-white">Prestations</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">4.8/5</div>
            <div className="text-white">Note moyenne</div>
          </div>
        </div>
      </div>
    </div>
  );
}
