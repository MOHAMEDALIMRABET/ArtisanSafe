'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId, updateArtisan } from '@/lib/firebase/artisan-service';
import { Button, Input, Logo } from '@/components/ui';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { METIERS_MAP, METIERS_DISPONIBLES } from '@/lib/constants/metiers';
import { artisanDoitDecennale } from '@/lib/decennale-helper';
import type { Categorie, Artisan, ZoneIntervention } from '@/types/firestore';

interface VilleSuggestion {
  nom: string;
  codePostal: string;
  departement: string;
}

export default function ProfilArtisanPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  
  // Autocomplétion ville
  const [villeSuggestions, setVilleSuggestions] = useState<VilleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Formulaire
  const [siret, setSiret] = useState('');
  const [raisonSociale, setRaisonSociale] = useState('');
  const [adresse, setAdresse] = useState('');
  const [metiers, setMetiers] = useState<Categorie[]>([]);
  const [ville, setVille] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [rayonKm, setRayonKm] = useState(30);
  const [presentation, setPresentation] = useState('');

  // Vérifier si décennale en cours de vérification (bloquer modification métiers)
  const decennaleEnCoursVerification = artisan?.verificationDocuments?.decennale?.url && 
                                        !artisan.verificationDocuments.decennale.verified && 
                                        !artisan.verificationDocuments.decennale.rejected;

  useEffect(() => {
    loadArtisanProfile();
  }, []);

  async function loadArtisanProfile() {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.push('/connexion');
        return;
      }

      const artisanData = await getArtisanByUserId(currentUser.uid);
      if (!artisanData) {
        setError('Profil artisan introuvable');
        setIsLoading(false);
        return;
      }

      setArtisan(artisanData);
      
      // DEBUG: Voir les métiers dans Firestore
      console.log('Métiers chargés depuis Firestore:', artisanData.metiers);
      console.log('Type des métiers:', typeof artisanData.metiers, Array.isArray(artisanData.metiers));
      console.log('Métiers détaillés:', JSON.stringify(artisanData.metiers));
      
      // Pré-remplir le formulaire
      setSiret(artisanData.siret || '');
      setRaisonSociale(artisanData.raisonSociale || '');
      setAdresse(artisanData.adresse || '');
      
      // Assurer que metiers est bien un tableau
      const metiersArray = Array.isArray(artisanData.metiers) 
        ? artisanData.metiers 
        : (artisanData.metiers ? Object.values(artisanData.metiers) : []);
      
      console.log('Métiers après conversion:', metiersArray);
      setMetiers(metiersArray);
      setPresentation(artisanData.presentation || '');
      
      if (artisanData.zonesIntervention && artisanData.zonesIntervention.length > 0) {
        setVille(artisanData.zonesIntervention[0].ville);
        setCodePostal(artisanData.zonesIntervention[0].codePostal || '');
        setRayonKm(artisanData.zonesIntervention[0].rayonKm || artisanData.zonesIntervention[0].rayon || 30);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Erreur chargement profil:', err);
      setError('Impossible de charger le profil');
      setIsLoading(false);
    }
  }

  // Recherche de villes via API
  async function searchVilles(query: string) {
    if (query.length < 2) {
      setVilleSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,codesPostaux,departement&limit=10`
      );
      const data = await response.json();
      
      const suggestions: VilleSuggestion[] = data.flatMap((commune: any) => 
        commune.codesPostaux.map((cp: string) => ({
          nom: commune.nom,
          codePostal: cp,
          departement: commune.departement.nom
        }))
      );
      
      setVilleSuggestions(suggestions);
    } catch (error) {
      console.error('Erreur recherche villes:', error);
      setVilleSuggestions([]);
    }
  }

  // Sélection d'une ville
  function selectVille(suggestion: VilleSuggestion) {
    setVille(suggestion.nom);
    setCodePostal(suggestion.codePostal);
    setVilleSuggestions([]);
    setShowSuggestions(false);
  }

  function toggleMetier(metier: Categorie) {
    if (metiers.includes(metier)) {
      setMetiers(metiers.filter(m => m !== metier));
    } else {
      setMetiers([...metiers, metier]);
    }
  }

  function validateSiret(value: string): boolean {
    // SIRET doit contenir exactement 14 chiffres
    return /^\d{14}$/.test(value.replace(/\s/g, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (!validateSiret(siret)) {
      setError('Vérifiez que votre SIRET est correct et que votre entreprise est active.');
      return;
    }

    if (!raisonSociale.trim()) {
      setError('La raison sociale est obligatoire');
      return;
    }

    if (!adresse.trim()) {
      setError('L\'adresse de l\'entreprise est obligatoire');
      return;
    }

    if (metiers.length === 0) {
      setError('Veuillez sélectionner au moins un métier');
      return;
    }

    if (!ville.trim()) {
      setError('La ville est obligatoire');
      return;
    }

    if (rayonKm < 5 || rayonKm > 100) {
      setError('Le rayon doit être entre 5 et 100 km');
      return;
    }

    if (!artisan) return;

    setIsSaving(true);

    try {
      const zonesIntervention: ZoneIntervention[] = [{
        ville: ville.trim(),
        codePostal: codePostal.trim(),
        rayonKm,
        departements: [] // À implémenter plus tard
      }];

      // DEBUG: Voir les métiers avant sauvegarde
      console.log('Métiers à sauvegarder:', metiers);
      
      await updateArtisan(artisan.userId, {
        siret: siret.replace(/\s/g, ''),
        raisonSociale: raisonSociale.trim(),
        adresse: adresse.trim(),
        metiers,
        zonesIntervention,
        presentation: presentation.trim() || undefined
      });

      setSuccess('✨ Votre profil a été mis à jour avec succès !');
      
      // Recharger le profil
      await loadArtisanProfile();
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Erreur mise à jour:', err);
      setError('Une erreur est survenue lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* En-tête */}
        <div className="mb-8">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au tableau de bord
          </button>
          
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">Mon Profil Professionnel</h1>
          <p className="text-gray-600">
            Complétez votre profil pour recevoir des demandes de clients
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Toast notification - Position fixe en haut à droite */}
        {success && (
          <div className="fixed top-20 right-6 z-50 p-4 bg-green-500 text-white rounded-lg shadow-2xl flex items-center gap-3 animate-slideDown max-w-md">
            <span className="text-3xl">✅</span>
            <div className="flex-1">
              <p className="font-bold text-lg">Succès !</p>
              <p className="text-sm">Votre profil a été mis à jour avec succès</p>
            </div>
            <button
              onClick={() => setSuccess('')}
              className="text-white hover:text-gray-200 text-2xl font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Informations entreprise */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Informations Entreprise</h2>
            
            <div className="space-y-4">
              <Input
                label="SIRET"
                type="text"
                value={siret}
                onChange={(e) => {
                  // Accepter uniquement les chiffres
                  const value = e.target.value.replace(/\D/g, '');
                  // Limiter à 14 chiffres maximum
                  setSiret(value.slice(0, 14));
                }}
                placeholder="12345678901234"
                required
                helper="14 chiffres obligatoires"
                maxLength={14}
              />
              
              <Input
                label="Raison Sociale"
                type="text"
                value={raisonSociale}
                onChange={(e) => setRaisonSociale(e.target.value)}
                placeholder="Mon Entreprise SARL"
                required
              />
              
              <AddressAutocomplete
                label="Adresse de l'entreprise"
                value={adresse}
                onChange={(value) => setAdresse(value)}
                onAddressSelect={(data) => {
                  setAdresse(data.adresseComplete);
                  setVille(data.ville || ville);
                  setCodePostal(data.codePostal || codePostal);
                }}
                placeholder="123 rue de la République, 75001 Paris"
                required
                helper="Commencez à taper puis sélectionnez une adresse dans la liste"
              />
            </div>
          </div>

          {/* Métiers */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Métiers <span className="text-sm text-gray-500 font-normal">(Sélectionner au moins 1)</span>
            </h2>

            {/* Avertissement blocage si décennale en cours */}
            {decennaleEnCoursVerification && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔒</span>
                  <div className="flex-1">
                    <h4 className="text-red-900 font-semibold mb-1">Modification des métiers temporairement bloquée</h4>
                    <p className="text-sm text-red-800">
                      Votre <strong>attestation de garantie décennale</strong> est actuellement en cours de vérification par notre équipe.
                      Vous ne pouvez pas modifier vos métiers pendant cette période pour éviter toute incohérence.
                    </p>
                    <p className="text-xs text-red-700 mt-2">
                      💡 Vous pourrez modifier vos métiers une fois que votre document aura été validé ou rejeté.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {METIERS_DISPONIBLES.map((metier) => (
                <button
                  key={metier}
                  type="button"
                  onClick={() => !decennaleEnCoursVerification && toggleMetier(metier)}
                  disabled={decennaleEnCoursVerification}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    decennaleEnCoursVerification 
                      ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300 text-gray-500' 
                      : metiers.includes(metier)
                        ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {METIERS_MAP[metier]}
                </button>
              ))}
            </div>

            {/* Avertissement décennale si métiers concernés ET document pas encore uploadé */}
            {metiers.length > 0 && artisanDoitDecennale(metiers) && !artisan?.verificationDocuments?.decennale?.url && (
              <div className="mt-4 bg-yellow-50 border-l-4 border-[#FFC107] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="text-yellow-900 font-semibold mb-1">Garantie Décennale Obligatoire</h4>
                    <p className="text-sm text-yellow-800">
                      Les métiers que vous avez sélectionnés nécessitent une <strong>assurance garantie décennale</strong>.
                      Vous devrez fournir votre attestation dans la section <strong>Documents</strong> pour être vérifié sur la plateforme.
                    </p>
                    <p className="text-xs text-yellow-700 mt-2">
                      Métiers concernés : Maçonnerie, Toiture, Charpente, Menuiserie, Isolation, Plomberie, Électricité, Carrelage, Chauffage, Climatisation
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zone d'intervention */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Zone d'Intervention</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Ville principale avec autocomplétion */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville principale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => {
                    setVille(e.target.value);
                    searchVilles(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Paris, Lyon, Marseille..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  required
                />
                
                {/* Suggestions de villes */}
                {showSuggestions && villeSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {villeSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.nom}-${suggestion.codePostal}-${index}`}
                        type="button"
                        onClick={() => selectVille(suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-orange-50 hover:text-[#FF6B00] transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{suggestion.nom}</div>
                        <div className="text-sm text-gray-500">
                          {suggestion.codePostal} - {suggestion.departement}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rayon d'intervention (km)
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={rayonKm}
                  onChange={(e) => setRayonKm(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5 km</span>
                  <span className="font-bold text-[#FF6B00]">{rayonKm} km</span>
                  <span>100 km</span>
                </div>
              </div>
            </div>
          </div>

          {/* Présentation */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Présentation</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Décrivez votre activité
              </label>
              <textarea
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                placeholder="Expert en plomberie depuis 15 ans, spécialisé dans..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {presentation.length}/500 caractères
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-[#FF6B00] hover:bg-[#E56100]"
              isLoading={isSaving}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </Button>
            
            <Link href="/dashboard" className="flex-1">
              <button
                type="button"
                className="w-full px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
