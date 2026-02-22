# Guide de Migration i18n - ArtisanDispo

## 📋 Résumé

Ce guide documente la migration complète du système de traduction de la plateforme ArtisanDispo pour supporter le français et l'anglais.

## ✅ Ce qui a été fait

### 1. Infrastructure i18n

- ✅ `LanguageContext` créé avec provider React
- ✅ `LanguageSelector` avec drapeaux FR/GB fonctionnel  
- ✅ Traductions complètes dans `fr.json` et `en.json` (1937+ lignes)
- ✅ Fonction `useLanguage()` expose : `t()`, `formatDate()`, `formatDateTime()`, `formatTime()`
- ✅ Utilitaires de formatage dans `lib/i18n-utils.ts`
- ✅ Section complète "alerts" ajoutée avec 80+ clés traduites

### 2. Fichiers de traduction

#### Fichiers complétés :
- `frontend/src/locales/fr.json` - ✅ Complet (1937 lignes)
- `frontend/src/locales/en.json` - ✅ Complet (1938 lignes)

#### Sections principales :
- `common` - Mots courants
- `nav` - Navigation
- `auth` - Authentification
- `alerts` - **NOUVEAU** - Messages alert() (80+ clés)
- `userMenu` - Menu utilisateur
- `dashboard` - Tableaux de bord
- `devis` - Devis/Quotes
- `demandes` - Demandes
- `messages` - Messagerie
- etc. (50+ sections)

### 3. Clés "alerts" ajoutées

```json
{
  "alerts": {
    "devis": {
      "notFound": "Devis introuvable",
      "loadError": "Erreur lors du chargement du devis",
      "createSuccess": "✅ Nouveau devis créé avec succès !",
      "sendSuccess": "✅ Devis envoyé au client !",
      // ... 15+ clés devis
    },
    "demande": {
      "notFound": "Demande introuvable",
      "profileNotFound": "Votre profil artisan n'a pas été trouvé...",
      // ... 12+ clés demandes
    },
    "validation": {
      "enterTitle": "Veuillez saisir un titre pour le devis",
      "enterPrice": "Veuillez indiquer un prix valide...",
      // ... 10+ clés validation
    },
    // ... etc (80+ clés au total)
  }
}
```

## 🔧 Guide de Migration - Pattern

### Avant (❌ Code actuel) :

```tsx
export default function MyPage() {
  const handleSubmit = async () => {
    if (!title) {
      alert('Veuillez saisir un titre'); // ❌ Hardcodé
      return;
    }
    
    try {
      await createDevis(data);
      alert('✅ Devis créé avec succès !'); // ❌ Hardcodé
    } catch (error) {
      alert('Erreur lors de la création'); // ❌ Hardcodé
    }
  };

  return (
    <div>
      <p>Créé le : {devis.dateCreation?.toDate().toLocaleDateString('fr-FR')}</p>
      {/* ❌ 'fr-FR' hardcodé */}
    </div>
  );
}
```

### Après (✅ Code i18n) :

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

export default function MyPage() {
  const { t, formatDate } = useLanguage(); // ✅ Hook i18n

  const handleSubmit = async () => {
    if (!title) {
      alert(t('alerts.validation.enterTitle')); // ✅ Traduit
      return;
    }
    
    try {
      await createDevis(data);
      alert(t('alerts.devis.createSuccess')); // ✅ Traduit
    } catch (error) {
      alert(t('alerts.devis.createError')); // ✅ Traduit
    }
  };

  return (
    <div>
      <p>{t('common.createdOn')} : {formatDate(devis.dateCreation)}</p>
      {/* ✅ Date formatée selon la langue active */}
    </div>
  );
}
```

## 📝 Checklist de migration par fichier

### Pour chaque fichier .tsx :

1. **Importer le hook** :
   ```tsx
   import { useLanguage } from '@/contexts/LanguageContext';
   ```

2. **Utiliser le hook** :
   ```tsx
   const { t, formatDate, formatDateTime } = useLanguage();
   ```

3. **Remplacer les alert()** :
   ```tsx
   // Avant
   alert('Devis introuvable');
   
   // Après
   alert(t('alerts.devis.notFound'));
   ```

4. **Remplacer toLocaleDateString()** :
   ```tsx
   // Avant
   date.toLocaleDateString('fr-FR')
   
   // Après
   formatDate(date)
   ```

5. **Remplacer les textes statiques** :
   ```tsx
   // Avant
   <h1>Mes Devis</h1>
   
   // Après
   <h1>{t('common.myQuotes')}</h1>
   ```

## 📂 Fichiers à migrer (100+ alerts trouvés)

### Priorité HAUTE (20+ alerts chacun) :

1. ✅ `frontend/src/app/artisan/devis/nouveau/page.tsx` - **30+ alerts**
2. ✅ `frontend/src/app/artisan/devis/[id]/page.tsx` - **10+ alerts**
3. ✅ `frontend/src/app/client/devis/[id]/page.tsx` - **15+ alerts**
4. ✅ `frontend/src/app/resultats/page.tsx` - **10+ alerts**

### Priorité MOYENNE (5-10 alerts chacun) :

5. ✅ `frontend/src/app/artisan/devis/page.tsx` - 8 alerts
6. ✅ `frontend/src/app/messages/page.tsx` - 3 alerts
7. ✅ `frontend/src/app/recherche/page.tsx` - 3 alerts
8. ✅ `frontend/src/app/demande/nouvelle/page.tsx` - 5 alerts
9. ✅ `frontend/src/app/demande/publique/nouvelle/page.tsx` - 5 alerts

### Priorité BASSE (1-3 alerts chacun) :

10-40. Autres fichiers avec 1-3 alerts chacun

## 🎯 Exemple complet de migration

### Fichier : `frontend/src/app/artisan/devis/nouveau/page.tsx`

#### Étape 1 - Import du hook :

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext'; // ✅ Ajouté
// ... autres imports

export default function NouveauDevisPage() {
  const { t, formatDate } = useLanguage(); // ✅ Hook i18n
  // ... états
```

#### Étape 2 - Remplacer alerts (exemples) :

```tsx
// Ligne 164 - AVANT :
alert('Demande introuvable');

// Ligne 164 - APRÈS :
alert(t('alerts.demande.notFound'));

// Ligne 279 - AVANT :
alert('Votre profil artisan n\'a pas été trouvé. Veuillez compléter votre inscription.');

// Ligne 279 - APRÈS :
alert(t('alerts.demande.profileNotFound'));

// Ligne 455 - AVANT :
alert('Devis introuvable');

// Ligne 455 - APRÈS :
alert(t('alerts.devis.notFound'));

// Ligne 773 - AVANT :
alert('Veuillez saisir un titre pour le devis');

// Ligne 773 - APRÈS :
alert(t('alerts.validation.enterTitle'));

// Ligne 894 - AVANT :
alert('✅ Brouillon mis à jour avec succès');

// Ligne 894 - APRÈS :
alert(t('alerts.devis.draftUpdated'));

// Ligne 1102 - AVANT :
alert('✅ Devis envoyé au client !');

// Ligne 1102 - APRÈS :
alert(t('alerts.devis.sendSuccess'));
```

#### Étape 3 - Remplacer dates (exemples) :

```tsx
// Ligne 956 - AVANT :
`📅 Date proposée : ${dateProposee.toLocaleDateString('fr-FR')}\n`

// Ligne 956 - APRÈS :
`📅 ${t('common.proposedDate')} : ${formatDate(dateProposee)}\n`

// Ligne 1800 - AVANT :
<p className="font-semibold">{dateCreation.toLocaleDateString('fr-FR')}</p>

// Ligne 1800 - APRÈS :
<p className="font-semibold">{formatDate(dateCreation)}</p>
```

## 🔑 Mapping complet des clés alerts

### Devis (alerts.devis.*)

| Code actuel | Clé i18n |
|------------|----------|
| `alert('Devis introuvable')` | `t('alerts.devis.notFound')` |
| `alert('Erreur lors du chargement du devis')` | `t('alerts.devis.loadError')` |
| `alert('✅ Nouveau devis créé avec succès !')` | `t('alerts.devis.createSuccess')` |
| `alert('✅ Devis envoyé au client !')` | `t('alerts.devis.sendSuccess')` |
| `alert('✅ Brouillon mis à jour avec succès')` | `t('alerts.devis.draftUpdated')` |

### Demandes (alerts.demande.*)

| Code actuel | Clé i18n |
|------------|----------|
| `alert('Demande introuvable')` | `t('alerts.demande.notFound')` |
| `alert('Erreur lors du chargement des données')` | `t('alerts.demande.loadError')` |
| `alert('Maximum 5 photos autorisées')` | `t('alerts.demande.maxPhotos')` |
| `alert('Veuillez saisir une ville')` | `t('alerts.demande.enterCity')` |

### Validation (alerts.validation.*)

| Code actuel | Clé i18n |
|------------|----------|
| `alert('Veuillez saisir un titre')` | `t('alerts.validation.enterTitle')` |
| `alert('Veuillez indiquer un prix valide...')` | `t('alerts.validation.enterPrice')` |
| `alert('Veuillez ajouter au moins une prestation')` | `t('alerts.validation.addPrestation')` |

### Messages (alerts.message.*)

| Code actuel | Clé i18n |
|------------|----------|
| `alert('❌ Impossible d\'envoyer un message...')` | `t('alerts.message.conversationClosed')` |
| `alert('Erreur lors de l\'envoi du message')` | `t('alerts.message.sendError')` |

### Travaux (alerts.work.*)

| Code actuel | Clé i18n |
|------------|----------|
| `alert('✅ Travaux validés !')` | `t('alerts.work.validatedSuccess')` |
| `alert('Veuillez décrire le problème...')` | `t('alerts.work.declareProblem')` |

## 📌 Dates hardcodées à remplacer

### Patterns courants :

```tsx
// ❌ Format français hardcodé
devis.dateCreation?.toDate().toLocaleDateString('fr-FR')

// ✅ Format selon langue active
formatDate(devis.dateCreation)

// ❌ Date + heure hardcodée
devis.date.toDate().toLocaleDateString('fr-FR') + ' ' + devis.date.toDate().toLocaleTimeString('fr-FR')

// ✅ Format selon langue active
formatDateTime(devis.date)

// ❌ Heure seule hardcodée
devis.date.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// ✅ Format selon langue active
formatTime(devis.date)
```

### Fichiers concernés (200+ occurrences) :

- `frontend/src/app/artisan/devis/[id]/page.tsx` - 15+ dates
- `frontend/src/app/client/devis/[id]/page.tsx` - 20+ dates
- `frontend/src/app/artisan/devis/nouveau/page.tsx` - 10+ dates
- `frontend/src/app/client/devis/page.tsx` - 5+ dates
- `frontend/src/app/artisan/devis/page.tsx` - 3+ dates
- `frontend/src/components/UserMenu.tsx` - 2+ dates
- etc.

## 🧪 Test de changement de langue

### Vérification manuelle :

1. Ouvrir la plateforme
2. Cliquer sur le drapeau français → Tout doit être en français
3. Cliquer sur le drapeau UK → Tout doit passer en anglais
4. Vérifier :
   - Tous les textes de l'interface
   - Tous les messages alert()
   - Toutes les dates (format FR : JJ/MM/AAAA, format EN : DD/MM/YYYY)

### Points de test critiques :

- ✅ Navigation (header)
- ✅ Page d'accueil
- ✅ Formulaires (inscription, connexion)
- ✅ Dashboard client/artisan
- ✅ Page devis
- ✅ Page demandes
- ✅ Messagerie
- ✅ Alerts (créer devis, envoyer, etc.)

## 📊 Statistiques

### Traductions :
- **1937 clés** en français (fr.json)
- **1938 clés** en anglais (en.json)
- **50+ sections** organisées
- **80+ clés alerts** ajoutées

### Code à migrer :
- **100+ alert()** hardcodés à remplacer
- **200+ toLocaleDateString()** hardcodés à remplacer
- **40+ fichiers** .tsx concernés

### Fichiers créés/modifiés :
- ✅ `frontend/src/lib/i18n-utils.ts` (nouveau)
- ✅ `frontend/src/contexts/LanguageContext.tsx` (modifié)
- ✅ `frontend/src/locales/fr.json` (complété)
- ✅ `frontend/src/locales/en.json` (complété)
- ⏳ 40+ fichiers .tsx à migrer

## 🎯 Prochaines étapes

1. **Migration des alerts** (Priorité HAUTE)
   - Corriger les 40+ fichiers avec les alerts hardcodés
   - Utiliser le pattern `alert(t('alerts.xxx.yyy'))`
   - Temps estimé : 4-6 heures

2. **Migration des dates** (Priorité HAUTE)
   - Remplacer toutes les occurrences de `toLocaleDateString('fr-FR')`
   - Utiliser `formatDate()`, `formatDateTime()`, `formatTime()`
   - Temps estimé : 2-3 heures

3. **Migration des textes UI** (Priorité MOYENNE)
   - Remplacer les textes hardcodés dans les composants
   - Utiliser `t('section.key')`
   - Temps estimé : 3-4 heures

4. **Tests complets** (Priorité HAUTE)
   - Tester chaque page en FR et EN
   - Vérifier que le changement de langue fonctionne partout
   - Temps estimé : 2 heures

## 📝 Notes importantes

- ⚠️ Ne PAS supprimer les anciennes sections "alerts" dans les sous-sections (ex: artisanReviews.alerts)
- ✅ La section globale "alerts" est maintenant au niveau racine
- ✅ Le LanguageProvider est déjà intégré au layout.tsx
- ✅ Le localStorage persistele choix de langue
- ✅ Le HTML <html lang=""> est mis à jour automatiquement

## 🔗 Ressources

- Documentation LanguageContext : `frontend/src/contexts/LanguageContext.tsx`
- Utilitaires i18n : `frontend/src/lib/i18n-utils.ts`
- Traductions FR : `frontend/src/locales/fr.json`
- Traductions EN : `frontend/src/locales/en.json`
- Sélecteur de langue : `frontend/src/components/LanguageSelector.tsx`
