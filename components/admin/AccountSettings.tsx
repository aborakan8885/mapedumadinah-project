import React, { useState, useEffect } from 'react';
import { User, Shield, Mail, Lock, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { Button } from '../ui/Button';

export const AccountSettings: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [email, setEmail] = useState('aborakan8885@gmail.com');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('educational_map_current_user');
        if (savedUser) {
            const parsed = JSON.parse(savedUser);
            setCurrentUser(parsed);
            if (parsed.email) setEmail(parsed.email);
        }
    }, []);

    const handleSave = async () => {
        if (newPassword && newPassword !== confirmPassword) {
            setStatus({ type: 'error', message: 'كلمات المرور غير متطابقة' });
            return;
        }

        try {
            const savedUserStr = localStorage.getItem('educational_map_current_user');
            if (savedUserStr) {
                const user = JSON.parse(savedUserStr);
                const updatedUser = {
                    ...user,
                    email: email,
                    password: newPassword || user.password
                };
                
                // Update the session user
                localStorage.setItem('educational_map_current_user', JSON.stringify(updatedUser));
                
                // Also update the Mock Users database so the login works next time
                const MOCK_USERS_KEY = 'educational_map_users';
                const usersJson = localStorage.getItem(MOCK_USERS_KEY);
                if (usersJson) {
                    const users = JSON.parse(usersJson);
                    const idx = users.findIndex((u: any) => u.civilId === updatedUser.civilId);
                    if (idx !== -1) {
                        users[idx] = { ...users[idx], email: email, password: newPassword || users[idx].password };
                        localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
                    }
                }

                setCurrentUser(updatedUser);
                setStatus({ type: 'success', message: 'تم تحديث بيانات الحساب بنجاح' });
                setNewPassword('');
                setConfirmPassword('');
                
                // Force a page refresh to apply changes globally
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (error) {
            console.error("Save account error:", error);
            setStatus({ type: 'error', message: 'حدث خطأ أثناء حفظ البيانات' });
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
                <div className="p-3 bg-primary-light/10 rounded-xl">
                    <Shield className="h-6 w-6 text-primary-dark" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">إعدادات الحساب والمسؤول</h2>
                    <p className="text-sm text-gray-500">إدارة بيانات الدخول والمزامنة السحابية</p>
                </div>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                    status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                    {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <span className="font-medium text-sm">{status.message}</span>
                </div>
            )}

            <div className="space-y-6">
                <div className="grid gap-2">
                    <label className="text-sm font-bold text-gray-700 mr-1 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        رقم السجل المدني (لا يمكن تغييره)
                    </label>
                    <input
                        type="text"
                        value={currentUser?.civilId || '1068575628'}
                        disabled
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-mono cursor-not-allowed"
                    />
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-bold text-gray-700 mr-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        البريد الإلكتروني المعتمد للمزامنة
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-light outline-none transition-all"
                    />
                    <p className="text-[10px] text-amber-600 font-medium">يجب أن يتطابق مع بريدك في Google لضمان عمل المزامنة السحابية.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-bold text-gray-700 mr-1 flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            كلمة المرور الجديدة
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="********"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-light outline-none transition-all"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-bold text-gray-700 mr-1 flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            تأكيد كلمة المرور
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="********"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-light outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={handleSave}
                        className="w-full bg-primary-dark hover:bg-primary-medium text-white py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 font-bold transition-all"
                    >
                        <Save className="h-5 w-5" />
                        حفظ التغييرات الجديدة
                    </Button>
                </div>
            </div>
        </div>
    );
};
