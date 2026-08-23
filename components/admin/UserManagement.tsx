import React, { useState, useEffect } from 'react';
import { User as UserIcon, Trash2, UserPlus, ShieldCheck, ShieldAlert, Key, CheckCircle2, XCircle, Search, Edit3, Settings2 } from 'lucide-react';
import type { User } from '../../types';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { getMockUsers, saveMockUsers } from '../modals/AuthModal';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state for adding/editing user
    const [formCivilId, setFormCivilId] = useState('');
    const [formName, setFormName] = useState('');
    const [formWorkEntity, setFormWorkEntity] = useState('');
    const [formJobTitle, setFormJobTitle] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'user'>('user');
    const [formStatus, setFormStatus] = useState<'active' | 'disabled'>('active');
    
    // Permission Toggles
    const [permViewCoords, setPermViewCoords] = useState(true);
    const [permExportReports, setPermExportReports] = useState(true);
    const [permSurrounding, setPermSurrounding] = useState(true);

    useEffect(() => {
        setUsers(getMockUsers());
    }, []);

    const refreshUsers = () => {
        setUsers(getMockUsers());
    };

    const handleToggleStatus = (targetUser: User) => {
        const newStatus: 'active' | 'disabled' = targetUser.status === 'disabled' ? 'active' : 'disabled';
        const updatedUsers = users.map(u => {
            if (u.id === targetUser.id) {
                return { ...u, status: newStatus };
            }
            return u;
        });
        saveMockUsers(updatedUsers);
        setUsers(updatedUsers);
    };

    const handleDeleteConfirm = () => {
        if (!userToDelete) return;
        const updatedUsers = users.filter(u => u.id !== userToDelete.id);
        saveMockUsers(updatedUsers);
        setUsers(updatedUsers);
        setUserToDelete(null);
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
        setFormCivilId(user.civilId || '');
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

    const handleSaveUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) return;

        const permissions = {
            visibleLayers: ['schools', 'kmz'] as any,
            canViewCoordinates: permViewCoords,
            canExportReports: permExportReports,
            canUseSurroundingAnalysis: permSurrounding
        };

        if (editingUser) {
            // Update existing
            const updatedUsers = users.map(u => {
                if (u.id === editingUser.id) {
                    return {
                        ...u,
                        civilId: formCivilId,
                        name: formName,
                        workEntity: formWorkEntity,
                        jobTitle: formJobTitle,
                        phone: formPhone,
                        role: formRole,
                        userType: 'employee' as const,
                        status: formStatus,
                        permissions
                    };
                }
                return u;
            });
            saveMockUsers(updatedUsers);
            setUsers(updatedUsers);
        } else {
            // Add new user
            const newUser: User = {
                id: `emp-${formCivilId || Date.now()}`,
                civilId: formCivilId || `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                name: formName,
                password: '',
                role: formRole,
                userType: 'employee',
                workEntity: formWorkEntity || 'الشؤون التعليمية',
                jobTitle: formJobTitle || 'الشؤون التعليمية',
                phone: formPhone,
                status: formStatus,
                permissions,
                createdAt: new Date().toISOString()
            };
            const updatedUsers = [...users, newUser];
            saveMockUsers(updatedUsers);
            setUsers(updatedUsers);
        }

        setIsAddModalOpen(false);
    };

    const filteredUsers = users.filter(u => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            u.name.toLowerCase().includes(q) ||
            (u.civilId && u.civilId.includes(q)) ||
            (u.workEntity && u.workEntity.toLowerCase().includes(q)) ||
            (u.jobTitle && u.jobTitle.toLowerCase().includes(q))
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
                    <p className="text-fluid-xs text-slate-500 mt-0.5">التحكم الكامل بالحسابات، تفعيل وتعطيل الدخول، وتحديد صلاحيات الإحداثيات والتقارير</p>
                </div>

                <Button onClick={openAddModal} className="bg-primary-dark hover:bg-primary-medium text-white font-bold rounded-xl gap-2 shadow-xs text-fluid-xs">
                    <UserPlus className="h-4 w-4" />
                    إضافة مستخدم جديد
                </Button>
            </div>

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
                                        value={formCivilId}
                                        onChange={e => setFormCivilId(e.target.value)}
                                        placeholder="10 أرقام"
                                        className="w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold"
                                        maxLength={10}
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

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">نوع الدور في النظام</label>
                                <select
                                    value={formRole}
                                    onChange={e => setFormRole(e.target.value as any)}
                                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                                >
                                    <option value="user">منسوبي الإدارة</option>
                                    <option value="admin">مسؤول نظام (Admin)</option>
                                </select>
                            </div>

                            <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium">
                                ℹ️ <strong>ملاحظة:</strong> لا توجد كلمة مرور يتم إدخالها من هنا. يقوم منسوب الإدارة بإنشاء كلمة المرور الجديدة بنفسه عند التسجيل وتأكيد البيانات برقم السجل المدني.
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1">حالة الحساب وتصريح الدخول</label>
                                <select
                                    value={formStatus}
                                    onChange={e => setFormStatus(e.target.value as any)}
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
                                <Button type="submit" className="flex-1 py-2 bg-primary-dark text-white font-bold rounded-xl">
                                    حفظ البيانات والصلاحيات
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
                message={`هل أنت متأكد من حذف حساب "${userToDelete?.name}" برقم السجل (${userToDelete?.civilId})؟ لا يمكن التراجع عن الحذف.`}
            />
        </div>
    );
};

export default UserManagement;

