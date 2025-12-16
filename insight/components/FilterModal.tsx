import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter } from 'lucide-react';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        type: 'all' | 'manual' | 'weekly';
        visibility: 'all' | 'public' | 'private';
    };
    onApply: (filters: { type: 'all' | 'manual' | 'weekly'; visibility: 'all' | 'public' | 'private' }) => void;
}

export default function FilterModal({ isOpen, onClose, filters, onApply }: FilterModalProps) {
    const [localFilters, setLocalFilters] = React.useState(filters);

    // Reset local filters when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setLocalFilters(filters);
        }
    }, [isOpen, filters]);

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const handleReset = () => {
        const resetFilters = { type: 'all' as const, visibility: 'all' as const };
        setLocalFilters(resetFilters);
        // Optional: Apply immediately on reset? Or wait for Apply? 
        // Let's wait for Apply to keep it consistent.
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <Filter className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Filter Reports</h2>
                                </div>
                                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-8">
                                {/* Report Type */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
                                        Report Type
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['all', 'manual', 'weekly'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setLocalFilters({ ...localFilters, type })}
                                                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${localFilters.type === type
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Visibility */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
                                        Visibility
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['all', 'public', 'private'] as const).map((vis) => (
                                            <button
                                                key={vis}
                                                onClick={() => setLocalFilters({ ...localFilters, visibility: vis })}
                                                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${localFilters.visibility === vis
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                                                    }`}
                                            >
                                                {vis}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/10 flex gap-3">
                                <button
                                    onClick={handleReset}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-400 border border-white/10 rounded-lg hover:border-white/30 hover:text-white transition-colors uppercase tracking-wider"
                                >
                                    RESET
                                </button>
                                <button
                                    onClick={handleApply}
                                    className="flex-[2] btn-primary text-sm uppercase tracking-wider"
                                >
                                    APPLY FILTERS
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
