'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { authService } from '@/lib/auth-service';

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

// Types pour les créneaux de disponibilité
interface DisponibiliteSlot {
  id: string;
  title: string;
  start: Date;
  end: Date;
  disponible: boolean;
  recurrence?: 'hebdomadaire' | 'ponctuel';
}

export default function AgendaPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DisponibiliteSlot[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Exemple de données (à remplacer par appel Firestore)
      const exampleSlots: DisponibiliteSlot[] = [
        {
          id: '1',
          title: 'Disponible',
          start: new Date(2025, 11, 27, 9, 0), // 27 déc 2025 9h
          end: new Date(2025, 11, 27, 17, 0), // 27 déc 2025 17h
          disponible: true,
          recurrence: 'hebdomadaire'
        },
        {
          id: '2',
          title: 'Occupé - Chantier',
          start: new Date(2025, 11, 28, 10, 0),
          end: new Date(2025, 11, 28, 16, 0),
          disponible: false,
          recurrence: 'ponctuel'
        }
      ];
      
      setEvents(exampleSlots);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement disponibilités:', error);
      setLoading(false);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    const title = window.prompt('Nouveau créneau de disponibilité :');
    if (title) {
      const newEvent: DisponibiliteSlot = {
        id: String(Date.now()),
        title,
        start,
        end,
        disponible: true,
        recurrence: 'ponctuel'
      };
      setEvents([...events, newEvent]);
    }
  };

  const handleSelectEvent = (event: DisponibiliteSlot) => {
    const action = window.confirm(`Modifier "${event.title}" ?\n\nOK = Supprimer\nAnnuler = Garder`);
    if (action) {
      setEvents(events.filter(e => e.id !== event.id));
    }
  };

  const eventStyleGetter = (event: DisponibiliteSlot) => {
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
            <li>• <strong>Cliquez sur un créneau vide</strong> pour ajouter une disponibilité</li>
            <li>• <strong>Cliquez sur un événement existant</strong> pour le modifier/supprimer</li>
            <li>• <strong>Vert</strong> = Disponible | <strong>Rouge</strong> = Occupé</li>
            <li>• Utilisez les flèches pour naviguer entre les semaines</li>
          </ul>
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-lg shadow-lg p-6" style={{ height: '700px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            views={[Views.WEEK, Views.DAY, Views.MONTH]}
            defaultView={Views.WEEK}
            step={60}
            showMultiDayTimes
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={{
              week: 'Semaine',
              day: 'Jour',
              month: 'Mois',
              previous: 'Précédent',
              next: 'Suivant',
              today: "Aujourd'hui",
              agenda: 'Agenda',
              noEventsInRange: 'Aucun événement dans cette période',
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
          >
            Annuler
          </button>
          <button
            onClick={() => {
              // TODO: Sauvegarder dans Firestore
              alert('Disponibilités sauvegardées !');
              router.push('/artisan/dashboard');
            }}
            className="px-6 py-3 bg-[#FF6B00] text-white rounded-lg hover:bg-[#E56100] font-medium"
          >
            💾 Sauvegarder les disponibilités
          </button>
        </div>
      </div>
    </div>
  );
}
