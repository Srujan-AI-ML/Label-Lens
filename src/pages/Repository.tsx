import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { Search, Filter, Trash2, Calendar, FileText, ArrowLeft, Package, Edit2, FileDown } from 'lucide-react';
import type { ScannedProduct } from '../types';
import type { PageType } from '../App';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ALL_CATEGORIES, normalizeCategory } from '../services/categoryRequirements';
import { exportComplianceReportDOCX, exportProductsRegistryDOCX } from '../services/reportService';

interface RepositoryProps {
    onNavigate: (page: PageType) => void;
    onSelectProduct: (product: ScannedProduct) => void;
    onOpenAddModal?: () => void;
}

export const Repository: React.FC<RepositoryProps> = ({ onNavigate, onSelectProduct, onOpenAddModal: _onOpenAddModal }) => {
    const { products, removeScanRecord } = useProduct();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');

    const handleDownloadSummary = () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Set Title & Metadata
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(29, 78, 216); // Blue-700
            doc.text('Label Lens', 14, 20);
            
            doc.setFontSize(13);
            doc.setTextColor(75, 85, 99);
            doc.text('Product Inspections Registry Summary', 14, 28);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
            doc.text(`Total Records Listed: ${filteredProducts.length}`, 14, 39);

            // Table headers and rows
            const tableHeaders = [['Product Name', 'Category', 'Compliance Status', 'Score', 'Rule Violations & Non-Compliance Causes']];
            const tableRows = filteredProducts.map(p => {
                const statusText = p.complianceStatus;
                const scoreText = `${p.complianceScore}%`;
                const catText = normalizeCategory(p.category);
                const violationsText = p.violations && p.violations.length > 0
                    ? p.violations.map((v, idx) => `${idx + 1}. [${v.severity.toUpperCase()}] ${v.label}: ${v.message}`).join('\n')
                    : 'None (Complies fully with all declarations)';

                return [
                    p.productName,
                    catText,
                    statusText,
                    scoreText,
                    violationsText
                ];
            });

            autoTable(doc, {
                startY: 45,
                head: tableHeaders,
                body: tableRows,
                theme: 'striped',
                headStyles: {
                    fillColor: [29, 78, 216], // Blue-700
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8.5
                },
                bodyStyles: {
                    fontSize: 7.5,
                    valign: 'top'
                },
                columnStyles: {
                    0: { cellWidth: 38 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 72 }
                },
                didDrawPage: (data) => {
                    doc.setFontSize(8);
                    doc.setTextColor(156, 163, 175);
                    doc.text(
                        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
                        doc.internal.pageSize.width - 25,
                        doc.internal.pageSize.height - 10
                    );
                }
            });

            doc.save(`Label_Lens_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err: any) {
            console.error('Error generating PDF summary:', err);
            alert('Failed to generate summary PDF: ' + err.message);
        }
    };

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

    const handleDownloadDocxDirect = async (e: React.MouseEvent, product: ScannedProduct) => {
        e.stopPropagation();
        try {
            await exportComplianceReportDOCX(product);
        } catch (err: any) {
            alert('Failed to generate DOCX report: ' + err.message);
        }
    };

    const handleDownloadDocxSummary = async () => {
        try {
            await exportProductsRegistryDOCX(filteredProducts, filteredProducts.length !== products.length);
        } catch (err: any) {
            console.error('Error generating DOCX summary:', err);
            alert('Failed to generate DOCX summary: ' + (err.message || 'Unknown error'));
        }
    };

    // Filter logic
    const filteredProducts = products.filter(p => {
        const cat = normalizeCategory(p.category);
        const matchesSearch = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (p.barcode && p.barcode.includes(searchTerm)) ||
                             cat.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.complianceStatus === statusFilter;
        const matchesCategory = categoryFilter === 'All' || cat === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
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
            </div>

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="text-blue-600 dark:text-blue-400" />
                    Label Lens Product Registry
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Search, view, and retrieve category-specific inspections, packaging evidence, and digital compliance reports.
                </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm mb-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by product name, barcode, or category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-400 shrink-0" size={18} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Compliant">Compliant</option>
                            <option value="Partially Compliant">Partially Compliant</option>
                            <option value="Non-Compliant">Non-Compliant</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 focus:outline-none"
                        >
                            <option value="All">All Categories</option>
                            {ALL_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                    <button
                        onClick={handleDownloadSummary}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors cursor-pointer border border-blue-200/60 dark:border-blue-900/40"
                        title="Download summary of products as PDF"
                    >
                        <FileDown size={15} />
                        Download PDF ({filteredProducts.length})
                    </button>
                    <button
                        onClick={handleDownloadDocxSummary}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer border border-indigo-200/60 dark:border-indigo-900/40"
                        title="Download entire products dataset as editable Microsoft Word DOCX"
                    >
                        <FileDown size={15} />
                        Download Editable DOCX ({filteredProducts.length})
                    </button>
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
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Barcode</th>
                                    <th className="px-6 py-4">Inspection Date</th>
                                    <th className="px-6 py-4">Score</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
                                {filteredProducts.map((p) => {
                                    const cat = normalizeCategory(p.category);
                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => onSelectProduct(p)}
                                            className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                                <div className="w-11 h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center text-lg overflow-hidden shrink-0">
                                                    {p.imageData ? <img src={p.imageData} alt="" className="w-full h-full object-cover" /> : '📦'}
                                                </div>
                                                <span className="truncate max-w-[200px]">{p.productName}</span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                {cat}
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
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => onSelectProduct(p)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                                                        title="View Certificate"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDownloadDocxDirect(e, p)}
                                                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                                                        title="Download Editable DOCX Report"
                                                    >
                                                        <FileDown size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => onSelectProduct(p)}
                                                        className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                                                        title="Edit Product"
                                                    >
                                                        <Edit2 size={16} />
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
