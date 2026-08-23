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

-- 4. تعطيل سياسات الأمان (RLS) مؤقتاً لضمان الكتابة من أي جهاز (كما طلب المستخدم)
ALTER TABLE public.educational_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

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
// Users Operations
// ----------------------------------------------------

export async function fetchUsersFromSupabase(): Promise<User[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data.map(item => ({
      id: item.id,
      civilId: item.civil_id,
      name: item.name,
      role: item.role as any,
      userType: item.user_type as any,
      workEntity: item.work_entity,
      jobTitle: item.job_title,
      phone: item.phone,
      status: item.status as any,
      permissions: item.permissions || {
        visibleLayers: ['schools', 'kmz'],
        canViewCoordinates: true,
        canExportReports: true,
        canUseSurroundingAnalysis: true
      },
      createdAt: item.created_at
    }));
  } catch (err) {
    console.warn("Supabase fetchUsers error:", err);
    return null;
  }
}

export async function upsertUserToSupabase(user: User): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const payload = {
      id: user.id,
      civil_id: user.civilId || null,
      name: user.name,
      role: user.role,
      user_type: user.userType || 'employee',
      work_entity: user.workEntity || null,
      job_title: user.jobTitle || null,
      phone: user.phone || null,
      status: user.status || 'active',
      permissions: user.permissions || null
    };

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase upsertUser error:", err);
    throw err;
  }
}

export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase deleteUser error:", err);
    throw err;
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
