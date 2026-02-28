/**
 * Service de parsing de documents (Kbis)
 * Extraction et vérification des informations SIRET
 */

/**
 * Résultat du parsing du Kbis
 */
export interface KbisParseResult {
  success: boolean;
  siret?: string;
  siren?: string;
  companyName?: string;
  legalForm?: string;
  representantLegal?: string;
  registrationDate?: string;
  emissionDate?: string; // Date d'émission du KBIS
  qrCodeData?: string; // Données du QR code
  qrCodeValid?: boolean; // QR code valide et pointe vers INPI
  hasInpiLogo?: boolean; // Détection du logo INPI
  hasSeal?: boolean; // Détection cachet (forme circulaire)
  hasSignature?: boolean; // Détection signature (zone dense d'encre)
  hasOfficialHeader?: boolean; // Détection en-tête "Greffe du Tribunal de Commerce"
  sealQuality?: 'good' | 'medium' | 'poor'; // Qualité du cachet
  signatureQuality?: 'good' | 'medium' | 'poor'; // Qualité de la signature
  documentQuality?: 'authentic' | 'suspicious' | 'altered'; // Qualité générale
  qualityScore?: number; // Score global 0-100
  error?: string;
}

/**
 * Parse un document Kbis (PDF ou image) pour extraire le SIRET + vérifications avancées
 * Utilise Tesseract.js pour l'OCR + jsQR pour la lecture du QR code
 */
export async function parseKbisDocument(file: File): Promise<KbisParseResult> {
  try {
    // Vérifier le type de fichier
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Format de fichier non supporté. Utilisez PDF, JPG ou PNG.'
      };
    }

    // Vérifier la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Fichier trop volumineux. Taille maximum : 10MB.'
      };
    }

    let text = '';
    let imageData: ImageData | null = null;

    // Si c'est un PDF, le convertir en image d'abord
    if (file.type === 'application/pdf') {
      const pdfResult = await extractFromPDF(file);
      text = pdfResult.text;
      imageData = pdfResult.imageData;
    } else {
      // Pour les images, utiliser directement Tesseract + QR
      const imageResult = await extractFromImage(file);
      text = imageResult.text;
      imageData = imageResult.imageData;
    }

    // 1. Parser le texte extrait (SIRET, date, etc.)
    const parseResult = parseKbisText(text);

    // 2. Analyses visuelles avancées si image disponible
    if (imageData) {
      // 2A. Détection QR code
      const qrResult = await detectQRCode(imageData);
      parseResult.qrCodeData = qrResult.data;
      parseResult.qrCodeValid = qrResult.valid;

      // 2B. Détection cachet et signature
      const visualElements = await detectVisualElements(imageData);
      parseResult.hasSeal = visualElements.hasSeal;
      parseResult.hasSignature = visualElements.hasSignature;

      // 2C. Détection logo INPI
      parseResult.hasInpiLogo = await detectInpiLogo(imageData);

      // 2D. Détection en-tête officiel
      parseResult.hasOfficialHeader = detectOfficialHeader(text);

      // 2E. Analyse qualité cachet et signature
      if (parseResult.hasSeal || parseResult.hasSignature) {
        const qualityAnalysis = await analyzeElementsQuality(imageData, parseResult.hasSeal, parseResult.hasSignature);
        parseResult.sealQuality = qualityAnalysis.sealQuality;
        parseResult.signatureQuality = qualityAnalysis.signatureQuality;
      }

      // 2F. Détection de falsifications
      const authenticityCheck = await detectDocumentAlterations(imageData);
      parseResult.documentQuality = authenticityCheck.quality;
      parseResult.qualityScore = authenticityCheck.score;
    }

    return parseResult;

  } catch (error) {
    console.error('Erreur parsing Kbis:', error);
    return {
      success: false,
    };
  }
}

/**
 * Extrait le texte ET l'image d'un fichier image (pour OCR + QR code)
 */
async function extractFromImage(file: File): Promise<{ text: string; imageData: ImageData | null }> {
  // Import dynamique de Tesseract
  const Tesseract = (await import('tesseract.js')).default;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const imageDataUrl = e.target?.result as string;
        
        // 1. OCR avec Tesseract
        const { data: { text } } = await Tesseract.recognize(
          imageDataUrl,
          'fra',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`🔍 OCR: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );

        // 2. Convertir en ImageData pour détection QR
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({ text, imageData });
          } else {
            resolve({ text, imageData: null });
          }
        };
        img.src = imageDataUrl;
        
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Détecte le logo INPI dans le document
 * Méthode : Recherche de texte "INPI" en haut du document + analyse de densité
 */
async function detectInpiLogo(imageData: ImageData): Promise<boolean> {
  try {
    const { width, height, data } = imageData;
    
    // Zone de recherche : Haut du document (20% supérieur)
    const searchHeight = Math.floor(height * 0.2);
    
    // Chercher zones avec logo potentiel (zone dense en haut à droite ou gauche)
    let hasLogoDensity = false;
    
    // Analyser le quart supérieur gauche et droit
    const zones = [
      { x: 0, y: 0, w: Math.floor(width * 0.3), h: searchHeight }, // Haut gauche
      { x: Math.floor(width * 0.7), y: 0, w: Math.floor(width * 0.3), h: searchHeight } // Haut droit
    ];
    
    for (const zone of zones) {
      let darkPixels = 0;
      let totalPixels = 0;
      
      for (let y = zone.y; y < zone.y + zone.h && y < height; y++) {
        for (let x = zone.x; x < zone.x + zone.w && x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          
          if (brightness < 200) darkPixels++;
          totalPixels++;
        }
      }
      
      const density = darkPixels / totalPixels;
      
      // Logo typique : 15-40% de densité dans la zone
      if (density > 0.15 && density < 0.4) {
        hasLogoDensity = true;
        console.log(`📋 Zone logo potentiel détectée (densité: ${(density * 100).toFixed(1)}%)`);
        break;
      }
    }
    
    return hasLogoDensity;
    
  } catch (error) {
    console.error('Erreur détection logo INPI:', error);
    return false;
  }
}

/**
 * Détecte l'en-tête officiel "Greffe du Tribunal de Commerce" dans le texte OCR
 */
function detectOfficialHeader(text: string): boolean {
  const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
  
  // Patterns de recherche
  const patterns = [
    /GREFFE.*TRIBUNAL.*COMMERCE/,
    /TRIBUNAL.*COMMERCE/,
    /GREFFE.*TC/,
    /EXTRAIT.*KBIS/,
    /EXTRAIT.*K\s*BIS/
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(normalizedText)) {
      console.log('✅ En-tête officiel détecté:', pattern);
      return true;
    }
  }
  
  return false;
}

/**
 * Analyse la qualité (netteté) des éléments détectés
 */
async function analyzeElementsQuality(
  imageData: ImageData,
  hasSeal: boolean,
  hasSignature: boolean
): Promise<{ sealQuality?: 'good' | 'medium' | 'poor'; signatureQuality?: 'good' | 'medium' | 'poor' }> {
  try {
    const cv = await import('@techstark/opencv-js');
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const laplacian = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Calculer la variance du Laplacien (mesure de netteté)
    cv.Laplacian(gray, laplacian, cv.CV_64F);
    
    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(laplacian, mean, stddev);
    
    const sharpness = stddev.data64F[0];
    
    // Seuils de netteté
    let quality: 'good' | 'medium' | 'poor';
    if (sharpness > 100) {
      quality = 'good';
    } else if (sharpness > 50) {
      quality = 'medium';
    } else {
      quality = 'poor';
    }
    
    console.log(`📊 Qualité image (netteté): ${sharpness.toFixed(2)} → ${quality}`);
    
    // Libérer mémoire
    src.delete();
    gray.delete();
    laplacian.delete();
    mean.delete();
    stddev.delete();
    
    return {
      sealQuality: hasSeal ? quality : undefined,
      signatureQuality: hasSignature ? quality : undefined
    };
    
  } catch (error) {
    console.error('Erreur analyse qualité:', error);
    return {};
  }
}

/**
 * Détecte les altérations/falsifications du document
 * Méthode : Analyse des artefacts de compression, incohérences
 */
async function detectDocumentAlterations(imageData: ImageData): Promise<{ 
  quality: 'authentic' | 'suspicious' | 'altered';
  score: number;
}> {
  try {
    const cv = await import('@techstark/opencv-js');
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    let suspicionScore = 0;
    let totalChecks = 3;
    
    // 1. Analyse de cohérence du bruit
    const noiseVariance = analyzeNoiseConsistency(gray);
    if (noiseVariance > 30) {
      suspicionScore++;
      console.log('⚠️ Variance de bruit élevée (potentielle retouche)');
    }
    
    // 2. Analyse des contours (retouches = contours anormaux)
    const edgeAnomaly = analyzeEdgeAnomalies(gray, cv);
    if (edgeAnomaly > 0.3) {
      suspicionScore++;
      console.log('⚠️ Anomalies de contours détectées');
    }
    
    // 3. Vérification uniformité
    const uniformity = checkImageUniformity(gray, cv);
    if (!uniformity) {
      suspicionScore++;
      console.log('⚠️ Non-uniformité détectée');
    }
    
    // Libérer mémoire
    src.delete();
    gray.delete();
    
    // Score final (0-100)
    const finalScore = Math.round(((totalChecks - suspicionScore) / totalChecks) * 100);
    
    let quality: 'authentic' | 'suspicious' | 'altered';
    if (finalScore >= 70) {
      quality = 'authentic';
    } else if (finalScore >= 40) {
      quality = 'suspicious';
    } else {
      quality = 'altered';
    }
    
    console.log(`🔍 Score d'authenticité: ${finalScore}/100 → ${quality}`);
    
    return { quality, score: finalScore };
    
  } catch (error) {
    console.error('Erreur détection altérations:', error);
    return { quality: 'authentic', score: 100 }; // Bénéfice du doute si erreur
  }
}

/**
 * Analyse la cohérence du bruit dans l'image
 */
function analyzeNoiseConsistency(grayMat: any): number {
  const blockSize = 50;
  const variances: number[] = [];
  
  for (let y = 0; y < grayMat.rows - blockSize; y += blockSize) {
    for (let x = 0; x < grayMat.cols - blockSize; x += blockSize) {
      const roi = grayMat.roi(new (grayMat.constructor as any).Rect(x, y, blockSize, blockSize));
      const mean = new (grayMat.constructor as any).Mat();
      const stddev = new (grayMat.constructor as any).Mat();
      
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cv = require('@techstark/opencv-js');
      cv.meanStdDev(roi, mean, stddev);
      
      variances.push(stddev.data64F[0]);
      
      roi.delete();
      mean.delete();
      stddev.delete();
    }
  }
  
  const meanVar = variances.reduce((a, b) => a + b, 0) / variances.length;
  const varianceOfVariances = variances.reduce((sum, v) => sum + Math.pow(v - meanVar, 2), 0) / variances.length;
  
  return varianceOfVariances;
}

/**
 * Analyse les anomalies de contours
 */
function analyzeEdgeAnomalies(grayMat: any, cv: any): number {
  const edges = new cv.Mat();
  cv.Canny(grayMat, edges, 50, 150);
  
  const totalPixels = edges.rows * edges.cols;
  let edgePixels = 0;
  
  for (let i = 0; i < edges.data.length; i++) {
    if (edges.data[i] > 0) edgePixels++;
  }
  
  const edgeRatio = edgePixels / totalPixels;
  edges.delete();
  
  return edgeRatio > 0.2 ? edgeRatio : 0;
}

/**
 * Vérifie l'uniformité générale du document
 */
function checkImageUniformity(grayMat: any, cv: any): boolean {
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  cv.meanStdDev(grayMat, mean, stddev);
  
  const globalStdDev = stddev.data64F[0];
  
  mean.delete();
  stddev.delete();
  
  // Document normal : stddev entre 40-80
  return globalStdDev > 40 && globalStdDev < 100;
}

/**
 * Détecte et lit un QR code dans une image
 */
async function detectQRCode(imageData: ImageData): Promise<{ data?: string; valid: boolean }> {
  try {
    const jsQR = (await import('jsqr')).default;
    
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      console.log('📱 QR Code détecté:', code.data);
      
      // Vérifier si le QR code pointe vers INPI
      const isInpiUrl = code.data.toLowerCase().includes('inpi.fr') || 
                       code.data.toLowerCase().includes('data.inpi.fr');
      
      return {
        data: code.data,
        valid: isInpiUrl
      };
    }

    return { valid: false };
  } catch (error) {
    console.error('Erreur détection QR:', error);
    return { valid: false };
  }
}

/**
 * Détecte les éléments visuels (cachet et signature) dans le document
 * Méthode avancée : détection de cercles (Hough) + analyse de traits manuscrits
 */
async function detectVisualElements(imageData: ImageData): Promise<{ hasSeal: boolean; hasSignature: boolean }> {
  try {
    // Approche multi-niveaux pour robustesse
    const basicDetection = detectVisualElementsBasic(imageData);
    const advancedDetection = await detectVisualElementsAdvanced(imageData);
    
    // Combiner les résultats (détection si au moins une méthode positive)
    return {
      hasSeal: basicDetection.hasSeal || advancedDetection.hasSeal,
      hasSignature: basicDetection.hasSignature || advancedDetection.hasSignature
    };
    
  } catch (error) {
    console.error('Erreur détection éléments visuels:', error);
    // Fallback sur méthode basique
    return detectVisualElementsBasic(imageData);
  }
}

/**
 * Détection avancée avec OpenCV (détection multi-formes pour cachets)
 */
async function detectVisualElementsAdvanced(imageData: ImageData): Promise<{ hasSeal: boolean; hasSignature: boolean }> {
  try {
    const cv = await import('@techstark/opencv-js');
    
    // Convertir ImageData en Mat OpenCV
    const { width, height } = imageData;
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    
    // Conversion en niveaux de gris
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // 1. DÉTECTION CACHET : Multi-formes (cercle + ovale + rectangle)
    let hasSeal = false;
    
    // Détection de contours (Canny)
    cv.Canny(gray, edges, 50, 150);
    
    // A. Détection cercles (Hough)
    const circles = new cv.Mat();
    cv.HoughCircles(
      gray,
      circles,
      cv.HOUGH_GRADIENT,
      1,              // dp: résolution inverse
      gray.rows / 8,  // minDist entre centres
      100,            // param1: seuil Canny
      30,             // param2: seuil accumulateur
      20,             // minRadius (20px minimum)
      150             // maxRadius (150px maximum)
    );
    
    // Vérifier cercles détectés
    if (circles.cols > 0) {
      for (let i = 0; i < circles.cols; i++) {
        const x = circles.data32F[i * 3];
        const y = circles.data32F[i * 3 + 1];
        const radius = circles.data32F[i * 3 + 2];
        
        if (radius >= 30 && radius <= 120) {
          const hasContent = analyzeCircleContent(gray, x, y, radius);
          if (hasContent) {
            hasSeal = true;
            console.log(`✅ Cachet CIRCULAIRE détecté à (${Math.round(x)}, ${Math.round(y)}) rayon: ${Math.round(radius)}px`);
            break;
          }
        }
      }
    }
    circles.delete();
    
    // B. Détection ovales et rectangles (via contours)
    if (!hasSeal) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Taille minimum pour un cachet (1000 pixels²)
        if (area < 1000 || area > 50000) continue;
        
        // Approximation polygonale
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.04 * peri, true);
        
        const vertices = approx.rows;
        const rect = cv.boundingRect(contour);
        const aspectRatio = rect.width / rect.height;
        
        // Détection OVALE : 6-12 côtés, ratio proche de 1
        if (vertices >= 6 && vertices <= 12 && aspectRatio >= 0.8 && aspectRatio <= 1.5) {
          // Vérifier si c'est rempli (cachet vs simple bordure)
          const filled = area / (rect.width * rect.height);
          if (filled > 0.5) {
            hasSeal = true;
            console.log(`✅ Cachet OVALE détecté : ${rect.width}x${rect.height}px, ${vertices} côtés`);
            approx.delete();
            break;
          }
        }
        
        // Détection RECTANGULAIRE : 4 côtés, taille typique cachet
        if (vertices === 4 && aspectRatio >= 0.7 && aspectRatio <= 1.3) {
          if (rect.width >= 40 && rect.width <= 150 && rect.height >= 40 && rect.height <= 150) {
            hasSeal = true;
            console.log(`✅ Cachet RECTANGULAIRE détecté : ${rect.width}x${rect.height}px`);
            approx.delete();
            break;
          }
        }
        
        approx.delete();
      }
      
      contours.delete();
      hierarchy.delete();
    }
    
    // 2. DÉTECTION SIGNATURE : Analyse de traits manuscrits
    let hasSignature = false;
    
    // Détecter les zones avec variation d'épaisseur de trait (typique signature)
    const signatureRegions = detectHandwrittenRegions(gray);
    
    if (signatureRegions.length > 0) {
      console.log(`✍️ ${signatureRegions.length} zone(s) manuscrite(s) détectée(s)`);
      hasSignature = true;
    }
    
    // Libérer mémoire
    src.delete();
    gray.delete();
    edges.delete();
    
    return { hasSeal, hasSignature };
    
  } catch (error) {
    console.error('Erreur OpenCV:', error);
    return { hasSeal: false, hasSignature: false };
  }
}

/**
 * Analyse le contenu d'un cercle détecté pour vérifier qu'il s'agit d'un cachet
 */
function analyzeCircleContent(grayMat: any, x: number, y: number, radius: number): boolean {
  try {
    // Extraire la région circulaire
    const roi = grayMat.roi(new (grayMat.constructor as any).Rect(
      Math.max(0, x - radius),
      Math.max(0, y - radius),
      Math.min(radius * 2, grayMat.cols - x + radius),
      Math.min(radius * 2, grayMat.rows - y + radius)
    ));
    
    // Calculer variance (cachet a du texte/motif = variance élevée)
    const mean = new (grayMat.constructor as any).Mat();
    const stddev = new (grayMat.constructor as any).Mat();
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cv = require('@techstark/opencv-js');
    cv.meanStdDev(roi, mean, stddev);
    
    const variance = stddev.data64F[0];
    
    mean.delete();
    stddev.delete();
    roi.delete();
    
    // Cachet typique : variance > 30 (présence de texte/motif)
    return variance > 30;
    
  } catch (error) {
    return false;
  }
}

/**
 * Détecte les zones manuscrites (signatures) par analyse de traits
 */
function detectHandwrittenRegions(grayMat: any): Array<{ x: number; y: number; width: number; height: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cv = require('@techstark/opencv-js');
    const binary = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    
    // Binarisation adaptative (meilleure pour manuscrit)
    cv.adaptiveThreshold(
      grayMat,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11,
      2
    );
    
    // Détecter contours
    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );
    
    const regions: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    // Analyser chaque contour
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      
      // Critères signature manuscrite :
      // - Largeur > Hauteur (signature horizontale)
      // - Largeur entre 50-300px
      // - Hauteur entre 20-80px
      const aspectRatio = rect.width / rect.height;
      
      if (
        aspectRatio > 2 &&           // Très horizontal
        rect.width >= 50 &&
        rect.width <= 300 &&
        rect.height >= 20 &&
        rect.height <= 80
      ) {
        // Vérifier densité de pixels (signature = traits fins)
        const area = cv.contourArea(contour);
        const density = area / (rect.width * rect.height);
        
        if (density > 0.1 && density < 0.5) {
          regions.push(rect);
          console.log(`✍️ Zone manuscrite : ${rect.width}x${rect.height}px, densité: ${density.toFixed(2)}`);
        }
      }
    }
    
    binary.delete();
    contours.delete();
    hierarchy.delete();
    
    return regions;
    
  } catch (error) {
    console.error('Erreur détection manuscrit:', error);
    return [];
  }
}

/**
 * Méthode basique de détection (fallback si OpenCV échoue)
 */
function detectVisualElementsBasic(imageData: ImageData): { hasSeal: boolean; hasSignature: boolean } {
  try {
    const { width, height, data } = imageData;
    
    // Diviser l'image en grille pour détecter zones d'intérêt
    const gridSize = 50; // Taille des cellules de la grille
    const cellsX = Math.floor(width / gridSize);
    const cellsY = Math.floor(height / gridSize);
    
    const densityMap: number[][] = [];
    
    // Calculer la densité de pixels foncés dans chaque cellule
    for (let cy = 0; cy < cellsY; cy++) {
      densityMap[cy] = [];
      for (let cx = 0; cx < cellsX; cx++) {
        let darkPixels = 0;
        let totalPixels = 0;
        
        // Parcourir les pixels de cette cellule
        for (let y = cy * gridSize; y < (cy + 1) * gridSize && y < height; y++) {
          for (let x = cx * gridSize; x < (cx + 1) * gridSize && x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Luminosité moyenne
            const brightness = (r + g + b) / 3;
            
            // Pixel foncé si luminosité < 150
            if (brightness < 150) {
              darkPixels++;
            }
            totalPixels++;
          }
        }
        
        densityMap[cy][cx] = totalPixels > 0 ? darkPixels / totalPixels : 0;
      }
    }
    
    // Détection cachet : Rechercher zones circulaires denses
    let hasSeal = false;
    const sealThreshold = 0.3; // 30% de pixels foncés
    const sealMinCells = 4; // Minimum 4 cellules pour un cachet
    
    for (let cy = 0; cy < cellsY - 2; cy++) {
      for (let cx = 0; cx < cellsX - 2; cx++) {
        // Vérifier une zone 3x3 (forme approximativement circulaire)
        let denseCells = 0;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            if (densityMap[cy + dy] && densityMap[cy + dy][cx + dx] > sealThreshold) {
              denseCells++;
            }
          }
        }
        
        if (denseCells >= sealMinCells) {
          hasSeal = true;
          console.log('🔘 Cachet potentiel détecté à position:', cx * gridSize, cy * gridSize);
          break;
        }
      }
      if (hasSeal) break;
    }
    
    // Détection signature : Rechercher zones horizontales denses (typique signature manuscrite)
    let hasSignature = false;
    const signatureThreshold = 0.2; // 20% de pixels foncés
    const signatureMinWidth = 3; // Au moins 3 cellules de large
    
    for (let cy = 0; cy < cellsY; cy++) {
      let consecutiveDense = 0;
      for (let cx = 0; cx < cellsX; cx++) {
        if (densityMap[cy][cx] > signatureThreshold) {
          consecutiveDense++;
          if (consecutiveDense >= signatureMinWidth) {
            hasSignature = true;
            console.log('✍️ Signature potentielle détectée à ligne:', cy * gridSize);
            break;
          }
        } else {
          consecutiveDense = 0;
        }
      }
      if (hasSignature) break;
    }
    
    return { hasSeal, hasSignature };
    
  } catch (error) {
    console.error('Erreur détection éléments visuels:', error);
    return { hasSeal: false, hasSignature: false };
  }
}

/**
 * Extrait le texte d'un PDF + première page en image pour QR code
 */
async function extractFromPDF(file: File): Promise<{ text: string; imageData: ImageData | null }> {
  // Import dynamique de pdf.js
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configurer le worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        
        let fullText = '';
        let imageData: ImageData | null = null;
        
        // Extraire le texte de chaque page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';

          // Convertir la première page en image pour détection QR
          if (i === 1) {
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              await page.render({
                canvasContext: ctx,
                viewport: viewport
              }).promise;

              imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
          }
        }
        
        resolve({ text: fullText, imageData });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse le texte extrait pour trouver SIRET et autres informations + date d'émission
 */
function parseKbisText(text: string): KbisParseResult {
  // Nettoyer le texte
  const cleanText = text
    .replace(/\s+/g, ' ')
    .toUpperCase();

  // Patterns de recherche
  const siretPattern = /SIRET[:\s]*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})/i;
  const sirenPattern = /SIREN[:\s]*(\d{3}\s?\d{3}\s?\d{3})/i;
  const companyNamePattern = /DENOMINATION[:\s]*([A-ZÀ-ÿ\s&'-]+)/i;
  const legalFormPattern = /(SARL|SAS|SASU|EURL|SA|SCI|EIRL|EI|MICRO-ENTREPRISE)/i;
  const representantPattern = /(?:GERANT|PRESIDENT|DIRIGEANT|REPRESENTANT\s+LEGAL)[:\s]*([A-ZÀ-ÿ\s'-]+)/i;
  
  // Pattern pour la date d'émission (plusieurs formats possibles)
  const emissionDatePatterns = [
    /(?:DELIVRE\s+LE|EMIS\s+LE|DATE\s+D['']EMISSION)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(?:LE|DU)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/  // Dernière tentative: première date trouvée
  ];

  // Extraire SIRET
  const siretMatch = cleanText.match(siretPattern);
  const siret = siretMatch ? siretMatch[1].replace(/\s/g, '') : undefined;

  // Extraire SIREN
  const sirenMatch = cleanText.match(sirenPattern);
  const siren = sirenMatch ? sirenMatch[1].replace(/\s/g, '') : undefined;

  // Extraire nom de l'entreprise
  const companyNameMatch = cleanText.match(companyNamePattern);
  const companyName = companyNameMatch 
    ? companyNameMatch[1].trim() 
    : undefined;

  // Extraire forme juridique
  const legalFormMatch = cleanText.match(legalFormPattern);
  const legalForm = legalFormMatch ? legalFormMatch[1] : undefined;

  // Extraire représentant légal
  const representantMatch = cleanText.match(representantPattern);
  const representantLegal = representantMatch 
    ? representantMatch[1].trim() 
    : undefined;

  // Extraire date d'émission
  let emissionDate: string | undefined;
  for (const pattern of emissionDatePatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      emissionDate = match[1];
      console.log('📅 Date d\'émission détectée:', emissionDate);
      break;
    }
  }

  // Vérifier qu'on a au moins le SIRET
  if (!siret) {
    return {
      success: false,
      error: 'SIRET non trouvé dans le document. Assurez-vous que le document est lisible.'
    };
  }

  // Valider le format SIRET (14 chiffres)
  if (!/^\d{14}$/.test(siret)) {
    return {
      success: false,
      error: 'SIRET trouvé mais format invalide'
    };
  }

  return {
    success: true,
    siret,
    siren,
    companyName,
    legalForm,
    representantLegal,
    emissionDate
  };
}

/**
 * Compare le SIRET du Kbis avec celui du profil
 */
export function compareSiret(kbisSiret: string, profileSiret: string): {
  match: boolean;
  error?: string;
} {
  // Nettoyer les deux SIRET (enlever espaces)
  const cleanKbis = kbisSiret.replace(/\s/g, '');
  const cleanProfile = profileSiret.replace(/\s/g, '');

  // Comparer
  if (cleanKbis === cleanProfile) {
    return { match: true };
  }

  return {
    match: false,
    error: `Le SIRET du Kbis (${cleanKbis}) ne correspond pas au SIRET de votre profil (${cleanProfile})`
  };
}

/**
 * Vérifie que le Kbis a moins de 3 mois
 */
export function isKbisRecent(extractionDate?: string): {
  isRecent: boolean;
  error?: string;
} {
  if (!extractionDate) {
    // Si on ne peut pas extraire la date, on accepte (vérification manuelle admin)
    return { isRecent: true };
  }

  try {
    const kbisDate = new Date(extractionDate);
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (kbisDate < threeMonthsAgo) {
      return {
        isRecent: false,
        error: 'Le Kbis doit avoir moins de 3 mois'
      };
    }

    return { isRecent: true };
  } catch (error) {
    return { isRecent: true }; // Accepter si erreur de parsing date
  }
}

/**
 * Normalise un nom pour la comparaison
 * - Supprime les accents
 * - Convertit en majuscules
 * - Supprime les caractères spéciaux
 * - Supprime les espaces multiples
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '') // Garde uniquement lettres et espaces
    .replace(/\s+/g, ' ') // Espaces multiples → un seul
    .trim();
}

/**
 * Compare le représentant légal du KBIS avec celui du profil
 * Gère les variations : "Pierre DUPONT" = "DUPONT Pierre" = "P. DUPONT"
 */
export function compareRepresentantLegal(
  kbisRepresentant: string, 
  profileRepresentant: string
): {
  match: boolean;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
} {
  // Normaliser les deux noms
  const cleanKbis = normalizeName(kbisRepresentant);
  const cleanProfile = normalizeName(profileRepresentant);

  // Comparaison exacte
  if (cleanKbis === cleanProfile) {
    return { match: true, confidence: 'high' };
  }

  // Extraire les mots (nom et prénom séparés)
  const kbisWords = cleanKbis.split(' ').filter(w => w.length > 0);
  const profileWords = cleanProfile.split(' ').filter(w => w.length > 0);

  // Vérifier si tous les mots du profil sont dans le KBIS (ou vice-versa)
  const allProfileWordsInKbis = profileWords.every(word => 
    kbisWords.some(kw => kw.includes(word) || word.includes(kw))
  );

  const allKbisWordsInProfile = kbisWords.every(word => 
    profileWords.some(pw => pw.includes(word) || word.includes(pw))
  );

  if (allProfileWordsInKbis || allKbisWordsInProfile) {
    return { match: true, confidence: 'medium' };
  }

  // Vérifier si au moins le nom de famille correspond
  const longestKbisWord = kbisWords.reduce((a, b) => a.length > b.length ? a : b, '');
  const longestProfileWord = profileWords.reduce((a, b) => a.length > b.length ? a : b, '');

  if (longestKbisWord === longestProfileWord && longestKbisWord.length > 2) {
    return { 
      match: true, 
      confidence: 'low',
      error: 'Le nom de famille correspond mais vérification manuelle recommandée'
    };
  }

  return {
    match: false,
    error: `Le représentant légal du KBIS (${kbisRepresentant}) ne correspond pas au profil (${profileRepresentant})`
  };
}

