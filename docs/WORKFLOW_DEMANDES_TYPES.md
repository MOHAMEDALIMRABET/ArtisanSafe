# 🔄 Workflow Complet - Types de Demandes

## 📋 Analyse de l'Existant

### Structure Actuelle (Code Existant)

**Collections Firestore** :
```typescript
// Collection: demandes
{
  id: string;
  clientId: string;
  categorie: Categorie;  // 'plomberie', 'electricite', etc.
  titre: string;
  description: string;
  localisation: {
    adresse: string;
    ville: string;
    codePostal: string;
    coordonneesGPS?: { latitude, longitude };
  };
  datesSouhaitees: {
    dates: Timestamp[];
    flexible: boolean;
    flexibiliteDays?: number;
    urgence: Urgence;
  };
  budgetIndicatif?: number;
  photosUrls?: string[];
  
  // Statut actuel
  statut: 'brouillon' | 'publiee' | 'matchee' | 'en_cours' | 'attribuee' | 'expiree' | 'terminee' | 'annulee';
  
  // Artisans
  artisansMatches?: string[];  // IDs artisans ayant reçu la demande
  
  // Devis
  devisRecus?: number;
  devisAccepteId?: string;
  artisanAttributaireId?: string;
  
  // Refus
  artisanRefuseId?: string;
  artisanRefuseNom?: string;
  dateRefus?: Timestamp;
  
  // Dates
  dateExpiration?: Timestamp;
  dateAttribution?: Timestamp;
  dateCreation: Timestamp;
  dateModification: Timestamp;
}
```

### Workflow Actuel (DIRECTE uniquement)

```
Client cherche artisan
       ↓
/recherche → Critères (métier, ville, dates)
       ↓
/resultats → Liste artisans disponibles
       ↓
Client clique "Demander un devis" sur profil artisan
       ↓
/demande/nouvelle?artisan=<UID>
       ↓
Client remplit formulaire:
  - Titre (min 10 caractères)
  - Description (min 50 caractères)
  - Budget indicatif (optionnel)
  - Photos (max 5, < 5MB chacune)
       ↓
createDemande({ statut: 'brouillon', artisansMatches: [artisanUID] })
       ↓
publierDemande() → statut = 'publiee'
       ↓
Notification envoyée à l'artisan ciblé
       ↓
Artisan voit demande dans /artisan/demandes (section "Nouvelles")
       ↓
Artisan envoie devis
       ↓
Client accepte + paie → statut = 'attribuee'
```

**Caractéristiques** :
- ✅ Client **choisit l'artisan** avant de créer la demande
- ✅ **1 seul artisan** reçoit la demande (artisansMatches = [1 ID])
- ✅ Workflow **simple et rapide**
- ✅ **DÉJÀ IMPLÉMENTÉ** et fonctionnel

---

## 🆕 Nouveau Système - 2 Types de Demandes

### Modification de la Structure (ADDITIVE - pas de breaking change)

```typescript
export interface Demande {
  // ... tous les champs existants ...
  
  // ⭐ NOUVEAU : Type de demande
  type?: 'directe' | 'publique';  // Optionnel pour rétrocompatibilité (défaut = 'directe')
  
  // ⭐ NOUVEAU : Pour demandes publiques
  artisansNotifiesIds?: string[];  // Artisans déjà notifiés (éviter doublons)
  artisansInteressesIds?: string[];  // Artisans ayant consulté la demande
  critereRecherche?: {  // Critères pour matching automatique
    metier: string;
    ville: string;
    rayon?: number;  // En km (défaut = 50km)
  };
}
```

**Migration automatique** : Toutes les demandes existantes sont considérées comme `type: 'directe'` par défaut.

---

## 🔄 Workflows Détaillés

### Workflow A : Demande DIRECTE (existant - pas de modification)

**URL** : `/demande/nouvelle?artisan=<UID>`

```
1. Client cherche artisan
   /recherche → Critères → /resultats
   
2. Client sélectionne UN artisan
   Clique "Demander un devis" sur profil artisan
   
3. Formulaire demande
   URL: /demande/nouvelle?artisan=<UID>
   - Titre
   - Description
   - Budget indicatif (optionnel)
   - Photos (optionnel)
   [Annuler] [Envoyer la demande]
   
4. createDemande({
     type: 'directe',           // ← NOUVEAU champ
     statut: 'brouillon',
     artisansMatches: [artisanUID],
     critereRecherche: {        // ← NOUVEAU : sauvegarde critères
       metier: criteria.categorie,
       ville: criteria.ville,
       rayon: null  // Pas de rayon pour directe
     }
   })
   
5. publierDemande() → statut = 'publiee'
   
6. Notification artisan ciblé
   notifyArtisanNouvelDemande(artisanUID, ...)
   
7. Artisan consulte /artisan/demandes
   Section "Nouvelles" : where('artisansMatches', 'array-contains', artisanUID)
   
8. Artisan envoie devis
   
9. Client accepte + paie
   statut → 'attribuee'
   artisanAttributaireId = artisanUID
```

**Code existant** : **AUCUNE MODIFICATION** nécessaire, juste ajouter `type: 'directe'` lors de la création.

---

### Workflow B : Demande PUBLIQUE (nouveau - marketplace)

**URL** : `/demande/publique/nouvelle`

```
1. Client accède au formulaire demande publique
   /demande/publique/nouvelle
   
2. Formulaire demande publique
   - Métier recherché: [Plomberie ▼]
   - Ville: [Paris]
   - Rayon: [10 km] [25 km] [50 km] [100 km]
   - Titre
   - Description
   - Budget indicatif (optionnel)
   - Photos (optionnel)
   - Dates souhaitées + flexibilité
   
   ⚠️ Votre demande sera visible aux artisans correspondants
   
   [Annuler] [📢 Publier la demande]
   
3. createDemande({
     type: 'publique',          // ← NOUVEAU
     statut: 'publiee',         // ← Direct (pas de brouillon)
     artisansMatches: [],       // ← Vide au départ
     artisansNotifiesIds: [],   // ← NOUVEAU
     critereRecherche: {        // ← NOUVEAU
       metier: formData.metier,
       ville: formData.ville,
       rayon: formData.rayon || 50
     }
   })
   
4. Matching immédiat (fonction Cloud ou serveur)
   matchDemandeWithArtisans(demandeId) {
     // Chercher artisans existants qui matchent
     const artisans = await getArtisansByMetierAndLocation(
       critereRecherche.metier,
       critereRecherche.ville,
       critereRecherche.rayon
     );
     
     if (artisans.length > 0) {
       // Notifier tous les artisans matchant
       await sendBulkNotifications(artisans, ...);
       
       // Marquer comme notifiés
       await updateDemande(demandeId, {
         artisansNotifiesIds: artisans.map(a => a.userId)
       });
     }
   }
   
5. Demande reste ACTIVE (pas d'expiration automatique)
   Visible dans espace client : "Demandes publiques"
   
6. [TEMPS PASSE - Jours/Semaines plus tard]
   
7. NOUVEL artisan s'inscrit sur la plateforme
   Cloud Function: onArtisanCreated/onArtisanUpdated
   
8. Vérification matching avec demandes publiques actives
   exports.onArtisanVerified = functions.firestore
     .document('artisans/{artisanId}')
     .onUpdate(async (change, context) => {
       const artisan = change.after.data();
       
       // Seulement si artisan vient d'être vérifié
       if (!change.before.data().verified && artisan.verified) {
         await checkDemandesPubliquesMatchant(artisan);
       }
     });
   
9. checkDemandesPubliquesMatchant(artisan) {
     // Chercher demandes publiques actives
     const demandes = await getDemandes({
       type: 'publique',
       statut: 'publiee',
       metier: artisan.metiers[0],  // Simplification
       ville: artisan.location.city
     });
     
     for (const demande of demandes) {
       // Vérifier si artisan pas déjà notifié
       if (!demande.artisansNotifiesIds.includes(artisan.userId)) {
         
         // Vérifier distance
         const distance = calculateDistance(
           artisan.location.coordinates,
           demande.localisation.coordonneesGPS
         );
         
         if (distance <= demande.critereRecherche.rayon) {
           // Envoyer notification
           await createNotification(artisan.userId, {
             type: 'nouvelle_demande_publique',
             titre: 'Nouvelle demande correspond à votre profil !',
             message: `Un client cherche un ${demande.categorie} à ${demande.localisation.ville}`,
             lien: `/artisan/demandes?demandeId=${demande.id}`,
           });
           
           // Marquer comme notifié
           await updateDemande(demande.id, {
             artisansNotifiesIds: FieldValue.arrayUnion(artisan.userId)
           });
         }
       }
     }
   }
   
10. Artisan consulte /artisan/demandes
    Section "Demandes publiques" (nouveau)
    
11. Artisan clique "Consulter"
    → Ajout à artisansInteressesIds
    → Affiche formulaire devis
    
12. Artisan envoie devis
    → incrementDevisRecus(demandeId)
    → Notification client
    
13. Client compare tous les devis reçus
    /client/devis → Liste devis pour cette demande
    
14. Client accepte UN devis + paie
    → statut → 'attribuee'
    → artisanAttributaireId = artisan choisi
    → TOUS les autres devis → statut = 'refuse' (auto)
    → Notifications envoyées
```

---

## 📊 Comparaison des 2 Types

| Critère | Demande DIRECTE | Demande PUBLIQUE |
|---------|-----------------|------------------|
| **Client choisit artisan** | ✅ OUI (avant création) | ❌ NON (après devis) |
| **Nombre d'artisans notifiés** | 1 seul | Plusieurs (matching) |
| **Workflow** | Simple et rapide | Comparaison et choix |
| **Notifications** | 1 fois (création) | Continue (nouveaux artisans) |
| **Expiration** | Oui (dateExpiration) | Non (reste active) |
| **Page création** | /demande/nouvelle?artisan=UID | /demande/publique/nouvelle |
| **Visibilité artisan** | Demande ciblée | Demande publique ouverte |
| **Use case** | Client connaît l'artisan | Client veut comparer |

---

## 🎯 Interface Utilisateur

### Côté CLIENT

#### Page : Choix du type de demande

**URL** : `/demande/choisir-type`

```tsx
┌─────────────────────────────────────────────────┐
│ Comment souhaitez-vous procéder ?              │
├─────────────────────────────────────────────────┤
│                                                 │
│  🎯 Demande directe à un artisan                │
│     "Je sais qui je veux contacter"             │
│     ✓ Rapide et simple                          │
│     ✓ 1 seul artisan contacté                   │
│     ✓ Réponse généralement sous 48h             │
│                                                 │
│     [Rechercher un artisan →]                   │
│                                                 │
│  📢 Publier une demande ouverte                 │
│     "Je veux comparer plusieurs devis"          │
│     ✓ Plusieurs artisans répondent              │
│     ✓ Vous comparez et choisissez               │
│     ✓ Notifications continues si nouveaux       │
│        artisans correspondent                   │
│                                                 │
│     [Publier une demande →]                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Mes demandes - Onglets

```tsx
┌─────────────────────────────────────────────────┐
│ 📋 Mes demandes                                 │
├─────────────────────────────────────────────────┤
│ [Demandes directes (5)] [Demandes publiques (2)]│
├─────────────────────────────────────────────────┤
│                                                 │
│ ⭐ Demande directe - Plomberie                  │
│    📍 Paris 15e                                 │
│    👷 Artisan: Plomberie Dupont                 │
│    📊 Statut: En attente de devis               │
│    📅 Créée le 02/02/2026                       │
│                                                 │
│ ⭐ Demande publique - Électricité               │
│    📍 Lyon 3e (rayon 25km)                      │
│    👷 3 artisans notifiés                       │
│    📊 Statut: 2 devis reçus                     │
│    📅 Publiée le 28/01/2026                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Côté ARTISAN

#### Page : /artisan/demandes

```tsx
┌─────────────────────────────────────────────────┐
│ 📬 Demandes                                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📨 Demandes directes (5)                        │
│    Demandes envoyées spécifiquement à vous      │
│    par des clients                              │
│                                                 │
│    ⭐ Plomberie - Paris 15e                     │
│       Client: Jean Martin                       │
│       📅 02/02/2026                             │
│       [Consulter] [Envoyer un devis]            │
│                                                 │
│ 📢 Demandes publiques (12) [NOUVEAU]            │
│    Demandes ouvertes correspondant à votre      │
│    profil (métier + zone géographique)          │
│                                                 │
│    ⭐ Électricité - Lyon 3e                     │
│       Rayon: 25km de votre position             │
│       📊 2 devis déjà envoyés par d'autres      │
│       📅 28/01/2026                             │
│       [Consulter] [Envoyer un devis]            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 💻 Implémentation Technique

### 1. Modification Types TypeScript

**Fichier** : `frontend/src/types/firestore.ts`

```typescript
export type DemandeType = 'directe' | 'publique';

export interface CritereRecherche {
  metier: string;
  ville: string;
  rayon?: number;  // En km (pour publique)
}

export interface Demande {
  // ... tous les champs existants ...
  
  // ⭐ NOUVEAU
  type?: DemandeType;  // 'directe' | 'publique' (défaut = 'directe' pour rétrocompatibilité)
  
  // Pour demandes publiques
  artisansNotifiesIds?: string[];  // Artisans déjà notifiés
  artisansInteressesIds?: string[];  // Artisans ayant consulté
  critereRecherche?: CritereRecherche;  // Critères de matching
}
```

### 2. Service de Matching

**Fichier** : `frontend/src/lib/firebase/matching-service.ts`

```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import type { Artisan, Demande } from '@/types/firestore';

/**
 * Chercher artisans qui matchent une demande publique
 */
export async function findMatchingArtisans(
  demande: Demande
): Promise<Artisan[]> {
  if (!demande.critereRecherche) return [];
  
  const { metier, ville, rayon = 50 } = demande.critereRecherche;
  
  // Requête Firestore simple (éviter index composite)
  const artisansRef = collection(db, 'artisans');
  const q = query(
    artisansRef,
    where('metiers', 'array-contains', metier),
    where('verificationStatus', '==', 'approved')
  );
  
  const snapshot = await getDocs(q);
  const artisans = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Artisan));
  
  // Filtrage distance côté client
  if (demande.localisation?.coordonneesGPS) {
    return artisans.filter(artisan => {
      if (!artisan.location?.coordinates) return false;
      
      const distance = calculateDistance(
        demande.localisation.coordonneesGPS!,
        artisan.location.coordinates
      );
      
      return distance <= rayon;
    });
  }
  
  // Si pas de coordonnées, filtrer par ville uniquement
  return artisans.filter(a => a.location.city === ville);
}

/**
 * Calculer distance entre 2 points (formule Haversine)
 */
function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
    Math.cos(toRad(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Notifier artisans matchant une demande publique
 */
export async function notifyMatchingArtisans(
  demande: Demande,
  artisans: Artisan[]
): Promise<void> {
  const { sendBulkNotifications } = await import('./notification-service');
  
  const artisanIds = artisans.map(a => a.userId);
  
  await sendBulkNotifications(artisanIds, {
    type: 'nouvelle_demande_publique',
    titre: `Nouvelle demande : ${demande.categorie}`,
    message: `Un client cherche un ${demande.categorie} à ${demande.localisation.ville}`,
    lien: `/artisan/demandes?demandeId=${demande.id}`,
  });
}
```

### 3. Cloud Function : Matching Automatique Nouveaux Artisans

**Fichier** : `functions/src/index.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered quand un artisan est créé ou vérifié
 * Cherche demandes publiques actives qui matchent
 */
export const onArtisanVerified = functions.firestore
  .document('artisans/{artisanId}')
  .onUpdate(async (change, context) => {
    const artisanBefore = change.before.data();
    const artisanAfter = change.after.data();
    
    // Seulement si artisan vient d'être vérifié
    if (artisanBefore.verificationStatus !== 'approved' && 
        artisanAfter.verificationStatus === 'approved') {
      
      console.log(`✅ Artisan ${context.params.artisanId} vient d'être vérifié`);
      
      // Chercher demandes publiques actives
      const demandesSnapshot = await db.collection('demandes')
        .where('type', '==', 'publique')
        .where('statut', '==', 'publiee')
        .where('critereRecherche.metier', 'in', artisanAfter.metiers)
        .get();
      
      console.log(`📋 ${demandesSnapshot.size} demandes publiques actives trouvées`);
      
      for (const demandeDoc of demandesSnapshot.docs) {
        const demande = demandeDoc.data();
        
        // Vérifier si artisan pas déjà notifié
        const artisansNotifies = demande.artisansNotifiesIds || [];
        if (artisansNotifies.includes(artisanAfter.userId)) {
          console.log(`⏭️  Artisan déjà notifié pour demande ${demandeDoc.id}`);
          continue;
        }
        
        // Vérifier distance si coordonnées disponibles
        if (demande.localisation?.coordonneesGPS && 
            artisanAfter.location?.coordinates) {
          
          const distance = calculateDistance(
            demande.localisation.coordonneesGPS,
            artisanAfter.location.coordinates
          );
          
          const rayon = demande.critereRecherche?.rayon || 50;
          
          if (distance > rayon) {
            console.log(`📏 Distance trop grande (${distance}km > ${rayon}km)`);
            continue;
          }
          
          console.log(`✅ Match ! Distance: ${distance}km <= ${rayon}km`);
        }
        
        // Envoyer notification
        await db.collection('notifications').add({
          recipientId: artisanAfter.userId,
          type: 'nouvelle_demande_publique',
          titre: 'Nouvelle demande correspond à votre profil !',
          message: `Un client cherche un ${demande.categorie} à ${demande.localisation.ville}`,
          lien: `/artisan/demandes?demandeId=${demandeDoc.id}`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Marquer artisan comme notifié
        await demandeDoc.ref.update({
          artisansNotifiesIds: admin.firestore.FieldValue.arrayUnion(artisanAfter.userId)
        });
        
        console.log(`🔔 Notification envoyée pour demande ${demandeDoc.id}`);
      }
    }
  });

function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
    Math.cos(toRad(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

### 4. Page Création Demande Publique

**Fichier** : `frontend/src/app/demande/publique/nouvelle/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createDemande } from '@/lib/firebase/demande-service';
import { findMatchingArtisans, notifyMatchingArtisans } from '@/lib/firebase/matching-service';
import { updateDemande } from '@/lib/firebase/demande-service';
import type { Categorie } from '@/types/firestore';

export default function NouvelleDemandePubliquePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    metier: 'plomberie' as Categorie,
    ville: '',
    codePostal: '',
    rayon: 50, // km
    titre: '',
    description: '',
    budgetIndicatif: 0,
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/connexion');
      return;
    }
    
    setLoading(true);
    
    try {
      // Créer demande publique
      const demande = await createDemande({
        type: 'publique',  // ← NOUVEAU
        statut: 'publiee', // Direct (pas de brouillon)
        clientId: user.uid,
        categorie: formData.metier,
        titre: formData.titre,
        description: formData.description,
        localisation: {
          ville: formData.ville,
          codePostal: formData.codePostal,
          adresse: '',
        },
        critereRecherche: {  // ← NOUVEAU
          metier: formData.metier,
          ville: formData.ville,
          rayon: formData.rayon,
        },
        budgetIndicatif: formData.budgetIndicatif > 0 ? formData.budgetIndicatif : undefined,
        artisansMatches: [],  // Vide au départ
        artisansNotifiesIds: [],  // ← NOUVEAU
        artisansInteressesIds: [],  // ← NOUVEAU
      });
      
      // Matching immédiat avec artisans existants
      const artisansMatching = await findMatchingArtisans(demande);
      
      if (artisansMatching.length > 0) {
        // Notifier les artisans matchant
        await notifyMatchingArtisans(demande, artisansMatching);
        
        // Mettre à jour demande
        await updateDemande(demande.id, {
          artisansNotifiesIds: artisansMatching.map(a => a.userId),
        });
        
        alert(`✅ Demande publiée !\n\n${artisansMatching.length} artisan(s) ont été notifiés.`);
      } else {
        alert(
          `✅ Demande publiée !\n\n` +
          `Aucun artisan disponible pour le moment.\n` +
          `Vous serez notifié dès qu'un artisan correspondant s'inscrira.`
        );
      }
      
      router.push('/client/demandes');
    } catch (error) {
      console.error('Erreur création demande publique:', error);
      alert('Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Formulaire détaillé avec tous les champs */}
    </form>
  );
}
```

### 5. Modification Page Artisan Demandes

**Fichier** : `frontend/src/app/artisan/demandes/page.tsx`

Ajouter filtrage par type :

```typescript
// État
const [typeFilter, setTypeFilter] = useState<'toutes' | 'directes' | 'publiques'>('toutes');

// Fonction loadData - Charger TOUTES les demandes (directes + publiques)
async function loadData() {
  if (!authUser) return;
  
  // Demandes directes (existant)
  const demandesDirectes = await getDemandesForArtisan(authUser.uid);
  
  // Demandes publiques (nouveau)
  const demandesPubliques = await getDemandesPubliques(authUser.uid);
  
  setDemandes([...demandesDirectes, ...demandesPubliques]);
}

// Filtrage
const filteredByType = demandes.filter(d => {
  if (typeFilter === 'directes') return d.type === 'directe' || !d.type;
  if (typeFilter === 'publiques') return d.type === 'publique';
  return true;
});

// Boutons filtres
<button onClick={() => setTypeFilter('toutes')}>
  Toutes ({demandes.length})
</button>
<button onClick={() => setTypeFilter('directes')}>
  📨 Directes ({demandes.filter(d => d.type === 'directe' || !d.type).length})
</button>
<button onClick={() => setTypeFilter('publiques')}>
  📢 Publiques ({demandes.filter(d => d.type === 'publique').length})
</button>
```

---

## ✅ Plan de Migration (Sans Breaking Changes)

### Phase 1 : Types et Infrastructure (1-2h)
- [ ] Ajouter champs optionnels dans `Demande` interface
- [ ] Créer `matching-service.ts`
- [ ] Créer types `DemandeType`, `CritereRecherche`

### Phase 2 : Workflow Existant (30min)
- [ ] Modifier `/demande/nouvelle` pour ajouter `type: 'directe'`
- [ ] Aucune modification du workflow actuel
- [ ] Test : Vérifier que demandes directes fonctionnent toujours

### Phase 3 : Workflow Publique (2-3h)
- [ ] Créer `/demande/publique/nouvelle`
- [ ] Implémenter formulaire demande publique
- [ ] Implémenter matching immédiat
- [ ] Test : Créer demande publique et vérifier notifications

### Phase 4 : Cloud Functions (1-2h)
- [ ] Implémenter `onArtisanVerified`
- [ ] Tester matching automatique nouveaux artisans
- [ ] Déployer : `firebase deploy --only functions`

### Phase 5 : UI Artisan (1h)
- [ ] Modifier `/artisan/demandes` : ajouter filtre type
- [ ] Distinguer visuellement demandes directes vs publiques
- [ ] Test : Artisan voit les 2 types

### Phase 6 : UI Client (1h)
- [ ] Créer `/demande/choisir-type`
- [ ] Modifier `/client/demandes` : onglets séparés
- [ ] Test : Client voit ses demandes par type

---

## 🎯 Résumé

### Ce qui NE CHANGE PAS
- ✅ Workflow actuel (demande directe) fonctionne exactement pareil
- ✅ Structure Firestore existante compatible
- ✅ Aucune migration de données nécessaire
- ✅ Code existant fonctionne sans modification

### Ce qui est NOUVEAU
- ⭐ Option "demande publique" (marketplace)
- ⭐ Matching automatique continu (nouveaux artisans)
- ⭐ Notifications progressives
- ⭐ Cloud Function pour matching asynchrone
- ⭐ Filtres par type dans UI

### Avantages
- 🚀 Flexibilité pour les clients (2 options)
- 🎯 Meilleure couverture (matching continu)
- 💰 Plus de devis = plus de transactions
- ⚡ Notifications intelligentes (pas de spam)
- 🔧 Migration progressive sans risque
