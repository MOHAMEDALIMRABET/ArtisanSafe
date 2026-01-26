/**
 * Tests du système anti-bypass
 * Vérifie la détection de tous les patterns de contournement
 */

import { validateMessage, BLOCKED_EXAMPLES, VALID_EXAMPLES } from '../lib/antiBypassValidator';

console.log('🧪 Tests du système anti-bypass\n');
console.log('=' + '='.repeat(60) + '\n');

// Test 1: Messages bloqués
console.log('❌ MESSAGES DEVANT ÊTRE BLOQUÉS:\n');
BLOCKED_EXAMPLES.forEach((msg, index) => {
  const result = validateMessage(msg);
  const status = result.isValid ? '❌ ÉCHEC' : '✅ OK';
  console.log(`${index + 1}. ${status} - "${msg}"`);
  if (!result.isValid) {
    console.log(`   → Catégories détectées: ${result.blockedPatterns.join(', ')}`);
  }
  console.log('');
});

// Test 2: Messages valides
console.log('\n' + '=' + '='.repeat(60) + '\n');
console.log('✅ MESSAGES DEVANT PASSER:\n');
VALID_EXAMPLES.forEach((msg, index) => {
  const result = validateMessage(msg);
  const status = result.isValid ? '✅ OK' : '❌ ÉCHEC';
  console.log(`${index + 1}. ${status} - "${msg}"`);
  if (!result.isValid) {
    console.log(`   → Faux positif! Catégories: ${result.blockedPatterns.join(', ')}`);
  }
  console.log('');
});

// Test 3: Cas limites
console.log('\n' + '=' + '='.repeat(60) + '\n');
console.log('⚠️ CAS LIMITES ET CONTOURNEMENTS:\n');

const edgeCases = [
  "Mon numéro c'est zéro six douze",
  "Appelle au o6 12 34 56 78", // o au lieu de 0
  "Contact: 0 6 1 2 3 4 5 6 7 8", // Chiffres séparés
  "Mon mail: test arobase gmail point com",
  "Retrouve-moi sur g m a i l . c o m",
  "J'habite 75001 Paris 1er",
  "Code postal: 75 001",
  "Contacte-moi en dehors de la plateforme",
  "On peut se voir directement ?",
  "Travaux urgents le 12/06", // Ne doit PAS bloquer (date, pas téléphone)
  "Devis de 1200 euros", // Ne doit PAS bloquer (prix)
  "Rendez-vous à 12h30", // Ne doit PAS bloquer (heure)
];

edgeCases.forEach((msg, index) => {
  const result = validateMessage(msg);
  const status = result.isValid ? '✅ PASSÉ' : '❌ BLOQUÉ';
  console.log(`${index + 1}. ${status} - "${msg}"`);
  if (!result.isValid) {
    console.log(`   → Catégories: ${result.blockedPatterns.join(', ')}`);
  }
  console.log('');
});

console.log('\n' + '=' + '='.repeat(60));
console.log('✅ Tests terminés !');
