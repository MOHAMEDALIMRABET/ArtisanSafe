'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export default function CommentCaMarchePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">Comment ça marche ?</h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            ArtisanDispo connecte les particuliers avec des artisans qualifiés et vérifiés en 3 étapes simples
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Pour les Particuliers */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#2C3E50] mb-4">
              👤 Vous êtes particulier ?
            </h2>
            <p className="text-xl text-[#6C757D]">
              Trouvez et contactez des artisans en quelques clics
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Étape 1 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#FF6B00] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                🔍 Recherchez
              </h3>
              <p className="text-[#6C757D] mb-4">
                Décrivez votre projet : type de travaux, localisation, date souhaitée.
              </p>
              <div className="bg-[#FFF3E0] p-4 rounded-lg text-sm text-left">
                <p className="font-semibold text-[#FF6B00] mb-2">Exemple :</p>
                <p className="text-[#6C757D]">
                  "Rénovation de salle de bain à Paris, début février, budget 5000-8000€"
                </p>
              </div>
            </Card>

            {/* Étape 2 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#FF6B00] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                📋 Comparez
              </h3>
              <p className="text-[#6C757D] mb-4">
                Recevez plusieurs devis détaillés d'artisans vérifiés et disponibles.
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-[#28A745]">
                  <span>✓</span>
                  <span>Profils vérifiés (SIRET, assurances)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#28A745]">
                  <span>✓</span>
                  <span>Avis clients authentiques</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#28A745]">
                  <span>✓</span>
                  <span>Disponibilité en temps réel</span>
                </div>
              </div>
            </Card>

            {/* Étape 3 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#FF6B00] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                🤝 Contractez
              </h3>
              <p className="text-[#6C757D] mb-4">
                Acceptez un devis et suivez l'avancement de vos travaux en toute sérénité.
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-[#17A2B8]">
                  <span>🔒</span>
                  <span>Paiement sécurisé</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#17A2B8]">
                  <span>💬</span>
                  <span>Messagerie intégrée</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#17A2B8]">
                  <span>⭐</span>
                  <span>Laissez un avis après travaux</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Button
              onClick={() => router.push('/inscription?role=client')}
              className="bg-[#FF6B00] hover:bg-[#E56100] text-white text-lg px-8 py-4"
            >
              Créer mon compte particulier
            </Button>
          </div>
        </section>

        {/* Séparateur */}
        <div className="border-t-2 border-[#E9ECEF] my-16"></div>

        {/* Pour les Artisans */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#2C3E50] mb-4">
              👷 Vous êtes artisan ?
            </h2>
            <p className="text-xl text-[#6C757D]">
              Développez votre activité et trouvez de nouveaux chantiers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Étape 1 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#2C3E50] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                📝 Inscrivez-vous
              </h3>
              <p className="text-[#6C757D] mb-4">
                Créez votre profil professionnel en quelques minutes.
              </p>
              <div className="space-y-2 text-left text-sm">
                <p className="text-[#6C757D]">• Renseignez vos métiers et zones d'intervention</p>
                <p className="text-[#6C757D]">• Ajoutez vos certifications (SIRET, assurances)</p>
                <p className="text-[#6C757D]">• Présentez votre entreprise et vos réalisations</p>
              </div>
            </Card>

            {/* Étape 2 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#2C3E50] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                🔔 Recevez des demandes
              </h3>
              <p className="text-[#6C757D] mb-4">
                Soyez alerté des projets qui correspondent à votre profil.
              </p>
              <div className="bg-[#E3F2FD] p-4 rounded-lg text-left">
                <p className="text-sm text-[#17A2B8] font-semibold mb-2">Matching intelligent :</p>
                <p className="text-sm text-[#6C757D]">
                  Notre algorithme sélectionne les demandes selon vos compétences, disponibilités et zone géographique.
                </p>
              </div>
            </Card>

            {/* Étape 3 */}
            <Card className="p-8 text-center hover:shadow-xl transition-shadow">
              <div className="bg-[#2C3E50] text-white rounded-full w-20 h-20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold text-[#2C3E50] mb-4">
                💼 Envoyez des devis
              </h3>
              <p className="text-[#6C757D] mb-4">
                Répondez aux demandes et gérez vos chantiers depuis votre espace.
              </p>
              <div className="space-y-2 text-left text-sm">
                <p className="text-[#28A745]">✓ Outil de création de devis intégré</p>
                <p className="text-[#28A745]">✓ Gestion de planning et disponibilités</p>
                <p className="text-[#28A745]">✓ Paiements sécurisés et rapides</p>
              </div>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Button
              onClick={() => router.push('/inscription?role=artisan')}
              className="bg-[#2C3E50] hover:bg-[#1A3A5C] text-white text-lg px-8 py-4"
            >
              Créer mon profil artisan
            </Button>
          </div>
        </section>

        {/* Avantages de la plateforme */}
        <section className="bg-gradient-to-r from-[#2C3E50] to-[#3D5A73] rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold text-center mb-10">
            🛡️ Pourquoi choisir ArtisanDispo ?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-5xl mb-3">✓</div>
              <h3 className="font-bold mb-2">Artisans vérifiés</h3>
              <p className="text-sm text-gray-300">
                Tous les artisans sont vérifiés (SIRET, assurances, qualifications)
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-3">🔒</div>
              <h3 className="font-bold mb-2">Paiement sécurisé</h3>
              <p className="text-sm text-gray-300">
                Système de paiement protégé avec libération sur validation des travaux
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-3">⚖️</div>
              <h3 className="font-bold mb-2">Médiation en cas de litige</h3>
              <p className="text-sm text-gray-300">
                Service de médiation pour résoudre les différends équitablement
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-3">⭐</div>
              <h3 className="font-bold mb-2">Avis authentiques</h3>
              <p className="text-sm text-gray-300">
                Système d'avis vérifiés après chaque prestation
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-10">
            ❓ Questions fréquentes
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <Card className="p-6">
              <h3 className="font-bold text-[#2C3E50] mb-2">
                L'inscription est-elle gratuite ?
              </h3>
              <p className="text-[#6C757D]">
                Oui, l'inscription est 100% gratuite pour les particuliers et les artisans. 
                Aucun abonnement n'est requis.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-[#2C3E50] mb-2">
                Comment sont vérifiés les artisans ?
              </h3>
              <p className="text-[#6C757D]">
                Nous vérifions le SIRET, les assurances professionnelles et décennales, 
                ainsi que les qualifications de chaque artisan avant validation du profil.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-[#2C3E50] mb-2">
                Combien coûte le service ?
              </h3>
              <p className="text-[#6C757D]">
                Pour les particuliers : 0€, la mise en relation est gratuite. 
                Pour les artisans : une petite commission uniquement sur les prestations réalisées.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-[#2C3E50] mb-2">
                Que faire en cas de litige ?
              </h3>
              <p className="text-[#6C757D]">
                Notre service de médiation intervient gratuitement pour trouver une solution 
                équitable entre le client et l'artisan.
              </p>
            </Card>
          </div>
        </section>

        {/* CTA Final */}
        <section className="mt-20 text-center">
          <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] rounded-2xl p-12 text-white">
            <h2 className="text-4xl font-bold mb-4">
              Prêt à commencer ?
            </h2>
            <p className="text-xl mb-8 text-orange-100">
              Rejoignez des milliers d'utilisateurs satisfaits
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => router.push('/inscription?role=client')}
                className="!bg-white !text-[#FF6B00] hover:!bg-gray-100 text-lg px-8 py-4"
              >
                Je suis particulier
              </Button>
              <Button
                onClick={() => router.push('/inscription?role=artisan')}
                className="!border-2 !border-white !bg-transparent !text-white hover:!bg-white hover:!text-[#FF6B00] text-lg px-8 py-4"
              >
                Je suis artisan
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#2C3E50] text-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2026 ArtisanDispo - Tous droits réservés
          </p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/cgu" className="text-gray-400 hover:text-white transition-colors">
              CGU
            </Link>
            <Link href="/mentions-legales" className="text-gray-400 hover:text-white transition-colors">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="text-gray-400 hover:text-white transition-colors">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
