import React, { useState, useEffect, useMemo } from 'react';
import type { ScannedProduct } from '../types';
import { useProduct } from '../context/ProductContext';
import { ArrowLeft, AlertTriangle, Printer, Edit2, FileDown, Save, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { analyseCompliance, calculateUnitSalePrice } from '../services/complianceService';
import {
    ALL_CATEGORIES,
    CATEGORY_REQUIREMENTS,
    normalizeCategory,
    validateBarcodeGTIN,
    validateFSSAI,
    validateCategoryLicense,
    type ProductCategory,
} from '../services/categoryRequirements';
import {
    buildUnifiedReportData,
    exportComplianceReportPDF,
    exportComplianceReportDOCX,
} from '../services/reportService';

interface ReportDetailProps {
    product: ScannedProduct;
    onBack: () => void;
}

export const ReportDetail: React.FC<ReportDetailProps> = ({ product, onBack }) => {
    const { updateNotes, updateProduct } = useProduct();
    const [currentProduct, setCurrentProduct] = useState<ScannedProduct>(product);
    
    // Notes state
    const [notes, setNotes] = useState(product.notes || '');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Full Product Edit Modal state
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);

    // Edit form fields
    const [editProductName, setEditProductName] = useState('');
    const [editBarcode, setEditBarcode] = useState('');
    const [editMrp, setEditMrp] = useState('');
    const [editNetQuantity, setEditNetQuantity] = useState('');
    const [editQuantityUnit, setEditQuantityUnit] = useState('g');
    const [editMfgDate, setEditMfgDate] = useState('');
    const [editExpiryDate, setEditExpiryDate] = useState('');
    const [editManufacturer, setEditManufacturer] = useState('');
    const [editConsumerCare, setEditConsumerCare] = useState('');
    const [editFssaiLicense, setEditFssaiLicense] = useState('');
    const [editRegulatoryLicense, setEditRegulatoryLicense] = useState('');
    const [editCountryOfOrigin, setEditCountryOfOrigin] = useState('India');
    const [editUnitPrice, setEditUnitPrice] = useState('');
    const [editCategory, setEditCategory] = useState<ProductCategory>('Food & Beverage');
    const [editNotes, setEditNotes] = useState('');

    const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

    useEffect(() => {
        setCurrentProduct(product);
        setNotes(product.notes || '');
    }, [product]);

    const resolvedCategory = useMemo(() => {
        return normalizeCategory(currentProduct.category);
    }, [currentProduct.category]);

    const unifiedReport = useMemo(() => {
        return buildUnifiedReportData(currentProduct);
    }, [currentProduct]);

    const editCategorySpec = useMemo(() => {
        return CATEGORY_REQUIREMENTS[editCategory] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];
    }, [editCategory]);

    const openEditModal = () => {
        const p = currentProduct;
        setEditProductName(p.productName || '');
        setEditBarcode(p.barcode || '');
        
        const rawMrp = p.mrp || p.declarations?.mrp?.value || '';
        const cleanMrp = rawMrp ? rawMrp.replace(/^[^\d.]*/, '').trim() : '';
        setEditMrp(cleanMrp);

        const rawQty = p.declarations?.netQuantity?.value || '';
        const qtyMatch = rawQty.match(/^([\d.]+)\s*([a-zA-Z]+)?/);
        if (qtyMatch) {
            setEditNetQuantity(qtyMatch[1] || '');
            setEditQuantityUnit(qtyMatch[2] || 'g');
        } else {
            setEditNetQuantity(rawQty);
            setEditQuantityUnit('g');
        }

        setEditMfgDate(p.declarations?.manufactureDate?.value || '');
        setEditExpiryDate(p.declarations?.bestBefore?.value || '');
        setEditManufacturer(p.declarations?.manufacturer?.value || '');
        setEditConsumerCare(p.declarations?.consumerCare?.value || '');
        
        const licVal = p.declarations?.fssaiLicense?.value || p.regulatoryLicense || '';
        setEditFssaiLicense(licVal);
        setEditRegulatoryLicense(licVal);
        
        setEditCountryOfOrigin(p.declarations?.countryOfOrigin?.value || 'India');
        setEditUnitPrice(p.declarations?.retailSalePrice?.value || '');
        setEditCategory(normalizeCategory(p.category));
        setEditNotes(p.notes || '');

        setIsEditingProduct(true);
    };

    const handleEditMrpChange = (val: string) => {
        setEditMrp(val);
        const calculated = calculateUnitSalePrice(val, editNetQuantity, editQuantityUnit);
        if (calculated) {
            setEditUnitPrice(calculated);
        } else if (!val.trim()) {
            setEditUnitPrice('');
        }
    };

    const handleEditQuantityChange = (val: string) => {
        setEditNetQuantity(val);
        const calculated = calculateUnitSalePrice(editMrp, val, editQuantityUnit);
        if (calculated) {
            setEditUnitPrice(calculated);
        } else if (!val.trim()) {
            setEditUnitPrice('');
        }
    };

    const handleEditQuantityUnitChange = (val: string) => {
        setEditQuantityUnit(val);
        const calculated = calculateUnitSalePrice(editMrp, editNetQuantity, val);
        if (calculated) {
            setEditUnitPrice(calculated);
        }
    };

    const handleEditCategoryChange = (newCat: ProductCategory) => {
        setEditCategory(newCat);
        if (newCat === 'Food & Beverage') {
            if (!editFssaiLicense && editRegulatoryLicense) {
                setEditFssaiLicense(editRegulatoryLicense);
            }
        } else {
            if (!editRegulatoryLicense && editFssaiLicense) {
                setEditRegulatoryLicense(editFssaiLicense);
            }
        }
    };

    const handleSaveProductEdit = async () => {
        setIsSavingProduct(true);
        try {
            const synth = [
                editProductName ? `Product: ${editProductName.trim()}` : '',
                editManufacturer ? `Manufactured by: ${editManufacturer.trim()}` : '',
                editNetQuantity ? `Net Quantity: ${editNetQuantity.trim()} ${editQuantityUnit}` : '',
                editMrp ? `MRP: Rs. ${editMrp.trim()} (incl. of all taxes)` : '',
                editMfgDate ? `Mfg Date: ${editMfgDate.trim()}` : '',
                editExpiryDate ? `Best Before: ${editExpiryDate.trim()}` : '',
                editConsumerCare ? `Consumer Care: ${editConsumerCare.trim()}` : '',
                editCategory === 'Food & Beverage' && editFssaiLicense ? `FSSAI Lic No: ${editFssaiLicense.trim()}` : '',
                editCategory !== 'Food & Beverage' && editRegulatoryLicense ? `${editCategorySpec.regulatoryField.label}: ${editRegulatoryLicense.trim()}` : '',
                editCountryOfOrigin ? `Country of Origin: ${editCountryOfOrigin.trim()}` : '',
                editUnitPrice ? `Unit Sale Price: ${editUnitPrice.trim()}` : ''
            ].filter(Boolean).join('\n');

            const { declarations, violations, complianceScore, complianceStatus } = analyseCompliance(
                synth || currentProduct.rawExtractedText || '',
                {
                    productName: editProductName.trim() || 'Inspected Commodity',
                    mrp: editMrp.trim(),
                    netQuantity: editNetQuantity.trim(),
                    quantityUnit: editQuantityUnit,
                    manufactureDate: editMfgDate.trim(),
                    expiryDate: editExpiryDate.trim(),
                    manufacturer: editManufacturer.trim(),
                    consumerCare: editConsumerCare.trim(),
                    fssaiLicense: editCategory === 'Food & Beverage' ? editFssaiLicense.trim() : undefined,
                    regulatoryLicense: editCategory !== 'Food & Beverage' ? editRegulatoryLicense.trim() : undefined,
                    countryOfOrigin: editCountryOfOrigin.trim(),
                    unitPrice: editUnitPrice.trim(),
                    category: editCategory
                },
                editCategory
            );

            const mrpToSave = editMrp.trim()
                ? (editMrp.trim().startsWith('₹') ? editMrp.trim() : `₹${editMrp.trim().replace(/[^\d.,]/g, '')}`)
                : undefined;

            const updatedRecord: Partial<ScannedProduct> = {
                productName: editProductName.trim() || 'Inspected Commodity',
                barcode: editBarcode.trim() || undefined,
                mrp: mrpToSave,
                category: editCategory,
                notes: editNotes.trim() || undefined,
                regulatoryLicense: editCategory === 'Food & Beverage' ? editFssaiLicense.trim() : editRegulatoryLicense.trim(),
                declarations,
                violations,
                complianceScore,
                complianceStatus,
                rawExtractedText: synth || currentProduct.rawExtractedText || ''
            };

            const saved = await updateProduct(currentProduct.id, updatedRecord);
            setCurrentProduct(saved);
            setNotes(saved.notes || '');
            setIsEditingProduct(false);
        } catch (error: any) {
            alert('Failed to save product changes: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSavingProduct(false);
        }
    };

    const getStatusHeaderColor = (status: string) => {
        switch (status) {
            case 'Compliant':
                return 'from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 text-white';
            case 'Partially Compliant':
                return 'from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 text-white';
            default:
                return 'from-rose-500 to-red-600 dark:from-rose-600 dark:to-red-700 text-white';
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            await updateNotes(currentProduct.id, notes);
            setIsEditingNotes(false);
        } catch (error) {
            alert('Failed to save notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        try {
            exportComplianceReportPDF(currentProduct);
        } catch (err: any) {
            console.error('Failed to generate PDF:', err);
            alert('Failed to generate PDF: ' + err.message);
        }
    };

    const handleDownloadDOCX = async () => {
        setIsGeneratingDocx(true);
        try {
            await exportComplianceReportDOCX(currentProduct);
        } catch (err: any) {
            console.error('Failed to generate DOCX report:', err);
            alert('Failed to generate DOCX report: ' + err.message);
        } finally {
            setIsGeneratingDocx(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 printable-report">
            {/* Top Navigation Bar with Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl text-sm font-bold shadow-sm border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Return to Dashboard
                </button>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={openEditModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                    >
                        <Edit2 size={16} />
                        Edit Product
                    </button>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                    >
                        <Printer size={16} />
                        Print Certificate
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                        title="Download standard non-editable PDF certificate"
                    >
                        <FileDown size={16} />
                        Download PDF Certificate
                    </button>
                    <button
                        onClick={handleDownloadDOCX}
                        disabled={isGeneratingDocx}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                        title="Download real editable Microsoft Word .docx report"
                    >
                        <FileText size={16} />
                        {isGeneratingDocx ? 'Generating Word Doc...' : 'Download Editable Report (.DOCX)'}
                    </button>
                </div>
            </div>

            {/* Certificate Header Banner */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-lg">
                <div className={`p-8 bg-gradient-to-r ${getStatusHeaderColor(currentProduct.complianceStatus)} flex flex-col sm:flex-row sm:items-center justify-between gap-6`}>
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                            Official Label Lens Inspection Certificate
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black mt-2">{currentProduct.productName}</h1>
                        <p className="text-xs text-white/80 mt-1">
                            Inspection ID: {currentProduct.id} • Date: {new Date(currentProduct.scannedAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="text-center sm:text-right">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-white/80">Compliance Score</p>
                        <p className="text-5xl font-black mt-1">{currentProduct.complianceScore}%</p>
                        <p className="text-sm font-bold mt-1 bg-white/20 px-3 py-1 rounded-full inline-block">
                            {currentProduct.complianceStatus}
                        </p>
                    </div>
                </div>

                <div className="p-8">
                    {/* Metadata Summary Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700/50">
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Product Barcode</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white mt-1 block">
                                {currentProduct.barcode || 'Not Detected'}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                {unifiedReport.barcodeValidationText}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">MRP (Price)</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                                {currentProduct.mrp || currentProduct.declarations?.mrp?.value || 'Not Set'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Product Category</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                                {resolvedCategory}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Statutory Framework</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1 block">
                                {unifiedReport.legalAct}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                        {/* Packaging Photo Preview */}
                        <div className="lg:col-span-1">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Packaging Photo Evidence</h3>
                            <div className="w-full h-72 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex items-center justify-center text-5xl">
                                {currentProduct.imageData ? (
                                    <img src={currentProduct.imageData} alt="Product label photo" className="w-full h-full object-contain bg-black" />
                                ) : (
                                    '📦'
                                )}
                            </div>
                        </div>

                        {/* Category-Aware Declarations Audit Checklist */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">
                                    Declarations Audit Checklist ({resolvedCategory})
                                </h3>
                                <button
                                    onClick={openEditModal}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit2 size={12} /> Edit Details
                                </button>
                            </div>
                            <div className="space-y-2.5">
                                {unifiedReport.checklist.map((item, idx) => {
                                    const isPass = item.status === 'PASS';
                                    const isNotApp = item.status === 'NOT APPLICABLE';

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-all ${
                                                isNotApp
                                                    ? 'bg-gray-50/60 dark:bg-gray-900/30 border-gray-200/50 dark:border-gray-800 text-gray-400'
                                                    : isPass
                                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30'
                                                    : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.field}</h4>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                        isNotApp
                                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                            : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                        {item.requirement}
                                                    </span>
                                                </div>
                                                
                                                {item.value && item.value !== 'N/A' && (
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700 px-2.5 py-1 rounded-lg mt-1.5 inline-block max-w-full truncate">
                                                        "{item.value}"
                                                    </p>
                                                )}

                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic">
                                                    {item.validationDetails}
                                                </p>
                                            </div>

                                            <div className="shrink-0">
                                                {isNotApp ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500">
                                                        — N/A
                                                    </span>
                                                ) : isPass ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                        <CheckCircle size={12} /> PASS
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                                                        <AlertCircle size={12} /> FAIL
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Rule Violations Section */}
                    <div className="mb-8 p-6 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} />
                            Non-Compliance & Violations Summary ({currentProduct.violations.length})
                        </h3>
                        {currentProduct.violations.length === 0 ? (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                No packaging rule violations found. All mandatory declarations for {resolvedCategory} are met.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {currentProduct.violations.map((v, i) => (
                                    <div key={i} className="flex gap-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] h-fit mt-0.5 shrink-0 ${
                                            v.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                            v.severity === 'major' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {v.severity}
                                        </span>
                                        <div>
                                            <strong className="text-gray-900 dark:text-white">{v.label}</strong>: {v.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Inspector Field Notes */}
                    <div className="no-print">
                        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Inspector Field Notes</h3>
                        {isEditingNotes ? (
                            <div className="space-y-2">
                                <textarea
                                    rows={3}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Enter physical inspection details, store location, packer info..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => setIsEditingNotes(false)}
                                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveNotes}
                                        disabled={isSavingNotes}
                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        {isSavingNotes ? 'Saving...' : 'Save Notes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-start justify-between gap-4">
                                <div className="text-xs text-gray-600 dark:text-gray-300 italic">
                                    {currentProduct.notes || 'No inspector field notes added yet.'}
                                </div>
                                <button
                                    onClick={() => setIsEditingNotes(true)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg text-blue-600 dark:text-blue-400 cursor-pointer"
                                    title="Edit Notes"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Edit Modal */}
            {isEditingProduct && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden my-8">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <Edit2 size={20} className="text-emerald-600" />
                                    Edit Product Declarations & Category
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Modify values, change category, or update sectoral regulatory fields.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEditingProduct(false)}
                                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Category Selector */}
                            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                                <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
                                    📦 Product Category
                                </label>
                                <select
                                    value={editCategory}
                                    onChange={(e) => handleEditCategoryChange(e.target.value as ProductCategory)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                >
                                    {ALL_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🏷️ Product Name / Identity *
                                    </label>
                                    <input
                                        type="text"
                                        value={editProductName}
                                        onChange={(e) => setEditProductName(e.target.value)}
                                        placeholder="e.g. Parle-G Biscuits"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🔍 Barcode / GTIN Number
                                    </label>
                                    <input
                                        type="text"
                                        value={editBarcode}
                                        onChange={(e) => setEditBarcode(e.target.value)}
                                        placeholder="e.g. 8901030383848"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        💰 Maximum Retail Price (MRP ₹) *
                                    </label>
                                    <input
                                        type="text"
                                        value={editMrp}
                                        onChange={(e) => handleEditMrpChange(e.target.value)}
                                        placeholder="e.g. 249.00"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        ⚖️ Net Quantity & Unit *
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={editNetQuantity}
                                            onChange={(e) => handleEditQuantityChange(e.target.value)}
                                            placeholder="e.g. 500"
                                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <select
                                            value={editQuantityUnit}
                                            onChange={(e) => handleEditQuantityUnitChange(e.target.value)}
                                            className="w-20 px-2 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        >
                                            <option value="g">g</option>
                                            <option value="kg">kg</option>
                                            <option value="ml">ml</option>
                                            <option value="L">L</option>
                                            <option value="pcs">pcs</option>
                                            <option value="units">units</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        📅 Date of Manufacture / Packing
                                    </label>
                                    <input
                                        type="text"
                                        value={editMfgDate}
                                        onChange={(e) => setEditMfgDate(e.target.value)}
                                        placeholder="e.g. 05/2026 or 2026-05-10"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        ⌛ Best Before / Expiry Date
                                    </label>
                                    <input
                                        type="text"
                                        value={editExpiryDate}
                                        onChange={(e) => setEditExpiryDate(e.target.value)}
                                        placeholder="e.g. 12/2026 or 9 months from mfg"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="sm:col-span-2 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🏭 Manufacturer / Packer Name & Full Address *
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={editManufacturer}
                                        onChange={(e) => setEditManufacturer(e.target.value)}
                                        placeholder="e.g. Parle Products Pvt Ltd, North Level Crossing, Vile Parle East, Mumbai - 400057"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        📞 Consumer Care Helpline / Email *
                                    </label>
                                    <input
                                        type="text"
                                        value={editConsumerCare}
                                        onChange={(e) => setEditConsumerCare(e.target.value)}
                                        placeholder="e.g. 1800-22-7799 / customercare@parle.biz"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* Dynamic Regulatory Field for Selected Category */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🛡️ {editCategorySpec.regulatoryField.label}
                                    </label>
                                    {editCategory === 'Food & Beverage' ? (
                                        <input
                                            type="text"
                                            value={editFssaiLicense}
                                            onChange={(e) => {
                                                setEditFssaiLicense(e.target.value);
                                                setEditRegulatoryLicense(e.target.value);
                                            }}
                                            placeholder="e.g. 10012022000046 (14 digits)"
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={editRegulatoryLicense}
                                            onChange={(e) => {
                                                setEditRegulatoryLicense(e.target.value);
                                                setEditFssaiLicense(e.target.value);
                                            }}
                                            placeholder={editCategorySpec.regulatoryField.placeholder}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                        />
                                    )}
                                </div>

                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🌐 Country of Origin
                                    </label>
                                    <input
                                        type="text"
                                        value={editCountryOfOrigin}
                                        onChange={(e) => setEditCountryOfOrigin(e.target.value)}
                                        placeholder="e.g. India"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        💵 Unit Sale Price (USP)
                                    </label>
                                    <input
                                        type="text"
                                        value={editUnitPrice}
                                        onChange={(e) => setEditUnitPrice(e.target.value)}
                                        placeholder="e.g. ₹0.20 per gram"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        📝 Inspector Notes
                                    </label>
                                    <input
                                        type="text"
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        placeholder="e.g. Verified at retail store inspection"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setIsEditingProduct(false)}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProductEdit}
                                disabled={isSavingProduct}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                            >
                                {isSavingProduct ? (
                                    <>Saving Changes...</>
                                ) : (
                                    <>
                                        <Save size={16} /> Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
