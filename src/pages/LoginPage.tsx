import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, Loader, Eye as BrandEye, Sparkles } from 'lucide-react';

// Google Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                    }) => void;
                    renderButton: (element: HTMLElement, config: {
                        theme?: string;
                        size?: string;
                        width?: number;
                        text?: string;
                    }) => void;
                };
            };
        };
    }
}

import { setToken, removeToken } from '../services/api';

export const LoginPage: React.FC = () => {
    const { login, register, loginWithGoogle, completeGoogleLogin, updatePassword } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement>(null);

    // Google Password Setup States
    const [showPasswordSetup, setShowPasswordSetup] = useState(false);
    const [tempAuth, setTempAuth] = useState<{ token: string; user: any } | null>(null);
    const [newGooglePassword, setNewGooglePassword] = useState('');
    const [setupError, setSetupError] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);

    // Password strength checks (only enforced on sign-up)
    const pwChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        digit: /[0-9]/.test(password),
    };
    const _pwStrong = pwChecks.length && pwChecks.uppercase && pwChecks.digit; // reserved for future use

    // Load Google Identity Services script
    useEffect(() => {
        const loadGoogleScript = () => {
            if (document.getElementById('google-gsi-script')) return;

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.id = 'google-gsi-script';
            script.async = true;
            script.defer = true;
            script.onload = initializeGoogle;
            document.body.appendChild(script);
        };

        const initializeGoogle = () => {
            if (window.google && googleButtonRef.current) {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleGoogleResponse
                });

                window.google.accounts.id.renderButton(googleButtonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    width: 320,
                    text: 'continue_with'
                });
            }
        };

        // If script already loaded
        if (window.google) {
            initializeGoogle();
        } else {
            loadGoogleScript();
        }
    }, []);

    const handleGoogleResponse = async (response: { credential: string }) => {
        setError('');
        setGoogleLoading(true);

        try {
            // Call loginWithGoogle but defer session state if it's a new signup
            const res = await loginWithGoogle(response.credential, false);
            if (res && res.isNew) {
                setTempAuth({ token: res.token, user: res.user });
                setShowPasswordSetup(true);
            } else {
                // Existing user, log in immediately
                completeGoogleLogin(res.token, res.user);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handlePasswordSetupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSetupError('');

        if (newGooglePassword.length < 8) {
            setSetupError('Password must be at least 8 characters long.');
            return;
        }
        if (!/[A-Z]/.test(newGooglePassword)) {
            setSetupError('Password must contain at least one uppercase letter (A–Z).');
            return;
        }
        if (!/[0-9]/.test(newGooglePassword)) {
            setSetupError('Password must contain at least one digit (0–9).');
            return;
        }

        setSetupLoading(true);
        try {
            // Temporarily set token in API headers so we can update the password on backend
            setToken(tempAuth!.token);
            await updatePassword(newGooglePassword);
            
            // Success, fully establish authenticated session
            completeGoogleLogin(tempAuth!.token, tempAuth!.user);
        } catch (err) {
            removeToken();
            setSetupError(err instanceof Error ? err.message : 'Failed to set password');
        } finally {
            setSetupLoading(false);
        }
    };

    const handleSkipPasswordSetup = () => {
        if (tempAuth) {
            completeGoogleLogin(tempAuth.token, tempAuth.user);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Enforce strong password on registration
        if (!isLogin) {
            if (!pwChecks.length) {
                setError('Password must be at least 8 characters long.');
                return;
            }
            if (!pwChecks.uppercase) {
                setError('Password must contain at least one uppercase letter (A–Z).');
                return;
            }
            if (!pwChecks.digit) {
                setError('Password must contain at least one digit (0–9).');
                return;
            }
        }

        setIsLoading(true);
        try {
            if (isLogin) {
                await login(username, password);
            } else {
                await register(username, password);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-200 dark:bg-sky-900/20 rounded-full blur-3xl opacity-50" />
            </div>

            {showPasswordSetup && tempAuth ? (
                <div className="relative w-full max-w-md page-transition">
                    {/* Logo Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-lg shadow-blue-500/25 mb-4">
                            <BrandEye size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            Label <span className="text-blue-600">Lens</span>
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            Choose your account password
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 space-y-6">
                        <div className="text-center">
                            {tempAuth.user.picture && (
                                <img 
                                    src={tempAuth.user.picture} 
                                    alt="Google Profile" 
                                    className="w-16 h-16 rounded-full mx-auto border-2 border-blue-500 shadow-md mb-3"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            )}
                            <p className="font-bold text-gray-850 dark:text-gray-100">Welcome, {tempAuth.user.username}!</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{tempAuth.user.email}</p>
                        </div>

                        {setupError && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                                {setupError}
                            </div>
                        )}

                        <form onSubmit={handlePasswordSetupSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Create Password *
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newGooglePassword}
                                        onChange={(e) => setNewGooglePassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-medium focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors text-sm"
                                        placeholder="Create a strong password"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>

                                {/* Password requirements */}
                                {newGooglePassword.length > 0 && (
                                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-1.5">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Password requirements:</p>
                                        {([
                                            { check: newGooglePassword.length >= 8, label: 'At least 8 characters' },
                                            { check: /[A-Z]/.test(newGooglePassword), label: 'At least 1 uppercase letter (A–Z)' },
                                            { check: /[0-9]/.test(newGooglePassword), label: 'At least 1 digit (0–9)' },
                                        ]).map(({ check, label }) => (
                                            <div key={label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                                                check ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                                            }`}>
                                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 ${
                                                    check ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                                                }`}>{check ? '✓' : '·'}</span>
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={setupLoading}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                {setupLoading ? <Loader size={20} className="animate-spin" /> : 'Complete Setup'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSkipPasswordSetup}
                                disabled={setupLoading}
                                className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all text-xs cursor-pointer"
                            >
                                Skip & Login (Use Google Only)
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="relative w-full max-w-md">
                {/* Logo Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-lg shadow-blue-500/25 mb-4">
                        <BrandEye size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        Label <span className="text-blue-600">Lens</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        {isLogin ? 'Welcome back!' : 'Create your account'}
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl shadow-gray-200/50 dark:shadow-none p-8">
                    {/* Toggle */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-2xl p-1 mb-6">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${isLogin
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${!isLogin
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Google Sign-In Button — only shown when Client ID is configured */}
                    {GOOGLE_CLIENT_ID ? (
                        <div className="mb-6">
                            <div
                                ref={googleButtonRef}
                                className="flex justify-center"
                            />
                            {googleLoading && (
                                <div className="flex justify-center mt-3">
                                    <Loader size={20} className="animate-spin text-blue-500" />
                                    <span className="ml-2 text-sm text-gray-500">
                                        {isLogin ? 'Signing in with Google...' : 'Signing up with Google...'}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 text-center">
                            🔑 Google Sign-In not configured — add <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">.env</code>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                or continue with username
                            </span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <User size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-medium focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                    placeholder="Enter your username"
                                    required
                                    minLength={3}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={20} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-medium focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                    placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                                    required
                                    minLength={isLogin ? 1 : 8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Live password strength indicator — only on Sign Up */}
                            {!isLogin && password.length > 0 && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-1.5">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Password requirements:</p>
                                    {([
                                        { check: pwChecks.length, label: 'At least 8 characters' },
                                        { check: pwChecks.uppercase, label: 'At least 1 uppercase letter (A–Z)' },
                                        { check: pwChecks.digit, label: 'At least 1 digit (0–9)' },
                                    ] as { check: boolean; label: string }[]).map(({ check, label }) => (
                                        <div key={label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                                            check ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 ${
                                                check ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}>{check ? '✓' : '·'}</span>
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader size={20} className="animate-spin" />
                            ) : isLogin ? (
                                <>
                                    <LogIn size={20} />
                                    Sign In
                                </>
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    Create Account
                                </>
                            )}
                        </button>
                    </form>

                    {/* Features hint for signup */}
                    {!isLogin && (
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                                <Sparkles size={16} className="text-amber-500" />
                                <span>Your inventory syncs across all devices</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
