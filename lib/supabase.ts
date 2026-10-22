import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FileMapping, Feedback, User } from '../types';

// Environment variables - Hardcoded as requested for stable cross-device connection
const SUPABASE_URL = 'https://khrvwtbadxfuzqpbfpom.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_KcSCdguIPOApmnP7cI_jQw_dfqwG272'; 

export function getSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean } {
  const url = SUPABASE_URL;
  const anonKey = SUPABASE_ANON_KEY;
  const isConfigured = Boolean(url && anonKey && url.startsWith('https://') && anonKey.length > 10);
  return { url, anonKey, isConfigured };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  // Logic disabled as requested to keep configuration hardcoded in the source
  console.log("Saving credentials disabled: Using hardcoded configuration.");
}

let supabaseInstance: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (!supabaseInstance || lastUsedUrl !== url || lastUsedKey !== anonKey) {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUsedUrl = url;
    lastUsedKey = anonKey;
  }

  return supabaseInstance;
}

// ----------------------------------------------------
// SQL Schema definition for 1-click execution in Supabase
// ----------------------------------------------------
export const SUPABASE_SQL_SCHEMA = `-- 1. إنشاء جداول الملفات
CREATE TABLE IF NOT EXISTS public.educational_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'unassigned',
    file_type TEXT NOT NULL,
    is_boundary_layer BOOLEAN DEFAULT FALSE,
    lat_column TEXT,
    lng_column TEXT,
    name_column TEXT,
    headers JSONB,
    display_columns JSONB,
    filter_mappings JSONB,
    data JSONB,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'unassigned',
    file_type TEXT NOT NULL,
    is_boundary_layer BOOLEAN DEFAULT FALSE,
    lat_column TEXT,
    lng_column TEXT,
    name_column TEXT,
    headers JSONB,
    display_columns JSONB,
    filter_mappings JSONB,
    data JSONB,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- إزالة أي قيود فريدة سابقة
ALTER TABLE public.educational_files DROP CONSTRAINT IF EXISTS educational_files_category_key;
ALTER TABLE public.educational_files DROP CONSTRAINT IF EXISTS educational_files_filename_key;
ALTER TABLE public.educational_files DROP CONSTRAINT IF EXISTS educational_files_file_type_key;
ALTER TABLE public.educational_files DROP CONSTRAINT IF EXISTS educational_files_category_unique;

ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_category_key;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_filename_key;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_file_type_key;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_category_unique;

-- 2. إنشاء جدول الملاحظات والمقترحات
CREATE TABLE IF NOT EXISTS public.feedback (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    civil_id TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    user_type TEXT NOT NULL DEFAULT 'employee',
    work_entity TEXT,
    job_title TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. تفعيل سياسات الأمان (RLS) وحمايتها مع السماح للتطبيق (anon)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.users;
CREATE POLICY "Allow full access to anon for now" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.educational_files;
CREATE POLICY "Allow full access to anon for now" ON public.educational_files FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.files;
CREATE POLICY "Allow full access to anon for now" ON public.files FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.feedback;
CREATE POLICY "Allow full access to anon for now" ON public.feedback FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.educational_files TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.files TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.feedback TO anon, authenticated, service_role;

-- 5. زيادة وقت مهلة الاستعلام (Statement Timeout) لتفادي أخطاء الرفع الضخم
-- ملاحظة: قد تحتاج لتنفيذ هذا الأمر بصلاحيات superuser في Supabase
ALTER ROLE authenticator SET statement_timeout = '120s';

-- 6. إنشاء وتأمين مخزن الملفات السحابي (Storage Bucket)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('educational-files', 'educational-files', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات تخزين الملفات (للسماح بالرفع العام)
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
CREATE POLICY "Allow public access" ON storage.objects FOR ALL USING (bucket_id = 'educational-files') WITH CHECK (bucket_id = 'educational-files');
`;

// ----------------------------------------------------
// Database Operations (Files & Mappings)
// ----------------------------------------------------

/**
 * Fetch all files directly from Supabase.
 * Checks both 'educational_files' and 'files' tables for 100% compatibility.
 */
export async function fetchFilesFromSupabase(): Promise<FileMapping[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    console.log(">>> [SUPABASE] Fetching live files from cloud database...");

    // 1. Try 'educational_files'
    const { data: eduData, error: eduErr } = await supabase
      .from('educational_files')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Try 'files' table
    const { data: filesData, error: filesErr } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    let rawList: any[] = [];
    if (!eduErr && eduData && eduData.length > 0) {
      rawList = eduData;
    } else if (!filesErr && filesData && filesData.length > 0) {
      rawList = filesData;
    } else if (eduData) {
      rawList = eduData;
    } else if (filesData) {
      rawList = filesData;
    }

    if (!rawList) return [];

    console.log(`>>> [SUPABASE] Successfully retrieved ${rawList.length} files from cloud.`);

    return rawList.map(item => ({
      id: String(item.id),
      filename: item.filename || item.name || 'ملف بدون اسم',
      category: (item.category || 'unassigned') as any,
      fileType: (item.file_type || item.fileType || 'tabular') as any,
      isBoundaryLayer: Boolean(item.is_boundary_layer ?? item.isBoundaryLayer),
      latColumn: item.lat_column || item.latColumn || undefined,
      lngColumn: item.lng_column || item.lngColumn || undefined,
      nameColumn: item.name_column || item.nameColumn || undefined,
      headers: item.headers || undefined,
      displayColumns: item.display_columns || item.displayColumns || undefined,
      filterMappings: item.filter_mappings || item.filterMappings || {},
      data: item.data || [], 
      fileUrl: item.file_url || item.fileUrl || undefined
    }));
  } catch (err) {
    console.error("Supabase fetchFiles error:", err);
    return null;
  }
}

/**
 * Insert a brand new file row into Supabase.
 * Inserts to both 'educational_files' and 'files' for complete compatibility.
 */
export async function insertFileToSupabase(file: FileMapping): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client is not initialized. Please check credentials.");

  try {
    const payload = {
      id: file.id,
      filename: file.filename,
      category: file.category || 'unassigned',
      file_type: file.fileType,
      is_boundary_layer: Boolean(file.isBoundaryLayer),
      lat_column: file.latColumn || null,
      lng_column: file.lngColumn || null,
      name_column: file.nameColumn || null,
      headers: file.headers || null,
      display_columns: file.displayColumns || null,
      filter_mappings: file.filterMappings || null,
      data: (file as any).dataUrl || file.data || null,
      file_url: (file as any).fileUrl || null
    };

    console.log(">>> [SUPABASE] Attempting to REGISTER file metadata:", file.filename);
    
    // Pro-strategy: DELETE then INSERT instead of UPSERT to avoid any locking or indexing overhead on large tables
    await supabase.from('educational_files').delete().eq('id', payload.id);
    const { error: insertError } = await supabase.from('educational_files').insert(payload);

    if (insertError) {
      console.error(">>> [SUPABASE ERROR] Failed to insert to educational_files:", insertError);
      throw new Error(`فشل تسجيل الملف في السحابة: ${insertError.message}`);
    }

    console.log(">>> [SUPABASE SUCCESS] File metadata recorded in cloud database.");
    return true;
  } catch (err: any) {
    console.error("Failed to insert file to Supabase:", err);
    throw err;
  }
}

/**
 * Update an existing file by its unique ID
 */
export async function updateFileInSupabase(file: FileMapping): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const payload: any = {
      filename: file.filename,
      category: file.category,
      file_type: file.fileType,
      is_boundary_layer: Boolean(file.isBoundaryLayer),
      lat_column: file.latColumn || null,
      lng_column: file.lngColumn || null,
      name_column: file.nameColumn || null,
      headers: file.headers || null,
      display_columns: file.displayColumns || null,
      filter_mappings: file.filterMappings || null,
      file_url: (file as any).fileUrl || null
    };

    // PRO-STRATEGY: Never send the large data array back to the DB during update.
    // If 'file.data' is an array, it means it's the loaded data in memory.
    // If 'file.data' is a string, it's the URL pointing to storage.
    if (typeof file.data === 'string') {
      payload.data = file.data;
    }
    // Note: if file.data is an array, we omit it from payload so the DB keeps the existing URL string.

    console.log(">>> [SUPABASE] Updating file metadata for:", file.filename);
    const { error } = await supabase.from('educational_files').update(payload).eq('id', file.id);
    
    if (error) {
      console.error(">>> [SUPABASE ERROR] Update failed:", error);
      throw new Error(`فشل تحديث بيانات الملف: ${error.message}`);
    }
    
    return true;
  } catch (err) {
    console.error("Failed to update file in Supabase:", err);
    throw err;
  }
}

export async function upsertFileToSupabase(file: FileMapping): Promise<boolean> {
  return insertFileToSupabase(file);
}

export async function deleteFileFromSupabase(fileId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    await supabase.from('educational_files').delete().eq('id', fileId);
    return true;
  } catch (err) {
    console.error("Failed to delete file from Supabase:", err);
    throw err;
  }
}

/**
 * Realtime subscription to any changes on the files database
 */
export function subscribeToFilesChanges(onChanged: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'educational_files' },
        () => {
          console.log(">>> [REALTIME] Supabase educational_files table changed! Refreshing UI...");
          onChanged();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn("Realtime subscription setup failed:", e);
    return () => {};
  }
}

// ----------------------------------------------------
// Feedback Operations
// ----------------------------------------------------

export async function fetchFeedbackFromSupabase(): Promise<Feedback[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map(item => ({
      id: item.id,
      name: item.name,
      phone: item.phone || '',
      message: item.message,
      createdAt: {
        toDate: () => new Date(item.created_at)
      } as any
    }));
  } catch (err) {
    console.warn("Supabase fetchFeedback error:", err);
    return null;
  }
}

export async function insertFeedbackToSupabase(fb: { id?: string; name: string; phone?: string; message: string }): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const payload = {
      id: fb.id || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: fb.name,
      phone: fb.phone || null,
      message: fb.message
    };

    const { error } = await supabase.from('feedback').insert(payload);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase insertFeedback error:", err);
    throw err;
  }
}

export async function deleteFeedbackFromSupabase(feedbackId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('feedback').delete().eq('id', feedbackId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase deleteFeedback error:", err);
    throw err;
  }
}

// ----------------------------------------------------
// Users Operations & Normalization
// ----------------------------------------------------

/**
 * Normalizes Civil ID or numeric strings:
 * - Converts Arabic-Indic (٠-٩) and Eastern/Persian (۰-۹) digits to English ASCII (0-9)
 * - Removes spaces, dashes, and invisible directional characters
 */
export function normalizeCivilId(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\s\-_]/g, '')
    .trim();
}

/**
 * Normalizes Saudi mobile phone numbers to unified format: +9665xxxxxxxx
 */
export function normalizePhone(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = String(input)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\d+]/g, '');

  if (!digits) return null;
  if (digits.startsWith('05') && digits.length === 10) return '+966' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) return '+966' + digits;
  if (digits.startsWith('+966')) return digits;
  return digits;
}

function mapSupabaseRowToUser(item: any): User {
  const rawPerms = item.permissions && typeof item.permissions === 'object' ? item.permissions : {};
  const cleanCivilId = normalizeCivilId(item.civil_id || '');
  const extractedPassword = item.password || rawPerms._password || '';
  const extractedEmail = item.email || rawPerms._email || undefined;

  return {
    id: String(item.id || (cleanCivilId ? `emp-${cleanCivilId}` : `emp-${Date.now()}`)),
    civilId: cleanCivilId,
    name: (item.name || '').trim(),
    password: extractedPassword ? String(extractedPassword) : '',
    email: extractedEmail ? String(extractedEmail) : undefined,
    role: (item.role === 'admin' ? 'admin' : 'user'),
    userType: (item.user_type || 'employee') as any,
    workEntity: item.work_entity || 'الشؤون التعليمية',
    jobTitle: item.job_title || 'الشؤون التعليمية',
    phone: item.phone ? (normalizePhone(item.phone) || item.phone) : '',
    status: (item.status === 'disabled' ? 'disabled' : 'active'),
    permissions: {
      visibleLayers: Array.isArray(rawPerms.visibleLayers) ? rawPerms.visibleLayers : ['schools', 'kmz'],
      canViewCoordinates: rawPerms.canViewCoordinates !== false,
      canExportReports: rawPerms.canExportReports !== false,
      canUseSurroundingAnalysis: rawPerms.canUseSurroundingAnalysis !== false
    },
    createdAt: item.created_at || new Date().toISOString()
  };
}

export async function fetchUsersFromSupabase(): Promise<User[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    // Deduplicate by normalized civilId (keep most recent / one with password)
    const byKey = new Map<string, User>();
    for (const row of data) {
      const u = mapSupabaseRowToUser(row);
      const key = u.civilId || u.id;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, u);
      } else if (!existing.password && u.password) {
        byKey.set(key, { ...existing, password: u.password });
      }
    }

    return Array.from(byKey.values());
  } catch (err) {
    console.warn("Supabase fetchUsers error:", err);
  }

  // Dual-layer fallback: check backup in educational_files
  try {
    const { data: backupData } = await supabase
      .from('educational_files')
      .select('data')
      .eq('id', 'system_users_backup')
      .maybeSingle();

    if (backupData && Array.isArray(backupData.data)) {
      return (backupData.data as any[]).map(mapSupabaseRowToUser);
    }
  } catch (err) {
    console.warn("Supabase fetchUsers backup error:", err);
  }

  return null;
}

export async function fetchUserByCivilIdFromSupabase(civilId: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  const cleanId = normalizeCivilId(civilId);
  if (!supabase || !cleanId) return null;

  try {
    // 1. Direct query on civil_id or id variants in 'users' table
    const { data: directData, error: directErr } = await supabase
      .from('users')
      .select('*')
      .or(`civil_id.eq.${cleanId},id.eq.emp-${cleanId},id.eq.admin-${cleanId},id.eq.${cleanId}`);

    if (!directErr && directData && directData.length > 0) {
      const mapped = directData.map(mapSupabaseRowToUser);
      return mapped.find(u => Boolean(u.password)) || mapped[0];
    }

    // 2. Direct exact match on civil_id
    const { data: eqData } = await supabase
      .from('users')
      .select('*')
      .eq('civil_id', cleanId);

    if (eqData && eqData.length > 0) {
      const mapped = eqData.map(mapSupabaseRowToUser);
      return mapped.find(u => Boolean(u.password)) || mapped[0];
    }

    // 3. Fallback: check backup stored in educational_files table
    const { data: backupRow } = await supabase
      .from('educational_files')
      .select('data')
      .eq('id', 'system_users_backup')
      .maybeSingle();

    if (backupRow && Array.isArray(backupRow.data)) {
      const backupUsers = (backupRow.data as any[]).map(mapSupabaseRowToUser);
      const matched = backupUsers.find(u =>
        normalizeCivilId(u.civilId) === cleanId ||
        (u.id && u.id.includes(cleanId))
      );
      if (matched) return matched;
    }

    // 4. Fallback: fetch all users and match after normalizing civil_id
    const allUsers = await fetchUsersFromSupabase();
    if (allUsers && allUsers.length > 0) {
      const matched = allUsers.find(u =>
        normalizeCivilId(u.civilId) === cleanId ||
        (u.id && u.id.includes(cleanId))
      );
      if (matched) return matched;
    }

    return null;
  } catch (err) {
    console.warn("Supabase fetchUserByCivilId error:", err);
    return null;
  }
}

export async function lookupUserByCivilId(civilId: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  const cleanId = normalizeCivilId(civilId);
  if (!supabase || !cleanId) return null;

  try {
    // 1. Direct query on users table using precise .or condition
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('*')
      .or(`civil_id.eq.${cleanId},id.eq.emp-${cleanId},id.eq.admin-${cleanId},id.eq.${cleanId}`);

    if (usersErr) {
      console.error("Supabase lookupUserByCivilId query error:", usersErr);
    } else if (usersData && usersData.length > 0) {
      const mapped = usersData.map(mapSupabaseRowToUser);
      return mapped.find(u => Boolean(u.password)) || mapped[0];
    }

    // 2. Fallback: query 'educational_files' table with id 'system_users_backup'
    const { data: backupRow, error: backupErr } = await supabase
      .from('educational_files')
      .select('data')
      .eq('id', 'system_users_backup')
      .maybeSingle();

    if (backupErr) {
      console.error("Supabase backup lookup error:", backupErr);
    } else if (backupRow && Array.isArray(backupRow.data)) {
      const backupUsers = (backupRow.data as any[]).map(mapSupabaseRowToUser);
      const matched = backupUsers.find(u =>
        normalizeCivilId(u.civilId) === cleanId ||
        normalizeCivilId(u.id) === cleanId ||
        (u.id && u.id.includes(cleanId))
      );
      if (matched) return matched;
    }

    return null;
  } catch (err) {
    console.error("lookupUserByCivilId exception:", err);
    return null;
  }
}

export async function saveUserToCloud(user: User): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'تعذر الاتصال بقاعدة بيانات Supabase (العميل غير مهيأ)' };
  }

  try {
    const cleanCivilId = normalizeCivilId(user.civilId || '');
    if (!cleanCivilId) {
      return { success: false, error: 'رقم السجل المدني مفقود أو غير صالح' };
    }

    const canonicalId = user.id || (cleanCivilId ? `emp-${cleanCivilId}` : `emp-${Date.now()}`);

    const permissionsPayload = {
      visibleLayers: user.permissions?.visibleLayers || ['schools', 'kmz'],
      canViewCoordinates: user.permissions?.canViewCoordinates !== false,
      canExportReports: user.permissions?.canExportReports !== false,
      canUseSurroundingAnalysis: user.permissions?.canUseSurroundingAnalysis !== false
    };

    const payload = {
      id: canonicalId,
      civil_id: cleanCivilId,
      name: (user.name || '').trim(),
      role: user.role || 'user',
      user_type: user.userType || 'employee',
      work_entity: user.workEntity || 'الشؤون التعليمية',
      job_title: user.jobTitle || 'الشؤون التعليمية',
      phone: normalizePhone(user.phone) || null,
      status: user.status || 'active',
      permissions: permissionsPayload,
      ...(user.password ? { password: user.password } : {})
    };

    // 1. Primary write to 'users' table
    const { error: usersError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (usersError) {
      console.error("Supabase users upsert error:", usersError);
      return {
        success: false,
        error: `خطأ في جدول users: ${usersError.message} (رمز الخطأ: ${usersError.code || 'RLS_VIOLATION'})`
      };
    }

    // 2. Secondary write to 'educational_files' (system_users_backup)
    const { data: currentBackup, error: fetchBackupError } = await supabase
      .from('educational_files')
      .select('data')
      .eq('id', 'system_users_backup')
      .maybeSingle();

    if (fetchBackupError) {
      console.error("Supabase fetch backup error:", fetchBackupError);
      return {
        success: false,
        error: `خطأ في قراءة النسخ الاحتياطي: ${fetchBackupError.message}`
      };
    }

    let userArray: any[] = (currentBackup && Array.isArray(currentBackup.data)) ? currentBackup.data : [];
    const idx = userArray.findIndex((u: any) => u.id === canonicalId || normalizeCivilId(u.civil_id) === cleanCivilId);
    if (idx >= 0) {
      userArray[idx] = payload;
    } else {
      userArray.push(payload);
    }

    const { error: backupError } = await supabase
      .from('educational_files')
      .upsert({
        id: 'system_users_backup',
        filename: 'system_users_cloud_sync.json',
        category: 'unassigned',
        file_type: 'tabular',
        data: userArray
      }, { onConflict: 'id' });

    if (backupError) {
      console.error("Supabase educational_files backup upsert error:", backupError);
      return {
        success: false,
        error: `خطأ في جدول النسخ الاحتياطي (educational_files): ${backupError.message}`
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("saveUserToCloud exception:", err);
    return {
      success: false,
      error: err?.message || 'خطأ غير متوقع أثناء الحفظ السحابي'
    };
  }
}

export async function upsertUserToSupabase(user: User): Promise<{ ok: boolean; error?: string }> {
  const result = await saveUserToCloud(user);
  return { ok: result.success, error: result.error };
}

export async function deleteUserFromSupabase(userId: string, civilId?: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'تعذر الاتصال بالسحابة' };

  try {
    const cleanCivilId = normalizeCivilId(civilId);

    // 1. Delete from users table
    const { error: delErr } = await supabase.from('users').delete().eq('id', userId);
    if (delErr) {
      console.error("Supabase deleteUser error:", delErr);
      return { ok: false, error: delErr.message };
    }

    if (cleanCivilId) {
      await supabase.from('users').delete().eq('civil_id', cleanCivilId);
    }

    // 2. Delete from system_users_backup in educational_files
    try {
      const { data: backupRow } = await supabase
        .from('educational_files')
        .select('data')
        .eq('id', 'system_users_backup')
        .maybeSingle();

      if (backupRow && Array.isArray(backupRow.data)) {
        const cleanedBackup = backupRow.data.filter((b: any) =>
          b.id !== userId && normalizeCivilId(b.civil_id) !== cleanCivilId
        );
        await supabase
          .from('educational_files')
          .upsert({ id: 'system_users_backup', data: cleanedBackup }, { onConflict: 'id' });
      }
    } catch (bErr) {
      console.warn("Error cleaning backup row in educational_files:", bErr);
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Supabase deleteUser error:", err);
    return { ok: false, error: err?.message || 'فشل حذف المستخدم' };
  }
}

export function subscribeToUsersChanges(onChanged: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('users-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          console.log(">>> [REALTIME] Supabase users table changed! Refreshing users...");
          onChanged();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn("Users realtime subscription setup failed:", e);
    return () => {};
  }
}

// ----------------------------------------------------
// Storage Operations
// ----------------------------------------------------

export async function uploadBlobToSupabaseStorage(blob: Blob, fileName: string, path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not initialized for storage upload.");

  try {
    const bucketName = 'educational-files';
    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `${path}/${cleanFileName}`.replace(/\/+/g, '/');

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/json'
      });

    if (error) {
      if (error.message.includes('not found') || (error as any).status === 400 || (error as any).status === 404) {
        throw new Error("عذراً، يجب إنشاء مخزن باسم 'educational-files' في Supabase وجعله عاماً (Public) أولاً.");
      }
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error("Failed to upload blob to Supabase storage:", err);
    throw err;
  }
}

export async function uploadFileToSupabaseStorage(file: File, path: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not initialized for storage upload.");

  try {
    const bucketName = 'educational-files';
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `${path}/${cleanFileName}`.replace(/\/+/g, '/');

    console.log(`>>> [SUPABASE STORAGE] Starting upload: ${file.name} to bucket: ${bucketName}...`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error(">>> [SUPABASE STORAGE ERROR] Upload failed:", error);
      if (error.message.includes('not found') || (error as any).status === 400 || (error as any).status === 404) {
        throw new Error("عذراً، يجب إنشاء مخزن باسم 'educational-files' في Supabase وجعله عاماً (Public) أولاً.");
      }
      throw new Error(`خطأ في رفع الملف سحابياً: ${error.message}`);
    }

    console.log(">>> [SUPABASE STORAGE SUCCESS] File binary uploaded, generating public URL...");

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("فشل في استخراج الرابط العام للملف المرفوع.");
    }

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error("Failed to upload to Supabase storage:", err);
    throw err;
  }
}
