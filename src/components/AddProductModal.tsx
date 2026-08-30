import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from './CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage as _extractTextFromImage, scanProductImageWithGemini } from '../services/visionService';
import { analyseCompliance, buildScanResult, validateProductSpecifics, calculateUnitSalePrice } from '../services/complianceService';
import {
    ALL_CATEGORIES,
    CATEGORY_REQUIREMENTS,
    detectProductCategory,
    normalizeCategory,
    validateBarcodeGTIN,
    validateFSSAI,
    validateCategoryLicense,
    type ProductCategory,
} from '../services/categoryRequirements';
import {
    X, Camera, Upload, Sparkles, Save, RotateCcw, ArrowRight, ScanLine, CheckCircle, AlertCircle,
    CheckCircle2, Loader2, RefreshCw, Image as ImageIcon
} from 'lucide-react';
import type { ScannedProduct, ComplianceDeclarations } from '../types';
import type { ScanStage } from '../pages/ScanProduct';

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
    const [scanStage, setScanStage] = useState<ScanStage>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);

    // Drag-and-drop state
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; size: string } | null>(null);

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
    const [regulatoryLicense, setRegulatoryLicense] = useState('');
    const [countryOfOrigin, setCountryOfOrigin] = useState('India');
    const [unitPrice, setUnitPrice] = useState('');
    const [category, setCategory] = useState<ProductCategory>('Food & Beverage');
    const [notes, setNotes] = useState('');
    const [_rawText, setRawText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Prevent default browser navigation when dropping anywhere in window
    useEffect(() => {
        const handleWindowDragOver = (e: DragEvent) => {
            e.preventDefault();
        };
        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault();
        };

        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('drop', handleWindowDrop);

        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, []);

    const currentCategorySpec = CATEGORY_REQUIREMENTS[category] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];

    const handleNetQuantityChange = (val: string) => {
        setNetQuantity(val);
        const calculated = calculateUnitSalePrice(mrp, val, quantityUnit);
        if (calculated) {
            setUnitPrice(calculated);
        } else if (!val.trim()) {
            setUnitPrice('');
        }
    };

    const handleQuantityUnitChange = (val: string) => {
        setQuantityUnit(val);
        const calculated = calculateUnitSalePrice(mrp, netQuantity, val);
        if (calculated) {
            setUnitPrice(calculated);
        }
    };

    const handleMrpChange = (val: string) => {
        setMrp(val);
        const calculated = calculateUnitSalePrice(val, netQuantity, quantityUnit);
        if (calculated) {
            setUnitPrice(calculated);
        } else if (!val.trim()) {
            setUnitPrice('');
        }
    };

    const handleCategoryChange = (newCat: ProductCategory) => {
        setCategory(newCat);
        if (newCat === 'Food & Beverage') {
            if (!fssaiLicense && regulatoryLicense) {
                setFssaiLicense(regulatoryLicense);
            }
        } else {
            if (!regulatoryLicense && fssaiLicense) {
                setRegulatoryLicense(fssaiLicense);
            }
        }
    };

    // Live validation states
    const barcodeValidation = useMemo(() => {
        return validateBarcodeGTIN(barcode);
    }, [barcode]);

    const activeRegulatoryValue = category === 'Food & Beverage' ? fssaiLicense : regulatoryLicense;

    const regulatoryValidation = useMemo(() => {
        if (category === 'Food & Beverage') {
            return validateFSSAI(fssaiLicense);
        }
        return validateCategoryLicense(category, regulatoryLicense);
    }, [category, fssaiLicense, regulatoryLicense]);

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
        if (fssaiLicense && category === 'Food & Beverage') parts.push(`FSSAI Lic No: ${fssaiLicense}`);
        if (regulatoryLicense && category !== 'Food & Beverage') parts.push(`${currentCategorySpec.regulatoryField.label}: ${regulatoryLicense}`);
        if (countryOfOrigin) parts.push(`Country of Origin: ${countryOfOrigin}`);
        if (unitPrice) parts.push(`Unit Sale Price: ${unitPrice}`);
        return parts.join('\n');
    }, [productName, manufacturer, netQuantity, quantityUnit, mrp, mfgDate, expiryDate, consumerCare, fssaiLicense, regulatoryLicense, countryOfOrigin, unitPrice, category, currentCategorySpec]);

    // Live Category-Aware Legal Metrology Compliance Analysis
    const liveAnalysis = useMemo(() => {
        return analyseCompliance(
            synthesizedText,
            {
                productName: productName || 'Inspected Product',
                mrp,
                netQuantity,
                quantityUnit,
                manufactureDate: mfgDate,
                expiryDate,
                manufacturer,
                consumerCare,
                fssaiLicense: category === 'Food & Beverage' ? fssaiLicense : '',
                regulatoryLicense: category !== 'Food & Beverage' ? regulatoryLicense : '',
                countryOfOrigin,
                unitPrice,
                category
            },
            category
        );
    }, [synthesizedText, productName, mrp, netQuantity, quantityUnit, mfgDate, expiryDate, manufacturer, consumerCare, fssaiLicense, regulatoryLicense, countryOfOrigin, unitPrice, category]);

    if (!isOpen) return null;

    const handleCameraCapture = async (imageSrc: string) => {
        setShowCamera(false);
        setImagePreview(imageSrc);
        setSelectedFileInfo({ name: 'Camera_Snapshot.jpg', size: 'Captured Photo' });
        await processUploadedImage(imageSrc);
    };

    const processFileObject = (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select or drop a valid image file (JPG, PNG, WEBP, etc.)');
            return;
        }

        const sizeFormatted = file.size < 1024 * 1024 
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        setSelectedFileInfo({ name: file.name, size: sizeFormatted });

        const reader = new FileReader();
        reader.onload = async () => {
            if (typeof reader.result === 'string') {
                setImagePreview(reader.result);
                await processUploadedImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFileObject(file);
    };

    // Drag and drop event handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingOver) setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            processFileObject(file);
        }
    };

    const formatToISODate = (dateStr: string): string => {
        if (!dateStr) return '';
        const cleanStr = dateStr.trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            return cleanStr;
        }

        const dmyMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})$/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            let year = dmyMatch[3];
            if (year.length === 2) year = '20' + year;
            return `${year}-${month}-${day}`;
        }

        const myMatch = cleanStr.match(/^(\d{1,2})[\.\/\-](\d{2,4})$/);
        if (myMatch) {
            const month = myMatch[1].padStart(2, '0');
            let year = myMatch[2];
            if (year.length === 2) year = '20' + year;
            return `${year}-${month}-01`;
        }

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

        const parsed = new Date(cleanStr);
        if (!isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        return '';
    };

    const autoPopulateFromText = (extractedText: string, currentName: string = '', currentBarcode: string = '') => {
        const analysis = analyseCompliance(extractedText, currentName, category);
        const decs = analysis.declarations;

        if (decs.genericName?.present && decs.genericName.value) {
            setProductName(decs.genericName.value);
        } else if (currentName) {
            setProductName(currentName);
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
            const val = fssaiMatch ? fssaiMatch[0] : decs.fssaiLicense.value;
            setFssaiLicense(val);
            setRegulatoryLicense(val);
        }
        if (decs.countryOfOrigin?.present && decs.countryOfOrigin.value) {
            const cleanOrigin = decs.countryOfOrigin.value.replace(/\(inferred\)/i, '').trim();
            setCountryOfOrigin(cleanOrigin);
        }
        if (decs.retailSalePrice?.present && decs.retailSalePrice.value) {
            setUnitPrice(decs.retailSalePrice.value);
        }

        // Fallback barcode detection from extracted text
        if (!currentBarcode.trim()) {
            const barcodeRegex = /(?:barcode|gtin|upc|ean)\s*[:\-]?\s*(\d{8,15})/i;
            const match = extractedText.match(barcodeRegex);
            if (match) {
                setBarcode(match[1].trim());
            }
        }
    };

    const processUploadedImage = async (imageSrc: string) => {
        setProductName('');
        setBarcode('');
        setNetQuantity('');
        setMrp('');
        setMfgDate('');
        setExpiryDate('');
        setManufacturer('');
        setConsumerCare('');
        setFssaiLicense('');
        setRegulatoryLicense('');
        setCountryOfOrigin('India');
        setUnitPrice('');
        setNotes('');
        setRawText('');
        setScanErrorMsg(null);

        setIsProcessing(true);
        // Stage 1: Uploading
        setScanStage('uploading');
        setStatusMsg('Uploading packaging image and preparing payload...');

        const base64Data = imageSrc.split(',')[1] || imageSrc;
        let detectedBarcode = '';
        let detectedName = '';

        try {
            // Stage 2: Analyzing label (Gemini AI Multimodal Vision)
            setScanStage('analyzing');
            setStatusMsg('Extracting packaging declarations with Google Gemini AI...');

            // Step 1: Barcode Detection
            try {
                const bcode = await detectBarcode(base64Data);
                if (bcode) {
                    detectedBarcode = bcode;
                    setBarcode(bcode);
                    const info = await lookupProduct(bcode);
                    if (info && info.name) {
                        detectedName = info.name;
                        setProductName(info.name);
                    }
                }
            } catch (barcodeErr) {
                console.warn('Modal barcode detection notice:', barcodeErr);
            }

            // Step 2: Google Gemini AI Multimodal Vision Analysis (Preserved)
            const scanResult = await scanProductImageWithGemini(imageSrc);
            const { text, product } = scanResult;

            if (text) {
                setRawText(text);
            }

            // Stage 3: Checking results (Category Classification & License Validation)
            setScanStage('checking');
            setStatusMsg('Classifying category and validating regulatory specifics...');

            // Step 3: Category Detection
            const catDetection = detectProductCategory(
                text || '',
                product?.productName || detectedName || '',
                product?.brand || ''
            );
            setCategory(catDetection.category);

            // Step 4: Populate modal input fields directly from structured Gemini data
            if (product) {
                if (product.productName) {
                    setProductName(product.productName);
                } else if (detectedName) {
                    setProductName(detectedName);
                }

                if (product.netQuantity) {
                    setNetQuantity(product.netQuantity);
                }
                if (product.quantityUnit) {
                    const u = product.quantityUnit.toLowerCase();
                    if (['g', 'kg', 'ml', 'l', 'pcs', 'units'].includes(u)) {
                        setQuantityUnit(u === 'l' ? 'L' : u);
                    } else {
                        setQuantityUnit(product.quantityUnit);
                    }
                }
                if (product.mrp) {
                    const cleanMrp = String(product.mrp).replace(/[₹\s,]/g, '');
                    setMrp(cleanMrp);
                }
                if (product.manufacturingDate) {
                    const formatted = formatToISODate(product.manufacturingDate);
                    setMfgDate(formatted || product.manufacturingDate);
                }
                if (product.expiryDate) {
                    const formatted = formatToISODate(product.expiryDate);
                    setExpiryDate(formatted || product.expiryDate);
                }

                const mfgFull = [product.manufacturerName, product.manufacturerAddress].filter(Boolean).join(', ');
                if (mfgFull) {
                    setManufacturer(mfgFull);
                }

                if (product.consumerCare) {
                    setConsumerCare(product.consumerCare);
                }
                if (product.fssaiLicense) {
                    const fMatch = String(product.fssaiLicense).match(/\d{14}/);
                    const licVal = fMatch ? fMatch[0] : String(product.fssaiLicense);
                    setFssaiLicense(licVal);
                    setRegulatoryLicense(licVal);
                }
                if (product.countryOfOrigin) {
                    setCountryOfOrigin(product.countryOfOrigin);
                }
                if (product.unitSalePrice) {
                    setUnitPrice(product.unitSalePrice);
                }
                if (product.barcode) {
                    setBarcode(product.barcode);
                } else if (detectedBarcode) {
                    setBarcode(detectedBarcode);
                }
            }

            // Step 5: Fallback auto-populate on raw text
            if (text && text.trim()) {
                autoPopulateFromText(text, detectedName, detectedBarcode);
            }

            // Stage 4: Generating result
            setScanStage('generating');
            setStatusMsg('Synthesizing Legal Metrology compliance matrix...');

            setTimeout(() => {
                setScanStage('complete');
                setStatusMsg(`✅ Declarations extracted & classified as [${catDetection.category}]! Review specifics below.`);
                setIsProcessing(false);
            }, 400);

        } catch (err: any) {
            console.error('Scan processing error:', err);
            if (detectedName) {
                setProductName(detectedName);
            }
            setScanStage('error');
            setScanErrorMsg(err.message || 'Image scanning encountered an error. You can fill specifics directly in the grid.');
            setStatusMsg(`⚠️ Notice: ${err.message || 'Image loaded'}`);
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
            fssaiLicense,
            regulatoryLicense,
            category
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
                {
                    productName: finalName,
                    mrp: mrp.trim(),
                    netQuantity: netQuantity.trim(),
                    quantityUnit: quantityUnit,
                    manufactureDate: mfgDate.trim(),
                    expiryDate: expiryDate.trim(),
                    manufacturer: manufacturer.trim(),
                    consumerCare: consumerCare.trim(),
                    fssaiLicense: category === 'Food & Beverage' ? fssaiLicense.trim() : undefined,
                    regulatoryLicense: category !== 'Food & Beverage' ? regulatoryLicense.trim() : undefined,
                    countryOfOrigin: countryOfOrigin.trim(),
                    unitPrice: unitPrice.trim(),
                    category
                },
                barcode.trim() || undefined,
                imagePreview || undefined,
                category
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
        setRegulatoryLicense('');
        setCountryOfOrigin('India');
        setUnitPrice('');
        setCategory('Food & Beverage');
        setNotes('');
        setRawText('');
        setImagePreview(null);
        setSelectedFileInfo(null);
        setScanStage('idle');
        setStatusMsg('');
        setScanErrorMsg(null);
    };

    // Category-specific checklist items
    const dynamicChecklistItems = useMemo(() => {
        return currentCategorySpec.mandatoryDeclarations.map(decl => {
            const declObj = liveAnalysis.declarations[decl.key] || (decl.key === currentCategorySpec.regulatoryField.key ? liveAnalysis.declarations.regulatoryLicense : undefined);
            const isNotApp = decl.requirement === 'NOT_APPLICABLE';
            const isPass = declObj?.present && declObj?.status !== 'FAIL';

            return {
                key: decl.key,
                label: decl.label,
                requirement: decl.requirement,
                isNotApp,
                isPass,
            };
        });
    }, [currentCategorySpec, liveAnalysis]);

    const processingSteps = [
        { id: 'uploading', label: 'Uploading', desc: 'Preparing image payload' },
        { id: 'analyzing', label: 'Analyzing label', desc: 'Gemini AI reading text' },
        { id: 'checking', label: 'Checking results', desc: 'Validating rules & category' },
        { id: 'generating', label: 'Generating result', desc: 'Synthesizing compliance' }
    ];

    const getStepStatus = (stepId: string): 'pending' | 'active' | 'completed' | 'error' => {
        if (scanStage === 'error') {
            const stepOrder = ['uploading', 'analyzing', 'checking', 'generating'];
            const errorIdx = stepOrder.indexOf('analyzing');
            const thisIdx = stepOrder.indexOf(stepId);
            if (thisIdx === errorIdx) return 'error';
            if (thisIdx < errorIdx) return 'completed';
            return 'pending';
        }

        const order = ['idle', 'uploading', 'analyzing', 'checking', 'generating', 'complete'];
        const currentIdx = order.indexOf(scanStage);
        const thisIdx = order.indexOf(stepId);

        if (scanStage === 'complete') return 'completed';
        if (currentIdx === thisIdx) return 'active';
        if (currentIdx > thisIdx) return 'completed';
        return 'pending';
    };

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
                            <p className="text-xs text-white/80">Category-Aware Legal Metrology Verifier</p>
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
                                <Upload size={14} /> Upload & Drag-Drop
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
                                    onClick={() => {
                                        setImagePreview(null);
                                        setSelectedFileInfo(null);
                                        setScanStage('idle');
                                    }}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-1"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Modern Drag & Drop Zone Area (Visible when Upload Tab is selected) */}
                    {activeTab === 'upload' && (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`relative rounded-3xl p-6 transition-all duration-300 border ${
                                isDraggingOver 
                                    ? 'bg-blue-900/20 border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500'
                                    : 'bg-blue-50/20 dark:bg-gray-800/40 border-dashed border-2 border-blue-300 dark:border-blue-700/60'
                            }`}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {!imagePreview && !isProcessing && (
                                <div className="flex flex-col items-center justify-center text-center py-6 px-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 ${
                                        isDraggingOver
                                            ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30'
                                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                    }`}>
                                        {isDraggingOver ? <Sparkles size={28} className="animate-pulse" /> : <Upload size={26} />}
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                                        {isDraggingOver ? 'Drop packaging photo here' : 'Drag & Drop Packaging Photo or Browse'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                                        Supports JPG, PNG, WEBP — Auto-extracts declarations and classifies category via Gemini
                                    </p>
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                                        >
                                            Browse Files
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('camera');
                                                setShowCamera(true);
                                            }}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                                        >
                                            Capture with Camera
                                        </button>
                                    </div>
                                </div>
                            )}

                            {imagePreview && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon size={16} className="text-blue-500" />
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                {selectedFileInfo?.name || 'Packaging Image'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {selectedFileInfo?.size || 'Ready'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                        >
                                            Change Photo
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                                        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black flex items-center justify-center">
                                            <img src={imagePreview} alt="Preview" className="h-full object-contain" />
                                        </div>

                                        {/* Multi-Step Real Processing Stepper */}
                                        <div className="p-3 bg-gray-50/80 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                Analysis Stages
                                            </p>
                                            <div className="space-y-2">
                                                {processingSteps.map((step, idx) => {
                                                    const status = getStepStatus(step.id);
                                                    return (
                                                        <div key={step.id} className="flex items-center gap-2.5">
                                                            <div className="shrink-0">
                                                                {status === 'completed' ? (
                                                                    <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                                                        <CheckCircle2 size={11} />
                                                                    </div>
                                                                ) : status === 'active' ? (
                                                                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center animate-spin">
                                                                        <Loader2 size={11} />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-400 flex items-center justify-center text-[9px] font-bold">
                                                                        {idx + 1}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`text-[11px] font-semibold ${
                                                                status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                                                                status === 'active' ? 'text-blue-600 dark:text-blue-400' :
                                                                'text-gray-400'
                                                            }`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {scanErrorMsg && (
                                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                                    <span>⚠️ {scanErrorMsg}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imagePreview) processUploadedImage(imagePreview);
                                        }}
                                        className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg text-[11px]"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {scanStage === 'complete' && statusMsg && (
                                <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                    <span>{statusMsg}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Two Column Grid: (Left) Specifics Fields Grid | (Right) Category-Aware Checklist Side Box */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Specifics Grid */}
                        <div className="lg:col-span-2 space-y-4">
                            
                            {/* Category Selector Bar */}
                            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                                <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1.5 flex items-center justify-between">
                                    <span>📦 Product Category (Tailors Required Regulatory Fields)</span>
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                >
                                    {ALL_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

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
                                            onChange={(e) => handleNetQuantityChange(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <select
                                            value={quantityUnit}
                                            onChange={(e) => handleQuantityUnitChange(e.target.value)}
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
                                        onChange={(e) => handleMrpChange(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>

                                {/* 4. Barcode / GTIN */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                            <span>🔍</span> Barcode / GTIN Number
                                        </label>
                                        {barcode && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                barcodeValidation.isValid
                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                            }`}>
                                                {barcodeValidation.isValid ? '✓ Valid GTIN' : '✗ Invalid'}
                                            </span>
                                        )}
                                    </div>
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
                                        <span>🏭</span> Name & Complete Address of Manufacturer / Packer *
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

                                {/* 9. Dynamic Category-Specific Regulatory Field */}
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                            <span>🛡️</span> {currentCategorySpec.regulatoryField.label}
                                        </label>
                                        {activeRegulatoryValue && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                regulatoryValidation.isValid
                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                            }`}>
                                                {regulatoryValidation.statusText}
                                            </span>
                                        )}
                                    </div>
                                    {category === 'Food & Beverage' ? (
                                        <input
                                            type="text"
                                            placeholder="e.g. 10015043001129 (14 digits)"
                                            value={fssaiLicense}
                                            onChange={(e) => {
                                                setFssaiLicense(e.target.value);
                                                setRegulatoryLicense(e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder={currentCategorySpec.regulatoryField.placeholder}
                                            value={regulatoryLicense}
                                            onChange={(e) => {
                                                setRegulatoryLicense(e.target.value);
                                                setFssaiLicense(e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                        />
                                    )}
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

                                {/* 12. Inspector Notes */}
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

                        {/* Right Column: Live Rules, 2011 Checklist Side Box */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="p-5 bg-gray-50 dark:bg-gray-850 rounded-3xl border border-gray-200 dark:border-gray-700/70 space-y-3.5">
                                <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-gray-700">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                            Compliance Checklist
                                        </h4>
                                        <p className="text-[10px] text-gray-500">{category}</p>
                                    </div>
                                    <span className={`text-lg font-black ${
                                        liveAnalysis.complianceScore === 100
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : liveAnalysis.complianceScore > 50
                                            ? 'text-amber-500'
                                            : 'text-rose-600'
                                    }`}>
                                        {liveAnalysis.complianceScore}%
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    {dynamicChecklistItems.map((item) => {
                                        return (
                                            <div
                                                key={item.key}
                                                className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                                                    item.isNotApp
                                                        ? 'bg-gray-100/60 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                                                        : item.isPass
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300'
                                                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300'
                                                }`}
                                            >
                                                <span className="truncate pr-2">{item.label}</span>
                                                <span className="font-bold shrink-0">
                                                    {item.isNotApp ? '— N/A' : item.isPass ? '✔️ Pass' : '❌ Fail'}
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
