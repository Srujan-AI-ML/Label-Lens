import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { Search, Filter, Trash2, Calendar, FileText, ArrowLeft, Plus, Package, ScanLine } from 'lucide-react';
import type { ScannedProduct } from '../types';
import type { PageType } from '../App';

interface RepositoryProps {
    onNavigate: (page: PageType) => void;
    onSelectProduct: (product: ScannedProduct) => void;
    onOpenAddModal?: () => void;
}

export const Repository: React.FC<RepositoryProps> = ({ onNavigate, onSelectProduct, onOpenAddModal }) => {
    const { products, removeScanRecord } = useProduct();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Compliant':
                return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50';
            case 'Partially Compliant':
                return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50';
            default:
                return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50';
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to permanently delete this product record?')) {
            try {
                await removeScanRecord(id);
            } catch (err: any) {
                alert('Failed to delete: ' + err.message);
            }
        }
    };

    // Filter logic
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (p.barcode && p.barcode.includes(searchTerm));
        const matchesStatus = statusFilter === 'All' || p.complianceStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Navigation & Return Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl text-sm font-bold shadow-sm border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Return to Dashboard
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (onOpenAddModal) onOpenAddModal();
                            else onNavigate('scan');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                        <Plus size={15} />
                        + Add / Scan Product
                    </button>
                </div>
            </div>

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-600 dark:text-indigo-400" />
                    Products & Inspections Registry
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Search, view, and retrieve previous inspections, packaging evidence, and digital compliance reports.
                </p>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by product name or barcode..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="text-gray-400 hidden sm:block" size={18} />
                    <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto justify-around">
                        {['All', 'Compliant', 'Partially Compliant', 'Non-Compliant'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    statusFilter === status
                                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {status === 'Partially Compliant' ? 'Partial' : status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List Results */}
            {filteredProducts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700/50 shadow-sm">
                    <div className="text-5xl mb-4">📦</div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">No products found</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                        Click "+ Add / Scan Product" above to scan packaging or add declarations.
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="px-6 py-4">Product Details</th>
                                    <th className="px-6 py-4">Barcode</th>
                                    <th className="px-6 py-4">Inspection Date</th>
                                    <th className="px-6 py-4">Score</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                                {filteredProducts.map((p) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => onSelectProduct(p)}
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                            <div className="w-11 h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-lg overflow-hidden shrink-0">
                                                {p.imageData ? <img src={p.imageData} alt="" className="w-full h-full object-cover" /> : '📦'}
                                            </div>
                                            <span className="truncate max-w-[220px]">{p.productName}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                                            {p.barcode || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <Calendar size={14} />
                                                {new Date(p.scannedAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-black text-gray-900 dark:text-white">
                                            {p.complianceScore}%
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(p.complianceStatus)}`}>
                                                {p.complianceStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onSelectProduct(p)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                                                    title="View Report"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, p.id)}
                                                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
