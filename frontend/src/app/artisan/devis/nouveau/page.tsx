'use client';

/**
 * Page de création de devis - Style Qonto
 * Layout split : formulaire à gauche, prévisualisation à droite
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDemandeById } from '@/lib/firebase/demande-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { createDevis, updateDevis, genererProchainNumeroDevis } from '@/lib/firebase/devis-service';
import { Logo } from '@/components/ui';
import type { Demande } from '@/types/firestore';
import type { Devis, LigneDevis, TVARate, calculerLigne, calculerTotaux } from '@/types/devis';
import { Timestamp } from 'firebase/firestore';

export default function NouveauDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demandeId = searchParams?.get('demandeId');
  const { user, loading: authLoading } = useAuth();

  // États
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demande, setDemande] = useState<Demande | null>(null);

  // Formulaire
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [delaiRealisation, setDelaiRealisation] = useState('');
  const [dateValidite, setDateValidite] = useState(30); // Jours
  const [conditions, setConditions] = useState('');

  // Informations client/artisan (pré-remplies)
  const [clientInfo, setClientInfo] = useState<Devis['client'] | null>(null);
  const [artisanInfo, setArtisanInfo] = useState<Devis['artisan'] | null>(null);
  
  // Numéro de devis temporaire pour prévisualisation
  const [numeroDevisPreview, setNumeroDevisPreview] = useState(`DV-${new Date().getFullYear()}-XXXX`);
  
  // Date de création du devis (fixée à la première création, ne change pas)
  const [dateCreation, setDateCreation] = useState<Date>(new Date());

  /**
   * Charger les données de la demande et profils
   */
  useEffect(() => {
    async function loadData() {
      if (!demandeId || !user) {
        console.log('❌ Pas de demandeId ou user:', { demandeId, user: user?.uid });
        return;
      }

      console.log('🔍 Chargement devis pour demande:', demandeId);

      try {
        // Charger la demande
        console.log('📋 Chargement demande...');
        const demandeData = await getDemandeById(demandeId);
        console.log('✅ Demande chargée:', demandeData);
        
        if (!demandeData) {
          alert('Demande introuvable');
          router.push('/artisan/demandes');
          return;
        }
        setDemande(demandeData);

        // Charger les informations client
        console.log('👤 Chargement client:', demandeData.clientId);
        
        try {
          const client = await getUserById(demandeData.clientId);
          console.log('✅ Client chargé:', client);
          
          if (client) {
            const clientData: any = {
              nom: client.nom || '',
              prenom: client.prenom || '',
              email: client.email || '',
              telephone: client.telephone || '',
            };
            if (client.adresse?.rue && client.adresse?.ville && client.adresse?.codePostal) {
              clientData.adresse = {
                rue: client.adresse.rue,
                ville: client.adresse.ville,
                codePostal: client.adresse.codePostal,
              };
            }
            setClientInfo(clientData);
          } else {
            console.warn('⚠️ Client introuvable, utilisation données demande');
            // Fallback : utiliser les données de la demande
            const fallbackData: any = {
              nom: demandeData.clientNom || '',
              prenom: demandeData.clientPrenom || '',
              email: demandeData.clientEmail || '',
              telephone: demandeData.clientTelephone || '',
            };
            // N'ajouter adresse que si elle existe
            if (demandeData.adresse?.rue && demandeData.adresse?.ville && demandeData.adresse?.codePostal) {
              fallbackData.adresse = {
                rue: demandeData.adresse.rue,
                ville: demandeData.adresse.ville,
                codePostal: demandeData.adresse.codePostal,
              };
            }
            setClientInfo(fallbackData);
          }
        } catch (clientError) {
          console.error('❌ Erreur chargement client:', clientError);
          console.warn('⚠️ Utilisation données demande comme fallback');
          // Fallback : utiliser les données de la demande
          const fallbackData: any = {
            nom: demandeData.clientNom || 'Client',
            prenom: demandeData.clientPrenom || '',
            email: demandeData.clientEmail || '',
            telephone: demandeData.clientTelephone || '',
          };
          // N'ajouter adresse que si elle existe
          if (demandeData.adresse?.rue && demandeData.adresse?.ville && demandeData.adresse?.codePostal) {
            fallbackData.adresse = {
              rue: demandeData.adresse.rue,
              ville: demandeData.adresse.ville,
              codePostal: demandeData.adresse.codePostal,
            };
          }
          setClientInfo(fallbackData);
        }

        // Charger les informations artisan
        console.log('🔧 Chargement artisan:', user.uid);
        const artisan = await getArtisanByUserId(user.uid);
        console.log('✅ Artisan chargé:', artisan);
        
        if (!artisan) {
          console.error('❌ Profil artisan introuvable pour:', user.uid);
          alert('Votre profil artisan n\'a pas été trouvé. Veuillez compléter votre inscription.');
          router.push('/artisan/profil');
          return;
        }
        
        if (artisan) {
          const artisanData: any = {
            raisonSociale: artisan.raisonSociale || '',
            siret: artisan.siret || '',
            nom: artisan.nom,
            prenom: artisan.prenom,
            email: artisan.email || user.email || '',
            telephone: artisan.telephone || '',
          };
          if (artisan.adresse) {
            artisanData.adresse = {
              rue: artisan.adresse,
              ville: '', // TODO: Adapter selon votre structure
              codePostal: '',
            };
          }
          setArtisanInfo(artisanData);
        }

        // Pré-remplir le titre avec la description de la demande
        setTitre(`Devis - ${demandeData.titre || 'Travaux'}`);
        setDescription(demandeData.description || '');

        // Charger le prochain numéro de devis pour la prévisualisation
        try {
          const prochainNumero = await genererProchainNumeroDevis(user.uid);
          setNumeroDevisPreview(prochainNumero);
        } catch (error) {
          console.error('Erreur génération numéro devis:', error);
          // Garder le placeholder par défaut si erreur
        }

        // Ajouter une première ligne vide
        ajouterLigne();

        console.log('✅ Toutes les données chargées avec succès');

      } catch (error) {
        console.error('❌ ERREUR chargement données:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'Pas de stack');
        alert('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [demandeId, user, router]);

  /**
   * Ajouter une nouvelle ligne de prestation
   */
  const ajouterLigne = () => {
    const nouvelleLigne: LigneDevis = {
      id: `ligne-${Date.now()}-${Math.random()}`,
      description: '',
      quantite: 1,
      unite: 'h',
      prixUnitaireHT: 0,
      tauxTVA: 20,
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
    };
    setLignes([...lignes, nouvelleLigne]);
  };

  /**
   * Supprimer une ligne
   */
  const supprimerLigne = (id: string) => {
    setLignes(lignes.filter(l => l.id !== id));
  };

  /**
   * Mettre à jour une ligne et recalculer les totaux
   */
  const mettreAJourLigne = (id: string, updates: Partial<LigneDevis>) => {
    setLignes(lignes.map(ligne => {
      if (ligne.id !== id) return ligne;
      
      const ligneUpdate = { ...ligne, ...updates };
      
      // Recalculer les totaux de la ligne
      const totalHT = ligneUpdate.quantite * ligneUpdate.prixUnitaireHT;
      const totalTVA = totalHT * (ligneUpdate.tauxTVA / 100);
      const totalTTC = totalHT + totalTVA;
      
      return {
        ...ligneUpdate,
        totalHT: Math.round(totalHT * 100) / 100,
        totalTVA: Math.round(totalTVA * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
      };
    }));
  };

  /**
   * Calculer les totaux globaux
   */
  const calculerTotauxGlobaux = () => {
    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.totalHT, 0);
    
    const totalTVA: { [key in TVARate]?: number } = {};
    lignes.forEach(ligne => {
      totalTVA[ligne.tauxTVA] = (totalTVA[ligne.tauxTVA] || 0) + ligne.totalTVA;
    });
    
    const totalTVAGlobal = Object.values(totalTVA).reduce((sum, val) => sum + (val || 0), 0);
    const totalTTC = totalHT + totalTVAGlobal;
    
    return {
      totalHT: Math.round(totalHT * 100) / 100,
      totalTVA,
      totalTVAGlobal: Math.round(totalTVAGlobal * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
    };
  };

  /**
   * Nettoyer un objet pour supprimer toutes les valeurs undefined
   */
  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          const cleanedNested = cleanObject(obj[key]);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = obj[key];
        }
      }
    }
    return cleaned;
  };

  /**
   * Sauvegarder le devis en brouillon
   */
  const sauvegarderBrouillon = async () => {
    if (!user || !clientInfo || !artisanInfo || !demande || !demandeId) return;

    setSaving(true);
    try {
      const devisData: any = {
        demandeId: demandeId,
        clientId: demande.clientId,
        artisanId: user.uid,
        statut: 'brouillon',
        client: cleanObject(clientInfo),
        artisan: cleanObject(artisanInfo),
        titre,
        description,
        lignes,
        totaux: calculerTotauxGlobaux(),
        delaiRealisation,
        dateValidite: Timestamp.fromDate(
          new Date(Date.now() + dateValidite * 24 * 60 * 60 * 1000)
        ),
        conditions,
      };

      await createDevis(devisData);
      alert('✅ Devis sauvegardé en brouillon');
      router.push('/artisan/demandes');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Envoyer le devis au client
   */
  const envoyerDevis = async () => {
    if (!user || !clientInfo || !artisanInfo || !demande || !demandeId) return;
    
    // Validation
    if (!titre.trim()) {
      alert('Veuillez saisir un titre');
      return;
    }
    if (lignes.length === 0) {
      alert('Veuillez ajouter au moins une prestation');
      return;
    }
    if (lignes.some(l => !l.description.trim() || l.prixUnitaireHT <= 0)) {
      alert('Toutes les lignes doivent avoir une description et un prix');
      return;
    }

    setSaving(true);
    try {
      const devisData: any = {
        demandeId: demandeId,
        clientId: demande.clientId,
        artisanId: user.uid,
        statut: 'envoye',
        client: cleanObject(clientInfo),
        artisan: cleanObject(artisanInfo),
        titre,
        description,
        lignes,
        totaux: calculerTotauxGlobaux(),
        delaiRealisation,
        dateValidite: Timestamp.fromDate(
          new Date(Date.now() + dateValidite * 24 * 60 * 60 * 1000)
        ),
        conditions,
      };

      await createDevis(devisData);
      alert('✅ Devis envoyé au client !');
      router.push('/artisan/demandes');
    } catch (error) {
      console.error('Erreur envoi:', error);
      alert('Erreur lors de l\'envoi du devis');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || !demande) {
    return null;
  }

  const totaux = calculerTotauxGlobaux();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* PARTIE GAUCHE : FORMULAIRE */}
      <div className="w-1/2 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-[#FF6B00] hover:underline mb-4"
            >
              ← Retour aux demandes
            </button>
            <h1 className="text-3xl font-bold text-[#2C3E50]">Créer un devis</h1>
            <p className="text-[#6C757D] mt-2">
              Demande de {clientInfo?.prenom} {clientInfo?.nom}
            </p>
          </div>

          {/* Informations générales */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-4">Informations générales</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Titre du devis *
                </label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Ex: Rénovation salle de bain"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Description détaillée des travaux..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                    Délai de réalisation
                  </label>
                  <input
                    type="text"
                    value={delaiRealisation}
                    onChange={(e) => setDelaiRealisation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    placeholder="Ex: 2 semaines"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                    Validité (jours)
                  </label>
                  <input
                    type="number"
                    value={dateValidite}
                    onChange={(e) => setDateValidite(parseInt(e.target.value) || 30)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Prestations */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#2C3E50]">Prestations</h2>
              <button
                onClick={ajouterLigne}
                className="bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="space-y-4">
              {lignes.map((ligne, index) => (
                <div key={ligne.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-[#6C757D]">Ligne {index + 1}</span>
                    <button
                      onClick={() => supprimerLigne(ligne.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={ligne.description}
                      onChange={(e) => mettreAJourLigne(ligne.id, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                      placeholder="Description de la prestation"
                    />

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Quantité</label>
                        <input
                          type="number"
                          value={ligne.quantite}
                          onChange={(e) => mettreAJourLigne(ligne.id, { quantite: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Unité</label>
                        <select
                          value={ligne.unite}
                          onChange={(e) => mettreAJourLigne(ligne.id, { unite: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                        >
                          <option value="h">h</option>
                          <option value="j">j</option>
                          <option value="m²">m²</option>
                          <option value="ml">ml</option>
                          <option value="unité">unité</option>
                          <option value="forfait">forfait</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Prix HT (€)</label>
                        <input
                          type="number"
                          value={ligne.prixUnitaireHT}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            mettreAJourLigne(ligne.id, { prixUnitaireHT: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">TVA (%)</label>
                        <select
                          value={ligne.tauxTVA}
                          onChange={(e) => mettreAJourLigne(ligne.id, { tauxTVA: parseFloat(e.target.value) as TVARate })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                        >
                          <option value="0">0%</option>
                          <option value="5.5">5.5%</option>
                          <option value="10">10%</option>
                          <option value="20">20%</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end text-sm">
                      <span className="text-[#6C757D]">Total ligne : </span>
                      <span className="font-semibold text-[#2C3E50] ml-2">
                        {ligne.totalTTC.toFixed(2)} € TTC
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {lignes.length === 0 && (
                <div className="text-center py-8 text-[#6C757D]">
                  Aucune prestation ajoutée. Cliquez sur "Ajouter une ligne" pour commencer.
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-4">Conditions particulières</h2>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              placeholder="Conditions de paiement, garanties, etc..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={sauvegarderBrouillon}
              disabled={saving}
              className="flex-1 bg-gray-200 text-[#2C3E50] px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
            >
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder en brouillon'}
            </button>
            <button
              onClick={envoyerDevis}
              disabled={saving}
              className="flex-1 bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition disabled:opacity-50"
            >
              {saving ? '⏳ Envoi...' : '📨 Envoyer le devis'}
            </button>
          </div>
        </div>
      </div>

      {/* PARTIE DROITE : PRÉVISUALISATION */}
      <div className="w-1/2 bg-white border-l border-gray-200 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          {/* En-tête devis */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-8">
              {/* Logo à gauche */}
              <div className="flex-shrink-0">
                <Logo size="sm" variant="full" />
              </div>

              {/* Titre DEVIS au centre */}
              <div className="flex-1 text-center">
                <h1 className="text-4xl font-bold text-[#2C3E50] mb-2">DEVIS</h1>
                <p className="text-[#6C757D]">N° {numeroDevisPreview}</p>
              </div>

              {/* Dates à droite */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-[#6C757D]">Date</p>
                <p className="font-semibold">{dateCreation.toLocaleDateString('fr-FR')}</p>
                <p className="text-sm text-[#6C757D] mt-2">Validité</p>
                <p className="font-semibold">{dateValidite} jours</p>
              </div>
            </div>

            {/* Informations artisan et client */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">DE :</h3>
                <div className="text-sm">
                  <p className="font-semibold">{artisanInfo?.raisonSociale}</p>
                  <p className="text-[#6C757D]">SIRET : {artisanInfo?.siret}</p>
                  <p className="text-[#6C757D]">{artisanInfo?.email}</p>
                  <p className="text-[#6C757D]">{artisanInfo?.telephone}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">POUR :</h3>
                <div className="text-sm">
                  <p className="font-semibold">{clientInfo?.prenom} {clientInfo?.nom}</p>
                  <p className="text-[#6C757D]">{clientInfo?.email}</p>
                  <p className="text-[#6C757D]">{clientInfo?.telephone}</p>
                  {clientInfo?.adresse && (
                    <p className="text-[#6C757D]">
                      {clientInfo.adresse.rue}<br />
                      {clientInfo.adresse.codePostal} {clientInfo.adresse.ville}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Titre et description */}
            {titre && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">{titre}</h2>
                {description && <p className="text-[#6C757D]">{description}</p>}
              </div>
            )}

            {delaiRealisation && (
              <div className="bg-[#FFF3E0] border-l-4 border-[#FF6B00] p-4 mb-6">
                <p className="text-sm">
                  <span className="font-semibold">Délai de réalisation :</span> {delaiRealisation}
                </p>
              </div>
            )}
          </div>

          {/* Tableau des prestations */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-[#2C3E50] text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Qté</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">P.U. HT</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">TVA</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm">
                      {ligne.description || <span className="text-gray-400 italic">Description...</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {ligne.quantite} {ligne.unite}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {ligne.prixUnitaireHT.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {ligne.tauxTVA}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      {ligne.totalTTC.toFixed(2)} €
                    </td>
                  </tr>
                ))}

                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#6C757D] italic">
                      Aucune prestation ajoutée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="bg-[#F8F9FA] rounded-lg p-6 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6C757D]">Total HT</span>
                <span className="font-semibold">{totaux.totalHT.toFixed(2)} €</span>
              </div>
              {Object.entries(totaux.totalTVA).map(([taux, montant]) => (
                <div key={taux} className="flex justify-between text-sm">
                  <span className="text-[#6C757D]">TVA {taux}%</span>
                  <span className="font-semibold">{montant?.toFixed(2)} €</span>
                </div>
              ))}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-[#2C3E50]">Total TTC</span>
                  <span className="text-2xl font-bold text-[#FF6B00]">{totaux.totalTTC.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {conditions && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">Conditions particulières</h3>
              <p className="text-sm text-[#6C757D] whitespace-pre-wrap">{conditions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
