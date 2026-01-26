# Suppression en cascade des données utilisateur

## Objectif
Mettre en place une suppression en cascade explicite côté backend pour garantir que toutes les données liées à un utilisateur (artisan ou client) soient supprimées lors de la suppression de son compte (conformité RGPD).

## À faire
- Créer un endpoint sécurisé (admin only) : `/api/v1/admin/delete-user/:uid`
- Supprimer l'utilisateur dans Firebase Auth
- Supprimer tous les documents Firestore liés à l'UID dans :
  - users
  - artisans
  - devis (clientId/artisanId)
  - avis (clientId/artisanId)
  - conversations/messages
  - contrats
  - disponibilites
  - notifications, fichiers, etc.
- Logger l'opération (audit)
- Retourner un rapport détaillé de la suppression

## Notes
- Utiliser un batch Firestore pour éviter les incohérences
- Protéger l'endpoint par vérification du rôle admin
- Prévoir une confirmation avant suppression définitive

---
À planifier dans la roadmap backend (priorité RGPD/qualité).
