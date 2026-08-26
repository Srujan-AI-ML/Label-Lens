import React, { useState } from 'react';
import { Scale, Settings, Home, ScanLine, Package, LogOut, User, Plus } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { PageType } from '../App';

interface LayoutProps {
    children: React.ReactNode;
    currentPage: PageType;
    onNavigate: (page: PageType) => void;
    onOpenAddModal?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, onOpenAddModal }) => {
    const [showSettings, setShowSettings] = useState(false);
    const { isDarkMode } = useTheme();
    const { user, logout } = useAuth();

    const navItems = [
        { id: 'home' as PageType, label: 'Dashboard', icon: Home },
        { id: 'scan' as PageType, label: 'Scan & Add', icon: ScanLine },
        { id: 'products' as PageType, label: 'Products', icon: Package },
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
                        <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg shadow-blue-600/30 group-hover:shadow-blue-600/50 transition-shadow">
                            <Scale size={22} className="text-white" />
                        </div>
                        <div className="text-left">
                            <h1 className="text-lg font-black bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent tracking-tight">
                                Label Lens
                            </h1>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-0.5">Scanner & Verifier</p>
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
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
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
                        {/* Add / Scan Product Button (hidden on Dashboard to prevent duplicate labels) */}
                        {currentPage !== 'home' && (
                            <button
                                onClick={() => {
                                    if (onOpenAddModal) {
                                        onOpenAddModal();
                                    } else {
                                        onNavigate('scan');
                                    }
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-full text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                            >
                                <Plus size={15} />
                                <span className="hidden sm:inline">Add / Scan Product</span>
                                <span className="sm:hidden">Add/Scan</span>
                            </button>
                        )}

                        {/* Settings Button */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full transition-colors cursor-pointer text-gray-600 dark:text-gray-300"
                            title="Preferences"
                        >
                            <Settings size={20} />
                        </button>

                        {/* User Profile & Logout */}
                        {user && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                                    <User size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                        {user.username}
                                    </span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-full transition-colors group cursor-pointer"
                                    title="Logout"
                                >
                                    <LogOut size={18} className="text-gray-500 group-hover:text-rose-600 dark:text-gray-400 dark:group-hover:text-rose-400" />
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
                                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-gray-400 dark:text-gray-500'
                                    }`}
                            >
                                <Icon size={20} />
                                <span className="text-[10px] font-medium">{item.label}</span>
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
