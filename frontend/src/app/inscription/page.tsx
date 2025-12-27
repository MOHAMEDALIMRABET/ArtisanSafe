'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { Button, Input, Card } from '@/components/ui';

type UserRole = 'client' | 'artisan';

export default function InscriptionPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Formulaire commun
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');

  // Champs spécifiques artisan
  const [entreprise, setEntreprise] = useState('');
  const [siret, setSiret] = useState('');
  const [metiers, setMetiers] = useState<string[]>([]);
  const [metierInput, setMetierInput] = useState('');

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

    if (role === 'artisan' && metiers.length === 0) {
      setError('Veuillez sélectionner au moins un métier');
      return;
    }

    setIsLoading(true);

    try {
      if (role === 'client') {
        await authService.signUpClient({ 
          email, 
          password, 
          firstName: prenom,
          lastName: nom,
          phone: telephone,
          role: 'client'
        });
      } else {
        await authService.signUpArtisan({
          email,
          password,
          firstName: prenom,
          lastName: nom,
          phone: telephone,
          role: 'artisan',
          businessName: entreprise,
          metiers,
          location: {
            address: '',
            city: '',
            postalCode: ''
          }
        });
      }
      
      // Redirection après inscription réussie
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const addMetier = () => {
    if (metierInput && !metiers.includes(metierInput)) {
      setMetiers([...metiers, metierInput]);
      setMetierInput('');
    }
  };

  const removeMetier = (metier: string) => {
    setMetiers(metiers.filter(m => m !== metier));
  };

  const metiersDisponibles = [
    'Plomberie',
    'Électricité',
    'Menuiserie',
    'Maçonnerie',
    'Peinture',
    'Carrelage',
    'Toiture',
    'Chauffage',
  ];

  // Étape 1 : Choix du rôle
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2C3E50] to-[#1A3A5C] flex items-center justify-center p-4">
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
                    Commission 8%
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
    );
  }

  // Étape 2 : Formulaire d'inscription
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <button
          onClick={() => setRole(null)}
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
          />

          {role === 'artisan' && (
            <>
              <Input
                label="Nom de l'entreprise"
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                required
              />

              <Input
                label="SIRET"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                required
                placeholder="14 chiffres"
                helperText="Votre numéro SIRET sera vérifié"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Métiers <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={metierInput}
                    onChange={(e) => setMetierInput(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un métier</option>
                    {metiersDisponibles.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <Button type="button" onClick={addMetier} variant="outline">
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {metiers.map((metier) => (
                    <span
                      key={metier}
                      className="inline-flex items-center px-3 py-1 bg-[#FF6B00] bg-opacity-10 text-[#FF6B00] rounded-full text-sm"
                    >
                      {metier}
                      <button
                        type="button"
                        onClick={() => removeMetier(metier)}
                        className="ml-2 text-[#FF6B00] hover:text-[#E56100]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

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
      </Card>
    </div>
  );
}
