import React, { useState } from 'react';
import type { FileMapping, Category, FilterColumnMappings } from '../../types';
import { Button } from '../ui/Button';
import { Loader2, Check, X } from 'lucide-react';
import { Separator } from '../ui/Separator';

interface MappingConfigurationProps {
  file: FileMapping;
  onSave: (updatedFile: FileMapping) => Promise<void>;
  onCancel: () => void;
}

const filterFieldsByCategory: Record<string, { key: keyof FilterColumnMappings, label: string, isMulti: boolean }[]> = {
  schools: [
    { key: 'levelColumn', label: 'المرحلة', isMulti: true },
    { key: 'governorateColumn', label: 'المحافظة', isMulti: true },
    { key: 'districtColumn', label: 'الحي', isMulti: true },
  ],
};

export const MappingConfiguration: React.FC<MappingConfigurationProps> = ({ file, onSave, onCancel }) => {
    const [localFile, setLocalFile] = useState<FileMapping>(file);
    const [isSaving, setIsSaving] = useState(false);
    const headers = file.headers || [];
    const filterFields = filterFieldsByCategory[file.category] || [];

    const handleCoreChange = (field: 'latColumn' | 'lngColumn' | 'nameColumn', value: string) => {
        setLocalFile(prev => ({ ...prev, [field]: value || undefined }));
    };

    const handleDisplayColumnsChange = (column: string) => {
        const current = localFile.displayColumns || [];
        const newSelection = current.includes(column)
            ? current.filter(c => c !== column)
            : [...current, column];
        setLocalFile(prev => ({ ...prev, displayColumns: newSelection }));
    };
    
    const handleSelectAllDisplayColumns = () => {
        setLocalFile(prev => ({ ...prev, displayColumns: [...headers] }));
    };

    const handleDeselectAllDisplayColumns = () => {
        setLocalFile(prev => ({ ...prev, displayColumns: [] }));
    };

    const handleFilterMappingChange = (field: keyof FilterColumnMappings, value: string | string[]) => {
        setLocalFile(prev => ({
            ...prev,
            filterMappings: {
                ...(prev.filterMappings || {}),
                [field]: value,
            },
        }));
    };
    
    const handleMultiFilterMappingChange = (field: keyof FilterColumnMappings, column: string) => {
         const current = localFile.filterMappings?.[field] || [];
         const newSelection = (current as string[]).includes(column)
            ? (current as string[]).filter(c => c !== column)
            : [...(current as string[]), column];
        handleFilterMappingChange(field, newSelection);
    }

    const handleSaveClick = async () => {
        setIsSaving(true);
        try {
            await onSave(localFile);
        } catch (e) {
            console.error(e);
            alert("فشل حفظ التغييرات.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const isCoreMappingComplete = localFile.latColumn && localFile.lngColumn && localFile.nameColumn;

    return (
        <div className="p-4 bg-gray-50 border-t-2 border-primary-light transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg text-primary-dark">ربط أعمدة الملف: {file.filename}</h4>
                 <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${isCoreMappingComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {isCoreMappingComplete ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{isCoreMappingComplete ? 'الربط الأساسي مكتمل' : 'الربط الأساسي مطلوب'}</span>
                </div>
            </div>
            
            <div className="space-y-6">
                <MappingSection title="1. الربط الأساسي (مطلوب للظهور على الخريطة)">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SelectControl label="عمود خط العرض (Lat)" options={headers} value={localFile.latColumn || ''} onChange={e => handleCoreChange('latColumn', e.target.value)} placeholder="-- اختر عمود --" />
                        <SelectControl label="عمود خط الطول (Lng)" options={headers} value={localFile.lngColumn || ''} onChange={e => handleCoreChange('lngColumn', e.target.value)} placeholder="-- اختر عمود --" />
                        <SelectControl label="عمود اسم الموقع" options={headers} value={localFile.nameColumn || ''} onChange={e => handleCoreChange('nameColumn', e.target.value)} placeholder="-- اختر عمود --" />
                    </div>
                </MappingSection>

                <MappingSection title="2. أعمدة العرض في النافذة المنبثقة">
                    <div className="flex items-center gap-2 mb-3">
                        <Button size="sm" variant="secondary" onClick={handleSelectAllDisplayColumns} className="text-xs">
                            تحديد الكل
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleDeselectAllDisplayColumns} className="text-xs">
                            إلغاء الكل
                        </Button>
                    </div>
                    <CheckboxGrid options={headers} selected={localFile.displayColumns || []} onChange={handleDisplayColumnsChange} />
                </MappingSection>

                {filterFields.length > 0 && (
                    <MappingSection title="3. ربط أعمدة الفلاتر (اختياري)">
                         <div className="space-y-4">
                            {filterFields.map(({ key, label, isMulti }) => (
                                <div key={key} className="p-3 bg-white rounded-md border">
                                    <h5 className="font-semibold text-gray-700 mb-2">{label}</h5>
                                    {isMulti ? (
                                         <CheckboxGrid
                                            options={headers}
                                            selected={(localFile.filterMappings?.[key] as string[] || [])}
                                            onChange={(column) => handleMultiFilterMappingChange(key, column)}
                                        />
                                    ) : (
                                        <SelectControl 
                                            label=""
                                            options={headers} 
                                            value={(localFile.filterMappings?.[key] as string || '')} 
                                            onChange={e => handleFilterMappingChange(key, e.target.value)}
                                            placeholder="-- اختر عمود --"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </MappingSection>
                )}
            </div>

            <Separator className="my-4" />
            
            <div className="flex justify-end items-center gap-3">
                <Button onClick={onCancel} variant="secondary" disabled={isSaving}>
                    <X className="h-4 w-4 ml-1" />
                    إلغاء
                </Button>
                <Button onClick={handleSaveClick} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                </Button>
            </div>
        </div>
    );
};


const MappingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="p-4 bg-white rounded-lg border shadow-sm">
        <h4 className="text-base font-semibold mb-3 text-gray-800 border-b pb-2">{title}</h4>
        {children}
    </div>
);

const SelectControl: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, options: string[], placeholder: string }> = ({ label, options, placeholder, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        <select {...props} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light bg-white">
            <option value="">{placeholder}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const CheckboxGrid: React.FC<{ options: string[], selected: string[], onChange: (option: string) => void }> = ({ options, selected, onChange }) => (
     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-50/50 custom-scrollbar">
        {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-sm">
                <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => onChange(opt)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light"
                />
                <span className="text-gray-700">{opt}</span>
            </label>
        ))}
    </div>
);