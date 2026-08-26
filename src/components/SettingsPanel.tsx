import React from 'react';
import { X, Scale, Moon, Sun, Shield, Heart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    const { isDarkMode, toggleDarkMode } = useTheme();

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto animate-slide-in">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-500 to-violet-500 p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur">
                                <Scale size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Settings</h2>
                                <p className="text-xs text-white/80">Compliance System v1.0</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-6">
                    {/* Preferences Section */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Preferences</h3>

                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                            <div className="flex items-center gap-3">
                                {isDarkMode ? <Moon size={20} className="text-indigo-400" /> : <Sun size={20} className="text-amber-500" />}
                                <div>
                                    <p className="font-semibold text-gray-850 dark:text-gray-200">Dark Mode</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {isDarkMode ? 'Currently enabled' : 'Currently disabled'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleDarkMode}
                                className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer ${isDarkMode ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-650'}`}
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDarkMode ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </section>

                    {/* About Section */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">About</h3>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl">
                                    <Scale size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">Label Lens</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Compliance Checker & Inspection Log</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-750 rounded-xl">
                                    <Shield size={14} className="text-blue-500" />
                                    <span className="text-xs text-gray-600 dark:text-gray-350">Secure Logs</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-750 rounded-xl">
                                    <Heart size={14} className="text-blue-500" />
                                    <span className="text-xs text-gray-600 dark:text-gray-350">Fair Trade</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
                @keyframes slide-in {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in {
                    animation: slide-in 0.25s ease-out;
                }
            `}</style>
        </>
    );
};
