import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI, setToken, removeToken } from '../services/api';
import type { UserRole, UserProfile } from '../types';

export interface User extends UserProfile {}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    role: UserRole;
    isAdmin: boolean;
    isEnforcementOfficer: boolean;
    isInspector: boolean;
    isMerchant: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, role?: UserRole) => Promise<void>;
    loginWithGoogle: (credential: string, setSessionImmediately?: boolean, username?: string, password?: string) => Promise<any>;
    completeGoogleLogin: (token: string, user: User) => void;
    logout: () => void;
    updatePassword: (password: string) => Promise<void>;
    switchRole: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('labellens-user');
        const token = localStorage.getItem('labellens-token');

        if (savedUser && token) {
            try {
                const parsed = JSON.parse(savedUser);
                if (!parsed.role) parsed.role = 'INSPECTOR';
                setUser(parsed);
            } catch {
                // Invalid saved user, clear storage
                localStorage.removeItem('labellens-user');
                localStorage.removeItem('labellens-token');
            }
        }
        setIsLoading(false);
    }, []);

    const role: UserRole = user?.role || 'INSPECTOR';
    const isAdmin = role === 'ADMIN';
    const isEnforcementOfficer = role === 'ENFORCEMENT_OFFICER' || role === 'ADMIN';
    const isInspector = role === 'INSPECTOR' || role === 'ENFORCEMENT_OFFICER' || role === 'ADMIN';
    const isMerchant = role === 'MERCHANT';

    const login = async (username: string, password: string) => {
        const response = await authAPI.login(username, password);
        setToken(response.token);
        const userWithRole: User = {
            id: response.user.id,
            username: response.user.username,
            role: response.user.role || (response.user.username?.toLowerCase() === 'admin' ? 'ADMIN' : 'INSPECTOR'),
            email: response.user.email,
            picture: response.user.picture
        };
        setUser(userWithRole);
        localStorage.setItem('labellens-user', JSON.stringify(userWithRole));
    };

    const register = async (username: string, password: string, requestedRole?: UserRole) => {
        const response = await authAPI.register(username, password, requestedRole);
        setToken(response.token);
        const userWithRole: User = {
            id: response.user.id,
            username: response.user.username,
            role: response.user.role || requestedRole || 'INSPECTOR',
            email: response.user.email,
            picture: response.user.picture
        };
        setUser(userWithRole);
        localStorage.setItem('labellens-user', JSON.stringify(userWithRole));
    };

    const loginWithGoogle = async (credential: string, setSessionImmediately = true, username?: string, password?: string) => {
        const response = await authAPI.googleLogin(credential, username, password);
        if (setSessionImmediately && !response.signupRequired) {
            setToken(response.token);
            const userWithRole: User = {
                id: response.user.id,
                username: response.user.username,
                role: response.user.role || 'INSPECTOR',
                email: response.user.email,
                picture: response.user.picture
            };
            setUser(userWithRole);
            localStorage.setItem('labellens-user', JSON.stringify(userWithRole));
        }
        return response;
    };

    const completeGoogleLogin = (token: string, userVal: User) => {
        setToken(token);
        const userWithRole: User = {
            ...userVal,
            role: userVal.role || 'INSPECTOR'
        };
        setUser(userWithRole);
        localStorage.setItem('labellens-user', JSON.stringify(userWithRole));
    };

    const switchRole = (newRole: UserRole) => {
        if (!user) return;
        const updated = { ...user, role: newRole };
        setUser(updated);
        localStorage.setItem('labellens-user', JSON.stringify(updated));
    };

    const updatePassword = async (password: string) => {
        await authAPI.updatePassword(password);
    };

    const logout = () => {
        removeToken();
        setUser(null);
        localStorage.removeItem('labellens-user');
        localStorage.removeItem('label-lens-items');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                role,
                isAdmin,
                isEnforcementOfficer,
                isInspector,
                isMerchant,
                login,
                register,
                loginWithGoogle,
                completeGoogleLogin,
                logout,
                updatePassword,
                switchRole
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

