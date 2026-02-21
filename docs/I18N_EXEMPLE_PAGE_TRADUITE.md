# Exemple de page traduite - Page d'accueil

Voici un exemple concret de comment traduire une page complète en utilisant le système i18n.

## Avant (hardcodé en français)

```tsx
// ❌ AVANT - Texte hardcodé
export default function HomePage() {
  return (
    <div>
      <h1>Bienvenue sur ArtisanDispo</h1>
      <p>Trouvez des artisans qualifiés près de chez vous</p>
      
      <nav>
        <Link href="/">Accueil</Link>
        <Link href="/annuaire">Nos artisans</Link>
        <Link href="/comment-ca-marche">Comment ça marche</Link>
      </nav>

      <button>S'inscrire</button>
      <button>Se connecter</button>
    </div>
  );
}
```

## Après (multilingue)

### 1. Ajouter les traductions dans `fr.json`

```json
{
  "home": {
    "title": "Bienvenue sur ArtisanDispo",
    "subtitle": "Trouvez des artisans qualifiés près de chez vous",
    "searchPlaceholder": "Rechercher un artisan...",
    "findCraftsman": "Trouver un artisan"
  }
}
```

### 2. Ajouter les traductions dans `en.json`

```json
{
  "home": {
    "title": "Welcome to ArtisanDispo",
    "subtitle": "Find qualified craftsmen near you",
    "searchPlaceholder": "Search for a craftsman...",
    "findCraftsman": "Find a craftsman"
  }
}
```

### 3. Utiliser les traductions dans le composant

```tsx
// ✅ APRÈS - Traductions dynamiques
'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
      
      <nav>
        <Link href="/">{t('nav.home')}</Link>
        <Link href="/annuaire">{t('nav.directory')}</Link>
        <Link href="/comment-ca-marche">{t('nav.howItWorks')}</Link>
      </nav>

      <button>{t('auth.signUp')}</button>
      <button>{t('auth.signIn')}</button>

      <input 
        type="search" 
        placeholder={t('home.searchPlaceholder')}
      />
      <button>{t('home.findCraftsman')}</button>
    </div>
  );
}
```

## Exemple avec Navigation du Header

```tsx
// frontend/src/components/Header.tsx

'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';

export default function Header() {
  const { t } = useLanguage();

  return (
    <nav>
      <Link href="/">
        <Logo />
      </Link>

      <div className="nav-links">
        <Link href="/annuaire">
          {t('nav.directory')}
        </Link>
        
        <Link href="/comment-ca-marche">
          {t('nav.howItWorks')}
        </Link>
        
        <Link href="/etre-rappele">
          {t('nav.beCalledBack')}
        </Link>
      </div>

      <div className="actions">
        <Link href="/inscription?role=client">
          <button>{t('auth.client')}</button>
        </Link>
        
        <Link href="/inscription?role=artisan">
          <button>{t('auth.artisan')}</button>
        </Link>
      </div>
    </nav>
  );
}
```

## Exemple avec formulaire de connexion

```tsx
'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form>
      <h2>{t('auth.signIn')}</h2>
      
      <label>{t('common.email')}</label>
      <input 
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('common.email')}
      />

      <label>{t('common.password')}</label>
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('common.password')}
      />

      <Link href="/mot-de-passe-oublie">
        {t('auth.forgotPassword')}
      </Link>

      <button type="submit">
        {t('auth.signIn')}
      </button>

      <p>
        {t('auth.noAccount')}{' '}
        <Link href="/inscription">
          {t('auth.signUp')}
        </Link>
      </p>
    </form>
  );
}
```

## Exemple avec liste métiers

```tsx
'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function TradesList() {
  const { t } = useLanguage();

  const trades = ['plumbing', 'electricity', 'carpentry', 'masonry'];

  return (
    <div>
      <h2>{t('nav.directory')}</h2>
      
      <ul>
        {trades.map(trade => (
          <li key={trade}>
            <Link href={`/annuaire?trade=${trade}`}>
              {t(`trades.${trade}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Résultat

### Français (par défaut)
```
Bienvenue sur ArtisanDispo
Trouvez des artisans qualifiés près de chez vous

Navigation:
- Accueil
- Nos artisans
- Comment ça marche

Boutons:
- Particulier
- Artisan
```

### English (après changement de langue)
```
Welcome to ArtisanDispo
Find qualified craftsmen near you

Navigation:
- Home
- Our Craftsmen
- How It Works

Buttons:
- Individual
- Craftsman
```

## Conseils pratiques

### 1. Grouper par fonctionnalité
```json
{
  "auth": { ... },      // Tout ce qui concerne l'authentification
  "nav": { ... },       // Navigation
  "dashboard": { ... }, // Tableau de bord
  "quotes": { ... }     // Devis
}
```

### 2. Utiliser des noms descriptifs
```typescript
// ✅ Bon
t('auth.signIn')
t('nav.directory')
t('quotes.accept')

// ❌ Mauvais
t('button1')
t('text')
t('label')
```

### 3. Penser bilingue dès le départ
```tsx
// Au lieu de
<h1>Bienvenue</h1>

// Toujours faire
<h1>{t('common.welcome')}</h1>
```

Cela évite de devoir tout refactoriser plus tard !
