/**
 * Composant Timeline d'un litige
 * Affiche l'historique complet des actions
 */

'use client';

import { LitigeAction } from '@/types/litige';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  MessageSquare,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ArrowUpCircle,
  Plus,
} from 'lucide-react';

interface LitigeTimelineProps {
  historique: LitigeAction[];
  currentUserId: string;
}

export default function LitigeTimeline({ historique, currentUserId }: LitigeTimelineProps) {
  // Trier par date décroissante (plus récent en haut)
  const sortedHistorique = [...historique].sort((a, b) => {
    const dateA = a.date?.toMillis() || 0;
    const dateB = b.date?.toMillis() || 0;
    return dateB - dateA;
  });

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'creation':
        return <Plus className="w-5 h-5 text-[#FF6B00]" />;
      case 'commentaire':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'assignation':
        return <UserCheck className="w-5 h-5 text-purple-500" />;
      case 'proposition_resolution':
        return <FileText className="w-5 h-5 text-green-500" />;
      case 'acceptation_resolution':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'refus_resolution':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'escalade':
        return <ArrowUpCircle className="w-5 h-5 text-orange-500" />;
      case 'resolution':
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'client':
        return 'Client';
      case 'artisan':
        return 'Artisan';
      case 'admin':
        return 'Médiateur';
      default:
        return 'Système';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'creation':
        return 'bg-orange-50 border-orange-200';
      case 'commentaire':
        return 'bg-blue-50 border-blue-200';
      case 'assignation':
        return 'bg-purple-50 border-purple-200';
      case 'proposition_resolution':
        return 'bg-green-50 border-green-200';
      case 'acceptation_resolution':
        return 'bg-green-100 border-green-300';
      case 'refus_resolution':
        return 'bg-red-50 border-red-200';
      case 'escalade':
        return 'bg-orange-50 border-orange-300';
      case 'resolution':
        return 'bg-green-100 border-green-400';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#2C3E50]">Historique du litige</h3>

      <div className="relative">
        {/* Ligne verticale */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300" />

        {/* Actions */}
        <div className="space-y-6">
          {sortedHistorique.map((action, index) => (
            <div key={index} className="relative flex gap-4">
              {/* Icône */}
              <div className="relative z-10 flex-shrink-0 w-12 h-12 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center">
                {getActionIcon(action.type)}
              </div>

              {/* Contenu */}
              <div className={`flex-1 p-4 rounded-lg border-2 ${getActionColor(action.type)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Auteur et rôle */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-[#2C3E50]">
                        {getRoleLabel(action.auteurRole)}
                      </span>
                      {action.auteurId === currentUserId && (
                        <span className="px-2 py-0.5 text-xs bg-[#FF6B00] text-white rounded">
                          Vous
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-gray-700 mb-2">{action.description}</p>

                    {/* Détails supplémentaires */}
                    {action.details && Object.keys(action.details).length > 0 && (
                      <div className="mt-2 p-3 bg-white/50 rounded border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium mb-1">Détails :</p>
                        {action.details.montantClient !== undefined && (
                          <p className="text-sm text-gray-700">
                            • Remboursement client : {action.details.montantClient}€
                          </p>
                        )}
                        {action.details.montantArtisan !== undefined && (
                          <p className="text-sm text-gray-700">
                            • Paiement artisan : {action.details.montantArtisan}€
                          </p>
                        )}
                        {action.details.motif && (
                          <p className="text-sm text-gray-700">• Motif : {action.details.motif}</p>
                        )}
                        {action.details.raison && (
                          <p className="text-sm text-gray-700">• Raison : {action.details.raison}</p>
                        )}
                      </div>
                    )}

                    {/* Pièces jointes */}
                    {action.piecesJointes && action.piecesJointes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 font-medium mb-2">
                          📎 Pièces jointes :
                        </p>
                        <div className="space-y-1">
                          {action.piecesJointes.map((piece, idx) => (
                            <a
                              key={idx}
                              href={piece.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-[#FF6B00] hover:underline"
                            >
                              {piece.nom} ({(piece.taille / 1024).toFixed(1)} Ko)
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {action.date
                      ? formatDistanceToNow(action.date.toDate(), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : 'Date inconnue'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sortedHistorique.length === 0 && (
        <p className="text-center text-gray-500 py-8">Aucune action enregistrée</p>
      )}
    </div>
  );
}
