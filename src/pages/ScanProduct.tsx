import React, { useState, useRef, useMemo } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from '../components/CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage } from '../services/visionService';
import { analyseCompliance, buildScanResult } from '../services/complianceService';
import { 
    Camera, Upload, ArrowLeft, ShieldCheck, ShieldAlert, Sparkles, 
    AlertCircle, FileText, CheckCircle2, XCircle, Tag, Scale, DollarSign, 
    Factory, Phone, Calendar, Clock, Shield, Globe, Layers, Plus, Save, RotateCcw
} from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';

interface ScanProductProps {
    onNavigate: (page: 'home' | 'scan' | 'repository') => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const ScanProduct: React.FC<ScanProductProps> = ({ onNavigate, onSelectProduct }) => {
    const { addScanResult } = useProduct();
    const [mode, setMode] = useState<'scan' | 'manual'>('scan');
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    
    // Form & Extraction State
    const [barcode, setBarcode] = useState('');
    const [productName, setProductName] = useState('');
    const [rawText, setRawText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Live analysis on current rawText
    const liveAnalysis = useMemo(() => {
        return analyseCompliance(rawText, productName || 'Inspected Product');
    }, [rawText, productName]);

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

    const processLabelImage = async (imageSrc: string) => {
        setIsScanning(true);
        setScanStatus('Analyzing image and scanning barcode...');
        const base64Data = imageSrc.split(',')[1];

        let detectedBarcode = '';
        let resolvedName = '';

        try {
            // Step 1: Detect Barcode
            const bcode = await detectBarcode(base64Data);
            if (bcode) {
                detectedBarcode = bcode;
                setBarcode(bcode);
                setScanStatus(`Barcode detected: ${bcode}. Checking product registry...`);
                const info = await lookupProduct(bcode);
                if (info) {
                    resolvedName = info.name;
                    setProductName(info.name);
                }
            }

            // Step 2: OCR Text Extraction
            setScanStatus('Running Optical Character Recognition (OCR)...');
            try {
                const text = await extractTextFromImage(base64Data);
                if (text) {
                    setRawText(text);
                    setScanStatus('Text extracted successfully!');
                }
            } catch (ocrError: any) {
                console.warn('OCR notice:', ocrError);
                setScanStatus('OCR key not set. Switch to Manual Form tab below to type or paste label text.');
            }
        } catch (err: any) {
            console.error('Scan processing failed:', err);
            setScanStatus('Scan failed. Please enter label details manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleSaveAndSubmit = async (target: 'dashboard' | 'report') => {
        if (!rawText.trim() && !productName.trim() && !barcode.trim()) {
            alert('Please scan an image or enter product label text before saving.');
            return;
        }

        setIsScanning(true);
        try {
            const nameToUse = productName || 'Inspected Commodity';
            const scanData = buildScanResult(rawText, nameToUse, barcode || undefined, imagePreview || undefined);
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
        setRawText('');
        setProductName('');
        setBarcode('');
        setImagePreview(null);
        setScanStatus('');
    };

    const declarationIcons: Array<{
        key: keyof ComplianceDeclarations;
        title: string;
        icon: any;
        color: string;
    }> = [
        { key: 'genericName', title: 'Generic / Common Name', icon: Tag, color: 'text-blue-500' },
        { key: 'netQuantity', title: 'Net Quantity', icon: Scale, color: 'text-emerald-500' },
        { key: 'mrp', title: 'Maximum Retail Price (MRP)', icon: DollarSign, color: 'text-amber-500' },
        { key: 'manufactureDate', title: 'Date of Mfg / Packing', icon: Calendar, color: 'text-violet-500' },
        { key: 'bestBefore', title: 'Best Before / Expiry', icon: Clock, color: 'text-rose-500' },
        { key: 'manufacturer', title: 'Manufacturer & Address', icon: Factory, color: 'text-indigo-500' },
        { key: 'consumerCare', title: 'Consumer Care Helpline', icon: Phone, color: 'text-teal-500' },
        { key: 'fssaiLicense', title: 'FSSAI License No.', icon: Shield, color: 'text-orange-500' },
        { key: 'countryOfOrigin', title: 'Country of Origin', icon: Globe, color: 'text-cyan-500' },
        { key: 'retailSalePrice', title: 'Unit Retail Price', icon: Layers, color: 'text-purple-500' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Top Navigation & Return Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <button
                    onClick={() => onNavigate('home')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl text-sm font-bold shadow-sm border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Return to Dashboard
                </button>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMode('scan')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            mode === 'scan'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        📷 Camera / Upload Scan
                    </button>
                    <button
                        onClick={() => setMode('manual')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            mode === 'manual'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        ✍️ + Add / Text Form Editor
                    </button>
                </div>
            </div>

            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400" />
                    Packaging Inspection & Compliance Analysis
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Extracts declarations and checks alignment with Legal Metrology (Packaged Commodities) Rules, 2011.
                </p>
            </div>

            {/* Main Workspace Layout (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column (2/3 width): Input & Categorized Declarations */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Input Box Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm">
                        {mode === 'scan' ? (
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">Scan Packaging Image</h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                                    Upload photo or take a picture of the declarations panel on the product package.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <button
                                        onClick={() => setShowCamera(true)}
                                        disabled={isScanning}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer text-sm"
                                    >
                                        <Camera size={18} />
                                        Capture with Camera
                                    </button>

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isScanning}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 text-gray-800 dark:text-white font-bold rounded-2xl transition-all cursor-pointer text-sm"
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
                                        <button
                                            onClick={resetScan}
                                            className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer"
                                        >
                                            Clear Image
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">+ Add Product & Text Declarations</h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                                    Type or paste declarations text to run the compliance rules engine directly.
                                </p>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Product Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Britannia Good Day Cookies"
                                                value={productName}
                                                onChange={(e) => setProductName(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Barcode (Optional)</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 8901058005080"
                                                value={barcode}
                                                onChange={(e) => setBarcode(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Raw Packaging Label Text</label>
                                        <textarea
                                            rows={4}
                                            placeholder="Type or paste label text here (e.g. Mfd by Parle Biscuits Pvt Ltd, Net Qty: 200g, MRP Rs 30.00 incl taxes, Mfg Date: 05/2026, Customer care: 1800-22-1111)..."
                                            value={rawText}
                                            onChange={(e) => setRawText(e.target.value)}
                                            className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {scanStatus && (
                            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                <AlertCircle size={15} />
                                <span>{scanStatus}</span>
                            </div>
                        )}
                    </div>

                    {/* Categorized Extracted Declarations Cards with Icons */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
                                Categorized Declarations Breakdown
                            </h2>
                            <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                {Object.values(liveAnalysis.declarations).filter(d => d.present).length} / 10 Found
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {declarationIcons.map(({ key, title, icon: Icon, color }) => {
                                const decl = liveAnalysis.declarations[key];
                                return (
                                    <div
                                        key={key}
                                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                                            decl.present
                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                                                : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm shrink-0 ${color}`}>
                                                <Icon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{title}</h4>
                                                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate mt-0.5">
                                                    {decl.present ? (decl.value || 'Present') : 'Not Detected'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {decl.present ? (
                                                <CheckCircle2 size={18} className="text-emerald-500" />
                                            ) : (
                                                <XCircle size={18} className="text-rose-500" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                        <button
                            onClick={resetScan}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white cursor-pointer"
                        >
                            <RotateCcw size={14} />
                            Reset Fields
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleSaveAndSubmit('dashboard')}
                                className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-2xl text-xs font-bold transition-all cursor-pointer"
                            >
                                <Save size={15} />
                                Save & Dashboard
                            </button>
                            <button
                                onClick={() => handleSaveAndSubmit('report')}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                            >
                                <ShieldCheck size={16} />
                                View Full Report
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
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">Legal Metrology Compliance Status</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                    {liveAnalysis.complianceScore}%
                                </span>
                            </div>
                        </div>

                        {/* Rules checkboxes with ticks/crosses */}
                        <div className="space-y-2.5">
                            {declarationIcons.map(({ key, title }) => {
                                const isCompliant = liveAnalysis.declarations[key].present;
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
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-default"
                                            />
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate text-[11px]">
                                                {title}
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
            <CameraModal
                isOpen={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={handleCameraCapture}
            />
        </div>
    );
};
