'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  getDemandeExpressById,
  getPropositionsByDemande,
  createPropositionExpress,
  markInterventionEnCours,
  markInterventionTerminee
} from '@/lib/firebase/demande-express-service';
import { getUserById } from '@/lib/firebase/user-service';
import { useAuth } from '@/hooks/useAuth';
import type { DemandeExpress, PropositionExpress, User } from '@/types/firestore';
import { Button } from '@/components/ui/Button';

export default function DemandeExpressDetailArtisanPage() {
  const router = useRouter();
  const params = useParams();
  const demandeId = params.id as string;
  const { user: firebaseUser } = useAuth();

  const [userData, setUserData] = useState<User | null>(null);
  const [demande, setDemande] = useState<DemandeExpress | null>(null);
  const [clientData, setClientData] = useState<User | null>(null);
  const [propositions, setPropositions] = useState<PropositionExpress[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [montantPropose, setMontantPropose] = useState('');
  const [description, setDescription] = useState('');
  const [delaiIntervention, setDelaiIntervention] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/connexion');
      return;
    }
    loadData();
  }, [firebaseUser, demandeId]);

  async function loadData() {
    if (!firebaseUser) return;

    try {
      const user = await getUserById(firebaseUser.uid);
      setUserData(user);

      if (user?.role !== 'artisan') {
        alert('Accès réservé aux artisans');
        router.push('/');
        return;
      }

      const demandeData = await getDemandeExpressById(demandeId);
      if (!demandeData) {
        alert('Demande introuvable');
        router.push('/artisan/demandes-express');
        return;
      }
      setDemande(demandeData);

      // Client info
      const client = await getUserById(demandeData.clientId);
      setClientData(client);

      // Propositions
      const propositionsList = await getPropositionsByDemande(demandeId);
      setPropositions(propositionsList);

      // Pré-remplir avec budget client si disponible
      if (demandeData.budgetPropose && !montantPropose) {
        setMontantPropose(demandeData.budgetPropose.toString());
      }
    } catch (error) {
      console.error('Erreur chargement demande:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitProposition(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !demande) return;

    const montant = parseFloat(montantPropose);
    if (isNaN(montant) || montant <= 0) {
      alert('Montant invalide');
      return;
    }
    if (montant > 150) {
      alert('Le montant maximum pour les travaux express est de 150€');
      return;
    }
    if (!description.trim()) {
      alert('Veuillez décrire ce qui est inclus dans votre proposition');
      return;
    }

    setSubmitting(true);
    try {
      await createPropositionExpress({
        demandeId: demandeId,
        artisanId: firebaseUser.uid,
        clientId: demande.clientId,
        montantPropose: montant,
        description: description.trim(),
        delaiIntervention: delaiIntervention || undefined,
      });

      alert('✅ Proposition envoyée avec succès !');
      // Recharger
      await loadData();
    } catch (error: any) {
      console.error('Erreur envoi proposition:', error);
      alert(error.message || 'Erreur lors de l\'envoi de la proposition');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarquerEnCours() {
    if (!confirm('Confirmez-vous le début de l\'intervention ?')) return;
    
    setSubmitting(true);
    try {
      await markInterventionEnCours(demandeId);
      alert('✅ Intervention marquée comme en cours');
      await loadData();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarquerTerminee() {
    if (!confirm('Confirmez-vous que l\'intervention est terminée ?')) return;
    
    setSubmitting(true);
    try {
      await markInterventionTerminee(demandeId);
      alert('✅ Intervention terminée ! Le client va recevoir une notification.');
      await loadData();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!demande) {
    return null;
  }

  const maProposition = propositions.find(p => p.artisanId === firebaseUser?.uid);
  const peutFaireProposition = demande.statut === 'en_attente_proposition' && !maProposition;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FA] to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-[#E9ECEF]">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center gap-2 text-sm mb-4">
            <Link href="/artisan/dashboard" className="text-[#2C3E50] hover:text-[#FF6B00]">
              Dashboard
            </Link>
            <span className="text-[#6C757D]">&gt;</span>
            <Link href="/artisan/demandes-express" className="text-[#2C3E50] hover:text-[#FF6B00]">
              Demandes express
            </Link>
            <span className="text-[#6C757D]">&gt;</span>
            <span className="text-[#2C3E50] font-semibold">Détails</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold text-[#2C3E50]">
            ⚡ Demande express
          </h1>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Infos demande */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#2C3E50]">
                {demande.categorie.charAt(0).toUpperCase() + demande.categorie.slice(1)}
                {demande.sousCategorie && ` • ${demande.sousCategorie}`}
              </h2>
              {demande.urgence === 'urgent' && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                  🚨 Urgent
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                  Description des travaux
                </label>
                <p className="text-[#6C757D] whitespace-pre-wrap">{demande.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📍 Localisation
                  </label>
                  <p className="text-[#6C757D]">{demande.ville} ({demande.codePostal})</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    📅 Date souhaitée
                  </label>
                  <p className="text-[#6C757D]">
                    {new Date(demande.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {demande.budgetPropose && (
                  <div>
                    <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                      💰 Budget client
                    </label>
                    <p className="text-2xl font-bold text-[#FF6B00]">{demande.budgetPropose}€</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    👤 Client
                  </label>
                  <p className="text-[#6C757D]">
                    {clientData ? `${clientData.prenom} ${clientData.nom}` : 'Chargement...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ma proposition (si déjà envoyée) */}
          {maProposition && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-4">
                ✅ Votre proposition
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    Montant proposé
                  </label>
                  <p className="text-2xl font-bold text-[#FF6B00]">{maProposition.montantPropose}€</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    Description
                  </label>
                  <p className="text-[#6C757D] whitespace-pre-wrap">{maProposition.description}</p>
                </div>
                {maProposition.delaiIntervention && (
                  <div>
                    <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                      Délai d'intervention
                    </label>
                    <p className="text-[#6C757D]">{maProposition.delaiIntervention}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-[#2C3E50] mb-1">
                    Statut
                  </label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    maProposition.statut === 'acceptee' ? 'bg-green-100 text-green-800' :
                    maProposition.statut === 'refusee' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {maProposition.statut === 'acceptee' ? 'Acceptée' :
                     maProposition.statut === 'refusee' ? 'Refusée' :
                     'En attente d\'acceptation'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Formulaire proposition */}
          {peutFaireProposition && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-[#2C3E50] mb-6">
                💬 Faire une proposition
              </h3>

              <form onSubmit={handleSubmitProposition} className="space-y-6">
                <div>
                  <label htmlFor="montant" className="block text-sm font-semibold text-[#2C3E50] mb-2">
                    Montant proposé * <span className="text-[#6C757D] font-normal">(max 150€)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="montant"
                      value={montantPropose}
                      onChange={(e) => setMontantPropose(e.target.value)}
                      max={150}
                      min={1}
                      step={1}
                      required
                      className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#FF6B00] pr-12"
                      placeholder="Ex: 120"
                    />
                    <span className="absolute right-4 top-3 text-[#6C757D] font-semibold">€</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-[#2C3E50] mb-2">
                    Que comprend votre prestation ? *
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                    className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#FF6B00]"
                    placeholder="Ex: Fourniture des pièces, main d'œuvre, déplacement inclus..."
                  />
                  <p className="text-sm text-[#6C757D] mt-1">
                    Soyez précis sur ce qui est inclus dans votre tarif
                  </p>
                </div>

                <div>
                  <label htmlFor="delai" className="block text-sm font-semibold text-[#2C3E50] mb-2">
                    Délai d'intervention <span className="text-[#6C757D] font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    id="delai"
                    value={delaiIntervention}
                    onChange={(e) => setDelaiIntervention(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#FF6B00]"
                    placeholder="Ex: Intervention sous 48h"
                  />
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-[#2C3E50]">
                    <strong>ℹ️ À savoir :</strong> Une fois votre proposition envoyée, le client pourra l'accepter et procéder au paiement. L'argent sera bloqué jusqu'à la fin de l'intervention.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/artisan/demandes-express')}
                    disabled={submitting}
                  >
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? '⏳ Envoi...' : '💬 Envoyer ma proposition'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Actions intervention */}
          {demande.statut === 'payee' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-4">
                ✅ Paiement reçu - Vous pouvez intervenir
              </h3>
              <p className="text-[#6C757D] mb-4">
                Le client a payé. L'argent est bloqué jusqu'à la fin de l'intervention.
              </p>
              <Button onClick={handleMarquerEnCours} disabled={submitting}>
                🚀 Marquer l'intervention comme démarrée
              </Button>
            </div>
          )}

          {demande.statut === 'en_cours' && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-4">
                🔧 Intervention en cours
              </h3>
              <p className="text-[#6C757D] mb-4">
                Une fois l'intervention terminée, marquez-la comme terminée pour libérer le paiement.
              </p>
              <Button onClick={handleMarquerTerminee} disabled={submitting}>
                ✅ Marquer l'intervention comme terminée
              </Button>
            </div>
          )}

          {demande.statut === 'terminee' && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#2C3E50] mb-2">
                🎉 Intervention terminée
              </h3>
              <p className="text-[#6C757D]">
                Le paiement a été libéré. Le client peut maintenant laisser un avis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
