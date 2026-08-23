import React, { useState, useEffect } from 'react';
import { X, UploadCloud, List, Users, MessageSquare, ShieldAlert, Settings, Cloud, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import FileUpload from './FileUpload';
import FileManagement from './FileManagement';
import UserManagement from './UserManagement';
import FeedbackManagement from './FeedbackManagement';
import { AccountSettings } from './AccountSettings';
import { SupabaseSettings } from './SupabaseSettings';
import type { User } from '../../types';

interface AdminPanelProps {
  onClose: () => void;
  onOpenAuth?: () => void;
}

type AdminTab = 'upload' | 'manage' | 'users' | 'feedback' | 'supabase' | 'account';

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onOpenAuth }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('upload');
    const [isAuthed, setIsAuthed] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [civilId, setCivilId] = useState('1068575628');

    useEffect(() => {
        const bypass = localStorage.getItem('educational_map_bypass_secret');
        if (bypass === '1068575628') {
            setIsAuthed(true);
        }
    }, []);

    const handleLocalLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      
      try {
        const cleanId = civilId.trim();
        if (cleanId === '1068575628') {
            localStorage.setItem('educational_map_bypass_secret', cleanId);
            localStorage.setItem('isAdmin', 'true');
            
            const appUser: User = {
                id: 'admin-local-session',
                name: 'مدير النظام المعتمد',
                role: 'admin',
                userType: 'employee',
                workEntity: 'الإدارة العامة للتعليم بمنطقة المدينة المنورة',
                status: 'active',
                email: 'aborakan8885@gmail.com',
                permissions: {
                    visibleLayers: ['schools', 'kmz'],
                    canViewCoordinates: true,
                    canExportReports: true,
                    canUseSurroundingAnalysis: true
                }
            };
            localStorage.setItem('educational_map_current_user', JSON.stringify(appUser));
            setIsAuthed(true);
        } else {
            throw new Error('رقم الهوية غير مصرح له بالدخول كمسؤول.');
        }
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء الدخول');
      } finally {
        setIsLoading(false);
      }
    };

    const renderContent = () => {
        if (!isAuthed) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white rounded-xl shadow-inner border-2 border-dashed border-gray-100">
                    <div className="w-24 h-24 bg-primary-light/10 rounded-3xl flex items-center justify-center mb-8 border-4 border-primary-light/20 shadow-lg shadow-primary-light/5">
                        <ShieldAlert className="h-12 w-12 text-primary-dark" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-4 text-emerald-700">تفعيل لوحة الإدارة</h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-10 text-sm leading-relaxed font-medium">
                        الوصول إلى لوحة التحكم الإدارية، رفع ملفات المدارس، وإدارة سحابة Supabase.
                    </p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLocalLogin} className="space-y-4 text-right w-full max-w-md">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهوية (المدير)</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={civilId}
                                    onChange={e => setCivilId(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-light outline-none font-bold pr-10"
                                    placeholder="106xxxxxxx"
                                    required
                                />
                                <ShieldAlert className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                        <Button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-primary-dark hover:bg-primary-medium text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldAlert className="h-5 w-5" />}
                            <span>دخول لوحة الإدارة فوراً</span>
                        </Button>
                    </form>
                </div>
            );
        }

        switch (activeTab) {
            case 'upload': return <FileUpload />;
            case 'manage': return <FileManagement />;
            case 'users': return <UserManagement />;
            case 'feedback': return <FeedbackManagement />;
            case 'supabase': return <SupabaseSettings />;
            case 'account': return <AccountSettings />;
            default: return null;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-900/65 z-50 flex items-center justify-center backdrop-blur-sm p-2 sm:p-4" onClick={onClose} dir="rtl">
            <Card className="w-full max-w-6xl bg-background shadow-2xl relative flex flex-col h-[92vh] rounded-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <header className="p-3 sm:p-4 flex items-center justify-between border-b-4 border-primary-light bg-primary-dark rounded-t-xl shrink-0 text-white">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <h2 className="text-fluid-base sm:text-fluid-lg md:text-fluid-xl font-bold text-white">لوحة التحكم السحابية</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-white/20 transition-colors" aria-label="إغلاق">
                        <X className="h-5 w-5" />
                    </button>
                </header>
                <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    <nav className="w-full md:w-60 bg-white p-2 md:p-4 md:border-l border-b md:border-b-0 border-slate-200 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 shrink-0 custom-scrollbar">
                        <TabButton icon={UploadCloud} text="رفع الملفات" isActive={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
                        <TabButton icon={List} text="إدارة وربط الملفات" isActive={activeTab === 'manage'} onClick={() => setActiveTab('manage')} />
                        <TabButton icon={Users} text="إدارة المستخدمين" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />
                        <TabButton icon={MessageSquare} text="الملاحظات" isActive={activeTab === 'feedback'} onClick={() => setActiveTab('feedback')} />
                        <TabButton icon={Cloud} text="سحابة Supabase" isActive={activeTab === 'supabase'} onClick={() => setActiveTab('supabase')} />
                        <TabButton icon={Settings} text="إعدادات الحساب" isActive={activeTab === 'account'} onClick={() => setActiveTab('account')} />
                    </nav>
                    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-50/70 custom-scrollbar">
                        {renderContent()}
                    </div>
                </main>
            </Card>
        </div>
    );
};

const TabButton: React.FC<{ text: string, icon: React.ElementType, isActive: boolean, onClick: () => void }> = ({ text, icon: Icon, isActive, onClick }) => (
    <button onClick={onClick} className={`whitespace-nowrap md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 font-semibold rounded-xl text-right transition-colors text-fluid-xs ${isActive ? 'bg-primary-subtle text-primary-dark border border-primary-light/30' : 'text-slate-600 hover:bg-slate-100'}`}>
        <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
        <span>{text}</span>
    </button>
);

export default AdminPanel;
