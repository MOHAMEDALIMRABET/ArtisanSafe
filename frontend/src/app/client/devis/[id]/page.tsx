'use client';

/**
 * Page de détail d'un devis côté client
 * Affiche le contenu complet avec actions Accepter/Refuser
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { notifyArtisanDevisAccepte, notifyArtisanDevisRefuse, createNotification } from '@/lib/firebase/notification-service';
import { Logo } from '@/components/ui';
import type { Devis } from '@/types/devis';
import type { Demande } from '@/types/firestore';

export default function ClientDevisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');
  const [refusalType, setRefusalType] = useState<'definitif' | 'revision'>('definitif');
  const [processing, setProcessing] = useState(false);

  const devisId = params.id as string;
  const action = searchParams.get('action');

  useEffect(() => {
    // Attendre que l'auth soit chargée et que l'utilisateur soit défini
    if (authLoading) return;
    if (!user) {
      router.push('/connexion');
      return;
    }
    loadDevis();
  }, [devisId, user, authLoading]);

  useEffect(() => {
    if (action === 'accepter' && devis?.statut === 'envoye') {
      handleAccepter();
    } else if (action === 'refuser' && devis?.statut === 'envoye') {
      setShowRefusalModal(true);
    }
  }, [action, devis]);

  const loadDevis = async () => {
    try {
      const devisDoc = await getDoc(doc(db, 'devis', devisId));
      if (!devisDoc.exists()) {
        router.push('/client/devis');
        return;
      }

      const devisData = { id: devisDoc.id, ...devisDoc.data() } as Devis;

      console.log('🔍 Devis chargé:', {
        devisId: devisData.id,
        clientIdDevis: devisData.clientId,
        userUid: user?.uid,
        match: devisData.clientId === user?.uid
      });

      // Vérifier que le devis appartient au client
      if (devisData.clientId !== user?.uid) {
        console.error('❌ Devis refusé: clientId ne correspond pas');
        router.push('/client/devis');
        return;
      }

      setDevis(devisData);

      // Charger la demande associée
      if (devisData.demandeId) {
        const demandeDoc = await getDoc(doc(db, 'demandes', devisData.demandeId));
        if (demandeDoc.exists()) {
          setDemande({ id: demandeDoc.id, ...demandeDoc.data() } as Demande);
        }
      }
    } catch (error) {
      console.error('Erreur chargement devis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccepter = async () => {
    if (!devis || processing) return;

    if (!confirm('Êtes-vous sûr de vouloir accepter ce devis ? Cette action est irréversible.')) {
      return;
    }

    try {
      setProcessing(true);

      // Mettre à jour le statut du devis
      await updateDoc(doc(db, 'devis', devisId), {
        statut: 'accepte',
        dateAcceptation: Timestamp.now(),
      });

      // Notifier l'artisan
      try {
        const clientNom = `${devis.client.prenom} ${devis.client.nom}`;
        await notifyArtisanDevisAccepte(
          devis.artisanId,
          devisId,
          clientNom,
          devis.numeroDevis
        );
        console.log('✅ Artisan notifié de l\'acceptation');
      } catch (error) {
        console.error('Erreur notification artisan:', error);
        // Ne pas bloquer l'acceptation si la notification échoue
      }

      alert('✅ Devis accepté avec succès !\n\nL\'artisan sera notifié. Vous pouvez maintenant procéder au paiement.');
      
      // TODO: Créer le contrat et rediriger vers le paiement
      router.push('/client/devis');
    } catch (error) {
      console.error('Erreur acceptation devis:', error);
      alert('Erreur lors de l\'acceptation. Veuillez réessayer.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefuser = async () => {
    if (!devis || processing) return;

    try {
      setProcessing(true);

      await updateDoc(doc(db, 'devis', devisId), {
        statut: 'refuse',
        dateRefus: Timestamp.now(),
        motifRefus: refusalReason || 'Aucun motif précisé',
        typeRefus: refusalType, // 'revision' ou 'definitif'
      });

      const clientNom = `${devis.client.prenom} ${devis.client.nom}`;

      // Notifier l'artisan selon le type de refus
      if (refusalType === 'revision' && devis.demandeId) {
        // Refus avec demande de révision → notification spécifique
        try {
          await createNotification(devis.artisanId, {
            type: 'devis_revision',
            titre: '🔄 Demande de révision de devis',
            message: `${clientNom} souhaite une révision du devis ${devis.numeroDevis || ''}. Motif : ${refusalReason || 'Non précisé'}`,
            lien: `/artisan/devis/nouveau?demandeId=${devis.demandeId}`,
          });
          console.log('✅ Notification de révision envoyée');
        } catch (error) {
          console.error('Erreur notification révision:', error);
        }
      } else {
        // Refus définitif → notification de refus standard
        try {
          await notifyArtisanDevisRefuse(
            devis.artisanId,
            devisId,
            clientNom,
            devis.numeroDevis,
            refusalReason
          );
          console.log('✅ Artisan notifié du refus définitif');
        } catch (error) {
          console.error('Erreur notification artisan:', error);
        }
      }

      const message = refusalType === 'revision'
        ? '❌ Devis refusé. L\'artisan sera notifié et pourra vous envoyer un devis révisé.'
        : '❌ Devis refusé. L\'artisan sera notifié.';
      
      alert(message);
      
      router.push('/client/devis');
    } catch (error) {
      console.error('Erreur refus devis:', error);
      alert('Erreur lors du refus. Veuillez réessayer.');
    } finally {
      setProcessing(false);
      setShowRefusalModal(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!devis) {
    return null;
  }

  const getStatutBadge = (statut: string) => {
    const styles: { [key: string]: string } = {
      envoye: 'bg-blue-100 text-blue-800',
      accepte: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
      expire: 'bg-orange-100 text-orange-800',
    };

    const labels: { [key: string]: string } = {
      envoye: '⏳ En attente de votre réponse',
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

  return (
    <>
      <div className="min-h-screen bg-[#F8F9FA] print:bg-white">
        {/* Header - masqué à l'impression */}
        <div className="bg-[#2C3E50] text-white py-6 print:hidden">
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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Devis N° {devis.numeroDevis}</h1>
                <p className="text-gray-300 mt-1">{devis.titre}</p>
              </div>
              {getStatutBadge(devis.statut)}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 print:py-0">
          {/* Boutons d'action - masqués à l'impression */}
          {devis.statut === 'envoye' && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 print:hidden">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-blue-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-blue-800 font-semibold mb-2">Ce devis nécessite une réponse</h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Vous devez accepter ou refuser ce devis avant le {devis.dateValidite?.toDate().toLocaleDateString('fr-FR')}.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleAccepter}
                      disabled={processing}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                    >
                      {processing ? 'Traitement...' : '✅ Accepter ce devis'}
                    </button>
                    <button
                      onClick={() => setShowRefusalModal(true)}
                      disabled={processing}
                      className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
                    >
                      ❌ Refuser ce devis
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contenu du devis */}
          <div className="bg-white rounded-lg shadow-md p-8 print:shadow-none">
            {/* En-tête */}
            <div className="border-b-2 border-[#FF6B00] pb-6 mb-6">
              <div className="flex justify-between items-start">
                {/* Logo à gauche */}
                <div className="flex-shrink-0">
                  <Logo size="sm" variant="full" />
                </div>

                {/* Titre DEVIS au centre */}
                <div className="flex-1 text-center">
                  <h2 className="text-3xl font-bold text-[#2C3E50] mb-2">DEVIS</h2>
                  <p className="text-gray-600">N° {devis.numeroDevis}</p>
                  <p className="text-sm text-gray-500">
                    Date : {devis.dateCreation?.toDate().toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm text-gray-500">
                    Valable jusqu'au : {devis.dateValidite?.toDate().toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* Info demande à droite */}
                {demande && (
                  <div className="text-right text-sm flex-shrink-0">
                    <p className="text-gray-600 font-semibold">Demande N° {demande.id?.slice(-6).toUpperCase()}</p>
                    <p className="text-gray-500">{demande.titre || demande.categorie}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Informations artisan et client */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-3">Artisan</h3>
                <p className="font-semibold">{devis.artisan.prenom} {devis.artisan.nom}</p>
                {devis.artisan.raisonSociale && <p>{devis.artisan.raisonSociale}</p>}
                {devis.artisan.siret && <p className="text-sm text-gray-600">SIRET: {devis.artisan.siret}</p>}
                {devis.artisan.email && <p className="text-sm">📧 {devis.artisan.email}</p>}
                {devis.artisan.telephone && <p className="text-sm">📞 {devis.artisan.telephone}</p>}
                {devis.artisan.adresse && (
                  <p className="text-sm text-gray-600 mt-1">
                    {devis.artisan.adresse.rue}<br />
                    {devis.artisan.adresse.codePostal} {devis.artisan.adresse.ville}
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-bold text-[#2C3E50] mb-3">Client</h3>
                <p className="font-semibold">{devis.client.prenom} {devis.client.nom}</p>
                {devis.client.email && <p className="text-sm">📧 {devis.client.email}</p>}
                {devis.client.telephone && <p className="text-sm">📞 {devis.client.telephone}</p>}
                {devis.client.adresse && (
                  <p className="text-sm text-gray-600 mt-1">
                    {devis.client.adresse.rue}<br />
                    {devis.client.adresse.codePostal} {devis.client.adresse.ville}
                  </p>
                )}
              </div>
            </div>

            {/* Titre et description */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-[#2C3E50] mb-2">{devis.titre}</h3>
              {devis.description && (
                <p className="text-gray-700 whitespace-pre-wrap">{devis.description}</p>
              )}
            </div>

            {/* Détail des prestations */}
            <div className="mb-8">
              <h3 className="font-bold text-[#2C3E50] mb-4">Détail des prestations</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">Désignation</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Quantité</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Prix unitaire HT</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">TVA</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devis.lignes.map((ligne, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-4 py-2">
                          {ligne.description}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {ligne.quantite} {ligne.unite}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-right">
                          {ligne.prixUnitaireHT.toFixed(2)} €
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {ligne.tauxTVA}%
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                          {ligne.totalHT.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totaux */}
            <div className="flex justify-end mb-8">
              <div className="w-full md:w-1/2">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">Total HT:</span>
                    <span className="font-semibold">{devis.totaux.totalHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">TVA:</span>
                    <span className="font-semibold">{devis.totaux.totalTVAGlobal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-[#FF6B00] pt-2 border-t-2 border-[#FF6B00]">
                    <span>Total TTC:</span>
                    <span>{devis.totaux.totalTTC.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations complémentaires */}
            {(devis.dateDebutPrevue || devis.delaiRealisation || devis.conditions || devis.notes) && (
              <div className="border-t pt-6">
                <h3 className="font-bold text-[#2C3E50] mb-4">Informations complémentaires</h3>
                
                {devis.dateDebutPrevue && (
                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
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

                {devis.delaiRealisation && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700">Délai de réalisation :</p>
                    <p className="text-gray-600">{devis.delaiRealisation}</p>
                  </div>
                )}

                {devis.conditions && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700">Conditions :</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{devis.conditions}</p>
                  </div>
                )}

                {devis.notes && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700">Notes :</p>
                    <p className="text-gray-600 whitespace-pre-wrap">{devis.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Mentions légales */}
            <div className="border-t pt-6 mt-6">
              <p className="text-xs text-gray-500">
                Ce devis est valable jusqu'au {devis.dateValidite?.toDate().toLocaleDateString('fr-FR')} et ne constitue pas une facture.
                Une fois accepté, ce devis engage les deux parties selon les conditions décrites.
              </p>
            </div>
          </div>

          {/* Boutons bas de page - masqués à l'impression */}
          <div className="mt-6 flex gap-4 print:hidden">
            <button
              onClick={handlePrint}
              className="bg-[#2C3E50] text-white px-6 py-2 rounded-lg hover:bg-[#1A3A5C] transition"
            >
              🖨️ Imprimer
            </button>

            {devis.statut === 'accepte' && (
              <button
                onClick={() => alert('Fonctionnalité messagerie à venir')}
                className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100] transition"
              >
                💬 Contacter l'artisan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de refus */}
      {showRefusalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-[#2C3E50] mb-4">Refuser ce devis</h3>
            
            <p className="text-gray-600 mb-3">
              Motif du refus (optionnel) :
            </p>
            <textarea
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              rows={3}
              placeholder="Ex: Tarif trop élevé, délai trop long, prestation non adaptée..."
            />

            <p className="text-gray-700 font-semibold mb-3">
              Que souhaitez-vous faire ?
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-[#FF6B00] transition">
                <input
                  type="radio"
                  name="refusalType"
                  value="definitif"
                  checked={refusalType === 'definitif'}
                  onChange={(e) => setRefusalType(e.target.value as 'definitif' | 'revision')}
                  className="mt-1 w-4 h-4 text-[#FF6B00] focus:ring-[#FF6B00]"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Refuser définitivement</p>
                  <p className="text-sm text-gray-600">L'artisan sera notifié du refus</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-[#FF6B00] transition">
                <input
                  type="radio"
                  name="refusalType"
                  value="revision"
                  checked={refusalType === 'revision'}
                  onChange={(e) => setRefusalType(e.target.value as 'definitif' | 'revision')}
                  className="mt-1 w-4 h-4 text-[#FF6B00] focus:ring-[#FF6B00]"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Refuser et demander une révision</p>
                  <p className="text-sm text-gray-600">L'artisan pourra vous envoyer un nouveau devis amélioré</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRefusalModal(false);
                  setRefusalType('definitif');
                }}
                disabled={processing}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleRefuser}
                disabled={processing}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
              >
                {processing ? 'Traitement...' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
