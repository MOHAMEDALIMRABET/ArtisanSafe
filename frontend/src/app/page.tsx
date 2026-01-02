import Link from 'next/link';
import Image from 'next/image';
import { Button, Logo } from '@/components/ui';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] via-[#3D5A73] to-[#2C3E50]">
      {/* Navigation Header */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Logo size="md" />

            {/* Menu de navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#" className="text-[#2C3E50] hover:text-[#FF6B00] font-medium transition-colors">
                Trouver un artisan
              </Link>
              <Link href="#" className="text-[#2C3E50] hover:text-[#FF6B00] font-medium transition-colors">
                Devenir artisan
              </Link>
              <Link href="#" className="text-[#2C3E50] hover:text-[#FF6B00] font-medium transition-colors">
                Comment ça marche
              </Link>
            </div>

            {/* Boutons Connexion/Inscription */}
            <div className="flex items-center gap-3">
              <Link href="/connexion">
                <button className="text-[#2C3E50] hover:text-[#FF6B00] font-medium px-4 py-2 rounded-lg transition-colors">
                  Connexion
                </button>
              </Link>
              <Link href="/inscription">
                <button className="bg-[#FF6B00] text-white hover:bg-[#E56100] px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg">
                  Inscription
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section avec Bannière de Recherche */}
      <div className="container mx-auto px-4 py-16">
        {/* Bannière principale avec image de fond */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-16 h-[500px]">
          {/* Image de fond */}
          <div className="absolute inset-0">
            <Image 
              src="/images/artisan-banner.png" 
              alt="Artisans au travail - BTP" 
              fill
              className="object-cover"
              priority
            />
            {/* Overlay gradient pour lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2C3E50]/90 via-[#2C3E50]/70 to-[#FF6B00]/80"></div>
          </div>

          <div className="relative z-10 py-12 px-6 md:px-12 h-full flex flex-col justify-center">
            {/* Slogan accrocheur */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 text-center drop-shadow-lg">
              Vous avez vos projets, on a vos artisans.
            </h1>
            <p className="text-center text-white text-lg mb-8 drop-shadow-md">
              Trouvez le bon artisan pour vos travaux, en toute confiance
            </p>

            {/* Formulaire de recherche */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-4">
              <div className="grid md:grid-cols-4 gap-3">
                {/* Type de travaux */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Type de travaux
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-4 py-3 hover:bg-[#E9ECEF] transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <select className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium cursor-pointer">
                      <option>Plomberie</option>
                      <option>Électricité</option>
                      <option>Menuiserie</option>
                      <option>Maçonnerie</option>
                      <option>Peinture</option>
                      <option>Chauffage</option>
                    </select>
                  </div>
                </div>

                {/* Ville */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Localisation
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-4 py-3 hover:bg-[#E9ECEF] transition-colors">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="Paris, Lyon..." 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                    />
                  </div>
                </div>

                {/* Date souhaitée */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#6C757D] mb-1 ml-3">
                    Date souhaitée
                  </label>
                  <div className="flex items-center bg-[#F8F9FA] rounded-xl px-4 py-3 hover:bg-[#E9ECEF] transition-colors">
                    <svg className="w-5 h-5 text-[#FF6B00] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input 
                      type="text" 
                      placeholder="Dès que possible" 
                      className="bg-transparent border-none outline-none w-full text-[#2C3E50] font-medium placeholder-[#95A5A6]"
                    />
                  </div>
                </div>

                {/* Bouton Rechercher */}
                <button className="bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold rounded-xl px-6 py-3 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-6 md:mt-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden md:inline">Rechercher</span>
                </button>
              </div>
            </div>
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
              Tous nos artisans sont vérifiés (Pièce d'identité, Statut de l'entreprise) pour votre sécurité
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

        {/* CTA Double - Artisans et Particuliers */}
        <div className="mt-20 grid md:grid-cols-2 gap-6">
          {/* CTA Particuliers */}
          <div className="bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] rounded-2xl p-8 md:p-12 text-white">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Vous êtes particulier ?
              </h2>
              <p className="text-lg mb-6 text-[#E9ECEF]">
                Trouvez le bon artisan pour vos travaux. Comparez les devis et choisissez en toute confiance.
              </p>
              <Link href="/inscription?role=client">
                <button className="bg-white text-[#2C3E50] hover:bg-[#E9ECEF] hover:text-[#1A3A5C] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                  Créer mon profil particulier
                </button>
              </Link>
            </div>
          </div>

          {/* CTA Artisans */}
          <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] rounded-2xl p-8 md:p-12 text-white">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Vous êtes artisan ?
              </h2>
              <p className="text-lg mb-6 text-orange-100">
                Rejoignez notre plateforme et développez votre activité. 
                Inscription gratuite, commission uniquement sur les prestations réalisées.
              </p>
              <Link href="/inscription?role=artisan">
                <button className="bg-white text-[#FF6B00] hover:bg-[#E9ECEF] hover:text-[#E56100] px-6 py-3 text-lg font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                  Créer mon profil artisan
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
