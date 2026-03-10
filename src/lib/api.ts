import { toast } from "@/hooks/use-toast";
import { proxyPing } from "@/lib/dbProxy";
import { proxyEdgeFunction } from "@/lib/mediaProxy";

// Configuration
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

interface RetryOptions {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  showToast?: boolean;
  silent?: boolean;
}

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Таймаут: ${operation} (${ms / 1000}с)`));
    }, ms);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Check if error is retryable
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts, and 5xx errors are retryable
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('connection')
    );
  }
  return false;
}

// Get user-friendly error message
function getErrorMessage(error: unknown, operation: string): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('timeout') || msg.includes('таймаут')) {
      return `Сервер не отвечает. Проверьте подключение к интернету или попробуйте VPN.`;
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return `Ошибка сети. Проверьте подключение или попробуйте другой VPN-сервер.`;
    }
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return `Сессия истекла. Пожалуйста, войдите снова.`;
    }
    if (msg.includes('403') || msg.includes('forbidden')) {
      return `Доступ запрещён. Возможно, нет прав на это действие.`;
    }
    if (msg.includes('404')) {
      return `Данные не найдены.`;
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return `Сервер временно недоступен. Попробуйте позже.`;
    }
    
    return error.message;
  }
  
  return `Ошибка при выполнении: ${operation}`;
}

// Main retry function
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    retryDelay = RETRY_DELAY,
    showToast = true,
    silent = false,
  } = options;

  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(operation(), timeout, operationName);
      
      // If we succeeded after retries, show success toast
      if (attempt > 1 && showToast && !silent) {
        toast({
          title: "Подключение восстановлено",
          description: `${operationName} выполнено успешно`,
        });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Log the error
      console.warn(`[API] ${operationName} - попытка ${attempt}/${maxRetries} не удалась:`, error);
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryable(error)) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        
        if (!silent) {
          console.log(`[API] Повтор через ${delay}мс...`);
        }
        
        await sleep(delay);
        continue;
      }
      
      // Final failure
      break;
    }
  }

  // All retries failed
  const errorMessage = getErrorMessage(lastError, operationName);
  
  if (showToast && !silent) {
    toast({
      variant: "destructive",
      title: "Ошибка подключения",
      description: errorMessage,
    });
  }
  
  throw lastError;
}

// Wrapper for Supabase queries with retry
export async function supabaseQuery<T>(
  queryFn: () => PromiseLike<{ data: T; error: Error | null }>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const result = await withRetry(
    async () => {
      const { data, error } = await queryFn();
      if (error) throw error;
      return data;
    },
    operationName,
    options
  );
  
  return result;
}

// Wrapper for edge function calls with retry (via Yandex proxy)
export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(
    async () => {
      return await proxyEdgeFunction<T>(functionName, body);
    },
    `Edge Function: ${functionName}`,
    { timeout: 30000, ...options }
  );
}

// Connection test utility (via Yandex proxy)
export async function testConnection(): Promise<{
  success: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    const { error } = await proxyPing();
    if (error) throw new Error(error.message);
    
    return {
      success: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: getErrorMessage(error, 'Тест подключения'),
    };
  }
}
