import React, { useState } from 'react';
import { X, LogIn, UserCheck, ShieldCheck, Search, CheckCircle2, AlertTriangle, KeyRound, Building, User as UserIcon, Loader2, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import type { User } from '../../types';
import { auth } from '../../lib/firebase';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const MOCK_USERS_KEY = 'educational_map_users';

const INITIAL_DEFAULT_USERS: User[] = [
  {
    id: 'admin-1068575628',
    civilId: '1068575628',
    name: 'مدير النظام الرئيسي',
    password: 'salim123321rs&1',
    role: 'admin',
    userType: 'employee',
    workEntity: 'الإدارة العامة للتعليم • المدينة المنورة',
    status: 'active',
    email: 'aborakan8885@gmail.com',
    permissions: {
      visibleLayers: ['schools', 'kmz'],
      canViewCoordinates: true,
      canExportReports: true,
      canUseSurroundingAnalysis: true
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'emp-1087654321',
    civilId: '1087654321',
    name: 'سعود بن فهد العتيبي',
    password: '123456',
    role: 'user',
    userType: 'employee',
    workEntity: 'مكتب تعليم شرق المدينة',
    jobTitle: 'مشرف متابعة ميدانية',
    status: 'disabled',
    phone: '0544444444',
    permissions: {
      visibleLayers: ['schools', 'kmz'],
      canViewCoordinates: false,
      canExportReports: false,
      canUseSurroundingAnalysis: true
    },
    createdAt: new Date().toISOString()
  }
];

export const getMockUsers = (): User[] => {
  try {
    const usersJson = localStorage.getItem(MOCK_USERS_KEY);
    if (!usersJson) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(INITIAL_DEFAULT_USERS));
      return INITIAL_DEFAULT_USERS;
    }
    return JSON.parse(usersJson);
  } catch (e) {
    console.error("Failed to parse users from localStorage", e);
    return INITIAL_DEFAULT_USERS;
  }
};

export const saveMockUsers = (users: User[]) => {
  try {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Failed to save users to localStorage", e);
  }
};

const MOCK_CIVIL_ID_DATABASE: Record<string, { name: string; workEntity: string; jobTitle: string; phone: string }> = {
  '1068575628': {
    name: 'مدير النظام الرئيسي',
    workEntity: 'الإدارة العامة للتعليم • المدينة المنورة',
    jobTitle: 'مسؤول النظام الرئيسي',
    phone: '05xxxxxxxx'
  },
  '1098765432': {
    name: 'عبدالرحمن بن محمد الغامدي',
    workEntity: 'الشؤون التعليمية • وحدة القبول',
    jobTitle: 'مهندس جغرافيا ومساحة',
    phone: '0512345678'
  },
  '1055544433': {
    name: 'منى بنت عبدالعزيز الجهني',
    workEntity: 'الشؤون التعليمية • وحدة القبول',
    jobTitle: 'رئيس قسم القبول التوزيعي',
    phone: '0598765432'
  }
};

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'beneficiary' | 'employee'>('employee');
  const [employeeMode, setEmployeeMode] = useState<'login' | 'register_step1' | 'register_step2' | 'register_step3'>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [civilIdLogin, setCivilIdLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Google Login handler (DISABLED - Local Mode)
  const handleGoogleLogin = async () => {
    setError('عذراً، تسجيل الدخول عبر Google معطل حالياً في الوضع المحلي. يرجى استخدام الدخول التقليدي برقم السجل.');
  };

  // Registration states (rest of code)

  // Registration states
  const [inputCivilId, setInputCivilId] = useState('');
  const [fetchedEmployee, setFetchedEmployee] = useState<{ name: string; civilId: string; workEntity: string; jobTitle: string; phone: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Beneficiary login handler
  const handleBeneficiaryAccess = () => {
    const beneficiaryUser: User = {
      id: `beneficiary-${Date.now()}`,
      name: 'مستفيد (زائر)',
      role: 'user',
      userType: 'beneficiary',
      workEntity: 'العموم / مستفيد من الخدمة',
      status: 'active',
      permissions: {
        visibleLayers: ['schools', 'kmz'],
        canViewCoordinates: false, // بدون البطاقة التفصيلية للإحداثيات
        canExportReports: true,
        canUseSurroundingAnalysis: true
      }
    };
    onLoginSuccess(beneficiaryUser);
  };

  // Employee Login handler
  const handleEmployeeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const idClean = civilIdLogin.trim();
    const pwdClean = passwordLogin.trim();

    if (!idClean || !pwdClean) {
      setError('الرجاء إدخال رقم السجل المدني وكلمة المرور.');
      return;
    }

    // Default hardcoded admin fallback
    if (idClean === '1068575628' && pwdClean === 'salim123321rs&1') {
      const adminUser: User = {
        id: 'admin-user',
        civilId: '1068575628',
        name: 'مدير النظام الرئيسي',
        role: 'admin',
        userType: 'employee',
        workEntity: 'الإدارة العامة للتعليم • المدينة المنورة',
        status: 'active',
        permissions: {
          visibleLayers: ['schools', 'kmz'],
          canViewCoordinates: true,
          canExportReports: true,
          canUseSurroundingAnalysis: true
        }
      };
      onLoginSuccess(adminUser);
      return;
    }

    const users = getMockUsers();
    // Search by civilId or name
    const foundUser = users.find(u => 
      (u.civilId === idClean || u.name.toLowerCase() === idClean.toLowerCase()) && 
      u.password === pwdClean
    );

    if (foundUser) {
      if (foundUser.status === 'disabled') {
        setError('⚠️ تم تعطيل إمكانية الدخول لحسابك بواسطة مسؤول النظام. الرجاء التواصل مع الإدارة.');
        return;
      }
      onLoginSuccess(foundUser);
    } else {
      setError('رقم السجل المدني أو كلمة المرور غير صحيحة.');
    }
  };

  // Step 1: Civil ID Search
  const handleCivilIdFetch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const idClean = inputCivilId.trim();

    if (!idClean || idClean.length < 5) {
      setError('الرجاء إدخال رقم السجل المدني بشكل صحيح.');
      return;
    }

    const users = getMockUsers();
    const existingUser = users.find(u => u.civilId === idClean);
    const mockRecord = MOCK_CIVIL_ID_DATABASE[idClean];

    if (!existingUser && !mockRecord) {
      setError('❌ هذا السجل المدني غير مضاف في قائمة الموظفين المعتمدين للتسجيل. لا يمكنك التسجيل بالنظام.');
      return;
    }

    const name = existingUser?.name || mockRecord?.name || `منسوب تعليم (${idClean.slice(-4)})`;
    const workEntity = existingUser?.workEntity || mockRecord?.workEntity || 'الشؤون التعليمية';
    const jobTitle = existingUser?.jobTitle || mockRecord?.jobTitle || 'الشؤون التعليمية';
    const phone = existingUser?.phone || mockRecord?.phone || '';

    setFetchedEmployee({
      civilId: idClean,
      name,
      workEntity,
      jobTitle,
      phone
    });

    setEmployeeMode('register_step2');
  };

  // Step 2: Confirm fetched details
  const handleConfirmEmployeeData = () => {
    setError('');
    setEmployeeMode('register_step3');
  };

  // Step 3: Password creation (Username = Civil ID)
  const handleFinalRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('الرجاء إدخال كلمة المرور وتأكيدها.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    if (!fetchedEmployee) return;

    const users = getMockUsers();
    const existingIndex = users.findIndex(u => u.civilId === fetchedEmployee.civilId);

    let finalUser: User;

    if (existingIndex >= 0) {
      const existingUser = users[existingIndex];
      finalUser = {
        ...existingUser,
        password: newPassword,
        name: fetchedEmployee.name || existingUser.name,
        workEntity: fetchedEmployee.workEntity || existingUser.workEntity,
        jobTitle: fetchedEmployee.jobTitle || existingUser.jobTitle,
        phone: fetchedEmployee.phone || existingUser.phone,
        status: 'active'
      };
      users[existingIndex] = finalUser;
      saveMockUsers(users);
    } else {
      finalUser = {
        id: `emp-${fetchedEmployee.civilId}`,
        civilId: fetchedEmployee.civilId,
        name: fetchedEmployee.name,
        password: newPassword,
        role: 'user',
        userType: 'employee',
        workEntity: fetchedEmployee.workEntity,
        jobTitle: fetchedEmployee.jobTitle,
        phone: fetchedEmployee.phone,
        status: 'active',
        permissions: {
          visibleLayers: ['schools', 'kmz'],
          canViewCoordinates: true,
          canExportReports: true,
          canUseSurroundingAnalysis: true
        },
        createdAt: new Date().toISOString()
      };
      saveMockUsers([...users, finalUser]);
    }

    onLoginSuccess(finalUser);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={onClose}
      dir="rtl"
    >
      <Card
        className="w-full max-w-lg bg-white shadow-2xl relative overflow-hidden rounded-2xl border-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="bg-gradient-to-l from-primary-dark via-primary-dark to-slate-900 text-white p-6 pb-5 text-center relative">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <ShieldCheck className="h-7 w-7 text-primary-light" />
          </div>
          <h2 className="text-xl font-bold text-white">بوابة الدخول للخارطة التعليمية</h2>
          <p className="text-xs text-emerald-200/80 mt-1">اختر نوع الدخول المناسب لاستخدام الخدمات</p>

          {/* Dual Category Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-5 bg-black/30 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => { setActiveTab('employee'); setError(''); setEmployeeMode('login'); }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'employee' ? 'bg-primary-light text-primary-dark shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
            >
              <UserCheck className="h-4 w-4" />
              <span>دخول الموظفين</span>
            </button>

            <button
              onClick={() => { setActiveTab('beneficiary'); setError(''); }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'beneficiary' ? 'bg-primary-light text-primary-dark shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
            >
              <UserIcon className="h-4 w-4" />
              <span>دخول المستفيدين</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <Alert className="mb-4 bg-red-50 border-red-200 text-red-800 rounded-xl">
              <AlertDescription className="text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* BENEFICIARY TAB */}
          {activeTab === 'beneficiary' && (
            <div className="space-y-4 text-center py-2">
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-right">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>مميزات وضع المستفيد:</span>
                </div>
                <ul className="space-y-2 text-xs text-gray-600 font-medium pr-7 list-disc">
                  <li>لا يتطلب تسجيل حساب أو كلمة مرور.</li>
                  <li>استعراض جميع الخدمات والخرائط التعليمية.</li>
                  <li className="text-amber-700 font-bold">بدون البطاقة التفصيلية للإحداثيات الجغرافية.</li>
                </ul>
              </div>

              <Button
                onClick={handleBeneficiaryAccess}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <UserIcon className="h-5 w-5" />
                <span>الدخول فوراً كمستفيد</span>
              </Button>
            </div>
          )}

          {/* EMPLOYEE TAB */}
          {activeTab === 'employee' && (
            <>
              {/* LOGIN MODE */}
              {employeeMode === 'login' && (
                <div className="space-y-6">
                  {/* Administrative Notice */}
                  <div className="p-4 bg-primary-light/5 border border-primary-light/20 rounded-2xl text-center">
                    <p className="text-sm font-bold text-primary-dark mb-2">تنبيه لمسؤول النظام:</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        لضمان <strong>مزامنة المدارس والحدود</strong> مع جميع المستخدمين، يجب استخدام الدخول عبر Google ببريدك المعتمد.
                    </p>
                  </div>

                  {/* Primary Action: Google Login */}
                  <Button 
                    type="button" 
                    onClick={handleGoogleLogin} 
                    disabled={isLoading}
                    className="w-full py-4 bg-white border-2 border-primary-light/30 hover:border-primary-light hover:bg-primary-light/5 text-primary-dark font-extrabold rounded-2xl shadow-sm flex items-center justify-center gap-4 transition-all text-base"
                  >
                    {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary-dark" />
                    ) : (
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                    )}
                    <span>تسجيل الدخول الرسمي (Google)</span>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-gray-400 font-bold tracking-widest">أو الدخول التقليدي</span>
                    </div>
                  </div>

                  {/* Secondary Action: Traditional Login */}
                  <form onSubmit={handleEmployeeLogin} className="space-y-4 opacity-70 focus-within:opacity-100 transition-opacity">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">رقم السجل المدني (المستخدم)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={civilIdLogin}
                          onChange={e => setCivilIdLogin(e.target.value)}
                          placeholder="أدخل 10 أرقام السجل المدني..."
                          className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-light focus:outline-none text-sm font-semibold"
                          required
                        />
                        <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور</label>
                      <div className="relative">
                        <input
                          type="password"
                          value={passwordLogin}
                          onChange={e => setPasswordLogin(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-light focus:outline-none text-sm"
                          required
                        />
                        <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    <Button type="submit" className="w-full py-3 bg-primary-dark hover:bg-primary-medium text-white font-bold rounded-xl shadow-md">
                      <LogIn className="h-4 w-4 ml-2" />
                      تسجيل دخول موظف
                    </Button>
                  </form>

                  <div className="pt-3 border-t text-center">
                    <button
                      type="button"
                      onClick={() => { setEmployeeMode('register_step1'); setError(''); }}
                      className="text-xs font-bold text-primary-dark hover:underline inline-flex items-center gap-1"
                    >
                      <span>ليس لديك حساب؟ تفعيل تسجيل حساب موظف جديد</span>
                    </button>
                  </div>
                </div>
              )}

              {/* REGISTER STEP 1: Enter Civil ID */}
              {employeeMode === 'register_step1' && (
                <form onSubmit={handleCivilIdFetch} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-900 font-medium">
                    ادخل رقم السجل المدني الخاص بك واضغط على <strong className="text-emerald-700">استدعاء البيانات</strong> للتحقق من وجودك في قائمة الموظفين المصرح لهم بالتسجيل.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">رقم السجل المدني</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={inputCivilId}
                        onChange={e => setInputCivilId(e.target.value)}
                        placeholder="مثال: 1098765432"
                        className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-light focus:outline-none text-sm font-mono font-bold text-center tracking-wider"
                        maxLength={10}
                        required
                      />
                      <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                      <Search className="h-4 w-4" />
                      استدعاء البيانات
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEmployeeMode('login')} className="py-2.5 rounded-xl">
                      إلغاء
                    </Button>
                  </div>
                </form>
              )}

              {/* REGISTER STEP 2: Confirm fetched details */}
              {employeeMode === 'register_step2' && fetchedEmployee && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-right">
                    <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm mb-3 pb-2 border-b border-emerald-200">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>تم استدعاء بيانات الموظف بنجاح:</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div><span className="text-gray-500 font-bold">الاسم الكامل: </span><span className="text-gray-900 font-extrabold">{fetchedEmployee.name}</span></div>
                      <div><span className="text-gray-500 font-bold">رقم السجل المدني: </span><span className="text-emerald-700 font-mono font-bold">{fetchedEmployee.civilId}</span></div>
                      <div><span className="text-gray-500 font-bold">جهة العمل: </span><span className="text-gray-900 font-semibold">{fetchedEmployee.workEntity}</span></div>
                      <div><span className="text-gray-500 font-bold">المسمى الوظيفي: </span><span className="text-gray-900 font-semibold">{fetchedEmployee.jobTitle}</span></div>
                      {fetchedEmployee.phone && (
                        <div><span className="text-gray-500 font-bold">رقم الجوال: </span><span className="text-gray-900 font-mono font-bold">{fetchedEmployee.phone}</span></div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 font-medium text-center">
                    اضغط على <strong className="text-emerald-700">تأكيد البيانات</strong> للانتقال لكتابة الرقم السري الجديد.
                  </p>

                  <div className="flex gap-2">
                    <Button onClick={handleConfirmEmployeeData} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      تأكيد البيانات والمتابعة
                    </Button>
                    <Button variant="secondary" onClick={() => setEmployeeMode('register_step1')} className="py-2.5 rounded-xl">
                      تراجع
                    </Button>
                  </div>
                </div>
              )}

              {/* REGISTER STEP 3: Create password (Civil ID will be username) */}
              {employeeMode === 'register_step3' && fetchedEmployee && (
                <form onSubmit={handleFinalRegistration} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>إدخال كلمة المرور الجديدة للحساب المعتمد (<span className="font-mono font-bold">{fetchedEmployee.civilId}</span>)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور الجديدة</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور..."
                        className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-light focus:outline-none text-sm"
                        required
                      />
                      <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="أعد إدخال كلمة المرور..."
                        className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-light focus:outline-none text-sm"
                        required
                      />
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    تأكيد كلمة المرور وتفعيل الحساب
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

