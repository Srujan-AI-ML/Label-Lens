import React, { useState } from 'react';
import type { ScannedProduct } from '../types';
import { useProduct } from '../context/ProductContext';
import { ArrowLeft, AlertTriangle, Printer, Edit2, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportDetailProps {
    product: ScannedProduct;
    onBack: () => void;
}

export const ReportDetail: React.FC<ReportDetailProps> = ({ product, onBack }) => {
    const { updateNotes } = useProduct();
    const [notes, setNotes] = useState(product.notes || '');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isSavingNotes, setIsSavingNotes] = useState(false);

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
            await updateNotes(product.id, notes);
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
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // 1. Header Banner Style (Premium Blue)
            doc.setFillColor(29, 78, 216); // Royal Blue
            doc.rect(0, 0, 210, 40, 'F');

            // Logo & Title inside Banner
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('LABEL LENS', 15, 18);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(219, 234, 254);
            doc.text('COMPLIANCE INSPECTION CERTIFICATE', 15, 25);
            doc.text(`Certificate ID: ${product.id}`, 15, 30);

            // Compliance Score Badge inside Banner
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(160, 8, 35, 24, 3, 3, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            doc.text('SCORE', 177, 14, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(29, 78, 216);
            doc.text(`${product.complianceScore}%`, 177, 21, { align: 'center' });

            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text(product.complianceStatus.toUpperCase(), 177, 26, { align: 'center' });

            // 2. Product Information Block
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
            doc.text(product.productName, 45, 62);

            doc.setFont('helvetica', 'bold');
            doc.text('Barcode GTIN:', 15, 68);
            doc.setFont('helvetica', 'normal');
            doc.text(product.barcode || 'N/A', 45, 68);

            doc.setFont('helvetica', 'bold');
            doc.text('Category:', 15, 74);
            doc.setFont('helvetica', 'normal');
            doc.text(product.category || 'Food & Beverage', 45, 74);

            doc.setFont('helvetica', 'bold');
            doc.text('Scan Date:', 15, 80);
            doc.setFont('helvetica', 'normal');
            doc.text(new Date(product.scannedAt).toLocaleString(), 45, 80);

            // 3. Declarations Checklist Table
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Mandatory Declarations Checklist', 15, 92);
            doc.line(15, 94, 195, 94);

            const decHeaders = [['Declaration Item', 'Status', 'Verified Value / Content Found']];
            const decRows = [
                ['Generic Name', product.declarations.genericName?.present ? 'PASS' : 'FAIL', product.declarations.genericName?.value || 'N/A'],
                ['Net Quantity', product.declarations.netQuantity?.present ? 'PASS' : 'FAIL', product.declarations.netQuantity?.value || 'N/A'],
                ['MRP Price', product.declarations.mrp?.present ? 'PASS' : 'FAIL', product.declarations.mrp?.value || 'N/A'],
                ['Mfg Date', product.declarations.manufactureDate?.present ? 'PASS' : 'FAIL', product.declarations.manufactureDate?.value || 'N/A'],
                ['Expiry Date', product.declarations.bestBefore?.present ? 'PASS' : 'FAIL', product.declarations.bestBefore?.value || 'N/A'],
                ['Manufacturer', product.declarations.manufacturer?.present ? 'PASS' : 'FAIL', product.declarations.manufacturer?.value || 'N/A'],
                ['Consumer Care', product.declarations.consumerCare?.present ? 'PASS' : 'FAIL', product.declarations.consumerCare?.value || 'N/A'],
                ['FSSAI License', product.declarations.fssaiLicense?.present ? 'PASS' : 'FAIL', product.declarations.fssaiLicense?.value || 'N/A'],
                ['Country of Origin', product.declarations.countryOfOrigin?.present ? 'PASS' : 'FAIL', product.declarations.countryOfOrigin?.value || 'N/A'],
                ['Unit Retail Price', product.declarations.retailSalePrice?.present ? 'PASS' : 'FAIL', product.declarations.retailSalePrice?.value || 'N/A'],
            ];

            autoTable(doc, {
                startY: 98,
                head: decHeaders,
                body: decRows,
                theme: 'grid',
                headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 20, fontStyle: 'bold' },
                    2: { cellWidth: 115 }
                },
                styles: { fontSize: 8 },
                didParseCell: (data) => {
                    if (data.column.index === 1) {
                        if (data.cell.text[0] === 'PASS') {
                            data.cell.styles.textColor = [16, 185, 129]; // Green
                        } else {
                            data.cell.styles.textColor = [239, 68, 68]; // Red
                        }
                    }
                }
            });

            // 4. Violations Summary
            const finalY = (doc as any).lastAutoTable.finalY + 12;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Compliance Violations & Causes', 15, finalY);
            doc.line(15, finalY + 2, 195, finalY + 2);

            const violations = product.violations || [];
            doc.setFontSize(9);
            if (violations.length === 0) {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(16, 185, 129);
                doc.text('Product complies fully with all mandatory declarations guidelines.', 15, finalY + 8);
            } else {
                let currentY = finalY + 8;
                violations.forEach((v, idx) => {
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(220, 38, 38);
                    doc.text(`${idx + 1}. [${v.severity.toUpperCase()}] ${v.label}:`, 15, currentY);
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(75, 85, 99);
                    doc.text(v.message, 15, currentY + 4.5);
                    currentY += 10;
                });
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text('Label Lens Digital Certification System • Verified Copy', 15, 285);

            doc.save(`Label_Lens_Certificate_${product.productName.replace(/\s+/g, '_')}.pdf`);
        } catch (err: any) {
            console.error('Error generating product PDF:', err);
            alert('Failed to generate PDF: ' + err.message);
        }
    };

    const declarationLabels: Record<keyof typeof product.declarations, { label: string; desc: string; mandatory: boolean }> = {
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
            {/* Action Bar (hidden in print) */}
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

            {/* Main Report Container */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-lg">
                {/* Header Card */}
                <div className={`p-8 bg-gradient-to-r ${getStatusHeaderColor(product.complianceStatus)} flex flex-col sm:flex-row sm:items-center justify-between gap-6`}>
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                            Official Label Lens Inspection Certificate
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black mt-2">{product.productName}</h1>
                        <p className="text-xs text-white/80 mt-1">
                            Inspection ID: {product.id} • Date: {new Date(product.scannedAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="text-center sm:text-right">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-white/80">Compliance Score</p>
                        <p className="text-5xl font-black mt-1">{product.complianceScore}%</p>
                        <p className="text-sm font-bold mt-1 bg-white/20 px-3 py-1 rounded-full inline-block">
                            {product.complianceStatus}
                        </p>
                    </div>
                </div>

                <div className="p-8">
                    {/* Basic Info Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700/50">
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Product Barcode</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white mt-1 block">
                                {product.barcode || 'Not Detected'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Category</span>
                            <span className="font-bold text-gray-900 dark:text-white mt-1 block">
                                {product.category || 'Packaged Commodity'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase block">Legal Act</span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                                Label Lens Verification Guidelines
                            </span>
                        </div>
                    </div>

                    {/* Left/Right layout for image preview and checklist */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                        {/* Packaging Evidence Image */}
                        <div className="lg:col-span-1">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Packaging Photo Evidence</h3>
                            <div className="w-full h-72 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex items-center justify-center text-5xl">
                                {product.imageData ? (
                                    <img src={product.imageData} alt="Product label photo" className="w-full h-full object-contain bg-black" />
                                ) : (
                                    '📦'
                                )}
                            </div>
                        </div>

                        {/* List of declarations check */}
                        <div className="lg:col-span-2">
                            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">
                                Rules, 2011 Declaration Checklist
                            </h3>
                            <div className="space-y-3">
                                {(Object.keys(declarationLabels) as Array<keyof typeof declarationLabels>).map((key) => {
                                    const item = product.declarations[key] || { present: false, value: null };
                                    const meta = declarationLabels[key];
                                    return (
                                        <div key={key} className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border ${
                                            item.present
                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30'
                                                : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30'
                                        }`}>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.present}
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
                                                {item.present && item.value && (
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700 px-2.5 py-1 rounded-lg mt-1.5 inline-block max-w-[380px] truncate">
                                                        "{item.value}"
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                {item.present ? (
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

                    {/* Violations Summary */}
                    <div className="mb-8 p-6 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} />
                            Non-Compliance & Violations Summary ({product.violations.length})
                        </h3>
                        {product.violations.length === 0 ? (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                No packaging rule violations found. All mandatory declarations met.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {product.violations.map((v, i) => (
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

                    {/* Inspector Notes Section */}
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
                                    {product.notes || 'No inspector field notes added yet.'}
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
        </div>
    );
};
