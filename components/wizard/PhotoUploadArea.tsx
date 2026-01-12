import React, { useCallback, useState } from 'react';

interface PhotoUploadAreaProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  isProcessing: boolean;
  isDragging: boolean;
  onDragStateChange: (isDragging: boolean) => void;
}

export const PhotoUploadArea: React.FC<PhotoUploadAreaProps> = ({
  onFilesSelected,
  isProcessing,
  isDragging,
  onDragStateChange,
}) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      await onFilesSelected(files);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(false);
    
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files) as File[];
      await onFilesSelected(files);
    }
  }, [onFilesSelected, onDragStateChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragStateChange(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    onDragStateChange(false);
  };

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ease-out relative group ${
        isDragging 
          ? 'border-brand-500 scale-[1.02] shadow-glow-sm' 
          : 'border-brand-200 hover:border-brand-300'
      }`}
      style={{
        backgroundColor: isDragging 
          ? 'var(--tg-theme-secondary-bg-color, rgba(245, 62, 134, 0.05))' 
          : 'transparent',
      }}
      role="button"
      aria-label="Область загрузки файлов"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
        }
      }}
    >
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        onChange={handleFileChange} 
        disabled={isProcessing}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        aria-label="Выбрать изображения для загрузки"
      />
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 ease-out ${
        isDragging ? 'scale-110' : 'group-hover:scale-105'
      }`}
        style={{
          backgroundColor: 'rgba(245, 62, 134, 0.1)',
        }}
      >
        <span className="text-4xl">{isDragging ? '✨' : '📸'}</span>
      </div>
      <p 
        className="text-xl font-serif font-bold mb-1"
        style={{ color: 'var(--tg-theme-text-color, #000000)' }}
      >
        {isDragging ? 'Бросай их сюда!' : 'Добавить лучшие фото'}
      </p>
      <p 
        className="text-brand-600 font-medium text-sm"
      >
        Только ты, хорошее освещение, без очков
      </p>
    </div>
  );
};
