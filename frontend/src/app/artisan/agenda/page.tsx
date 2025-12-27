'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { authService } from '@/lib/auth-service';
import { getArtisanByUserId } from '@/lib/firebase/artisan-service';
import { disponibiliteService } from '@/lib/firebase/disponibilite-service';
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

  useEffect(() => {
    checkAuth();
  }, []);

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
      if (!currentUser) return;

      // Charger les données artisan
      const artisanData = await getArtisanByUserId(currentUser.uid);
      if (!artisanData || !artisanData.id) {
        console.error('Artisan non trouvé');
        setLoading(false);
        return;
      }

      setArtisanId(artisanData.id);

      // Charger les disponibilités depuis Firestore
      const disponibilites = await disponibiliteService.getDisponibilites(artisanData.id);
      
      // Convertir DisponibiliteSlot[] en CalendarEvent[]
      const calendarEvents: CalendarEvent[] = disponibilites.map(dispo => {
        let start: Date;
        let end: Date;

        if (dispo.recurrence === 'ponctuel' && dispo.date) {
          // Créneau ponctuel
          const dateBase = dispo.date.toDate();
          const [startH, startM] = dispo.heureDebut.split(':').map(Number);
          const [endH, endM] = dispo.heureFin.split(':').map(Number);
          
          start = new Date(dateBase);
          start.setHours(startH, startM, 0);
          
          end = new Date(dateBase);
          end.setHours(endH, endM, 0);
        } else {
          // Créneau hebdomadaire (exemple cette semaine)
          const today = new Date();
          const [startH, startM] = dispo.heureDebut.split(':').map(Number);
          const [endH, endM] = dispo.heureFin.split(':').map(Number);
          
          start = new Date(today);
          start.setHours(startH, startM, 0);
          
          end = new Date(today);
          end.setHours(endH, endM, 0);
        }

        return {
          id: dispo.id || String(Date.now()),
          title: dispo.titre || (dispo.disponible ? 'Disponible' : 'Occupé'),
          start,
          end,
          disponible: dispo.disponible,
          recurrence: dispo.recurrence
        };
      });
      
      setEvents(calendarEvents);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement disponibilités:', error);
      setLoading(false);
    }
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const { start, end, action } = slotInfo;
    
    // Déterminer si c'est une sélection multi-jours
    const isMultiDay = end.getTime() - start.getTime() > 24 * 60 * 60 * 1000;
    
    const typeDisponibilite = window.confirm(
      `Créer une disponibilité pour la période sélectionnée ?\n\n` +
      `Du: ${format(start, 'dd/MM/yyyy HH:mm', { locale: fr })}\n` +
      `Au: ${format(end, 'dd/MM/yyyy HH:mm', { locale: fr })}\n\n` +
      `OK = Journée(s) complète(s) (7h-20h)\n` +
      `Annuler = Garder l'horaire sélectionné`
    );
    
    const title = window.prompt('Titre de la disponibilité :', 'Disponible');
    
    if (title) {
      let eventStart = new Date(start);
      let eventEnd = new Date(end);
      let allDay = typeDisponibilite;
      
      // Si journée complète, ajuster les heures
      if (allDay) {
        eventStart.setHours(7, 0, 0, 0);
        eventEnd.setHours(20, 0, 0, 0);
      }
      
      const newEvent: CalendarEvent = {
        id: String(Date.now()),
        title,
        start: eventStart,
        end: eventEnd,
        disponible: true,
        recurrence: 'ponctuel',
        allDay
      };
      setEvents([...events, newEvent]);
    }
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const action = window.confirm(`Modifier "${event.title}" ?\n\nOK = Supprimer\nAnnuler = Garder`);
    if (action) {
      setEvents(events.filter(e => e.id !== event.id));
    }
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
      // Convertir CalendarEvent[] en DisponibiliteSlot[]
      const disponibilites: DisponibiliteSlot[] = events.map(event => {
        const heureDebut = format(event.start, 'HH:mm');
        const heureFin = format(event.end, 'HH:mm');

        const dispo: DisponibiliteSlot = {
          id: event.id,
          heureDebut,
          heureFin,
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
            <h1 className="text-2xl font-bold text-[#2C3E50]">
              📅 Mon Agenda
            </h1>
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <div className="container mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">💡 Comment utiliser l'agenda ?</h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Cliquez et faites glisser</strong> pour sélectionner une plage (jours, semaines, mois)</li>
            <li>• <strong>Sélection multi-jours</strong> : Créez des disponibilités sur plusieurs jours d'un coup</li>
            <li>• <strong>Journée complète</strong> : Sélectionnez "OK" pour disponibilité 7h-20h</li>
            <li>• <strong>Horaire spécifique</strong> : Sélectionnez "Annuler" pour garder l'horaire exact</li>
            <li>• <strong>Cliquez sur un événement</strong> pour le modifier/supprimer</li>
            <li>• <strong>Vert</strong> = Disponible | <strong>Rouge</strong> = Occupé</li>
            <li>• Changez de vue : Semaine, Mois, Jour, Agenda pour une meilleure gestion</li>
          </ul>
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-lg shadow-lg p-6" style={{ height: '700px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: '100%' }}
            views={[Views.MONTH, Views.WEEK, Views.WORK_WEEK, Views.DAY, Views.AGENDA]}
            defaultView={Views.MONTH}
            step={60}
            timeslots={2}
            showMultiDayTimes
            selectable
            selectMirror
            longPressThreshold={250}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            drilldownView="day"
            messages={{
              week: 'Semaine',
              work_week: 'Semaine de travail',
              day: 'Jour',
              month: 'Mois',
              previous: 'Précédent',
              next: 'Suivant',
              today: "Aujourd'hui",
              agenda: 'Agenda',
              date: 'Date',
              time: 'Heure',
              event: 'Événement',
              allDay: 'Journée',
              noEventsInRange: 'Aucune disponibilité dans cette période',
              showMore: (total) => `+ ${total} de plus`,
            }}
            culture="fr"
            min={new Date(2025, 0, 1, 7, 0)} // Début à 7h
            max={new Date(2025, 0, 1, 20, 0)} // Fin à 20h
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
                💾 Sauvegarder les disponibilités
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
