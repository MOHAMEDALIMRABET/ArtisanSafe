import admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Interface pour un log d'email
 */
export interface EmailLog {
  id?: string;
  timestamp: admin.firestore.Timestamp;
  recipient: string;
  subject: string;
  type: 'transactional' | 'notification' | 'auth' | 'system';
  provider: 'gmail' | 'firebase' | 'brevo';
  status: 'sent' | 'failed' | 'queued';
  error?: string;
  metadata?: {
    templateId?: string;
    userId?: string;
    relatedEntity?: string; // devisId, contratId, etc.
    messageId?: string; // ID du message SMTP
  };
}

/**
 * Interface pour les statistiques journalières
 */
export interface DailyEmailStats {
  date: string; // Format: YYYY-MM-DD
  totalSent: number;
  totalFailed: number;
  byProvider: {
    gmail: number;
    firebase: number;
    brevo: number;
  };
  byType: {
    transactional: number;
    notification: number;
    auth: number;
    system: number;
  };
  timestamp: admin.firestore.Timestamp;
}

/**
 * Service de tracking des emails
 */
export class EmailTrackingService {
  private static instance: EmailTrackingService;

  private constructor() {}

  static getInstance(): EmailTrackingService {
    if (!EmailTrackingService.instance) {
      EmailTrackingService.instance = new EmailTrackingService();
    }
    return EmailTrackingService.instance;
  }

  /**
   * Logger un email envoyé
   */
  async logEmail(emailLog: Omit<EmailLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const log: EmailLog = {
        ...emailLog,
        timestamp: admin.firestore.Timestamp.now(),
      };

      // 1. Sauvegarder dans collection email_logs
      await db.collection('email_logs').add(log);

      // 2. Mettre à jour les stats journalières
      await this.updateDailyStats(log);

      // 3. Vérifier les seuils et alerter si nécessaire
      await this.checkThresholdsAndAlert();

      console.log(`📧 Email logged: ${emailLog.recipient} (${emailLog.provider})`);
    } catch (error) {
      console.error('❌ Erreur logging email:', error);
      // Ne pas bloquer l'envoi d'email si le logging échoue
    }
  }

  /**
   * Mettre à jour les statistiques journalières
   */
  private async updateDailyStats(log: EmailLog): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const statsRef = db.collection('email_stats_daily').doc(today);

    await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(statsRef);

      if (!statsDoc.exists) {
        // Créer nouvelles stats pour aujourd'hui
        const newStats: DailyEmailStats = {
          date: today,
          totalSent: log.status === 'sent' ? 1 : 0,
          totalFailed: log.status === 'failed' ? 1 : 0,
          byProvider: {
            gmail: log.provider === 'gmail' ? 1 : 0,
            firebase: log.provider === 'firebase' ? 1 : 0,
            brevo: log.provider === 'brevo' ? 1 : 0,
          },
          byType: {
            transactional: log.type === 'transactional' ? 1 : 0,
            notification: log.type === 'notification' ? 1 : 0,
            auth: log.type === 'auth' ? 1 : 0,
            system: log.type === 'system' ? 1 : 0,
          },
          timestamp: admin.firestore.Timestamp.now(),
        };
        transaction.set(statsRef, newStats);
      } else {
        // Incrémenter stats existantes
        const currentStats = statsDoc.data() as DailyEmailStats;
        const updates: any = {
          timestamp: admin.firestore.Timestamp.now(),
        };

        if (log.status === 'sent') {
          updates.totalSent = admin.firestore.FieldValue.increment(1);
        } else if (log.status === 'failed') {
          updates.totalFailed = admin.firestore.FieldValue.increment(1);
        }

        updates[`byProvider.${log.provider}`] = admin.firestore.FieldValue.increment(1);
        updates[`byType.${log.type}`] = admin.firestore.FieldValue.increment(1);

        transaction.update(statsRef, updates);
      }
    });
  }

  /**
   * Vérifier les seuils et envoyer des alertes
   */
  private async checkThresholdsAndAlert(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const statsDoc = await db.collection('email_stats_daily').doc(today).get();

    if (!statsDoc.exists) return;

    const stats = statsDoc.data() as DailyEmailStats;
    const gmailCount = stats.byProvider.gmail || 0;
    const totalCount = stats.totalSent || 0;

    // Seuils d'alerte
    const GMAIL_LIMIT = 500;
    const WARNING_THRESHOLD_1 = 300; // 60% de la limite
    const WARNING_THRESHOLD_2 = 400; // 80% de la limite
    const WARNING_THRESHOLD_3 = 450; // 90% de la limite

    // Vérifier si on a déjà envoyé une alerte aujourd'hui
    const alertKey = `alert_sent_${today}`;
    const alertRef = db.collection('email_alerts').doc(alertKey);
    const alertDoc = await alertRef.get();
    const alertData = alertDoc.exists ? alertDoc.data() : {};

    // Alerte niveau 1 : 300 emails (60%)
    if (gmailCount >= WARNING_THRESHOLD_1 && !alertData?.level1) {
      await this.sendAlert({
        level: 'warning',
        threshold: WARNING_THRESHOLD_1,
        current: gmailCount,
        limit: GMAIL_LIMIT,
        percentage: Math.round((gmailCount / GMAIL_LIMIT) * 100),
        message: `⚠️ Limite Gmail atteinte à 60% (${gmailCount}/${GMAIL_LIMIT} emails)`,
        recommendation: 'Surveiller de près. Planifier migration Brevo si tendance continue.',
      });
      await alertRef.set({ level1: true }, { merge: true });
    }

    // Alerte niveau 2 : 400 emails (80%)
    if (gmailCount >= WARNING_THRESHOLD_2 && !alertData?.level2) {
      await this.sendAlert({
        level: 'critical',
        threshold: WARNING_THRESHOLD_2,
        current: gmailCount,
        limit: GMAIL_LIMIT,
        percentage: Math.round((gmailCount / GMAIL_LIMIT) * 100),
        message: `🚨 ALERTE : Limite Gmail atteinte à 80% (${gmailCount}/${GMAIL_LIMIT} emails)`,
        recommendation: 'ACTION REQUISE : Migrer vers Brevo dans les 24-48h.',
      });
      await alertRef.set({ level2: true }, { merge: true });
    }

    // Alerte niveau 3 : 450 emails (90%)
    if (gmailCount >= WARNING_THRESHOLD_3 && !alertData?.level3) {
      await this.sendAlert({
        level: 'danger',
        threshold: WARNING_THRESHOLD_3,
        current: gmailCount,
        limit: GMAIL_LIMIT,
        percentage: Math.round((gmailCount / GMAIL_LIMIT) * 100),
        message: `🔥 URGENCE : Limite Gmail atteinte à 90% (${gmailCount}/${GMAIL_LIMIT} emails)`,
        recommendation: 'MIGRATION URGENTE : Activer Brevo IMMÉDIATEMENT.',
      });
      await alertRef.set({ level3: true }, { merge: true });
    }

    // Alerte limite atteinte : 500 emails
    if (gmailCount >= GMAIL_LIMIT && !alertData?.limitReached) {
      await this.sendAlert({
        level: 'critical',
        threshold: GMAIL_LIMIT,
        current: gmailCount,
        limit: GMAIL_LIMIT,
        percentage: 100,
        message: `❌ LIMITE GMAIL ATTEINTE (${gmailCount}/${GMAIL_LIMIT} emails)`,
        recommendation: 'Compte Gmail peut être suspendu. Basculer sur Brevo MAINTENANT.',
      });
      await alertRef.set({ limitReached: true }, { merge: true });
    }
  }

  /**
   * Envoyer une alerte admin
   */
  private async sendAlert(alert: {
    level: 'warning' | 'critical' | 'danger';
    threshold: number;
    current: number;
    limit: number;
    percentage: number;
    message: string;
    recommendation: string;
  }): Promise<void> {
    console.log('🚨 ALERTE EMAIL:', alert.message);

    // 1. Sauvegarder alerte dans Firestore
    await db.collection('email_alerts').add({
      ...alert,
      timestamp: admin.firestore.Timestamp.now(),
      isRead: false,
    });

    // 2. Créer notification pour tous les admins
    const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get();

    const notificationPromises = adminsSnapshot.docs.map((adminDoc) =>
      db.collection('notifications').add({
        recipientId: adminDoc.id,
        type: 'email_limit_warning',
        title: alert.message,
        message: alert.recommendation,
        relatedId: null,
        isRead: false,
        priority: alert.level === 'danger' ? 'high' : alert.level === 'critical' ? 'medium' : 'low',
        metadata: {
          current: alert.current,
          limit: alert.limit,
          percentage: alert.percentage,
        },
        createdAt: admin.firestore.Timestamp.now(),
      })
    );

    await Promise.all(notificationPromises);
  }

  /**
   * Récupérer les stats du jour
   */
  async getTodayStats(): Promise<DailyEmailStats | null> {
    const today = new Date().toISOString().split('T')[0];
    const statsDoc = await db.collection('email_stats_daily').doc(today).get();

    if (!statsDoc.exists) {
      return null;
    }

    return { id: statsDoc.id, ...statsDoc.data() } as unknown as DailyEmailStats;
  }

  /**
   * Récupérer les stats sur une période
   */
  async getStatsByDateRange(startDate: string, endDate: string): Promise<DailyEmailStats[]> {
    const snapshot = await db
      .collection('email_stats_daily')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as DailyEmailStats[];
  }

  /**
   * Récupérer les derniers logs d'emails
   */
  async getRecentLogs(limit: number = 100): Promise<EmailLog[]> {
    const snapshot = await db
      .collection('email_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EmailLog[];
  }

  /**
   * Récupérer les alertes actives
   */
  async getActiveAlerts(limit: number = 20): Promise<any[]> {
    const snapshot = await db
      .collection('email_alerts')
      .where('isRead', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  /**
   * Marquer une alerte comme lue
   */
  async markAlertAsRead(alertId: string): Promise<void> {
    await db.collection('email_alerts').doc(alertId).update({
      isRead: true,
      readAt: admin.firestore.Timestamp.now(),
    });
  }

  /**
   * Obtenir un rapport hebdomadaire
   */
  async getWeeklyReport(): Promise<{
    totalSent: number;
    totalFailed: number;
    averagePerDay: number;
    peakDay: { date: string; count: number };
    byProvider: { gmail: number; firebase: number; brevo: number };
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const stats = await this.getStatsByDateRange(startDate, endDate);

    const totalSent = stats.reduce((sum, day) => sum + (day.totalSent || 0), 0);
    const totalFailed = stats.reduce((sum, day) => sum + (day.totalFailed || 0), 0);
    const averagePerDay = Math.round(totalSent / (stats.length || 1));

    const peakDay = stats.reduce(
      (max, day) => ((day.totalSent || 0) > max.count ? { date: day.date, count: day.totalSent || 0 } : max),
      { date: '', count: 0 }
    );

    const byProvider = stats.reduce(
      (acc, day) => ({
        gmail: acc.gmail + (day.byProvider?.gmail || 0),
        firebase: acc.firebase + (day.byProvider?.firebase || 0),
        brevo: acc.brevo + (day.byProvider?.brevo || 0),
      }),
      { gmail: 0, firebase: 0, brevo: 0 }
    );

    // Calculer la tendance (3 derniers jours vs 3 premiers jours)
    const recentStats = stats.slice(0, 3);
    const olderStats = stats.slice(-3);

    const recentAvg = recentStats.reduce((sum, day) => sum + (day.totalSent || 0), 0) / (recentStats.length || 1);
    const olderAvg = olderStats.reduce((sum, day) => sum + (day.totalSent || 0), 0) / (olderStats.length || 1);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const diff = recentAvg - olderAvg;
    const percentChange = Math.abs((diff / olderAvg) * 100);

    if (percentChange > 10) {
      trend = diff > 0 ? 'increasing' : 'decreasing';
    }

    return {
      totalSent,
      totalFailed,
      averagePerDay,
      peakDay,
      byProvider,
      trend,
    };
  }
}

// Export singleton instance
export const emailTrackingService = EmailTrackingService.getInstance();
