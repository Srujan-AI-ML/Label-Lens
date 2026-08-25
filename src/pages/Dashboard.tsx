import React from 'react';
import { useProduct } from '../context/ProductContext';
import { ShieldCheck, ShieldAlert, FileText, Activity, ArrowRight, BookOpen, Scale, Award } from 'lucide-react';
import type { ScannedProduct } from '../types';

interface DashboardProps {
    onNavigate: (page: 'home' | 'scan' | 'repository') => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectProduct }) => {
    const { products, stats, isLoading } = useProduct();

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

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
                <button
                    onClick={() => onNavigate('scan')}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/35 transition-all text-sm self-start md:self-auto cursor-pointer"
                >
                    <Activity size={16} />
                    Start Compliance Scan
                </button>
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
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
                                    Upload label photos or scan packaging to check compliance and build your database.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentScans.map((p) => (
                                    <div
                                        key={p.id}
                                        onClick={() => onSelectProduct(p)}
                                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800"
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Legal Metrology Rules Checklist */}
                <div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Rules, 2011 Checklist
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            All packaged commodities sold in India must bear the following declarations:
                        </p>
                        <div className="space-y-3">
                            {[
                                { title: '1. Product Identity', desc: 'Generic or common name of the commodity.' },
                                { title: '2. Net Quantity', desc: 'Standard weight, volume, or count of product.' },
                                { title: '3. Date of Manufacture', desc: 'Month and year of manufacture/import.' },
                                { title: '4. Maximum Retail Price', desc: 'MRP inclusive of all taxes.' },
                                { title: '5. Manufacturer / Packer Details', desc: 'Name and complete physical address.' },
                                { title: '6. Customer Care Contact', desc: 'Helpline telephone number and email.' },
                                { title: '7. Unit Sale Price', desc: 'Per-gram/ml price calculation details.' },
                                { title: '8. Country of Origin', desc: 'Declared for all imported commodities.' },
                            ].map((rule, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">{rule.title}</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{rule.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
