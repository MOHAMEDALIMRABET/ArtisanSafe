/**
 * Script de patch: ajoute toutes les clés i18n manquantes dans fr.json et en.json
 */
const fs = require('fs');

// === PATCHES FR ===
const fr = JSON.parse(fs.readFileSync('frontend/src/locales/fr.json', 'utf8'));

// 1. common – ajouts
Object.assign(fr.common, {
  artisan: "Artisan",
  individual: "Particulier",
  tradesperson: "Artisan",
  unknownError: "Une erreur inattendue s'est produite"
});

// 2. messaging.conversations
fr.messaging.conversations = "Conversations";

// 3. alerts.validation – ajouts
Object.assign(fr.alerts.validation, {
  enterCity: "⚠️ Veuillez saisir une ville",
  enterDescription: "⚠️ Veuillez décrire votre besoin",
  fillRequired: "⚠️ Veuillez remplir tous les champs obligatoires",
  missingCriteria: "❌ Critères de recherche manquants. Veuillez recommencer votre recherche.",
  publishError: "❌ Impossible de publier la demande. Veuillez réessayer."
});

// 4. alerts.refusal – ajout clé distincte (motif de refus dans litiges)
fr.alerts.refusal.refusalReasonRequired = "⚠️ Veuillez indiquer un motif de refus";

// 5. artisanAgenda – calendar, dateFilters, instructions
fr.artisanAgenda.calendar = {
  month: "Mois",
  previous: "Précédent",
  next: "Suivant",
  today: "Aujourd'hui",
  agenda: "Agenda",
  date: "Date",
  event: "Événement",
  allDay: "Toute la journée",
  noEventsInRange: "Aucun événement sur cette période",
  showMore: "+ {total} de plus"
};
fr.artisanAgenda.dateFilters = {
  startDateLabel: "Date de début",
  endDateLabel: "Date de fin",
  resetButton: "Réinitialiser les filtres"
};
fr.artisanAgenda.instructions = {
  title: "Comment utiliser l'agenda ?",
  quickSelection: "Cliquer sur une plage de dates pour bloquer rapidement vos disponibilités",
  agendaView: "Vue liste de tous vos événements à venir",
  calendarView: "Vue mensuelle pour visualiser et gérer vos événements",
  clickDay: "Cliquer sur un jour vide pour ajouter un événement",
  clickEvent: "Cliquer sur un événement pour le modifier ou le supprimer",
  colors: "Chaque couleur correspond à un type d'événement (disponibilité, indisponibilité, contrat)",
  contracts: "Les blocs oranges représentent vos contrats en cours (non modifiables)"
};

// 6. profile.actions
fr.profile.actions = {
  save: "Enregistrer les modifications",
  saving: "Enregistrement...",
  cancel: "Annuler"
};

// 7. profile.messages
fr.profile.messages = {
  profileNotFound: "Profil artisan introuvable. Veuillez compléter votre inscription.",
  loadError: "Erreur lors du chargement du profil",
  businessNameRequired: "⚠️ Le nom de l'entreprise est obligatoire",
  addressRequired: "⚠️ L'adresse est obligatoire",
  tradesRequired: "⚠️ Veuillez sélectionner au moins un métier",
  cityRequired: "⚠️ La ville principale est obligatoire",
  updateSuccess: "✅ Profil mis à jour avec succès",
  updateSuccessTitle: "Profil mis à jour !",
  updateSuccessMessage: "Vos modifications ont été enregistrées avec succès.",
  updateError: "❌ Erreur lors de la mise à jour du profil. Veuillez réessayer."
};

// 8. profile.presentation
fr.profile.presentation = {
  title: "Présentation",
  label: "Description de votre activité",
  placeholder: "Décrivez votre expérience, vos spécialités, vos valeurs...",
  characters: "{count} / 1000 caractères"
};

// 9. profile.serviceArea
fr.profile.serviceArea = {
  title: "Zone d'intervention",
  mainCity: "Ville principale",
  mainCityPlaceholder: "Ex: Paris, Lyon, Marseille...",
  radius: "Rayon d'intervention",
  radiusMin: "5 km",
  radiusMax: "100 km"
};

// 10. profile.companyInfo – convertir de string en objet
fr.profile.companyInfo = {
  title: "Informations entreprise",
  siret: "Numéro SIRET",
  siretPlaceholder: "14 chiffres (ex: 12345678901234)",
  siretHelper: "Le SIRET est votre identifiant unique d'entreprise (14 chiffres)",
  businessName: "Nom de l'entreprise",
  businessNamePlaceholder: "Ex: Plomberie Dupont",
  address: "Adresse professionnelle",
  addressPlaceholder: "Numéro, rue, ville...",
  addressHelper: "L'adresse complète de votre entreprise"
};

// 11. profile.trades – convertir de string en objet
fr.profile.trades = {
  title: "Métiers",
  selectAtLeastOne: "(sélectionnez au moins un)",
  lockedTitle: "🔒 Métiers verrouillés",
  lockedMessage: "Vos métiers sont verrouillés car des documents ont déjà été vérifiés.",
  lockedHelper: "Contactez le support pour modifier vos métiers.",
  decennaleMandatoryTitle: "⚠️ Assurance décennale obligatoire",
  decennaleMandatoryMessage: "Certains de vos métiers nécessitent une garantie décennale.",
  decennaleConcernedTrades: "Métiers concernés : maçonnerie, charpente, couverture, plomberie, électricité..."
};

fs.writeFileSync('frontend/src/locales/fr.json', JSON.stringify(fr, null, 2), 'utf8');
console.log('✅ fr.json patché');

// === PATCHES EN ===
const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));

Object.assign(en.common, {
  artisan: "Tradesperson",
  individual: "Individual",
  tradesperson: "Tradesperson",
  unknownError: "An unexpected error occurred"
});

en.messaging.conversations = "Conversations";

Object.assign(en.alerts.validation, {
  enterCity: "⚠️ Please enter a city",
  enterDescription: "⚠️ Please describe your needs",
  fillRequired: "⚠️ Please fill in all required fields",
  missingCriteria: "❌ Missing search criteria. Please start your search again.",
  publishError: "❌ Unable to publish the request. Please try again."
});

en.alerts.refusal.refusalReasonRequired = "⚠️ Please provide a reason for refusal";

en.artisanAgenda.calendar = {
  month: "Month",
  previous: "Previous",
  next: "Next",
  today: "Today",
  agenda: "Agenda",
  date: "Date",
  event: "Event",
  allDay: "All day",
  noEventsInRange: "No events in this range",
  showMore: "+ {total} more"
};
en.artisanAgenda.dateFilters = {
  startDateLabel: "Start date",
  endDateLabel: "End date",
  resetButton: "Reset filters"
};
en.artisanAgenda.instructions = {
  title: "How to use the agenda?",
  quickSelection: "Click on a date range to quickly block your availability",
  agendaView: "List view of all your upcoming events",
  calendarView: "Monthly view to visualise and manage your events",
  clickDay: "Click on an empty day to add an event",
  clickEvent: "Click on an event to edit or delete it",
  colors: "Each colour represents a type of event (availability, unavailability, contract)",
  contracts: "Orange blocks represent your active contracts (non-editable)"
};

en.profile.actions = {
  save: "Save changes",
  saving: "Saving...",
  cancel: "Cancel"
};

en.profile.messages = {
  profileNotFound: "Tradesperson profile not found. Please complete your registration.",
  loadError: "Error loading profile",
  businessNameRequired: "⚠️ Company name is required",
  addressRequired: "⚠️ Address is required",
  tradesRequired: "⚠️ Please select at least one trade",
  cityRequired: "⚠️ Main city is required",
  updateSuccess: "✅ Profile updated successfully",
  updateSuccessTitle: "Profile updated!",
  updateSuccessMessage: "Your changes have been saved successfully.",
  updateError: "❌ Error updating profile. Please try again."
};

en.profile.presentation = {
  title: "Presentation",
  label: "Description of your activity",
  placeholder: "Describe your experience, specialities, values...",
  characters: "{count} / 1000 characters"
};

en.profile.serviceArea = {
  title: "Service area",
  mainCity: "Main city",
  mainCityPlaceholder: "e.g. London, Manchester...",
  radius: "Service radius",
  radiusMin: "5 km",
  radiusMax: "100 km"
};

en.profile.companyInfo = {
  title: "Company information",
  siret: "SIRET number",
  siretPlaceholder: "14 digits (e.g. 12345678901234)",
  siretHelper: "SIRET is your unique company identifier (14 digits)",
  businessName: "Company name",
  businessNamePlaceholder: "e.g. Dupont Plumbing",
  address: "Business address",
  addressPlaceholder: "Number, street, city...",
  addressHelper: "The full address of your business"
};

en.profile.trades = {
  title: "Trades",
  selectAtLeastOne: "(select at least one)",
  lockedTitle: "🔒 Locked trades",
  lockedMessage: "Your trades are locked because documents have already been verified.",
  lockedHelper: "Contact support to change your trades.",
  decennaleMandatoryTitle: "⚠️ Decennial insurance required",
  decennaleMandatoryMessage: "Some of your trades require decennial (10-year) insurance.",
  decennaleConcernedTrades: "Concerned trades: masonry, framing, roofing, plumbing, electrical..."
};

fs.writeFileSync('frontend/src/locales/en.json', JSON.stringify(en, null, 2), 'utf8');
console.log('✅ en.json patché');

// Vérification finale
const frCheck = JSON.parse(fs.readFileSync('frontend/src/locales/fr.json', 'utf8'));
const enCheck = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));
console.log('\n=== Vérification ===');
console.log('fr.common.artisan:', frCheck.common.artisan);
console.log('fr.profile.companyInfo.title:', frCheck.profile.companyInfo.title);
console.log('fr.profile.trades.title:', frCheck.profile.trades.title);
console.log('fr.artisanAgenda.calendar.today:', frCheck.artisanAgenda.calendar.today);
console.log('fr.alerts.refusal.refusalReasonRequired:', frCheck.alerts.refusal.refusalReasonRequired);
console.log('en.common.artisan:', enCheck.common.artisan);
console.log('en.messaging.conversations:', enCheck.messaging.conversations);
