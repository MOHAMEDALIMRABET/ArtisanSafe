const fs = require('fs');

const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json','utf8'));
const fr = JSON.parse(fs.readFileSync('frontend/src/locales/fr.json','utf8'));

// Check types
console.log('fr.common keys:', Object.keys(fr.common));
console.log('en.common keys:', Object.keys(en.common));
console.log('fr.profile.companyInfo type:', typeof fr.profile.companyInfo, '=', JSON.stringify(fr.profile.companyInfo).slice(0,60));
console.log('fr.profile.trades type:', typeof fr.profile.trades, '=', JSON.stringify(fr.profile.trades).slice(0,60));
console.log('en.profile.companyInfo type:', typeof en.profile.companyInfo, '=', JSON.stringify(en.profile.companyInfo).slice(0,60));
console.log('en.profile.trades type:', typeof en.profile.trades, '=', JSON.stringify(en.profile.trades).slice(0,60));
console.log('en.messaging.conversations:', en.messaging ? en.messaging.conversations : 'MISSING');
console.log('fr.alerts.validation keys:', Object.keys(fr.alerts.validation || {}));
console.log('fr.alerts.refusal keys:', Object.keys(fr.alerts.refusal || {}));
console.log('fr.artisanAgenda keys:', Object.keys(fr.artisanAgenda || {}));
console.log('en.artisanAgenda.calendar:', en.artisanAgenda ? en.artisanAgenda.calendar : 'MISSING');

// Check if profile.companyInfo is used without sub-key anywhere
const content = fs.readFileSync('frontend/src/app/artisan/profil/page.tsx','utf8');
const directUses = [];
for (const line of content.split('\n')) {
  if (line.includes("t('profile.companyInfo')") || line.includes('t("profile.companyInfo")')) {
    directUses.push(line.trim().slice(0,100));
  }
}
console.log('Direct uses of profile.companyInfo (no sub-key):', directUses);
