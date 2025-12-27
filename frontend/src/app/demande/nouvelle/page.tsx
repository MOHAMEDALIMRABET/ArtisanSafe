'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createDemande, publierDemande, addArtisansMatches } from '@/lib/firebase/demande-service';
import { notifyArtisanNouvelDemande, sendBulkNotifications } from '@/lib/firebase/notification-service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Timestamp } from 'firebase/firestore';

function NouvelleDemande Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const artisanPreselect = searchParams.get('artisan');

  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    budget: {
      min: 0,
      max: 0,
    },
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validation: max 5 photos, taille < 5MB chacune
    if (photos.length + files.length > 5) {
      alert('Maximum 5 photos autorisées');
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`La photo ${file.name} dépasse 5MB`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert(`Le fichier ${file.name} n'est pas une image`);
        return;
      }
    }

    setPhotos([...photos, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Vous devez être connecté pour créer une demande');
      router.push('/connexion');
      return;
    }

    if (!formData.titre || !formData.description) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      // Récupérer les critères de recherche depuis sessionStorage
      const searchCriteria = sessionStorage.getItem('searchCriteria');
      if (!searchCriteria) {
        alert('Critères de recherche manquants. Veuillez recommencer votre recherche.');
        router.push('/recherche');
        return;
      }

      const criteria = JSON.parse(searchCriteria);

      // TODO: Upload photos vers Firebase Storage
      // Pour le MVP, on stockera juste les noms de fichiers
      const photoUrls: string[] = photos.map(p => p.name);

      // Créer la demande
      const demandeData = {
        clientId: user.uid,
        categorie: criteria.categorie,
        titre: formData.titre,
        description: formData.description,
        localisation: {
          adresse: criteria.adresse || '',
          ville: criteria.ville,
          codePostal: criteria.codePostal,
          coordonneesGPS: criteria.coordonneesGPS,
        },
        datesSouhaitees: {
          dates: criteria.dates.map((d: string) => Timestamp.fromDate(new Date(d))),
          flexible: criteria.flexible,
          flexibiliteDays: criteria.flexibiliteDays,
        },
        urgence: criteria.urgence,
        budget: formData.budget.max > 0 ? formData.budget : undefined,
        photos: photoUrls,
        statut: 'brouillon' as const,
        devisRecus: 0,
        artisansMatches: artisanPreselect ? [artisanPreselect] : [],
      };

      const demandeId = await createDemande(demandeData);

      // Si artisan présélectionné, ajouter le match
      if (artisanPreselect) {
        await addArtisansMatches(demandeId, [artisanPreselect]);
      }

      // Publier la demande (change statut brouillon → publiee ou matchee)
      await publierDemande(demandeId);

      // Envoyer notifications aux artisans matchés
      if (demandeData.artisansMatches.length > 0) {
        try {
          await sendBulkNotifications(
            demandeData.artisansMatches,
            {
              type: 'nouvelle_demande',
              titre: `Nouvelle demande: ${criteria.categorie}`,
              message: `Un client recherche un artisan à ${criteria.ville}. Consultez la demande pour envoyer un devis.`,
              lien: `/demande/${demandeId}`,
            }
          );
        } catch (notifError) {
          console.error('Erreur envoi notifications:', notifError);
          // Ne pas bloquer si notifications échouent
        }
      }

      // Rediriger vers tableau de bord
      alert('✅ Votre demande a été créée ! Les artisans vont recevoir une notification.');
      router.push('/dashboard');

    } catch (error) {
      console.error('Erreur création demande:', error);
      alert('Erreur lors de la création de la demande. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-[#2C3E50] text-white py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Créer votre demande de devis</h1>
          <p className="text-[#95A5A6] mt-2">Complétez les détails de votre projet</p>
        </div>
      </header>

      {/* Formulaire */}
      <main className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <Card className="p-8 mb-6">
            {/* Titre du projet */}
            <section className="mb-6">
              <Input
                label="Titre du projet *"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Rénovation salle de bain complète"
                required
                maxLength={100}
              />
              <p className="text-sm text-[#6C757D] mt-1">
                Un titre clair aidera les artisans à identifier rapidement votre besoin
              </p>
            </section>

            {/* Description détaillée */}
            <section className="mb-6">
              <label className="block text-[#2C3E50] font-semibold mb-2">
                Description détaillée du projet *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez précisément les travaux à réaliser :&#10;- Surface concernée&#10;- Matériaux souhaités&#10;- Contraintes particulières&#10;- Délais souhaités&#10;- Toute autre information utile"
                required
                rows={8}
                maxLength={2000}
                className="w-full px-4 py-3 border border-[#E9ECEF] rounded-lg focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-20 outline-none resize-none"
              />
              <p className="text-sm text-[#6C757D] mt-1">
                {formData.description.length}/2000 caractères
              </p>
            </section>

            {/* Photos */}
            <section className="mb-6">
              <label className="block text-[#2C3E50] font-semibold mb-2">
                Photos du chantier (optionnel)
              </label>
              <div className="border-2 border-dashed border-[#E9ECEF] rounded-lg p-6 text-center hover:border-[#FF6B00] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="text-5xl mb-3">📷</div>
                  <p className="text-[#2C3E50] font-semibold mb-1">
                    Cliquez pour ajouter des photos
                  </p>
                  <p className="text-sm text-[#6C757D]">
                    Maximum 5 photos • 5MB par photo • JPG, PNG
                  </p>
                </label>
              </div>

              {/* Prévisualisation photos */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-[#E9ECEF]"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-[#DC3545] text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Budget */}
            <section className="mb-6">
              <label className="block text-[#2C3E50] font-semibold mb-2">
                Budget estimé (optionnel)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Minimum (€)"
                  value={formData.budget.min || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      budget: { ...formData.budget, min: parseInt(e.target.value) || 0 },
                    })
                  }
                  placeholder="500"
                  min="0"
                />
                <Input
                  type="number"
                  label="Maximum (€)"
                  value={formData.budget.max || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      budget: { ...formData.budget, max: parseInt(e.target.value) || 0 },
                    })
                  }
                  placeholder="2000"
                  min="0"
                />
              </div>
              <p className="text-sm text-[#6C757D] mt-2">
                Indiquer un budget aide les artisans à adapter leurs devis
              </p>
            </section>
          </Card>

          {/* Bandeau sécurité */}
          <Card className="p-6 mb-6 bg-[#E8F5E9] border-l-4 border-[#28A745]">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🔒</div>
              <div>
                <h3 className="font-bold text-[#2C3E50] mb-2">
                  Vos coordonnées sont protégées
                </h3>
                <p className="text-[#6C757D] text-sm">
                  • Vos coordonnées ne seront visibles qu'après signature du contrat<br />
                  • Communication sécurisée via notre messagerie<br />
                  • Paiement par escrow (8% de commission prélevée)
                </p>
              </div>
            </div>
          </Card>

          {/* Boutons */}
          <div className="flex gap-4">
            <Button
              type="button"
              onClick={() => router.back()}
              className="flex-1 border-2 border-[#6C757D] text-[#6C757D] hover:bg-[#6C757D] hover:text-white"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#FF6B00] hover:bg-[#E56100] text-white font-bold"
              disabled={loading}
            >
              {loading ? '⏳ Création...' : '📤 Publier la demande'}
            </Button>
          </div>

          <p className="text-center text-sm text-[#6C757D] mt-4">
            En publiant, vous acceptez nos{' '}
            <a href="/cgu" className="text-[#FF6B00] hover:underline">
              Conditions Générales d'Utilisation
            </a>
          </p>
        </form>
      </main>
    </div>
  );
}

export default function NouvelleDemandePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#FF6B00] border-t-transparent"></div>
      </div>
    }>
      <NouvelleDemande Content />
    </Suspense>
  );
}
