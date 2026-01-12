'use client';

/**
 * Page de visualisation d'un devis
 * Affiche le détail complet d'un devis avec possibilité d'édition
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { dupliquerDevis } from '@/lib/firebase/devis-service';
import { Logo } from '@/components/ui';
import type { Devis } from '@/types/devis';
import Head from 'next/head';

export default function VoirDevisPage() {
  const router = useRouter();
  const params = useParams();
  const devisId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(true);
  const [duplicationEnCours, setDuplicationEnCours] = useState(false);

  const loadDevis = async () => {
    if (!devisId) return;

    try {
      const docRef = doc(db, 'devis', devisId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setDevis({
          id: docSnap.id,
          ...docSnap.data(),
        } as Devis);
      } else {
        alert('Devis introuvable');
        router.push('/artisan/devis');
      }
    } catch (error) {
      console.error('Erreur chargement devis:', error);
      alert('Erreur lors du chargement du devis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !devisId) return;
    loadDevis();
  }, [user, devisId]);

  // Modifier le titre de la page pour l'impression
  useEffect(() => {
    if (devis) {
      document.title = `Devis ${devis.numeroDevis}`;
    }
    return () => {
      document.title = 'ArtisanDispo - Trouvez des artisans qualifiés';
    };
  }, [devis]);

  const handleDupliquerDevis = async () => {
    if (!devis) return;

    if (!confirm('Voulez-vous créer un nouveau devis basé sur ce devis refusé ?')) {
      return;
    }

    try {
      setDuplicationEnCours(true);
      const nouveauDevisId = await dupliquerDevis(devis.id);
      alert('✅ Nouveau devis créé avec succès !');
      router.push(`/artisan/devis/nouveau?demandeId=${devis.demandeId}&editId=${nouveauDevisId}`);
    } catch (error) {
      console.error('Erreur duplication devis:', error);
      alert('❌ Erreur lors de la création du nouveau devis');
    } finally {
      setDuplicationEnCours(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const styles: { [key: string]: string } = {
      brouillon: 'bg-gray-100 text-gray-800',
      envoye: 'bg-blue-100 text-blue-800',
      accepte: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
      expire: 'bg-orange-100 text-orange-800',
    };

    const labels: { [key: string]: string } = {
      brouillon: '📝 Brouillon',
      envoye: '📤 Envoyé',
      accepte: '✅ Accepté',
      refuse: '❌ Refusé',
      expire: '⏰ Expiré',
    };

    return (
      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${styles[statut] || 'bg-gray-100 text-gray-800'}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (!user || !devis) {
    return null;
  }

  return (
    <>
      {/* Styles pour l'impression */}
      <style jsx global>{`
        @media print {
          /* Configuration de la page - MARGIN 0 pour supprimer URL/pagination */
          @page {
            margin: 0;
            size: A4 portrait;
          }
          
          /* Masquer la navigation et boutons */
          .no-print {
            display: none !important;
          }
          
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Page container */
          .min-h-screen {
            background: white !important;
            min-height: auto !important;
          }
          
          /* Container du devis - AJOUTER PADDING pour compenser margin 0 */
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm 15mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          
          /* Éviter les coupures de page */
          table {
            page-break-inside: avoid;
          }
          
          tr {
            page-break-inside: avoid;
          }
          
          /* Enlever ombres et bordures arrondies */
          .shadow-md, .rounded-lg {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          
          /* Forcer fond blanc */
          .bg-\\[\\#F8F9FA\\], .bg-gray-50, .bg-blue-50, .bg-red-50 {
            background: white !important;
            padding: 10px !important;
          }
          
          /* Garder les couleurs importantes */
          .bg-\\[\\#2C3E50\\] {
            background: #2C3E50 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .text-\\[\\#FF6B00\\] {
            color: #FF6B00 !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .text-\\[\\#2C3E50\\] {
            color: #2C3E50 !important;
          }
          
          /* Bordures des tableaux */
          table, td, th {
            border-color: #000 !important;
          }
          
          /* Images et logos */
          img {
            max-width: 100% !important;
            height: auto !important;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-[#F8F9FA]">
        {/* Header */}
        <div className="no-print bg-[#2C3E50] text-white py-6">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white hover:text-[#FF6B00] mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour à mes devis
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Devis {devis.numeroDevis}</h1>
              <p className="text-gray-300 mt-1">{devis.titre}</p>
            </div>
            <div>
              {getStatutBadge(devis.statut)}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl mx-auto print-container">
          {/* En-tête du devis */}
          <div className="mb-8">
            {/* Logo + Titre DEVIS + Dates */}
            <div className="flex justify-between items-start mb-8">
              {/* Logo à gauche */}
              <div className="flex-shrink-0">
                <Logo size="sm" variant="full" />
              </div>

              {/* Titre DEVIS au centre */}
              <div className="flex-1 text-center">
                <h2 className="text-4xl font-bold text-[#2C3E50] mb-2">DEVIS</h2>
                <p className="text-[#6C757D]">N° {devis.numeroDevis}</p>
              </div>

              {/* Dates à droite */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-[#6C757D]">Date</p>
                <p className="font-semibold">{devis.dateCreation?.toDate().toLocaleDateString('fr-FR')}</p>
                {devis.dateValidite && (
                  <>
                    <p className="text-sm text-[#6C757D] mt-2">Valide jusqu'au</p>
                    <p className="font-semibold">{devis.dateValidite.toDate().toLocaleDateString('fr-FR')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Informations artisan et client */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Artisan */}
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-2">De :</h3>
                <div className="text-sm">
                  {devis.artisan.raisonSociale && (
                    <p className="font-semibold">{devis.artisan.raisonSociale}</p>
                  )}
                  <p>{devis.artisan.nom} {devis.artisan.prenom}</p>
                  {devis.artisan.siret && <p>SIRET: {devis.artisan.siret}</p>}
                  <p>{devis.artisan.email}</p>
                  {devis.artisan.telephone && <p>{devis.artisan.telephone}</p>}
                  {devis.artisan.adresse && (
                    <>
                      <p>{devis.artisan.adresse.rue}</p>
                      <p>{devis.artisan.adresse.codePostal} {devis.artisan.adresse.ville}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Client */}
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-2">Pour :</h3>
                <div className="text-sm">
                  <p className="font-semibold">{devis.client.prenom} {devis.client.nom}</p>
                  <p>{devis.client.email}</p>
                  {devis.client.telephone && <p>{devis.client.telephone}</p>}
                  {devis.client.adresse && (
                    <>
                      <p>{devis.client.adresse.rue}</p>
                      <p>{devis.client.adresse.codePostal} {devis.client.adresse.ville}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {devis.description && (
            <div className="mb-8">
              <h3 className="font-bold text-[#2C3E50] mb-2">Description :</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{devis.description}</p>
            </div>
          )}

          {/* Date de début prévue */}
          {devis.dateDebutPrevue && (
            <div className="mb-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm font-semibold text-blue-900">📅 Date de début prévue des travaux :</p>
              <p className="text-blue-800 font-semibold text-lg">
                {devis.dateDebutPrevue.toDate().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          {/* Motif de refus (si devis refusé) */}
          {devis.statut === 'refuse' && devis.motifRefus && (
            <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 mb-2">❌ Motif du refus :</h3>
                  <p className="text-sm text-red-800 whitespace-pre-wrap">{devis.motifRefus}</p>
                  {devis.dateRefus && (
                    <p className="text-xs text-red-600 mt-2">
                      Refusé le {devis.dateRefus.toDate().toLocaleDateString('fr-FR')} à {devis.dateRefus.toDate().toLocaleTimeString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tableau des prestations */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#2C3E50] text-white">
                  <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Qté</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Unité</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">P.U. HT</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">TVA</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {devis.lignes.map((ligne, index) => (
                  <tr key={ligne.id || index}>
                    <td className="border border-gray-300 px-4 py-2">{ligne.description}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{ligne.quantite}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{ligne.unite}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{ligne.prixUnitaireHT.toFixed(2)} €</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{ligne.tauxTVA}%</td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-semibold">{ligne.totalHT.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="flex justify-between py-2 border-b">
                <span className="font-semibold">Total HT</span>
                <span className="font-semibold">{devis.totaux.totalHT.toFixed(2)} €</span>
              </div>
              {Object.entries(devis.totaux.totalTVA).map(([taux, montant]) => (
                <div key={taux} className="flex justify-between py-2 border-b text-sm">
                  <span>TVA {taux}%</span>
                  <span>{montant.toFixed(2)} €</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-[#2C3E50] mt-2">
                <span className="text-xl font-bold text-[#2C3E50]">Total TTC</span>
                <span className="text-xl font-bold text-[#FF6B00]">{devis.totaux.totalTTC.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Informations complémentaires */}
          <div className="border-t pt-6 space-y-4">
            {devis.delaiRealisation && (
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-2">Délai de réalisation :</h3>
                <p className="text-sm text-gray-700">{devis.delaiRealisation}</p>
              </div>
            )}

            {devis.conditions && (
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-2">Conditions :</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{devis.conditions}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="no-print mt-8 flex gap-4 justify-end flex-wrap">
            <button
              onClick={() => router.push('/artisan/devis')}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>

            {/* Bouton Modifier (brouillon uniquement) */}
            {devis.statut === 'brouillon' && (
              <button
                onClick={() => router.push(`/artisan/devis/nouveau?demandeId=${devis.demandeId}&editId=${devisId}`)}
                className="px-6 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100]"
              >
                ✏️ Modifier
              </button>
            )}

            {/* Bouton Contacter le client (devis refusé) */}
            {devis.statut === 'refuse' && (
              <button
                onClick={() => router.push(`/messages?userId=${devis.clientId}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                💬 Contacter le client
              </button>
            )}

            {/* Bouton Créer nouveau devis (devis refusé) */}
            {devis.statut === 'refuse' && (
              <button
                onClick={handleDupliquerDevis}
                disabled={duplicationEnCours}
                className="px-6 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {duplicationEnCours ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Création...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    📝 Créer un nouveau devis
                  </>
                )}
              </button>
            )}

            {/* Bouton Imprimer (tous les statuts) */}
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-[#2C3E50] text-white rounded-lg hover:bg-[#1A3A5C] flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              🖨️ Imprimer
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
