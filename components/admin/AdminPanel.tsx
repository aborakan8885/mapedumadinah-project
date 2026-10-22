import React, { useState, useEffect } from 'react';
import { X, UploadCloud, List, Users, MessageSquare, ShieldAlert, Settings, Cloud, Loader2, AlertCircle, LogIn } from 'lucide-react';
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

export function AdminPanel({ onClose, onOpenAuth }: AdminPanelProps) {
    const [activeTab, setActiveTab] = useState<AdminTab>('upload');
    const [isAuthed, setIsAuthed] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('educational_map_current_user');
            if (saved) {
                const u = JSON.parse(saved);
                return u?.role === 'admin';
            }
            return false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            const saved = localStorage.getItem('educational_map_current_user');
            if (saved) {
                const u = JSON.parse(saved);
                setIsAuthed(u?.role === 'admin');
            }
        } catch {
            setIsAuthed(false);
        }
    }, []);

    const renderContent = () => {
        if (!isAuthed) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white rounded-xl shadow-inner border-2 border-dashed border-gray-100">
                    <div className="w-24 h-24 bg-primary-light/10 rounded-3xl flex items-center justify-center mb-6 border-4 border-primary-light/20 shadow-lg shadow-primary-light/5">
                        <ShieldAlert className="h-12 w-12 text-primary-dark" />
                    </div>
                    <h3 className="text-xl font-black text-gray-950 mb-2">منطقة مسؤولي النظام المصرح لهم</h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-6 text-xs leading-relaxed font-medium">
                        هذه اللوحة مخصصة لإدارة ملفات المدارس، طبقات KMZ، وبيانات المستخدمين وتتطلب تسجيل الدخول بحساب مسؤول.
                    </p>

                    <Button 
                        onClick={() => {
                            if (onOpenAuth) onOpenAuth();
                            onClose();
                        }}
                        className="py-3 px-6 bg-primary-dark hover:bg-primary-medium text-white font-bold rounded-xl shadow-md flex items-center gap-2 text-xs"
                    >
                        <LogIn className="h-4 w-4" />
                        <span>تسجيل الدخول كمسؤول للنظام</span>
                    </Button>
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
}

function TabButton({ text, icon: Icon, isActive, onClick }: { text: string; icon: React.ElementType; isActive: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`whitespace-nowrap md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 font-semibold rounded-xl text-right transition-colors text-fluid-xs ${isActive ? 'bg-primary-subtle text-primary-dark border border-primary-light/30' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
            <span>{text}</span>
        </button>
    );
}

export default AdminPanel;
