import React, { useState } from 'react';
import { X, Scale, Moon, Sun, Shield, Heart, Lock, KeyRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    const { isDarkMode, toggleDarkMode } = useTheme();
    const { user, switchRole, updatePassword } = useAuth();


    // Password Update States
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');
    const [passLoading, setPassLoading] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        if (newPassword.length < 8) {
            setPassError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPassError('Passwords do not match.');
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            setPassError('Must contain at least one uppercase letter (A–Z).');
            return;
        }
        if (!/[0-9]/.test(newPassword)) {
            setPassError('Must contain at least one digit (0–9).');
            return;
        }

        setPassLoading(true);
        try {
            await updatePassword(newPassword);
            setPassSuccess('Password updated successfully!');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowPasswordForm(false);
                setPassSuccess('');
            }, 2000);
        } catch (err) {
            setPassError(err instanceof Error ? err.message : 'Failed to update password');
        } finally {
            setPassLoading(false);
        }
    };

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
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-800 p-5">
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
                    {/* RBAC Role Switcher Section */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Access Control Role (RBAC)</h3>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Switch active session role to test permission boundaries & enforcement capabilities:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'ADMIN', label: 'Administrator', desc: 'Full System & DB Access' },
                                    { id: 'ENFORCEMENT_OFFICER', label: 'Enforcement Officer', desc: 'Notices & Compounding' },
                                    { id: 'INSPECTOR', label: 'Inspector', desc: 'Scanning & Audit Reports' },
                                    { id: 'MERCHANT', label: 'Merchant / Mfr', desc: 'View Own Products Only' },
                                ].map(r => {
                                    const active = (user?.role || 'INSPECTOR') === r.id;
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => switchRole(r.id as any)}
                                            className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                                                active
                                                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                            }`}
                                        >
                                            <p className="text-xs font-bold leading-tight">{r.label}</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{r.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Preferences Section */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Preferences</h3>

                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                            <div className="flex items-center gap-3">
                                {isDarkMode ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-amber-500" />}
                                <div>
                                    <p className="font-semibold text-gray-850 dark:text-gray-200">Dark Mode</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {isDarkMode ? 'Currently enabled' : 'Currently disabled'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleDarkMode}
                                className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-650'}`}
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDarkMode ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </section>


                    {/* Security Section */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Account Security</h3>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-3">
                            {!showPasswordForm ? (
                                <button
                                    onClick={() => setShowPasswordForm(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all text-xs cursor-pointer shadow shadow-blue-500/10"
                                >
                                    <KeyRound size={14} />
                                    Set / Change Password
                                </button>
                            ) : (
                                <form onSubmit={handlePasswordChange} className="space-y-3">
                                    {passError && <p className="text-xs text-rose-500 font-semibold">{passError}</p>}
                                    {passSuccess && <p className="text-xs text-blue-500 font-semibold">{passSuccess}</p>}
                                    
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <Lock size={14} />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="New Password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <Lock size={14} />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="Confirm Password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={passLoading}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs disabled:opacity-50 cursor-pointer"
                                        >
                                            {passLoading ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPasswordForm(false);
                                                setNewPassword('');
                                                setConfirmPassword('');
                                                setPassError('');
                                                setPassSuccess('');
                                            }}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-xs cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
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
