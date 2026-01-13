# 🔔 Système de Notifications Visuelles des Devis

## Vue d'ensemble

Système professionnel de mise en évidence des **réponses clients** pour améliorer l'expérience utilisateur et identifier rapidement les devis nécessitant une action de l'artisan.

⚠️ **Important** : Le badge ne s'affiche PAS pour les nouveaux devis créés, mais uniquement quand le **CLIENT répond** (accepte, refuse, demande révision).

## 🎯 Fonctionnalités

### 1. Badge "RÉPONSE CLIENT" Temporaire (48h)

**Déclencheur** : Réponse du client sur un devis
- ✅ **Client accepte** le devis → Badge "✅ Accepté"
- ❌ **Client refuse définitivement** → Badge "❌ Refusé"
- 🔄 **Client demande révision** → Badge "🔄 Révision"

**Affichage** :
- Badge coloré avec gradient (rouge → orange)
- Texte adapté au type de réponse
- Animation slide-in lors de l'apparition
- Disparaît automatiquement après 48 heures

**Champ Firestore** : `dateDerniereNotification: Timestamp`

---

### 2. Highlight Visuel

**Effet visuel pour réponses récentes** :
- **Bordure gauche orange** (4px) pour attirer l'attention
- **Fond dégradé subtil** orange transparent
- **Animation pulse** sur la bordure toutes les 2 secondes

**CSS** :
```css
.devis-reponse-recente {
  border-left: 4px solid #FF6B00;
  background: linear-gradient(to right, rgba(255, 107, 0, 0.05), rgba(255, 107, 0, 0.02));
  animation: pulse-border 2s infinite;
}
```

---

### 3. Badge Compteur sur les Filtres

**Position** : Coin supérieur droit de chaque bouton de filtre

**Affichage** :
- Cercle rouge avec nombre de **réponses clients récentes**
- Tooltip : "Réponses clients récentes"
- Animation slide-in
- Mise à jour en temps réel

**Exemple** :
```
┌─────────────────┐
│   Acceptés      │  🔴 2  ← 2 acceptations récentes
│      15         │
└─────────────────┘
```

---

### 4. Scroll Automatique

**Fonctionnement** :
- URL avec `?devisId=xxx` → scroll vers le devis
- Highlight renforcé avec animation pulse (3 répétitions)
- Centrage dans la viewport

---

## 📊 Logique Métier

### Calcul "Réponse Récente" (48h)

```typescript
const aReponseClienteRecente = (devis: Devis): boolean => {
  if (!devis.dateDerniereNotification) return false;
  const maintenant = Date.now();
  const dateNotif = devis.dateDerniereNotification.toMillis();
  const heuresEcoulees = (maintenant - dateNotif) / (1000 * 60 * 60);
  return heuresEcoulees < 48; // Réponse récente pendant 48h
};
```

### Texte du Badge Adapté

```typescript
const getTexteBadgeReponse = (devis: Devis): string => {
  if (devis.statut === 'accepte') return '✅ Accepté';
  if (devis.statut === 'refuse' && devis.typeRefus === 'revision') return '🔄 Révision';
  if (devis.statut === 'refuse') return '❌ Refusé';
  return 'Nouveau';
};
```

---

### Événements Déclencheurs

**1. Client Accepte le Devis** :
```typescript
// Déclenché côté CLIENT
await updateDevis(devisId, {
  statut: 'accepte',
  dateAcceptation: Timestamp.now(),
  dateDerniereNotification: Timestamp.now(), // ← ARTISAN NOTIFIÉ
});
```

**2. Client Refuse Définitivement** :
```typescript
await updateDevis(devisId, {
  statut: 'refuse',
  typeRefus: 'definitif',
  dateRefus: Timestamp.now(),
  dateDerniereNotification: Timestamp.now(), // ← ARTISAN NOTIFIÉ
  motifRefus: "Prix trop élevé",
});
```

**3. Client Demande Révision** :
```typescript
await updateDevis(devisId, {
  statut: 'refuse',
  typeRefus: 'revision',
  dateRefus: Timestamp.now(),
  dateDerniereNotification: Timestamp.now(), // ← ARTISAN NOTIFIÉ
  motifRefus: "Besoin d'ajuster les délais",
});
```

---

## ❌ Quand le Badge N'Apparaît PAS

- ❌ Artisan crée un brouillon
- ❌ Artisan envoie le devis au client
- ❌ Devis expire automatiquement
- ❌ Artisan modifie un brouillon

**Raison** : Ces actions sont initiées par l'**artisan**, pas le client. Le badge sert uniquement à alerter l'artisan d'une **action du client**.

---

## 🎨 Design Patterns Utilisés

### Inspiration : Plateformes Professionnelles

1. **Stripe Dashboard** : Badge temporaire + highlight subtil
2. **LinkedIn Notifications** : Badge compteur avec tooltip
3. **Slack Messages** : Animation pulse pour attirer l'attention
4. **GitHub Pull Requests** : Bordure colorée pour les items nécessitant une action

---

## 📱 Expérience Utilisateur

### Scénario 1 : Client Accepte un Devis

1. **Client** consulte le devis → clique "Accepter"
2. **Système** met à jour Firestore :
   ```
   statut: 'accepte'
   dateAcceptation: now()
   dateDerniereNotification: now()  ← NOUVEAU
   ```
3. **Artisan** se connecte 2h plus tard → voit :
   - 🔴 Badge "1" sur filtre "Acceptés"
   - Badge "✅ Accepté" sur la ligne du devis
   - Bordure orange + fond subtil + pulse
4. **Après 48h** : Badge disparaît, devis reste dans "Acceptés"

---

### Scénario 2 : Client Demande une Révision

1. **Client** consulte le devis → clique "Demander révision"
   - Saisit motif : "Pouvez-vous ajouter la peinture ?"
2. **Système** met à jour :
   ```
   statut: 'refuse'
   typeRefus: 'revision'
   motifRefus: "Pouvez-vous ajouter la peinture ?"
   dateDerniereNotification: now()  ← ARTISAN ALERTÉ
   ```
3. **Artisan** se connecte → voit :
   - 🔴 Badge "1" sur filtre "🔄 Révisions"
   - Badge "🔄 Révision" orange sur la ligne
   - Bouton "📝 Créer révision" bien visible
4. **Artisan** crée révision → ancien devis disparaît de la liste principale

---

## 🚀 Avantages

✅ **Clarté immédiate** : L'artisan voit en un coup d'œil les réponses clients
✅ **Action prioritaire** : Les devis nécessitant une réponse sont mis en avant
✅ **Professionnalisme** : Design inspiré des meilleures plateformes
✅ **Automatique** : Aucune action manuelle, tout géré par le système
✅ **Performance** : Calcul côté client, pas de requêtes supplémentaires
✅ **Scalable** : Fonctionne avec 10 ou 1000 devis
✅ **Temporaire** : Disparition automatique évite l'encombrement

---

## 🔮 Évolutions Futures

1. **Notifications Push** (navigateur) : "Client a accepté votre devis DV-2026-00042 !"
2. **Emails** pour les événements importants (acceptation, révision)
3. **SMS** pour les devis > 5000€
4. **Personnalisation** : durée badge configurable par artisan (24h, 48h, 72h)
5. **Statistiques** : temps moyen de réponse client, taux d'acceptation
6. **Rappels** : "3 devis acceptés en attente de contrat depuis 7 jours"

---

## 📝 Checklist Implémentation

- [x] Ajouter champ `dateDerniereNotification` dans type Devis
- [x] Modifier `updateDevis()` pour ajouter le timestamp sur réponse client
- [x] Créer fonction `aReponseClienteRecente()`
- [x] Créer fonction `getTexteBadgeReponse()` pour texte adapté
- [x] Ajouter CSS animations (pulse, slide-in)
- [x] Implémenter badge adapté dans tableau
- [x] Ajouter compteurs sur filtres avec tooltip
- [x] Tester avec différents statuts
- [ ] Migration Firestore (optionnel : script batch)
- [ ] Tests E2E

---

## 🎯 KPIs à Suivre

- **Taux de clics** sur nouveaux devis vs anciens
- **Temps de réponse** aux révisions demandées
- **Conversion** brouillon → envoyé dans les 48h
- **Satisfaction artisan** (sondage UX)

---

**Dernière mise à jour** : 13 janvier 2026  
**Version** : 1.0  
**Auteur** : ArtisanSafe Team
