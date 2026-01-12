// Web Worker for image processing to prevent UI blocking

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

// Resize image to max dimension
const resizeImage = async (file: File | Blob, maxDimension: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context error"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob and then to base64
      canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
        .then(blob => {
          URL.revokeObjectURL(url);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to read blob"));
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          URL.revokeObjectURL(url);
          reject(error);
        });
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load error"));
    };

    img.src = url;
  });
};

// Analyze image quality
const analyzeImageQuality = async (file: File | Blob): Promise<QualityAnalysis> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      let score = 100;
      const issues: string[] = [];

      // 1. Resolution Check
      const width = img.width;
      const height = img.height;
      const megapixels = (width * height) / 1000000;

      if (megapixels < 0.5) {
        score -= 40;
        issues.push("Низкое разрешение");
      } else if (megapixels < 2) {
        score -= 10;
      }

      // 2. Pixel Analysis (Brightness & Contrast)
      // Use OffscreenCanvas if available, fallback to regular canvas
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Resize for performance checking (max 500px)
        const scale = Math.min(1, 500 / width);
        const analysisWidth = Math.round(width * scale);
        const analysisHeight = Math.round(height * scale);
        
        const analysisCanvas = new OffscreenCanvas(analysisWidth, analysisHeight);
        const analysisCtx = analysisCanvas.getContext('2d');
        
        if (analysisCtx) {
          analysisCtx.drawImage(img, 0, 0, analysisWidth, analysisHeight);
          const imageData = analysisCtx.getImageData(0, 0, analysisWidth, analysisHeight);
          const data = imageData.data;
          
          let totalLuminance = 0;
          let sumLuminanceSq = 0;
          const pixelCount = analysisWidth * analysisHeight;

          for (let i = 0; i < data.length; i += 4) {
            // Standard luminance formula: 0.299R + 0.587G + 0.114B
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            
            totalLuminance += luminance;
            sumLuminanceSq += luminance * luminance;
          }

          const meanLuminance = totalLuminance / pixelCount;
          const variance = (sumLuminanceSq / pixelCount) - (meanLuminance * meanLuminance);
          const stdDev = Math.sqrt(Math.max(0, variance)); // Contrast approximation

          // Brightness Check (0-255)
          if (meanLuminance < 40) {
            score -= 30;
            issues.push("Слишком темно");
          } else if (meanLuminance > 220) {
            score -= 20;
            issues.push("Слишком светло (засвет)");
          }

          // Contrast Check
          if (stdDev < 20) {
            score -= 20;
            issues.push("Низкий контраст (блеклое)");
          }
        }
      }

      // Clean up
      URL.revokeObjectURL(url);
      
      let feedback = "Отличное фото";
      if (issues.length > 0) {
        feedback = issues.join(", ");
      }

      resolve({
        score: Math.max(0, Math.round(score)),
        feedback
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ score: 0, feedback: "Ошибка чтения файла" });
    };

    img.src = url;
  });
};

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, file, maxDimension } = event.data;
  
  try {
    if (type === 'analyze') {
      const result = await analyzeImageQuality(file);
      const response: WorkerResponse = {
        id,
        type: 'analyze',
        success: true,
        data: result
      };
      self.postMessage(response);
    } else if (type === 'resize') {
      const result = await resizeImage(file, maxDimension || 1024);
      const response: WorkerResponse = {
        id,
        type: 'resize',
        success: true,
        data: result
      };
      self.postMessage(response);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
});
