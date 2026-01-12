import React from 'react';
import { Button } from './Button';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: React.ReactNode;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, title, content }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-content"
        >
            {/* Premium Backdrop with gradient */}
            <div 
                className="absolute inset-0 bg-gradient-to-br from-black/50 via-brand-900/20 to-purple-900/20 backdrop-blur-md animate-fade-in"
                onClick={onClose}
                aria-hidden="true"
            ></div>
            
            {/* Premium Content with Glassmorphism */}
            <div className="relative glass-lg rounded-3xl p-8 max-w-2xl w-full shadow-glass-xl animate-pop-in max-h-[80vh] flex flex-col border border-white/20">
                {/* Gradient accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand rounded-t-3xl"></div>
                
                <div className="flex justify-between items-center mb-6">
                    <h2 id="modal-title" className="text-2xl font-serif font-bold text-gray-800 text-shadow-soft">{title}</h2>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full glass-sm flex items-center justify-center hover:bg-white/80 hover:scale-110 transition-all duration-300 group"
                        aria-label="Закрыть модальное окно"
                    >
                        <span className="text-gray-600 group-hover:text-brand-600 transition-colors text-lg font-bold" aria-hidden="true">✕</span>
                    </button>
                </div>
                
                <div id="modal-content" className="overflow-y-auto pr-2 custom-scrollbar space-y-4 text-gray-600 leading-relaxed text-sm mb-6">
                    {content}
                </div>

                <div className="pt-4 border-t border-white/20 flex justify-end">
                    <Button onClick={onClose} variant="secondary">Понятно</Button>
                </div>
            </div>
        </div>
    );
};