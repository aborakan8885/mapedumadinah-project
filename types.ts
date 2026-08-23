export type Category = "schools" | "kmz";

export interface EducationalPlace {
  id: string;
  name: string;
  category: Category | string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  phone?: string;
  website?: string;
  
  // Data from imported file
  rawData: Record<string, any>;
  displayColumns: string[];
  fileId: string;
  filename: string;

  // New property for spatially-determined district
  spatialDistrict?: string;
  spatialMetrics?: {
    districtSchoolCount: number;
    distanceToNearestInDistrict: number | null;
    distanceToNearestNeighborDistrictOfSameLevel: number | null;
  };
}

// --- New Detailed Filter Interfaces ---

export interface SchoolFilters {
  level: string; // 'all', or specific level
  schoolsCountPreset: string; // 'all', 'low', 'medium', 'high', 'custom'
  minSchoolsInDistrict: string;
  maxSchoolsInDistrict: string;
  distanceInDistrictPreset: string; // 'all', 'close', 'far', 'custom'
  minDistanceInDistrict: string;
  maxDistanceInDistrict: string;
  distanceNeighborPreset: string; // 'all', 'close', 'far', 'custom'
  minDistanceNeighborLevel: string;
  maxDistanceNeighborLevel: string;
  governorate: string; // 'all', etc.
  district: string; // text filter
}

export interface FilterState {
  schools: SchoolFilters;
}

// --- Admin Panel Types ---

export type FilterColumnMappings = {
    // School
    levelColumn?: string[];
    genderColumn?: string[];
    disabilitySupportColumn?: string[];
    specialEducationColumn?: string[];
    authorityColumn?: string[];
    curriculumColumn?: string[];
    isPPPColumn?: string[];
    buildingOwnershipColumn?: string[];
    studyTimeColumn?: string[];
    independenceStatusColumn?: string[];
    
    // Land
    ownershipColumn?: string[];
    areaColumn?: string; // Area remains a single column

    // Project & Building
    needColumn?: string[]; 
    buildingStatusColumn?: string[];
    projectStatusColumn?: string[];

    // Common
    governorateColumn?: string[];
    districtColumn?: string[];
};

export type FileMapping = {
    id: string;
    filename: string;
    category: Category | 'unassigned';
    fileType: 'tabular' | 'kmz' | 'kml';
    
    // Tabular specific properties - make them optional
    latColumn?: string;
    lngColumn?: string;
    nameColumn?: string;
    displayColumns?: string[];
    data?: Record<string, any>[];
    headers?: string[];
    filterMappings?: FilterColumnMappings;
    
    // Spatial file content (KMZ: ArrayBuffer, KML: string)
    fileContent?: ArrayBuffer | string;

    // New property to mark a spatial file as the district boundary layer
    isBoundaryLayer?: boolean;
};

export type UserTypeMode = 'beneficiary' | 'employee';

export type User = {
  id: string;
  civilId?: string;
  name: string;
  password?: string;
  role: 'user' | 'admin';
  userType?: UserTypeMode;
  workEntity: string;
  jobTitle?: string;
  phone?: string;
  status: 'active' | 'disabled';
  permissions: {
    visibleLayers: Category[];
    canViewCoordinates?: boolean;
    canExportReports?: boolean;
    canUseSurroundingAnalysis?: boolean;
  };
  createdAt?: string;
};

export type Feedback = {
  id?: string;
  userId?: string;
  userName?: string;
  name: string;
  phone?: string;
  message: string;
  createdAt: any; // Firestore Timestamp
};
