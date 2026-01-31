// Test regex manuel
const texte = "NUMEROtelephione066882710";

console.log("Texte à tester:", texte);
console.log("\nExtraction des chiffres consécutifs:");

// Chercher tous les groupes de chiffres
const matches = texte.match(/\d+/g);
console.log("Groupes de chiffres trouvés:", matches);

if (matches) {
  matches.forEach(m => {
    console.log(`  - "${m}" (longueur: ${m.length})`);
  });
}

console.log("\n--- Tests de patterns ---");

// Test 1: 10 chiffres avec frontière
const pattern1 = /\b\d{10,}\b/g;
console.log("Pattern /\\b\\d{10,}\\b/g:", pattern1.test(texte) ? "✅ DÉTECTÉ" : "❌ NON DÉTECTÉ");

// Test 2: Lettre suivie de 10+ chiffres
const pattern2 = /[a-z]\d{10,}/gi;
console.log("Pattern /[a-z]\\d{10,}/gi:", pattern2.test(texte) ? "✅ DÉTECTÉ" : "❌ NON DÉTECTÉ");

// Test 3: N'importe où, 10+ chiffres consécutifs
const pattern3 = /\d{10,}/g;
console.log("Pattern /\\d{10,}/g:", pattern3.test(texte) ? "✅ DÉTECTÉ" : "❌ NON DÉTECTÉ");

// Test 4: Extraction avec groupe de capture
const pattern4 = /([a-z])(\d{10,})/gi;
const result = texte.match(pattern4);
console.log("Pattern avec capture /([a-z])(\\d{10,})/gi:", result);
