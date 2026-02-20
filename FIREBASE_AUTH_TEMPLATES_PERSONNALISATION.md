# 🎨 Personnalisation Templates Firebase Auth - Guide Complet

**Date** : 20 février 2026  
**Objectif** : Maximiser la personnalisation des emails Firebase Auth (vérification + réinitialisation MDP)

---

## ⚠️ LIMITATIONS IMPORTANTES

Firebase Auth offre une **personnalisation LIMITÉE** des templates email :

### ✅ Ce qui PEUT être personnalisé

| Élément | Personnalisable ? | Comment ? |
|---------|-------------------|-----------|
| **Nom expéditeur** | ✅ Oui | Console Firebase → Authentication → Templates |
| **Sujet email** | ✅ Oui (partiel) | Console Firebase → Peut ajouter préfixe |
| **Message texte** | ✅ Oui | Console Firebase → Personnaliser message |
| **URL de redirection** | ✅ Oui | Code : `actionCodeSettings.url` |
| **Langue** | ✅ Oui | Console Firebase → Choisir langue (FR disponible) |
| **Lien dynamique** | ✅ Oui | Firebase Dynamic Links |

### ❌ Ce qui NE PEUT PAS être personnalisé

| Élément | Personnalisable ? | Raison |
|---------|-------------------|--------|
| **Design HTML complet** | ❌ Non | Firebase impose son template HTML |
| **Logo personnalisé** | ❌ Non | Pas d'upload image dans template |
| **Couleurs branding** | ❌ Non | Couleurs Firebase fixes |
| **Footer personnalisé** | ❌ Non | Footer Firebase imposé |
| **Bouton CTA style** | ❌ Non | Bouton bleu Firebase standard |

**Source** : [Firebase Auth Email Templates Documentation](https://firebase.google.com/docs/auth/custom-email-handler)

---

## 📧 1. PERSONNALISATION CONSOLE FIREBASE

### Étape 1 : Accéder aux templates

1. **Console Firebase** : https://console.firebase.google.com/project/artisansafe
2. **Authentication** → **Templates** (onglet à gauche)
3. Modifier les 3 templates disponibles :
   - ✉️ Email address verification
   - 🔑 Password reset
   - 📧 Email address change confirmation

---

### Étape 2 : Template "Email address verification"

**Paramètres à configurer** :

#### A) Informations expéditeur

```
Nom de l'expéditeur : ArtisanSafe
Adresse email : noreply@artisansafe.fr
(ou noreply@artisandispo.fr selon domaine final)
```

⚠️ **Note** : L'email doit être vérifié dans Firebase. Si vous n'avez pas de domaine personnalisé, utilisez :
```
noreply@artisansafe.firebaseapp.com
```

#### B) Sujet de l'email

```
Français : Vérifiez votre adresse email - ArtisanSafe
Anglais : Verify your email address - ArtisanSafe
```

#### C) Corps du message (Template FR recommandé)

```
Bonjour,

Merci de vous être inscrit sur ArtisanSafe, la plateforme qui 
connecte clients et artisans qualifiés !

Pour activer votre compte et profiter de tous nos services, 
veuillez vérifier votre adresse email en cliquant sur le lien 
ci-dessous :

%LINK%

Ce lien expirera dans 24 heures.

Après vérification :
• Vous pourrez publier vos demandes de travaux (clients)
• Votre profil sera visible par les clients (artisans)
• Vous recevrez des notifications par email

Si vous n'avez pas créé de compte, vous pouvez ignorer cet email 
en toute sécurité.

Besoin d'aide ? Contactez-nous à support@artisansafe.fr

Cordialement,
L'équipe ArtisanSafe

---
ArtisanSafe - La confiance au service de vos travaux
```

**Variables disponibles** :
- `%LINK%` : Lien de vérification (OBLIGATOIRE)
- `%EMAIL%` : Email de l'utilisateur
- `%APP_NAME%` : Nom de l'application

---

### Étape 3 : Template "Password reset"

**Paramètres à configurer** :

#### A) Sujet
```
Français : Réinitialisation de votre mot de passe - ArtisanSafe
Anglais : Reset your password - ArtisanSafe
```

#### B) Corps du message

```
Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe sur 
ArtisanSafe.

Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :

%LINK%

Ce lien est valable pendant 1 heure.

Si vous n'avez pas demandé cette réinitialisation :
• Ignorez cet email
• Votre mot de passe actuel reste inchangé
• Vérifiez que personne n'a accès à votre compte

Pour votre sécurité :
• Choisissez un mot de passe fort (minimum 8 caractères)
• Ne partagez jamais votre mot de passe
• Activez la vérification en 2 étapes (recommandé)

Besoin d'aide ? Contactez-nous à support@artisansafe.fr

Cordialement,
L'équipe ArtisanSafe
```

---

### Étape 4 : Langue par défaut

1. **Authentication** → **Settings** → **Localization**
2. Sélectionner **Français** comme langue par défaut
3. Ajouter **Anglais** comme langue secondaire (optionnel)

Firebase détectera automatiquement la langue du navigateur de l'utilisateur et enverra l'email dans la langue appropriée.

---

## 🚀 2. PERSONNALISATION CODE (actionCodeSettings)

### Fichier : `frontend/src/lib/auth-service.ts`

**Code actuel (déjà implémenté)** :

```typescript
import { sendEmailVerification } from 'firebase/auth';

// Envoi email de vérification
await sendEmailVerification(user, {
  url: `${window.location.origin}/email-verified`,
  handleCodeInApp: false,
});
```

### Personnalisation MAXIMALE possible

```typescript
import { sendEmailVerification, ActionCodeSettings } from 'firebase/auth';

// Configuration complète des paramètres d'action
const actionCodeSettings: ActionCodeSettings = {
  // URL de redirection après vérification
  url: `${window.location.origin}/email-verified?role=${user.role}&welcome=true`,
  
  // Gérer le code dans l'application (false = ouvre navigateur)
  handleCodeInApp: false,
  
  // iOS App Store ID (si app mobile future)
  iOS: {
    bundleId: 'fr.artisansafe.app'
  },
  
  // Android package name (si app mobile future)
  android: {
    packageName: 'fr.artisansafe.app',
    installApp: true,
    minimumVersion: '12'
  },
  
  // Forcer redirection dynamique (Firebase Dynamic Links)
  dynamicLinkDomain: 'artisansafe.page.link'
};

// Envoi avec configuration complète
await sendEmailVerification(user, actionCodeSettings);
```

### Paramètres `actionCodeSettings` disponibles

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `url` | string | URL de redirection après clic | `https://artisansafe.fr/email-verified` |
| `handleCodeInApp` | boolean | Gérer vérification sans navigateur | `false` (recommandé) |
| `iOS.bundleId` | string | ID app iOS (future) | `fr.artisansafe.app` |
| `android.packageName` | string | Package Android (future) | `fr.artisansafe.app` |
| `dynamicLinkDomain` | string | Domaine Firebase Dynamic Links | `artisansafe.page.link` |

---

## 🎨 3. AMÉLIORATION PROPOSÉE DU CODE

### Fichier : `frontend/src/lib/auth-service.ts`

**Mise à jour recommandée** :

```typescript
import { 
  sendEmailVerification, 
  sendPasswordResetEmail,
  ActionCodeSettings 
} from 'firebase/auth';

/**
 * Configuration globale des emails Firebase Auth
 */
const getActionCodeSettings = (params?: { 
  role?: 'client' | 'artisan',
  action?: 'verify' | 'reset' | 'change'
}): ActionCodeSettings => {
  const baseUrl = window.location.origin;
  
  // URL personnalisée selon action
  let redirectUrl = `${baseUrl}/email-verified`;
  if (params?.action === 'reset') {
    redirectUrl = `${baseUrl}/mot-de-passe-redefini`;
  } else if (params?.action === 'change') {
    redirectUrl = `${baseUrl}/email-modifie`;
  }
  
  // Ajouter paramètres de tracking (optionnel)
  const queryParams = new URLSearchParams();
  if (params?.role) {
    queryParams.append('role', params.role);
  }
  queryParams.append('timestamp', Date.now().toString());
  
  return {
    url: `${redirectUrl}?${queryParams.toString()}`,
    handleCodeInApp: false,
    // iOS et Android pour future app mobile
    iOS: {
      bundleId: 'fr.artisansafe.app'
    },
    android: {
      packageName: 'fr.artisansafe.app',
      installApp: false
    }
  };
};

/**
 * Inscription client (MAJ)
 */
async signUpClient(data: ClientSignUpData) {
  // ... code existant ...
  
  // Envoyer email de vérification avec config personnalisée
  try {
    await sendEmailVerification(
      user, 
      getActionCodeSettings({ role: 'client', action: 'verify' })
    );
    console.log('✅ Email de vérification envoyé à', data.email);
  } catch (emailError) {
    console.error('⚠️ Erreur envoi email de vérification:', emailError);
  }
  
  // ... reste du code ...
}

/**
 * Inscription artisan (MAJ)
 */
async signUpArtisan(data: ArtisanSignUpData) {
  // ... code existant ...
  
  // Envoyer email de vérification avec config personnalisée
  try {
    await sendEmailVerification(
      user, 
      getActionCodeSettings({ role: 'artisan', action: 'verify' })
    );
    console.log('✅ Email de vérification envoyé à', data.email);
  } catch (emailError) {
    console.error('⚠️ Erreur envoi email de vérification:', emailError);
  }
  
  // ... reste du code ...
}

/**
 * Réinitialisation mot de passe (MAJ)
 */
async resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(
      auth, 
      email,
      getActionCodeSettings({ action: 'reset' })
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: translateAuthError(error) };
  }
}
```

---

## 📱 4. PAGES DE REDIRECTION PERSONNALISÉES

Créer des pages d'atterrissage agréables après vérification email.

### Fichier : `frontend/src/app/email-verified/page.tsx`

**Version améliorée** :

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStatus } from '@/hooks/useAuthStatus';

export default function EmailVerifiedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthStatus();
  const [countdown, setCountdown] = useState(5);
  
  const role = searchParams.get('role') as 'client' | 'artisan' | null;

  useEffect(() => {
    if (!loading && user?.emailVerified) {
      // Décompte avant redirection automatique
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Redirection selon rôle
            if (role === 'artisan') {
              router.push('/artisan/dashboard');
            } else if (role === 'client') {
              router.push('/client/dashboard');
            } else {
              router.push('/');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [loading, user, role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00]"></div>
      </div>
    );
  }

  if (!user?.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Vérification en cours...
          </h1>
          <p className="text-gray-600 mb-6">
            Veuillez patienter pendant que nous vérifions votre email.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg hover:bg-[#E56100]"
          >
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Icône de succès animée */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ✅ Email vérifié !
        </h1>

        {/* Message personnalisé selon rôle */}
        {role === 'artisan' ? (
          <div className="space-y-4">
            <p className="text-lg text-gray-700">
              Félicitations ! Votre email a été vérifié avec succès.
            </p>
            <div className="bg-blue-50 border-l-4 border-[#FF6B00] p-4 text-left">
              <p className="text-sm text-gray-700 font-semibold mb-2">
                Prochaines étapes :
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Uploader vos documents (KBIS, RC Pro, Garantie décennale)</li>
                <li>Attendre la validation par notre équipe (24-48h)</li>
                <li>Commencer à recevoir des demandes de devis</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-lg text-gray-700">
              Parfait ! Vous pouvez maintenant profiter de tous nos services.
            </p>
            <div className="bg-blue-50 border-l-4 border-[#FF6B00] p-4 text-left">
              <p className="text-sm text-gray-700 font-semibold mb-2">
                Vous pouvez maintenant :
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                <li>Publier des demandes de travaux</li>
                <li>Recevoir des devis d'artisans qualifiés</li>
                <li>Comparer et choisir la meilleure offre</li>
              </ul>
            </div>
          </div>
        )}

        {/* Redirection automatique */}
        <div className="mt-6 text-gray-500 text-sm">
          Redirection automatique dans <span className="font-bold text-[#FF6B00]">{countdown}</span> secondes...
        </div>

        {/* Bouton manuel */}
        <button
          onClick={() => {
            if (role === 'artisan') {
              router.push('/artisan/dashboard');
            } else if (role === 'client') {
              router.push('/client/dashboard');
            } else {
              router.push('/');
            }
          }}
          className="mt-4 w-full bg-[#FF6B00] text-white px-6 py-3 rounded-lg hover:bg-[#E56100] transition-colors font-semibold"
        >
          Accéder à mon tableau de bord →
        </button>
      </div>
    </div>
  );
}
```

---

## 🔄 5. ALTERNATIVE : EMAILS COMPLÈTEMENT PERSONNALISÉS

Si vous avez besoin d'une **personnalisation totale** (design HTML, logo, branding complet), vous devez :

### Option A : Custom Email Handler (Complexe)

Créer votre propre handler d'emails de vérification :

1. **Désactiver emails Firebase** (ne pas appeler `sendEmailVerification()`)
2. **Générer token personnalisé** :
```typescript
import { getAuth } from 'firebase-admin/auth';

const customToken = await getAuth().createCustomToken(userId, {
  emailVerification: true,
  expiresIn: 86400 // 24h
});
```

3. **Envoyer via Nodemailer** (système déjà en place) :
```typescript
import { sendEmail } from '@/lib/email-notification-service';

await sendEmail({
  to: user.email,
  subject: '✉️ Vérifiez votre adresse email - ArtisanSafe',
  htmlContent: customHTMLTemplate,  // ← Design complet personnalisé
  textContent: customTextTemplate,
  type: 'email_verification'
});
```

4. **Créer endpoint vérification** :
```typescript
// backend/src/routes/auth.routes.ts
router.post('/verify-email', async (req, res) => {
  const { token, uid } = req.body;
  
  // Vérifier token custom
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  if (decodedToken.emailVerification && decodedToken.uid === uid) {
    // Marquer email comme vérifié
    await admin.auth().updateUser(uid, { emailVerified: true });
    return res.json({ success: true });
  }
  
  return res.status(400).json({ error: 'Token invalide' });
});
```

**⚠️ Inconvénients** :
- Complexe à implémenter
- Plus de maintenance
- Perte sécurité native Firebase
- Gestion expiration tokens manuelle

### Option B : SendGrid ou Resend (Recommandé si besoin total contrôle)

Si vraiment besoin de design complet personnalisé :

1. **Utiliser SendGrid** pour TOUS les emails (y compris vérification)
2. **Templates visuels** drag & drop dans SendGrid
3. **Branding complet** : logo, couleurs, footer
4. **Analytics** : tracking ouvertures, clics

**Budget** : Gratuit jusqu'à 100 emails/jour, puis 19.95$/mois

---

## 📊 COMPARAISON SOLUTIONS

| Solution | Personnalisation | Complexité | Coût | Recommandation |
|----------|------------------|------------|------|----------------|
| **Firebase + Console** | 🟡 Partielle (60%) | ✅ Très simple | ✅ Gratuit | ⭐ **RECOMMANDÉ ACTUEL** |
| **Firebase + actionCodeSettings** | 🟡 Partielle (70%) | ✅ Simple | ✅ Gratuit | ⭐ **RECOMMANDÉ** |
| **Custom Handler + Nodemailer** | 🟢 Totale (100%) | 🔴 Complexe | ✅ Gratuit | ⚠️ Si vraiment nécessaire |
| **SendGrid complet** | 🟢 Totale (100%) | 🟡 Moyenne | 🟡 19.95$/mois | 💡 Phase 2 si volume |

---

## ✅ RECOMMANDATIONS FINALES

### Pour ArtisanSafe MVP (maintenant)

1. ✅ **Utiliser Firebase Auth templates** (solution actuelle)
2. ✅ **Personnaliser via Console Firebase** (30 min de configuration)
3. ✅ **Ajouter actionCodeSettings** dans code (voir section 3)
4. ✅ **Créer page email-verified** agréable (voir section 4)

**Résultat** : Emails professionnels, personnalisés à 70%, 100% gratuits

### Pour ArtisanSafe Phase 2 (futur)

Si besoin absolu de design complet personnalisé :
- 💡 Migrer vers **SendGrid** pour tous les emails transactionnels
- 💡 Templates visuels avec logo ArtisanSafe, couleurs orange/bleu
- 💡 Analytics détaillés (taux ouverture, clics)

**Budget estimé** : Gratuit (< 100 emails/jour) → 19.95$/mois (jusqu'à 40k emails)

---

## 🎯 PROCHAINES ÉTAPES IMMÉDIATES

1. **Configurer templates Firebase Console** (30 min)
   - Nom expéditeur : "ArtisanSafe"
   - Sujet FR personnalisé
   - Corps message personnalisé (voir section 2)

2. **Mettre à jour code auth-service.ts** (15 min)
   - Ajouter fonction `getActionCodeSettings()`
   - Utiliser dans `signUpClient()` et `signUpArtisan()`

3. **Améliorer page email-verified** (30 min)
   - Design agréable avec animations
   - Message personnalisé client vs artisan
   - Redirection automatique avec décompte

**Temps total estimé** : 1h15 pour personnalisation maximale possible

---

**Document créé le** : 20 février 2026  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Prêt à implémenter
