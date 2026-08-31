// API Service for backend communication
const API_BASE = '/api';

// Get auth token from localStorage
const getToken = (): string | null => {
    return localStorage.getItem('labellens-token');
};

// Set auth token
export const setToken = (token: string): void => {
    localStorage.setItem('labellens-token', token);
};

// Remove auth token
export const removeToken = (): void => {
    localStorage.removeItem('labellens-token');
};

// Generic fetch with auth
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

// Auth API
export const authAPI = {
    register: async (username: string, password: string, role?: string) => {
        return fetchWithAuth('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, role })
        });
    },

    login: async (username: string, password: string) => {
        return fetchWithAuth('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },


    googleLogin: async (credential: string, username?: string, password?: string) => {
        return fetchWithAuth('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential, username, password })
        });
    },

    updatePassword: async (password: string) => {
        return fetchWithAuth('/auth/update-password', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    }
};

// Products API
export const productsAPI = {
    getAll: async () => {
        return fetchWithAuth('/products');
    },

    create: async (product: Record<string, any>) => {
        return fetchWithAuth('/products', {
            method: 'POST',
            body: JSON.stringify(product)
        });
    },

    update: async (id: string, updates: Record<string, any>) => {
        return fetchWithAuth(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    delete: async (id: string) => {
        return fetchWithAuth(`/products/${id}`, {
            method: 'DELETE'
        });
    }
};
