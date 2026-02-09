'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export default function VerificationArtisansPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#28A745] to-[#20833D] text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <span className="text-[#FFC107] text-4xl">✓</span>
            </div>
            <h1 className="text-5xl font-bold mb-6">Artisans rigoureusement vérifiés</h1>
            <p className="text-xl text-green-50">
              Vérification complète avant acceptation sur la plateforme. Zéro tolérance pour les faux profils.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 -mt-10 relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#28A745]">
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">100%</div>
            <p className="text-sm text-[#6C757D] font-semibold">KBIS/SIREN vérifiés</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#FF6B00]">
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">48h</div>
            <p className="text-sm text-[#6C757D] font-semibold">Délai moyen de vérification</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center border-t-4 border-[#DC3545]">
            <div className="text-4xl font-bold text-[#FF6B00] mb-2">32%</div>
            <p className="text-sm text-[#6C757D] font-semibold">Dossiers refusés (qualité max)</p>
          </div>
        </div>
      </div>

      {/* Processus de vérification */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-4">
            Notre processus de vérification en 5 étapes
          </h2>
          <p className="text-center text-[#6C757D] mb-12 max-w-2xl mx-auto">
            Chaque artisan passe par un contrôle rigoureux avant d'être visible sur la plateforme
          </p>

          <div className="space-y-8">
            {/* Étape 1 */}
            <div className="bg-white rounded-xl shadow-md p-6 flex gap-6 items-start hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  1
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#2C3E50] mb-3">📄 Vérification KBIS / SIREN</h3>
                <p className="text-[#6C757D] mb-4">
                  L'artisan doit fournir un <strong>KBIS de moins de 3 mois</strong> (ou extrait D1 pour auto-entrepreneurs).
                </p>
                <div className="bg-[#FFF3E0] border-l-4 border-[#FF6B00] p-4 rounded">
                  <p className="text-sm text-[#2C3E50] mb-2">
                    <strong>Vérification automatique :</strong>
                  </p>
                  <ul className="text-sm text-[#6C757D] space-y-1">
                    <li>✓ Extraction automatique du SIRET via OCR (Tesseract.js)</li>
                    <li>✓ Comparaison SIRET document vs profil déclaré</li>
                    <li>✓ Vérification raison sociale et représentant légal</li>
                    <li>✓ Cross-check avec la base SIRENE (entreprise.data.gouv.fr)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Étape 2 */}
            <div className="bg-white rounded-xl shadow-md p-6 flex gap-6 items-start hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  2
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#2C3E50] mb-3">🪪 Vérification d'identité</h3>
                <p className="text-[#6C757D] mb-4">
                  Pièce d'identité du <strong>représentant légal</strong> (gérant de l'entreprise).
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-[#E8F5E9] border border-[#28A745] p-3 rounded">
                    <p className="text-sm font-semibold text-[#28A745] mb-1">Documents acceptés</p>
                    <ul className="text-xs text-[#6C757D] space-y-0.5">
                      <li>• Carte d'identité (recto/verso)</li>
                      <li>• Passeport</li>
                      <li>• Permis de conduire</li>
                    </ul>
                  </div>
                  <div className="bg-[#E3F2FD] border border-[#17A2B8] p-3 rounded">
                    <p className="text-sm font-semibold text-[#17A2B8] mb-1">Vérifications</p>
                    <ul className="text-xs text-[#6C757D] space-y-0.5">
                      <li>• Nom/prénom vs KBIS</li>
                      <li>• Photo claire et lisible</li>
                      <li>• Document en cours de validité</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Étape 3 */}
            <div className="bg-white rounded-xl shadow-md p-6 flex gap-6 items-start hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#2C3E50] mb-3">🛡️ Assurances professionnelles</h3>
                <p className="text-[#6C757D] mb-4">
                  Vérification des assurances <strong>obligatoires</strong> selon le métier.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-[#FFF3E0] p-3 rounded">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="font-semibold text-[#2C3E50] text-sm">RC Pro (Responsabilité Civile)</p>
                      <p className="text-xs text-[#6C757D]">Obligatoire pour tous les artisans</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-[#E3F2FD] p-3 rounded">
                    <span className="text-2xl">🏗️</span>
                    <div>
                      <p className="font-semibold text-[#2C3E50] text-sm">Garantie Décennale</p>
                      <p className="text-xs text-[#6C757D]">Obligatoire pour gros œuvre & construction</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Étape 4 */}
            <div className="bg-white rounded-xl shadow-md p-6 flex gap-6 items-start hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#FF6B00] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  4
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#2C3E50] mb-3">👨‍💼 Validation manuelle admin</h3>
                <p className="text-[#6C757D] mb-4">
                  Un <strong>administrateur humain</strong> vérifie manuellement chaque dossier.
                </p>
                <div className="bg-[#E8F5E9] border-l-4 border-[#28A745] p-4 rounded">
                  <p className="text-sm text-[#2C3E50] mb-2">
                    <strong>Points de contrôle :</strong>
                  </p>
                  <ul className="text-sm text-[#6C757D] space-y-1">
                    <li>✓ Cohérence des informations (nom, adresse, SIRET)</li>
                    <li>✓ Qualité des documents (lisibles, complets, conformes)</li>
                    <li>✓ Vérification absence d'antécédents (liste noire)</li>
                    <li>✓ Appel téléphonique si doute ou anomalie</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Étape 5 */}
            <div className="bg-gradient-to-r from-[#28A745] to-[#20833D] rounded-xl shadow-lg p-6 flex gap-6 items-start text-white">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-white text-[#28A745] rounded-full flex items-center justify-center font-bold text-xl">
                  5
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-3">✅ Activation du compte</h3>
                <p className="text-green-50 mb-4">
                  Le profil devient <strong>visible</strong> et l'artisan peut recevoir des demandes de devis.
                </p>
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded">
                  <p className="text-sm">
                    🎯 En cas de refus, l'artisan reçoit une explication détaillée et peut soumettre à nouveau son dossier corrigé.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sécurité continue */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-12">
              Une surveillance continue
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#FFF3E0] rounded-xl p-6 border-2 border-[#FF6B00]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#FF6B00] text-white rounded-full flex items-center justify-center text-2xl">
                    🔍
                  </div>
                  <h3 className="text-xl font-bold text-[#2C3E50]">Contrôles périodiques</h3>
                </div>
                <ul className="text-[#6C757D] space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[#28A745] font-bold">✓</span>
                    <span>Renouvellement assurances vérifié annuellement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#28A745] font-bold">✓</span>
                    <span>Vérification activité entreprise (radiations, liquidations)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#28A745] font-bold">✓</span>
                    <span>Surveillance des notes et avis clients</span>
                  </li>
                </ul>
              </div>

              <div className="bg-[#FFEBEE] rounded-xl p-6 border-2 border-[#DC3545]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#DC3545] text-white rounded-full flex items-center justify-center text-2xl">
                    🚫
                  </div>
                  <h3 className="text-xl font-bold text-[#2C3E50]">Suspension automatique</h3>
                </div>
                <ul className="text-[#6C757D] space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[#DC3545] font-bold">✗</span>
                    <span>Assurance expirée → Compte suspendu immédiatement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#DC3545] font-bold">✗</span>
                    <span>Note moyenne &lt; 3/5 après 10 avis → Enquête admin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#DC3545] font-bold">✗</span>
                    <span>Signalement client grave → Suspension préventive</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#2C3E50] mb-12">
            Questions fréquentes
          </h2>

          <div className="space-y-6">
            <details className="bg-[#F8F9FA] rounded-lg p-6 cursor-pointer group">
              <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                Combien de temps prend la vérification ?
                <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                En moyenne <strong>48 heures</strong> après soumission du dossier complet. Si des documents sont manquants 
                ou non conformes, nous contactons l'artisan pour régularisation (délai supplémentaire de 24-72h).
              </p>
            </details>

            <details className="bg-[#F8F9FA] rounded-lg p-6 cursor-pointer group">
              <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                Que se passe-t-il si un artisan fournit de faux documents ?
                <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                <strong>Interdiction définitive</strong> de la plateforme + signalement aux autorités compétentes.
                Nous prenons la fraude très au sérieux et collaborons avec les chambres des métiers pour signaler les cas de faux documents.
              </p>
            </details>

            <details className="bg-[#F8F9FA] rounded-lg p-6 cursor-pointer group">
              <summary className="font-semibold text-[#2C3E50] text-lg list-none flex items-center justify-between">
                Puis-je faire confiance aux artisans vérifiés ?
                <span className="text-2xl text-[#FF6B00] group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="text-[#6C757D] mt-4 pl-4 border-l-4 border-[#FF6B00]">
                Notre processus garantit que l'artisan est bien <strong>légalement déclaré</strong> et <strong>assuré</strong>.
                Cependant, nous recommandons toujours de comparer plusieurs devis et de consulter les avis d'autres clients
                avant de faire votre choix.
              </p>
            </details>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-[#FF6B00] to-[#E56100] py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Trouvez un artisan vérifié près de chez vous</h2>
          <p className="text-white/90 mb-6 text-lg">
            100% des artisans sur ArtisanDispo sont vérifiés et assurés
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/">
              <Button className="bg-white text-[#FF6B00] hover:bg-gray-100 px-8 py-3 text-lg font-semibold">
                Rechercher un artisan
              </Button>
            </Link>
            <Link href="/confiance/planning-flexibilite">
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
