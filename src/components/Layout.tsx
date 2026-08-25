import React, { useState } from 'react';
import { Scale, Settings, Home, Activity, Archive, LogOut, User } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { PageType } from '../App';

interface LayoutProps {
    children: React.ReactNode;
    currentPage: PageType;
    onNavigate: (page: PageType) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
    const [showSettings, setShowSettings] = useState(false);
    const { isDarkMode } = useTheme();
    const { user, logout } = useAuth();

    const navItems = [
        { id: 'home' as PageType, label: 'Dashboard', icon: Home },
        { id: 'scan' as PageType, label: 'Scan label', icon: Activity },
        { id: 'repository' as PageType, label: 'Repository', icon: Archive },
    ];

    return (
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode
            ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950'
            : 'bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50'
            }`}>
            {/* Header */}
            <header className="sticky top-0 z-40 glass-panel border-b border-white/20 dark:border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Logo */}
                    <button
                        onClick={() => onNavigate('home')}
                        className="flex items-center gap-3 group cursor-pointer"
                    >
                        <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-600/30 group-hover:shadow-indigo-600/50 transition-shadow">
                            <Scale size={22} className="text-white" />
                        </div>
                        <div className="text-left">
                            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                                Legal Metrology
                            </h1>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-0.5">Compliance Checking System</p>
                        </div>
                    </button>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-full p-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentPage === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${isActive
                                        ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-450 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <Icon size={16} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Settings Button */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors cursor-pointer text-gray-650 dark:text-gray-300"
                        >
                            <Settings size={20} />
                        </button>

                        {/* User Profile & Logout */}
                        {user && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                                    <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                        {user.username}
                                    </span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-full transition-colors group cursor-pointer"
                                    title="Logout"
                                >
                                    <LogOut size={18} className="text-gray-500 group-hover:text-rose-600 dark:text-gray-400 dark:group-hover:text-rose-450" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-white/20 dark:border-gray-700/50 pb-safe no-print">
                <div className="flex justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all cursor-pointer ${isActive
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-gray-400 dark:text-gray-500'
                                    }`}
                            >
                                <Icon size={20} />
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Main Content */}
            <main className="pb-20 md:pb-8">{children}</main>

            {/* Settings Panel */}
            <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
};
