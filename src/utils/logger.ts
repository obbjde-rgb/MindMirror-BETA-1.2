export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: any;
}

type Subscriber = (logs: LogEntry[]) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private maxLogs = 500;
  
  public getLogs() {
    return this.logs;
  }
  
  public subscribe(sub: Subscriber) {
    this.subscribers.add(sub);
    return () => { this.subscribers.delete(sub); };
  }
  
  private addLog(level: LogLevel, message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      level,
      message,
      details
    };
    this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
    
    this.subscribers.forEach(sub => sub(this.logs));
    
    // Also log to standard console
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${level.toUpperCase()}] ${message}`, details || '');
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, details || '');
    }
  }
  
  public info(message: string, details?: any) {
    this.addLog('info', message, details);
  }
  
  public warn(message: string, details?: any) {
    this.addLog('warn', message, details);
  }
  
  public error(message: string, details?: any) {
    this.addLog('error', message, details);
  }
  
  public clear() {
    this.logs = [];
    this.subscribers.forEach(sub => sub(this.logs));
  }
}

export const logger = new LoggerService();
