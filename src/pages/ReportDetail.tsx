import React, { useState, useEffect } from 'react';
import type { ScannedProduct } from '../types';
import { useProduct } from '../context/ProductContext';
import { ArrowLeft, AlertTriangle, Printer, Edit2, FileDown, Save, X } from 'lucide-react';
import { analyseCompliance, calculateUnitSalePrice } from '../services/complianceService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const [editCountryOfOrigin, setEditCountryOfOrigin] = useState('India');
    const [editUnitPrice, setEditUnitPrice] = useState('');
    const [editCategory, setEditCategory] = useState('Food & Beverage');
    const [editNotes, setEditNotes] = useState('');

    useEffect(() => {
        setCurrentProduct(product);
        setNotes(product.notes || '');
    }, [product]);

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
        setEditFssaiLicense(p.declarations?.fssaiLicense?.value || '');
        setEditCountryOfOrigin(p.declarations?.countryOfOrigin?.value || 'India');
        setEditUnitPrice(p.declarations?.retailSalePrice?.value || '');
        setEditCategory(p.category || 'Food & Beverage');
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
                editFssaiLicense ? `FSSAI Lic No: ${editFssaiLicense.trim()}` : '',
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
                    fssaiLicense: editFssaiLicense.trim(),
                    countryOfOrigin: editCountryOfOrigin.trim(),
                    unitPrice: editUnitPrice.trim()
                }
            );

            const mrpToSave = editMrp.trim()
                ? (editMrp.trim().startsWith('₹') ? editMrp.trim() : `₹${editMrp.trim().replace(/[^\d.,]/g, '')}`)
                : undefined;

            const updatedRecord: Partial<ScannedProduct> = {
                productName: editProductName.trim() || 'Inspected Commodity',
                barcode: editBarcode.trim() || undefined,
                mrp: mrpToSave,
                category: editCategory || undefined,
                notes: editNotes.trim() || undefined,
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
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            doc.setFillColor(29, 78, 216);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('LABEL LENS', 15, 18);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(219, 234, 254);
            doc.text('COMPLIANCE INSPECTION CERTIFICATE', 15, 25);
            doc.text(`Certificate ID: ${currentProduct.id}`, 15, 30);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(160, 8, 35, 24, 3, 3, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            doc.text('SCORE', 177, 14, { align: 'center' });
            doc.setFontSize(16);
            doc.setTextColor(29, 78, 216);
            doc.text(`${currentProduct.complianceScore}%`, 177, 21, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text(currentProduct.complianceStatus.toUpperCase(), 177, 26, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(31, 41, 55);
            doc.text('Product Information', 15, 52);
            doc.setLineWidth(0.5);
            doc.setDrawColor(229, 231, 235);
            doc.line(15, 54, 195, 54);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Product Name:', 15, 62);
            doc.setFont('helvetica', 'normal');
            doc.text(currentProduct.productName, 45, 62);
            doc.setFont('helvetica', 'bold');
            doc.text('Barcode GTIN:', 15, 68);
            doc.setFont('helvetica', 'normal');
            doc.text(currentProduct.barcode || 'N/A', 45, 68);
            doc.setFont('helvetica', 'bold');
            doc.text('Category:', 15, 74);
            doc.setFont('helvetica', 'normal');
            doc.text(currentProduct.category || 'Food & Beverage', 45, 74);
            doc.setFont('helvetica', 'bold');
            doc.text('Scan Date:', 15, 80);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date(currentProduct.scannedAt).toLocaleString(), 45, 80);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(31, 41, 55);
            doc.text('Mandatory Declarations Audit (Rules, 2011)', 15, 92);
            const tableRows = [
                ['Generic / Product Name', currentProduct.declarations.genericName.present ? 'PASS' : 'FAIL', currentProduct.declarations.genericName.value || 'Missing', 'Mandatory'],
                ['Net Quantity', currentProduct.declarations.netQuantity.present ? 'PASS' : 'FAIL', currentProduct.declarations.netQuantity.value || 'Missing', 'Mandatory'],
                ['Maximum Retail Price (MRP)', currentProduct.declarations.mrp.present ? 'PASS' : 'FAIL', currentProduct.declarations.mrp.value || currentProduct.mrp || 'Missing', 'Mandatory'],
                ['Date of Manufacture / Packing', currentProduct.declarations.manufactureDate.present ? 'PASS' : 'FAIL', currentProduct.declarations.manufactureDate.value || 'Missing', 'Mandatory'],
                ['Best Before / Expiry Date', currentProduct.declarations.bestBefore.present ? 'PASS' : 'FAIL', currentProduct.declarations.bestBefore.value || 'Missing', 'Mandatory'],
                ['Manufacturer & Address', currentProduct.declarations.manufacturer.present ? 'PASS' : 'FAIL', currentProduct.declarations.manufacturer.value || 'Missing', 'Mandatory'],
                ['Consumer Care Helpline', currentProduct.declarations.consumerCare.present ? 'PASS' : 'FAIL', currentProduct.declarations.consumerCare.value || 'Missing', 'Mandatory'],
                ['FSSAI License Number', currentProduct.declarations.fssaiLicense.present ? 'PASS' : 'FAIL', currentProduct.declarations.fssaiLicense.value || 'Missing', 'Required for Food'],
                ['Country of Origin', currentProduct.declarations.countryOfOrigin.present ? 'PASS' : 'FAIL', currentProduct.declarations.countryOfOrigin.value || 'Missing', 'Mandatory if Imported'],
                ['Unit Sale Price (USP)', currentProduct.declarations.retailSalePrice.present ? 'PASS' : 'FAIL', currentProduct.declarations.retailSalePrice.value || 'Missing', 'Recommended']
            ];
            autoTable(doc, {
                startY: 96,
                head: [['Declaration Field', 'Status', 'Extracted / Entered Value', 'Requirement']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
                columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 80 }, 3: { cellWidth: 35 } },
                didParseCell: (data) => {
                    if (data.column.index === 1) {
                        if (data.cell.raw === 'PASS') {
                            data.cell.styles.textColor = [16, 185, 129];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
            let finalY = (doc as any).lastAutoTable.finalY + 10;
            if (currentProduct.violations && currentProduct.violations.length > 0) {
                if (finalY > 230) { doc.addPage(); finalY = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(185, 28, 28);
                doc.text(`Rule Violations Detected (${currentProduct.violations.length})`, 15, finalY);
                const violationRows = currentProduct.violations.map((v, i) => [ `${i + 1}`, v.severity.toUpperCase(), v.label, v.message ]);
                autoTable(doc, {
                    startY: finalY + 4,
                    head: [['#', 'Severity', 'Rule Area', 'Deficiency Details']],
                    body: violationRows,
                    theme: 'plain',
                    headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 7.5, textColor: [127, 29, 29] },
                    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 25, fontStyle: 'bold' }, 2: { cellWidth: 50, fontStyle: 'bold' }, 3: { cellWidth: 100 } }
                });
                finalY = (doc as any).lastAutoTable.finalY + 10;
            }
            if (currentProduct.notes) {
                if (finalY > 240) { doc.addPage(); finalY = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(31, 41, 55);
                doc.text('Inspector Field Notes:', 15, finalY);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8.5);
                doc.setTextColor(75, 85, 99);
                doc.text(currentProduct.notes, 15, finalY + 5, { maxWidth: 180 });
            }
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(156, 163, 175);
                doc.text('Generated by Label Lens Verification System', 15, 290);
                doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: 'right' });
            }
            const safeName = currentProduct.productName.replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Label_Lens_${safeName}_Certificate.pdf`);
        } catch (err: any) {
            console.error('Failed to generate PDF:', err);
            alert('Failed to generate PDF: ' + err.message);
        }
    };

    const declarationLabels: Record<keyof typeof currentProduct.declarations, { label: string; desc: string; mandatory: boolean }> = {
        genericName: { label: 'Generic / Common Name', desc: 'Generic description of product', mandatory: true },
        netQuantity: { label: 'Net Quantity', desc: 'Standard weight, volume, or count declaration', mandatory: true },
        mrp: { label: 'Maximum Retail Price (MRP)', desc: 'Consumer price inclusive of all taxes', mandatory: true },
        manufactureDate: { label: 'Month & Year of Manufacture / Packing', desc: 'Date indicating when product was packed', mandatory: true },
        bestBefore: { label: 'Best Before / Expiry Date', desc: 'Date of expiration/perishability', mandatory: false },
        manufacturer: { label: 'Manufacturer / Packer Name & Address', desc: 'Complete identity & location details', mandatory: true },
        consumerCare: { label: 'Consumer Care Contact Details', desc: 'Phone, email, and address for complaints', mandatory: true },
        fssaiLicense: { label: 'FSSAI License Number', desc: '14-digit food safety registration', mandatory: false },
        countryOfOrigin: { label: 'Country of Origin', desc: 'Place of manufacture (mandatory for imports)', mandatory: false },
        retailSalePrice: { label: 'Retail Sale Price per Unit', desc: 'Unit price representation (Price per gram/ml)', mandatory: false },
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 printable-report">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl text-sm font-bold shadow-sm border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Return to Dashboard
                </button>

                <div className="flex items-center gap-3">
                    <button
                        onClick={openEditModal}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer"
                    >
                        <Edit2 size={16} />
                        Edit Product
                    </button>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer"
                    >
                        <Printer size={16} />
                        Print Certificate
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-855 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
                    >
                        <FileDown size={16} />
                        Download PDF Certificate
                    </button>
                </div>
            </div>

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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700/50">
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Product Barcode</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white mt-1 block">
                                {currentProduct.barcode || 'Not Detected'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">MRP (Price)</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                                {currentProduct.mrp || currentProduct.declarations?.mrp?.value || 'Not Set'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Category</span>
                            <span className="font-bold text-gray-900 dark:text-white mt-1 block">
                                {currentProduct.category || 'Packaged Commodity'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Legal Act</span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                                Label Lens Verification Guidelines
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
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

                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">
                                    Rules, 2011 Declaration Checklist
                                </h3>
                                <button
                                    onClick={openEditModal}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit2 size={12} /> Edit Details
                                </button>
                            </div>
                            <div className="space-y-3">
                                {(Object.keys(declarationLabels) as Array<keyof typeof declarationLabels>).map((key) => {
                                    const item = currentProduct.declarations[key] || { present: false, value: null };
                                    const meta = declarationLabels[key];
                                    const displayValue = key === 'mrp' && !item.value && currentProduct.mrp ? currentProduct.mrp : item.value;
                                    const isPresent = item.present || (key === 'mrp' && Boolean(currentProduct.mrp));

                                    return (
                                        <div key={key} className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border ${
                                            isPresent
                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30'
                                                : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30'
                                        }`}>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isPresent}
                                                        readOnly
                                                        className="w-4 h-4 rounded text-blue-655 cursor-default"
                                                    />
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{meta.label}</h4>
                                                    {meta.mandatory && (
                                                        <span className="text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                                            Mandatory
                                                        </span>
                                                    )}
                                                </div>
                                                {isPresent && displayValue && (
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700 px-2.5 py-1 rounded-lg mt-1.5 inline-block max-w-[380px] truncate">
                                                        "{displayValue}"
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                {isPresent ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                        ✔️ Pass
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
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

                    <div className="mb-8 p-6 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} />
                            Non-Compliance & Violations Summary ({currentProduct.violations.length})
                        </h3>
                        {currentProduct.violations.length === 0 ? (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                No packaging rule violations found. All mandatory declarations met.
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

            {isEditingProduct && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden my-8">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <Edit2 size={20} className="text-emerald-600" />
                                    Edit Product Declarations & Details
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Modify existing values, add missing fields, or clear unwanted information.
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
                                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        🛡️ FSSAI License No. (14 digits)
                                    </label>
                                    <input
                                        type="text"
                                        value={editFssaiLicense}
                                        onChange={(e) => setEditFssaiLicense(e.target.value)}
                                        placeholder="e.g. 10012022000046"
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
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
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/70 dark:border-gray-700">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                            📦 Commodity Category
                                        </label>
                                        <select
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        >
                                            <option value="Food & Beverage">Food & Beverage</option>
                                            <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
                                            <option value="Pharmaceuticals & Drugs">Pharmaceuticals & Drugs</option>
                                            <option value="Electronics & Appliances">Electronics & Appliances</option>
                                            <option value="Apparel & Textiles">Apparel & Textiles</option>
                                            <option value="Household Commodities">Household Commodities</option>
                                            <option value="General Packaged Commodity">General Packaged Commodity</option>
                                        </select>
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
