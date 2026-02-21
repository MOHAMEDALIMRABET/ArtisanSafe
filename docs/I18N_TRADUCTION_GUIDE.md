# 🌍 Système de Traduction i18n - ArtisanSafe

## Vue d'ensemble

Le système de traduction permet de basculer entre **Français** et **Anglais** via un sélecteur de drapeau dans le header.

## Architecture

```
frontend/src/
├── contexts/
│   └── LanguageContext.tsx      # Context React pour gérer la langue
├── locales/
│   ├── fr.json                  # Traductions françaises
│   └── en.json                  # Traductions anglaises
└── components/
    ├── LanguageSelector.tsx     # Sélecteur de langue avec drapeaux
    └── Providers.tsx            # Wrapper pour tous les contexts
```

## Utilisation

### 1. Dans un composant Client

```tsx
'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function MyComponent() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('nav.home')}</p>
      <button onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
        Changer de langue
      </button>
    </div>
  );
}
```

### 2. Traductions disponibles

#### Navigation (`nav.*`)
```typescript
t('nav.home')           // "Accueil" / "Home"
t('nav.directory')      // "Nos artisans" / "Our Craftsmen"
t('nav.howItWorks')     // "Comment ça marche" / "How It Works"
t('nav.beCalledBack')   // "Être rappelé" / "Request a Call"
```

#### Authentification (`auth.*`)
```typescript
t('auth.signIn')        // "Se connecter" / "Sign In"
t('auth.signUp')        // "S'inscrire" / "Sign Up"
t('auth.forgotPassword') // "Mot de passe oublié ?" / "Forgot password?"
```

#### Commun (`common.*`)
```typescript
t('common.welcome')     // "Bienvenue" / "Welcome"
t('common.loading')     // "Chargement..." / "Loading..."
t('common.save')        // "Enregistrer" / "Save"
```

## Ajouter de nouvelles traductions

### 1. Éditer `fr.json` et `en.json`

```json
// fr.json
{
  "myFeature": {
    "title": "Mon titre",
    "description": "Ma description"
  }
}

// en.json
{
  "myFeature": {
    "title": "My title",
    "description": "My description"
  }
}
```

### 2. Utiliser dans le code

```tsx
const { t } = useLanguage();

<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.description')}</p>
```

## Fonctionnalités

### ✅ Persistance
La langue choisie est sauvegardée dans `localStorage` et restaurée au rechargement.

### ✅ Fallback automatique
Si une traduction est manquante, le système :
1. Affiche la clé de traduction
2. Log un warning dans la console
3. Retourne vers le français par défaut

### ✅ Détection navigateur (TODO)
Actuellement défaut sur 'fr', mais peut être étendu pour détecter :
```typescript
const browserLang = navigator.language.split('-')[0]; // 'fr', 'en', etc.
```

## Sélecteur de langue

### Emplacement
- **Desktop** : Header, à droite, entre le logo et le menu utilisateur
- **Mobile** : Même position

### Apparence
- Drapeaux SVG haute qualité :
  - 🇫🇷 Drapeau français (Bleu-Blanc-Rouge)
  - 🇬🇧 Drapeau britannique (Union Jack)
- Taille : `40px × 40px` (aligné avec l'icône utilisateur)
- Hover : Ring orange `#FF6B00`
- Dropdown avec checkmark sur langue active

## Bonnes pratiques

### ✅ Faire
- Toujours utiliser `t('key')` au lieu de hardcoder le texte
- Grouper les traductions par fonctionnalité
- Utiliser des clés descriptives (`nav.home` plutôt que `h1`)

### ❌ Éviter
- Hardcoder du texte directement : `<h1>Accueil</h1>`
- Mélanger français et anglais dans le même fichier
- Utiliser des clés trop génériques : `t('text')`, `t('label')`

## Exemple complet

```tsx
'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      
      <nav>
        <Link href="/">{t('nav.home')}</Link>
        <Link href="/annuaire">{t('nav.directory')}</Link>
        <Link href="/comment-ca-marche">{t('nav.howItWorks')}</Link>
      </nav>

      <button className="bg-[#FF6B00] text-white px-4 py-2 rounded-lg">
        {t('auth.signUp')}
      </button>
    </div>
  );
}
```

## Langues supportées

| Code | Langue    | Drapeau | Statut      |
|------|-----------|---------|-------------|
| `fr` | Français  | 🇫🷷       | ✅ Complet   |
| `en` | Anglais   | 🇬🇧      | ✅ Complet   |

## TODO - Améliorations futures

- [ ] Détection automatique langue navigateur
- [ ] Support pluralization (`1 artisan` vs `2 artisans`)
- [ ] Support variables dynamiques : `t('welcome', { name: 'John' })`
- [ ] Lazy loading des traductions (Next.js dynamic import)
- [ ] Support RTL (arabe, hébreu)
- [ ] Export/import CSV pour traducteurs externes

## Debug

### Voir la langue actuelle
```tsx
const { language } = useLanguage();
console.log('Langue active:', language); // 'fr' ou 'en'
```

### Tester toutes les traductions
```tsx
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';

console.log('FR:', fr);
console.log('EN:', en);
```

### Warnings console
Si vous voyez : `Traduction manquante pour: myKey.subKey`
→ Ajoutez cette clé dans `fr.json` et `en.json`
