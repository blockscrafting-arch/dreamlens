import React, { memo } from 'react';

interface UserImage {
  previewUrl: string;
  qualityScore: number;
  file?: File;
}

interface PhotoPreviewGridProps {
  images: UserImage[];
  onRemove: (index: number) => void;
  isProcessing: boolean;
  processingFiles?: Set<string>;
}

export const PhotoPreviewGrid: React.FC<PhotoPreviewGridProps> = memo(({
  images,
  onRemove,
  isProcessing,
  processingFiles = new Set(),
}) => {
  if (images.length === 0) {
    return null;
  }

  const getFileId = (img: UserImage): string | null => {
    if (!img.file) return null;
    return `${img.file.name}-${img.file.size}-${img.file.lastModified}`;
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map((img, idx) => {
        const fileId = getFileId(img);
        const isProcessingThis = fileId ? processingFiles.has(fileId) : false;
        
        return (
          <div 
            key={idx} 
            className="relative group rounded-xl overflow-hidden aspect-square border-2 border-white/50 shadow-soft hover:shadow-md transition-all duration-300 ease-out animate-fade-in-up"
            style={{
              animationDelay: `${idx * 50}ms`,
              animationFillMode: 'backwards',
            }}
          >
            <img 
              src={img.previewUrl} 
              alt="upload" 
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" 
            />
            
            {/* Processing Overlay */}
            {isProcessingThis && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Premium Quality Badge */}
            {!isProcessingThis && (
              <div 
                className={`absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                  img.qualityScore > 75 
                    ? 'bg-green-500 text-white' 
                    : img.qualityScore > 40 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}
              >
                {img.qualityScore}%
              </div>
            )}

            {/* Premium Remove Button */}
            {!isProcessingThis && (
              <button 
                onClick={() => onRemove(idx)}
                disabled={isProcessing}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 ease-out"
              >
                <span className="text-white text-4xl font-light">×</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});
