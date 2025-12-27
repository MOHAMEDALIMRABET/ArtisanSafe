# Task 3.2 - Agenda Disponibilités

## ✅ Progrès

### 1. Recherche bibliothèque calendrier ✅
- **Choix**: `react-big-calendar` 
- **Raison**: Vue semaine/jour avec slots horaires, drag & drop, customisation
- **Alternative étudiée**: `react-calendar` (trop basique pour notre cas)

### 2. Structure données DisponibiliteSlot ✅

```typescript
interface DisponibiliteSlot {
  id?: string;
  jour?: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
  date?: Timestamp; // Pour créneaux ponctuels
  heureDebut: string; // "09:00"
  heureFin: string; // "17:00"
  recurrence: 'hebdomadaire' | 'ponctuel';
  disponible: boolean;
  titre?: string;
  couleur?: string;
  dateCreation?: Timestamp;
}
```

**Exemples d'utilisation**:
- **Disponibilité hebdomadaire**: Tous les lundis 9h-17h
  ```typescript
  {
    jour: 'lundi',
    heureDebut: '09:00',
    heureFin: '17:00',
    recurrence: 'hebdomadaire',
    disponible: true
  }
  ```

- **Créneau ponctuel**: Chantier le 27 déc 10h-16h
  ```typescript
  {
    date: Timestamp.fromDate(new Date(2025, 11, 27)),
    heureDebut: '10:00',
    heureFin: '16:00',
    recurrence: 'ponctuel',
    disponible: false,
    titre: 'Chantier client X'
  }
  ```

### 3. Page /artisan/agenda créée ✅

**Fonctionnalités implémentées**:
- ✅ Calendrier vue semaine/jour/mois
- ✅ Localisateur français (date-fns)
- ✅ Créneaux 7h-20h
- ✅ Clic pour ajouter disponibilité
- ✅ Clic sur événement pour modifier/supprimer
- ✅ Couleurs: Vert (disponible) / Rouge (occupé)
- ✅ Navigation retour dashboard
- ✅ Bouton sauvegarder

**À faire**:
- ⏳ Installer `npm install react-big-calendar date-fns`
- ⏳ Charger données depuis Firestore
- ⏳ Sauvegarder dans Firestore
- ⏳ Drag & drop pour déplacer créneaux
- ⏳ Sélection multiple (bulk update)

## 📦 Installation requise

```bash
cd frontend
npm install react-big-calendar date-fns
```

## 🔗 Liens

- Page agenda: `http://localhost:3000/artisan/agenda`
- Fichier: `frontend/src/app/artisan/agenda/page.tsx`
- Types: `frontend/src/types/firestore.ts`

## 🎯 Prochaines étapes

1. **Installer les dépendances npm**
2. **Créer le service Firestore** pour disponibilités
3. **Implémenter CRUD** (Create, Read, Update, Delete)
4. **Ajouter drag & drop**
5. **Lier depuis dashboard** (card Agenda)

## 📝 Notes techniques

- **Localisation**: Français via date-fns locale
- **Timezone**: UTC (à adapter si besoin)
- **Performance**: Pagination à implémenter si > 100 créneaux
- **Validation**: Vérifier chevauchements horaires
