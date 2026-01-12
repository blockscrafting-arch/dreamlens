/**
 * CDN storage utilities for images
 * Supports Cloudflare R2 and Vercel Blob Storage
 */

const STORAGE_TYPE = (import.meta.env.VITE_STORAGE_TYPE || 'indexeddb').toLowerCase();

/**
 * Upload image to CDN
 * @param imageData Base64 image data or Blob
 * @param filename Optional filename
 * @returns CDN URL
 */
export async function uploadToCDN(
  imageData: string | Blob,
  filename?: string
): Promise<string> {
  // For now, fallback to data URL if CDN not configured
  // In production, implement actual CDN upload
  
  if (STORAGE_TYPE === 'vercel-blob') {
    return uploadToVercelBlob(imageData, filename);
  } else if (STORAGE_TYPE === 'cloudflare-r2') {
    return uploadToCloudflareR2(imageData, filename);
  } else {
    // Fallback: return data URL (will be stored in IndexedDB)
    if (typeof imageData === 'string') {
      return imageData;
    }
    // Convert Blob to data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(imageData);
    });
  }
}

/**
 * Upload to Vercel Blob Storage
 */
async function uploadToVercelBlob(
  imageData: string | Blob,
  filename?: string
): Promise<string> {
  try {
    const formData = new FormData();
    
    if (typeof imageData === 'string') {
      // Convert base64 to blob
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      formData.append('file', blob, filename || 'generation.png');
    } else {
      formData.append('file', imageData, filename || 'generation.png');
    }

    const response = await fetch('/api/storage/upload?provider=blob', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to CDN');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Vercel Blob upload error:', error);
    // Fallback to data URL
    if (typeof imageData === 'string') {
      return imageData;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(imageData);
    });
  }
}

/**
 * Upload to Cloudflare R2
 */
async function uploadToCloudflareR2(
  imageData: string | Blob,
  filename?: string
): Promise<string> {
  try {
    // Cloudflare R2 requires server-side upload
    // Client sends to our API, which uploads to R2
    const formData = new FormData();
    
    if (typeof imageData === 'string') {
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      formData.append('file', blob, filename || 'generation.png');
    } else {
      formData.append('file', imageData, filename || 'generation.png');
    }

    const response = await fetch('/api/storage/upload?provider=r2', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to R2');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Cloudflare R2 upload error:', error);
    // Fallback to data URL
    if (typeof imageData === 'string') {
      return imageData;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(imageData);
    });
  }
}

/**
 * Delete image from CDN
 */
export async function deleteFromCDN(url: string): Promise<void> {
  try {
    await fetch('/api/storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
  } catch (error) {
    console.error('Error deleting from CDN:', error);
    // Non-critical, don't throw
  }
}


