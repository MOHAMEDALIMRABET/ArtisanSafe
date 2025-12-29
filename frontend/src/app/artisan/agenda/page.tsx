'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views, SlotInfo, Navigate, ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { disponibiliteService } from '@/lib/firebase/disponibilite-service';
import { getContratsByArtisan } from '@/lib/firebase/contrat-service';
import type { DisponibiliteSlot, Artisan } from '@/types/firestore';
import { Timestamp } from 'firebase/firestore';

// Configuration du localisateur français
const locales = {
  'fr': fr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Types pour les créneaux de disponibilité (pour le calendrier)
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  disponible: boolean;
  recurrence?: 'hebdomadaire' | 'ponctuel';
  allDay?: boolean; // Journée complète ou plage horaire
}

export default function AgendaPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [artisanId, setArtisanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [calendarMode, setCalendarMode] = useState<'start' | 'end'>('start');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.MONTH);
  
  // État pour le modal d'édition d'événement
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  
  // État pour la recherche par plage de dates dans l'agenda
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  // Effet pour appliquer automatiquement le filtrage par dates
  useEffect(() => {
    if (searchStartDate && searchEndDate && currentView === Views.AGENDA) {
      setCurrentDate(new Date(searchStartDate));
    }
  }, [searchStartDate, searchEndDate, currentView]);

  const checkAuth = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      router.push('/connexion');
      return;
    }
    
    // TODO: Charger les disponibilités depuis Firestore
    loadDisponibilites();
  };

  const loadDisponibilites = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        console.log('Aucun utilisateur connecté');
        return;
      }

      console.log('Chargement du profil artisan pour userId:', currentUser.uid);

      // Charger les données artisan
      const artisanData = await getArtisanByUserId(currentUser.uid);
      
      console.log('Données artisan récupérées:', artisanData);

      if (!artisanData) {
        console.error('Artisan non trouvé dans Firestore - Le profil n\'existe pas encore');
        alert('Vous devez d\'abord compléter votre profil artisan avant d\'accéder à l\'agenda.');
        router.push('/artisan/profil');
        setLoading(false);
        return;
      }

      if (!artisanData.id) {
        console.error('L\'objet artisan n\'a pas d\'ID:', artisanData);
        setLoading(false);
        return;
      }

      setArtisanId(artisanData.id);

      // Charger les disponibilités depuis Firestore (journées complètes uniquement)
      const disponibilites = await disponibiliteService.getDisponibilites(artisanData.id);
      
      // Charger les contrats signés de l'artisan
      const contrats = await getContratsByArtisan(artisanData.id);
      
      // Convertir DisponibiliteSlot[] en CalendarEvent[] (journées complètes)
      const calendarEvents: CalendarEvent[] = disponibilites.map(dispo => {
        let start: Date;
        let end: Date;

        if (dispo.recurrence === 'ponctuel' && dispo.date) {
          // Créneau ponctuel - journée complète
          const dateBase = dispo.date.toDate();
          
          start = new Date(dateBase);
          start.setHours(0, 0, 0, 0);
          
          end = new Date(dateBase);
          end.setHours(23, 59, 59, 999);
        } else {
          // Créneau hebdomadaire - journée complète
          const today = new Date();
          
          start = new Date(today);
          start.setHours(0, 0, 0, 0);
          
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
        }

        return {
          id: dispo.id || String(Date.now()),
          title: dispo.titre || (dispo.disponible ? 'Disponible' : 'Occupé'),
          start,
          end,
          disponible: dispo.disponible,
          recurrence: dispo.recurrence,
          allDay: true
        };
      });
      
      // Ajouter les contrats signés comme indisponibilités automatiques
      const contratEvents: CalendarEvent[] = contrats
        .filter(contrat => 
          contrat.statut === 'signe' && 
          contrat.dateDebut && 
          contrat.dateFin
        )
        .flatMap(contrat => {
          const dateDebut = contrat.dateDebut!.toDate();
          const dateFin = contrat.dateFin!.toDate();
          
          // Créer un événement pour chaque jour du contrat
          const daysInRange = eachDayOfInterval({ start: dateDebut, end: dateFin });
          
          return daysInRange.map((day, index) => {
            const eventStart = new Date(day);
            eventStart.setHours(0, 0, 0, 0);
            
            const eventEnd = new Date(day);
            eventEnd.setHours(23, 59, 59, 999);
            
            return {
              id: `contrat_${contrat.id}_${index}`,
              title: `🔒 Contrat - ${contrat.description || 'Prestation'}`,
              start: eventStart,
              end: eventEnd,
              disponible: false, // Indisponible
              recurrence: 'ponctuel' as const,
              allDay: true
            };
          });
        });
      
      // Combiner les événements de disponibilités et les contrats
      setEvents([...calendarEvents, ...contratEvents]);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement disponibilités:', error);
      setLoading(false);
    }
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const { start, end } = slotInfo;
    
    // Empêcher la sélection de dates passées
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      alert('Vous ne pouvez pas sélectionner des dates passées');
      return;
    }
    
    // Calculer le nombre de jours dans la sélection
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const title = window.prompt('Titre de l\'indisponibilité :', 'Occupé');
    if (!title) return;
    
    // Créer un événement pour chaque jour de la plage (journée complète)
    const newEvents: CalendarEvent[] = [];
    const daysInRange = eachDayOfInterval({ start, end: addDays(end, -1) });
    
    daysInRange.forEach((day, index) => {
      let eventStart = new Date(day);
      let eventEnd = new Date(day);
      
      // Journée complète (toute la journée)
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(23, 59, 59, 999);
      
      const newEvent: CalendarEvent = {
        id: `${Date.now()}_${index}`,
        title,
        start: eventStart,
        end: eventEnd,
        disponible: false,
        recurrence: 'ponctuel',
        allDay: true
      };
      newEvents.push(newEvent);
    });
    
    setEvents([...events, ...newEvents]);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    // Empêcher la modification des événements de contrat
    if (event.id.startsWith('contrat_')) {
      alert('🔒 Cet événement est lié à un contrat signé et ne peut pas être modifié.\n\nLes contrats créent automatiquement des indisponibilités pour leurs dates.');
      return;
    }
    
    // Ouvrir le modal d'édition
    setEditingEvent(event);
    setEditedTitle(event.title);
  };

  const handleSaveEdit = () => {
    if (!editingEvent || !editedTitle.trim()) {
      return;
    }

    setEvents(events.map(e => 
      e.id === editingEvent.id 
        ? { ...e, title: editedTitle.trim() }
        : e
    ));
    
    setEditingEvent(null);
    setEditedTitle('');
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    
    const confirmDelete = window.confirm(`⚠️ Supprimer "${editingEvent.title}" ?`);
    if (confirmDelete) {
      setEvents(events.filter(e => e.id !== editingEvent.id));
      setEditingEvent(null);
      setEditedTitle('');
    }
  };

  const handleCloseEditModal = () => {
    setEditingEvent(null);
    setEditedTitle('');
  };

  const handleCreateRangeDisponibilite = () => {
    if (!rangeStart || !rangeEnd) {
      alert('Veuillez sélectionner une date de début et de fin');
      return;
    }

    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    if (start > end) {
      alert('La date de début doit être avant la date de fin');
      return;
    }

    const title = window.prompt('Titre de l\'indisponibilité :', 'Occupé');
    if (!title) return;

    const newEvents: CalendarEvent[] = [];
    const daysInRange = eachDayOfInterval({ start, end });

    daysInRange.forEach((day, index) => {
      const eventStart = new Date(day);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(day);
      eventEnd.setHours(23, 59, 59, 999);

      const newEvent: CalendarEvent = {
        id: `range_${Date.now()}_${index}`,
        title,
        start: eventStart,
        end: eventEnd,
        disponible: false,
        recurrence: 'ponctuel',
        allDay: true
      };
      newEvents.push(newEvent);
    });

    setEvents([...events, ...newEvents]);
    setShowRangeModal(false);
    setRangeStart('');
    setRangeEnd('');
    setSelectingStart(true);
    alert(`✅ ${newEvents.length} jour(s) d'indisponibilité créé(s) !`);
  };

  const handleDateClick = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    
    if (selectingStart) {
      setRangeStart(dateString);
      setRangeEnd('');
      setSelectingStart(false);
    } else {
      if (new Date(dateString) < new Date(rangeStart)) {
        setRangeStart(dateString);
        setRangeEnd(rangeStart);
      } else {
        setRangeEnd(dateString);
      }
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days: Date[] = [];
    
    // Obtenir le premier jour de la semaine pour ce mois
    const firstDayOfMonth = startOfWeek(start, { locale: fr });
    
    // Calculer le nombre de jours à afficher
    // Trouver combien de jours avant le 1er du mois
    let current = firstDayOfMonth;
    while (current < start) {
      days.push(null as any); // Cellule vide pour les jours hors mois
      current = addDays(current, 1);
    }
    
    // Ajouter tous les jours du mois en cours
    current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    // Compléter jusqu'à avoir un multiple de 7 (semaine complète)
    const remainder = days.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push(null as any); // Cellule vide après le dernier jour
      }
    }
    
    return days;
  };

  const isDateInRange = (date: Date) => {
    if (!rangeStart) return false;
    const start = new Date(rangeStart);
    if (!rangeEnd) return isSameDay(date, start);
    const end = new Date(rangeEnd);
    return date >= start && date <= end;
  };

  const isDateStart = (date: Date) => {
    if (!rangeStart) return false;
    return isSameDay(date, new Date(rangeStart));
  };

  const isDateEnd = (date: Date) => {
    if (!rangeEnd) return false;
    return isSameDay(date, new Date(rangeEnd));
  };

  // Navigation handlers pour le calendrier principal
  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (view: typeof Views[keyof typeof Views]) => {
    setCurrentView(view);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const backgroundColor = event.disponible ? '#28A745' : '#DC3545';
    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    return { style };
  };

  const handleSave = async () => {
    if (!artisanId) {
      alert('Erreur: Artisan non identifié');
      return;
    }

    setSaving(true);
    try {
      // Filtrer les événements de contrat (ne pas les sauvegarder)
      const userEvents = events.filter(event => !event.id.startsWith('contrat_'));
      
      // Convertir CalendarEvent[] en DisponibiliteSlot[] (sans heures)
      const disponibilites: DisponibiliteSlot[] = userEvents.map(event => {
        const dispo: DisponibiliteSlot = {
          id: event.id,
          heureDebut: '00:00',
          heureFin: '23:59',
          recurrence: event.recurrence || 'ponctuel',
          disponible: event.disponible,
          titre: event.title
        };

        if (event.recurrence === 'ponctuel') {
          dispo.date = Timestamp.fromDate(event.start);
        }

        return dispo;
      });

      await disponibiliteService.setDisponibilites(artisanId, disponibilites);
      
      alert('✅ Disponibilités sauvegardées avec succès !');
      router.push('/artisan/dashboard');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B00] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/artisan/dashboard')}
                className="text-gray-600 hover:text-[#FF6B00] flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour au dashboard
              </button>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-[#2C3E50]">
                📅 Mon Agenda
              </h1>
              <div className="relative">
                <button
                  onClick={() => setShowRangeModal(true)}
                  className="px-4 py-2 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-medium flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Sélection rapide par dates
                </button>

                {/* Modal Sélection Rapide - Descend du bouton */}
                {showRangeModal && (
                  <>
                    {/* Overlay transparent pour fermer au clic extérieur */}
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setShowRangeModal(false);
                        setRangeStart('');
                        setRangeEnd('');
                        setSelectingStart(true);
                      }}
                    />
                    
                    {/* Popup qui descend du bouton */}
                    <div className="absolute top-full right-0 mt-2 w-96 z-50 animate-slideDown">
                      <div className="bg-white rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-[#2C3E50]">
                    Créer indisponibilités par plage
                  </h2>
                  <button
                    onClick={() => {
                      setShowRangeModal(false);
                      setRangeStart('');
                      setRangeEnd('');
                      setSelectingStart(true);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Onglets Date de début / Date de fin */}
                <div className="flex border-b border-gray-200">
                  <button 
                    onClick={() => setCalendarMode('start')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold ${
                      calendarMode === 'start' 
                        ? 'text-[#2C3E50] border-b-2 border-[#FF6B00]' 
                        : 'text-gray-500'
                    }`}
                  >
                    📅 {rangeStart ? format(new Date(rangeStart), 'dd/MM/yyyy', { locale: fr }) : 'Date de début'}
                  </button>
                  <button 
                    onClick={() => setCalendarMode('end')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold ${
                      calendarMode === 'end' 
                        ? 'text-[#2C3E50] border-b-2 border-[#FF6B00]' 
                        : 'text-gray-500'
                    }`}
                  >
                    📅 {rangeEnd ? format(new Date(rangeEnd), 'dd/MM/yyyy', { locale: fr }) : 'Date de fin'}
                  </button>
                </div>

                {/* Calendrier */}
                <div className="p-4">
                  {/* Navigation mois */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-[#FF6B00] transition-colors"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-[#2C3E50]">
                      {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-[#FF6B00] transition-colors"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Jours de la semaine */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, idx) => (
                      <div key={day} className={`text-center text-xs font-medium py-2 ${idx >= 5 ? 'text-gray-400' : 'text-[#2C3E50]'}`}>
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Grille de dates */}
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth().map((day, idx) => {
                      // Cellule vide pour les jours hors mois
                      if (!day) {
                        return <div key={idx} className="aspect-square" />;
                      }
                      
                      const isToday = isSameDay(day, new Date());
                      const inRange = isDateInRange(day);
                      const isStart = isDateStart(day);
                      const isEnd = isDateEnd(day);
                      
                      // Vérifier si la date est dans le passé
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPast = day < today;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => !isPast && handleDateClick(day)}
                          disabled={isPast}
                          className={`
                            aspect-square flex items-center justify-center text-sm rounded-full
                            ${isPast ? 'text-gray-300 cursor-not-allowed opacity-40 bg-gray-50' : 'text-gray-700 hover:bg-gray-100'}
                            ${isToday && !inRange && !isPast ? 'border-2 border-[#2C3E50]' : ''}
                            ${inRange && !isStart && !isEnd && !isPast ? 'bg-blue-100' : ''}
                            ${(isStart || isEnd) && !isPast ? 'bg-[#2C3E50] text-white font-bold' : ''}
                          `}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>

                  {/* Info sélection */}
                  {rangeStart && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                      <p className="text-gray-700">
                        {rangeEnd ? (
                          <>📅 Du <strong>{format(new Date(rangeStart), 'dd/MM/yyyy', { locale: fr })}</strong> au <strong>{format(new Date(rangeEnd), 'dd/MM/yyyy', { locale: fr })}</strong></>
                        ) : (
                          <>📅 Début: <strong>{format(new Date(rangeStart), 'dd/MM/yyyy', { locale: fr })}</strong> - Sélectionnez la date de fin</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer avec boutons */}
                <div className="p-4 bg-gray-50 rounded-b-2xl flex gap-3">
                  <button
                    onClick={() => {
                      setShowRangeModal(false);
                      setRangeStart('');
                      setRangeEnd('');
                      setSelectingStart(true);
                    }}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateRangeDisponibilite}
                    disabled={!rangeStart || !rangeEnd}
                    className="flex-1 px-4 py-3 bg-[#FF6B00] text-white rounded-xl hover:bg-[#E56100] font-semibold transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Créer
                  </button>
                </div>
              </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <div className="container mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">💡 Comment utiliser l'agenda ?</h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Sélection rapide</strong> : Cliquez sur "Sélection rapide par dates" pour marquer vos indisponibilités sur plusieurs mois</li>
            <li>• <strong>Vue Agenda</strong> : Pratique pour lister vos indisponibilités</li>
            <li>• <strong>Vue Calendrier</strong> : Cliquez et faites glisser pour sélectionner plusieurs jours consécutifs - Idéale pour gérer vos indisponibilités
              <ul className="ml-6 mt-1 space-y-1">
                <li>◦ <strong>Cliquez sur un jour</strong> dans le calendrier pour marquer une indisponibilité</li>
                <li>◦ <strong>Cliquez sur un événement</strong> pour le renommer ou le supprimer (sauf les contrats 🔒)</li>
                <li>◦ <strong>Rouge</strong> = Indisponible (Occupé) | Les jours sans couleur = Disponible</li>
              </ul>
            </li>
            <li>• <strong>🔒 Contrats signés</strong> : Créent automatiquement des indisponibilités (non supprimables)</li>
          </ul>
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-lg shadow-lg p-6 overflow-hidden" style={{ height: '700px', maxWidth: '100%' }}>
          {/* Barre de recherche par dates - Visible uniquement en vue Agenda */}
          {currentView === Views.AGENDA && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Date de début
                  </label>
                  <input
                    type="date"
                    value={searchStartDate}
                    onChange={(e) => setSearchStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
                
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 Date de fin
                  </label>
                  <input
                    type="date"
                    value={searchEndDate}
                    onChange={(e) => setSearchEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      setSearchStartDate('');
                      setSearchEndDate('');
                      setCurrentDate(new Date());
                    }}
                    className="px-4 py-2 border-2 border-[#FF6B00] text-[#FF6B00] rounded-lg hover:bg-orange-50 font-medium transition-colors"
                  >
                    ↺ Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: '100%' }}
            views={[Views.MONTH, Views.AGENDA]}
            view={currentView}
            onView={handleViewChange}
            date={currentDate}
            onNavigate={handleNavigate}
            length={searchStartDate && searchEndDate ? 
              Math.ceil((new Date(searchEndDate).getTime() - new Date(searchStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 
              365
            }
            selectable
            selectMirror
            longPressThreshold={250}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={{
              month: 'Calendrier',
              previous: 'Précédent',
              next: 'Suivant',
              today: "Aujourd'hui",
              agenda: 'Agenda',
              date: 'Date',
              event: 'Événement',
              allDay: 'Journée',
              noEventsInRange: 'Aucune indisponibilité dans cette période',
              showMore: (total) => `+ ${total} de plus`,
            }}
            culture="fr"
            components={{
              toolbar: (props) => {
                const isCalendarView = props.view === 'month';
                return (
                  <div className="rbc-toolbar">
                    {isCalendarView && (
                      <span className="rbc-btn-group">
                        <button 
                          type="button" 
                          onClick={() => props.onNavigate('TODAY')}
                        >
                          Aujourd'hui
                        </button>
                        <button 
                          type="button" 
                          onClick={() => props.onNavigate('PREV')}
                        >
                          Précédent
                        </button>
                        <button 
                          type="button" 
                          onClick={() => props.onNavigate('NEXT')}
                        >
                          Suivant
                        </button>
                      </span>
                    )}
                    <span className="rbc-toolbar-label"></span>
                    <span className="rbc-btn-group">
                      <button
                        type="button"
                        className={props.view === 'month' ? 'rbc-active' : ''}
                        onClick={() => props.onView('month')}
                      >
                        Calendrier
                      </button>
                      <button
                        type="button"
                        className={props.view === 'agenda' ? 'rbc-active' : ''}
                        onClick={() => props.onView('agenda')}
                      >
                        Agenda
                      </button>
                    </span>
                  </div>
                );
              }
            }}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => router.push('/artisan/dashboard')}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            disabled={saving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Sauvegarde...
              </>
            ) : (
              <>
                💾 Sauvegarder les indisponibilités
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal d'édition d'événement */}
      {editingEvent && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={handleCloseEditModal}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-slideDown">
              {/* Bouton fermer (X) */}
              <button
                onClick={handleCloseEditModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>

              {/* Titre */}
              <h3 className="text-xl font-bold text-[#2C3E50] mb-6">
                ✏️ Modifier l'événement
              </h3>

              {/* Champ de texte pour renommer */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de l'indisponibilité
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#FF6B00] focus:outline-none text-lg"
                  placeholder="Ex: Occupé, Congés, Rendez-vous..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    }
                  }}
                />
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-3">
                {/* Bouton Supprimer avec croix */}
                <button
                  onClick={handleDeleteEvent}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium flex items-center justify-center gap-2"
                >
                  <span className="text-xl">×</span>
                  Supprimer
                </button>

                {/* Bouton Enregistrer */}
                <button
                  onClick={handleSaveEdit}
                  disabled={!editedTitle.trim()}
                  className="flex-1 px-4 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Enregistrer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
