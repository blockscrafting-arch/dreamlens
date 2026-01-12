import React from 'react';
import { PricingView } from './PricingView';

export const PricingPage: React.FC = () => {

  const handleBack = () => {
    window.location.href = '/';
  };

  return <PricingView onBack={handleBack} />;
};

