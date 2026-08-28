import React, { useState, useRef, useMemo } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from '../components/CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage } from '../services/visionService';
import { analyseCompliance, buildScanResult, validateProductSpecifics } from '../services/complianceService';
import { 
    Camera, Upload, ArrowLeft, Sparkles, Tag, Scale, DollarSign, 
    Factory, Phone, Calendar, Clock, Shield, Globe, Layers, Save, RotateCcw,
    ScanLine, X
} from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';
import type { PageType } from '../App';

function formatToISODate(dateStr: string): string {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();

    // 1. If it's already YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
        return cleanStr;
    }

    // 2. If it's DD.MM.YY(YY) or DD/MM/YY(YY) or DD-MM-YY(YY)
    const dmyMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        let year = dmyMatch[3];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
    }

    // 3. If it's MM/YY(YY) or MM.YY(YY) or MM-YY(YY)
    const myMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{2,4})$/);
    if (myMatch) {
        const month = myMatch[1].padStart(2, '0');
        let year = myMatch[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-01`;
    }

    // 4. If month name format e.g. "JAN 2026", "MAY-2026", "15 MAY 2026"
    const monthNames: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const monthNameMatch = cleanStr.match(/(?:(\d{1,2})[\s\.\/\-]*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\.\/\-]*(\d{2,4})/i);
    if (monthNameMatch) {
        const day = monthNameMatch[1] ? monthNameMatch[1].padStart(2, '0') : '01';
        const monKey = monthNameMatch[2].toLowerCase().slice(0, 3);
        const month = monthNames[monKey] || '01';
        let year = monthNameMatch[3];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
    }

    // 5. Try parsing with standard Date object
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return '';
}

interface ScanProductProps {
    onNavigate: (page: PageType) => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const ScanProduct: React.FC<ScanProductProps> = ({ onNavigate, onSelectProduct }) => {
    const { addScanResult } = useProduct();
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    
    // Structured declaration fields
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
    }, [productName, manufacturer, netQuantity, quantityUnit, mrp, mfgDate, expiryDate, consumerCare, fssaiLicense, countryOfOrigin, unitPrice]);

    // Live analysis on current synthesized text
    const liveAnalysis = useMemo(() => {
        return analyseCompliance(synthesizedText, productName || 'Inspected Product');
    }, [synthesizedText, productName]);

    const handleCameraCapture = async (imageSrc: string) => {
        setShowCamera(false);
        setImagePreview(imageSrc);
        await processLabelImage(imageSrc);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            if (typeof reader.result === 'string') {
                setImagePreview(reader.result);
                await processLabelImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const autoPopulateFromText = (extractedText: string, currentName: string = '', currentBarcode: string = '') => {
        const analysis = analyseCompliance(extractedText, currentName);
        const decs = analysis.declarations;

        if (decs.genericName?.present && decs.genericName.value) {
            setProductName(decs.genericName.value);
        } else if (currentName) {
            setProductName(currentName);
        } else {
            setProductName('Could not identify product');
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

        // Fallback barcode detection from extracted text
        if (!currentBarcode.trim() || currentBarcode.trim() === '') {
            const barcodeRegex = /(?:barcode|gtin|upc|ean)\s*[:\-]?\s*(\d{8,15})/i;
            const match = extractedText.match(barcodeRegex);
            if (match) {
                setBarcode(match[1].trim());
            } else {
                const cleanText = extractedText.replace(/\s+/g, '');
                const standaloneMatch = cleanText.match(/(\d{8,15})/);
                if (standaloneMatch) {
                    setBarcode(standaloneMatch[1]);
                }
            }
        }
    };

    const processLabelImage = async (imageSrc: string) => {
        // Reset all product fields before starting a new scan
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

        setIsScanning(true);
        setScanStatus('Analyzing image and reading packaging declarations...');
        const base64Data = imageSrc.split(',')[1];

        let detectedBarcode = '';
        let detectedName = '';

        try {
            // Step 1: Detect Barcode
            const bcode = await detectBarcode(base64Data);
            if (bcode) {
                detectedBarcode = bcode;
                setBarcode(bcode);
                setScanStatus(`Barcode detected: ${bcode}. Checking product registry...`);
                const info = await lookupProduct(bcode);
                if (info && info.name) {
                    detectedName = info.name;
                    setProductName(info.name);
                }
            }

            // Step 2: OCR Text Extraction
            setScanStatus('Running Optical Character Recognition (OCR)...');
            try {
                const text = await extractTextFromImage(base64Data);
                console.log('Raw OCR Output from Scan:', text);
                
                if (text && text.trim()) {
                    setRawText(text);
                    autoPopulateFromText(text, detectedName, detectedBarcode);
                    setScanStatus('✅ Text extracted successfully! Review specifics in grid below.');

                    // Determine final name to use for analysis compliance check
                    const analysis = analyseCompliance(text, detectedName);
                    const decs = analysis.declarations;
                    const finalName = (decs.genericName?.present && decs.genericName.value) || detectedName;
                    
                    if (finalName && finalName.trim()) {
                        setProductName(finalName);
                    } else {
                        setProductName('Could not identify product');
                    }

                    // Determine if any critical fields are missing
                    const missingKeys = Object.entries(analysis.declarations)
                        .filter(([key, d]) => !d.present && ['genericName', 'netQuantity', 'mrp', 'manufactureDate', 'consumerCare'].includes(key));
                    
                    if (missingKeys.length > 0) {
                        alert('⚠️ Some specific details failed to scan and update. Please review and fill them manually.');
                    }
                } else {
                    console.log('No text was returned by OCR.');
                    if (detectedName) {
                        setProductName(detectedName);
                    } else {
                        setProductName('Could not identify product');
                    }
                    setScanStatus('⚠️ Image attached, but no text could be extracted.');
                }
            } catch (ocrError: any) {
                console.warn('OCR notice:', ocrError);
                if (detectedName) {
                    setProductName(detectedName);
                } else {
                    setProductName('Could not identify product');
                }
                setScanStatus('Image attached. Please review/fill the specifics in the grid below.');
                alert('⚠️ Specific details failed to scan. Please update manually.');
            }
        } catch (err: any) {
            console.error('Scan processing failed:', err);
            if (detectedName) {
                setProductName(detectedName);
            } else {
                setProductName('Could not identify product');
            }
            setScanStatus('Image loaded. You can fill/edit the specifics grid directly.');
            alert('⚠️ Specific details failed to scan. Please update manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleSaveAndSubmit = async (target: 'dashboard' | 'report') => {
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

        setIsScanning(true);
        try {
            const nameToUse = productName.trim() || 'Inspected Commodity';
            const scanData = buildScanResult(synthesizedText, nameToUse, barcode.trim() || undefined, imagePreview || undefined);
            scanData.category = category;
            scanData.notes = notes;

            const saved = await addScanResult(scanData);

            if (target === 'dashboard') {
                onNavigate('home');
            } else {
                onSelectProduct(saved);
            }
        } catch (error: any) {
            alert('Failed to save compliance inspection: ' + error.message);
        } finally {
            setIsScanning(false);
        }
    };

    const resetScan = () => {
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
        setScanStatus('');
    };

    const declarationIcons: Array<{
        key: keyof ComplianceDeclarations;
        title: string;
        icon: any;
        color: string;
        emoji: string;
    }> = [
        { key: 'genericName', title: '1. Product Identity / Name', icon: Tag, color: 'text-blue-500', emoji: '🏷️' },
        { key: 'netQuantity', title: '2. Net Quantity', icon: Scale, color: 'text-emerald-500', emoji: '⚖️' },
        { key: 'mrp', title: '3. Maximum Retail Price (MRP)', icon: DollarSign, color: 'text-amber-500', emoji: '💰' },
        { key: 'manufactureDate', title: '4. Date of Mfg / Packing', icon: Calendar, color: 'text-violet-500', emoji: '📅' },
        { key: 'bestBefore', title: '5. Best Before / Expiry', icon: Clock, color: 'text-rose-500', emoji: '⌛' },
        { key: 'manufacturer', title: '6. Manufacturer & Address', icon: Factory, color: 'text-blue-500', emoji: '🏭' },
        { key: 'consumerCare', title: '7. Consumer Care Helpline', icon: Phone, color: 'text-teal-500', emoji: '📞' },
        { key: 'fssaiLicense', title: '8. FSSAI License No.', icon: Shield, color: 'text-orange-500', emoji: '🛡️' },
        { key: 'countryOfOrigin', title: '9. Country of Origin', icon: Globe, color: 'text-cyan-500', emoji: '🌐' },
        { key: 'retailSalePrice', title: '10. Unit Retail Price', icon: Layers, color: 'text-purple-500', emoji: '💵' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Navigation & Return Bar with Clear X Button */}
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
                        onClick={() => onNavigate('home')}
                        className="p-2 bg-gray-100 hover:bg-rose-100 dark:bg-gray-800 dark:hover:bg-rose-950/40 text-gray-500 hover:text-rose-600 rounded-xl transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
                        title="Close and return to dashboard"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <ScanLine className="text-blue-600 dark:text-blue-400" />
                    Packaging Inspection & Compliance Analysis
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Enter product specifics in the grid below or upload/scan packaging to check declarations compliance under the Label Lens verifier.
                </p>
            </div>

            {/* Main Workspace Layout (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column (2/3 width): Specifics Grid Form or Image Upload */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Image / Camera Upload Bar (if in scan mode or wanting to attach photo) */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>📸</span> Attach Packaging Photo / Camera Scan
                                </h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Upload or snap label photo for automatic character extraction
                                </p>
                            </div>
                            {imagePreview && (
                                <button
                                    onClick={() => setImagePreview(null)}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                >
                                    ✕ Remove Photo
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <button
                                type="button"
                                onClick={() => setShowCamera(true)}
                                disabled={isScanning}
                                className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-xs sm:text-sm"
                            >
                                <Camera size={18} />
                                Capture with Camera
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isScanning}
                                className="flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 text-gray-800 dark:text-white font-bold rounded-2xl transition-all cursor-pointer text-xs sm:text-sm"
                            >
                                <Upload size={18} />
                                Upload Image File
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        {imagePreview && (
                            <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black flex items-center justify-center">
                                <img src={imagePreview} alt="Packaging Preview" className="h-full object-contain" />
                            </div>
                        )}

                        {scanStatus && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                <Sparkles size={15} />
                                <span>{scanStatus}</span>
                            </div>
                        )}
                    </div>

                    {/* Specifics Grid Form with Icons / Emojis */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>📋</span> Mandatory Declarations Specifics Grid
                                </h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Enter or verify each declaration item to calculate compliance
                                </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full">
                                {Object.values(liveAnalysis.declarations).filter(d => d.present).length} / 10 Met
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* 1. Product Name */}
                            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                    <span>🏷️</span> Generic / Common Product Name *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Parle-G Biscuits"
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
                                        placeholder="e.g. 200"
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
                                    placeholder="e.g. 25.00 (incl. of all taxes)"
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
                                    <span>📅</span> Date of Mfg / Packing *
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
                                    <span>⌛</span> Best Before / Expiry Date
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
                                    <span>🏭</span> Name & Complete Address of Manufacturer / Packer *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Parle Products Pvt Ltd, V.S. Khandekar Marg, Vile Parle East, Mumbai - 400057"
                                    value={manufacturer}
                                    onChange={(e) => setManufacturer(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* 8. Consumer Care Details */}
                            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                                    <span>📞</span> Consumer Care Helpline (Phone/Email) *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1800-22-7799 / cs@parle.biz"
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
                                    placeholder="e.g. 10012022000046"
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
                                    placeholder="e.g. Rs. 0.15 / g"
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

                        {/* Raw Text Fallback Area */}
                        <div className="pt-2">
                            <details className="cursor-pointer group">
                                <summary className="text-xs font-bold text-blue-600 dark:text-blue-400 list-none flex items-center justify-between py-1">
                                    <span>✍️ Optional: Raw Label Text Override</span>
                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <textarea
                                    rows={3}
                                    placeholder="Paste full raw OCR text here to override structured fields if needed..."
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    className="w-full mt-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none font-mono"
                                />
                            </details>
                        </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                        <button
                            type="button"
                            onClick={resetScan}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white cursor-pointer"
                        >
                            <RotateCcw size={14} />
                            Reset Fields
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleSaveAndSubmit('dashboard')}
                                disabled={isScanning}
                                className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-2xl text-xs font-bold transition-all cursor-pointer"
                            >
                                <Save size={15} />
                                Save & Return
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveAndSubmit('report')}
                                disabled={isScanning}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-850 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                            >
                                <Sparkles size={16} />
                                Save & View Certificate
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column (1/3 width): Side Box Rules of 2011 Checklist */}
                <div className="lg:col-span-1">
                    <div className="sticky top-20 bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Rules, 2011 Checklist</h3>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">Label Lens Verification Status</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                    {liveAnalysis.complianceScore}%
                                </span>
                            </div>
                        </div>

                        {/* Rules checkboxes with ticks/crosses */}
                        <div className="space-y-2.5">
                            {declarationIcons.map(({ key, title, emoji }) => {
                                const isCompliant = liveAnalysis.declarations[key]?.present;
                                return (
                                    <div
                                        key={key}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                                            isCompliant
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30'
                                                : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={isCompliant}
                                                readOnly
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-default"
                                            />
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate text-[11px]">
                                                {emoji} {title}
                                            </span>
                                        </div>

                                        <div className="shrink-0">
                                            {isCompliant ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                                    ✔️ Pass
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                                                    ❌ Fail
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                             })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Camera Overlay Modal */}
            {showCamera && (
                <CameraModal
                    onClose={() => setShowCamera(false)}
                    onEnterManual={() => {
                        setShowCamera(false);
                    }}
                    onCapture={handleCameraCapture}
                />
            )}
        </div>
    );
};
