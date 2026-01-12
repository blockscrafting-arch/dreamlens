import { useEffect, useRef, useCallback } from 'react';

interface QualityAnalysis {
  score: number;
  feedback: string;
}

interface WorkerMessage {
  id: string;
  type: 'analyze' | 'resize';
  file: File | Blob;
  maxDimension?: number;
}

interface WorkerResponse {
  id: string;
  type: 'analyze' | 'resize';
  success: boolean;
  data?: any;
  error?: string;
}

export const useImageWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>>(new Map());

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker with proper path handling for Vite
      const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
        type: 'module'
      });

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, success, data, error } = event.data;
        const pending = pendingRequestsRef.current.get(id);
        
        if (pending) {
          pendingRequestsRef.current.delete(id);
          if (success) {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error || 'Unknown error'));
          }
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending requests
        pendingRequestsRef.current.forEach(({ reject }) => {
          reject(new Error('Worker error occurred'));
        });
        pendingRequestsRef.current.clear();
      };

      workerRef.current = worker;

      return () => {
        // Cleanup: terminate worker and reject pending requests
        if (workerRef.current) {
          pendingRequestsRef.current.forEach(({ reject }) => {
            reject(new Error('Worker terminated'));
          });
          pendingRequestsRef.current.clear();
          workerRef.current.terminate();
          workerRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to create worker:', error);
    }
  }, []);

  const analyzeImage = useCallback(async (file: File | Blob): Promise<QualityAnalysis> => {
    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    const id = `analyze-${Date.now()}-${Math.random()}`;
    
    return new Promise<QualityAnalysis>((resolve, reject) => {
      pendingRequestsRef.current.set(id, { resolve, reject });

      // Set timeout for safety (30 seconds)
      const timeout = setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id);
          reject(new Error('Image analysis timeout'));
        }
      }, 30000);

      // Override resolve/reject to clear timeout
      const originalResolve = pendingRequestsRef.current.get(id)!.resolve;
      const originalReject = pendingRequestsRef.current.get(id)!.reject;
      
      pendingRequestsRef.current.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          originalReject(error);
        }
      });

      const message: WorkerMessage = {
        id,
        type: 'analyze',
        file
      };

      workerRef.current.postMessage(message);
    });
  }, []);

  const resizeImage = useCallback(async (file: File | Blob, maxDimension: number = 1024): Promise<string> => {
    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    const id = `resize-${Date.now()}-${Math.random()}`;
    
    return new Promise<string>((resolve, reject) => {
      pendingRequestsRef.current.set(id, { resolve, reject });

      // Set timeout for safety (30 seconds)
      const timeout = setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id);
          reject(new Error('Image resize timeout'));
        }
      }, 30000);

      // Override resolve/reject to clear timeout
      const originalResolve = pendingRequestsRef.current.get(id)!.resolve;
      const originalReject = pendingRequestsRef.current.get(id)!.reject;
      
      pendingRequestsRef.current.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          originalReject(error);
        }
      });

      const message: WorkerMessage = {
        id,
        type: 'resize',
        file,
        maxDimension
      };

      workerRef.current.postMessage(message);
    });
  }, []);

  return {
    analyzeImage,
    resizeImage,
    isAvailable: workerRef.current !== null
  };
};
