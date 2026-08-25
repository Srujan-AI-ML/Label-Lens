import React, { useState, useRef } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from '../components/CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage } from '../services/visionService';
import { buildScanResult } from '../services/complianceService';
import { Camera, Upload, ArrowRight, ShieldCheck, ShieldAlert, Sparkles, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import type { ScannedProduct } from '../types';

interface ScanProductProps {
    onNavigate: (page: 'home' | 'scan' | 'repository') => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const ScanProduct: React.FC<ScanProductProps> = ({ onNavigate, onSelectProduct }) => {
    const { addScanResult } = useProduct();
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [barcode, setBarcode] = useState('');
    const [productName, setProductName] = useState('');
    const [rawText, setRawText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showManualTextarea, setShowManualTextarea] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setScanStatus('Analyzing image and detecting barcode...');
        const base64Data = imageSrc.split(',')[1];

        let detectedBarcode = '';
        let resolvedName = '';
        let extractedText = '';

        try {
            // Step 1: Detect Barcode
            const bcode = await detectBarcode(base64Data);
            if (bcode) {
                detectedBarcode = bcode;
                setBarcode(bcode);
                setScanStatus(`Barcode detected: ${bcode}. Querying product registry...`);
                // Query Open Food Facts/UPCitemdb
                const info = await lookupProduct(bcode);
                if (info) {
                    resolvedName = info.name;
                    setProductName(info.name);
                }
            }

            // Step 2: OCR Text Extraction
            setScanStatus('Running Optical Character Recognition (OCR) on label...');
            try {
                const text = await extractTextFromImage(base64Data);
                if (text) {
                    extractedText = text;
                    setRawText(text);
                }
            } catch (ocrError: any) {
                console.warn('OCR error:', ocrError);
                // Fallback to let user enter manually if GCloud isn't configured
                if (ocrError.message.includes('credentials')) {
                    setScanStatus('Vision AI credentials not configured. Please paste/type label text below.');
                    setShowManualTextarea(true);
                    setIsScanning(false);
                    return;
                }
            }

            if (extractedText) {
                await evaluateAndSave(extractedText, resolvedName || 'Inspected Product', detectedBarcode, imageSrc);
            } else {
                setScanStatus('Could not extract text. Please enter label text manually.');
                setShowManualTextarea(true);
                setIsScanning(false);
            }
        } catch (err: any) {
            console.error('Scan processing failed:', err);
            alert('Scan processing failed: ' + err.message);
            setIsScanning(false);
        }
    };

    const evaluateAndSave = async (textToAnalyse: string, nameToUse: string, codeToUse: string, imageSrc?: string) => {
        setIsScanning(true);
        setScanStatus('Running Legal Metrology Compliance Engine...');
        try {
            const finalName = nameToUse || productName || 'Inspected Product';
            const scanData = buildScanResult(textToAnalyse, finalName, codeToUse || barcode || undefined, imageSrc || imagePreview || undefined);
            
            const savedProduct = await addScanResult(scanData);
            onSelectProduct(savedProduct);
        } catch (error: any) {
            console.error('Failed to run analysis:', error);
            alert('Failed to save compliance analysis: ' + error.message);
        } finally {
            setIsScanning(false);
            setScanStatus('');
        }
    };

    const triggerManualAnalysis = async () => {
        if (!rawText.trim()) {
            alert('Please enter label text first.');
            return;
        }
        await evaluateAndSave(rawText, productName, barcode, imagePreview || undefined);
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400" />
                    New Compliance Inspection
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Upload or snap a picture of the product packaging declarations. The AI engine will extract and check declarations.
                </p>
            </div>

            {/* Main Interactive Scan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Upload Section */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Scan Packaging Image</h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                            Take a direct photo of the specifications block or upload an existing image.
                        </p>

                        {/* Capture Actions */}
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => setShowCamera(true)}
                                disabled={isScanning}
                                className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                            >
                                <Camera size={20} />
                                Take Photo with Camera
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isScanning}
                                className="flex items-center justify-center gap-2 w-full py-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 text-gray-700 dark:text-white font-bold rounded-2xl transition-all cursor-pointer"
                            >
                                <Upload size={20} />
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
                    </div>

                    {/* Previews / Live Status */}
                    <div className="mt-8">
                        {imagePreview && (
                            <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black flex items-center justify-center">
                                <img src={imagePreview} alt="Preview" className="h-full object-contain" />
                                <button
                                    onClick={() => {
                                        setImagePreview(null);
                                        setRawText('');
                                        setProductName('');
                                        setBarcode('');
                                        setShowManualTextarea(false);
                                    }}
                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 rounded-full text-xs font-semibold cursor-pointer"
                                >
                                    ✕ Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status / Manual Override Panel */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Extraction Status</h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                            Real-time tracking of AI OCR character extraction and rule verification.
                        </p>

                        {/* Loading / Status */}
                        {isScanning ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{scanStatus}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This will take a moment...</p>
                            </div>
                        ) : showManualTextarea ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs">
                                    <AlertCircle size={16} />
                                    <span>Provide the label text below to assess rules.</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Product Name (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Parle-G Biscuits"
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Barcode (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 8901725015275"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Label Text</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Paste or type all declarations / text visible on the product packaging..."
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <button
                                    onClick={triggerManualAnalysis}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer text-sm"
                                >
                                    Analyze & Run Compliance Check
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 dark:text-gray-500">
                                <FileText size={48} className="mb-3" />
                                <p className="text-sm">Awaiting label photo or image upload</p>
                                <p className="text-xs mt-1">Once uploaded, OCR will execute instantly.</p>
                            </div>
                        )}
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
