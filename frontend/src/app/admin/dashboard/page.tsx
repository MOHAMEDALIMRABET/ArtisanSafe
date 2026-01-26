'use client';

/**
 * Dashboard Admin - Page d'accueil administration
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/auth-service';
import { getAllArtisansForAdmin } from '@/lib/firebase/artisan-service';
import { getAllClientsForAdmin } from '@/lib/firebase/account-service';
import type { Artisan } from '@/types/firestore';

interface Client {
  userId: string;
  suspended?: boolean;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    artisansTotal: 0,
    artisansActifs: 0,
    artisansSuspendus: 0,
    artisansEnAttente: 0,
    clientsTotal: 0,
    clientsActifs: 0,
    clientsSuspendus: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }

      const [artisans, clients] = await Promise.all([
        getAllArtisansForAdmin(),
        getAllClientsForAdmin()
      ]);

      // Artisans en attente de vérification
      const artisansEnAttente = artisans.filter(a => {
        const kbisEnCours = a.verificationDocuments?.kbis?.uploaded && 
                           !a.verificationDocuments?.kbis?.verified && 
                           !a.verificationDocuments?.kbis?.rejected;
        const idEnCours = a.verificationDocuments?.idCard?.uploaded && 
                         !a.verificationDocuments?.idCard?.verified && 
                         !a.verificationDocuments?.idCard?.rejected;
        return kbisEnCours || idEnCours;
      }).length;

      setStats({
        artisansTotal: artisans.length,
        artisansActifs: artisans.filter(a => !a.suspended).length,
        artisansSuspendus: artisans.filter(a => a.suspended).length,
        artisansEnAttente,
        clientsTotal: clients.length,
        clientsActifs: clients.filter(c => !c.suspended).length,
        clientsSuspendus: clients.filter(c => c.suspended).length,
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-600">Chargement...</p>
      </div>
    );
  }

  const cards = [
    {
      title: 'Vérifications en attente',
      value: stats.artisansEnAttente,
      icon: '⏳',
      color: 'bg-yellow-500',
      link: '/admin/verifications',
      description: 'Documents à valider'
    },
    {
      title: 'Artisans',
      value: stats.artisansTotal,
      icon: '🔧',
      color: 'bg-[#FF6B00]',
      link: '/admin/comptes',
      description: `${stats.artisansActifs} actifs • ${stats.artisansSuspendus} suspendus`
    },
    {
      title: 'Clients',
      value: stats.clientsTotal,
      icon: '👥',
      color: 'bg-[#2C3E50]',
      link: '/admin/comptes',
      description: `${stats.clientsActifs} actifs • ${stats.clientsSuspendus} suspendus`
    },
    {
      title: 'Comptes suspendus',
      value: stats.artisansSuspendus + stats.clientsSuspendus,
      icon: '⚠️',
      color: 'bg-red-600',
      link: '/admin/comptes',
      description: 'Nécessitent attention'
    }
  ];

  const quickActions = [
    {
      title: 'Vérifier Documents',
      description: 'Valider les KBIS et pièces d\'identité',
      icon: '✅',
      link: '/admin/verifications',
      color: 'bg-green-600'
    },
    {
      title: 'Litiges & Conversations',
      description: 'Historique complet pour résolution litiges',
      icon: '🛡️',
      link: '/admin/litiges',
      color: 'bg-red-600'
    },
    {
      title: 'Gérer Artisans',
      description: 'Suspendre, réactiver, supprimer',
      icon: '🔧',
      link: '/admin/comptes',
      color: 'bg-[#FF6B00]'
    },
    {
      title: 'Gérer Clients',
      description: 'Modération des comptes clients',
      icon: '👤',
      link: '/admin/comptes',
      color: 'bg-[#2C3E50]'
    }
  ];

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#2C3E50] mb-2">
          Tableau de bord administrateur
        </h1>
        <p className="text-gray-600">
          Vue d'ensemble de la plateforme ArtisanDispo
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <Link
            key={index}
            href={card.link}
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {card.icon}
              </div>
              <span className="text-3xl font-bold text-gray-800">{card.value}</span>
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Actions rapides */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2C3E50] mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.link}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-transparent hover:border-[#FF6B00]"
            >
              <div className={`${action.color} w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-4 text-white`}>
                {action.icon}
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">{action.title}</h3>
              <p className="text-sm text-gray-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Alertes */}
      {stats.artisansEnAttente > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start gap-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-800 mb-1">
                {stats.artisansEnAttente} vérification(s) en attente
              </h3>
              <p className="text-yellow-700 mb-3">
                Des documents artisans sont en attente de validation. Veuillez les vérifier rapidement.
              </p>
              <Link
                href="/admin/verifications"
                className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Voir les vérifications
              </Link>
            </div>
          </div>
        </div>
      )}

      {stats.artisansSuspendus + stats.clientsSuspendus > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg mt-4">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🚫</span>
            <div>
              <h3 className="font-bold text-red-800 mb-1">
                {stats.artisansSuspendus + stats.clientsSuspendus} compte(s) suspendu(s)
              </h3>
              <p className="text-red-700 mb-3">
                {stats.artisansSuspendus} artisan(s) et {stats.clientsSuspendus} client(s) sont actuellement suspendus.
              </p>
              <Link
                href="/admin/comptes"
                className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Gérer les comptes
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
