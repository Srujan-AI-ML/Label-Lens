import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ScannedProduct, ComplianceStats } from '../types';
import { productsAPI } from '../services/api';
import { useAuth } from './AuthContext';

type ProductContextType = {
    products: ScannedProduct[];
    isLoading: boolean;
    stats: ComplianceStats;
    addScanResult: (product: Omit<ScannedProduct, 'id'>) => Promise<ScannedProduct>;
    updateNotes: (id: string, notes: string) => Promise<void>;
    removeScanRecord: (id: string) => Promise<void>;
    refetchProducts: () => Promise<void>;
};

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const [products, setProducts] = useState<ScannedProduct[]>(() => {
        const cached = localStorage.getItem('lm-scanned-products');
        if (cached) {
            try { return JSON.parse(cached); } catch { }
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [stats, setStats] = useState<ComplianceStats>({
        total: 0,
        compliant: 0,
        partiallyCompliant: 0,
        nonCompliant: 0,
        averageScore: 0
    });

    const calculateStats = useCallback((productList: ScannedProduct[]) => {
        const total = productList.length;
        if (total === 0) {
            setStats({ total: 0, compliant: 0, partiallyCompliant: 0, nonCompliant: 0, averageScore: 0 });
            return;
        }

        let compliant = 0;
        let partiallyCompliant = 0;
        let nonCompliant = 0;
        let sumScore = 0;

        productList.forEach(p => {
            sumScore += (p.complianceScore || 0);
            if (p.complianceStatus === 'Compliant') compliant++;
            else if (p.complianceStatus === 'Partially Compliant') partiallyCompliant++;
            else if (p.complianceStatus === 'Non-Compliant') nonCompliant++;
        });

        setStats({
            total,
            compliant,
            partiallyCompliant,
            nonCompliant,
            averageScore: Math.round(sumScore / total)
        });
    }, []);

    // Sync localStorage whenever products state updates
    useEffect(() => {
        calculateStats(products);
        localStorage.setItem('lm-scanned-products', JSON.stringify(products));
    }, [products, calculateStats]);

    const refetchProducts = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await productsAPI.getAll();
            if (Array.isArray(data)) {
                setProducts(data);
            }
        } catch (error) {
            console.error('Background fetch products warning:', error);
        }
    }, [isAuthenticated]);

    // Background fetch on auth
    useEffect(() => {
        if (isAuthenticated) {
            refetchProducts();
        } else {
            setProducts([]);
        }
    }, [isAuthenticated, refetchProducts]);

    const addScanResult = async (productData: Omit<ScannedProduct, 'id'>) => {
        // Optimistic local add
        const tempId = 'temp-' + Date.now();
        const optimisticProduct: ScannedProduct = { ...productData, id: tempId };
        
        setProducts(prev => [optimisticProduct, ...prev]);

        try {
            const saved = await productsAPI.create(productData);
            setProducts(prev => prev.map(p => p.id === tempId ? saved : p));
            return saved;
        } catch (error) {
            console.warn('API save failed, keeping offline scan:', error);
            return optimisticProduct;
        }
    };

    const updateNotes = async (id: string, notes: string) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, notes } : p));
        try {
            if (!id.startsWith('temp-')) {
                await productsAPI.update(id, { notes });
            }
        } catch (error) {
            console.error('Failed to update notes on server:', error);
        }
    };

    const removeScanRecord = async (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        try {
            if (!id.startsWith('temp-')) {
                await productsAPI.delete(id);
            }
        } catch (error) {
            console.error('Failed to delete scan record on server:', error);
        }
    };

    return (
        <ProductContext.Provider
            value={{
                products,
                isLoading,
                stats,
                addScanResult,
                updateNotes,
                removeScanRecord,
                refetchProducts
            }}
        >
            {children}
        </ProductContext.Provider>
    );
};

export const useProduct = () => {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProduct must be used within a ProductProvider');
    }
    return context;
};
