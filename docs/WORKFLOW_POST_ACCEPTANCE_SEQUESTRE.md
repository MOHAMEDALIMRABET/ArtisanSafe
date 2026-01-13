# 📋 WORKFLOW POST-ACCEPTATION : ARTISANSAFE (Paiement Séquestre)

## 🇫🇷 WORKFLOW AVEC COMPTE SÉQUESTRE

### **ÉTAPE 1 : Acceptation devis + Délai rétractation**

```
Client clique "Accepter le devis"
↓
┌────────────────────────────────────────────┐
│ ⏱️ DÉLAI DE RÉTRACTATION - 14 JOURS       │
│                                             │
│ Votre acceptation est enregistrée          │
│ Vous pouvez annuler jusqu'au XX/XX/XXXX    │
│                                             │
│ Formulaire de rétractation téléchargeable  │
│                                             │
│ Exception : Travaux urgents                │
│ [ ] Je renonce à mon délai (à signer)      │
└────────────────────────────────────────────┘
↓
Statut devis : "accepte_en_attente_retractation"
Notification artisan : "Devis accepté, attente 14j"
```

### **ÉTAPE 2 : Génération contrat**

```
Après 14 jours OU renonciation signée
↓
Génération automatique PDF :
┌────────────────────────────────────────────┐
│ CONTRAT DE PRESTATION BTP                  │
│                                             │
│ Entre :                                     │
│ - Client : [Nom, adresse]                  │
│ - Artisan : [Raison sociale, SIRET]        │
│                                             │
│ Objet : [Description travaux]              │
│ Montant TTC : [X €]                        │
│ Délai exécution : [X jours]                │
│                                             │
│ Modalités paiement :                       │
│ - Paiement INTÉGRAL via séquestre          │
│ - Argent bloqué pendant travaux            │
│ - Déblocage après validation mutuelle      │
│                                             │
│ Assurances :                                │
│ - Décennale n° : [...]                     │
│ - RC Pro n° : [...]                        │
│                                             │
│ Garanties légales :                        │
│ - Parfait achèvement : 1 an                │
│ - Biennale : 2 ans                         │
│ - Décennale : 10 ans                       │
│                                             │
│ Clause résolutoire en cas non-paiement    │
│ Pénalités retard : 3x taux BCE            │
│                                             │
│ [ Signature électronique client ]          │
│ [ Signature électronique artisan ]         │
└────────────────────────────────────────────┘
↓
Envoi automatique aux 2 parties
Archivage dans "Documents contractuels"
```

### **ÉTAPE 3 : Paiement COMPLET bloqué (Séquestre)**

```
Contrat signé
↓
┌────────────────────────────────────────────┐
│ 🔒 PAIEMENT SÉCURISÉ - COMPTE SÉQUESTRE    │
│                                             │
│ Montant TOTAL : [X €] TTC                  │
│                                             │
│ Comment ça fonctionne ?                     │
│ ✓ Vous payez maintenant le montant total  │
│ ✓ Argent BLOQUÉ sur compte séquestre       │
│ ✓ L'artisan ne reçoit rien pour l'instant │
│ ✓ Déblocage uniquement après validation   │
│                                             │
│ 🛡️ Protection maximale :                   │
│ • Argent sécurisé par ArtisanSafe          │
│ • Remboursement si travaux non réalisés    │
│ • Médiation en cas de litige               │
│                                             │
│ Moyens de paiement :                        │
│ - Carte bancaire (Stripe)                  │
│ - Virement SEPA                             │
│                                             │
│ [ 💳 Payer et bloquer [X €] ]              │
└────────────────────────────────────────────┘
↓
Paiement effectué → Argent bloqué
Notification artisan : "💰 Paiement sécurisé [X €]"
Notification client : "✅ [X €] bloqués en sécurité"
Statut : "paye_bloque"
```

### **ÉTAPE 4 : Planification travaux**

```
┌────────────────────────────────────────────┐
│ 📅 PLANIFICATION INTERVENTION              │
│                                             │
│ 💰 Statut paiement : BLOQUÉ EN SÉCURITÉ    │
│                                             │
│ Artisan propose 3 dates de démarrage :    │
│ - Option A : [Date] [Heure]               │
│ - Option B : [Date] [Heure]               │
│ - Option C : [Date] [Heure]               │
│                                             │
│ Client sélectionne                         │
│                                             │
│ Durée estimée : [X jours]                  │
│ Date fin prévue : [XX/XX/XXXX]            │
└────────────────────────────────────────────┘
↓
Confirmation SMS + Email aux 2 parties
Ajout calendrier automatique
Rappel J-2 avant démarrage
Statut : "en_cours"
```

### **ÉTAPE 5 : Suivi chantier**

```
┌────────────────────────────────────────────┐
│ 🏗️ TABLEAU DE BORD CHANTIER               │
│                                             │
│ 💰 [X €] bloqués en sécurité               │
│                                             │
│ Progression : [▓▓▓▓▓░░░░░] 50%            │
│                                             │
│ Étapes :                                    │
│ ✅ Préparation terrain                     │
│ ✅ Démolition existant                     │
│ 🔄 Installation nouveau (en cours)         │
│ ⏳ Finitions                               │
│ ⏳ Nettoyage final                         │
│                                             │
│ Photos progression :                       │
│ [Photo 1] [Photo 2] [Photo 3]             │
│ (uploadées par artisan)                    │
│                                             │
│ Messagerie :                                │
│ Client ↔ Artisan (historique conservé)    │
└────────────────────────────────────────────┘
```

### **ÉTAPE 6 : Fin travaux - Réception**

```
Artisan clique "Travaux terminés"
↓
┌────────────────────────────────────────────┐
│ 📋 PROCÈS-VERBAL DE RÉCEPTION              │
│                                             │
│ Date réception : [XX/XX/XXXX]              │
│ Lieu : [Adresse chantier]                  │
│                                             │
│ Présents :                                  │
│ - Client : [Signature électronique]        │
│ - Artisan : [Signature électronique]       │
│                                             │
│ État des travaux :                          │
│ ( ) Réception sans réserve                 │
│ ( ) Réception avec réserves                │
│ ( ) Refus de réception                     │
│                                             │
│ Si réserves, détail :                      │
│ [Zone texte]                                │
│ Photos justificatives : [Upload]           │
│                                             │
│ Délai levée réserves : [X jours]           │
│                                             │
│ ⚖️ GARANTIES ACTIVÉES :                    │
│ - Parfait achèvement : Jusqu'au XX/XX/2027│
│ - Biennale : Jusqu'au XX/XX/2028          │
│ - Décennale : Jusqu'au XX/XX/2036         │
│                                             │
│ [ Signer le PV ]                           │
└────────────────────────────────────────────┘
↓
Si réserves : Argent reste bloqué jusqu'à levée
Si sans réserve : Passage à la validation mutuelle
```

### **ÉTAPE 7 : Validation mutuelle & Déblocage**

```
PV signé sans réserve
↓
┌────────────────────────────────────────────┐
│ ✅ VALIDATION FINALE                       │
│                                             │
│ 💰 [X €] EN ATTENTE DE DÉBLOCAGE           │
│                                             │
│ ARTISAN valide :                            │
│ [✓] Travaux terminés conformément          │
│ [✓] Client satisfait                       │
│ [✓] Je demande le déblocage des fonds     │
│                                             │
│ [ Valider - Artisan ]                      │
│                                             │
│ ─────────────────────────────────────       │
│                                             │
│ CLIENT valide :                             │
│ [✓] Travaux conformes au devis             │
│ [✓] Qualité satisfaisante                  │
│ [✓] J'autorise le paiement à l'artisan    │
│                                             │
│ [ Valider - Client ]                       │
│                                             │
│ ⚠️ DÉBLOCAGE APRÈS VALIDATION DES 2 PARTIES│
└────────────────────────────────────────────┘
↓
LES DEUX VALIDENT
↓
┌────────────────────────────────────────────┐
│ 🎉 PAIEMENT DÉBLOQUÉ                       │
│                                             │
│ ✅ Artisan valide                          │
│ ✅ Client valide                           │
│                                             │
│ Virement vers l'artisan en cours...       │
│ Délai : 3-5 jours ouvrés                  │
│                                             │
│ Montant : [X €] TTC                        │
│ IBAN : FR76 XXXX XXXX XXXX XXXX           │
│                                             │
│ Facture définitive envoyée                 │
└────────────────────────────────────────────┘
↓
Notification artisan : "💰 [X €] virés sur votre compte"
Notification client : "✅ Paiement validé et versé"
Statut : "termine_paye"
```

### **ÉTAPE 8 : Avis client**

```
Après déblocage
↓
┌────────────────────────────────────────────┐
│ ⭐ ÉVALUATION ARTISAN                      │
│                                             │
│ Comment s'est passé le chantier ?          │
│                                             │
│ Note globale : ★★★★★                       │
│                                             │
│ Critères détaillés :                       │
│ - Qualité travaux : ★★★★★                 │
│ - Respect délais : ★★★★★                  │
│ - Propreté chantier : ★★★★★               │
│ - Communication : ★★★★★                    │
│ - Rapport qualité/prix : ★★★★★            │
│                                             │
│ Commentaire :                               │
│ [Zone texte]                                │
│                                             │
│ Recommanderiez-vous cet artisan ?          │
│ ( ) Oui ( ) Non                            │
│                                             │
│ [Publier mon avis]                         │
└────────────────────────────────────────────┘
```

---

## 🚨 GESTION DES LITIGES

**Si désaccord sur la validation :**

```
┌────────────────────────────────────────────┐
│ ⚖️ LITIGE EN COURS                         │
│                                             │
│ ❌ Client refuse de valider                │
│ OU                                          │
│ ❌ Artisan refuse de valider               │
│                                             │
│ Délai de négociation : 7 jours             │
│                                             │
│ Messagerie litige :                        │
│ [Échange entre les 2 parties]             │
│                                             │
│ Options :                                   │
│ 1. Accord à l'amiable → Déblocage          │
│ 2. Travaux correctifs → Nouveau délai     │
│ 3. Médiation ArtisanSafe (si échec)       │
│                                             │
│ [ Demander médiation ]                     │
└────────────────────────────────────────────┘
↓
Médiation ArtisanSafe (48h)
↓
Décision finale :
- Déblocage total artisan
- Déblocage partiel + correctifs
- Remboursement total/partiel client
```

---

## 💰 SCHÉMA DE PAIEMENT SÉQUESTRE

```
┌─────────────────────────────────────────────────────┐
│         PAIEMENT INTÉGRAL BLOQUÉ (SÉQUESTRE)        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📝 Signature contrat                               │
│      ↓                                               │
│  💳 PAIEMENT COMPLET 100%                           │
│      ↓                                               │
│  🔒 ARGENT BLOQUÉ                                   │
│      (Compte séquestre ArtisanSafe)                 │
│      ↓                                               │
│  🏗️ Travaux réalisés                               │
│      ↓                                               │
│  📋 Réception sans réserve                          │
│      ↓                                               │
│  ✅ ARTISAN valide                                  │
│  +                                                   │
│  ✅ CLIENT valide                                   │
│      ↓                                               │
│  💰 DÉBLOCAGE → Virement artisan                   │
│      (3-5 jours ouvrés)                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## ✅ Avantages

### **Pour le CLIENT :**
- ✅ Argent sécurisé, pas dans les mains de l'artisan
- ✅ Travaux garantis (sinon remboursement)
- ✅ Protection maximale contre les arnaques
- ✅ Validation finale obligatoire avant paiement

### **Pour l'ARTISAN :**
- ✅ Paiement garanti (argent déjà bloqué)
- ✅ Pas de relance client pour payer
- ✅ Virement automatique après validation
- ✅ Protection contre les impayés

---

## 💸 Coûts Plateforme

- **Commission ArtisanSafe :** 5-8% du montant
- **Frais bancaires :** 0,5-1%
- **Service séquestre :** 1-2%

---

## 🏦 Prestataires de Paiement Recommandés

Ce modèle nécessite un **PSP (Payment Service Provider)** comme :

1. **Stripe Connect** (USA, Europe)
   - Séquestre natif (Stripe Connect)
   - Split payment automatique
   - Conformité PSD2

2. **Mangopay** (français, spécialisé marketplaces)
   - Régulé ACPR (Autorité de Contrôle Prudentiel)
   - E-wallets pour séquestre
   - Paiement différé

3. **Lemonway** (français, régulé ACPR)
   - Spécialisé crowdfunding/marketplace
   - Conformité française totale
   - Support technique français
