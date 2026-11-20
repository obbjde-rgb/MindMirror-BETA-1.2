import { logger } from './logger';
import { parseJsonSafely, sanitizeApiKey } from './gemini';
import { safeStorage } from './storage';

export interface RepairReport {
  timestamp: string;
  repairedItems: string[];
  status: 'healthy' | 'repaired' | 'warning';
  details: string;
}

/**
 * Automated Periodic Self-Repair Engine (خوارزمية تصحيح الأخطاء الذاتية)
 * Runs non-blocking background diagnostics and auto-repair routines periodically.
 * Ensures state integrity, API key sanitation, and JSON payload auto-correction
 * without degrading UI performance or blocking the user experience.
 */
class AutoSelfRepairEngine {
  private intervalId: any = null;
  private isRunningCheck = false;
  private lastReport: RepairReport = {
    timestamp: new Date().toISOString(),
    repairedItems: [],
    status: 'healthy',
    details: 'نظام المعالجة الذاتية يعمل بكفاءة عالية'
  };

  private visibilityListener: (() => void) | null = null;

  /**
   * Initializes periodic background self-repair algorithm with battery-saving awareness.
   */
  public start(intervalMs = 300000) {
    if (this.intervalId) return;

    logger.info('🚀 [Self-Repair Engine] تم تفعيل خوارزمية التصحيح الذاتي الموفرة للطاقة.');
    
    // Initial run on startup
    this.scheduleNonBlockingRun();

    // Periodic interval (throttled to 5 minutes to prevent battery drain)
    this.intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return; // Pause when page/tab is hidden to preserve battery
      }
      this.scheduleNonBlockingRun();
    }, intervalMs);

    // Run once when tab returns to foreground
    if (typeof document !== 'undefined') {
      this.visibilityListener = () => {
        if (!document.hidden) {
          this.scheduleNonBlockingRun();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    logger.info('🛑 [Self-Repair Engine] تم إيقاف محرك المعالجة الذاتية.');
  }

  private scheduleNonBlockingRun() {
    if (this.isRunningCheck) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.runDiagnosticsAndRepair();
      }, { timeout: 3000 });
    } else {
      setTimeout(() => {
        this.runDiagnosticsAndRepair();
      }, 200);
    }
  }

  /**
   * Core diagnostic and self-healing algorithm.
   */
  public runDiagnosticsAndRepair(): RepairReport {
    if (this.isRunningCheck) return this.lastReport;
    this.isRunningCheck = true;

    const repairedItems: string[] = [];

    try {
      // 1. Sanitize & repair API Key in localStorage if corrupted with whitespace
      const rawKey = safeStorage.getItem('mindmirror_apiKey');
      if (rawKey) {
        const sanitized = sanitizeApiKey(rawKey);
        if (sanitized !== rawKey) {
          safeStorage.setItem('mindmirror_apiKey', sanitized);
          repairedItems.push('مفتاح API (تنظيف الرموز الزائدة)');
        }
      }

      // 2. Validate & auto-repair mindmirror_personas JSON
      const rawPersonas = safeStorage.getItem('mindmirror_personas');
      if (rawPersonas) {
        try {
          const parsed = parseJsonSafely(rawPersonas);
          if (typeof parsed !== 'object' || !parsed) {
            throw new Error('Invalid personas structure');
          }
        } catch (e) {
          logger.warn('⚠️ [Self-Repair] اكتشاف تلف في ببيانات الشخصيات المخزنة. جاري المعالجة والترميم التلقائي...', e);
          // Auto-repair by clearing corrupted key so default personas restore safely
          safeStorage.removeItem('mindmirror_personas');
          repairedItems.push('ترميم قاعدة بيانات الشخصيات (Personas Store)');
        }
      }

      // 3. Validate & auto-repair custom schools JSON
      const rawSchools = safeStorage.getItem('mindmirror_custom_schools');
      if (rawSchools) {
        try {
          const parsed = parseJsonSafely(rawSchools);
          if (!Array.isArray(parsed)) {
            throw new Error('Schools is not an array');
          }
        } catch (e) {
          logger.warn('⚠️ [Self-Repair] اكتشاف تلف في المدارس الفكرية المخصصة. جاري المعالجة والترميم التلقائي...', e);
          safeStorage.removeItem('mindmirror_custom_schools');
          repairedItems.push('ترميم المدارس الفكرية المخصصة (Custom Schools Store)');
        }
      }

      // 4. Validate & auto-repair chat history JSON
      const rawHistory = safeStorage.getItem('mindmirror_history');
      if (rawHistory) {
        try {
          parseJsonSafely(rawHistory);
        } catch (e) {
          logger.warn('⚠️ [Self-Repair] اكتشاف تلف في سجل المحادثات. جاري الاستعادة الذاتية...', e);
          safeStorage.removeItem('mindmirror_history');
          repairedItems.push('استعادة سجل المحادثات (Chat History Store)');
        }
      }

      if (repairedItems.length > 0) {
        logger.info(`✨ [Self-Repair Engine] تم إجراء إصلاحات ذاتية تلقائية بنجاح: ${repairedItems.join(' ، ')}`);
        this.lastReport = {
          timestamp: new Date().toISOString(),
          repairedItems,
          status: 'repaired',
          details: `تم ترميم ${repairedItems.length} مكونات بنجاح دون أي تأثير على واجهة المستخدم.`
        };
      } else {
        this.lastReport = {
          timestamp: new Date().toISOString(),
          repairedItems: [],
          status: 'healthy',
          details: 'جميع الأنظمة والمخازن المحلية تعمل بسلامة كاملة واستجابة فائقة.'
        };
      }
    } catch (err: any) {
      logger.error('❌ [Self-Repair Engine] خطأ أثناء التشخيص الذاتي:', err);
      this.lastReport = {
        timestamp: new Date().toISOString(),
        repairedItems,
        status: 'warning',
        details: `حدث تنبيه أثناء التشخيص: ${err?.message || err}`
      };
    } finally {
      this.isRunningCheck = false;
    }

    return this.lastReport;
  }

  public getLastReport(): RepairReport {
    return this.lastReport;
  }
}

export const selfRepairEngine = new AutoSelfRepairEngine();
