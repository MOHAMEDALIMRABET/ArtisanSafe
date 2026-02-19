'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { checkSiretExists } from '@/lib/firebase/artisan-service';
import { Button, Input, Card } from '@/components/ui';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { METIERS_MAP, METIERS_DISPONIBLES } from '@/lib/constants/metiers';
import { saveSearchContext, createContextFromParams, getSearchContext } from '@/lib/utils/search-context';
import type { Categorie } from '@/types/firestore';

type UserRole = 'client' | 'artisan';

export default function InscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Détecter le rôle depuis l'URL au chargement
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'client' || roleParam === 'artisan') {
      setRole(roleParam);
      
      // Sauvegarder le contexte de recherche si présent
      if (roleParam === 'client') {
        const context = createContextFromParams(searchParams);
        if (context) {
          saveSearchContext(context);
          console.log('✅ Contexte de recherche sauvegardé:', context);
        }
      }
    }
  }, [searchParams]);

  // Formulaire commun
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [representantLegal, setRepresentantLegal] = useState('');
  const [telephone, setTelephone] = useState('');

  // Champs spécifiques artisan
  const [entreprise, setEntreprise] = useState('');
  const [siret, setSiret] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Fonction pour formater le téléphone au format international
  const formatPhoneNumber = (phone: string): string => {
    // Retirer tous les caractères non numériques
    const cleaned = phone.replace(/\D/g, '');
    
    // Si commence par 0 (format français), remplacer par +33
    if (cleaned.startsWith('0')) {
      return '+33' + cleaned.substring(1);
    }
    
    // Si commence par 33, ajouter +
    if (cleaned.startsWith('33')) {
      return '+' + cleaned;
    }
    
    // Si déjà au format +33
    if (phone.startsWith('+33')) {
      return '+33' + cleaned.substring(2);
    }
    
    // Par défaut, ajouter +33 (France)
    return '+33' + cleaned;
  };

  // Validation du numéro de téléphone français
  const isValidFrenchPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    // Doit commencer par 0 et avoir 10 chiffres, OU commencer par 33 et avoir 11 chiffres
    return (cleaned.startsWith('0') && cleaned.length === 10) ||
           (cleaned.startsWith('33') && cleaned.length === 11);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    // Validation du téléphone
    if (!isValidFrenchPhone(telephone)) {
      setError('Le numéro de téléphone doit être un numéro français valide (10 chiffres commençant par 0)');
      return;
    }

    if (role === 'artisan' && !representantLegal.trim()) {
      setError('Le nom du représentant légal est obligatoire pour vérifier votre KBIS');
      return;
    }

    // Validation du code postal français (5 chiffres)
    if (role === 'artisan' && postalCode && !/^\d{5}$/.test(postalCode)) {
      setError('Le code postal doit être composé de 5 chiffres');
      return;
    }

    // Vérifier l'unicité du SIRET pour les artisans
    if (role === 'artisan' && siret.trim()) {
      // 0. ⚠️ VALIDATION STRICTE : SIRET doit avoir EXACTEMENT 14 chiffres
      const cleanSiret = siret.replace(/\s/g, '');
      if (!/^\d{14}$/.test(cleanSiret)) {
        setError('Vérifiez que votre SIRET est correct et que votre entreprise est active.');
        return;
      }

      // 1. Vérifier que le SIRET n'existe pas déjà dans notre base
      try {
        const siretExists = await checkSiretExists(cleanSiret);
        if (siretExists) {
          setError('Ce numéro SIRET est déjà utilisé par un autre artisan. Veuillez vérifier votre saisie.');
          return;
        }
      } catch (error) {
        console.error('Erreur vérification SIRET:', error);
        setError('Impossible de vérifier le SIRET. Veuillez réessayer.');
        return;
      }

      // ✅ VALIDATION MANUELLE PAR ADMIN
      // La raison sociale, le SIRET et l'adresse sont acceptés tels quels
      // L'admin vérifiera lors de la validation des documents (KBIS, etc.)
      console.log('✅ Inscription artisan - Données acceptées pour vérification manuelle admin');
      console.log(`📝 SIRET: ${siret.trim()}`);
      console.log(`🏢 Raison sociale: ${entreprise.trim()}`);
      console.log(`📍 Adresse: ${address}, ${postalCode} ${city}`);
      console.log('ℹ️  Admin vérifiera lors validation documents KBIS');

      /* ========================================
       * 🔒 VÉRIFICATION API SIRENE DÉSACTIVÉE
       * ========================================
       * Code commenté - Réactiver si besoin futur
       * 
      // 2. Vérifier l'adéquation SIRET + Raison Sociale via API SIRENE publique
      // ⚠️ Vérification optionnelle - L'artisan pourra compléter la vérification plus tard
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        console.log('🔍 Tentative de vérification SIRET lors de l\'inscription...');
        
        const response = await fetch(`${apiUrl}/sirene/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            siret: siret.trim(),
            raisonSociale: entreprise.trim()
          })
        });

        const result = await response.json();

        if (!result.success) {
          console.warn('⚠️ Vérification SIRET échouée à l\'inscription:', result.error);
          // Ne pas bloquer l'inscription - l'artisan pourra vérifier plus tard
          console.log('ℹ️ L\'artisan pourra vérifier son SIRET depuis la page de vérification');
        } else {
          console.log('✅ SIRET vérifié à l\'inscription:', result.data);
        }
      } catch (error) {
        console.error('⚠️ Erreur vérification SIRENE lors de l\'inscription:', error);
        // Ne pas bloquer l'inscription en cas d'erreur réseau
        console.log('ℹ️ Vérification SIRET ignorée - L\'artisan pourra vérifier plus tard');
      }
      */
    }

    // Formater le téléphone au format international
    const formattedPhone = formatPhoneNumber(telephone);

    setIsLoading(true);

    try {
      if (role === 'client') {
        await authService.signUpClient({ 
          email, 
          password, 
          firstName: prenom,
          lastName: nom,
          phone: formattedPhone,
          role: 'client'
        });
        
        // Rediriger vers le formulaire de demande si contexte de recherche existe
        const context = getSearchContext();
        if (context) {
          router.push('/demande/publique/nouvelle');
        } else {
          router.push('/dashboard');
        }
      } else {
        await authService.signUpArtisan({
          email,
          password,
          firstName: prenom,
          lastName: nom,
          representantLegal: representantLegal,
          phone: formattedPhone,
          role: 'artisan',
          businessName: entreprise,
          siret: siret,
          metiers: [],
          location: {
            address: address.trim(),
            city: city.trim(),
            postalCode: postalCode.trim()
          }
        });
        router.push('/artisan/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const metiersDisponibles = METIERS_DISPONIBLES;

  // Étape 1 : Choix du rôle
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C]">
        <div className="flex items-center justify-center p-4 py-16">
          <Card className="max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Bienvenue sur Artisan Dispo
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Choisissez votre profil pour commencer
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Carte Client */}
            <button
              onClick={() => setRole('client')}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#FF6B00] hover:shadow-lg transition-all group text-left"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#E56100] transition-colors">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Client</h3>
                <p className="text-sm text-gray-600 text-center">
                  Je cherche un artisan pour mes travaux
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Gratuit à vie
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Recherche illimitée
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Devis gratuits
                  </li>
                </ul>
              </div>
            </button>

            {/* Carte Artisan */}
            <button
              onClick={() => setRole('artisan')}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#FF6B00] hover:shadow-lg transition-all group text-left"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Artisan</h3>
                <p className="text-sm text-gray-600 text-center">
                  Je propose mes services professionnels
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Inscription gratuite
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Visibilité locale
                  </li>
                </ul>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link href="/connexion" className="text-[#FF6B00] hover:underline font-medium">
                Se connecter
              </Link>
            </p>
          </div>
        </Card>
        </div>
      </div>
    );
  }

  // Étape 2 : Formulaire d'inscription
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="container mx-auto px-4 py-8 max-w-md">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Inscription {role === 'client' ? 'Client' : 'Artisan'}
        </h2>
        <p className="text-gray-600 mb-6">
          Créez votre compte pour commencer
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="votre@email.com"
          />

          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 6 caractères"
          />

          <Input
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prénom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
            />
            <Input
              label="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
          </div>

          <Input
            label="Téléphone"
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            required
            placeholder="06 12 34 56 78"
            helperText="10 chiffres commençant par 0"
          />

          {role === 'artisan' && (
            <>
              <Input
                label="Raison Sociale"
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                required
              />

              <Input
                label="Représentant légal"
                value={representantLegal}
                onChange={(e) => setRepresentantLegal(e.target.value)}
                required
                placeholder="Nom complet (ex: Pierre DUPONT)"
                helperText="Doit correspondre au nom figurant sur votre KBIS"
              />

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
                required
                placeholder="14 chiffres (ex: 12345678901234)"
                helperText="Format français : exactement 14 chiffres"
                pattern="\d{14}"
                minLength={14}
                maxLength={14}
              />

              <AddressAutocomplete
                label="Adresse de l'entreprise"
                value={address}
                onChange={(value) => setAddress(value)}
                onAddressSelect={(data) => {
                  setAddress(data.adresseComplete);
                  setCity(data.ville || city);
                  setPostalCode(data.codePostal || postalCode);
                }}
                required
                placeholder="123 rue de la République"
                helper="Suggestions automatiques via l’API adresse"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ville"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="Paris"
                />
                <Input
                  label="Code postal"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  placeholder="75001"
                  maxLength={5}
                  helperText="5 chiffres"
                />
              </div>
            </>
          )}

          {/* Consentement */}
          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                required
                className="mt-1 w-4 h-4 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                J'accepte les{' '}
                <Link 
                  href="/confiance/conditions-generales" 
                  className="text-[#FF6B00] hover:underline font-medium"
                  target="_blank"
                >
                  conditions générales d'utilisation
                </Link>
                {' '}et consens à l'exploitation de mes données personnelles
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            S'inscrire
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Vous avez déjà un compte ?{' '}
          <Link href="/connexion" className="text-blue-600 hover:underline font-medium">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
