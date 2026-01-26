'use client';

/**
 * Page de création de devis - Style Qonto
 * Layout split : formulaire à gauche, prévisualisation à droite
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDemandeById } from '@/lib/firebase/demande-service';
import { getUserById } from '@/lib/firebase/user-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { createDevis, updateDevis, genererProchainNumeroDevis } from '@/lib/firebase/devis-service';
import { Logo } from '@/components/ui';
import type { Demande } from '@/types/firestore';
import type { Devis, LigneDevis, TVARate, calculerLigne, calculerTotaux } from '@/types/devis';
import { Timestamp, query, collection, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Fonction de validation anti-contournement
 * Détecte les numéros de téléphone et adresses dans le texte
 * Inspiré de BlaBlaCar pour garantir les transactions sur la plateforme
 */
function detecterInformationsInterdites(texte: string): { valide: boolean; raison?: string } {
  if (!texte) return { valide: true };

  const texteLower = texte.toLowerCase();
  
  // Détection numéros de téléphone en chiffres purs
  const patternsNumeros = [
    /0[1-9](?:[\s.-]?\d{2}){4}/g,           // 06 12 34 56 78, 06.12.34.56.78
    /\+33[1-9](?:[\s.-]?\d{2}){4}/g,        // +33 6 12 34 56 78
    /(?:^|\s)0[1-9]\d{8}(?:$|\s)/g,         // 0612345678
    /(?:^|\s)\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}(?:$|\s)/g, // XX XX XX XX XX
    /\b\d{8,10}\b/g,                        // N'importe quelle séquence de 8-10 chiffres consécutifs
  ];
  
  for (const pattern of patternsNumeros) {
    if (pattern.test(texte)) {
      return { 
        valide: false, 
        raison: '⛔ Numéros de téléphone interdits. Utilisez la messagerie de la plateforme pour communiquer.' 
      };
    }
  }
  
  // Map de conversion mots → chiffres pour détection mixte
  const motsVersChiffres: { [key: string]: string } = {
    'zero': '0', 'zéro': '0', 'o': '0', 'oh': '0',
    'un': '1', 'une': '1', 'i': '1', 'l': '1',
    'deux': '2', 'de': '2',
    'trois': '3',
    'quatre': '4',
    'cinq': '5',
    'six': '6', 'cis': '6', 'sis': '6',
    'sept': '7', 'sette': '7', 'set': '7',
    'huit': '8', 'wi': '8',
    'neuf': '9', 'noeuf': '9',
    'dix': '10',
    'onze': '11',
    'douze': '12',
    'treize': '13',
    'quatorze': '14',
    'quinze': '15',
    'seize': '16',
    'vingt': '20',
    'trente': '30',
    'quarante': '40',
    'cinquante': '50',
    'soixante': '60',
    'soixante-dix': '70',
    'quatre-vingt': '80',
    'quatre-vingts': '80',
    'quatre-vingt-dix': '90'
  };
  
  // Normaliser le texte pour détecter les combinaisons mixtes
  // Remplacer les mots par des chiffres et vérifier si on obtient un numéro
  let texteNormalise = ' ' + texteLower + ' ';
  
  // Remplacer les mots numériques par leurs chiffres
  for (const [mot, chiffre] of Object.entries(motsVersChiffres)) {
    const regex = new RegExp(`\\b${mot}\\b`, 'gi');
    texteNormalise = texteNormalise.replace(regex, chiffre);
  }
  
  // Après normalisation, vérifier si on a des patterns de téléphone
  const patternsApresNormalisation = [
    /\b0[\s.-]?[1-9](?:[\s.-]?\d{1,2}){4,9}\b/g,  // 0 6 12 34 56 78 ou variations
    /\b[0-9]{10}\b/g,                              // 10 chiffres consécutifs
    /\b[0-9]{1,2}[\s.-][0-9]{1,2}[\s.-][0-9]{1,2}[\s.-][0-9]{1,2}[\s.-][0-9]{1,2}\b/g, // XX XX XX XX XX
  ];
  
  for (const pattern of patternsApresNormalisation) {
    if (pattern.test(texteNormalise)) {
      return { 
        valide: false, 
        raison: '⛔ Numéros de téléphone (même partiellement écrits en lettres) interdits. Utilisez la messagerie de la plateforme.' 
      };
    }
  }
  
  // Détection numéros en toutes lettres (séquence longue)
  const motsNumeros = ['zero', 'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
  const sequenceNumeros = motsNumeros.filter(mot => texteLower.includes(mot));
  if (sequenceNumeros.length >= 4) { // Augmenté de 3 à 4 pour plus de précision
    return { 
      valide: false, 
      raison: '⛔ Écriture de numéros en toutes lettres interdite. Utilisez la messagerie intégrée.' 
    };
  }
  
  // Détection emails
  const patternEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  if (patternEmail.test(texte)) {
    return { 
      valide: false, 
      raison: '⛔ Adresses email interdites. Utilisez la messagerie de la plateforme.' 
    };
  }
  
  // Détection adresses postales complètes (rue + code postal + ville)
  const patternRue = /(\d+\s+(rue|avenue|boulevard|av|bd|impasse|allée|chemin|place)\s+[a-z\s-]+)/gi;
  const patternCodePostal = /\b\d{5}\b/g;
  const motsCles = ['rue', 'avenue', 'boulevard', 'impasse', 'allée', 'chemin', 'place'];
  
  const aRue = motsCles.some(mot => texteLower.includes(mot)) || patternRue.test(texte);
  const aCodePostal = patternCodePostal.test(texte);
  
  if (aRue && aCodePostal) {
    return { 
      valide: false, 
      raison: '⛔ Adresses complètes interdites.' 
    };
  }
  
  return { valide: true };
}

export default function NouveauDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demandeId = searchParams?.get('demandeId');
  const devisBrouillonId = searchParams?.get('devisId'); // ID du brouillon à modifier
  const revisionDevisId = searchParams?.get('revisionDevisId'); // ID du devis à réviser
  const { user, loading: authLoading } = useAuth();

  // États
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [ancienDevisId, setAncienDevisId] = useState<string | null>(null);
  const [modeEdition, setModeEdition] = useState(false); // true si modification d'un brouillon
  const [estPremierDevis, setEstPremierDevis] = useState(true); // true si aucun devis existant pour cette demande

  // Formulaire
  const [titre, setTitre] = useState('');
  const [matierePremiere, setMatierePremiere] = useState('');
  const [mainOeuvre, setMainOeuvre] = useState('');
  const [description, setDescription] = useState('');
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [delaiRealisation, setDelaiRealisation] = useState('');
  const [dateDebutPrevue, setDateDebutPrevue] = useState('');
  const [dateValidite, setDateValidite] = useState(30); // Jours
  const [conditions, setConditions] = useState('');
  
  // Devis alternatifs (variantes)
  const [creerVariante, setCreerVariante] = useState(false);
  const [varianteLabel, setVarianteLabel] = useState('');
  const [variantesExistantes, setVariantesExistantes] = useState<Devis[]>([]);

  // Informations client/artisan (pré-remplies)
  const [clientInfo, setClientInfo] = useState<Devis['client'] | null>(null);
  const [artisanInfo, setArtisanInfo] = useState<Devis['artisan'] | null>(null);
  
  // Numéro de devis temporaire pour prévisualisation
  const [numeroDevisPreview, setNumeroDevisPreview] = useState(`DV-${new Date().getFullYear()}-XXXX`);
  
  // Date de création du devis (fixée à la première création, ne change pas)
  const [dateCreation, setDateCreation] = useState<Date>(new Date());

  /**
   * Charger les données de la demande et profils (ou d'un brouillon existant)
   */
  useEffect(() => {
    async function loadData() {
      // Cas 1 : Modification d'un brouillon existant
      if (devisBrouillonId && user) {
        console.log('📝 Mode ÉDITION - Chargement brouillon:', devisBrouillonId);
        await chargerBrouillon(devisBrouillonId);
        return;
      }

      // Cas 2 : Création d'une révision
      if (revisionDevisId && user) {
        console.log('🔄 Mode RÉVISION - Chargement devis original:', revisionDevisId);
        setEstRevision(true);
        await chargerDevisPourRevision(revisionDevisId);
        return;
      }

      // Cas 3 : Création d'un nouveau devis depuis une demande
      if (!demandeId || !user) {
        console.log('❌ Pas de demandeId ou user:', { demandeId, user: user?.uid });
        return;
      }

      console.log('🔍 Chargement devis pour demande:', demandeId);

      try {
        // Charger la demande
        console.log('📋 Chargement demande...');
        const demandeData = await getDemandeById(demandeId);
        console.log('✅ Demande chargée:', demandeData);
        
        if (!demandeData) {
          alert('Demande introuvable');
          router.push('/artisan/demandes');
          return;
        }
        setDemande(demandeData);

        // Vérifier s'il y a un ancien devis en révision pour cette demande
        try {
          const q = query(
            collection(db, 'devis'),
            where('demandeId', '==', demandeId),
            where('artisanId', '==', user.uid),
            where('statut', '==', 'refuse')
          );
          const devisSnapshot = await getDocs(q);
          
          // Trouver le dernier devis refusé avec typeRefus='revision'
          const ancienDevis = devisSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Devis))
            .filter(d => d.typeRefus === 'revision')
            .sort((a, b) => {
              const dateA = a.dateCreation?.toMillis() || 0;
              const dateB = b.dateCreation?.toMillis() || 0;
              return dateB - dateA;
            })[0];
          
          if (ancienDevis) {
            setAncienDevisId(ancienDevis.id);
            console.log('🔄 Détection ancien devis en révision:', ancienDevis.numeroDevis);
          }
        } catch (error) {
          console.error('⚠️ Erreur détection ancien devis:', error);
        }

        // Charger les informations client
        console.log('👤 Chargement client:', demandeData.clientId);
        
        try {
          const client = await getUserById(demandeData.clientId);
          console.log('✅ Client chargé:', client);
          
          if (client) {
            const clientData: any = {
              nom: client.nom || '',
              prenom: client.prenom || '',
              email: client.email || '',
              telephone: client.telephone || '',
            };
            if (client.adresse?.rue && client.adresse?.ville && client.adresse?.codePostal) {
              clientData.adresse = {
                rue: client.adresse.rue,
                ville: client.adresse.ville,
                codePostal: client.adresse.codePostal,
              };
            }
            setClientInfo(clientData);
          } else {
            console.warn('⚠️ Client introuvable, utilisation données demande');
            // Fallback : utiliser les données de la demande
            const fallbackData: any = {
              nom: demandeData.clientNom || '',
              prenom: demandeData.clientPrenom || '',
              email: demandeData.clientEmail || '',
              telephone: demandeData.clientTelephone || '',
            };
            // N'ajouter adresse que si elle existe
            if (demandeData.adresse?.rue && demandeData.adresse?.ville && demandeData.adresse?.codePostal) {
              fallbackData.adresse = {
                rue: demandeData.adresse.rue,
                ville: demandeData.adresse.ville,
                codePostal: demandeData.adresse.codePostal,
              };
            }
            setClientInfo(fallbackData);
          }
        } catch (clientError) {
          console.error('❌ Erreur chargement client:', clientError);
          console.warn('⚠️ Utilisation données demande comme fallback');
          // Fallback : utiliser les données de la demande
          const fallbackData: any = {
            nom: demandeData.clientNom || 'Client',
            prenom: demandeData.clientPrenom || '',
            email: demandeData.clientEmail || '',
            telephone: demandeData.clientTelephone || '',
          };
          // N'ajouter adresse que si elle existe
          if (demandeData.adresse?.rue && demandeData.adresse?.ville && demandeData.adresse?.codePostal) {
            fallbackData.adresse = {
              rue: demandeData.adresse.rue,
              ville: demandeData.adresse.ville,
              codePostal: demandeData.adresse.codePostal,
            };
          }
          setClientInfo(fallbackData);
        }

        // Charger les informations artisan
        console.log('🔧 Chargement artisan:', user.uid);
        const artisan = await getArtisanByUserId(user.uid);
        console.log('✅ Artisan chargé:', artisan);
        
        if (!artisan) {
          console.error('❌ Profil artisan introuvable pour:', user.uid);
          alert('Votre profil artisan n\'a pas été trouvé. Veuillez compléter votre inscription.');
          router.push('/artisan/profil');
          return;
        }
        
        if (artisan) {
          const artisanData: any = {
            raisonSociale: artisan.raisonSociale || '',
            siret: artisan.siret || '',
            nom: artisan.nom,
            prenom: artisan.prenom,
            email: artisan.email || user.email || '',
            telephone: artisan.telephone || '',
          };
          if (artisan.adresse) {
            artisanData.adresse = {
              rue: artisan.adresse,
              ville: '', // TODO: Adapter selon votre structure
              codePostal: '',
            };
          }
          setArtisanInfo(artisanData);
        }

        // Pré-remplir le titre avec la description de la demande
        setTitre(`Devis - ${demandeData.titre || 'Travaux'}`);
        setDescription(demandeData.description || '');
        
        // Pré-remplir la date de début avec la première date souhaitée du client
        if (demandeData.datesSouhaitees?.dates?.[0]) {
          const dateClient = demandeData.datesSouhaitees.dates[0].toDate();
          setDateDebutPrevue(dateClient.toISOString().split('T')[0]);
        }

        // Charger le prochain numéro de devis pour la prévisualisation
        try {
          const prochainNumero = await genererProchainNumeroDevis(user.uid);
          setNumeroDevisPreview(prochainNumero);
        } catch (error) {
          console.error('Erreur génération numéro devis:', error);
          // Garder le placeholder par défaut si erreur
        }

        // Ajouter une première ligne vide
        ajouterLigne();
        
        // Charger les variantes existantes pour cette demande
        await chargerVariantesExistantes(demandeId, user.uid);

        // Si c'est une révision, charger le devis original et auto-activer la variante
        if (revisionDevisId) {
          console.log('🔄 Mode révision détecté, devis original:', revisionDevisId);
          await chargerDevisOriginalPourRevision(revisionDevisId);
        }

        console.log('✅ Toutes les données chargées avec succès');

      } catch (error) {
        console.error('❌ ERREUR chargement données:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'Pas de stack');
        alert('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [demandeId, devisBrouillonId, user, router]);

  /**
   * Charger les devis existants pour cette demande
   * MODÈLE ARTISANSAFE : 1 demande = 1 artisan spécifique
   * Si un devis existe déjà, forcer le mode variante
   */
  const chargerVariantesExistantes = async (demandeId: string, artisanId: string) => {
    try {
      const q = query(
        collection(db, 'devis'),
        where('demandeId', '==', demandeId),
        where('artisanId', '==', artisanId)
      );
      
      const snapshot = await getDocs(q);
      const devisTous = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Devis));
      
      // Filtrer pour exclure les devis annulés/remplacés
      const devisActifs = devisTous.filter(d => 
        d.statut !== 'annule' && d.statut !== 'remplace'
      );
      
      // Déterminer si c'est le premier devis
      setEstPremierDevis(devisActifs.length === 0);
      
      if (devisActifs.length > 0) {
        // Il existe déjà des devis pour cette demande
        console.log(`📊 ${devisActifs.length} devis existant(s) pour cette demande`);
        
        // Ne garder que ceux qui ont un groupe de variantes
        const variantes = devisActifs.filter(d => d.varianteGroupe);
        setVariantesExistantes(variantes.length > 0 ? variantes : devisActifs);
        
        // AUTO-ACTIVER le mode variante car un devis existe déjà
        if (!creerVariante) {
          setCreerVariante(true);
          console.log('✅ Mode variante auto-activé (devis existant détecté)');
        }
      } else {
        setVariantesExistantes([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement devis existants:', error);
    }
  };

  /**
   * Charger le devis original pour créer une révision
   */
  const chargerDevisOriginalPourRevision = async (devisOriginalId: string) => {
    try {
      console.log('🔄 Chargement devis original pour révision:', devisOriginalId);
      
      const devisDoc = await getDoc(doc(db, 'devis', devisOriginalId));
      if (!devisDoc.exists()) {
        console.error('❌ Devis original introuvable');
        return;
      }

      const devisOriginal = { id: devisDoc.id, ...devisDoc.data() } as Devis;
      
      // Auto-activer le mode variante
      setCreerVariante(true);
      setVarianteLabel('Révision suite à refus');
      setAncienDevisId(devisOriginalId);
      
      // Pré-remplir le formulaire avec les données du devis original
      setTitre(devisOriginal.titre || '');
      setMatierePremiere(devisOriginal.matierePremiere || '');
      setMainOeuvre(devisOriginal.mainOeuvre || '');
      setDescription(devisOriginal.description || '');
      setLignes(devisOriginal.lignes || []);
      setDelaiRealisation(devisOriginal.delaiRealisation || '');
      
      if (devisOriginal.dateDebutPrevue) {
        const dateDebut = devisOriginal.dateDebutPrevue.toDate();
        setDateDebutPrevue(dateDebut.toISOString().split('T')[0]);
      }
      
      setConditions(devisOriginal.conditions || '');
      
      console.log('✅ Devis original chargé pour révision, variante auto-activée');
    } catch (error) {
      console.error('❌ Erreur chargement devis original:', error);
    }
  };

  /**
   * Charger un devis brouillon existant pour modification
   */
  const chargerBrouillon = async (devisId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📋 Chargement du brouillon:', devisId);

      // Récupérer le devis
      const devisDoc = await getDoc(doc(db, 'devis', devisId));
      if (!devisDoc.exists()) {
        alert('Devis introuvable');
        router.push('/artisan/devis');
        return;
      }

      const devisBrouillon = { id: devisDoc.id, ...devisDoc.data() } as Devis;
      
      // Vérifier que c'est bien un brouillon de l'artisan
      if (devisBrouillon.artisanId !== user.uid) {
        alert('Vous n\'êtes pas autorisé à modifier ce devis');
        router.push('/artisan/devis');
        return;
      }

      if (devisBrouillon.statut !== 'brouillon') {
        alert('Seuls les devis brouillons peuvent être modifiés');
        router.push('/artisan/devis');
        return;
      }

      console.log('✅ Brouillon chargé:', devisBrouillon);

      // Charger la demande associée si elle existe
      if (devisBrouillon.demandeId) {
        const demandeData = await getDemandeById(devisBrouillon.demandeId);
        if (demandeData) {
          setDemande(demandeData);
        }
      }

      // Remplir le formulaire avec les données du brouillon
      setModeEdition(true);
      setTitre(devisBrouillon.titre || '');
      setMatierePremiere(devisBrouillon.matierePremiere || '');
      setMainOeuvre(devisBrouillon.mainOeuvre || '');
      setDescription(devisBrouillon.description || '');
      setLignes(devisBrouillon.lignes || []);
      setDelaiRealisation(devisBrouillon.delaiRealisation || '');
      
      if (devisBrouillon.dateDebutPrevue) {
        const dateDebut = devisBrouillon.dateDebutPrevue.toDate();
        setDateDebutPrevue(dateDebut.toISOString().split('T')[0]);
      }

      // Calculer dateValidite en jours
      if (devisBrouillon.dateValidite) {
        const maintenant = new Date();
        const dateValiditeDate = devisBrouillon.dateValidite.toDate();
        const joursRestants = Math.ceil((dateValiditeDate.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24));
        setDateValidite(Math.max(1, joursRestants)); // Au moins 1 jour
      }

      setConditions(devisBrouillon.conditions || '');
      setClientInfo(devisBrouillon.client);
      setArtisanInfo(devisBrouillon.artisan);
      setNumeroDevisPreview(devisBrouillon.numeroDevis || `DV-${new Date().getFullYear()}-XXXX`);
      
      // Conserver la date de création originale
      if (devisBrouillon.dateCreation) {
        setDateCreation(devisBrouillon.dateCreation.toDate());
      }

      if (devisBrouillon.devisOriginalId) {
        setAncienDevisId(devisBrouillon.devisOriginalId);
      }

      console.log('✅ Formulaire pré-rempli avec succès');

    } catch (error) {
      console.error('❌ Erreur chargement brouillon:', error);
      alert('Erreur lors du chargement du brouillon');
      router.push('/artisan/devis');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Charger un devis pour créer une révision
   */
  const chargerDevisPourRevision = async (devisId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📋 Chargement du devis original pour révision:', devisId);

      // Récupérer le devis original
      const devisDoc = await getDoc(doc(db, 'devis', devisId));
      if (!devisDoc.exists()) {
        alert('Devis original introuvable');
        router.push('/artisan/devis');
        return;
      }

      const devisOriginal = { id: devisDoc.id, ...devisDoc.data() } as Devis;
      
      // Vérifier que c'est bien un devis de l'artisan
      if (devisOriginal.artisanId !== user.uid) {
        alert('Vous n\'êtes pas autorisé à réviser ce devis');
        router.push('/artisan/devis');
        return;
      }

      console.log('✅ Devis original chargé:', devisOriginal);

      // Charger la demande associée si elle existe
      if (devisOriginal.demandeId) {
        const demandeData = await getDemandeById(devisOriginal.demandeId);
        if (demandeData) {
          setDemande(demandeData);
        }
      }

      // Pré-remplir le formulaire avec les données du devis original
      setTitre(devisOriginal.titre || '');
      setMatierePremiere(devisOriginal.matierePremiere || '');
      setMainOeuvre(devisOriginal.mainOeuvre || '');
      setDescription(devisOriginal.description || '');
      setLignes(devisOriginal.lignes || []);
      setDelaiRealisation(devisOriginal.delaiRealisation || '');
      
      if (devisOriginal.dateDebutPrevue) {
        const dateDebut = devisOriginal.dateDebutPrevue.toDate();
        setDateDebutPrevue(dateDebut.toISOString().split('T')[0]);
      }

      setDateValidite(30); // Réinitialiser à 30 jours
      setConditions(devisOriginal.conditions || '');
      setClientInfo(devisOriginal.client);
      setArtisanInfo(devisOriginal.artisan);

      // Activer automatiquement le mode variante
      setCreerVariante(true);
      setVarianteLabel('Révision suite à refus');
      
      // Stocker l'ID du devis original
      setAncienDevisId(devisOriginal.id);

      // Charger les variantes existantes
      if (devisOriginal.demandeId) {
        await chargerVariantesExistantes(devisOriginal.demandeId, user.uid);
      }

      console.log('✅ Formulaire pré-rempli pour révision avec succès');

    } catch (error) {
      console.error('❌ Erreur chargement devis pour révision:', error);
      alert('Erreur lors du chargement du devis');
      router.push('/artisan/devis');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ajouter une nouvelle ligne de prestation
   */
  const ajouterLigne = () => {
    const nouvelleLigne: LigneDevis = {
      id: `ligne-${Date.now()}-${Math.random()}`,
      description: '',
      quantite: 1,
      unite: 'h',
      prixUnitaireHT: 0,
      tauxTVA: 20,
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
    };
    setLignes([...lignes, nouvelleLigne]);
  };

  /**
   * Supprimer une ligne
   */
  const supprimerLigne = (id: string) => {
    setLignes(lignes.filter(l => l.id !== id));
  };

  /**
   * Mettre à jour une ligne et recalculer les totaux
   */
  const mettreAJourLigne = (id: string, updates: Partial<LigneDevis>) => {
    setLignes(lignes.map(ligne => {
      if (ligne.id !== id) return ligne;
      
      const ligneUpdate = { ...ligne, ...updates };
      
      // Recalculer les totaux de la ligne
      const totalHT = ligneUpdate.quantite * ligneUpdate.prixUnitaireHT;
      const totalTVA = totalHT * (ligneUpdate.tauxTVA / 100);
      const totalTTC = totalHT + totalTVA;
      
      return {
        ...ligneUpdate,
        totalHT: Math.round(totalHT * 100) / 100,
        totalTVA: Math.round(totalTVA * 100) / 100,
        totalTTC: Math.round(totalTTC * 100) / 100,
      };
    }));
  };

  /**
   * Calculer les totaux globaux
   */
  const calculerTotauxGlobaux = () => {
    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.totalHT, 0);
    
    const totalTVA: { [key in TVARate]?: number } = {};
    lignes.forEach(ligne => {
      totalTVA[ligne.tauxTVA] = (totalTVA[ligne.tauxTVA] || 0) + ligne.totalTVA;
    });
    
    const totalTVAGlobal = Object.values(totalTVA).reduce((sum, val) => sum + (val || 0), 0);
    const totalTTC = totalHT + totalTVAGlobal;
    
    return {
      totalHT: Math.round(totalHT * 100) / 100,
      totalTVA,
      totalTVAGlobal: Math.round(totalTVAGlobal * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
    };
  };

  /**
   * Nettoyer un objet pour supprimer toutes les valeurs undefined
   */
  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          const cleanedNested = cleanObject(obj[key]);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = obj[key];
        }
      }
    }
    return cleaned;
  };

  /**
   * Sauvegarder le devis en brouillon
   */
  const sauvegarderBrouillon = async () => {
    if (!user || !clientInfo || !artisanInfo) return;

    // Vérification : au moins une demande OU mode édition
    if (!modeEdition && (!demande || !demandeId)) {
      alert('Impossible de sauvegarder : aucune demande associée');
      return;
    }

    setSaving(true);
    try {
      const devisData: any = {
        ...(demandeId && { demandeId: demandeId }),
        ...(demande && { clientId: demande.clientId }),
        artisanId: user.uid,
        statut: 'brouillon',
        ...(ancienDevisId && { devisOriginalId: ancienDevisId }),
        client: cleanObject(clientInfo),
        artisan: cleanObject(artisanInfo),
        titre,
        matierePremiere,
        mainOeuvre,
        description,
        lignes,
        totaux: calculerTotauxGlobaux(),
        delaiRealisation,
        ...(dateDebutPrevue && { dateDebutPrevue: Timestamp.fromDate(new Date(dateDebutPrevue)) }),
        dateValidite: Timestamp.fromDate(
          new Date(Date.now() + dateValidite * 24 * 60 * 60 * 1000)
        ),
        conditions,
      };

      if (modeEdition && devisBrouillonId) {
        // Mise à jour du brouillon existant
        console.log('📝 Mise à jour du brouillon:', devisBrouillonId);
        await updateDevis(devisBrouillonId, devisData);
        alert('✅ Brouillon mis à jour avec succès');
      } else {
        // Création d'un nouveau brouillon
        console.log('➕ Création nouveau brouillon');
        await createDevis(devisData);
        alert('✅ Devis sauvegardé en brouillon');
      }
      
      router.push('/artisan/devis');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Envoyer le devis au client
   */
  const envoyerDevis = async () => {
    if (!user || !clientInfo || !artisanInfo) return;
    
    // Vérification : au moins une demande OU mode édition
    if (!modeEdition && (!demande || !demandeId)) {
      alert('Impossible d\'envoyer : aucune demande associée');
      return;
    }
    
    // Validation
    if (!titre.trim()) {
      alert('Veuillez saisir un titre');
      return;
    }
    if (!mainOeuvre.trim()) {
      alert('Veuillez renseigner la main d\'\u0153uvre (champ obligatoire)');
      return;
    }
    if (!dateDebutPrevue) {
      alert('Veuillez indiquer la date de début prévue des travaux');
      return;
    }
    
    // Vérifier que la date de début est dans les préférences du client (si demande existe)
    if (demande?.datesSouhaitees?.dates?.[0]) {
      const dateProposee = new Date(dateDebutPrevue);
      const dateClient = demande.datesSouhaitees.dates[0].toDate();
      const flexDays = demande.datesSouhaitees.flexibiliteDays || 0;
      
      const dateMin = new Date(dateClient);
      dateMin.setDate(dateMin.getDate() - flexDays);
      const dateMax = new Date(dateClient);
      dateMax.setDate(dateMax.getDate() + flexDays);
      
      if (dateProposee < dateMin || dateProposee > dateMax) {
        const confirmEnvoi = confirm(
          `⚠️ ATTENTION : La date de début prévue (${dateProposee.toLocaleDateString('fr-FR')}) est en dehors des préférences du client.\n\n` +
          `Le client souhaite : ${dateClient.toLocaleDateString('fr-FR')} (±${flexDays} jours)\n` +
          `Plage acceptée : du ${dateMin.toLocaleDateString('fr-FR')} au ${dateMax.toLocaleDateString('fr-FR')}\n\n` +
          `⚠️ Le client pourrait refuser ce devis.\n\n` +
          `Voulez-vous vraiment envoyer ce devis avec une date hors préférences ?`
        );
        
        if (!confirmEnvoi) {
          return; // Annuler l'envoi
        }
      }
    }
    
    if (lignes.length === 0) {
      alert('Veuillez ajouter au moins une prestation');
      return;
    }
    if (lignes.some(l => !l.description.trim() || l.prixUnitaireHT <= 0)) {
      alert('Toutes les lignes doivent avoir une description et un prix');
      return;
    }

    // VALIDATION ANTI-CONTOURNEMENT : Vérifier tous les champs de texte
    const champsAVerifier = [
      { nom: 'titre', valeur: titre },
      { nom: 'matière première', valeur: matierePremiere },
      { nom: 'main d\'\u0153uvre', valeur: mainOeuvre },
      { nom: 'description', valeur: description },
      { nom: 'délai de réalisation', valeur: delaiRealisation },
      { nom: 'conditions', valeur: conditions },
      ...lignes.map((l, i) => ({ nom: `ligne ${i + 1}`, valeur: l.description }))
    ];

    for (const champ of champsAVerifier) {
      const validation = detecterInformationsInterdites(champ.valeur);
      if (!validation.valide) {
        alert(`❌ ${validation.raison}\n\nChamp concerné : ${champ.nom}\n\n💬 Utilisez le bouton "Contacter client" pour échanger via la messagerie sécurisée de la plateforme.`);
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    try {
      const devisData: any = {
        ...(demandeId && { demandeId: demandeId }),
        ...(demande && { clientId: demande.clientId }),
        artisanId: user.uid,
        statut: 'envoye',
        ...(ancienDevisId && { devisOriginalId: ancienDevisId }),
        client: cleanObject(clientInfo),
        artisan: cleanObject(artisanInfo),
        titre,
        matierePremiere,
        mainOeuvre,
        description,
        lignes,
        totaux: calculerTotauxGlobaux(),
        delaiRealisation,
        dateDebutPrevue: Timestamp.fromDate(new Date(dateDebutPrevue)),
        dateValidite: Timestamp.fromDate(
          new Date(Date.now() + dateValidite * 24 * 60 * 60 * 1000)
        ),
        conditions,
      };
      
      // VALIDATION : Si des devis existent déjà, FORCER le mode variante
      if (variantesExistantes.length > 0 && !creerVariante) {
        alert('⚠️ Un devis existe déjà pour cette demande.\nVous devez créer une variante (option alternative).\nCochez "Créer une variante" et donnez un nom à votre option.');
        setSaving(false);
        return;
      }
      
      // Ajouter les champs de variante si créer variante est activé
      if (creerVariante && varianteLabel.trim()) {
        // Générer un ID de groupe unique si c'est la première variante
        const varianteGroupe = variantesExistantes.length > 0 && variantesExistantes[0].varianteGroupe
          ? variantesExistantes[0].varianteGroupe
          : `VG-${Date.now()}`;
        
        // Déterminer la prochaine lettre de référence
        const lettresUtilisees = variantesExistantes
          .map(v => v.varianteLettreReference || '')
          .filter(Boolean);
        
        const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let prochaineLettreReference = 'A';
        for (let i = 0; i < lettres.length; i++) {
          if (!lettresUtilisees.includes(lettres[i])) {
            prochaineLettreReference = lettres[i];
            break;
          }
        }
        
        devisData.varianteGroupe = varianteGroupe;
        devisData.varianteLabel = varianteLabel.trim();
        devisData.varianteLettreReference = prochaineLettreReference;
        console.log('📋 Création variante:', { varianteGroupe, lettre: prochaineLettreReference });
      }
      
      // Si c'est le tout premier devis et que "créer variante" est coché, créer le groupe
      if (creerVariante && varianteLabel.trim() && variantesExistantes.length === 0) {
        console.log('📋 Premier devis avec variante activée - création groupe');
      }

      if (modeEdition && devisBrouillonId) {
        // Mise à jour + envoi du brouillon existant
        console.log('📝 Mise à jour et envoi du brouillon:', devisBrouillonId);
        await updateDevis(devisBrouillonId, devisData);
        alert('✅ Devis envoyé au client !');
      } else {
        // Création + envoi d'un nouveau devis
        console.log('➕ Création et envoi nouveau devis');
        await createDevis(devisData);
        alert('✅ Devis envoyé au client !');
      }
      
      router.push('/artisan/devis');
    } catch (error) {
      console.error('Erreur envoi:', error);
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'envoi du devis";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto"></div>
          <p className="mt-4 text-[#6C757D]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || (!demande && !modeEdition)) {
    return null;
  }

  const totaux = calculerTotauxGlobaux();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* PARTIE GAUCHE : FORMULAIRE */}
      <div className="w-1/2 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-[#FF6B00] hover:underline mb-4"
            >
              ← Retour {modeEdition ? 'aux devis' : 'aux demandes'}
            </button>
            <h1 className="text-3xl font-bold text-[#2C3E50]">
              {modeEdition ? '📝 Modifier le brouillon' : 'Créer un devis'}
            </h1>
            <p className="text-[#6C757D] mt-2">
              {modeEdition ? (
                <span>
                  Modification en cours • Client : {clientInfo?.prenom} {clientInfo?.nom}
                </span>
              ) : (
                <span>
                  Demande de {clientInfo?.prenom} {clientInfo?.nom}
                </span>
              )}
            </p>
          </div>

          {/* Informations générales */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-4">Informations générales</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Titre du devis *
                </label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Ex: Rénovation salle de bain"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Matière première (optionnel)
                </label>
                <input
                  type="text"
                  value={matierePremiere}
                  onChange={(e) => setMatierePremiere(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Ex: Carrelage, Peinture, Parquet..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Main d'œuvre *
                </label>
                <input
                  type="text"
                  value={mainOeuvre}
                  onChange={(e) => setMainOeuvre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Ex: 1 artisan, 2 ouvriers..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                  placeholder="Description détaillée des travaux..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                    Délai de réalisation
                  </label>
                  <input
                    type="text"
                    value={delaiRealisation}
                    onChange={(e) => setDelaiRealisation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    placeholder="Ex: 2 semaines"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                    Date de début prévue *
                  </label>
                  {demande.datesSouhaitees?.dates && demande.datesSouhaitees.dates.length > 0 && (
                    <p className="text-xs text-[#6C757D] mb-1">
                      📅 Client souhaite : {demande.datesSouhaitees.dates[0].toDate().toLocaleDateString('fr-FR')}
                      {demande.datesSouhaitees.flexible && demande.datesSouhaitees.flexibiliteDays && (
                        <span> (±{demande.datesSouhaitees.flexibiliteDays} jours)</span>
                      )}
                    </p>
                  )}
                  <input
                    type="date"
                    value={dateDebutPrevue}
                    onChange={(e) => setDateDebutPrevue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    required
                  />
                  {(() => {
                    if (!dateDebutPrevue || !demande.datesSouhaitees?.dates?.[0]) return null;
                    
                    const dateProposee = new Date(dateDebutPrevue);
                    const dateClient = demande.datesSouhaitees.dates[0].toDate();
                    const flexDays = demande.datesSouhaitees.flexibiliteDays || 0;
                    
                    const dateMin = new Date(dateClient);
                    dateMin.setDate(dateMin.getDate() - flexDays);
                    const dateMax = new Date(dateClient);
                    dateMax.setDate(dateMax.getDate() + flexDays);
                    
                    if (dateProposee < dateMin || dateProposee > dateMax) {
                      return (
                        <p className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
                          ⚠️ Cette date est en dehors des préférences du client. Le client pourrait refuser le devis.
                        </p>
                      );
                    }
                    return (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ Correspond aux préférences du client
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                    Validité (jours)
                  </label>
                  <input
                    type="number"
                    value={dateValidite}
                    onChange={(e) => setDateValidite(parseInt(e.target.value) || 30)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Devis Alternatifs (Variantes) */}
          {(!estPremierDevis || revisionDevisId) && (variantesExistantes.length > 0 || demandeId) ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm mb-6">
              {revisionDevisId ? (
                // Mode révision : affichage spécial automatique
                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4 rounded">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold text-indigo-800 mb-1">
                        🔄 Révision automatique du devis
                      </p>
                      <p className="text-sm text-indigo-700 mb-3">
                        Ce devis est une révision suite au refus du client. Il sera automatiquement lié au devis original comme variante alternative.
                      </p>
                      <div className="bg-white rounded-lg p-3 border border-indigo-200">
                        <label className="block text-sm font-medium text-indigo-900 mb-1">
                          Nom de la variante
                        </label>
                        <input
                          type="text"
                          value={varianteLabel}
                          onChange={(e) => setVarianteLabel(e.target.value)}
                          className="w-full px-4 py-2 border border-indigo-300 rounded-lg bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="Ex: Révision suite à refus"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Mode normal (devis existants, pas de révision)
                <>
                  {variantesExistantes.length > 0 && (
                    <div className="bg-orange-50 border-l-4 border-[#FF6B00] p-4 mb-4 rounded">
                      <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-[#FF6B00] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold text-[#FF6B00] mb-1">
                            ⚠️ Un devis existe déjà pour cette demande
                          </p>
                          <p className="text-sm text-[#2C3E50]">
                            Vous devez créer une <strong>variante</strong> (option alternative) car cette demande vous a été envoyée spécifiquement. 
                            Cochez "Créer une variante" ci-dessous pour proposer une nouvelle option au client.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-[#2C3E50] mb-1">
                    Proposer plusieurs options au client
                  </h2>
                  <p className="text-sm text-[#6C757D]">
                    Créez des devis alternatifs (Économique, Standard, Premium) pour la même demande. Le client pourra comparer et choisir.
                  </p>
                </div>
              </div>

                  {variantesExistantes.length > 0 && (
                <div className="bg-white rounded-lg p-4 mb-4 border border-blue-200">
                  <h3 className="font-medium text-[#2C3E50] mb-2">
                    📊 Variantes existantes ({variantesExistantes.length})
                  </h3>
                  <div className="space-y-2">
                    {variantesExistantes.map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-sm bg-blue-50 px-3 py-2 rounded">
                        <span>
                          <span className="font-mono font-semibold text-blue-700">{v.numeroDevis}</span>
                          {' - '}
                          <span className="font-medium">{v.varianteLabel}</span>
                        </span>
                        <span className="text-[#6C757D]">
                          {v.totaux?.totalTTC ? `${v.totaux.totalTTC.toFixed(2)} €` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                  {!revisionDevisId && (
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="creerVariante"
                    checked={creerVariante}
                    onChange={(e) => setCreerVariante(e.target.checked)}
                    className="w-5 h-5 text-[#FF6B00] rounded focus:ring-[#FF6B00]"
                  />
                  <label htmlFor="creerVariante" className="font-medium text-[#2C3E50] cursor-pointer">
                    ✨ Créer une variante alternative pour ce devis
                  </label>
                </div>
              )}

              {creerVariante && (
                <div className="ml-8 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#2C3E50] mb-1">
                      Nom de l'option *
                    </label>
                    <input
                      type="text"
                      value={varianteLabel}
                      onChange={(e) => setVarianteLabel(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                      placeholder="Ex: Option Économique, Option Premium, Solution Standard..."
                    />
                    <p className="text-xs text-[#6C757D] mt-1">
                      💡 Ce nom apparaîtra sur le devis et aidera le client à identifier les différentes options
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                    <p className="font-medium text-yellow-800 mb-1">ℹ️ Comment ça fonctionne :</p>
                    <ul className="text-yellow-700 space-y-1 ml-4 list-disc">
                      <li>Chaque variante aura un numéro unique (DV-2026-00042-A, -B, -C...)</li>
                      <li>Le client pourra comparer toutes les options avant de choisir</li>
                      <li>Si le client accepte une variante, les autres seront automatiquement annulées</li>
                    </ul>
                  </div>
                </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          {/* Prestations */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#2C3E50]">Prestations</h2>
              <button
                onClick={ajouterLigne}
                className="bg-[#FF6B00] text-white px-4 py-2 rounded-lg hover:bg-[#E56100] transition"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="space-y-4">
              {lignes.map((ligne, index) => (
                <div key={ligne.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-[#6C757D]">Ligne {index + 1}</span>
                    <button
                      onClick={() => supprimerLigne(ligne.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={ligne.description}
                      onChange={(e) => mettreAJourLigne(ligne.id, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                      placeholder="Description de la prestation"
                    />

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Quantité</label>
                        <input
                          type="number"
                          value={ligne.quantite}
                          onChange={(e) => mettreAJourLigne(ligne.id, { quantite: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Unité</label>
                        <select
                          value={ligne.unite}
                          onChange={(e) => mettreAJourLigne(ligne.id, { unite: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                        >
                          <option value="h">h</option>
                          <option value="j">j</option>
                          <option value="m²">m²</option>
                          <option value="ml">ml</option>
                          <option value="unité">unité</option>
                          <option value="forfait">forfait</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">Prix HT (€)</label>
                        <input
                          type="number"
                          value={ligne.prixUnitaireHT}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            mettreAJourLigne(ligne.id, { prixUnitaireHT: isNaN(value) ? 0 : value });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#6C757D] mb-1">TVA (%)</label>
                        <select
                          value={ligne.tauxTVA}
                          onChange={(e) => mettreAJourLigne(ligne.id, { tauxTVA: parseFloat(e.target.value) as TVARate })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                        >
                          <option value="0">0%</option>
                          <option value="5.5">5.5%</option>
                          <option value="10">10%</option>
                          <option value="20">20%</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end text-sm">
                      <span className="text-[#6C757D]">Total ligne : </span>
                      <span className="font-semibold text-[#2C3E50] ml-2">
                        {ligne.totalTTC.toFixed(2)} € TTC
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {lignes.length === 0 && (
                <div className="text-center py-8 text-[#6C757D]">
                  Aucune prestation ajoutée. Cliquez sur "Ajouter une ligne" pour commencer.
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-4">Conditions particulières</h2>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              placeholder="Conditions de paiement, garanties, etc..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={sauvegarderBrouillon}
              disabled={saving}
              className="flex-1 bg-gray-200 text-[#2C3E50] px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
            >
              {saving ? '⏳ Génération...' : '📄 Générer le devis'}
            </button>
            <button
              onClick={envoyerDevis}
              disabled={saving}
              className="flex-1 bg-[#FF6B00] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E56100] transition disabled:opacity-50"
            >
              {saving ? '⏳ Envoi...' : '📨 Envoyer le devis'}
            </button>
          </div>
        </div>
      </div>

      {/* PARTIE DROITE : PRÉVISUALISATION */}
      <div className="w-1/2 bg-white border-l border-gray-200 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          {/* En-tête devis */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-8">
              {/* Logo à gauche */}
              <div className="flex-shrink-0">
                <Logo size="sm" variant="full" />
              </div>

              {/* Titre DEVIS au centre */}
              <div className="flex-1 text-center">
                <h1 className="text-4xl font-bold text-[#2C3E50] mb-2">DEVIS</h1>
                <p className="text-[#6C757D]">N° {numeroDevisPreview}</p>
              </div>

              {/* Dates à droite */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-[#6C757D]">Date</p>
                <p className="font-semibold">{dateCreation.toLocaleDateString('fr-FR')}</p>
                <p className="text-sm text-[#6C757D] mt-2">Validité</p>
                <p className="font-semibold">{dateValidite} jours</p>
              </div>
            </div>

            {/* Informations artisan et client */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">DE :</h3>
                <div className="text-sm">
                  <p className="font-semibold">{artisanInfo?.raisonSociale}</p>
                  <p className="text-[#6C757D]">SIRET : {artisanInfo?.siret}</p>
                  <p className="text-[#6C757D]">{artisanInfo?.email}</p>
                  <p className="text-[#6C757D]">{artisanInfo?.telephone}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">POUR :</h3>
                <div className="text-sm">
                  <p className="font-semibold">{clientInfo?.prenom} {clientInfo?.nom}</p>
                  {clientInfo?.adresse && (
                    <p className="text-[#6C757D] mt-2">
                      {clientInfo.adresse.rue}<br />
                      {clientInfo.adresse.codePostal} {clientInfo.adresse.ville}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Titre et description */}
            {titre && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#2C3E50] mb-2">{titre}</h2>
                {description && <p className="text-[#6C757D]">{description}</p>}
              </div>
            )}

            {dateDebutPrevue && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <p className="text-sm">
                  <span className="font-semibold">📅 Date de début prévue :</span>{' '}
                  {new Date(dateDebutPrevue).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}

            {delaiRealisation && (
              <div className="bg-[#FFF3E0] border-l-4 border-[#FF6B00] p-4 mb-6">
                <p className="text-sm">
                  <span className="font-semibold">Délai de réalisation :</span> {delaiRealisation}
                </p>
              </div>
            )}
          </div>

          {/* Tableau des prestations */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-[#2C3E50] text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Qté</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">P.U. HT</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">TVA</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm">
                      {ligne.description || <span className="text-gray-400 italic">Description...</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {ligne.quantite} {ligne.unite}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {ligne.prixUnitaireHT.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {ligne.tauxTVA}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      {ligne.totalTTC.toFixed(2)} €
                    </td>
                  </tr>
                ))}

                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#6C757D] italic">
                      Aucune prestation ajoutée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="bg-[#F8F9FA] rounded-lg p-6 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6C757D]">Total HT</span>
                <span className="font-semibold">{totaux.totalHT.toFixed(2)} €</span>
              </div>
              {Object.entries(totaux.totalTVA).map(([taux, montant]) => (
                <div key={taux} className="flex justify-between text-sm">
                  <span className="text-[#6C757D]">TVA {taux}%</span>
                  <span className="font-semibold">{montant?.toFixed(2)} €</span>
                </div>
              ))}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-[#2C3E50]">Total TTC</span>
                  <span className="text-2xl font-bold text-[#FF6B00]">{totaux.totalTTC.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {conditions && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-[#2C3E50] mb-2">Conditions particulières</h3>
              <p className="text-sm text-[#6C757D] whitespace-pre-wrap">{conditions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
