import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { safeStorage } from '../utils/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  confirmReset: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    confirmReset: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught error intercepted by ErrorBoundary:", { error, errorInfo });
  }

  private handleCleanReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = window.location.origin + '/';
      }
    } catch (e) {
      window.location.reload();
    }
  };

  private handleHardReset = () => {
    try {
      if (typeof window !== 'undefined') {
        safeStorage.removeItem('mindmirror_history');
        safeStorage.removeItem('mindmirror_debateConfig');
        safeStorage.removeItem('mindmirror_osintRoomConfig');
        safeStorage.removeItem('mindmirror_groupQuestionConfig');
        safeStorage.clear();
        window.location.href = window.location.origin + '/';
      }
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#02040a',
            color: '#f8fafc',
            padding: '1.5rem',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }} 
          dir="rtl"
        >
          <div style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 1.25rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem'
            }}>
              ✨
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff' }}>
              منصة MindMirror 2026
            </h1>
            <p style={{ marginBottom: '1.5rem', opacity: 0.8, fontSize: '0.95rem', lineHeight: '1.6' }}>
              تم استعادة واستقرار النظام. اضغط على الزر أدناه للدخول المباشر إلى المنصة على الرابط الرئيسي.
            </p>

            {this.state.confirmReset ? (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginBottom: '0.85rem', lineHeight: '1.5' }}>
                  هل أنت متأكد من تصفير الذاكرة المؤقتة؟ سيؤدي هذا إلى مسح الجلسات والبيانات المخزنة محلياً.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => this.setState({ confirmReset: false })}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#e2e8f0',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.6rem',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={this.handleHardReset}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.6rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    تأكيد التصفير
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button 
                  onClick={this.handleCleanReload}
                  style={{
                    backgroundColor: '#38bdf8',
                    color: '#02040a',
                    padding: '0.85rem 1.5rem',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  الدخول إلى الرابط الرئيسي المباشر
                </button>

                <button 
                  onClick={() => this.setState({ confirmReset: true })}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: '#94a3b8',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer'
                  }}
                >
                  إعادة ضبط الذاكرة المؤقتة والتشغيل النظيف
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
