'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getUserById, updateUser } from '@/lib/firebase/user-service';
import { Logo } from '@/components/ui';
import type { User } from '@/types/firestore';

export default function ProfilClientPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userData, setUserData] = useState<User | null>(null);

  // Formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      router.push('/connexion');
      return;
    }

    if (authUser.role !== 'client') {
      router.push('/');
      return;
    }

    loadUserProfile();
  }, [authUser, authLoading, router]);

  async function loadUserProfile() {
    if (!authUser) return;

    try {
      setIsLoading(true);
      setError('');

      const user = await getUserById(authUser.uid);
      if (!user) {
        setError('Profil introuvable');
        return;
      }

      setUserData(user);
      setNom(user.nom || '');
      setPrenom(user.prenom || '');
      setEmail(user.email || '');
      setTelephone(user.telephone || '');
    } catch (err: any) {
      console.error('Erreur chargement profil:', err);
      setError(err.message || 'Erreur lors du chargement du profil');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!authUser || !userData) return;

    // Validation
    if (!nom.trim() || !prenom.trim()) {
      setError('Le nom et le prénom sont obligatoires');
      return;
    }

    if (!telephone.trim()) {
      setError('Le téléphone est obligatoire');
      return;
    }

    // Validation téléphone (format français)
    const phoneRegex = /^(?:(?:\+|00)33|0)[1-9](?:[0-9]{8})$/;
    if (!phoneRegex.test(telephone.replace(/[\s.-]/g, ''))) {
      setError('Format de téléphone invalide (ex: 06 12 34 56 78)');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      await updateUser(authUser.uid, {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim(),
      });

      setSuccess('✅ Profil mis à jour avec succès !');
      
      // Recharger le profil
      await loadUserProfile();

      // Auto-masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Erreur mise à jour profil:', err);
      setError(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setIsSaving(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-[#6C757D]">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="sm" variant="icon" />
              <span className="text-xl font-bold">ArtisanDispo</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/client/demandes" className="hover:text-[#FF6B00] transition">
                Mes demandes
              </Link>
              <Link href="/client/devis" className="hover:text-[#FF6B00] transition">
                Mes devis
              </Link>
              <Link href="/client/avis" className="hover:text-[#FF6B00] transition">
                Mes avis
              </Link>
              <Link href="/profil" className="text-[#FF6B00] font-semibold">
                Mon profil
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Titre */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">Mon profil</h1>
          <p className="text-[#6C757D]">Gérez vos informations personnelles</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Formulaire */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom */}
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-[#2C3E50] mb-2">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                required
              />
            </div>

            {/* Prénom */}
            <div>
              <label htmlFor="prenom" className="block text-sm font-medium text-[#2C3E50] mb-2">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                required
              />
            </div>

            {/* Email (non modifiable) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#2C3E50] mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-[#6C757D]">
                L'email ne peut pas être modifié
              </p>
            </div>

            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-[#2C3E50] mb-2">
                Téléphone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                required
              />
            </div>

            {/* Informations compte */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-[#2C3E50] mb-4">Informations du compte</h3>
              <div className="space-y-2 text-sm">
                <p className="text-[#6C757D]">
                  <span className="font-medium">Type de compte :</span> Client
                </p>
                <p className="text-[#6C757D]">
                  <span className="font-medium">Statut :</span>{' '}
                  {userData?.statut === 'verifie' ? (
                    <span className="text-green-600">✓ Vérifié</span>
                  ) : (
                    <span className="text-orange-600">En attente de vérification</span>
                  )}
                </p>
                <p className="text-[#6C757D]">
                  <span className="font-medium">Membre depuis :</span>{' '}
                  {userData?.dateCreation?.toDate?.().toLocaleDateString('fr-FR') || 'N/A'}
                </p>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
              <Link
                href="/client/demandes"
                className="flex-1 bg-gray-200 text-[#2C3E50] px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition text-center"
              >
                Annuler
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
