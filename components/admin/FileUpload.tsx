import React, { useState, useCallback } from 'react';
import { UploadCloud, File, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useData } from '../../App';
import { putFile, getAllFiles, uploadFileToServer } from '../../lib/db';
import type { FileMapping, Category } from '../../types';
import { Button } from '../ui/Button';
import * as XLSX from 'xlsx';

// Helper function to read file as ArrayBuffer
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

const FileUpload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const { loadMapData } = useData();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            const extension = droppedFile.name.split('.').pop()?.toLowerCase();
            if (extension === 'xlsx' || extension === 'xls' || extension === 'kmz' || extension === 'kml' || extension === 'geojson' || extension === 'json') {
                setFile(droppedFile);
                setStatus('idle');
                setMessage('');
            } else {
                setMessage('صيغة الملف غير مدعومة. الرجاء رفع ملف Excel, KML, KMZ, أو GeoJSON.');
                setStatus('error');
            }
        }
    }, []);
    
    const getFileType = (filename: string): FileMapping['fileType'] | null => {
        const extension = filename.split('.').pop()?.toLowerCase();
        if (extension === 'xlsx' || extension === 'xls') return 'tabular';
        if (extension === 'kmz') return 'kmz';
        if (extension === 'kml') return 'kml';
        if (extension === 'geojson' || extension === 'json') return 'geojson';
        return null;
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('الرجاء اختيار ملف أولاً.');
            setStatus('error');
            return;
        }

        const fileType = getFileType(file.name);
        if (!fileType) {
            setMessage('صيغة الملف غير مدعومة. الرجاء رفع ملف Excel, KML, KMZ, أو GeoJSON.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setMessage('جاري تحليل البيانات محلياً ورفعها للسحابة (هذا الإجراء سريع جداً)...');

        try {
            const initialMapping: Partial<FileMapping> = {
                category: 'unassigned',
                fileType,
                isBoundaryLayer: false,
                filterMappings: {}
            };
            
            // For spatial files that aren't excel, we still handle text extraction here if needed
            // although uploadFileToServer could be extended for this too.
            if (fileType === 'kml' || fileType === 'geojson') {
                initialMapping.fileContent = await file.text();
            } else if (fileType === 'kmz') {
                const buffer = await readFileAsArrayBuffer(file);
                initialMapping.fileContent = buffer;
            }

            // The magic happens here: uploadFileToServer will parse Excel/CSV locally 
            // and save it as a single compressed JSON record in Supabase.
            await uploadFileToServer(file, initialMapping);
            
            // Refresh application state
            await loadMapData();

            setStatus('success');
            setMessage(`✅ تم رفع ومعالجة الملف "${file.name}" بنجاح فوري. تم حفظ آلاف السجلات في ثانية واحدة.`);
            setFile(null);
        } catch (error: any) {
            console.error("File upload failed:", error);
            setStatus('error');
            setMessage(`❌ حدث خطأ: ${error.message || 'خطأ غير معروف'}. يرجى المحاولة مرة أخرى.`);
        }
    };

    return (
        <div>
            <h3 className="text-xl font-bold text-primary-dark mb-4">قسم رفع الملفات</h3>
            <div className="p-6 bg-white rounded-lg border space-y-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">1. اختر الملف من جهازك</label>
                    <div className="flex items-center justify-center w-full">
                        <label 
                            htmlFor="dropzone-file" 
                            className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
                                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">انقر للاختيار</span> أو قم بسحب وإفلات الملف هنا</p>
                                <p className="text-xs text-gray-500">XLSX, XLS, KML, KMZ, GEOJSON, JSON</p>
                            </div>
                            <input 
                                id="dropzone-file" 
                                type="file" 
                                className="hidden" 
                                onChange={handleFileChange} 
                                accept=".xlsx, .xls, .kml, .kmz, .geojson, .json" 
                                value={file ? undefined : ''}
                                key={file ? 'file-selected' : 'file-empty'}
                            />
                        </label>
                    </div>
                </div>

                {file && (
                    <div className="flex items-center justify-between p-3 bg-primary-light/10 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary-dark">
                            <File className="h-5 w-5" />
                            <span>{file.name}</span>
                        </div>
                        <button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-red-100 text-red-500">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
                
                <Button onClick={handleUpload} disabled={!file || status === 'loading'} className="w-full gap-2">
                    {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                    <span>{status === 'loading' ? 'جاري الرفع...' : 'رفع الملف'}</span>
                </Button>

                {message && (
                    <div className={`flex items-center gap-2 p-3 text-sm rounded-md ${
                        status === 'success' ? 'bg-green-100 text-green-800' :
                        status === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                        {status === 'success' && <CheckCircle className="h-5 w-5" />}
                        {status === 'error' && <AlertTriangle className="h-5 w-5" />}
                        <span>{message}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUpload;