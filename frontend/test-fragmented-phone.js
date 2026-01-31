/**
 * Test de détection des numéros de téléphone fragmentés
 */

function detectFragmentedPhoneNumbers(text) {
  const fragmentedPattern = /0[a-z0-9]{15,}/gi;
  const matches = text.match(fragmentedPattern) || [];
  
  for (const match of matches) {
    const digitsOnly = match.replace(/\D/g, '');
    
    if (digitsOnly.length >= 10 && digitsOnly.startsWith('0')) {
      console.log(`✅ DÉTECTÉ : "${match}" → Chiffres: "${digitsOnly}"`);
      return true;
    }
  }
  
  return false;
}

// Tests
const testCases = [
  "0626num25tel32phone10",           // Cas reporté par l'utilisateur
  "Installation de 12 prises",        // Texte légitime
  "0612345678",                       // Numéro normal (devrait être détecté par autre pattern)
  "mon0numero6est1le2345678",         // Variante
  "appelez0moi6au1deux2trois4cinq6sept8neuf0", // Avec mots français
  "Installation électrique standard",  // Légitime
];

console.log("🧪 Test de détection des numéros fragmentés\n");

testCases.forEach((test, index) => {
  const result = detectFragmentedPhoneNumbers(test);
  const status = result ? "🚫 BLOQUÉ" : "✅ AUTORISÉ";
  console.log(`${index + 1}. ${status} : "${test}"`);
});

console.log("\n📊 Résultats détaillés :\n");
testCases.forEach((test) => {
  const matches = test.match(/0[a-z0-9]{15,}/gi) || [];
  if (matches.length > 0) {
    matches.forEach(match => {
      const digitsOnly = match.replace(/\D/g, '');
      console.log(`Input : "${test}"`);
      console.log(`Match : "${match}"`);
      console.log(`Chiffres : "${digitsOnly}" (${digitsOnly.length} chiffres)`);
      console.log(`Bloqué : ${digitsOnly.length >= 10 && digitsOnly.startsWith('0') ? 'OUI ❌' : 'NON ✅'}`);
      console.log('---');
    });
  }
});
