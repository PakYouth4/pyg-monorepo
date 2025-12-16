import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, isDeleting }: DeleteConfirmationModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-black border border-red-900/50 p-6 max-w-sm w-full shadow-[0_0_50px_rgba(220,38,38,0.2)] rounded-sm"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-6 text-red-500">
                                <AlertTriangle className="w-8 h-8" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-3 uppercase tracking-wide">
                                Delete Report?
                            </h3>

                            <p className="text-white text-sm mb-8 leading-relaxed font-medium">
                                This action cannot be undone. This intelligence report will be permanently erased from the database.
                            </p>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 px-4 bg-transparent border border-gray-700 hover:border-white text-gray-300 hover:text-white text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <span className="animate-pulse">Deleting...</span>
                                    ) : (
                                        "DELETE"
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
