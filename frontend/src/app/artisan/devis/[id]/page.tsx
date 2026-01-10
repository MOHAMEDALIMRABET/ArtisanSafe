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
import { Logo } from '@/components/ui';
import type { Devis } from '@/types/devis';

export default function VoirDevisPage() {
  const router = useRouter();
  const params = useParams();
  const devisId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !devisId) return;
    loadDevis();
  }, [user, devisId]);

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
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-[#2C3E50] text-white py-6">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.push('/artisan/devis')}
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
        <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl mx-auto">
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
          <div className="mt-8 flex gap-4 justify-end">
            <button
              onClick={() => router.push('/artisan/devis')}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
            {devis.statut === 'brouillon' && (
              <button
                onClick={() => router.push(`/artisan/devis/nouveau?demandeId=${devis.demandeId}&editId=${devisId}`)}
                className="px-6 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100]"
              >
                Modifier
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-[#2C3E50] text-white rounded-lg hover:bg-[#1A3A5C]"
            >
              🖨️ Imprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
