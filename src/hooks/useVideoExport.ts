import { useState, useCallback } from 'react';
import { Message, PersonaData } from '../types';
import { generateSubtitledVideo, downloadAllCachedAudioZip, VideoSegmentInput } from '../utils/videoGenerator';
import { useToast } from '../components/Toast';
import { logger } from '../utils/logger';

interface UseVideoExportProps {
  generateTTS: (text: string, personaKey: string, signal: AbortSignal) => Promise<string | null>;
  personas: Record<string, PersonaData>;
}

export const useVideoExport = ({ generateTTS, personas }: UseVideoExportProps) => {
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const { toast } = useToast();

  /**
   * Export a single message as a Video file with captions and audio
   */
  const exportMessageToVideo = useCallback(async (
    msg: Message,
    fallbackPersonaKey: string
  ) => {
    if (isExportingVideo) return;
    setIsExportingVideo(true);
    setExportProgress(0);
    setExportStatusText('تحضير المقطع الصوتي للرسالة...');

    try {
      const pKey = msg.persona || fallbackPersonaKey || 'assistant';
      const personaObj = personas[pKey];
      const personaName = personaObj?.label || (msg.role === 'user' ? 'المستخدم' : 'المساعد الذكي');

      const abortController = new AbortController();
      const base64Audio = await generateTTS(msg.text, pKey, abortController.signal);

      if (!base64Audio) {
        throw new Error('تعذر توليد أو جلب الصوت لهذه الرسالة.');
      }

      setExportStatusText('جاري إنشاء مقطع الفيديو وبث الكلمات الكرتونية المزامنة...');

      const segment: VideoSegmentInput = {
        text: msg.text,
        personaName,
        role: msg.role,
        base64Audio
      };

      await generateSubtitledVideo([segment], {
        title: `شرح بالفيديو • ${personaName}`,
        modeLabel: 'فيديو مع الكلمات',
        filename: `video_msg_${pKey}_${Date.now()}.mp4`,
        onProgress: (progress, statusText) => {
          setExportProgress(progress);
          setExportStatusText(statusText);
        }
      });

      toast({
        type: 'success',
        title: 'تم إنشاء الفيديو بنجاح!',
        message: 'تم تنزيل فيديو المحادثة الصوتية المعنون بالكلمات المزامنة.'
      });
    } catch (error: any) {
      logger.error('Error exporting message to video:', error);
      toast({
        type: 'error',
        title: 'فشل تصدير الفيديو',
        message: error?.message || 'حدث خطأ أثناء معالجة فيديو الكلمات والصوت.'
      });
    } finally {
      setIsExportingVideo(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  }, [generateTTS, personas, toast, isExportingVideo]);

  /**
   * Export full chat history or debate as a continuous Video with captions
   */
  const exportChatHistoryToVideo = useCallback(async (
    messages: Message[],
    fallbackPersonaKey: string,
    titleLabel: string = 'المحادثة الكاملة',
    modeLabel: string = 'فيديو حواري شامل'
  ) => {
    if (isExportingVideo) return;
    const validMsgs = messages.filter(m => !m.isSystem && m.text && m.text.trim());
    if (validMsgs.length === 0) {
      toast({
        type: 'warning',
        title: 'لا توجد رسائل',
        message: 'لا توجد محادثات قابلة للتصدير كفيديو.'
      });
      return;
    }

    setIsExportingVideo(true);
    setExportProgress(0);
    setExportStatusText('تحضير وتوليد صوتيات جميع الرسائل...');

    try {
      const abortController = new AbortController();
      const segments: VideoSegmentInput[] = [];

      for (let i = 0; i < validMsgs.length; i++) {
        const msg = validMsgs[i];
        const pKey = msg.persona || fallbackPersonaKey || 'assistant';
        const personaObj = personas[pKey];
        const personaName = personaObj?.label || (msg.role === 'user' ? 'المستخدم' : 'المساعد الذكي');

        setExportStatusText(`توليد الصوت للرسالة ${i + 1} من ${validMsgs.length}...`);
        const audio = await generateTTS(msg.text, pKey, abortController.signal);

        if (audio) {
          segments.push({
            text: msg.text,
            personaName,
            role: msg.role,
            base64Audio: audio
          });
        }
      }

      if (segments.length === 0) {
        throw new Error('تعذر توليد الصوتيات للمحادثة.');
      }

      await generateSubtitledVideo(segments, {
        title: titleLabel,
        modeLabel,
        filename: `full_conversation_video_${Date.now()}.mp4`,
        onProgress: (progress, statusText) => {
          setExportProgress(progress);
          setExportStatusText(statusText);
        }
      });

      toast({
        type: 'success',
        title: 'تم تنزيل الفيديو الشامل!',
        message: 'تم تصدير كل الحوارات والمناظرات في ملف فيديو واحد بصوت مدمج مع الكلمات.'
      });
    } catch (error: any) {
      logger.error('Error exporting chat history to video:', error);
      toast({
        type: 'error',
        title: 'خطأ في تصدير الفيديو الشامل',
        message: error?.message || 'حدث خطأ أثناء إنشاء فيديو المحادثة.'
      });
    } finally {
      setIsExportingVideo(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  }, [generateTTS, personas, toast, isExportingVideo]);

  /**
   * Export all cached audio files as a ZIP archive
   */
  const exportAllCachedAudioFiles = useCallback(async () => {
    try {
      toast({
        type: 'info',
        title: 'جاري تجميع الكاش الصوتي...',
        message: 'يتم الآن جلب وتجميع جميع الملفات الصوتية التي تم تنزيلها أو تشغيلها سابقاً.'
      });
      await downloadAllCachedAudioZip();
      toast({
        type: 'success',
        title: 'تم تنزيل أرشيف الصوتيات (ZIP)',
        message: 'تم حفظ كافة الملفات الصوتية المخزنة بالكاش في ملف ZIP.'
      });
    } catch (error: any) {
      logger.error('Failed to export cached audio zip:', error);
      toast({
        type: 'error',
        title: 'فشل تنزيل الكاش',
        message: error?.message || 'لم يتم العثور على ملفات صوتية مخزنة بالكاش.'
      });
    }
  }, [toast]);

  return {
    isExportingVideo,
    exportProgress,
    exportStatusText,
    exportMessageToVideo,
    exportChatHistoryToVideo,
    exportAllCachedAudioFiles
  };
};
