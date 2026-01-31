// Test rapide du validator anti-bypass

const testMessages = [
  { msg: "9585774453", shouldBlock: true, reason: "10 chiffres consécutifs" },
  { msg: "Bonjour, comment allez-vous ?", shouldBlock: false, reason: "Message normal" },
  { msg: "Mon email est test@gmail.com", shouldBlock: true, reason: "Email" },
  { msg: "Appelle-moi au 06 12 34 56 78", shouldBlock: true, reason: "Téléphone formaté" },
  { msg: "J'habite au 15 rue de la Paix", shouldBlock: true, reason: "Adresse postale" },
  { msg: "Code postal 75001", shouldBlock: true, reason: "Code postal" },
  { msg: "+33612345678", shouldBlock: true, reason: "Téléphone international" },
  { msg: "0123456789", shouldBlock: true, reason: "10 chiffres" },
  { msg: "Disponible mardi prochain", shouldBlock: false, reason: "Message normal" },
];

// Pattern pour numéros (10 chiffres ou plus)
const phonePattern = /\b\d{10,}\b/g;

console.log("🧪 Test du validator anti-bypass\n");

testMessages.forEach(({ msg, shouldBlock, reason }) => {
  const isBlocked = phonePattern.test(msg);
  const status = isBlocked === shouldBlock ? "✅" : "❌";
  
  console.log(`${status} "${msg}"`);
  console.log(`   Raison: ${reason}`);
  console.log(`   Bloqué: ${isBlocked ? "OUI" : "NON"} (attendu: ${shouldBlock ? "OUI" : "NON"})\n`);
});
