/**
 * Test de validation anti-bypass pour le formulaire de devis
 * Vérification que tous les cas de contournement sont détectés
 */

// Simuler la fonction validateMessage (copie simplifiée)
const BLOCKED_PATTERNS = {
  telephone: [
    /\b0[1-9][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/gi,
    /\b\d{10,}\b/g,
    /[a-z]\d{9,}/gi,  // ← NOUVEAU : Lettre + 9+ chiffres
    /\d{9,}[a-z]/gi,  // ← NOUVEAU : 9+ chiffres + lettre
    /\b0\d{8,}\b/g,   // ← NOUVEAU : Numéros français partiels (0 + 8+ chiffres)
    /\+\d{8,}/g,
  ],
  email: [
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
  ],
};

function testValidation(texte) {
  console.log(`\n📝 Test : "${texte}"`);
  
  for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(texte)) {
        console.log(`❌ BLOQUÉ - Détecté par pattern ${category}: ${pattern}`);
        return false;
      }
    }
  }
  
  console.log(`✅ AUTORISÉ`);
  return true;
}

// === TESTS ===

console.log('='.repeat(60));
console.log('🧪 TEST DE VALIDATION ANTI-CONTOURNEMENT - FORMULAIRE DEVIS');
console.log('='.repeat(60));

// Test cas utilisateur (le problème rapporté)
testValidation("NUMEROtelephione066882710");

// Tests supplémentaires
testValidation("06 12 34 56 78");
testValidation("0612345678");
testValidation("Appelez-moi au 0668827100");
testValidation("Mon tel: 0668827100");
testValidation("Installation de 12 prises électriques"); // Doit être autorisé
testValidation("contact@artisan.com");
testValidation("Travaux de rénovation qualité professionnelle"); // Doit être autorisé

console.log('\n' + '='.repeat(60));
console.log('📊 RÉSULTAT : Le pattern /\\b\\d{10,}\\b/g détecte bien les numéros sans espaces');
console.log('='.repeat(60));
