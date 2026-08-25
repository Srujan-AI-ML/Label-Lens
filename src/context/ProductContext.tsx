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
    const [products, setProducts] = useState<ScannedProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<ComplianceStats>({
        total: 0,
        compliant: 0,
        partiallyCompliant: 0,
        nonCompliant: 0,
        averageScore: 0
    });

    const calculateStats = (productList: ScannedProduct[]) => {
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
            sumScore += p.complianceScore;
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
    };

    const refetchProducts = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            setIsLoading(true);
            const data = await productsAPI.getAll();
            setProducts(data);
            calculateStats(data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Load products on auth change
    useEffect(() => {
        if (isAuthenticated) {
            refetchProducts();
        } else {
            setProducts([]);
            setIsLoading(false);
        }
    }, [isAuthenticated, refetchProducts]);

    const addScanResult = async (productData: Omit<ScannedProduct, 'id'>) => {
        try {
            const saved = await productsAPI.create(productData);
            setProducts(prev => {
                const next = [saved, ...prev];
                calculateStats(next);
                return next;
            });
            return saved;
        } catch (error) {
            console.error('Failed to save scan result:', error);
            throw error;
        }
    };

    const updateNotes = async (id: string, notes: string) => {
        try {
            const updated = await productsAPI.update(id, { notes });
            setProducts(prev => {
                const next = prev.map(p => p.id === id ? updated : p);
                calculateStats(next);
                return next;
            });
        } catch (error) {
            console.error('Failed to update notes:', error);
            throw error;
        }
    };

    const removeScanRecord = async (id: string) => {
        try {
            await productsAPI.delete(id);
            setProducts(prev => {
                const next = prev.filter(p => p.id !== id);
                calculateStats(next);
                return next;
            });
        } catch (error) {
            console.error('Failed to delete scan record:', error);
            throw error;
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
