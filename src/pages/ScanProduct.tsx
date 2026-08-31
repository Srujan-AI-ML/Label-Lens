import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import { CameraModal } from '../components/CameraModal';
import { detectBarcode, lookupProduct, extractTextFromImage as _extractTextFromImage, scanProductImageWithGemini, saveUserGeminiApiKey } from '../services/visionService';
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
    Camera, Upload, ArrowLeft, Sparkles, Tag, Scale, DollarSign, 
    Factory, Phone, Calendar, Clock, Shield, Globe, Layers, Save, RotateCcw,
    ScanLine, X, Key, CheckCircle, AlertCircle, HelpCircle, FileText, CheckCircle2, Loader2, RefreshCw, Image as ImageIcon
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

export type ScanStage = 'idle' | 'uploading' | 'analyzing' | 'checking' | 'generating' | 'complete' | 'error';

interface ScanProductProps {
    onNavigate: (page: PageType) => void;
    onSelectProduct: (product: ScannedProduct) => void;
}

export const ScanProduct: React.FC<ScanProductProps> = ({ onNavigate, onSelectProduct }) => {
    const { addScanResult } = useProduct();
    const [showCamera, setShowCamera] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStage, setScanStage] = useState<ScanStage>('idle');
    const [scanStatus, setScanStatus] = useState('');
    const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
    
    // Drag and Drop state
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [selectedFileInfo, setSelectedFileInfo] = useState<{ name: string; size: string } | null>(null);

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
    const [regulatoryLicense, setRegulatoryLicense] = useState('');
    const [countryOfOrigin, setCountryOfOrigin] = useState('India');
    const [unitPrice, setUnitPrice] = useState('');
    const [category, setCategory] = useState<ProductCategory>('Food & Beverage');
    const [notes, setNotes] = useState('');
    const [rawText, setRawText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Spatial and Visual Quality AI Evidence
    const [spatialData, setSpatialData] = useState<any>(null);
    const [visualQualityData, setVisualQualityData] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Prevent default browser file opening when dragging anywhere in window
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
        if (productName) parts.push(`Product Name: ${productName}`);
        if (manufacturer) parts.push(`Manufacturer: ${manufacturer}`);
        if (netQuantity) parts.push(`Net Quantity: ${netQuantity} ${quantityUnit}`);
        if (mrp) parts.push(`MRP: ${mrp.startsWith('₹') ? mrp : `₹${mrp}`}`);
        if (mfgDate) parts.push(`Mfg Date: ${mfgDate}`);
        if (expiryDate) parts.push(`Expiry Date: ${expiryDate}`);
        if (consumerCare) parts.push(`Consumer Care: ${consumerCare}`);
        if (fssaiLicense && category === 'Food & Beverage') parts.push(`FSSAI Lic No: ${fssaiLicense}`);
        if (regulatoryLicense && category !== 'Food & Beverage') parts.push(`${currentCategorySpec.regulatoryField.label}: ${regulatoryLicense}`);
        if (countryOfOrigin) parts.push(`Country of Origin: ${countryOfOrigin}`);
        if (unitPrice) parts.push(`Unit Sale Price: ${unitPrice}`);
        return parts.join('\n');
    }, [productName, manufacturer, netQuantity, quantityUnit, mrp, mfgDate, expiryDate, consumerCare, fssaiLicense, regulatoryLicense, countryOfOrigin, unitPrice, category, currentCategorySpec]);

    // Live analysis on current synthesized text & form state
    const liveAnalysis = useMemo(() => {
        return analyseCompliance(
            rawText || synthesizedText,
            {
                productName,
                manufacturer,
                netQuantity,
                quantityUnit,
                mrp,
                manufactureDate: mfgDate,
                expiryDate,
                consumerCare,
                fssaiLicense: category === 'Food & Beverage' ? fssaiLicense : '',
                regulatoryLicense: category !== 'Food & Beverage' ? regulatoryLicense : '',
                countryOfOrigin,
                unitPrice,
                category
            },
            category,
            spatialData,
            visualQualityData
        );
    }, [rawText, synthesizedText, productName, manufacturer, netQuantity, quantityUnit, mrp, mfgDate, expiryDate, consumerCare, fssaiLicense, regulatoryLicense, countryOfOrigin, unitPrice, category, spatialData, visualQualityData]);

    const handleCameraCapture = async (imageSrc: string) => {
        setShowCamera(false);
        setImagePreview(imageSrc);
        setSelectedFileInfo({ name: 'Camera_Snapshot.jpg', size: 'Captured Photo' });
        await processLabelImage(imageSrc);
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
                await processLabelImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFileObject(file);
    };

    // Drag-and-drop event handlers
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

    const autoPopulateFromText = (extractedText: string, currentName: string = '', currentBarcode: string = '') => {
        const analysis = analyseCompliance(extractedText, currentName, category);
        const decs = analysis.declarations;

        if (decs.genericName?.present && decs.genericName.value) {
            const val = decs.genericName.value;
            setProductName(prev => prev || val);
        } else if (currentName) {
            setProductName(prev => prev || currentName);
        }
        if (decs.netQuantity?.present && decs.netQuantity.value) {
            const qtyMatch = decs.netQuantity.value.match(/([\d.,]+)\s*([a-zA-Z]+)/);
            if (qtyMatch) {
                setNetQuantity(prev => prev || qtyMatch[1]);
                const unit = qtyMatch[2].toLowerCase();
                if (['g', 'kg', 'ml', 'l', 'pcs', 'units'].includes(unit)) {
                    setQuantityUnit(unit === 'l' ? 'L' : unit);
                }
            } else {
                const val = decs.netQuantity.value;
                setNetQuantity(prev => prev || val);
            }
        }
        if (decs.mrp?.present && decs.mrp.value) {
            const cleanMrp = decs.mrp.value.replace(/[₹\s,]/g, '');
            setMrp(prev => prev || cleanMrp);
        }
        if (decs.manufactureDate?.present && decs.manufactureDate.value) {
            const val = formatToISODate(decs.manufactureDate.value) || decs.manufactureDate.value;
            setMfgDate(prev => prev || val);
        }
        if (decs.bestBefore?.present && decs.bestBefore.value) {
            const val = formatToISODate(decs.bestBefore.value) || decs.bestBefore.value;
            setExpiryDate(prev => prev || val);
        }
        if (decs.manufacturer?.present && decs.manufacturer.value) {
            const val = decs.manufacturer.value;
            setManufacturer(prev => prev || val);
        }
        if (decs.consumerCare?.present && decs.consumerCare.value) {
            const val = decs.consumerCare.value;
            setConsumerCare(prev => prev || val);
        }
        if (decs.fssaiLicense?.present && decs.fssaiLicense.value) {
            const fssaiMatch = decs.fssaiLicense.value.match(/\d{14}/);
            const val = fssaiMatch ? fssaiMatch[0] : decs.fssaiLicense.value;
            setFssaiLicense(prev => prev || val);
        }
        if (decs.countryOfOrigin?.present && decs.countryOfOrigin.value) {
            const cleanOrigin = decs.countryOfOrigin.value.replace(/\(inferred\)/i, '').trim();
            setCountryOfOrigin(prev => prev || cleanOrigin);
        }
        if (decs.retailSalePrice?.present && decs.retailSalePrice.value) {
            const val = decs.retailSalePrice.value;
            setUnitPrice(prev => prev || val);
        }

        // Fallback barcode detection from extracted text
        if (!currentBarcode.trim() || currentBarcode.trim() === '') {
            const barcodeRegex = /(?:barcode|gtin|upc|ean)\s*[:\-]?\s*(\d{8,15})/i;
            const match = extractedText.match(barcodeRegex);
            if (match) {
                setBarcode(prev => prev || match[1].trim());
            } else {
                const cleanText = extractedText.replace(/\s+/g, '');
                const standaloneMatch = cleanText.match(/(\d{8,15})/);
                if (standaloneMatch) {
                    setBarcode(prev => prev || standaloneMatch[1]);
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
        setRegulatoryLicense('');
        setCountryOfOrigin('India');
        setUnitPrice('');
        setNotes('');
        setRawText('');
        setScanErrorMsg(null);

        setIsScanning(true);
        // Stage 1: Uploading
        setScanStage('uploading');
        setScanStatus('Uploading packaging image and preparing high-resolution payload...');

        const base64Data = imageSrc.split(',')[1] || imageSrc;
        let detectedBarcode = '';
        let detectedName = '';

        try {
            // Stage 2: Analyzing label (Gemini AI Vision Analysis & Barcode reading)
            setScanStage('analyzing');
            setScanStatus('Running Google Gemini AI Multimodal Vision Analysis...');

            // Step 1: Detect Barcode
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
                console.warn('Barcode lookup notice:', barcodeErr);
            }

            // Step 2: Google Gemini AI Multimodal Vision Analysis (Preserved exactly)
            const scanResult = await scanProductImageWithGemini(imageSrc);
            const { text, product, spatial, visualQuality } = scanResult;

            if (text) {
                setRawText(text);
            }

            if (spatial) {
                setSpatialData(spatial);
            }
            if (visualQuality) {
                setVisualQualityData(visualQuality);
            }

            // Stage 3: Checking results (Validating extracted declarations & category classification)
            setScanStage('checking');
            setScanStatus('Classifying product category and verifying regulatory license syntax...');

            // Step 3: Intelligent Category Detection based on extracted text & product identity
            const catDetection = detectProductCategory(
                text || '',
                product?.productName || detectedName || '',
                product?.brand || ''
            );
            setCategory(catDetection.category);
            console.log(`[Category Engine] Detected category: ${catDetection.category} (${catDetection.reason})`);

            // Step 4: Populate designated form fields from structured Gemini output
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

            // Step 5: Run auto-populate fallback on raw text to capture any unfilled fields
            if (text && text.trim()) {
                autoPopulateFromText(text, detectedName, detectedBarcode);
            }

            // Stage 4: Generating result
            setScanStage('generating');
            setScanStatus('Synthesizing Legal Metrology compliance matrix...');

            // Transition to Complete state smoothly
            setTimeout(() => {
                setScanStage('complete');
                setScanStatus(`✅ Analysis complete: Classified as [${catDetection.category}]. Review details below.`);
                setIsScanning(false);
            }, 400);

            console.log('--- [PIPELINE] FORM STATE UPDATED ---');
            console.log('--- [PIPELINE] SCAN COMPLETE ---');

        } catch (err: any) {
            console.error('--- [PIPELINE] Scan processing failed:', err);
            if (detectedName) {
                setProductName(detectedName);
            }
            setScanStage('error');
            setScanErrorMsg(err.message || 'Image analysis encountered an error. You can enter or edit specifics manually below.');
            setScanStatus(`⚠️ Scanning notice: ${err.message || 'Image loaded'}`);
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
            fssaiLicense,
            regulatoryLicense,
            category
        });

        if (!validation.isValid) {
            alert(`⚠️ Validation Error:\n${validation.errorMsg}`);
            return;
        }

        setIsScanning(true);
        try {
            const nameToUse = productName.trim() || 'Inspected Commodity';
            const scanData = buildScanResult(
                synthesizedText,
                {
                    productName: nameToUse,
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
                category,
                spatialData,
                visualQualityData
            );
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
        setRegulatoryLicense('');
        setCountryOfOrigin('India');
        setUnitPrice('');
        setCategory('Food & Beverage');
        setNotes('');
        setRawText('');
        setSpatialData(null);
        setVisualQualityData(null);
        setImagePreview(null);
        setSelectedFileInfo(null);
        setScanStage('idle');
        setScanStatus('');
        setScanErrorMsg(null);
    };

    // Declarations checklist icons tailored to category
    const dynamicChecklistItems = useMemo(() => {
        return currentCategorySpec.mandatoryDeclarations.map(decl => {
            let icon = Tag;
            let emoji = '🏷️';

            if (decl.key === 'genericName') { icon = Tag; emoji = '🏷️'; }
            else if (decl.key === 'netQuantity') { icon = Scale; emoji = '⚖️'; }
            else if (decl.key === 'mrp') { icon = DollarSign; emoji = '💰'; }
            else if (decl.key === 'manufactureDate') { icon = Calendar; emoji = '📅'; }
            else if (decl.key === 'bestBefore') { icon = Clock; emoji = '⌛'; }
            else if (decl.key === 'manufacturer') { icon = Factory; emoji = '🏭'; }
            else if (decl.key === 'consumerCare') { icon = Phone; emoji = '📞'; }
            else if (decl.key === 'fssaiLicense' || decl.key.includes('License') || decl.key.includes('Registration')) { icon = Shield; emoji = '🛡️'; }
            else if (decl.key === 'countryOfOrigin') { icon = Globe; emoji = '🌐'; }
            else if (decl.key === 'retailSalePrice') { icon = Layers; emoji = '💵'; }

            const declObj = liveAnalysis.declarations[decl.key] || (decl.key === currentCategorySpec.regulatoryField.key ? liveAnalysis.declarations.regulatoryLicense : undefined);
            const isNotApp = decl.requirement === 'NOT_APPLICABLE';
            const isPass = declObj?.present && declObj?.status !== 'FAIL';

            return {
                key: decl.key,
                title: decl.label,
                requirement: decl.requirement,
                icon,
                emoji,
                isNotApp,
                isPass,
                value: declObj?.value || null,
            };
        });
    }, [currentCategorySpec, liveAnalysis]);

    const processingSteps = [
        { id: 'uploading', label: 'Uploading', desc: 'Preparing image payload' },
        { id: 'analyzing', label: 'Analyzing label', desc: 'Gemini AI Vision reading package text' },
        { id: 'checking', label: 'Checking results', desc: 'Validating GTIN & category regulations' },
        { id: 'generating', label: 'Generating result', desc: 'Synthesizing compliance inspection' }
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
                    Enter product specifics in the grid below or upload/scan packaging to check category-aware declarations compliance under Legal Metrology Rules.
                </p>
            </div>

            {/* Main Workspace Layout (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column (2/3 width): Specifics Grid Form or Image Upload */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Modern SaaS Drag & Drop Image Upload Card */}
                    <div 
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative rounded-3xl p-6 transition-all duration-300 border ${
                            isDraggingOver 
                                ? 'bg-blue-900/20 border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500'
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/60 shadow-sm'
                        }`}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                        />

                        {/* If No Image is Selected and not Scanning: Modern Drop Zone Empty State */}
                        {!imagePreview && !isScanning && (
                            <div className="flex flex-col items-center justify-center text-center py-6 px-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                                    isDraggingOver
                                        ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30'
                                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40'
                                }`}>
                                    {isDraggingOver ? <Sparkles size={30} className="animate-pulse" /> : <Upload size={28} />}
                                </div>

                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                    {isDraggingOver ? 'Drop image to start scanning' : 'Scan a Product Label'}
                                </h3>
                                
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                                    {isDraggingOver 
                                        ? 'Release your file here to run Google Gemini Multimodal Vision analysis'
                                        : 'Drag & drop your product image here, or browse files from your device to automatically detect declarations'
                                    }
                                </p>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.02]"
                                    >
                                        <Upload size={15} />
                                        Browse Image
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowCamera(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                                    >
                                        <Camera size={15} />
                                        Use Camera
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 mt-4 text-[11px] text-gray-400 dark:text-gray-500">
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">JPG</span>
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">PNG</span>
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">WEBP</span>
                                    <span>• up to 25 MB</span>
                                </div>
                            </div>
                        )}

                        {/* Image Preview & Active File Details */}
                        {imagePreview && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-700/60">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1.5 bg-blue-50 dark:bg-blue-950 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                                            <ImageIcon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {selectedFileInfo?.name || 'Attached Packaging Photo'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {selectedFileInfo?.size || 'Image Ready'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isScanning}
                                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                        >
                                            Change
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetScan}
                                            disabled={isScanning}
                                            className="px-3 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black flex items-center justify-center shadow-inner">
                                        <img src={imagePreview} alt="Packaging Preview" className="h-full w-full object-contain" />
                                    </div>

                                    {/* Multi-Step Real Processing Stepper */}
                                    <div className="p-4 bg-gray-50/70 dark:bg-gray-900/60 rounded-2xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            Inspection Lifecycle
                                        </p>

                                        <div className="space-y-2.5">
                                            {processingSteps.map((step, idx) => {
                                                const status = getStepStatus(step.id);

                                                return (
                                                    <div key={step.id} className="flex items-start gap-3">
                                                        {/* Status Indicator Icon */}
                                                        <div className="pt-0.5 shrink-0">
                                                            {status === 'completed' ? (
                                                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                                                    <CheckCircle2 size={13} />
                                                                </div>
                                                            ) : status === 'active' ? (
                                                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center animate-spin">
                                                                    <Loader2 size={13} />
                                                                </div>
                                                            ) : status === 'error' ? (
                                                                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center">
                                                                    <AlertCircle size={13} />
                                                                </div>
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                                                                    {idx + 1}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Step Text Info */}
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-xs font-bold ${
                                                                status === 'completed'
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : status === 'active'
                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                    : status === 'error'
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : 'text-gray-400 dark:text-gray-500'
                                                            }`}>
                                                                {step.label}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                                                {step.desc}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error & API Alert Banner */}
                        {scanErrorMsg && (
                            <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="block font-bold">Scan Notice:</strong>
                                        <span>{scanErrorMsg}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (imagePreview) processLabelImage(imagePreview);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                                >
                                    <RefreshCw size={12} />
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Success Status Banner */}
                        {scanStage === 'complete' && scanStatus && (
                            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                    <span>{scanStatus}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Specifics Grid Form */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 gap-2">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span>📋</span> Category-Aware Declarations Grid
                                </h2>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Dynamic regulatory requirements customized for: <span className="font-bold text-blue-600 dark:text-blue-400">{category}</span>
                                </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full">
                                {dynamicChecklistItems.filter(d => d.isPass).length} / {dynamicChecklistItems.filter(d => !d.isNotApp).length} Applicable Met
                            </span>
                        </div>

                        {/* Category Selector Bar */}
                        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                            <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1.5 flex items-center justify-between">
                                <span>📦 Product Category (Determines Applicable Regulatory Rules)</span>
                                <span className="text-[10px] font-normal text-blue-700 dark:text-blue-300">Auto-detected / Selectable</span>
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
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 italic">
                                {currentCategorySpec.description}
                            </p>
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
                                    placeholder="e.g. 25.00 (incl. of all taxes)"
                                    value={mrp}
                                    onChange={(e) => handleMrpChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                />
                            </div>

                            {/* 4. Barcode / GTIN with Real-time Check-Digit Validation Badge */}
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
                                            {barcodeValidation.isValid ? '✓ Check Digit Verified' : '✗ Checksum Mismatch'}
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. 8901058005080 (GTIN-13)"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                />
                                {barcode && (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate" title={barcodeValidation.message}>
                                        {barcodeValidation.message}
                                    </p>
                                )}
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

                            {/* 6. Expiry / Best Before (Shows relevance for category) */}
                            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <span>⌛</span> Best Before / Expiry Date
                                    </label>
                                    <span className="text-[10px] text-gray-400">
                                        {category === 'Electrical / Electronic Products' || category === 'Toys' || category === 'Textiles / Garments'
                                            ? '(Optional / Non-perishable)'
                                            : '(Mandatory)'}
                                    </span>
                                </div>
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
                                        placeholder="e.g. 10012022000046 (14 digits)"
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
                                <p className="text-[10px] text-gray-400 mt-1">
                                    {regulatoryValidation.message || currentCategorySpec.regulatoryField.helpText}
                                </p>
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

                            {/* 12. Inspector Field Notes (Full width) */}
                            <div className="sm:col-span-2 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
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
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                            >
                                <Sparkles size={16} />
                                Save & View Certificate
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column (1/3 width): Side Box Category-Aware Checklist */}
                <div className="lg:col-span-1">
                    <div className="sticky top-20 bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Compliance Checklist</h3>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">{category}</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black ${
                                    liveAnalysis.complianceScore === 100
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : liveAnalysis.complianceScore > 50
                                        ? 'text-amber-500'
                                        : 'text-rose-600'
                                }`}>
                                    {liveAnalysis.complianceScore}%
                                </span>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">{liveAnalysis.complianceStatus}</p>
                            </div>
                        </div>

                        {/* Rules checkboxes with ticks/crosses/NA */}
                        <div className="space-y-2">
                            {dynamicChecklistItems.map((item) => {
                                return (
                                    <div
                                        key={item.key}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                                            item.isNotApp
                                                ? 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700/50 opacity-75'
                                                : item.isPass
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30'
                                                : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <span className="text-sm">{item.emoji}</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate text-[11px]">
                                                {item.title}
                                            </span>
                                        </div>

                                        <div className="shrink-0">
                                            {item.isNotApp ? (
                                                <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 font-bold text-[10px]">
                                                    — N/A
                                                </span>
                                            ) : item.isPass ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                                    <CheckCircle size={12} /> Pass
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                                                    <AlertCircle size={12} /> Fail
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
