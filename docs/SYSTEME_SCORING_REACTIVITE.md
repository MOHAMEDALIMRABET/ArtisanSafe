# Système de Scoring Réactivité - ArtisanSafe

> **Système de scoring avancé basé sur le taux de réponse et la réactivité des artisans**
> 
> Implémenté le : 1er février 2026  
> Version : 1.0  
> Auteur : Système de matching intelligent ArtisanSafe

---

## 📊 Vue d'ensemble

Le système de scoring de réactivité permet de **récompenser les artisans réactifs** et d'améliorer l'expérience client en priorisant les professionnels qui répondent rapidement aux demandes.

### Objectifs

✅ **Prioriser les artisans réactifs** dans les résultats de recherche  
✅ **Inciter à répondre rapidement** aux demandes clients  
✅ **Améliorer le taux de conversion** demandes → devis acceptés  
✅ **Fournir des métriques** pour détecter les artisans inactifs  
✅ **Transparence** : stats visibles publiquement

---

## 🎯 Nouveau Score Total : 350 points (vs 270 avant)

### Composantes du Score

| Critère | Points Max | Description |
|---------|-----------|-------------|
| **Match Métier** | 100 | Correspondance exacte du métier |
| **Distance** | 50 | Proximité géographique |
| **Disponibilité** | 50 | Dates disponibles dans l'agenda |
| **Notation Client** | 50 | Avis et note moyenne |
| **🆕 Réactivité** | **80** | **Taux de réponse + Délai moyen** |
| **Urgence** | 20 | Bonus disponibilité immédiate |
| **TOTAL** | **350** | Score maximum |

---

## 🆕 Score de Réactivité (80 points)

Le score de réactivité se divise en deux sous-scores :

### 1. Taux de Réponse (40 points)

Pourcentage de demandes reçues ayant donné lieu à un devis envoyé.

| Taux de Réponse | Score |
|-----------------|-------|
| **90-100%** | 40 pts |
| **70-89%** | 30 pts |
| **50-69%** | 20 pts |
| **30-49%** | 10 pts |
| **< 30%** | 0 pts |

**Formule :**
```typescript
tauxReponse = (devisEnvoyes / demandesRecues) * 100
```

### 2. Délai Moyen de Réponse (40 points)

Temps moyen entre la réception d'une demande et l'envoi du devis.

| Délai Moyen | Score |
|-------------|-------|
| **< 2h** | 40 pts |
| **< 6h** | 30 pts |
| **< 24h** | 20 pts |
| **< 48h** | 10 pts |
| **> 48h** | 0 pts |

**Formule :**
```typescript
delaiMoyen = moyenne(derniers 20 délais de réponse en heures)
```

---

## 📁 Structure de Données

### Collection Firestore : `artisan_stats/{artisanId}`

```typescript
interface ArtisanStats {
  artisanId: string;
  
  // === TAUX DE RÉPONSE ===
  demandesRecues: number;         // Total demandes matchées
  devisEnvoyes: number;           // Nombre de devis envoyés
  tauxReponseDevis: number;       // % = (devisEnvoyes / demandesRecues) * 100
  
  // === DÉLAI DE RÉPONSE ===
  delaiMoyenReponseHeures: number;  // Délai moyen en heures
  dernieresReponses: number[];      // 20 derniers délais (moyenne glissante)
  reponseRapide24h: number;         // Nombre réponses < 24h
  
  // === TAUX D'ACCEPTATION ===
  devisAcceptes: number;          // Devis acceptés par les clients
  devisRefuses: number;           // Devis refusés par les clients
  tauxAcceptation: number;        // % = (devisAcceptes / devisEnvoyes) * 100
  
  // === FIABILITÉ ===
  missionsTerminees: number;      // Contrats terminés avec succès
  missionsAnnulees: number;       // Contrats annulés
  tauxCompletion: number;         // % missions terminées
  
  // === QUALITÉ ===
  noteGlobale: number;            // Note moyenne 0-5
  nombreAvis: number;             // Nombre total d'avis
  dernierAvisDate?: Timestamp;
  
  // === LITIGES ===
  nombreLitiges: number;          // Total litiges ouverts
  litigesResolus: number;         // Litiges résolus favorablement
  
  // === HISTORIQUE ===
  premiereActivite?: Timestamp;   // Première demande reçue
  derniereActivite?: Timestamp;   // Dernière action
  derniereMiseAJour: Timestamp;   // Dernière mise à jour stats
}
```

---

## 🔄 Workflow de Tracking Automatique

### 1. **Demande Reçue** (Matching)

```typescript
// Quand un artisan est matché avec une demande
await trackDemandeRecue(artisanId, demandeId);

// Met à jour :
// - demandesRecues++
```

### 2. **Devis Envoyé**

```typescript
// Lors de l'envoi d'un devis (statut: brouillon → envoye)
await trackDevisEnvoye(
  artisanId,
  demandeCreatedAt,  // Timestamp
  devisCreatedAt     // Timestamp
);

// Met à jour :
// - devisEnvoyes++
// - tauxReponseDevis = (devisEnvoyes / demandesRecues) * 100
// - delaiReponse = (devisCreatedAt - demandeCreatedAt) en heures
// - dernieresReponses.push(delaiReponse) // Max 20 valeurs
// - delaiMoyenReponseHeures = moyenne(dernieresReponses)
// - reponseRapide24h++ si delaiReponse < 24h
```

### 3. **Devis Accepté**

```typescript
// Quand un client accepte un devis
await trackDevisAccepte(artisanId);

// Met à jour :
// - devisAcceptes++
// - tauxAcceptation = (devisAcceptes / devisEnvoyes) * 100
```

### 4. **Devis Refusé**

```typescript
// Quand un client refuse un devis
await trackDevisRefuse(artisanId);

// Met à jour :
// - devisRefuses++
// - tauxAcceptation recalculé
```

### 5. **Mission Terminée**

```typescript
// Quand un contrat est terminé avec succès
await trackMissionTerminee(artisanId);

// Met à jour :
// - missionsTerminees++
// - tauxCompletion = (missionsTerminees / totalMissions) * 100
```

### 6. **Mission Annulée**

```typescript
// Quand un contrat est annulé
await trackMissionAnnulee(artisanId);

// Met à jour :
// - missionsAnnulees++
// - tauxCompletion recalculé
```

---

## 🔧 Intégration dans le Matching

### Fichier : `matching-service.ts`

```typescript
import { getArtisanStats, calculateScoreReactivite } from './artisan-stats-service';

// Dans matchArtisans()
for (const artisan of artisansVerifies) {
  // ... calculs existants ...
  
  // 🆕 NOUVEAU: Score de réactivité
  let reactiviteScore = 0;
  try {
    const stats = await getArtisanStats(artisan.userId);
    reactiviteScore = calculateScoreReactivite(stats);
  } catch (error) {
    console.log(`⚠️  Stats non disponibles, score réactivité=0`);
    reactiviteScore = 0; // Nouvel artisan sans historique
  }
  
  // Score total (max 350 points)
  const scoreTotal = 
    metierScore +        // 100
    distanceScore +      // 50
    disponibiliteScore + // 50
    notationScore +      // 50
    reactiviteScore +    // 80 🆕
    urgenceScore;        // 20
  
  // ...
}
```

---

## 📈 Exemples Concrets

### Exemple 1 : Artisan Réactif

```typescript
Stats:
- demandesRecues: 100
- devisEnvoyes: 95
- tauxReponseDevis: 95% → Score: 40/40 ✅
- delaiMoyenReponseHeures: 3h → Score: 30/40 ✅

Score Réactivité Total: 70/80 ⭐
```

### Exemple 2 : Artisan Moyen

```typescript
Stats:
- demandesRecues: 50
- devisEnvoyes: 35
- tauxReponseDevis: 70% → Score: 30/40
- delaiMoyenReponseHeures: 12h → Score: 20/40

Score Réactivité Total: 50/80
```

### Exemple 3 : Artisan Peu Réactif

```typescript
Stats:
- demandesRecues: 80
- devisEnvoyes: 20
- tauxReponseDevis: 25% → Score: 0/40 ❌
- delaiMoyenReponseHeures: 72h → Score: 0/40 ❌

Score Réactivité Total: 0/80 ⚠️
```

### Exemple 4 : Nouvel Artisan (Pas de Stats)

```typescript
Stats inexistantes:
- demandesRecues: 0
- devisEnvoyes: 0

Score Réactivité Total: 0/80 (neutre, pas pénalisé)
```

---

## 🎨 Affichage pour les Utilisateurs

### Page Profil Artisan

```tsx
<div className="stats-card">
  <h3>📊 Statistiques de Performance</h3>
  
  <div className="stat">
    <span>Taux de réponse :</span>
    <strong>{stats.tauxReponseDevis.toFixed(0)}%</strong>
    {stats.tauxReponseDevis >= 90 && <Badge color="green">Excellent</Badge>}
    {stats.tauxReponseDevis < 50 && <Badge color="red">À améliorer</Badge>}
  </div>
  
  <div className="stat">
    <span>Délai moyen de réponse :</span>
    <strong>{stats.delaiMoyenReponseHeures.toFixed(0)}h</strong>
    {stats.delaiMoyenReponseHeures < 6 && <Badge color="green">Très rapide</Badge>}
  </div>
  
  <div className="stat">
    <span>Taux d'acceptation :</span>
    <strong>{stats.tauxAcceptation.toFixed(0)}%</strong>
  </div>
  
  <div className="stat">
    <span>Missions terminées :</span>
    <strong>{stats.missionsTerminees}</strong>
  </div>
</div>
```

### Résultats de Recherche

```tsx
<ArtisanCard>
  <div className="score-breakdown">
    <div>Match: {breakdown.metierMatch}/100</div>
    <div>Distance: {breakdown.distanceScore}/50</div>
    <div>Disponibilité: {breakdown.disponibiliteScore}/50</div>
    <div>Notation: {breakdown.notationScore}/50</div>
    <div className="highlight">
      🆕 Réactivité: {breakdown.reactiviteScore}/80
      {breakdown.reactiviteScore > 60 && <Badge>⚡ Très réactif</Badge>}
    </div>
    <div>Urgence: {breakdown.urgenceMatch}/20</div>
  </div>
  
  <div className="total-score">
    Score Total: {artisan.score}/350
  </div>
</ArtisanCard>
```

---

## 🛡️ Règles de Sécurité Firestore

```javascript
// firestore.rules
match /artisan_stats/{artisanId} {
  allow read: if true; // Public pour affichage + matching
  allow create: if isAuthenticated(); // Créé par services
  allow update: if isAuthenticated(); // Mis à jour par services
  allow delete: if isAdmin();
}
```

---

## 🔍 Cas d'Usage

### 1. **Client cherche un plombier urgent**

```typescript
Critères:
- Métier: plomberie
- Ville: Paris
- Urgence: urgent

Résultats triés par score:
1. Artisan A: 310/350 (réactivité: 75/80) → Répond en 1h ✅
2. Artisan B: 280/350 (réactivité: 45/80) → Répond en 12h
3. Artisan C: 230/350 (réactivité: 0/80) → Répond rarement ❌

→ Client contacte Artisan A en priorité
```

### 2. **Détection artisan inactif (Admin)**

```typescript
Filtrer artisans où:
- tauxReponseDevis < 30%
- derniereActivite > 30 jours

Action admin:
- Envoyer email de réactivation
- Suspendre temporairement
- Proposer formation
```

### 3. **Artisan veut améliorer son classement**

```typescript
Dashboard artisan affiche:
- "Votre taux de réponse: 65% (🔴 À améliorer)"
- "Objectif: Passer à 90% pour +10 points matching"
- "Conseil: Répondez dans les 6h pour +10 points supplémentaires"
- "Impact: Classement estimé +3 positions"
```

---

## 📊 Métriques de Succès

### Indicateurs à Suivre

| Métrique | Objectif | Mesure |
|----------|----------|--------|
| **Taux de réponse global** | > 80% | Moyenne tous artisans |
| **Délai moyen réponse** | < 12h | Médiane tous artisans |
| **Taux de conversion demande→devis** | > 70% | (devisEnvoyes / demandesRecues) |
| **Taux d'acceptation devis** | > 40% | (devisAcceptes / devisEnvoyes) |

### Requêtes Analytics (Firestore)

```typescript
// Artisans les plus réactifs (top 10)
const topReactifs = await getDocs(
  query(
    collection(db, 'artisan_stats'),
    orderBy('tauxReponseDevis', 'desc'),
    limit(10)
  )
);

// Artisans à risque (taux réponse < 30%)
const artisansRisque = await getDocs(
  query(
    collection(db, 'artisan_stats'),
    where('tauxReponseDevis', '<', 30)
  )
);
```

---

## 🚀 Roadmap Futures Améliorations

### Phase 2 (Q2 2026)

- [ ] **Badges de réactivité** : "⚡ Réponse Éclair" si < 1h
- [ ] **Historique mensuel** : Graphique évolution taux réponse
- [ ] **Notifications artisan** : Alerte si taux chute < 50%
- [ ] **Système de paliers** : Bronze/Silver/Gold/Platinum

### Phase 3 (Q3 2026)

- [ ] **Prédiction ML** : Probabilité que l'artisan réponde
- [ ] **Scoring dynamique** : Pénalité si délai augmente
- [ ] **Récompenses** : Boost temporaire si bon comportement
- [ ] **API publique** : Exposer stats agrégées par métier/ville

---

## 🔧 Maintenance

### Initialisation Stats Artisan Existant

```typescript
// Script à exécuter pour artisans déjà inscrits
import { initializeArtisanStats } from '@/lib/firebase/artisan-stats-service';

async function migrateExistingArtisans() {
  const artisans = await getDocs(collection(db, 'artisans'));
  
  for (const doc of artisans.docs) {
    const artisanId = doc.id;
    
    try {
      await initializeArtisanStats(artisanId);
      console.log(`✅ Stats initialisées pour ${artisanId}`);
    } catch (error) {
      console.error(`❌ Erreur pour ${artisanId}:`, error);
    }
  }
}
```

### Recalcul Batch (si données corrompues)

```typescript
// Recalculer tous les taux de réponse
async function recalculerTauxReponse() {
  const statsSnapshot = await getDocs(collection(db, 'artisan_stats'));
  
  for (const doc of statsSnapshot.docs) {
    const stats = doc.data();
    const nouveauTaux = stats.demandesRecues > 0
      ? (stats.devisEnvoyes / stats.demandesRecues) * 100
      : 0;
    
    await updateDoc(doc.ref, {
      tauxReponseDevis: nouveauTaux
    });
  }
}
```

---

## ❓ FAQ

**Q: Un nouvel artisan sans historique est-il pénalisé ?**  
R: Non, il obtient 0 points (neutre), pas de pénalité négative.

**Q: Les demandes refusées comptent-elles ?**  
R: Non, seules les demandes matchées comptent dans `demandesRecues`.

**Q: Comment gérer les artisans saisonniers ?**  
R: Stats par périodes (30j/90j) pour éviter biais ancienneté.

**Q: Un artisan peut-il contester ses stats ?**  
R: Oui, via support admin. Audit manuel si doute.

**Q: Les stats sont-elles publiques ?**  
R: Oui, visibles sur le profil artisan (transparence).

---

## 📝 Changelog

### Version 1.0 (2026-02-01)
- ✅ Implémentation initiale
- ✅ Types TypeScript `ArtisanStats`
- ✅ Service `artisan-stats-service.ts`
- ✅ Intégration dans `matching-service.ts`
- ✅ Tracking automatique (devis envoyé/accepté/refusé)
- ✅ Règles Firestore
- ✅ Documentation complète

---

## 📚 Fichiers Concernés

```
frontend/src/
├── types/firestore.ts                    # Interface ArtisanStats
├── lib/firebase/
│   ├── artisan-stats-service.ts          # Service principal (420 lignes)
│   ├── matching-service.ts               # Intégration scoring
│   └── devis-service.ts                  # Tracking automatique
└── docs/SYSTEME_SCORING_REACTIVITE.md    # Cette documentation

firestore.rules                           # Règles sécurité collection artisan_stats
```

---

## 🎯 Résumé Exécutif

✅ **Score maximum porté à 350 points** (ajout 80pts réactivité)  
✅ **Taux de réponse + Délai moyen** trackés automatiquement  
✅ **Nouvel artisan non pénalisé** (score=0, neutre)  
✅ **Stats publiques** pour transparence  
✅ **Impact immédiat sur ranking** de recherche  

**Objectif :** Améliorer l'expérience client en priorisant les artisans réactifs.

---

*Document généré le 1er février 2026 - ArtisanSafe MVP v1.0*
