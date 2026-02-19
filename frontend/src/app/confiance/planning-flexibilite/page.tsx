'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export default function PlanningFlexibilitePage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#17A2B8] to-[#138496] text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <span className="text-[#FFC107] text-4xl">📅</span>
            </div>
            <h1 className="text-5xl font-bold mb-6">Planning flexible et transparent</h1>
            <p className="text-xl text-blue-50">
              Trouvez l'artisan disponible exactement quand VOUS le souhaitez
            </p>
          </div>
        </div>
      </div>

      {/* Avantages */}
      <div className="container mx-auto px-4 -mt-10 relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#28A745]">
            <div className="text-3xl mb-3">⏱️</div>
            <h3 className="font-bold text-[#2C3E50] mb-2">Temps réel</h3>
            <p className="text-sm text-[#6C757D]">Disponibilités mises à jour instantanément</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#FF6B00]">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-bold text-[#2C3E50] mb-2">Flexibilité</h3>
            <p className="text-sm text-[#6C757D]">Recherche ±7 jours autour de votre date</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#17A2B8]">
            <div className="text-3xl mb-3">✅</div>
            <h3 className="font-bold text-[#2C3E50] mb-2">Confirmation</h3>
            <p className="text-sm text-[#6C757D]">Validation instantanée de la date de démarrage</p>
          </div>
        </div>
      </div>

      {/* Comment ça marche */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-4">
            Comment fonctionne le système de disponibilités ?
          </h2>
          <p className="text-center text-[#6C757D] mb-12 max-w-2xl mx-auto">
            Un système intelligent pour matcher vos besoins avec la disponibilité réelle des artisans
          </p>

          <div className="space-y-8">
            {/* Côté client */}
            <div className="bg-gradient-to-r from-[#2C3E50] to-[#1A3A5C] rounded-xl shadow-lg p-8 text-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center text-3xl">
                  👤
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Côté client</h3>
                  <p className="text-blue-100">Recherche simplifiée et intelligent</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">1. Indiquez votre date souhaitée</p>
                  <p className="text-sm text-blue-100">
                    Sélectionnez la date idéale pour le début des travaux dans le formulaire de recherche.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">2. Ajustez la flexibilité</p>
                  <p className="text-sm text-blue-100">
                    Choisissez votre marge de flexibilité : ±0, ±1, ±3, ±7 ou ±14 jours.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">3. Recevez les artisans disponibles</p>
                  <p className="text-sm text-blue-100">
                    Seuls les artisans réellement disponibles dans votre créneau apparaissent.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">4. Confirmez la date dans le devis</p>
                  <p className="text-sm text-blue-100">
                    En signant le devis, vous validez la date de début des travaux avec l'artisan.
                  </p>
                </div>
              </div>
            </div>

            {/* Côté artisan */}
            <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] rounded-xl shadow-lg p-8 text-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white text-[#FF6B00] rounded-full flex items-center justify-center text-3xl">
                  🛠️
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Côté artisan</h3>
                  <p className="text-orange-100">Gestion autonome du calendrier</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">1. Calendrier personnel</p>
                  <p className="text-sm text-orange-100">
                    L'artisan gère ses disponibilités via un calendrier interactif dans son dashboard.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">2. Blocage de dates</p>
                  <p className="text-sm text-orange-100">
                    Il peut bloquer des périodes (congés, chantiers en cours, jours fériés).
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">3. Mise à jour temps réel</p>
                  <p className="text-sm text-orange-100">
                    Les disponibilités sont synchronisées instantanément avec le moteur de recherche.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="font-semibold mb-2 text-[#FFC107]">4. Réservation automatique</p>
                  <p className="text-sm text-orange-100">
                    Quand un devis est signé, les dates sont automatiquement bloquées dans son agenda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exemple concret */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-12">
              Exemple concret : Réparation fuite plomberie
            </h2>

            <div className="bg-[#F5F7FA] rounded-xl p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <p className="font-semibold text-[#2C3E50] mb-1">Vous cherchez un plombier pour le 15 mars</p>
                  <p className="text-[#6C757D] text-sm">Vous êtes flexible ±3 jours (du 12 au 18 mars)</p>
                </div>
              </div>

              <div className="border-l-4 border-[#E9ECEF] ml-5 pl-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-[#2C3E50] mb-1">Le système analyse les disponibilités</p>
                    <div className="bg-white rounded-lg p-4 mt-2 border border-[#E9ECEF]">
                      <p className="text-sm text-[#6C757D] mb-2">Résultats :</p>
                      <ul className="text-sm space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-[#DC3545] rounded-full"></span>
                          <span className="line-through text-[#6C757D]">Plombier A : Indisponible (chantier 12-20 mars)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-[#28A745] rounded-full"></span>
                          <strong className="text-[#28A745]">Plombier B : Disponible du 14 au 16 mars ✓</strong>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-[#28A745] rounded-full"></span>
                          <strong className="text-[#28A745]">Plombier C : Disponible du 15 au 18 mars ✓</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-[#2C3E50] mb-1">Vous comparez les 2 devis reçus</p>
                    <p className="text-[#6C757D] text-sm">Plombier B et Plombier C vous envoient leur proposition</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-[#28A745] text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-[#2C3E50] mb-1">Vous choisissez Plombier C pour le 15 mars</p>
                    <div className="bg-[#E8F5E9] border-l-4 border-[#28A745] p-3 rounded mt-2">
                      <p className="text-sm text-[#28A745]">
                        ✅ <strong>Date confirmée :</strong> Le 15 mars est automatiquement bloqué dans l'agenda
                        du plombier C. Il ne pourra plus recevoir de demandes pour cette date.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Avantages du système */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-12">
            Les avantages du planning flexible
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#E8F5E9] text-[#28A745] rounded-full flex items-center justify-center text-2xl">
                  👍
                </div>
                <h3 className="text-xl font-bold text-[#2C3E50]">Pour vous (client)</h3>
              </div>
              <ul className="space-y-3 text-[#6C757D]">
                <li className="flex items-start gap-2">
                  <span className="text-[#28A745] font-bold mt-1">✓</span>
                  <span>Gagnez du temps : pas de multiples appels pour vérifier les disponibilités</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#28A745] font-bold mt-1">✓</span>
                  <span>Évitez les faux espoirs : si l'artisan apparaît, il est réellement disponible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#28A745] font-bold mt-1">✓</span>
                  <span>Planifiez sereinement : confirmation instantanée de la date</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#28A745] font-bold mt-1">✓</span>
                  <span>Réduisez l'attente : trouvez un artisan même pour des interventions rapides</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#FFF3E0] text-[#FF6B00] rounded-full flex items-center justify-center text-2xl">
                  🛠️
                </div>
                <h3 className="text-xl font-bold text-[#2C3E50]">Pour l'artisan</h3>
              </div>
              <ul className="space-y-3 text-[#6C757D]">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B00] font-bold mt-1">✓</span>
                  <span>Optimisez le planning : remplissage automatique des créneaux libres</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B00] font-bold mt-1">✓</span>
                  <span>Évitez les doublons : pas de double réservation possible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B00] font-bold mt-1">✓</span>
                  <span>Gérez facilement : mise à jour en quelques clics depuis le dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B00] font-bold mt-1">✓</span>
                  <span>Réduisez les appels : moins d'interruptions pendant les chantiers</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-12">
              Questions fréquentes
            </h2>

            <div className="space-y-6">
              <details className="bg-[#F5F7FA] rounded-lg p-6 cursor-pointer group">
                <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                  Que se passe-t-il si l'artisan n'est plus disponible après avoir envoyé un devis ?
                  <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                  L'artisan s'engage à <strong>mettre à jour ses disponibilités en temps réel</strong>. Si après envoi
                  du devis il bloque la date, vous en êtes informé immédiatement. Dans ce cas, vous pouvez demander
                  une nouvelle date ou chercher un autre artisan.
                </p>
              </details>

              <details className="bg-[#F5F7FA] rounded-lg p-6 cursor-pointer group">
                <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                  Puis-je modifier la date après signature du devis ?
                  <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                  Oui, mais uniquement <strong>d'un commun accord avec l'artisan</strong>. Contactez-le via la messagerie
                  pour discuter d'une nouvelle date. Si l'artisan accepte, il devra créer une variante du devis avec la
                  nouvelle date, que vous devrez re-signer.
                </p>
              </details>

              <details className="bg-[#F5F7FA] rounded-lg p-6 cursor-pointer group">
                <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                  Comment l'artisan est-il notifié quand je signe ?
                  <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
                </summary>
                <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                  Dès signature, l'artisan reçoit une <strong>notification en temps réel</strong> (bell icon + email).
                  La date est automatiquement bloquée dans son calendrier pour éviter les doubles réservations.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Trouvez un artisan disponible maintenant</h2>
          <p className="text-white/90 mb-6 text-lg">
            Recherche intelligente avec disponibilités en temps réel
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/">
              <Button className="!bg-white !text-[#FF6B00] hover:!bg-gray-100 px-8 py-3 text-lg font-semibold">
                Lancer une recherche
              </Button>
            </Link>
            <Link href="/confiance/avis-certifies">
              <Button className="bg-[#2C3E50] text-white hover:bg-[#1A3A5C] px-8 py-3 text-lg font-semibold">
                Voir les autres garanties →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
