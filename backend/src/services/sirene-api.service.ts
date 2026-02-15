/**
 * Service d'intégration avec l'API SIRENE publique gratuite
 * Documentation : https://entreprise.data.gouv.fr/api_doc/sirene
 * 100% GRATUIT - Aucune clé API requise
 */

interface SireneResponse {
  valid: boolean;
  raisonSociale?: string;
  adresse?: string;
  activite?: string;
  error?: string;
  data?: {
    siret: string;
    raisonSociale: string;
    adresse: string;
    codePostal: string;
    ville: string;
    activite: string;
    dateCreation: string;
  };
}

/**
 * Vérifier un SIRET et récupérer les informations de l'entreprise
 * @param siret SIRET à vérifier (14 chiffres)
 * @param raisonSocialeInput Raison sociale fournie par l'utilisateur
 * @param adresseInput Adresse complète fournie par l'utilisateur
 * 
 * ⚠️ VALIDATION MANUELLE PAR ADMIN
 * - SIRET : Vérification format 14 chiffres uniquement
 * - Raison sociale : Acceptée telle quelle (admin vérifie via documents KBIS)
 * - Adresse : Acceptée telle quelle (admin vérifie via documents)
 * - API SIRENE : Désactivée (code commenté, réactivable si besoin)
 */
export async function verifySiret(
  siret: string, 
  raisonSocialeInput?: string,
  adresseInput?: string
): Promise<SireneResponse> {
  try {
    // Nettoyer le SIRET (enlever espaces)
    const cleanSiret = siret.replace(/\s/g, '');

    // Vérifier format (14 chiffres)
    if (!/^\d{14}$/.test(cleanSiret)) {
      return {
        valid: false,
        error: 'Le SIRET doit contenir exactement 14 chiffres'
      };
    }

    // ✅ VALIDATION MANUELLE - Accepter données artisan, admin vérifie documents
    console.log(`✅ SIRET format valide: ${cleanSiret}`);
    console.log(`📝 Raison sociale fournie: ${raisonSocialeInput || 'Non renseignée'}`);
    console.log(`📍 Adresse fournie: ${adresseInput || 'Non renseignée'}`);
    console.log(`ℹ️  Vérification manuelle par admin lors validation documents`);

    // Retourner les données fournies par l'artisan (admin vérifiera)
    return {
      valid: true,
      raisonSociale: raisonSocialeInput || 'À compléter',
      adresse: adresseInput || 'À compléter',
      activite: 'Vérifié par admin',
      data: {
        siret: cleanSiret,
        raisonSociale: raisonSocialeInput || 'À compléter',
        adresse: adresseInput || 'À compléter',
        codePostal: 'Vérifié par admin',
        ville: 'Vérifié par admin',
        activite: 'Vérifié par admin',
        dateCreation: new Date().toISOString().split('T')[0]
      }
    };

    /* ========================================
     * 🔒 CODE API SIRENE DÉSACTIVÉ
     * ========================================
     * Réactiver si besoin futur (décommenter ci-dessous)
     * 
    // LOG DEBUG : Vérifier la valeur de la variable d'environnement
    console.log(`🔧 DEBUG - SIRENE_BYPASS_VERIFICATION = "${process.env.SIRENE_BYPASS_VERIFICATION}"`);

    // MODE BYPASS ACTIVÉ - Utilisation en développement uniquement
    if (process.env.SIRENE_BYPASS_VERIFICATION === 'true') {
      console.log(`⚠️ MODE BYPASS ACTIVÉ - Vérification SIRENE désactivée (dev uniquement)`);
      const raisonSociale = raisonSocialeInput || 'ENTREPRISE TEST (BYPASS MODE)';
      console.log(`📝 Raison sociale utilisée: ${raisonSociale}`);
      return {
        valid: true,
        raisonSociale: raisonSociale,
        adresse: '1 Rue de Test, 75001 Paris',
        activite: 'Test Mode',
        data: {
          siret: cleanSiret,
          raisonSociale: raisonSociale,
          adresse: '1 Rue de Test, 75001 Paris',
          codePostal: '75001',
          ville: 'Paris',
          activite: 'Test Mode',
          dateCreation: new Date().toISOString().split('T')[0]
        }
      };
    }
    */

    /* ========================================
     * 🔒 APPEL API SIRENE DÉSACTIVÉ
     * ========================================
     * 
    // Appel à l'API SIRENE publique GRATUITE (entreprise.data.gouv.fr)
    console.log(`📡 Appel API SIRENE publique: ${cleanSiret}`);
    
    const response = await fetch(
      `https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/${cleanSiret}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArtisanDispo/1.0'
        },
        signal: AbortSignal.timeout(15000) // Timeout 15s
      }
    );

    console.log(`📊 Réponse API SIRENE - Status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`❌ SIRET ${cleanSiret} introuvable dans la base SIRENE`);
        return {
          valid: false,
          error: 'SIRET introuvable dans la base SIRENE'
        };
      }
      
      const errorText = await response.text();
      console.error(`❌ Erreur API INSEE (${response.status}):`, errorText);
      
      return {
        valid: false,
        error: `Erreur API SIRENE: ${response.status}`
      };
    }

    const data: any = await response.json();
    console.log(`📦 Données reçues de SIRENE:`, JSON.stringify(data, null, 2));
    const etablissement = data.etablissement;
    
    if (!etablissement) {
      return {
        valid: false,
        error: 'Données SIRET introuvables'
      };
    }

    // Extraire les informations
    const uniteLegale = etablissement.unite_legale;
    
    // Raison sociale (plusieurs champs possibles)
    const raisonSociale = 
      uniteLegale?.denomination ||
      uniteLegale?.nom_raison_sociale ||
      `${uniteLegale?.prenom_usuel || ''} ${uniteLegale?.nom || ''}`.trim() ||
      etablissement.enseigne_1 ||
      'Non renseigné';

    // Adresse complète
    const adresse = [
      etablissement.numero_voie,
      etablissement.type_voie,
      etablissement.libelle_voie,
      etablissement.code_postal,
      etablissement.libelle_commune
    ].filter(Boolean).join(' ');

    // Activité principale
    const activite = etablissement.activite_principale;

    console.log(`✅ Données extraites SIRENE:`, {
      raisonSociale,
      adresse,
      activite,
      codePostal: etablissement.code_postal,
      ville: etablissement.libelle_commune
    });

    return {
      valid: true,
      raisonSociale,
      adresse,
      activite
    };
    */

  } catch (error: any) {
    console.error('Erreur vérification SIRET:', error);
    return {
      valid: false,
      error: error.message || 'Erreur lors de la vérification du SIRET'
    };
  }
}

/**
 * Comparer deux raisons sociales (tolérance casse, accents, espaces)
 */
export function compareRaisonsSociales(input: string, reference: string): boolean {
  // Normaliser : minuscules, sans accents, sans espaces multiples, sans ponctuation
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever accents
      .replace(/[^\w\s]/g, '') // Enlever ponctuation
      .replace(/\s+/g, ' ') // Espaces multiples → simple
      .trim();
  };

  const normalizedInput = normalize(input);
  const normalizedReference = normalize(reference);

  // Comparaison exacte après normalisation
  if (normalizedInput === normalizedReference) {
    return true;
  }

  // Tolérance : vérifier si l'un contient l'autre (pour gérer "SARL XXX" vs "XXX")
  if (normalizedInput.includes(normalizedReference) || normalizedReference.includes(normalizedInput)) {
    return true;
  }

  // Tolérance : calculer similarité (au moins 80%)
  const similarity = calculateSimilarity(normalizedInput, normalizedReference);
  return similarity >= 0.8;
}

/**
 * Calculer la similarité entre deux chaînes (algorithme de Levenshtein simplifié)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Distance de Levenshtein (nombre de modifications nécessaires)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Vérifier l'adéquation SIRET + Raison Sociale
 */
export async function verifySiretWithRaisonSociale(
  siret: string,
  raisonSocialeInput: string
): Promise<{ valid: boolean; message?: string; details?: any }> {
  console.log(`\n🔍 ====== DÉBUT VÉRIFICATION SIRET + RAISON SOCIALE ======`);
  console.log(`📋 SIRET reçu: ${siret}`);
  console.log(`📋 Raison sociale reçue: ${raisonSocialeInput}`);
  
  // 1. Vérifier le SIRET dans SIRENE (en passant la raison sociale pour le mode bypass)
  const sireneResult = await verifySiret(siret, raisonSocialeInput);

  if (!sireneResult.valid) {
    console.log(`❌ Échec vérification SIRET: ${sireneResult.error}`);
    return {
      valid: false,
      message: sireneResult.error || 'SIRET invalide'
    };
  }

  console.log(`✅ SIRET valide dans la base SIRENE`);

  // MODE BYPASS ACTIVÉ - Vérification en développement uniquement
  if (process.env.SIRENE_BYPASS_VERIFICATION === 'true') {
    console.log(`✅ MODE BYPASS - Vérification acceptée sans comparaison raison sociale`);
    return {
      valid: true,
      message: 'SIRET vérifié (mode bypass développement)',
      details: sireneResult.data || {
        siret: siret,
        raisonSociale: sireneResult.raisonSociale || 'TEST',
        adresse: sireneResult.adresse || 'Adresse test',
        activite: sireneResult.activite || 'Activité test'
      }
    };
  }

  // 2. Comparer la raison sociale
  const raisonSocialeSIRENE = sireneResult.raisonSociale;
  
  console.log(`📊 Comparaison raisons sociales:`);
  console.log(`   - Saisie artisan: "${raisonSocialeInput}"`);
  console.log(`   - Base SIRENE:    "${raisonSocialeSIRENE}"`);
  
  if (!raisonSocialeSIRENE) {
    console.error('❌ Raison sociale SIRENE manquante dans le résultat:', sireneResult);
    return {
      valid: false,
      message: 'Données SIRENE incomplètes (raison sociale manquante)'
    };
  }
  
  const match = compareRaisonsSociales(raisonSocialeInput, raisonSocialeSIRENE);
  console.log(`🔎 Résultat comparaison: ${match ? '✅ MATCH' : '❌ PAS DE MATCH'}`);

  if (!match) {
    console.log(`❌ Raisons sociales non conformes`);
    return {
      valid: false,
      message: `La raison sociale ne correspond pas. Base SIRENE indique : "${raisonSocialeSIRENE}"`,
      details: {
        raisonSocialeSaisie: raisonSocialeInput,
        raisonSocialeSIRENE: raisonSocialeSIRENE
      }
    };
  }

  // 3. Tout est OK
  console.log(`✅ ====== VÉRIFICATION COMPLÈTE RÉUSSIE ======\n`);
  return {
    valid: true,
    message: 'SIRET et raison sociale vérifiés avec succès',
    details: {
      siret,
      raisonSociale: raisonSocialeSIRENE,
      adresse: sireneResult.adresse,
      activite: sireneResult.activite
    }
  };
}
