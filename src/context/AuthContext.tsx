import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI, setToken, removeToken } from '../services/api';

interface User {
    id: string;
    username: string;
    email?: string;
    picture?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    logout: () => void;
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
                setUser(JSON.parse(savedUser));
            } catch {
                // Invalid saved user, clear storage
                localStorage.removeItem('labellens-user');
                localStorage.removeItem('labellens-token');
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        const response = await authAPI.login(username, password);
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('labellens-user', JSON.stringify(response.user));
    };

    const register = async (username: string, password: string) => {
        const response = await authAPI.register(username, password);
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('labellens-user', JSON.stringify(response.user));
    };

    const loginWithGoogle = async (credential: string) => {
        const response = await authAPI.googleLogin(credential);
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('labellens-user', JSON.stringify(response.user));
    };

    const logout = () => {
        removeToken();
        setUser(null);
        localStorage.removeItem('labellens-user');
        localStorage.removeItem('label-lens-items'); // Clear old local storage items
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                loginWithGoogle,
                logout
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
