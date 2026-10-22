import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User as UserIcon, Trash2, UserPlus, ShieldCheck, ShieldAlert, Key, CheckCircle2, XCircle, Search, Edit3, Settings2, Cloud, RefreshCw, Loader2 } from 'lucide-react';
import type { User, UserTypeMode } from '../../types';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import {
    getMockUsers,
    saveMockUsers,
    syncUsersWithCloud,
    markUserDeletedLocally,
    unmarkUserDeletedLocally
} from '../modals/AuthModal';
import {
    saveUserToCloud,
    upsertUserToSupabase,
    deleteUserFromSupabase,
    normalizeCivilId,
    normalizePhone,
    subscribeToUsersChanges
} from '../../lib/supabase';
import { normalizeArabic } from '../../App';

// Type guards to eliminate 'as any'
const isRole = (v: string): v is 'admin' | 'user' => v === 'admin' || v === 'user';
const isStatus = (v: string): v is 'active' | 'disabled' => v === 'active' || v === 'disabled';
const isUserType = (v: string): v is UserTypeMode => v === 'employee' || v === 'beneficiary';

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>(() => getMockUsers());
    const [searchQuery, setSearchQuery] = useState('');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Timeout ref for clean message memory management
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const showSyncNotice = useCallback((notice: { type: 'success' | 'error'; message: string }) => {
        setSyncNotice(notice);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setSyncNotice(null), 4500);
    }, []);

    // Form state for adding/editing user
    const [formCivilId, setFormCivilId] = useState('');
    const [formName, setFormName] = useState('');
    const [formWorkEntity, setFormWorkEntity] = useState('الشؤون التعليمية');
    const [formJobTitle, setFormJobTitle] = useState('الشؤون التعليمية');
    const [formPhone, setFormPhone] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
    const [formStatus, setFormStatus] = useState<'active' | 'disabled'>('active');
    
    // Permission Toggles
    const [permViewCoords, setPermViewCoords] = useState(true);
    const [permExportReports, setPermExportReports] = useState(true);
    const [permSurrounding, setPermSurrounding] = useState(true);

    const refreshAndSyncUsers = useCallback(async (showFeedback = false) => {
        setIsSyncing(true);
        try {
            const synced = await syncUsersWithCloud();
            setUsers(synced);
            if (showFeedback) {
                showSyncNotice({
                    type: 'success',
                    message: `تمت مزامنة جميع المستخدمين (${synced.length} حساب) مع قاعدة البيانات السحابية بنجاح.`
                });
            }
        } catch (err) {
            console.error("Failed to sync users:", err);
            if (showFeedback) {
                showSyncNotice({
                    type: 'error',
                    message: 'تعذر الاتصال بالسحابة حالياً، تم عرض النسخة المحفوظة.'
                });
            }
        } finally {
            setIsSyncing(false);
        }
    }, [showSyncNotice]);

    useEffect(() => {
        refreshAndSyncUsers(false);
        const unsubscribe = subscribeToUsersChanges(() => {
            refreshAndSyncUsers(false);
        });
        return () => {
            unsubscribe();
        };
    }, [refreshAndSyncUsers]);

    const handleToggleStatus = async (targetUser: User) => {
        const newStatus: 'active' | 'disabled' = targetUser.status === 'disabled' ? 'active' : 'disabled';
        const updatedTarget: User = { ...targetUser, status: newStatus };

        setUsers(prev => {
            const next = prev.map(u => (u.id === targetUser.id ? updatedTarget : u));
            saveMockUsers(next);
            return next;
        });

        try {
            const res = await upsertUserToSupabase(updatedTarget);
            if (res.ok) {
                showSyncNotice({
                    type: 'success',
                    message: `تم تحديث حالة دخول "${targetUser.name}" إلى (${newStatus === 'active' ? 'مسموح بالدخول' : 'معطل'}) ومزامنتها سحابياً.`
                });
            } else {
                showSyncNotice({
                    type: 'error',
                    message: `فشلت المزامنة السحابية للحالة: ${res.error}`
                });
            }
        } catch (err) {
            console.error("Cloud status toggle error:", err);
        }
    };

    const handleResetPassword = async (targetUser: User) => {
        if (!window.confirm(`هل أنت متأكد من إعادة تعيين كلمة المرور للمستخدم: "${targetUser.name}"؟ سيمكنه ذلك من تعيين كلمة مرور جديدة بنفسه بالسجل المدني.`)) {
            return;
        }

        const updatedUser: User = { ...targetUser, password: '' };
        try {
            const res = await upsertUserToSupabase(updatedUser);
            if (res.ok) {
                setUsers(prev => {
                    const next = prev.map(u => (u.id === targetUser.id ? updatedUser : u));
                    saveMockUsers(next);
                    return next;
                });
                showSyncNotice({
                    type: 'success',
                    message: `تمت إعادة تعيين كلمة المرور بنجاح للمستخدم "${targetUser.name}". يمكنه الآن استخدام شاشة التفعيل بالسجل المدني.`
                });
            } else {
                showSyncNotice({
                    type: 'error',
                    message: `فشلت إعادة التعيين سحابياً: ${res.error}`
                });
            }
        } catch (err) {
            console.error("Reset password error:", err);
            showSyncNotice({
                type: 'error',
                message: 'حدث خطأ أثناء محاولة إعادة تعيين كلمة المرور.'
            });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;
        const target = userToDelete;
        setUserToDelete(null);

        markUserDeletedLocally(target.id, target.civilId);
        setUsers(prev => {
            const next = prev.filter(u => u.id !== target.id && normalizeCivilId(u.civilId) !== normalizeCivilId(target.civilId));
            saveMockUsers(next);
            return next;
        });

        try {
            const delRes = await deleteUserFromSupabase(target.id, target.civilId);
            if (delRes.ok) {
                showSyncNotice({
                    type: 'success',
                    message: `تم حذف حساب "${target.name}" نهائياً من النظام والسحابة والنسخ الاحتياطية.`
                });
            } else {
                showSyncNotice({
                    type: 'error',
                    message: `فشل الحذف من السحابة: ${delRes.error}`
                });
            }
        } catch (err) {
            console.error("Cloud delete error:", err);
        }
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormCivilId('');
        setFormName('');
        setFormWorkEntity('الشؤون التعليمية');
        setFormJobTitle('الشؤون التعليمية');
        setFormPhone('');
        setFormPassword('');
        setFormRole('user');
        setFormStatus('active');
        setPermViewCoords(true);
        setPermExportReports(true);
        setPermSurrounding(true);
        setIsAddModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormCivilId(normalizeCivilId(user.civilId) || user.civilId || '');
        setFormName(user.name);
        setFormWorkEntity(user.workEntity || 'الشؤون التعليمية');
        setFormJobTitle(user.jobTitle || 'الشؤون التعليمية');
        setFormPhone(user.phone || '');
        setFormPassword(user.password || '');
        setFormRole(user.role);
        setFormStatus(user.status || 'active');
        setPermViewCoords(user.permissions?.canViewCoordinates !== false);
        setPermExportReports(user.permissions?.canExportReports !== false);
        setPermSurrounding(user.permissions?.canUseSurroundingAnalysis !== false);
        setIsAddModalOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return; // Prevent double submission race condition

        const cleanName = formName.trim();
        const cleanCivilId = normalizeCivilId(formCivilId);
        if (!cleanName || !cleanCivilId) return;

        setIsSaving(true);
        try {
            const permissions = {
                visibleLayers: ['schools', 'kmz'] as any,
                canViewCoordinates: permViewCoords,
                canExportReports: permExportReports,
                canUseSurroundingAnalysis: permSurrounding
            };

            const existingByCivilId = users.find(u => normalizeCivilId(u.civilId) === cleanCivilId);
            const targetExisting = editingUser || existingByCivilId;

            const savedUser: User = {
                id: targetExisting?.id || `emp-${cleanCivilId}`,
                civilId: cleanCivilId,
                name: cleanName,
                workEntity: formWorkEntity || 'الشؤون التعليمية',
                jobTitle: formJobTitle || 'الشؤون التعليمية',
                phone: normalizePhone(formPhone) || formPhone.trim(),
                password: formPassword.trim() ? formPassword.trim() : (targetExisting?.password || ''),
                role: formRole,
                userType: 'employee',
                status: formStatus,
                permissions,
                // Preserve original createdAt on updates (Issue 13)
                createdAt: targetExisting?.createdAt || new Date().toISOString()
            };

            // 1. First save directly to cloud and wait for confirmation
            const cloudRes = await saveUserToCloud(savedUser);
            if (!cloudRes.success) {
                alert(`فشل الحفظ السحابي: ${cloudRes.error || 'تعذر الاتصال بالسحابة'}`);
                return; // Do NOT close modal, do NOT clear fields, do NOT show success!
            }

            // 2. Only upon confirmed cloud success, update local state & close modal
            unmarkUserDeletedLocally(savedUser.id, savedUser.civilId);
            setUsers(prev => {
                const next = [
                    savedUser,
                    ...prev.filter(u => u.id !== savedUser.id && normalizeCivilId(u.civilId) !== cleanCivilId)
                ];
                saveMockUsers(next);
                return next;
            });

            // 3. Clear form and close modal
            setFormCivilId('');
            setFormName('');
            setFormWorkEntity('');
            setFormJobTitle('');
            setFormPhone('');
            setFormPassword('');
            setIsAddModalOpen(false);

            showSyncNotice({
                type: 'success',
                message: `تم حفظ حساب "${savedUser.name}" (سجل: ${savedUser.civilId}) ومزامنته سحابياً بنجاح.`
            });
        } catch (err: any) {
            console.error("Failed to save user:", err);
            alert(`فشل الحفظ السحابي: ${err?.message || 'خطأ غير معروف'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Arabic normalized search (Issue 15)
    const filteredUsers = users.filter(u => {
        const q = normalizeArabic(searchQuery);
        const qNormCivil = normalizeCivilId(searchQuery);
        if (!q && !qNormCivil) return true;
        return (
            (q && normalizeArabic(u.name).includes(q)) ||
            (qNormCivil && u.civilId && normalizeCivilId(u.civilId).includes(qNormCivil)) ||
            (q && u.workEntity && normalizeArabic(u.workEntity).includes(q)) ||
            (q && u.jobTitle && normalizeArabic(u.jobTitle).includes(q))
        );
    });

    const activeCount = users.filter(u => u.status !== 'disabled').length;
    const disabledCount = users.filter(u => u.status === 'disabled').length;

    return (
        <div className="space-y-5" dir="rtl">
            {/* Page Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <h3 className="text-fluid-base sm:text-fluid-lg font-bold text-primary-dark flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-primary-medium" />
                        <span>إدارة المستخدمين ومنح الصلاحيات</span>
                    </h3>
                    <p className="text-fluid-xs text-slate-500 mt-0.5">التحكم الكامل بالحسابات، المزامنة السحابية الفورية، وتحديد صلاحيات الإحداثيات والتقارير</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={isSyncing}
                        onClick={() => refreshAndSyncUsers(true)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl gap-1.5 text-fluid-xs"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة سحابية'}</span>
                    </Button>

                    <Button onClick={openAddModal} className="bg-primary-dark hover:bg-primary-medium text-white font-bold rounded-xl gap-2 shadow-xs text-fluid-xs">
                        <UserPlus className="h-4 w-4" />
                        إضافة مستخدم جديد
                    </Button>
                </div>
            </div>

            {syncNotice && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    syncNotice.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <Cloud className="h-4 w-4 shrink-0" />
                    <span>{syncNotice.message}</span>
                </div>
            )}

            {/* Quick Stats Bar & Search */}
            <div className="ds-grid-auto-fit">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                    <span className="text-fluid-2xs font-bold text-slate-500">إجمالي الحسابات</span>
                    <span className="text-fluid-lg font-black text-primary-dark">{users.length}</span>
                </div>
                <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-xs">
                    <span className="text-fluid-2xs font-bold text-emerald-800">مسموح لهم بالدخول (نشط)</span>
                    <span className="text-fluid-lg font-black text-emerald-700">{activeCount}</span>
                </div>
                <div className="bg-red-50/80 p-3.5 rounded-xl border border-red-200 flex items-center justify-between shadow-xs">
                    <span className="text-fluid-2xs font-bold text-red-800">معطلين من الدخول</span>
                    <span className="text-fluid-lg font-black text-red-700">{disabledCount}</span>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="بحث باسم المستخدم أو السجل المدني..."
                        className="ds-input pr-9"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
            </div>

            {/* Users Table */}
            <div className="ds-table-container">
                {filteredUsers.length > 0 ? (
                    <table className="w-full text-fluid-xs text-right whitespace-nowrap">
                        <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 uppercase font-bold">
                            <tr>
                                <th className="px-4 py-3">المستخدم / السجل المدني</th>
                                <th className="px-4 py-3">جهة العمل والمسمى الوظيفي</th>
                                <th className="px-4 py-3 text-center">نوع الحساب</th>
                                <th className="px-4 py-3 text-center">حالة الدخول</th>
                                <th className="px-4 py-3 text-center">صلاحية الإحداثيات</th>
                                <th className="px-4 py-3 text-center">الإجراءات والتحكم</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredUsers.map(u => {
                                const isDisabled = u.status === 'disabled';
                                const canCoords = u.permissions?.canViewCoordinates !== false;
                                return (
                                    <tr key={u.id} className={isDisabled ? 'bg-red-50/30' : 'hover:bg-slate-50/70'}>
                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                                    <UserIcon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{u.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono">سجل: {u.civilId || 'غير مدخل'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            <div className="font-semibold text-slate-800">{u.workEntity || 'غير محدد'}</div>
                                            <div className="text-[10px] text-slate-400">{u.jobTitle || 'موظف'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {u.role === 'admin' ? (
                                                <span className="px-2.5 py-1 text-[10px] font-extrabold text-blue-800 bg-blue-100 rounded-full border border-blue-200">
                                                    مسؤول نظام
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded-full border border-emerald-200">
                                                    منسوبي الإدارة
                                                </span>
                                            )}
                                        </td>

                                        {/* Access Status (Active vs Disabled) */}
                                        <td className="px-4 py-3 text-center">
                                            {isDisabled ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-red-700 bg-red-100 rounded-full border border-red-200">
                                                    <XCircle className="h-3 w-3" />
                                                    معطل الدخول
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    مسموح بالدخول
                                                </span>
                                            )}
                                        </td>

                                        {/* Coordinates permission status */}
                                        <td className="px-4 py-3 text-center">
                                            {canCoords ? (
                                                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-md border border-emerald-200">
                                                    متاحة 📍
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 rounded-md border border-amber-200">
                                                    مخفية 🔒
                                                </span>
                                            )}
                                        </td>

                                        {/* Action Buttons */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* Toggle Disable / Enable Access */}
                                                <button
                                                    onClick={() => handleToggleStatus(u)}
                                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm ${isDisabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'}`}
                                                    title={isDisabled ? 'السماح بتسجيل الدخول' : 'تعطيل الحساب ومنعه من الدخول'}
                                                >
                                                    {isDisabled ? (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            <span>السماح بالدخول</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="h-3.5 w-3.5 text-amber-700" />
                                                            <span>تعطيل الدخول</span>
                                                        </>
                                                    )}
                                                </button>

                                                {/* Reset Password Button (Admin Only) */}
                                                <button
                                                    onClick={() => handleResetPassword(u)}
                                                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                                                    title="إعادة تعيين كلمة المرور للمستخدم"
                                                >
                                                    <Key className="h-4 w-4" />
                                                </button>

                                                {/* Edit permissions modal */}
                                                <button
                                                    onClick={() => openEditModal(u)}
                                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
                                                    title="تعديل الصلاحيات والبيانات"
                                                >
                                                    <Settings2 className="h-4 w-4" />
                                                </button>

                                                {/* Delete user button */}
                                                <button
                                                    onClick={() => setUserToDelete(u)}
                                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                                                    title="حذف الحساب"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-slate-500 font-bold text-fluid-sm">
                        لا يوجد مستخدمون مطابقون لبحثك.
                    </div>
                )}
            </div>

            {/* Add / Edit User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 relative border border-gray-100">
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute top-4 left-4 p-1.5 rounded-full text-gray-400 hover:bg-gray-100"
                        >
                            <XCircle className="h-5 w-5" />
                        </button>

                        <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary-medium" />
                            <span>{editingUser ? 'تعديل بيانات وصلاحيات المستخدم' : 'إضافة مستخدم جديد من منسوبي الإدارة'}</span>
                        </h4>

                        <form onSubmit={handleSaveUser} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">رقم السجل المدني</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formCivilId}
                                        onChange={e => setFormCivilId(normalizeCivilId(e.target.value))}
                                        placeholder="10 أرقام"
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold"
                                        maxLength={15}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكامل</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="اسم منسوب الإدارة"
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">جهة العمل / الإدارة</label>
                                    <select
                                        value={formWorkEntity}
                                        onChange={e => setFormWorkEntity(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                                    >
                                        <option value="الشؤون التعليمية">الشؤون التعليمية</option>
                                        <option value="الموارد البشرية">الموارد البشرية</option>
                                        <option value="وحدة القبول والتوزيع">وحدة القبول والتوزيع</option>
                                        <option value="إدارة التخطيط المدرسي">إدارة التخطيط المدرسي</option>
                                        <option value="مكتب التعليم">مكتب التعليم</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">المسمى الوظيفي</label>
                                    <select
                                        value={formJobTitle}
                                        onChange={e => setFormJobTitle(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                                    >
                                        <option value="الشؤون التعليمية">الشؤون التعليمية</option>
                                        <option value="الموارد البشرية">الموارد البشرية</option>
                                        <option value="أخصائي قبول وتوزيع">أخصائي قبول وتوزيع</option>
                                        <option value="مشرف تخطيط ومباني">مشرف تخطيط ومباني</option>
                                        <option value="محلل نظم جغرافية">محلل نظم جغرافية</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">نوع الدور في النظام</label>
                                    <select
                                        value={formRole}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (isRole(val)) setFormRole(val);
                                        }}
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                                    >
                                        <option value="user">منسوبي الإدارة</option>
                                        <option value="admin">مسؤول نظام (Admin)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">رقم الجوال (اختياري)</label>
                                    <input
                                        type="tel"
                                        value={formPhone}
                                        onChange={e => setFormPhone(e.target.value)}
                                        placeholder="05xxxxxxxx"
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                                    />
                                </div>
                            </div>

                            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium">
                                ℹ️ <strong>ملاحظة أمنية:</strong> يتم حفظ هذا المستخدم سحابياً بدون كلمة مرور مكشوفة. يقوم منسوب الإدارة بكتابة رقم سجله المدني والضغط على <strong>استدعاء البيانات</strong> لتعيين كلمة المرور الخاصة به من أي جهاز بأمان.
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1">حالة الحساب وتصريح الدخول</label>
                                <select
                                    value={formStatus}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (isStatus(val)) setFormStatus(val);
                                    }}
                                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                                >
                                    <option value="active">🟢 مسموح بالدخول (حساب نشط)</option>
                                    <option value="disabled">🔴 تعطيل الدخول (حساب معطل)</option>
                                </select>
                            </div>

                            {/* Permissions Checkboxes */}
                            <div className="p-3 bg-gray-50 border rounded-xl space-y-2 mt-2">
                                <span className="block text-xs font-extrabold text-primary-dark">منح الصلاحيات التفصيلية:</span>
                                
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permViewCoords}
                                        onChange={e => setPermViewCoords(e.target.checked)}
                                        className="rounded text-primary-dark"
                                    />
                                    <span>إظهار البطاقة التفصيلية للإحداثيات الجغرافية</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permExportReports}
                                        onChange={e => setPermExportReports(e.target.checked)}
                                        className="rounded text-primary-dark"
                                    />
                                    <span>إمكانية تصدير واستخراج التقارير والشاشات</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permSurrounding}
                                        onChange={e => setPermSurrounding(e.target.checked)}
                                        className="rounded text-primary-dark"
                                    />
                                    <span>استخدام أداة تحليل وحساب المدارس المحيطة</span>
                                </label>
                            </div>

                            <div className="flex gap-2 pt-3">
                                <Button type="submit" disabled={isSaving} className="flex-1 py-2 bg-primary-dark text-white font-bold rounded-xl flex items-center justify-center gap-2">
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    <span>{isSaving ? 'جاري الحفظ والمزامنة سحابياً...' : 'حفظ البيانات والصلاحيات'}</span>
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)} className="py-2 rounded-xl">
                                    إلغاء
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="تأكيد حذف الحساب"
                message={`هل أنت متأكد من حذف حساب "${userToDelete?.name}" برقم السجل (${userToDelete?.civilId})؟ سيتم مسح السجل من قاعدة البيانات السحابية والنسخ الاحتياطية نهائياً.`}
            />
        </div>
    );
}
