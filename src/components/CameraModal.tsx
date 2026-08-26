import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, AlertCircle, ChevronDown, Video, ScanLine, PenLine, Camera } from 'lucide-react';

interface CameraModalProps {
    onCapture: (imageSrc: string) => void;
    onClose: () => void;
    onEnterManual?: () => void;
}

interface CameraDevice {
    deviceId: string;
    label: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose, onEnterManual }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const activeStreamRef = useRef<MediaStream | null>(null);

    const [error, setError] = useState<string>('');
    const [isReady, setIsReady] = useState(false);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [_selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [showCameraSelect, setShowCameraSelect] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const killAllStreams = useCallback(() => {
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(track => track.stop());
            activeStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            const stream = videoRef.current.srcObject as MediaStream;
            if (stream) stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
            videoRef.current.load();
        }
        setIsReady(false);
    }, []);

    const startCamera = useCallback(async (deviceId: string) => {
        killAllStreams();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
            });
            activeStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => { });
                setIsReady(true);
            }
            setError('');
        } catch (err) {
            console.error('[Camera] Error:', err);
            setError('Failed to start camera. Check camera permissions.');
        }
    }, [killAllStreams]);

    const getCameras = useCallback(async () => {
        setError('');
        setIsLoading(true);
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            tempStream.getTracks().forEach(t => t.stop());

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices
                .filter(d => d.kind === 'videoinput')
                .map(d => ({
                    deviceId: d.deviceId,
                    label: d.label || `Camera ${d.deviceId.slice(0, 8)}`
                }));

            setCameras(videoDevices);

            if (videoDevices.length === 1) {
                setSelectedCameraId(videoDevices[0].deviceId);
                setShowCameraSelect(false);
                startCamera(videoDevices[0].deviceId);
            } else if (videoDevices.length === 0) {
                setError('No cameras found.');
            }
        } catch (err) {
            console.error('[Camera] Permission error:', err);
            setError('Camera access denied. Please allow permissions in browser, then click Retry.');
        } finally {
            setIsLoading(false);
        }
    }, [startCamera]);

    useEffect(() => {
        getCameras();
        return () => killAllStreams();
    }, [getCameras, killAllStreams]);

    const handleSelectCamera = (deviceId: string) => {
        setSelectedCameraId(deviceId);
        setShowCameraSelect(false);
        startCamera(deviceId);
    };

    const handleClose = useCallback(() => {
        killAllStreams();
        onClose();
    }, [killAllStreams, onClose]);

    const handleManualClick = useCallback(() => {
        killAllStreams();
        if (onEnterManual) {
            onEnterManual();
        } else {
            onClose();
        }
    }, [killAllStreams, onEnterManual, onClose]);

    const handleCapture = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');
        if (!context) return;

        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageSrc = canvasRef.current.toDataURL('image/jpeg');

        killAllStreams();
        onCapture(imageSrc);
        onClose();
    }, [killAllStreams, onCapture, onClose]);

    const handleSwitchCamera = () => {
        killAllStreams();
        setShowCameraSelect(true);
        setIsReady(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Header bar */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-white/10">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                        <ScanLine size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-white leading-tight">Packaging Scanner</h1>
                        <p className="text-[10px] text-gray-300">Legal Metrology OCR</p>
                    </div>
                </div>

                {/* Reliable Close (X) button */}
                <button
                    type="button"
                    onClick={handleClose}
                    className="w-11 h-11 rounded-full bg-white/20 hover:bg-red-600 active:bg-red-750 backdrop-blur-xl flex items-center justify-center text-white transition-colors duration-200 border border-white/20 shadow-xl cursor-pointer"
                    title="Close scanner and return to menu"
                >
                    <X size={22} />
                </button>
            </div>

            {/* Camera Selection Modal View */}
            {showCameraSelect ? (
                <div className="w-full max-w-md p-6 relative z-30">
                    <div className="bg-gray-900/95 backdrop-blur-xl rounded-3xl p-6 border border-gray-700/60 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-500/20 rounded-xl">
                                    <Video size={24} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-lg">Select Camera</h2>
                                    <p className="text-gray-400 text-xs">Choose camera for scanning packaging labels</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {error ? (
                            <div className="text-center py-4">
                                <AlertCircle className="mx-auto text-rose-500 mb-3" size={32} />
                                <p className="text-white text-xs mb-4">{error}</p>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={getCameras}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors text-xs cursor-pointer"
                                    >
                                        Retry Camera Access
                                    </button>
                                    <button
                                        onClick={handleManualClick}
                                        className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-semibold transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <PenLine size={14} />
                                        Enter Details Manually
                                    </button>
                                </div>
                            </div>
                        ) : isLoading ? (
                            <div className="text-center py-8">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-gray-400 text-xs">Detecting available cameras...</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cameras.map((camera, idx) => (
                                    <button
                                        key={camera.deviceId}
                                        onClick={() => handleSelectCamera(camera.deviceId)}
                                        className="w-full flex items-center gap-3 p-3.5 bg-gray-800/80 hover:bg-gray-750 rounded-xl transition-all text-left group hover:translate-x-1 cursor-pointer border border-gray-700/40"
                                    >
                                        <div className="w-9 h-9 bg-gray-700 group-hover:bg-indigo-500/30 rounded-lg flex items-center justify-center transition-colors">
                                            <Video size={16} className="text-gray-400 group-hover:text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium text-xs truncate">{camera.label}</p>
                                            <p className="text-gray-500 text-[10px]">Camera Source #{idx + 1}</p>
                                        </div>
                                        <ChevronDown size={16} className="text-gray-500 -rotate-90" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
                            <button
                                onClick={handleManualClick}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                            >
                                <PenLine size={14} />
                                Skip & Enter Manually
                            </button>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Return to Menu
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Video viewfinder */}
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                        {error ? (
                            <div className="text-center p-6 bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">
                                <AlertCircle className="mx-auto text-rose-500 mb-2" size={32} />
                                <p className="text-white text-xs">{error}</p>
                                <button onClick={handleSwitchCamera} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs">
                                    Try Another Camera
                                </button>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        )}

                        {/* Scan Frame Overlay */}
                        {!error && (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                                <div className="relative w-full max-w-md aspect-[3/4] md:aspect-square border-2 border-white/20 rounded-[2rem] overflow-hidden shadow-2xl">
                                    {/* Corners */}
                                    <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-indigo-500 rounded-tl-[1.8rem] shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                    <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-indigo-500 rounded-tr-[1.8rem] shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-indigo-500 rounded-bl-[1.8rem] shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-indigo-500 rounded-br-[1.8rem] shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>

                                    {/* Scan Animation */}
                                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                                        <div className="scan-line animate-scan"></div>
                                    </div>

                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-64 h-64 border border-dashed border-white/30 rounded-xl flex items-center justify-center">
                                            <span className="text-white/70 text-[11px] font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                                                Align Packaging Declarations
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Pill */}
                                {isReady && (
                                    <div className="mt-4 pointer-events-auto">
                                        <div className="bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full border border-white/20 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                            <span className="text-xs font-semibold text-white">Camera active — Press capture below</span>
                                        </div>
                                    </div>
                                )}

                                 {/* Enter details manually removed from pointer-events-none overlay */}
                            </div>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    {!error && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 flex flex-col items-center gap-4 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                            {/* Flash / Switch Camera and Capture Button Row */}
                            <div className="flex items-center justify-center gap-6 w-full max-w-xs relative">
                                {/* Flash / Switch Camera */}
                                <button
                                    type="button"
                                    onClick={handleSwitchCamera}
                                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer absolute left-0"
                                    title="Switch Camera"
                                >
                                    <RefreshCw size={20} />
                                </button>

                                {/* Capture Button */}
                                <button
                                    type="button"
                                    onClick={handleCapture}
                                    disabled={!isReady}
                                    className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center group hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-2xl bg-black/10"
                                    title="Take Photo"
                                >
                                    <div className={`w-16 h-16 bg-white rounded-full group-hover:bg-indigo-600 transition-colors flex items-center justify-center ${!isReady ? 'opacity-50' : ''}`}>
                                        <Camera size={26} className="text-gray-900 group-hover:text-white transition-colors" />
                                    </div>
                                </button>
                            </div>

                            {/* Enter details manually button directly under capture button */}
                            <button
                                type="button"
                                onClick={handleManualClick}
                                className="bg-white/15 hover:bg-indigo-600 hover:border-indigo-500 active:scale-95 text-white text-xs font-semibold px-5 py-2.5 rounded-full border border-white/15 flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-indigo-600/35"
                            >
                                <PenLine size={14} className="text-indigo-300" />
                                ✍️ Enter Details Manually
                            </button>
                        </div>
                    )}
                </>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <style>{`
                .scan-line {
                    background: linear-gradient(to bottom, rgba(99, 102, 241, 0), rgba(99, 102, 241, 0.9), rgba(99, 102, 241, 0));
                    height: 4px;
                    width: 100%;
                    position: absolute;
                    top: 0;
                    left: 0;
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.8);
                }
                @keyframes scan {
                    0%, 100% { 
                        transform: translateY(0); 
                        opacity: 0.4; 
                    }
                    50% { 
                        transform: translateY(calc(100% - 4px)); 
                        opacity: 1; 
                    }
                }
                .animate-scan {
                    animation: scan 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
