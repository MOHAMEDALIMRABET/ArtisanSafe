import express from 'express';
import { emailTrackingService } from '../services/email-tracking.service';

const router = express.Router();

/**
 * Obtenir les stats du jour
 * GET /api/v1/admin/email-stats/today
 */
router.get('/email-stats/today', async (req, res) => {
  try {
    const stats = await emailTrackingService.getTodayStats();

    if (!stats) {
      return res.json({
        date: new Date().toISOString().split('T')[0],
        totalSent: 0,
        totalFailed: 0,
        byProvider: { gmail: 0, firebase: 0, brevo: 0 },
        byType: { transactional: 0, notification: 0, auth: 0, system: 0 },
      });
    }

    res.json(stats);
  } catch (error: any) {
    console.error('❌ Erreur récupération stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir les stats sur une période
 * GET /api/v1/admin/email-stats/range?startDate=2026-02-01&endDate=2026-02-20
 */
router.get('/email-stats/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate et endDate requis (format YYYY-MM-DD)' });
    }

    const stats = await emailTrackingService.getStatsByDateRange(
      startDate as string,
      endDate as string
    );

    res.json(stats);
  } catch (error: any) {
    console.error('❌ Erreur récupération stats range:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir le rapport hebdomadaire
 * GET /api/v1/admin/email-stats/weekly-report
 */
router.get('/email-stats/weekly-report', async (req, res) => {
  try {
    const report = await emailTrackingService.getWeeklyReport();
    res.json(report);
  } catch (error: any) {
    console.error('❌ Erreur rapport hebdomadaire:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir les derniers logs d'emails
 * GET /api/v1/admin/email-logs?limit=100
 */
router.get('/email-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await emailTrackingService.getRecentLogs(limit);
    res.json(logs);
  } catch (error: any) {
    console.error('❌ Erreur récupération logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir les alertes actives
 * GET /api/v1/admin/email-alerts
 */
router.get('/email-alerts', async (req, res) => {
  try {
    const alerts = await emailTrackingService.getActiveAlerts();
    res.json(alerts);
  } catch (error: any) {
    console.error('❌ Erreur récupération alertes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Marquer une alerte comme lue
 * POST /api/v1/admin/email-alerts/:alertId/read
 */
router.post('/email-alerts/:alertId/read', async (req, res) => {
  try {
    const { alertId } = req.params;
    await emailTrackingService.markAlertAsRead(alertId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erreur marquage alerte:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
