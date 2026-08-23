import React, { useState, useEffect } from 'react';
import { MessageSquare, Download, Trash2, Search, Calendar, User, Smartphone, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Feedback } from '../../types';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { getFeedbacks } from '../../lib/db';
import { deleteFeedbackFromSupabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

const FeedbackManagement: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [feedbackToDelete, setFeedbackToDelete] = useState<Feedback | null>(null);

    const loadFeedbacks = async () => {
        setLoading(true);
        try {
            const data = await getFeedbacks();
            setFeedbacks(data);
        } catch (err) {
            console.error("Failed to load feedbacks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeedbacks();
    }, []);

    const handleDeleteConfirm = async () => {
        if (!feedbackToDelete?.id) return;
        try {
            await deleteFeedbackFromSupabase(feedbackToDelete.id);
            setFeedbacks(prev => prev.filter(f => f.id !== feedbackToDelete.id));
            setFeedbackToDelete(null);
        } catch (error) {
            console.error("Error deleting feedback:", error);
            // Also update local list if offline
            setFeedbacks(prev => prev.filter(f => f.id !== feedbackToDelete.id));
            setFeedbackToDelete(null);
        }
    };

    const exportToExcel = () => {
        const exportData = feedbacks.map(f => ({
            'الاسم': f.name,
            'رقم التواصل': f.phone || 'غير مدخل',
            'الملاحظة': f.message,
            'التاريخ': f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString('ar-SA') : 'غير متوفر'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الملاحظات");
        
        // Add RTL support to the sheet
        if(!ws['!cols']) ws['!cols'] = [];
        ws['!dir'] = 'rtl';

        XLSX.writeFile(wb, `ملاحظات_المستفيدين_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
    };

    const filteredFeedbacks = feedbacks.filter(f => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            f.name.toLowerCase().includes(q) ||
            (f.phone && f.phone.includes(q)) ||
            f.message.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-5" dir="rtl">
            {/* Header section */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <h3 className="text-fluid-base sm:text-fluid-lg font-bold text-primary-dark flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary-medium" />
                        <span>إدارة ملاحظات ومقترحات المستفيدين</span>
                    </h3>
                    <p className="text-fluid-xs text-slate-500 mt-0.5">الاطلاع على جميع الملاحظات المرسلة من قبل مستخدمي النظام وتصديرها</p>
                </div>

                <div className="flex gap-2">
                    <Button 
                        onClick={exportToExcel} 
                        disabled={feedbacks.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 shadow-xs text-fluid-xs"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        تصدير ملف Excel
                    </Button>
                </div>
            </div>

            {/* Filters and Stats */}
            <div className="ds-grid-auto-fit">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                    <span className="text-fluid-2xs font-bold text-slate-500">إجمالي الملاحظات</span>
                    <span className="text-fluid-lg font-black text-primary-dark">{feedbacks.length}</span>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="بحث في الأسماء، الأرقام، أو محتوى الملاحظة..."
                        className="ds-input pr-9"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
            </div>

            {/* Feedback List */}
            <div className="ds-table-container">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-medium border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                        <p className="mt-4 text-slate-500 font-bold text-fluid-sm">جاري تحميل الملاحظات...</p>
                    </div>
                ) : filteredFeedbacks.length > 0 ? (
                    <table className="w-full text-fluid-xs text-right whitespace-nowrap">
                        <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 uppercase font-bold">
                            <tr>
                                <th className="px-4 py-3">المستفيد / التاريخ</th>
                                <th className="px-4 py-3">نص الملاحظة</th>
                                <th className="px-4 py-3 text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredFeedbacks.map((f) => (
                                <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3 align-top w-64">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="font-bold text-slate-900">{f.name}</span>
                                            </div>
                                            {f.phone && (
                                                <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                                                    <Smartphone className="h-3 w-3" />
                                                    <span>{f.phone}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                                                <Calendar className="h-3 w-3" />
                                                <span>{f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString('ar-SA') : 'قيد المعالجة...'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top whitespace-normal">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-slate-800 leading-relaxed font-medium">
                                            {f.message}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-center w-24">
                                        <button
                                            onClick={() => setFeedbackToDelete(f)}
                                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 transition-colors"
                                            title="حذف الملاحظة"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-12 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold text-fluid-sm">لا توجد أي ملاحظات أو مقترحات حالياً.</p>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!feedbackToDelete}
                onClose={() => setFeedbackToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="تأكيد حذف الملاحظة"
                message={`هل أنت متأكد من حذف هذه الملاحظة؟ لا يمكن التراجع عن هذا الإجراء.`}
            />
        </div>
    );
};

export default FeedbackManagement;
