import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { ShieldCheck, ShieldAlert, FileText, ArrowRight, BookOpen, Scale, Award, X, ExternalLink, Trash2, Plus } from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';
import type { PageType } from '../App';

interface DashboardProps {
    onNavigate: (page: PageType) => void;
    onSelectProduct: (product: ScannedProduct) => void;
    onOpenAddModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectProduct, onOpenAddModal }) => {
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

    const recentScans = products.slice(0, 6);

    const declarationTitles: Array<{ key: keyof ComplianceDeclarations; label: string }> = [
        { key: 'genericName', label: '1. Generic / Common Name' },
        { key: 'netQuantity', label: '2. Net Quantity (Weight/Vol/Count)' },
        { key: 'mrp', label: '3. Maximum Retail Price (MRP)' },
        { key: 'manufactureDate', label: '4. Date of Mfg / Packing' },
        { key: 'bestBefore', label: '5. Best Before / Expiry' },
        { key: 'manufacturer', label: '6. Manufacturer & Address' },
        { key: 'consumerCare', label: '7. Consumer Care Helpline' },
        { key: 'fssaiLicense', label: '8. FSSAI License No.' },
        { key: 'countryOfOrigin', label: '9. Country of Origin' },
        { key: 'retailSalePrice', label: '10. Retail Sale Unit Price' },
    ];

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Delete this product inspection record?')) {
            await removeScanRecord(id);
            if (selectedSideProduct?.id === id) {
                setSelectedSideProduct(null);
            }
        }
    };

    const handleAddClick = () => {
        if (onOpenAddModal) {
            onOpenAddModal();
        } else {
            onNavigate('scan');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Welcome Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Scale className="text-blue-600 dark:text-blue-400" />
                        Label Lens Compliance Checker
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Assess, validate and verify mandatory packaging declarations under Label Lens system rules.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleAddClick}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 transition-all text-xs sm:text-sm cursor-pointer hover:scale-105 active:scale-95"
                    >
                        <Plus size={18} />
                        Add New Product / Scan
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Scanned</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fully Compliant</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.compliant}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Non-Compliant</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.nonCompliant}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <Award size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Avg. Compliance</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.averageScore}%</p>
                    </div>
                </div>
            </div>

            {/* Legal Metrology Enforcement Action Summary Strip */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 mb-10 text-white shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-white/10">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-blue-300">
                            Legal Metrology Enforcement Workflow Status
                        </h3>
                        <p className="text-xs text-gray-300 mt-0.5">
                            Real-time tracking of statutory notices, compounding fines, and court prosecutions
                        </p>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full">
                        Section 36 & 48 LM Act
                    </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[11px] font-bold text-gray-300">Audited Pool</p>
                        <p className="text-xl font-black text-white mt-1">
                            {products.filter(p => !p.enforcementStatus || p.enforcementStatus === 'AUDITED').length}
                        </p>
                        <span className="text-[10px] text-gray-400">Initial inspections</span>
                    </div>

                    <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/30">
                        <p className="text-[11px] font-bold text-amber-300">Notices Issued</p>
                        <p className="text-xl font-black text-amber-300 mt-1">
                            {products.filter(p => p.enforcementStatus === 'NOTICE_ISSUED').length}
                        </p>
                        <span className="text-[10px] text-amber-400/80">Show-cause dispatched</span>
                    </div>

                    <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/30">
                        <p className="text-[11px] font-bold text-purple-300">Compounded Cases</p>
                        <p className="text-xl font-black text-purple-300 mt-1">
                            {products.filter(p => p.enforcementStatus === 'COMPOUNDED').length}
                        </p>
                        <span className="text-[10px] text-purple-400/80">Section 48 fines paid</span>
                    </div>

                    <div className="p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/30">
                        <p className="text-[11px] font-bold text-rose-300">Prosecutions Filed</p>
                        <p className="text-xl font-black text-rose-300 mt-1">
                            {products.filter(p => p.enforcementStatus === 'PROSECUTION_FILED').length}
                        </p>
                        <span className="text-[10px] text-rose-400/80">Court proceedings</span>
                    </div>
                </div>
            </div>


            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Columns - Recent Inspections */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Inspections</h2>
                            <button
                                onClick={() => onNavigate('products')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
                            >
                                View All Products
                                <ArrowRight size={14} />
                            </button>
                        </div>

                        {recentScans.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="text-5xl mb-3">📦</div>
                                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">No scanned products yet</h3>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-sm">
                                    Click <strong>"+ Add New Product / Scan"</strong> above to scan packaging or enter details.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3.5">
                                {recentScans.map((p) => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedSideProduct(p)}
                                        className={`flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer border ${
                                            selectedSideProduct?.id === p.id
                                                ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 shadow-md ring-2 ring-blue-500/20'
                                                : 'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 border-transparent hover:border-gray-200 dark:hover:border-gray-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-xl shrink-0 overflow-hidden shadow-sm">
                                                {p.imageData ? (
                                                    <img src={p.imageData} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    '📦'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                                                    {p.productName}
                                                </h3>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                    Barcode: <span className="font-mono">{p.barcode || 'N/A'}</span> • {new Date(p.scannedAt).toLocaleDateString()}
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
                                                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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
                                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-gray-100 dark:border-gray-700">
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                            Selected Inspection Box
                                        </span>
                                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                                            {selectedSideProduct.productName}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSideProduct(null)}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full cursor-pointer text-gray-400 hover:text-gray-600"
                                        title="Close side box"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Score Header */}
                                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl mb-3.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400">Score</p>
                                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                                            {selectedSideProduct.complianceScore}%
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onSelectProduct(selectedSideProduct)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                                    >
                                        Full Report
                                        <ExternalLink size={12} />
                                    </button>
                                </div>

                                {/* Rules 2011 Checklist with Green / Red Ticks */}
                                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
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
                                                        className="w-3.5 h-3.5 rounded text-blue-600 cursor-default"
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
                                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
                                    Label Lens Rules Reference
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    Click on any scanned item to open its compliance side box and verification checkmarks.
                                </p>
                                <div className="space-y-2">
                                    {[
                                        { title: '1. Product Identity', desc: 'Generic or common name' },
                                        { title: '2. Net Quantity', desc: 'Standard weight/vol/count' },
                                        { title: '3. Date of Mfg', desc: 'Month & year of packing' },
                                        { title: '4. MRP', desc: 'Price inclusive of all taxes' },
                                        { title: '5. Manufacturer Address', desc: 'Full physical address' },
                                        { title: '6. Consumer Care', desc: 'Phone helpline and email' },
                                        { title: '7. Country of Origin', desc: 'Mandatory for imports' },
                                    ].map((rule, idx) => (
                                        <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
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
