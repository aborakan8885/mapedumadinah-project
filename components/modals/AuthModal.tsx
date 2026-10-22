import React, { useState, useEffect } from 'react';
import { X, LogIn, UserCheck, ShieldCheck, Search, CheckCircle2, AlertTriangle, KeyRound, Building, User as UserIcon, Loader2, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import type { User } from '../../types';
import {
  fetchUsersFromSupabase,
  fetchUserByCivilIdFromSupabase,
  upsertUserToSupabase,
  normalizeCivilId
} from '../../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const MOCK_USERS_KEY = 'educational_map_users';
export const DELETED_USERS_KEY = 'educational_map_deleted_users';

export type SafeUser = Omit<User, 'password'>;

export const INITIAL_DEFAULT_USERS: User[] = [
  {
    id: 'admin-main',
    civilId: '1068575628',
    name: 'مدير النظام الرئيسي',
    password: '',
    role: 'admin',
    userType: 'employee',
    workEntity: 'الإدارة العامة للتعليم • المدينة المنورة',
    jobTitle: 'مسؤول النظام الرئيسي',
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
    id: 'emp-1057893156',
    civilId: '1057893156',
    name: 'ريان عبداللطيف بشناق',
    password: '',
    role: 'user',
    userType: 'employee',
    workEntity: 'مكتب التعليم',
    jobTitle: 'محلل نظم جغرافية',
    status: 'active',
    phone: '',
    permissions: {
      visibleLayers: ['schools', 'kmz'],
      canViewCoordinates: true,
      canExportReports: true,
      canUseSurroundingAnalysis: true
    },
    createdAt: new Date().toISOString()
  }
];

export const MOCK_CIVIL_ID_DATABASE: Record<string, { name: string; workEntity: string; jobTitle: string; phone: string }> = {
  '1068575628': {
    name: 'مدير النظام الرئيسي',
    workEntity: 'الإدارة العامة للتعليم • المدينة المنورة',
    jobTitle: 'مسؤول النظام الرئيسي',
    phone: '05xxxxxxxx'
  },
  '1057893156': {
    name: 'ريان عبداللطيف بشناق',
    workEntity: 'مكتب التعليم',
    jobTitle: 'محلل نظم جغرافية',
    phone: ''
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

function getDeletedUserKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function markUserDeletedLocally(userId: string, civilId?: string): void {
  try {
    const set = getDeletedUserKeys();
    if (userId) set.add(userId);
    const cleanId = normalizeCivilId(civilId);
    if (cleanId) set.add(cleanId);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function unmarkUserDeletedLocally(userId: string, civilId?: string): void {
  try {
    const set = getDeletedUserKeys();
    if (userId) set.delete(userId);
    const cleanId = normalizeCivilId(civilId);
    if (cleanId) set.delete(cleanId);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export const getMockUsers = (): User[] => {
  try {
    const usersJson = localStorage.getItem(MOCK_USERS_KEY);
    if (!usersJson) {
      saveMockUsers(INITIAL_DEFAULT_USERS);
      return INITIAL_DEFAULT_USERS;
    }
    const parsed: any[] = JSON.parse(usersJson);
    if (!Array.isArray(parsed)) return INITIAL_DEFAULT_USERS;
    return parsed.map(({ password, ...u }) => ({
      ...u,
      password: '',
      civilId: normalizeCivilId(u.civilId) || u.civilId
    }));
  } catch (e) {
    console.error("Failed to parse users from localStorage", e);
    return INITIAL_DEFAULT_USERS;
  }
};

export const saveMockUsers = (users: (User | SafeUser)[]) => {
  try {
    // Strip plain passwords from localStorage to prevent XSS credential theft
    const safeUsers: SafeUser[] = users.map(u => {
      const { password, ...rest } = u as any;
      return {
        ...rest,
        civilId: normalizeCivilId(rest.civilId) || rest.civilId
      };
    });
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(safeUsers));
  } catch (e) {
    console.error("Failed to save users to localStorage", e);
  }
};

/**
 * Synchronizes local users with Supabase cloud database:
 * 1. Fetches all users from Supabase 'users' table.
 * 2. Merges cloud records and updates safe localStorage cache.
 */
export async function syncUsersWithCloud(): Promise<User[]> {
  const localUsers = getMockUsers();
  const deletedKeys = getDeletedUserKeys();

  try {
    const cloudUsers = await fetchUsersFromSupabase();
    if (cloudUsers === null) {
      return localUsers;
    }

    const cloudByKey = new Map<string, User>();
    for (const cu of cloudUsers) {
      const key = normalizeCivilId(cu.civilId) || cu.id;
      cloudByKey.set(key, cu);
    }

    // Push local defaults if cloud is completely empty
    const usersToPushToCloud: User[] = [];
    for (const lu of localUsers) {
      const key = normalizeCivilId(lu.civilId) || lu.id;
      if (deletedKeys.has(lu.id) || (lu.civilId && deletedKeys.has(normalizeCivilId(lu.civilId)))) {
        continue;
      }
      const existingCloud = cloudByKey.get(key);
      if (!existingCloud) {
        usersToPushToCloud.push(lu);
        cloudByKey.set(key, lu);
      }
    }

    if (usersToPushToCloud.length > 0) {
      await Promise.allSettled(usersToPushToCloud.map(u => upsertUserToSupabase(u)));
    }

    const mergedList = Array.from(cloudByKey.values());
    if (mergedList.length > 0) {
      saveMockUsers(mergedList);
      return mergedList;
    }
    return localUsers;
  } catch (err) {
    console.warn("Cloud user sync fallback to local:", err);
    return localUsers;
  }
}

/**
 * Finds an approved employee by Civil ID across:
 * 1. Live Supabase Cloud Database ('users' table)
 * 2. Local Cache & Initial Pre-configured Users
 * 3. Built-in Approved Civil ID Registry (MOCK_CIVIL_ID_DATABASE)
 * 4. Full Cloud + Local Merged Sync
 */
export async function findApprovedEmployeeByCivilId(rawCivilId: string): Promise<{
  cleanCivilId: string;
  existingUser?: User;
  mockRecord?: { name: string; workEntity: string; jobTitle: string; phone: string };
}> {
  const cleanCivilId = normalizeCivilId(rawCivilId);
  if (!cleanCivilId) return { cleanCivilId: '' };

  const mockRecord = MOCK_CIVIL_ID_DATABASE[cleanCivilId];

  // 1. Live lookup in Supabase cloud database
  try {
    const cloudUser = await fetchUserByCivilIdFromSupabase(cleanCivilId);
    if (cloudUser) {
      // Update local cache with this fresh user
      const currentLocal = getMockUsers();
      const idx = currentLocal.findIndex(u => normalizeCivilId(u.civilId) === cleanCivilId || u.id === cloudUser.id);
      if (idx >= 0) {
        currentLocal[idx] = { ...currentLocal[idx], ...cloudUser, password: cloudUser.password || currentLocal[idx].password };
      } else {
        currentLocal.push(cloudUser);
      }
      saveMockUsers(currentLocal);

      const dynamicMockRecord = mockRecord || {
        name: cloudUser.name,
        workEntity: cloudUser.workEntity || 'الشؤون التعليمية',
        jobTitle: cloudUser.jobTitle || 'الشؤون التعليمية',
        phone: cloudUser.phone || ''
      };

      return { cleanCivilId, existingUser: cloudUser, mockRecord: dynamicMockRecord };
    }
  } catch (e) {
    console.warn("Direct cloud lookup warning:", e);
  }

  // 2. Check local cached users & initial defaults
  const localUsers = getMockUsers();
  let localMatch = localUsers.find(u => normalizeCivilId(u.civilId) === cleanCivilId || u.id === `emp-${cleanCivilId}` || u.id === `admin-${cleanCivilId}`);
  if (!localMatch) {
    localMatch = INITIAL_DEFAULT_USERS.find(u => normalizeCivilId(u.civilId) === cleanCivilId);
  }

  if (localMatch) {
    // If local match exists, attempt background sync to cloud so other devices get it too
    upsertUserToSupabase(localMatch).catch(() => {});
    return {
      cleanCivilId,
      existingUser: localMatch,
      mockRecord: mockRecord || {
        name: localMatch.name,
        workEntity: localMatch.workEntity || 'الشؤون التعليمية',
        jobTitle: localMatch.jobTitle || 'الشؤون التعليمية',
        phone: localMatch.phone || ''
      }
    };
  }

  // 3. Sync full list from cloud and search
  try {
    const allUsers = await syncUsersWithCloud();
    const existingUser = allUsers.find(u => normalizeCivilId(u.civilId) === cleanCivilId);
    if (existingUser) {
      return {
        cleanCivilId,
        existingUser,
        mockRecord: mockRecord || {
          name: existingUser.name,
          workEntity: existingUser.workEntity || 'الشؤون التعليمية',
          jobTitle: existingUser.jobTitle || 'الشؤون التعليمية',
          phone: existingUser.phone || ''
        }
      };
    }
  } catch (err) {
    console.warn("Sync error during employee lookup:", err);
  }

  return { cleanCivilId, existingUser: undefined, mockRecord };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const GENERIC_LOGIN_ERROR = 'بيانات الدخول غير صحيحة.';

export function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'beneficiary' | 'employee'>('employee');
  const [employeeMode, setEmployeeMode] = useState<'login' | 'register_step1' | 'register_step2' | 'register_step3'>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBeneficiaryLoading, setIsBeneficiaryLoading] = useState(false);

  // Login form state
  const [civilIdLogin, setCivilIdLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Registration states
  const [inputCivilId, setInputCivilId] = useState('');
  const [fetchedEmployee, setFetchedEmployee] = useState<{ name: string; civilId: string; workEntity: string; jobTitle: string; phone: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    syncUsersWithCloud().catch(() => {});
  }, []);

  // Beneficiary login handler
  const handleBeneficiaryAccess = async () => {
    setIsBeneficiaryLoading(true);
    setError('');
    try {
      await sleep(300);
      const beneficiaryUser: User = {
        id: `beneficiary-${Date.now()}`,
        name: 'مستفيد (زائر)',
        role: 'user',
        userType: 'beneficiary',
        workEntity: 'العموم / مستفيد من الخدمة',
        status: 'active',
        permissions: {
          visibleLayers: ['schools'],
          canViewCoordinates: false,
          canExportReports: false,
          canUseSurroundingAnalysis: false
        }
      };
      onLoginSuccess(beneficiaryUser);
    } catch {
      setError('تعذر تسجيل الدخول كمستفيد. يرجى إعادة المحاولة.');
    } finally {
      setIsBeneficiaryLoading(false);
    }
  };

  // Employee Login handler with timing attack mitigation and uniform error
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const rawId = civilIdLogin.trim();
    const idClean = normalizeCivilId(rawId) || rawId;
    const pwdClean = passwordLogin.trim();

    if (!idClean || !pwdClean) {
      setError('الرجاء إدخال رقم السجل المدني وكلمة المرور.');
      return;
    }

    setIsLoading(true);
    const start = Date.now();
    try {
      const { existingUser: cloudMatch } = await findApprovedEmployeeByCivilId(idClean);
      const users = await syncUsersWithCloud();

      const targetUser = cloudMatch || users.find(u =>
        normalizeCivilId(u.civilId) === idClean || (u.civilId && u.civilId === idClean)
      );

      let loginOk = false;
      let isDisabled = false;

      if (targetUser) {
        if (targetUser.status === 'disabled') {
          isDisabled = true;
        } else if (targetUser.password && targetUser.password === pwdClean) {
          loginOk = true;
        }
      }

      // Timing attack mitigation: ensure minimum 800ms response time
      const elapsed = Date.now() - start;
      if (elapsed < 800) {
        await sleep(800 - elapsed);
      }

      if (isDisabled) {
        setError('⚠️ الحساب معطل حالياً بواسطة مسؤول النظام. يرجى التواصل مع الإدارة.');
        return;
      }

      if (!loginOk || !targetUser) {
        setError(GENERIC_LOGIN_ERROR);
        return;
      }

      onLoginSuccess(targetUser);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Civil ID Search - Account Takeover Protected
  const handleCivilIdFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const idClean = normalizeCivilId(inputCivilId);

    if (!idClean || idClean.length < 10) {
      setError('الرجاء إدخال رقم سجل مدني صحيح (10 أرقام).');
      return;
    }

    setIsLoading(true);
    try {
      const { existingUser, mockRecord } = await findApprovedEmployeeByCivilId(idClean);

      if (!existingUser && !mockRecord) {
        setError('تعذر التحقق من البيانات. يرجى مراجعة مسؤول النظام.');
        return;
      }

      if (existingUser?.status === 'disabled') {
        setError('الحساب معطل حالياً بواسطة مسؤول النظام.');
        return;
      }

      // Security Lock: Only allow initial registration if password is not set yet
      if (existingUser?.password && existingUser.password.length > 0) {
        setError('هذا الحساب مفعّل بكلمة مرور مسبقاً. إن نسيت كلمة المرور فتواصل مع المسؤول لإعادة التعيين.');
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
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Confirm fetched details
  const handleConfirmEmployeeData = () => {
    setError('');
    setEmployeeMode('register_step3');
  };

  // Step 3: Password creation (Username = Civil ID)
  const handleFinalRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    if (!fetchedEmployee) return;

    setIsLoading(true);
    try {
      const cleanId = normalizeCivilId(fetchedEmployee.civilId);
      const users = await syncUsersWithCloud();
      const existingUser = users.find(u => normalizeCivilId(u.civilId) === cleanId);

      const finalUser: User = {
        id: existingUser?.id || `emp-${cleanId}`,
        civilId: cleanId,
        name: fetchedEmployee.name || existingUser?.name || 'منسوب تعليم',
        password: newPassword,
        role: existingUser?.role || 'user',
        userType: 'employee',
        workEntity: fetchedEmployee.workEntity || existingUser?.workEntity || 'الشؤون التعليمية',
        jobTitle: fetchedEmployee.jobTitle || existingUser?.jobTitle || 'الشؤون التعليمية',
        phone: fetchedEmployee.phone || existingUser?.phone || '',
        status: 'active',
        permissions: existingUser?.permissions || {
          visibleLayers: ['schools', 'kmz'],
          canViewCoordinates: true,
          canExportReports: true,
          canUseSurroundingAnalysis: true
        },
        createdAt: existingUser?.createdAt || new Date().toISOString()
      };

      unmarkUserDeletedLocally(finalUser.id, finalUser.civilId);
      const saveRes = await upsertUserToSupabase(finalUser);
      if (!saveRes.ok) {
        console.warn("Cloud save warning:", saveRes.error);
      }
      
      const nextList = [finalUser, ...users.filter(u => u.id !== finalUser.id && normalizeCivilId(u.civilId) !== cleanId)];
      saveMockUsers(nextList);
      onLoginSuccess(finalUser);
    } finally {
      setIsLoading(false);
    }
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
                disabled={isBeneficiaryLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                {isBeneficiaryLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
                <span>{isBeneficiaryLoading ? 'جاري بدء جلسة المستفيد...' : 'الدخول فوراً كمستفيد'}</span>
              </Button>
            </div>
          )}

          {/* EMPLOYEE TAB */}
          {activeTab === 'employee' && (
            <>
              {/* LOGIN MODE */}
              {employeeMode === 'login' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-right">
                    <p className="text-xs font-bold text-emerald-950 mb-1">تسجيل دخول منسوبي التعليم:</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      الدخول برقم السجل المدني وكلمة المرور الخاصة بحسابك لاستعراض كامل بيانات المدارس والإحداثيات والتقارير.
                    </p>
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

