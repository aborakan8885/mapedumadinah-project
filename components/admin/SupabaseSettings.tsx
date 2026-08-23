import React, { useState, useEffect, useCallback } from 'react';
import { Database, Cloud, CheckCircle, AlertCircle, Copy, Check, ExternalLink, RefreshCw, Link2, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { getSupabaseCredentials, saveSupabaseCredentials, SUPABASE_SQL_SCHEMA, getSupabaseClient } from '../../lib/supabase';
import { getAllFiles } from '../../lib/db';

export const SupabaseSettings: React.FC = () => {
    const [creds] = useState(() => getSupabaseCredentials());
    const [url, setUrl] = useState(creds.url);
    const [anonKey, setAnonKey] = useState(creds.anonKey);
    const [isConfigured, setIsConfigured] = useState(creds.isConfigured);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
    const [copiedSql, setCopiedSql] = useState(false);
    const [fileCount, setFileCount] = useState<number | null>(null);

    const loadStats = useCallback(async () => {
        try {
            const files = await getAllFiles();
            setFileCount(files.length);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSaveAndTest = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);

        try {
            saveSupabaseCredentials(url, anonKey);
            const client = getSupabaseClient();
            if (!client) {
                setConnectionStatus({
                    success: false,
                    message: 'يرجى إدخال رابط المشروع (Project URL) والمفتاح العام (Anon Public Key) بشكل صحيح.'
                });
                return;
            }

            // Test query on educational_files or table check
            const { error } = await client.from('educational_files').select('id').limit(1);

            if (error) {
                // If table doesn't exist yet, it's still connected to Supabase
                if (error.code === '42P01') {
                    setConnectionStatus({
                        success: true,
                        message: 'تم الاتصال بـ Supabase بنجاح! يرجى تشغيل كود الـ SQL الموضح بالأسفل لإنشاء الجداول في قاعدة بياناتك.'
                    });
                    setIsConfigured(true);
                } else {
                    setConnectionStatus({
                        success: false,
                        message: `فشل الاتصال: ${error.message}`
                    });
                }
            } else {
                setConnectionStatus({
                    success: true,
                    message: 'تم الاتصال بقاعدة بيانات Supabase وجداول المدارس السحابية بنجاح 🟢'
                });
                setIsConfigured(true);
            }
            await loadStats();
        } catch (err: any) {
            setConnectionStatus({
                success: false,
                message: `خطأ في الاتصال: ${err.message || 'تعذر الوصول إلى Supabase'}`
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleCopySql = () => {
        navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2500);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                            <Cloud className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span>إدارة المزامنة السحابية (Supabase)</span>
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    تكوين ثابت (Hardcoded)
                                </span>
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                التكوين مثبت برمجياً لضمان استقرار الاتصال عبر جميع الأجهزة والمتصفحات.
                            </p>
                        </div>
                    </div>

                    <a 
                        href="https://supabase.com/dashboard" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                    >
                        <span>لوحة تحكم Supabase</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>

            {/* Connection Status Banner */}
            {connectionStatus && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                    connectionStatus.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                    {connectionStatus.success ? <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />}
                    <span className="text-xs font-bold">{connectionStatus.message}</span>
                </div>
            )}

            {/* Credentials Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-emerald-600" />
                    <span>بيانات الاعتماد لمشروع Supabase</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            رابط المشروع (Project URL)
                        </label>
                        <input
                            type="text"
                            value={url}
                            readOnly
                            disabled
                            placeholder="https://xxxxxxxxxxxx.supabase.co"
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-medium text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            المفتاح العام (anon / public key)
                        </label>
                        <input
                            type="password"
                            value={anonKey}
                            readOnly
                            disabled
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-medium text-gray-500"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                        onClick={handleSaveAndTest}
                        disabled={testingConnection}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 shadow-sm"
                    >
                        {testingConnection ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        <span>اختبار الاتصال الحالي</span>
                    </Button>
                </div>
            </div>

            {/* 1-Click SQL Schema Setup */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Database className="h-4 w-4 text-emerald-600" />
                            <span>كود تهيئة الجداول السحابية (SQL Schema)</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            انسخ هذا الكود والصقه في نافذة <strong>SQL Editor</strong> في Supabase لإنشاء جداول المدارس، الملاحظات، والمستخدمين تلقائياً.
                        </p>
                    </div>

                    <Button
                        onClick={handleCopySql}
                        variant="secondary"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold gap-2"
                    >
                        {copiedSql ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        <span>{copiedSql ? 'تم النسخ بنجاح!' : 'نسخ كود SQL'}</span>
                    </Button>
                </div>

                <div className="relative">
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 border border-gray-800 leading-relaxed custom-scrollbar text-left" dir="ltr">
                        {SUPABASE_SQL_SCHEMA}
                    </pre>
                </div>
            </div>
        </div>
    );
};
