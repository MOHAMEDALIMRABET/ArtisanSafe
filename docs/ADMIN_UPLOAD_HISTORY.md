# Dashboard Admin - Historique des Uploads

## 📊 Vue d'ensemble

Système de traçabilité et détection de fraude pour les uploads de documents (KBIS et pièces d'identité).

---

## 🎯 Fonctionnalités

### 1. **Tableau de bord principal** (`/admin/verifications`)

#### Indicateur visuel rapide
- **Badge jaune** : Affiche le nombre d'uploads si > 3
  ```
  ✅ Vérifié  [5×]  ← Artisan a uploadé 5 fois
  ```

#### Filtrage intelligent
- **Tous** : Tous les artisans
- **En attente** : Documents uploadés non vérifiés
- **Vérifiés** : Tous documents validés
- **Rejetés** : Au moins un document rejeté

---

### 2. **Modal de détails artisan**

#### Section "Historique des uploads"

**Affichage automatique si uploadHistory existe :**
```
Historique des uploads (3)  [⚠️ SUSPECT]  ← Si > 5 uploads
┌──────────────────────────────────────────┐
│ 02/01 14:30 • kbis_2026.pdf • 250 KB    │
│ ↻ Re-upload après rejet: Document expiré │
│                                          │
│ 01/01 10:00 • kbis_vieux.pdf • 234 KB   │
│                                          │
│ 31/12 16:45 • scan_kbis.jpg • 312 KB    │
└──────────────────────────────────────────┘
```

#### Codes couleur

| Seuil | Badge | Signification |
|-------|-------|---------------|
| 1-3 uploads | Aucun | Normal |
| 4-5 uploads | Jaune `5×` | Attention |
| > 5 uploads | Rouge `⚠️ SUSPECT` | Suspect - Investigation requise |

---

## 🔍 Détection de fraude

### Patterns suspects

**1. Uploads multiples en 24h**
```json
uploadHistory: [
  { "uploadedAt": "2026-01-02T10:00", "fileName": "kbis_A.pdf" },
  { "uploadedAt": "2026-01-02T11:30", "fileName": "kbis_B.pdf" },
  { "uploadedAt": "2026-01-02T14:00", "fileName": "kbis_C.pdf" },
  { "uploadedAt": "2026-01-02T16:00", "fileName": "kbis_D.pdf" }
]
```
**Action recommandée** : Vérifier si SIRET/raison sociale cohérents

**2. Re-uploads répétés après rejet**
```json
uploadHistory: [
  { 
    "previouslyRejected": true,
    "rejectionReason": "Document falsifié"
  },
  { 
    "previouslyRejected": true,
    "rejectionReason": "Document falsifié"
  }
]
```
**Action recommandée** : Suspendre le compte

**3. Fichiers de tailles très différentes**
```json
uploadHistory: [
  { "fileSize": 5242880 },  // 5 MB - PDF scan
  { "fileSize": 102400 }    // 100 KB - Image suspecte
]
```
**Action recommandée** : Vérifier qualité/authenticité

---

## 📋 Workflow admin

### Scénario 1 : Upload normal
```
1. Artisan upload KBIS
2. Admin voit : uploadHistory (1)
3. Validation standard
```

### Scénario 2 : Re-upload après rejet
```
1. Admin rejette : "Document expiré"
2. Artisan re-upload nouveau KBIS
3. Admin voit :
   - uploadHistory (2)
   - ↻ Re-upload après rejet: Document expiré
4. Validation du nouveau document
```

### Scénario 3 : Activité suspecte
```
1. Admin voit : uploadHistory (8)  [⚠️ SUSPECT]
2. Ouvre modal détails
3. Analyse :
   - 8 uploads en 2 jours
   - Noms de fichiers différents
   - Tailles variables
4. Actions possibles :
   - Contact artisan pour clarification
   - Validation manuelle approfondie
   - Suspension temporaire
   - Signalement fraude
```

---

## 🗄️ Structure des données

### Firestore - Collection `artisans`

```typescript
{
  verificationDocuments: {
    kbis: {
      url: "gs://bucket/kbis_current.pdf",
      verified: false,
      uploadHistory: [
        {
          uploadedAt: Timestamp("2026-01-02T14:30:00Z"),
          fileSize: 312456,
          fileName: "kbis_janvier_2026.pdf",
          previouslyRejected: true,
          rejectionReason: "Document expiré - date > 3 mois"
        },
        {
          uploadedAt: Timestamp("2026-01-01T10:00:00Z"),
          fileSize: 234567,
          fileName: "kbis_mars_2025.pdf",
          previouslyRejected: false,
          rejectionReason: null
        }
      ]
    }
  }
}
```

---

## 📊 Statistiques disponibles

### Métriques utiles (à implémenter Phase 3)

**1. Taux de re-upload**
```
Re-uploads / Total uploads × 100
→ Indique qualité docs uploadés initialement
```

**2. Délai moyen re-upload**
```
Date re-upload - Date rejet
→ Réactivité artisans
```

**3. Artisans suspects**
```
COUNT(artisans WHERE uploadHistory.length > 5)
→ Nécessite investigation
```

---

## ⚙️ Configuration

### Seuils d'alerte (modifiables)

```typescript
// Dans admin/verifications/page.tsx

const UPLOAD_WARNING_THRESHOLD = 3;   // Badge jaune
const UPLOAD_SUSPECT_THRESHOLD = 5;   // Badge rouge SUSPECT
```

### Couleurs

```typescript
// Badge jaune (attention)
className="bg-yellow-100 text-yellow-800"

// Badge rouge (suspect)
className="bg-red-100 text-red-700"

// Fond historique
className="bg-yellow-50 border-yellow-200"
```

---

## 🚀 Améliorations futures (Phase 3)

### 1. Graphique temporel
```
Uploads par jour
    │
  8 │     ●
  6 │   ● │ ●
  4 │ ● │ │ │
  2 │ │ │ │ │
    └─────────
    L M M J V
```

### 2. Export CSV
```csv
Artisan,KBIS Uploads,ID Uploads,Dernière action,Statut
Marc Dupont,3,2,2026-01-02,Vérifié
Sophie Martin,8,7,2026-01-02,SUSPECT
```

### 3. Notifications admin
```
⚠️ Alerte fraude
Artisan #4567 : 10 uploads KBIS en 24h
→ [Voir détails] [Suspendre]
```

### 4. Analyse IA
```python
def detect_fraud_pattern(uploadHistory):
    if len(uploadHistory) > 10:
        return "HIGH_RISK"
    if multiple_uploads_same_day(uploadHistory):
        return "MEDIUM_RISK"
    return "LOW_RISK"
```

---

## 🔐 Conformité RGPD

✅ **Respecté** :
- Métadonnées uniquement (pas de fichiers stockés)
- Finalité légitime (anti-fraude)
- Conservation proportionnée
- Suppression avec compte artisan

❌ **Attention** :
- Ne pas partager uploadHistory avec tiers
- Anonymiser dans exports statistiques
- Limiter accès aux admins autorisés

---

## 📝 Exemples pratiques

### Cas réel 1 : Artisan légitime
```
uploadHistory (2):
- 01/12/2025 : kbis_decembre.pdf (250 KB)
  → Rejet: "Date > 3 mois"
- 15/12/2025 : kbis_janvier.pdf (240 KB)
  → Re-upload après rejet
  → Validation OK ✅
```

### Cas réel 2 : Fraude détectée
```
uploadHistory (12):
- 02/01 10:00 : societe_A.pdf
- 02/01 11:30 : entreprise_B.pdf
- 02/01 14:00 : kbis_C.jpg
- 02/01 16:00 : scan_D.pdf
... (8 autres)

⚠️ Pattern suspect :
- 12 fichiers différents
- SIRET incohérent
- Raisons sociales multiples
→ Compte suspendu
```

---

## 🛠️ Maintenance

### Nettoyage périodique
- **Quotidien** : Vérifier artisans suspects (> 5 uploads)
- **Hebdomadaire** : Rapport statistiques uploads
- **Mensuel** : Archivage anciens uploadHistory (> 6 mois)

### Monitoring
- Nombre moyen uploads/artisan : ~1.5 (normal)
- Si moyenne > 3 : Investigation générale requise

---

## 📞 Support

**Pour les artisans :**
> "Nous gardons un historique de vos uploads pour votre sécurité et la nôtre. 
> Cela nous permet de détecter les fraudes et protéger tous les utilisateurs."

**Pour les admins :**
> Utilisez l'historique pour :
> 1. Comprendre le contexte (re-upload légitime vs tentative fraude)
> 2. Détecter patterns suspects
> 3. Statistiques qualité documents

---

## ✅ Checklist validation admin

Avant de valider un document avec uploadHistory suspect :

- [ ] Vérifier cohérence SIRET/raison sociale
- [ ] Comparer avec données SIRENE
- [ ] Analyser qualité document actuel
- [ ] Lire raisons rejets précédents
- [ ] Contacter artisan si nécessaire
- [ ] Noter observations dans commentaire admin

---

**Date de mise à jour** : 2 janvier 2026  
**Version** : 1.0  
**Auteur** : ArtisanSafe Dev Team
