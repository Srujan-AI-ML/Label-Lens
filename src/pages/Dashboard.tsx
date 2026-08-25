import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { ShieldCheck, ShieldAlert, FileText, Activity, ArrowRight, BookOpen, Scale, Award, X, ExternalLink, Trash2 } from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';

interface DashboardProps {
    onNavigate: (page: 'home' | 'scan' | 'repository') => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectProduct }) => {
    const { products, stats, removeScanRecord } = useProduct();
    const [selectedSideProduct, setSelectedSideProduct] = useState<ScannedProduct | null>(null);

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

    const recentScans = products.slice(0, 5);

    const declarationTitles: Array<{ key: keyof ComplianceDeclarations; label: string }> = [
        { key: 'genericName', label: 'Generic / Common Name' },
        { key: 'netQuantity', label: 'Net Quantity' },
        { key: 'mrp', label: 'Maximum Retail Price (MRP)' },
        { key: 'manufactureDate', label: 'Date of Mfg / Packing' },
        { key: 'bestBefore', label: 'Best Before / Expiry' },
        { key: 'manufacturer', label: 'Manufacturer & Address' },
        { key: 'consumerCare', label: 'Consumer Care Helpline' },
        { key: 'fssaiLicense', label: 'FSSAI License No.' },
        { key: 'countryOfOrigin', label: 'Country of Origin' },
        { key: 'retailSalePrice', label: 'Retail Sale Unit Price' },
    ];

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Delete this inspection record?')) {
            await removeScanRecord(id);
            if (selectedSideProduct?.id === id) {
                setSelectedSideProduct(null);
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Welcome Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Scale className="text-indigo-600 dark:text-indigo-400" />
                        Legal Metrology Compliance Checker
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Assess, validate and verify mandatory declarations under Legal Metrology Rules, 2011.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onNavigate('scan')}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/35 transition-all text-sm cursor-pointer"
                    >
                        <Activity size={16} />
                        + Start New Scan / Add Product
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total Scanned</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Fully Compliant</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.compliant}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Non-Compliant</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.nonCompliant}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-2xl">
                        <Award size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Avg. Compliance Score</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.averageScore}%</p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Columns - Recent Inspections */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Inspections</h2>
                            <button
                                onClick={() => onNavigate('repository')}
                                className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                            >
                                View All Scans
                                <ArrowRight size={14} />
                            </button>
                        </div>

                        {recentScans.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="text-5xl mb-3">📁</div>
                                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No scanned products yet</h3>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-sm">
                                    Click <strong>"+ Start New Scan / Add Product"</strong> above to scan packaging or enter details.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentScans.map((p) => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedSideProduct(p)}
                                        className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer border ${
                                            selectedSideProduct?.id === p.id
                                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 border-transparent hover:border-gray-200 dark:hover:border-gray-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-xl shrink-0 overflow-hidden">
                                                {p.imageData ? (
                                                    <img src={p.imageData} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    '📦'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white truncate">
                                                    {p.productName}
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    Scanned on {new Date(p.scannedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(p.complianceStatus)}`}>
                                                {p.complianceStatus}
                                            </span>
                                            <span className="text-sm font-black text-gray-900 dark:text-white">
                                                {p.complianceScore}%
                                            </span>
                                            <button
                                                onClick={(e) => handleDelete(e, p.id)}
                                                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Side Box for Selected Product / General Checklist */}
                <div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 sticky top-20">
                        {selectedSideProduct ? (
                            <div>
                                <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                            Inspected Item
                                        </span>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                                            {selectedSideProduct.productName}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSideProduct(null)}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full cursor-pointer text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Score Header */}
                                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl mb-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                            {selectedSideProduct.complianceScore}%
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onSelectProduct(selectedSideProduct)}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                                    >
                                        Full Report
                                        <ExternalLink size={12} />
                                    </button>
                                </div>

                                {/* Rules 2011 Checklist with Green / Red Ticks */}
                                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                    Rules, 2011 Checklist
                                </h4>

                                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                    {declarationTitles.map(({ key, label }) => {
                                        const isCompliant = selectedSideProduct.declarations[key]?.present;
                                        return (
                                            <div
                                                key={key}
                                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                                                    isCompliant
                                                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-300'
                                                        : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30 text-rose-900 dark:text-rose-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isCompliant}
                                                        readOnly
                                                        className="w-4 h-4 rounded text-indigo-600 cursor-default"
                                                    />
                                                    <span className="font-semibold truncate text-[11px]">
                                                        {label}
                                                    </span>
                                                </div>

                                                <span className="font-bold shrink-0 text-[11px]">
                                                    {isCompliant ? '✔️ Pass' : '❌ Fail'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                                    LM Rules 2011 Reference
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                    Select any scanned product on the left to see its Legal Metrology rules checklist.
                                </p>
                                <div className="space-y-2.5">
                                    {[
                                        { title: '1. Product Identity', desc: 'Generic or common name' },
                                        { title: '2. Net Quantity', desc: 'Standard weight/vol/count' },
                                        { title: '3. Date of Mfg', desc: 'Month & year of packing' },
                                        { title: '4. MRP', desc: 'Price inclusive of all taxes' },
                                        { title: '5. Manufacturer Address', desc: 'Full physical address' },
                                        { title: '6. Consumer Care', desc: 'Phone helpline and email' },
                                        { title: '7. Country of Origin', desc: 'Mandatory for imports' },
                                    ].map((rule, idx) => (
                                        <div key={idx} className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white">{rule.title}</h4>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{rule.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
