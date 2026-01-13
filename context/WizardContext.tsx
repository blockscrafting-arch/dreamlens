import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserImage, GenerationConfig, TrendType, AspectRatio, ImageQuality, GeneratedResult } from '../types';

interface WizardContextType {
  step: number;
  setStep: (step: number) => void;
  userImages: UserImage[];
  addUserImage: (img: UserImage) => void;
  removeUserImage: (index: number) => void;
  config: GenerationConfig;
  updateConfig: (updates: Partial<GenerationConfig>) => void;
  result: GeneratedResult | null;
  setResult: (res: GeneratedResult | null) => void;
  resetWizard: () => void;
}

const defaultConfig: GenerationConfig = {
  trend: TrendType.MAGAZINE,
  ratio: AspectRatio.PORTRAIT,
  quality: ImageQuality.STD, // Changed to 1K by default
  imageCount: 1 // Default to generating 1 image
};

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [step, setStep] = useState(1);
  const [userImages, setUserImages] = useState<UserImage[]>([]);
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [result, setResult] = useState<GeneratedResult | null>(null);

  const addUserImage = (img: UserImage) => {
    setUserImages(prev => {
      const newImages = [...prev, img];
      return newImages;
    });
  };

  const removeUserImage = (index: number) => {
    setUserImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateConfig = (updates: Partial<GenerationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setResult(null);
  };

  const resetWizard = () => {
    setStep(1);
    setUserImages([]);
    setConfig(defaultConfig);
    setResult(null);
  };

  return (
    <WizardContext.Provider value={{
      step, setStep,
      userImages, addUserImage, removeUserImage,
      config, updateConfig,
      result, setResult,
      resetWizard
    }}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) throw new Error("useWizard must be used within WizardProvider");
  return context;
};