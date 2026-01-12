interface QualityAnalysis {
    score: number;
    feedback: string;
}

// NEW: Resize image to max dimension (e.g. 1024px) to save bandwidth and API limits
export const resizeImage = async (file: File, maxDimension: number = 1024): Promise<string> => {
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

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error("Canvas context error"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG 0.85 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            URL.revokeObjectURL(url);
            resolve(dataUrl.split(',')[1]); // Return base64 string only
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };

        img.src = url;
    });
};

export const analyzeImageQuality = async (file: File): Promise<QualityAnalysis> => {
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
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // Resize for performance checking (max 500px)
                const scale = Math.min(1, 500 / width);
                canvas.width = width * scale;
                canvas.height = height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                let totalLuminance = 0;
                let sumLuminanceSq = 0;
                const pixelCount = canvas.width * canvas.height;

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

export const getDatasetHealth = (count: number, avgScore: number) => {
    // UPDATED LOGIC: Focus on Quality over Quantity.
    // Goal: 5-8 excellent photos.
    // Minimum usable: 3 photos.
    
    let readiness = 0; // 0 to 100
    
    // Count contribution (up to 50% of the score)
    // 5 photos = max points here.
    const countScore = Math.min(count, 5) / 5 * 50; 
    readiness += countScore;

    // Quality contribution (up to 50% of the score)
    if (count > 0) {
        readiness += (avgScore / 100) * 50;
    }

    // Bonus for having slightly more context (up to 8 photos max)
    if (count > 5 && count <= 8) {
        readiness += 10; 
    }

    // Penalize hard if very few photos
    if (count < 3) {
        readiness = Math.min(readiness, 30);
    }

    return Math.min(100, Math.round(readiness));
};