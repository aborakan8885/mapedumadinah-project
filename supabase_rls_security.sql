-- 1. إنشاء الجداول
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    civil_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    user_type TEXT NOT NULL DEFAULT 'employee',
    work_entity TEXT DEFAULT 'الشؤون التعليمية',
    job_title TEXT DEFAULT 'الشؤون التعليمية',
    phone TEXT,
    password TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- 2. إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_users_civil_id ON public.users(civil_id);

-- 3. تفعيل الحماية (RLS) وعدم تعطيلها
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_files ENABLE ROW LEVEL SECURITY;

-- 4. إنشاء سياسات أمان للسماح للتطبيق بالعمل (لأننا نستخدم anon key مؤقتاً)
DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.users;
CREATE POLICY "Allow full access to anon for now" 
ON public.users 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to anon for now" ON public.educational_files;
CREATE POLICY "Allow full access to anon for now" 
ON public.educational_files 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 5. منح الصلاحيات
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.educational_files TO anon, authenticated, service_role;
