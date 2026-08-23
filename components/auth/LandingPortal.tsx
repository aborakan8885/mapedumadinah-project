import React, { useState } from 'react';
import { User as UserIcon, ShieldCheck, LogIn, Search, CheckCircle2, AlertTriangle, KeyRound, Building, MapPin, Sparkles, ArrowRight, EyeOff, Lock, FileSpreadsheet, MessageSquare, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';
import type { User } from '../../types';
import { getMockUsers, saveMockUsers } from '../modals/AuthModal';
import { MinistryLogo } from '../MinistryLogo';
import { DeveloperContactModal } from './DeveloperContactModal';
import { GuideModal } from '../modals/GuideModal';

interface LandingPortalProps {
  onLoginSuccess: (user: User) => void;
}

// Simulated Civil ID database for Ministry Employees
const MOCK_CIVIL_ID_DATABASE: Record<string, { name: string; workEntity: string; jobTitle: string; phone: string }> = {
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
  },
  '1022233344': {
    name: 'فيصل بن بدر الصاعدي',
    workEntity: 'مكتب تعليم وسط المدينة',
    jobTitle: 'مشرف تخطيط ومباني',
    phone: '0533333333'
  },
  '1011122233': {
    name: 'سارة بنت خالد المطيري',
    workEntity: 'الشؤون التعليمية • وحدة القبول',
    jobTitle: 'أخصائي بيانات واستعلام مكاني',
    phone: '0566677788'
  },
  '1044455566': {
    name: 'فهد بن أحمد الرشيدي',
    workEntity: 'إدارة التخطيط المدرسي',
    jobTitle: 'محلل نظم جغرافية',
    phone: '0544411122'
  }
};

export const LandingPortal: React.FC<LandingPortalProps> = ({ onLoginSuccess }) => {
  const [selectedGate, setSelectedGate] = useState<'employee' | 'beneficiary'>('employee');
  const [employeeMode, setEmployeeMode] = useState<'login' | 'register_step1' | 'register_step2' | 'register_step3'>('login');
  const [error, setError] = useState('');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Login form state
  const [civilIdLogin, setCivilIdLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Registration states
  const [inputCivilId, setInputCivilId] = useState('');
  const [fetchedEmployee, setFetchedEmployee] = useState<{ name: string; civilId: string; workEntity: string; jobTitle: string; phone: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
        canViewCoordinates: false, // إخفاء الإحداثيات الجغرافية
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

    // New admin credentials
    if (idClean === '1068575628' && pwdClean === 'salim123321rs&1') {
      const adminUser: User = {
        id: 'admin-main',
        civilId: '1068575628',
        name: 'مدير النظام الرئيسي',
        role: 'admin',
        userType: 'employee',
        workEntity: 'الإدارة العامة للتعليم',
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

    // Default hardcoded admin fallback
    if ((idClean.toLowerCase() === 'admin' || idClean === '1000000000') && pwdClean === 'admin') {
      const adminUser: User = {
        id: 'admin-user',
        civilId: '1000000000',
        name: 'مسؤول النظام الرئيسي',
        role: 'admin',
        userType: 'employee',
        workEntity: 'الإدارة العامة للتعليم',
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

  const handleConfirmEmployeeData = () => {
    setError('');
    setEmployeeMode('register_step3');
  };

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
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden" dir="rtl">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/30 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-0 right-0 w-72 md:w-96 h-72 md:h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 md:w-96 h-72 md:h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Official Top Banner */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl px-3 sm:px-6 py-1.5 sm:py-2 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 text-right">
            <MinistryLogo variant="badge" className="h-8 sm:h-10" />
            <div>
              <div className="text-[8px] sm:text-[9px] text-emerald-400 font-extrabold tracking-widest uppercase">المملكة العربية السعودية • وزارة التعليم</div>
              <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">الإدارة العامة للتعليم بمنطقة المدينة المنورة</h1>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium">الشؤون التعليمية • وحدة القبول</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700 text-[9px] sm:text-xs font-bold text-slate-300">
            <Sparkles className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>بوابة الدخول الإلكترونية الموحدة</span>
          </div>

          <button 
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-2 bg-[#1a546d] hover:bg-[#246a85] px-4 py-2 rounded-2xl border-2 border-primary-light/50 text-white transition-all shadow-lg hover:shadow-primary-light/20 group animate-pulse-subtle"
          >
            <BookOpen className="h-5 w-5 text-primary-light group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-sm font-bold">شرح استخدام الخارطة التعليمية</span>
          </button>
        </div>
      </header>

      {/* Main Content Portal */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-2 sm:py-4 flex flex-col items-center justify-center overflow-hidden">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-2 sm:mb-3 px-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[9px] sm:text-[10px] font-bold mb-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>منصة الخارطة التعليمية للمدارس والاستعلامات المكانية</span>
          </div>
          <h2 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight leading-tight mb-1">
            مرحباً بك عزيزي المستخدم / عزيزي المستفيد
          </h2>
          <p className="text-slate-300 text-[10px] sm:text-xs font-normal leading-normal">
            حدد نوع المستخدم وتأكيد الدخول للانتقال لاستعراض المدارس والتحليل المكاني
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="w-full max-w-3xl mb-2 shrink-0">
            <Alert className="bg-red-950/80 border-red-800 text-red-200 rounded-lg shadow-lg backdrop-blur-md py-1.5 px-3">
              <AlertDescription className="text-[11px] font-bold flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span>{error}</span>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Gate Switcher Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full max-w-4xl items-stretch">
          
          {/* GATE 1: EMPLOYEES & STAFF */}
          <div className={`bg-slate-900/95 border-2 rounded-xl p-3 sm:p-4 flex flex-col justify-between transition-all duration-300 backdrop-blur-md ${selectedGate === 'employee' ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-slate-800 hover:border-slate-700'}`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                  <Building className="h-4 w-4" />
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold rounded-full">
                  منسوبو وموظفو التعليم
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">بوابة دخول منسوبي الإدارة والمسؤولين</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mb-2 leading-tight">الدخول بواسطة **رقم السجل المدني** وكلمة المرور للوصول للصلاحيات الجغرافية</p>

              {/* Form Views */}
              {employeeMode === 'login' && (
                <form onSubmit={handleEmployeeLogin} className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-0.5">رقم السجل المدني (المستخدم)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={civilIdLogin}
                        onChange={e => setCivilIdLogin(e.target.value)}
                        placeholder="أدخل 10 أرقام السجل المدني..."
                        className="w-full pl-3 pr-7 py-1.5 bg-slate-950/90 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-xs font-semibold"
                        required
                      />
                      <UserIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-0.5">كلمة المرور</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={passwordLogin}
                        onChange={e => setPasswordLogin(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3 pr-7 py-1.5 bg-slate-950/90 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-xs"
                        required
                      />
                      <KeyRound className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    onClick={() => setSelectedGate('employee')}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>تسجيل الدخول والتنقل للموقع</span>
                  </Button>

                  <div className="pt-1.5 border-t border-slate-800 text-center">
                    <button
                      type="button"
                      onClick={() => { setEmployeeMode('register_step1'); setError(''); }}
                      className="text-[10px] font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>تفعيل وتسجيل حساب جديد بالسجل المدني</span>
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 1: Enter Civil ID */}
              {employeeMode === 'register_step1' && (
                <form onSubmit={handleCivilIdFetch} className="space-y-2">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-medium">
                    ادخل رقم السجل المدني واضغط على <strong className="text-emerald-400">استدعاء البيانات</strong> للتحقق من وجودك بالنظام.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-0.5">رقم السجل المدني</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={inputCivilId}
                        onChange={e => setInputCivilId(e.target.value)}
                        placeholder="مثال: 1098765432"
                        className="w-full pl-3 pr-7 py-1.5 bg-slate-950 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-mono font-bold text-center tracking-wider"
                        maxLength={10}
                        required
                      />
                      <UserIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button type="submit" className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1">
                      <Search className="h-3.5 w-3.5" />
                      استدعاء البيانات
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEmployeeMode('login')} className="py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs">
                      إلغاء
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 2: Confirm Details */}
              {employeeMode === 'register_step2' && fetchedEmployee && (
                <div className="space-y-2">
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-right">
                    <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-[10px] mb-1.5 pb-1 border-b border-emerald-800/50">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>بيانات المنسوب المعتمدة بالنظام:</span>
                    </div>

                    <div className="space-y-0.5 text-[10px]">
                      <div><span className="text-slate-400 font-bold">الاسم: </span><span className="text-white font-bold">{fetchedEmployee.name}</span></div>
                      <div><span className="text-slate-400 font-bold">السجل: </span><span className="text-emerald-300 font-mono font-bold">{fetchedEmployee.civilId}</span></div>
                      <div><span className="text-slate-400 font-bold">جهة العمل: </span><span className="text-white">{fetchedEmployee.workEntity}</span></div>
                      <div><span className="text-slate-400 font-bold">المسمى: </span><span className="text-white">{fetchedEmployee.jobTitle}</span></div>
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-300 font-medium text-center">
                    اضغط <strong className="text-emerald-400">تأكيد البيانات والمتابعة</strong> لوضع كلمة المرور.
                  </p>

                  <div className="flex gap-1.5">
                    <Button onClick={handleConfirmEmployeeData} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تأكيد البيانات والمتابعة
                    </Button>
                    <Button variant="secondary" onClick={() => setEmployeeMode('register_step1')} className="py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs">
                      تراجع
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Create Password */}
              {employeeMode === 'register_step3' && fetchedEmployee && (
                <form onSubmit={handleFinalRegistration} className="space-y-2">
                  <div className="p-2 bg-emerald-950/30 border border-emerald-800/50 rounded-lg text-[10px] text-emerald-300 font-medium flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>كلمة المرور للحساب (<strong className="font-mono text-white">{fetchedEmployee.civilId}</strong>)</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-0.5">كلمة المرور الجديدة</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور..."
                        className="w-full pl-3 pr-7 py-1.5 bg-slate-950 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                        required
                      />
                      <KeyRound className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-0.5">تأكيد كلمة المرور</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="أعد إدخال كلمة المرور..."
                        className="w-full pl-3 pr-7 py-1.5 bg-slate-950 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                        required
                      />
                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-xs flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    تأكيد كلمة المرور وتفعيل الحساب
                  </Button>
                </form>
              )}
            </div>

            {/* Included Permissions Checklist for Employees */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="block text-[9px] font-extrabold text-slate-400 mb-1">مميزات وضع المنسوبين:</span>
              <ul className="space-y-0.5 text-[10px] text-slate-300 font-medium">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span>عرض البطاقات التفصيلية والإحداثيات الجغرافية الكاملة</span>
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span>استخراج وتصدير التقارير الرسمية وطباعة كليشة القبول</span>
                </li>
              </ul>
            </div>
          </div>


          {/* GATE 2: BENEFICIARIES & VISITORS */}
          <div className={`bg-slate-900/95 border-2 rounded-xl p-3 sm:p-4 flex flex-col justify-between transition-all duration-300 backdrop-blur-md ${selectedGate === 'beneficiary' ? 'border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/30' : 'border-slate-800 hover:border-slate-700'}`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400 border border-teal-500/20">
                  <UserIcon className="h-4 w-4" />
                </div>
                <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[9px] sm:text-[10px] font-bold rounded-full">
                  المستفيدون والجمهور العام
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">بوابة دخول المستفيدين والزوار</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mb-2 leading-tight">استعراض سريع للخدمات والخرائط التعليمية دون الحاجة لسرية الحسابات</p>

              <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-lg space-y-1.5 mb-2">
                <div className="flex items-center gap-1 text-teal-300 font-bold text-[10px]">
                  <Sparkles className="h-3 w-3 text-teal-400 shrink-0" />
                  <span>خصائص وضع المستفيد:</span>
                </div>
                <ul className="space-y-1 text-[10px] text-slate-300 font-medium">
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-teal-400 shrink-0" />
                    <span>دخول فوري بضغطة زر واحدة بدون كلمة مرور.</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-teal-400 shrink-0" />
                    <span>تصفية والبحث في كافة المدارس والحي الجغرافي.</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-teal-400 shrink-0" />
                    <span>حساب واستخراج المدارس المحيطة بالمسافة.</span>
                  </li>
                  <li className="flex items-center gap-1 text-amber-300 font-bold bg-amber-500/10 p-1 rounded border border-amber-500/20 text-[9px]">
                    <EyeOff className="h-3 w-3 text-amber-400 shrink-0" />
                    <span>حماية البيانات: البطاقة التفصيلية للإحداثيات محجوبة.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => { setSelectedGate('beneficiary'); handleBeneficiaryAccess(); }}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>الدخول فوراً كمستفيد والتنقل للموقع</span>
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </div>
          </div>

        </div>
      </main>

      {/* Developer Contact Button (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20">
        <button
          onClick={() => setIsContactModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 rounded-full text-slate-300 hover:text-white text-xs font-bold transition-all shadow-lg backdrop-blur-md group"
        >
          <MessageSquare className="h-4 w-4 group-hover:scale-110 transition-transform" />
          <span>للملاحظات للتواصل مع المطور</span>
        </button>
      </div>

      <DeveloperContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
      />

      <GuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />
    </div>
  );
};
