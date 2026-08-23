import * as XLSX from 'xlsx';
import type { FileMapping, Feedback } from '../types';
import {
  fetchFilesFromSupabase,
  insertFileToSupabase,
  updateFileInSupabase,
  upsertFileToSupabase,
  deleteFileFromSupabase,
  fetchFeedbackFromSupabase,
  insertFeedbackToSupabase,
  deleteFeedbackFromSupabase,
  uploadFileToSupabaseStorage,
  uploadBlobToSupabaseStorage,
  getSupabaseCredentials
} from './supabase';

const CACHED_FILES_KEY = 'educational_map_cached_files_v3';
const CACHED_FEEDBACK_KEY = 'educational_map_cached_feedback_v2';

// In-memory array cache to ensure instant UI responsiveness
let memoryFilesCache: FileMapping[] | null = null;

// IndexedDB Helper for large local files storage
const DB_NAME = 'EducationalMapIndexedDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileToIndexedDB(file: FileMapping): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(file);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("IndexedDB save error:", e);
  }
}

async function getAllFilesFromIndexedDB(): Promise<FileMapping[]> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

async function deleteFileFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn("IndexedDB delete error:", e);
  }
}

/**
 * Get all files: Checks Supabase cloud database first.
 * Returns a full array of all uploaded files.
 */
export async function getAllFiles(): Promise<FileMapping[]> {
  try {
    const supabaseFiles = await fetchFilesFromSupabase();
    if (supabaseFiles !== null && Array.isArray(supabaseFiles)) {
      memoryFilesCache = [...supabaseFiles];
      
      // Cache in IndexedDB asynchronously
      supabaseFiles.forEach(f => saveFileToIndexedDB(f).catch(() => {}));

      // Cache metadata in localStorage
      try {
        const metadataOnly = supabaseFiles.map(f => ({
          ...f,
          data: (f.data && f.data.length > 500) ? f.data.slice(0, 100) : f.data,
          fileContent: typeof f.fileContent === 'string' && f.fileContent.length > 10000 ? undefined : f.fileContent
        }));
        localStorage.setItem(CACHED_FILES_KEY, JSON.stringify(metadataOnly));
      } catch (e) {
        // quota reached, ignore
      }
      return supabaseFiles;
    }
  } catch (error) {
    console.warn("Supabase load failed, falling back to local storage:", error);
  }

  // 2. Check in-memory cache
  if (memoryFilesCache && memoryFilesCache.length > 0) {
    return memoryFilesCache;
  }

  // 3. Fallback to IndexedDB (stores full size)
  try {
    const idbFiles = await getAllFilesFromIndexedDB();
    if (idbFiles && idbFiles.length > 0) {
      memoryFilesCache = idbFiles;
      return idbFiles;
    }
  } catch (e) {
    console.warn("IndexedDB load error:", e);
  }

  // 4. Fallback to localStorage cache
  try {
    const cached = localStorage.getItem(CACHED_FILES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryFilesCache = parsed;
      return parsed;
    }
  } catch (e) {
    console.error("Local cache load error:", e);
  }

  return [];
}

/**
 * Insert a brand new file into Supabase Cloud & Local Storage.
 * Always appends to the collection without replacing existing files.
 */
export async function insertNewFile(file: FileMapping): Promise<void> {
  console.log(">>> [DATABASE] Inserting NEW file row:", file.filename, "with ID:", file.id);

  // 1. Update memory cache
  if (!memoryFilesCache) memoryFilesCache = [];
  const existingIndex = memoryFilesCache.findIndex(f => f.id === file.id);
  if (existingIndex >= 0) {
    memoryFilesCache[existingIndex] = file;
  } else {
    memoryFilesCache.unshift(file);
  }

  // 2. Save to IndexedDB
  await saveFileToIndexedDB(file);

  // 3. Sync to Supabase Cloud via INSERT
  const { isConfigured } = getSupabaseCredentials();
  if (isConfigured) {
    try {
      await insertFileToSupabase(file);
      console.log(">>> [SUPABASE] Successfully inserted new file row into cloud database.");
    } catch (err: any) {
      console.error(">>> [SUPABASE] Cloud insert error:", err);
      throw new Error(`خطأ في حفظ الملف في سحابة Supabase: ${err.message || ''}`, { cause: err });
    }
  }
}

/**
 * Save or update an existing file mapping (e.g. changing category or coordinate mapping).
 */
export async function putFile(file: FileMapping): Promise<void> {
  console.log(">>> [DATABASE] Updating file mapping:", file.filename, "ID:", file.id);

  // 1. Update memory cache
  if (!memoryFilesCache) memoryFilesCache = [];
  const index = memoryFilesCache.findIndex(f => f.id === file.id);
  if (index >= 0) {
    memoryFilesCache[index] = file;
  } else {
    memoryFilesCache.unshift(file);
  }

  // 2. Save to IndexedDB
  await saveFileToIndexedDB(file);

  // 3. Sync to Supabase Cloud
  const { isConfigured } = getSupabaseCredentials();
  if (isConfigured) {
    try {
      // 3a. Update metadata in database
      await updateFileInSupabase(file);
      
      // 3b. Update full configuration in storage to keep it in sync
      // This is crucial because next time loadFileData is called, it merges this JSON
      if (typeof file.data !== 'string' && Array.isArray(file.data)) {
        console.log(">>> [DATABASE] Syncing updated metadata to cloud storage cache...");
        const fullMappingForStorage = {
          ...file,
          lastUpdated: new Date().toISOString()
        };
        const jsonBlob = new Blob([JSON.stringify(fullMappingForStorage)], { type: 'application/json' });
        await uploadBlobToSupabaseStorage(jsonBlob, `${file.id}_config.json`, 'data-cache');
        console.log(">>> [DATABASE] Sync successful.");
      }
      
      console.log(">>> [SUPABASE] Successfully updated file in cloud database.");
    } catch (err: any) {
      // If not existing yet, upsert
      try {
        await upsertFileToSupabase(file);
      } catch (upsertErr: any) {
        console.error(">>> [SUPABASE] Cloud update error:", upsertErr);
        throw new Error(`خطأ في تحديث البيانات في سحابة Supabase: ${upsertErr.message || ''}`, { cause: upsertErr });
      }
    }
  }
}

/**
 * Parses an Excel or CSV file locally in the browser.
 */
async function parseFileLocally(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Upload raw file to Supabase storage + save metadata in Supabase database.
 * Generates a collision-proof unique ID for every uploaded file.
 */
export async function uploadFileToServer(file: File, metadata: Partial<FileMapping>): Promise<FileMapping> {
  console.log(">>> [DATABASE] Starting local heavy-lifting for:", file.name);

  // Generate unique collision-proof ID for the new file
  const uniqueId = metadata.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${Math.floor(Math.random() * 1000000)}`;
  
  let fileUrl: string | undefined = undefined;
  let localParsedData: any[] | undefined = metadata.data;

  // 1. Stage 0: Local Parsing (Avoids server timeouts)
  if (!localParsedData && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
    try {
      console.log(">>> [DATABASE] Parsing file locally in browser...");
      localParsedData = await parseFileLocally(file);
      console.log(`>>> [DATABASE] Local parsing success. Found ${localParsedData?.length} rows.`);
    } catch (err) {
      console.warn(">>> [DATABASE] Local parsing failed, proceeding with raw upload:", err);
    }
  }

  // 2. Stage 1: Upload binary to Supabase Storage
  const { isConfigured } = getSupabaseCredentials();
  if (isConfigured) {
    try {
      // 2a. Upload Original File (Binary)
      const publicUrl = await uploadFileToSupabaseStorage(file, 'uploads');
      if (publicUrl) {
        fileUrl = publicUrl;
        console.log(">>> [DATABASE] Stage 1a Success: File binary stored at", fileUrl);
      }

      // 2b. Prepare COMPLETE metadata for Storage (This avoids DB timeouts for large JSON)
      const fullMappingForStorage = {
        ...metadata,
        id: uniqueId,
        filename: file.name,
        headers: metadata.headers || (localParsedData && localParsedData.length > 0 ? Object.keys(localParsedData[0]) : undefined),
        displayColumns: metadata.displayColumns,
        filterMappings: metadata.filterMappings || {},
        data: localParsedData,
        fileUrl,
        lastUpdated: new Date().toISOString()
      };

      console.log(">>> [DATABASE] Stage 1b: Uploading complete JSON mapping to storage...");
      const jsonBlob = new Blob([JSON.stringify(fullMappingForStorage)], { type: 'application/json' });
      const jsonUrl = await uploadBlobToSupabaseStorage(jsonBlob, `${uniqueId}_config.json`, 'data-cache');
      
      if (jsonUrl) {
        // PRO WORKAROUND: Store the URL as a string in the 'data' field. 
        // Since 'data' is JSONB, it accepts strings. This avoids adding new columns.
        metadata.data = jsonUrl as any; 
        console.log(">>> [DATABASE] Stage 1b Success: Data config stored at", jsonUrl);
      } else {
        throw new Error("فشل في الحصول على رابط تخزين البيانات.");
      }
    } catch (err: any) {
      console.error(">>> [DATABASE ERROR] Stage 1 Failed (Storage):", err);
      throw new Error(`فشل رفع ملف ${file.name} إلى المخزن السحابي: ${err.message || 'خطأ غير معروف'}`, { cause: err });
    }
  }

  // 3. Prepare MINIMAL mapping for Database (Guaranteed to be small and fast)
  const completeMapping: FileMapping = {
    id: uniqueId,
    filename: file.name,
    category: metadata.category || 'unassigned',
    fileType: metadata.fileType || 'tabular',
    isBoundaryLayer: Boolean(metadata.isBoundaryLayer),
    latColumn: metadata.latColumn,
    lngColumn: metadata.lngColumn,
    nameColumn: metadata.nameColumn,
    headers: [], // Keep empty in DB
    displayColumns: [], // Keep empty in DB
    filterMappings: {}, // Keep empty in DB
    data: metadata.data || localParsedData, // This might be the URL string or the Array
    fileUrl
  };

  // 4. Stage 2: Register in Supabase Database (TINY row INSERT)
  try {
    console.log(">>> [DATABASE] Stage 2: Registering minimal metadata in cloud database...");
    await insertNewFile(completeMapping);
    console.log(">>> [DATABASE SUCCESS] Multi-stage upload completed successfully.");
    return completeMapping;
  } catch (err: any) {
    console.error(">>> [DATABASE ERROR] Stage 2 Failed (Database):", err);
    throw new Error(`تم رفع الملف ولكن فشل تسجيله في قاعدة البيانات: ${err.message || 'خطأ في المزامنة'}`, { cause: err });
  }
}

/**
 * Ensures a file has its data and metadata loaded from remote storage if necessary
 */
export async function loadFileData(file: FileMapping): Promise<any[]> {
  // If data is a string, it means it's a URL to the full JSON config (Pro polymorphic storage)
  const dataValue = file.data;
  
  if (typeof dataValue !== 'string') {
    return Array.isArray(dataValue) ? dataValue : [];
  }

  const dataUrl = dataValue;

  try {
    console.log(`>>> [DATABASE] Fetching remote full config for: ${file.filename}`);
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("Failed to fetch data config");
    const fullConfig = await response.json();
    
    // PRO-MERGE: Only restore the "Big Data" fields that were emptied in the DB record.
    // We preserve the "Index Metadata" (category, isBoundaryLayer, columns) from the DB 
    // because they are more likely to be the most recent source of truth.
    file.headers = fullConfig.headers || file.headers;
    file.displayColumns = fullConfig.displayColumns || file.displayColumns;
    file.filterMappings = fullConfig.filterMappings || file.filterMappings;
    file.data = fullConfig.data || [];
    
    // We explicitly DO NOT use Object.assign(file, fullConfig) to avoid overwriting 
    // metadata that might have been updated in the DB but not yet in the Storage cache.
    
    return Array.isArray(file.data) ? file.data : [];
  } catch (err) {
    console.error(`>>> [DATABASE ERROR] Failed to fetch data cache for ${file.filename}:`, err);
    return [];
  }
}

/**
 * Delete file from Supabase Cloud + Local Storage
 */
export async function deleteFile(fileId: string): Promise<void> {
  // 1. Remove from memory cache
  if (memoryFilesCache) {
    memoryFilesCache = memoryFilesCache.filter(f => f.id !== fileId);
  }

  // 2. Remove from IndexedDB
  await deleteFileFromIndexedDB(fileId);

  // 3. Remove from localStorage
  try {
    const cached = localStorage.getItem(CACHED_FILES_KEY);
    if (cached) {
      const files: FileMapping[] = JSON.parse(cached);
      const filtered = files.filter(f => f.id !== fileId);
      localStorage.setItem(CACHED_FILES_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    // ignore
  }

  // 4. Delete from Supabase Cloud
  const { isConfigured } = getSupabaseCredentials();
  if (isConfigured) {
    try {
      await deleteFileFromSupabase(fileId);
      console.log(">>> [SUPABASE] Successfully deleted file from cloud database.");
    } catch (err) {
      console.error(">>> [SUPABASE] Cloud delete error:", err);
      throw err;
    }
  }
}

/**
 * Send Feedback directly to Supabase
 */
export async function sendFeedback(feedback: { name: string; phone?: string; message: string }): Promise<void> {
  const newFeedback: Feedback = {
    id: `fb-${Date.now()}`,
    name: feedback.name,
    phone: feedback.phone || '',
    message: feedback.message,
    createdAt: {
      toDate: () => new Date()
    } as any
  };

  // 1. Cache locally
  try {
    const cached = localStorage.getItem(CACHED_FEEDBACK_KEY);
    const list: Feedback[] = cached ? JSON.parse(cached) : [];
    list.unshift(newFeedback);
    localStorage.setItem(CACHED_FEEDBACK_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Feedback cache error:", e);
  }

  // 2. Insert to Supabase if configured
  const { isConfigured } = getSupabaseCredentials();
  if (isConfigured) {
    try {
      await insertFeedbackToSupabase(newFeedback);
    } catch (err) {
      console.error("Supabase feedback insert error:", err);
    }
  }
}

/**
 * Get all feedbacks from Supabase or Cache
 */
export async function getFeedbacks(): Promise<Feedback[]> {
  try {
    const supabaseFeedback = await fetchFeedbackFromSupabase();
    if (supabaseFeedback !== null) {
      localStorage.setItem(CACHED_FEEDBACK_KEY, JSON.stringify(supabaseFeedback));
      return supabaseFeedback;
    }
  } catch (err) {
    console.warn("Supabase feedback load error:", err);
  }

  try {
    const cached = localStorage.getItem(CACHED_FEEDBACK_KEY);
    if (cached) {
      const list = JSON.parse(cached);
      return list.map((item: any) => ({
        ...item,
        createdAt: item.createdAt?.toDate ? item.createdAt : {
          toDate: () => new Date(item.createdAt || Date.now())
        }
      }));
    }
  } catch (e) {
    console.error("Cache feedback load error:", e);
  }

  return [];
}
