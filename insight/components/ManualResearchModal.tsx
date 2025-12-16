import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../hooks/useAuth';

interface ManualResearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}



const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) => (
    <div
        className="flex items-center justify-between group cursor-pointer py-2"
        onClick={() => onChange(!checked)}
    >
        <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium">{label}</span>
        <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 border ${checked ? 'bg-primary border-primary' : 'bg-transparent border-gray-500 group-hover:border-white'}`}>
            <motion.div
                className={`w-3.5 h-3.5 rounded-full shadow-sm ${checked ? 'bg-white' : 'bg-gray-400 group-hover:bg-white'}`}
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                animate={{ x: checked ? 20 : 0 }}
            />
        </div>
    </div>
);

const Checkbox = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) => (
    <div
        className={`flex items-center gap-3 py-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'group cursor-pointer'}`}
        onClick={() => !disabled && onChange(!checked)}
    >
        <div className={`w-5 h-5 border flex items-center justify-center transition-colors duration-200 ${checked ? 'bg-primary border-primary' : 'bg-transparent border-gray-500 group-hover:border-white'}`}>
            {checked && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
        </div>
        <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium select-none">{label}</span>
    </div>
);

export default function ManualResearchModal({ isOpen, onClose }: ManualResearchModalProps) {
    const [topic, setTopic] = useState('');
    const [regions, setRegions] = useState({
        pakistan: true,
        palestine: false,
        worldwide: false
    });
    const [isPublic, setIsPublic] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const { startScan } = useNotifications();
    const { user } = useAuth();

    const handleRegionChange = (region: keyof typeof regions, checked: boolean) => {
        if (region === 'worldwide') {
            if (checked) {
                // If Worldwide is checked, uncheck others
                setRegions({
                    pakistan: false,
                    palestine: false,
                    worldwide: true
                });
            } else {
                setRegions(prev => ({ ...prev, worldwide: false }));
            }
        } else {
            // If a specific region is checked, uncheck Worldwide
            if (checked) {
                setRegions(prev => ({
                    ...prev,
                    [region]: true,
                    worldwide: false
                }));
            } else {
                setRegions(prev => ({ ...prev, [region]: false }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            alert("You must be logged in to start research.");
            return;
        }

        setIsStarting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));

        await startScan(topic, {
            regions,
            isPublic,
            userId: user.uid
        });

        handleClose();
    };

    const handleClose = () => {
        onClose();
        setTimeout(() => {
            setTopic('');
            setRegions({ pakistan: true, palestine: false, worldwide: false });
            setIsPublic(false);
            setIsStarting(false);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                >
                    <div
                        className="absolute inset-0 -z-10 pointer-events-none opacity-60"
                        style={{
                            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 2px, transparent 2px)',
                            backgroundSize: '16px 16px',
                            maskImage: 'radial-gradient(circle at center, transparent 15%, black 50%, transparent 85%)',
                            WebkitMaskImage: 'radial-gradient(circle at center, transparent 15%, black 50%, transparent 85%)'
                        }}
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-md p-8 bg-black border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)]"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-wider">
                            Manual Research
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className={isStarting ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="block text-white text-xs font-bold uppercase tracking-widest mb-2">
                                    Specific Topic
                                </label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Ceasefire negotiations..."
                                    className="w-full bg-gray-900 border border-white/70 text-white p-3 focus:border-primary focus:outline-none transition-colors placeholder-gray-400"
                                    required
                                    disabled={isStarting}
                                />
                            </div>

                            <div className={isStarting ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="block text-white text-xs font-bold uppercase tracking-widest mb-3">
                                    Configuration
                                </label>

                                <div className="space-y-1 bg-gray-900/50 p-4 border border-white/5 rounded-lg mb-4">
                                    <Checkbox
                                        label="Pakistan"
                                        checked={regions.pakistan}
                                        onChange={(checked) => handleRegionChange('pakistan', checked)}
                                        disabled={regions.worldwide}
                                    />
                                    <Checkbox
                                        label="Palestine"
                                        checked={regions.palestine}
                                        onChange={(checked) => handleRegionChange('palestine', checked)}
                                        disabled={regions.worldwide}
                                    />
                                    <Checkbox
                                        label="Worldwide"
                                        checked={regions.worldwide}
                                        onChange={(checked) => handleRegionChange('worldwide', checked)}
                                    />
                                </div>

                                <div className="bg-gray-900/50 p-4 border border-white/5 rounded-lg">
                                    <Toggle
                                        label="Make Report Public"
                                        checked={isPublic}
                                        onChange={setIsPublic}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    disabled={isStarting}
                                    className={`w-full font-bold transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-2 ${isStarting ? 'bg-white text-black py-4' : 'bg-primary text-black hover:bg-white py-4'}`}
                                >
                                    {isStarting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                            <span>STARTING...</span>
                                        </>
                                    ) : (
                                        'Start Research Sequence'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isStarting}
                                    className={`w-full py-3 text-xs font-bold uppercase tracking-widest transition-colors border border-white/20 hover:border-white hover:text-white text-gray-400 ${isStarting ? 'opacity-0' : ''}`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
