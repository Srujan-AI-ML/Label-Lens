import React, { useState, useRef, useMemo } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from './CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage } from '../services/visionService';
import { analyseCompliance, buildScanResult, validateProductSpecifics } from '../services/complianceService';
import {
    X, Camera, Upload, Sparkles, Save, RotateCcw, ArrowRight, ScanLine
} from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';

interface AddProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onViewReport?: (product: ScannedProduct) => void;
    initialMode?: 'scan' | 'manual';
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
    isOpen,
    onClose,
    onViewReport,
    initialMode = 'manual'
}) => {
    const { addScanResult } = useProduct();
    const [activeTab, setActiveTab] = useState<'manual' | 'upload' | 'camera'>(
        initialMode === 'scan' ? 'upload' : 'manual'
    );
    const [showCamera, setShowCamera] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    // Specific declaration fields
    const [productName, setProductName] = useState('');
    const [barcode, setBarcode] = useState('');
    const [netQuantity, setNetQuantity] = useState('');
    const [quantityUnit, setQuantityUnit] = useState('g');
    const [mrp, setMrp] = useState('');
    const [mfgDate, setMfgDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [consumerCare, setConsumerCare] = useState('');
    const [fssaiLicense, setFssaiLicense] = useState('');
    const [countryOfOrigin, setCountryOfOrigin] = useState('India');
    const [unitPrice, setUnitPrice] = useState('');
    const [category, setCategory] = useState('Food & Beverage');
    const [notes, setNotes] = useState('');
    const [rawText, setRawText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Build synthesized label text from the specific fields
    const synthesizedText = useMemo(() => {
        if (rawText.trim()) return rawText;
        const parts: string[] = [];
        if (productName) parts.push(`Product: ${productName}`);
        if (manufacturer) parts.push(`Manufactured by: ${manufacturer}`);
        if (netQuantity) parts.push(`Net Quantity: ${netQuantity} ${quantityUnit}`);
        if (mrp) parts.push(`MRP: Rs. ${mrp} (incl. of all taxes)`);
        if (mfgDate) parts.push(`Mfg Date: ${mfgDate}`);
        if (expiryDate) parts.push(`Best Before: ${expiryDate}`);
        if (consumerCare) parts.push(`Consumer Care: ${consumerCare}`);
        if (fssaiLicense) parts.push(`FSSAI Lic No: ${fssaiLicense}`);
        if (countryOfOrigin) parts.push(`Country of Origin: ${countryOfOrigin}`);
        if (unitPrice) parts.push(`Unit Sale Price: ${unitPrice}`);
        return parts.join('\n');
    }, [productName, manufacturer, netQuantity, quantityUnit, mrp, mfgDate, expiryDate, consumerCare, fssaiLicense, countryOfOrigin, unitPrice, rawText]);

    // Live Legal Metrology Compliance Analysis
    const liveAnalysis = useMemo(() => {
        return analyseCompliance(synthesizedText, productName || 'Inspected Product');
    }, [synthesizedText, productName]);

    if (!isOpen) return null;

    const handleCameraCapture = async (imageSrc: string) => {
        setShowCamera(false);
        setImagePreview(imageSrc);
        await processUploadedImage(imageSrc);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            if (typeof reader.result === 'string') {
                setImagePreview(reader.result);
                await processUploadedImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const formatToISODate = (dateStr: string): string => {
        if (!dateStr) return '';
        const cleanStr = dateStr.trim();

        // 1. If it's already YYYY-MM-DD, return it
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            return cleanStr;
        }

        // 2. If it's DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})$/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }

        // 3. If it's MM/YYYY or MM.YYYY or MM-YYYY
        const myMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{4})$/);
        if (myMatch) {
            const month = myMatch[1].padStart(2, '0');
            const year = myMatch[2];
            return `${year}-${month}-01`;
        }

        // 4. Try parsing with standard Date object
        const parsed = new Date(cleanStr);
        if (!isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        return '';
    };

    const autoPopulateFromText = (extractedText: string) => {
        const analysis = analyseCompliance(extractedText, productName);
        const decs = analysis.declarations;

        if (decs.genericName?.present && decs.genericName.value) {
            setProductName(decs.genericName.value);
        }
        if (decs.netQuantity?.present && decs.netQuantity.value) {
            const qtyMatch = decs.netQuantity.value.match(/([\d.,]+)\s*([a-zA-Z]+)/);
            if (qtyMatch) {
                setNetQuantity(qtyMatch[1]);
                const unit = qtyMatch[2].toLowerCase();
                if (['g', 'kg', 'ml', 'l', 'pcs', 'units'].includes(unit)) {
                    setQuantityUnit(unit === 'l' ? 'L' : unit);
                }
            } else {
                setNetQuantity(decs.netQuantity.value);
            }
        }
        if (decs.mrp?.present && decs.mrp.value) {
            const cleanMrp = decs.mrp.value.replace(/[₹\s,]/g, '');
            setMrp(cleanMrp);
        }
        if (decs.manufactureDate?.present && decs.manufactureDate.value) {
            setMfgDate(formatToISODate(decs.manufactureDate.value));
        }
        if (decs.bestBefore?.present && decs.bestBefore.value) {
            setExpiryDate(formatToISODate(decs.bestBefore.value));
        }
        if (decs.manufacturer?.present && decs.manufacturer.value) {
            setManufacturer(decs.manufacturer.value);
        }
        if (decs.consumerCare?.present && decs.consumerCare.value) {
            setConsumerCare(decs.consumerCare.value);
        }
        if (decs.fssaiLicense?.present && decs.fssaiLicense.value) {
            const fssaiMatch = decs.fssaiLicense.value.match(/\d{14}/);
            if (fssaiMatch) {
                setFssaiLicense(fssaiMatch[0]);
            } else {
                setFssaiLicense(decs.fssaiLicense.value);
            }
        }
        if (decs.countryOfOrigin?.present && decs.countryOfOrigin.value) {
            const cleanOrigin = decs.countryOfOrigin.value.replace(/\(inferred\)/i, '').trim();
            setCountryOfOrigin(cleanOrigin);
        }
        if (decs.retailSalePrice?.present && decs.retailSalePrice.value) {
            setUnitPrice(decs.retailSalePrice.value);
        }
    };

    const processUploadedImage = async (imageSrc: string) => {
        setIsProcessing(true);
        setStatusMsg('Scanning image and reading packaging declarations...');
        const base64Data = imageSrc.split(',')[1];

        try {
            // 1. Detect Barcode
            const bcode = await detectBarcode(base64Data);
            if (bcode) {
                setBarcode(bcode);
                setStatusMsg(`Barcode detected: ${bcode}. Querying product registry...`);
                const info = await lookupProduct(bcode);
                if (info && info.name) {
                    setProductName(info.name);
                }
            }

            // 2. OCR Text Extraction
            setStatusMsg('Extracting text via Optical Character Recognition (OCR)...');
            try {
                const text = await extractTextFromImage(base64Data);
                if (text) {
                    setRawText(text);
                    autoPopulateFromText(text);
                    setStatusMsg('✅ Declarations detected & extracted! Review specifics in grid.');

                    // Determine if any critical fields are missing
                    const analysis = analyseCompliance(text, productName);
                    const missingKeys = Object.entries(analysis.declarations)
                        .filter(([key, d]) => !d.present && ['genericName', 'netQuantity', 'mrp', 'manufactureDate', 'consumerCare'].includes(key));
                    
                    if (missingKeys.length > 0) {
                        alert('⚠️ Some specific details failed to scan and update. Please review and fill them manually.');
                    }
                }
            } catch (ocrErr: any) {
                console.warn('OCR fallback:', ocrErr);
                setStatusMsg('Image uploaded. Please fill/verify the specifics in the grid below.');
                alert('⚠️ Specific details failed to scan. Please update manually.');
            }
        } catch (err: any) {
            console.error('Scan processing error:', err);
            setStatusMsg('Image loaded. You can fill/edit the specifics grid directly.');
            alert('⚠️ Specific details failed to scan. Please update manually.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async (andViewReport: boolean = false) => {
        const validation = validateProductSpecifics({
            productName,
            barcode,
            netQuantity,
            mrp,
            mfgDate,
            expiryDate,
            fssaiLicense
        });

        if (!validation.isValid) {
            alert(`⚠️ Validation Error:\n${validation.errorMsg}`);
            return;
        }

        setIsProcessing(true);
        try {
            const finalName = productName.trim() || 'Inspected Commodity';
            const scanData = buildScanResult(
                synthesizedText,
                finalName,
                barcode.trim() || undefined,
                imagePreview || undefined
            );
            scanData.category = category;
            scanData.notes = notes;

            const saved = await addScanResult(scanData);
            onClose();

            if (andViewReport && onViewReport) {
                onViewReport(saved);
            }
        } catch (err: any) {
            alert('Failed to save product inspection: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setProductName('');
        setBarcode('');
        setNetQuantity('');
        setMrp('');
        setMfgDate('');
        setExpiryDate('');
        setManufacturer('');
        setConsumerCare('');
        setFssaiLicense('');
        setCountryOfOrigin('India');
        setUnitPrice('');
        setNotes('');
        setRawText('');
        setImagePreview(null);
        setStatusMsg('');
    };

    const ruleFields: Array<{
        key: keyof ComplianceDeclarations;
        emoji: string;
        label: string;
        mandatory: boolean;
    }> = [
        { key: 'genericName', emoji: '🏷️', label: '1. Product Identity / Generic Name', mandatory: true },
        { key: 'netQuantity', emoji: '⚖️', label: '2. Net Quantity (Weight/Vol/Count)', mandatory: true },
        { key: 'mrp', emoji: '💰', label: '3. Maximum Retail Price (MRP incl taxes)', mandatory: true },
        { key: 'manufactureDate', emoji: '📅', label: '4. Date of Manufacture / Packing', mandatory: true },
        { key: 'bestBefore', emoji: '⌛', label: '5. Best Before / Expiry Date', mandatory: false },
        { key: 'manufacturer', emoji: '🏭', label: '6. Manufacturer / Packer Address', mandatory: true },
        { key: 'consumerCare', emoji: '📞', label: '7. Consumer Care Helpline & Email', mandatory: true },
        { key: 'fssaiLicense', emoji: '🛡️', label: '8. FSSAI 14-Digit License No.', mandatory: false },
        { key: 'countryOfOrigin', emoji: '🌐', label: '9. Country of Origin (Imports)', mandatory: false },
        { key: 'retailSalePrice', emoji: '💵', label: '10. Unit Sale Price Breakdown', mandatory: false },
    ];

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
            <div className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="sticky top-0 z-20 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <ScanLine size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">+ Add & Scan Product Declarations</h2>
                            <p className="text-xs text-white/80">Label Lens Compliance Verifier</p>
                        </div>
                    </div>

                    {/* Clear Working X Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                        title="Close and return to dashboard"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Body */}
                <div className="overflow-y-auto p-6 space-y-6 flex-1">
                    
                    {/* Top Action Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-gray-100 dark:bg-gray-800/80 rounded-2xl border border-gray-200/60 dark:border-gray-700">
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab('manual')}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
                                    activeTab === 'manual'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <span>✍️</span> Specifics Grid Form
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('upload')}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
                                    activeTab === 'upload'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Upload size={14} /> Upload Image
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('camera');
                                    setShowCamera(true);
                                }}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1 sm:flex-initial ${
                                    activeTab === 'camera'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                <Camera size={14} /> Scan with Camera
                            </button>
                        </div>

                        {imagePreview && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <span>📸 Image Attached</span>
                                <button
                                    onClick={() => setImagePreview(null)}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-1"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Status Alert Banner */}
                    {statusMsg && (
                        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl text-xs font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                            <Sparkles size={16} className="text-blue-600 shrink-0" />
                            <span>{statusMsg}</span>
                        </div>
                    )}

                    {/* Upload Dropzone Area (Visible when Upload Tab is selected) */}
                    {activeTab === 'upload' && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-blue-300 dark:border-blue-700/60 hover:border-blue-500 rounded-3xl p-8 text-center bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 transition-all cursor-pointer"
                        >
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <Upload size={26} />
                            </div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Click or Drag & Drop Packaging Image</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Supports JPG, PNG, WEBP — Auto-extracts barcode & label text</p>
                        </div>
                    )}

                    {/* Two Column Grid: (Left) Specifics Fields Grid | (Right) Live 2011 Rules Checklist Side Box */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Specifics Grid (2 Cols wide on desktop) */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                <span>📋</span> Product Specifics & Declarations Grid
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                
                                {/* 1. Product Name */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>🏷️</span> Generic / Common Product Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Parle-G Glucose Biscuits"
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 2. Net Quantity */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>⚖️</span> Net Quantity (Weight/Vol/Count) *
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="e.g. 250"
                                            value={netQuantity}
                                            onChange={(e) => setNetQuantity(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <select
                                            value={quantityUnit}
                                            onChange={(e) => setQuantityUnit(e.target.value)}
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

                                {/* 3. MRP */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>💰</span> Maximum Retail Price (MRP ₹) *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 30.00 (incl. of all taxes)"
                                        value={mrp}
                                        onChange={(e) => setMrp(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>

                                {/* 4. Barcode / UPC */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>🔍</span> Barcode / GTIN Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 8901058005080"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>

                                {/* 5. Mfg Date */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>📅</span> Month & Year of Mfg / Packing *
                                    </label>
                                    <input
                                        type="date"
                                        value={mfgDate}
                                        onChange={(e) => setMfgDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 6. Expiry / Best Before */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>⌛</span> Best Before / Use By Date
                                    </label>
                                    <input
                                        type="date"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 7. Manufacturer & Address (Full width) */}
                                <div className="sm:col-span-2 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>🏭</span> Name & Complete Address of Manufacturer / Packer / Importer *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Britannia Industries Ltd, 5/1A Hungerford Street, Kolkata - 700017, WB"
                                        value={manufacturer}
                                        onChange={(e) => setManufacturer(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 8. Consumer Care Details */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>📞</span> Consumer Care Helpline (Phone / Email) *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1800-425-4449 / care@britannia.co.in"
                                        value={consumerCare}
                                        onChange={(e) => setConsumerCare(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 9. FSSAI License Number */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>🛡️</span> FSSAI License No. (14 digits)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 10015043001129"
                                        value={fssaiLicense}
                                        onChange={(e) => setFssaiLicense(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>

                                {/* 10. Country of Origin */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>🌐</span> Country of Origin
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. India"
                                        value={countryOfOrigin}
                                        onChange={(e) => setCountryOfOrigin(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 11. Unit Sale Price */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                        <span>💵</span> Unit Sale Price (USP)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rs. 0.12 / g"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                {/* 12. Category & Notes (Full width) */}
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            📦 Commodity Category
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        >
                                            <option value="Food & Beverage">Food & Beverage</option>
                                            <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
                                            <option value="Pharmaceutical / Health">Pharmaceutical / Health</option>
                                            <option value="Household & Cleaning">Household & Cleaning</option>
                                            <option value="Electronics & Electricals">Electronics & Electricals</option>
                                            <option value="Other Packaged Goods">Other Packaged Goods</option>
                                        </select>
                                    </div>

                                    <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            📝 Inspector Field Notes
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Retail store inspection at Sector 4..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Rules, 2011 Checklist Side Box */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="p-5 bg-gray-50 dark:bg-gray-850 rounded-3xl border border-gray-200 dark:border-gray-700/70 space-y-3.5">
                                <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-gray-700">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                            Rules, 2011 Checklist
                                        </h4>
                                        <p className="text-[10px] text-gray-500">Live Verification Status</p>
                                    </div>
                                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                        {liveAnalysis.complianceScore}%
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {ruleFields.map(({ key, emoji, label }) => {
                                        const isCompliant = liveAnalysis.declarations[key]?.present;
                                        return (
                                            <div
                                                key={key}
                                                className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                                                    isCompliant
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300'
                                                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 truncate pr-2">
                                                    <span>{emoji}</span>
                                                    <span className="truncate">{label}</span>
                                                </div>
                                                <span className="font-bold shrink-0">
                                                    {isCompliant ? '✔️ Pass' : '❌ Fail'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="sticky bottom-0 z-20 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white cursor-pointer"
                    >
                        <RotateCcw size={14} />
                        Reset Form
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancel & Return
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            <Save size={15} />
                            Save to Database
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                        >
                            <Sparkles size={15} />
                            Save & View Certificate
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>

            </div>

            {/* Camera Overlay Modal */}
            {showCamera && (
                <CameraModal
                    onClose={() => setShowCamera(false)}
                    onEnterManual={() => {
                        setShowCamera(false);
                        setActiveTab('manual');
                    }}
                    onCapture={handleCameraCapture}
                />
            )}
        </div>
    );
};
