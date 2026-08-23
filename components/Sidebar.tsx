import React, { useState, useMemo } from 'react';
import { X, SlidersHorizontal, School, Building, LandPlot, Hammer, ChevronDown, ChevronUp, Layers, Baby, HeartHandshake, Sparkles, Globe, FileText, Trash2 } from 'lucide-react';
import type { FilterState, Category, EducationalPlace, User } from '../types';
import { useData, getSchoolLevel, getSchoolGender, getSchoolGovernorate, getSchoolRegion, getPlaceGroup, getPlaceGroupLabel, extractDistrictNameFromProperties, normalizeArabic } from '../App';
import { Button } from './ui/Button';
import { Separator } from './ui/Separator';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  visibleCategories: Set<Category | string>;
  setVisibleCategories: React.Dispatch<React.SetStateAction<Set<Category | string>>>;
  onReportsClick: () => void;
  onPrintReportClick?: () => void;
  
  // Surrounding schools props
  isSurroundingActive?: boolean;
  setIsSurroundingActive?: (active: boolean) => void;
  surroundingBaseSchool?: EducationalPlace | null;
  setSurroundingBaseSchool?: (school: EducationalPlace | null) => void;
  surroundingRadius?: number;
  setSurroundingRadius?: (radius: number) => void;
  surroundingGender?: string;
  setSurroundingGender?: (gender: string) => void;
  surroundingLevel?: string;
  setSurroundingLevel?: (level: string) => void;
  surroundingRegion?: string;
  setSurroundingRegion?: (region: string) => void;
  surroundingGovernorate?: string;
  setSurroundingGovernorate?: (governorate: string) => void;
  surroundingSchools?: EducationalPlace[];
  currentUser?: User | null;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const categoryInfo: Record<string, { name: string; icon: React.ElementType; color: string }> = {
  schools: { name: 'المدارس', icon: School, color: 'text-indigo-600' },
  kmz: { name: 'طبقات KMZ', icon: Globe, color: 'text-green-500' },
};

const governorates = ['المدينة المنورة', 'ينبع', 'العلا', 'المهد', 'الحناكية', 'خيبر', 'بدر', 'وادي الفرع'];

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; icon: React.ElementType }> = ({ title, children, icon: Icon }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="py-1.5">
      <button
        className="w-full flex justify-between items-center text-right font-black text-slate-900 hover:text-indigo-700 text-xs py-1"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-indigo-700 shrink-0" />
            <span className="font-extrabold text-slate-900">{title}</span>
        </div>
        {isCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-slate-700" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-700" />}
      </button>
      {!isCollapsed && <div className="mt-2 space-y-2 pr-0.5">{children}</div>}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  filters,
  setFilters,
  visibleCategories,
  setVisibleCategories,
  onReportsClick,
  onPrintReportClick,
  
  isSurroundingActive = false,
  setIsSurroundingActive,
  surroundingBaseSchool = null,
  setSurroundingBaseSchool,
  surroundingRadius = 2000,
  setSurroundingRadius,
  surroundingGender = 'all',
  setSurroundingGender,
  surroundingLevel = 'all',
  setSurroundingLevel,
  surroundingRegion = 'all',
  setSurroundingRegion,
  surroundingGovernorate = 'all',
  setSurroundingGovernorate,
  surroundingSchools = [],
  currentUser = null,
}) => {
  const { boundaryGeojson, allPlaces, fileMappings } = useData();
  const isAdmin = currentUser?.role === 'admin';

  const isBeneficiary = currentUser?.userType === 'beneficiary';

  const districts = useMemo(() => {
    const set = new Set<string>();

    if (boundaryGeojson && boundaryGeojson.features) {
      boundaryGeojson.features.forEach(f => {
        if (!f.properties) return;
        const name = extractDistrictNameFromProperties(f.properties);
        if (name && name !== 'حي غير مسمى' && name !== 'خارج النطاق') {
          set.add(name);
        }
      });
    }

    allPlaces.forEach(p => {
      if (p.spatialDistrict && p.spatialDistrict !== 'خارج النطاق' && p.spatialDistrict !== 'حي غير مسمى') {
        set.add(p.spatialDistrict);
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [boundaryGeojson, allPlaces]);

  const handleFilterChange = (category: keyof FilterState, field: string, value: string) => {
    setFilters(prev => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  };

  const [baseSchoolSearch, setBaseSchoolSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const regionsList = useMemo(() => {
    const set = new Set<string>();
    allPlaces.forEach(p => {
      if (p.category === 'schools' || p.category === 'school') {
        const r = getSchoolRegion(p, fileMappings);
        if (r) set.add(r);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allPlaces, fileMappings]);

  const governoratesList = useMemo(() => {
    const set = new Set<string>();
    allPlaces.forEach(p => {
      if (p.category === 'schools' || p.category === 'school') {
        const g = getSchoolGovernorate(p, fileMappings);
        if (g) set.add(g);
      }
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
    if (list.length === 0) {
      return ['المدينة المنورة', 'ينبع', 'العلا', 'المهد', 'الحناكية', 'خيبر', 'بدر', 'وادي الفرع'];
    }
    return list;
  }, [allPlaces, fileMappings]);

  const filteredBaseSchools = useMemo(() => {
    return allPlaces.filter(p => {
      if (p.category !== 'schools' && p.category !== 'school') return false;
      
      if (surroundingRegion !== 'all') {
        const r = getSchoolRegion(p, fileMappings);
        if (!r || !normalizeArabic(r).includes(normalizeArabic(surroundingRegion))) return false;
      }
      
      if (surroundingGovernorate !== 'all') {
        const g = getSchoolGovernorate(p, fileMappings);
        if (!g || !normalizeArabic(g).includes(normalizeArabic(surroundingGovernorate))) return false;
      }
      
      return true;
    });
  }, [allPlaces, surroundingRegion, surroundingGovernorate, fileMappings]);

  const searchedBaseSchools = useMemo(() => {
    const query = baseSchoolSearch.trim().toLowerCase();
    if (!query) return filteredBaseSchools;
    return filteredBaseSchools.filter(s => {
      const level = getSchoolLevel(s, fileMappings) || '';
      const gender = getSchoolGender(s, fileMappings) || '';
      return s.name.toLowerCase().includes(query) || 
             (s.spatialDistrict || '').toLowerCase().includes(query) ||
             level.toLowerCase().includes(query) ||
             gender.toLowerCase().includes(query);
    });
  }, [filteredBaseSchools, baseSchoolSearch, fileMappings]);

  const baseGroup = useMemo(() => {
    if (!surroundingBaseSchool) return 'school';
    return getPlaceGroup(surroundingBaseSchool);
  }, [surroundingBaseSchool]);

  const baseLabels = useMemo(() => {
    return getPlaceGroupLabel(baseGroup);
  }, [baseGroup]);

  const baseTargetLabel = useMemo(() => {
    switch (baseGroup) {
      case 'program': return 'البرنامج الأساسي (المستهدف)';
      case 'land': return 'الأرض الأساسية (المستهدفة)';
      case 'project': return 'المشروع الأساسي (المستهدف)';
      default: return 'المدرسة الأساسية (المستهدفة)';
    }
  }, [baseGroup]);

  const baseTargetPlaceholder = useMemo(() => {
    switch (baseGroup) {
      case 'program': return '🔍 اكتب للبحث عن البرنامج وتصفيته...';
      case 'land': return '🔍 اكتب للبحث عن الأرض وتصفيتها...';
      case 'project': return '🔍 اكتب للبحث عن المشروع وتصفيته...';
      default: return '🔍 اكتب للبحث عن المدرسة وتصفيتها...';
    }
  }, [baseGroup]);

  const baseTargetHint = useMemo(() => {
    switch (baseGroup) {
      case 'program': return '💡 يمكنك تحديد البرنامج بفلتر القائمة أدناه أو بالنقر مباشرة على أي برنامج معروض على الخريطة لتصبح هي نقطة الارتكاز.';
      case 'land': return '💡 يمكنك تحديد الأرض بفلتر القائمة أدناه أو بالنقر مباشرة على أي أرض معروضة على الخريطة لتصبح هي نقطة الارتكاز.';
      case 'project': return '💡 يمكنك تحديد المشروع بفلتر القائمة أدناه أو بالنقر مباشرة على أي مشروع معروض على الخريطة لتصبح هي نقطة الارتكاز.';
      default: return '💡 يمكنك تحديد المدرسة بفلتر القائمة أدناه أو بالنقر مباشرة على أي مدرسة معروضة على الخريطة لتصبح هي المدرسة الأساسية.';
    }
  }, [baseGroup]);

  const toggleCategory = (category: Category) => {
    setVisibleCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) newSet.delete(category);
      else newSet.add(category);
      return newSet;
    });
  };

  const resetFilters = () => {
     setFilters({
        schools: {
          level: 'all',
          schoolsCountPreset: 'all',
          minSchoolsInDistrict: '',
          maxSchoolsInDistrict: '',
          distanceInDistrictPreset: 'all',
          minDistanceInDistrict: '',
          maxDistanceInDistrict: '',
          distanceNeighborPreset: 'all',
          minDistanceNeighborLevel: '',
          maxDistanceNeighborLevel: '',
          governorate: 'all',
          district: '',
        }
     });
  }

  const showAnyFilterGroup = visibleCategories.has('schools');

  return (
    <aside
      className={`absolute top-0 right-0 h-full w-52 sm:w-56 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out font-sans ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="p-2.5 flex items-center justify-between border-b-2 border-emerald-500 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm font-black text-white">شريط الأدوات</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-slate-800 text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-slate-50 space-y-2">
          {isAdmin && (
            <>
              <CollapsibleSection title="الطبقات الجغرافية" icon={Layers}>
                <div className="space-y-1.5 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                  {Object.entries(categoryInfo).map(([key, { name, icon: Icon, color }]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleCategories.has(key)}
                        onChange={() => toggleCategory(key as Category)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <Icon className={`h-4 w-4 ${color} shrink-0`} />
                      <span className="text-xs font-bold text-slate-900">{name}</span>
                    </label>
                  ))}
                </div>
              </CollapsibleSection>

              <Separator className="my-2 bg-slate-200" />
            </>
          )}

          {/* طبقة المدارس المحيطة */}
          <CollapsibleSection title={`نطاق (${baseLabels.plural})`} icon={School}>
            <div className="space-y-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md bg-indigo-50/60 border border-indigo-100 hover:bg-indigo-50 transition-all">
                <input
                  type="checkbox"
                  checked={isSurroundingActive}
                  onChange={(e) => {
                    if (setIsSurroundingActive) {
                      setIsSurroundingActive(e.target.checked);
                      if (!e.target.checked && setSurroundingBaseSchool) {
                        setSurroundingBaseSchool(null);
                      }
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-extrabold text-slate-900">تفعيل النطاق الجغرافي</span>
              </label>

              {isSurroundingActive && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="bg-emerald-950/5 p-1.5 rounded border border-emerald-800/20 text-right">
                    <p className="text-[10px] font-bold text-slate-800 leading-tight">
                      {baseTargetHint}
                    </p>
                  </div>

                  {/* فلاتر المنطقة والمحافظة */}
                  <div className="space-y-1.5">
                    <SelectControl
                      label="المنطقة"
                      value={surroundingRegion}
                      onChange={(e) => {
                        if (setSurroundingRegion) {
                          setSurroundingRegion(e.target.value);
                          if (surroundingBaseSchool && e.target.value !== 'all') {
                            const r = getSchoolRegion(surroundingBaseSchool, fileMappings);
                            if (r !== e.target.value && setSurroundingBaseSchool) {
                              setSurroundingBaseSchool(null);
                            }
                          }
                        }
                      }}
                    >
                      <option value="all">الكل (المنطقة كاملاً)</option>
                      {regionsList.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </SelectControl>

                    <SelectControl
                      label="المحافظة"
                      value={surroundingGovernorate}
                      onChange={(e) => {
                        if (setSurroundingGovernorate) {
                          setSurroundingGovernorate(e.target.value);
                          if (surroundingBaseSchool && e.target.value !== 'all') {
                            const g = getSchoolGovernorate(surroundingBaseSchool, fileMappings);
                            if (g !== e.target.value && setSurroundingBaseSchool) {
                              setSurroundingBaseSchool(null);
                            }
                          }
                        }
                      }}
                    >
                      <option value="all">الكل (جميع المحافظات)</option>
                      {governoratesList.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </SelectControl>
                  </div>

                  {/* اختيار المدرسة الأساسية القابل للبحث */}
                  <div className="space-y-0.5 relative">
                    <label className="block text-[11px] font-extrabold text-slate-900">{baseTargetLabel}</label>
                    
                    {isDropdownOpen && (
                      <div 
                        className="fixed inset-0 z-[1999]" 
                        onClick={() => setIsDropdownOpen(false)} 
                      />
                    )}

                    <div className="relative z-[2000]">
                      <input
                        type="text"
                        value={baseSchoolSearch}
                        placeholder={surroundingBaseSchool ? surroundingBaseSchool.name : baseTargetPlaceholder}
                        onChange={(e) => {
                          setBaseSchoolSearch(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="w-full pr-2 pl-7 py-1.5 text-xs font-bold border-2 border-slate-300 rounded focus:outline-none focus:border-indigo-600 bg-white text-slate-900"
                      />
                      {baseSchoolSearch && (
                        <button
                          type="button"
                          onClick={() => setBaseSchoolSearch('')}
                          className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-600">
                        <School className="h-3.5 w-3.5" />
                      </div>
                      
                      {isDropdownOpen && (
                        <div className="absolute left-0 right-0 z-[2001] mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-2xl max-h-56 overflow-y-auto custom-scrollbar">
                          <div className="p-1.5 border-b border-slate-200 bg-indigo-50 text-[10px] text-indigo-950 font-black flex justify-between items-center">
                            <span>النتائج: {searchedBaseSchools.length}</span>
                            <button
                              type="button"
                              onClick={() => setIsDropdownOpen(false)}
                              className="text-indigo-700 hover:underline font-bold"
                            >
                              إغلاق
                            </button>
                          </div>
                          
                          {searchedBaseSchools.length > 0 ? (
                            searchedBaseSchools
                              .sort((a, b) => a.name.localeCompare(b, 'ar'))
                              .map(s => {
                                const isSelected = surroundingBaseSchool?.id === s.id;
                                const level = getSchoolLevel(s, fileMappings) || 'غير محددة';
                                const gender = getSchoolGender(s, fileMappings) || 'غير محدد';
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      if (setSurroundingBaseSchool) {
                                        setSurroundingBaseSchool(s);
                                      }
                                      setBaseSchoolSearch('');
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full text-right px-2 py-1.5 text-xs font-bold transition-colors border-b border-slate-100 last:border-0 flex flex-col gap-0.5 ${
                                      isSelected ? 'bg-indigo-700 text-white' : 'hover:bg-indigo-50 text-slate-900'
                                    }`}
                                  >
                                    <span className="font-extrabold text-xs leading-tight">{s.name}</span>
                                    <div className={`flex flex-wrap gap-1 text-[9px] ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                      <span className={`px-1 py-0.2 rounded font-bold ${isSelected ? 'bg-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                                        {level}
                                      </span>
                                      <span className={`px-1 py-0.2 rounded font-bold ${isSelected ? 'bg-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                                        {gender}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-500 font-bold italic">
                              لا توجد نتائج
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* اختيار المسافة */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-slate-900">
                      مسافة النطاق الجغرافي:
                    </label>
                    <select
                      value={surroundingRadius}
                      onChange={(e) => setSurroundingRadius && setSurroundingRadius(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs font-bold border-2 border-slate-300 rounded focus:outline-none focus:border-indigo-600 bg-white text-slate-900"
                    >
                      <option value={500}>500 متر</option>
                      <option value={1000}>1,000 متر (1 كم)</option>
                      <option value={2000}>2,000 متر (2 كم)</option>
                      <option value={3000}>3,000 متر (3 كم)</option>
                      <option value={5000}>5,000 متر (5 كم)</option>
                      <option value={10000}>10,000 متر (10 كم)</option>
                    </select>

                    <div className="mt-1">
                      <div className="flex justify-between text-[10px] text-slate-700 font-bold mb-0.5">
                        <span>التحكم بالمجال:</span>
                        <span className="font-black text-indigo-700">
                          {surroundingRadius ? (surroundingRadius < 1000 ? `${surroundingRadius} م` : `${(surroundingRadius / 1000).toFixed(1)} كم`) : '2 كم'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={200}
                        max={10000}
                        step={100}
                        value={surroundingRadius || 2000}
                        onChange={(e) => setSurroundingRadius && setSurroundingRadius(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer h-1.5"
                      />
                    </div>
                  </div>

                  {/* اختيار الجنس */}
                  {(baseGroup === 'school' || baseGroup === 'program') && (
                    <SelectControl
                      label={`الجنس المحيط`}
                      value={surroundingGender || 'all'}
                      onChange={(e) => setSurroundingGender && setSurroundingGender(e.target.value)}
                    >
                      <option value="all">الكل (بنين وبنات)</option>
                      <option value="بنين">بنين</option>
                      <option value="بنات">بنات</option>
                      <option value="مشترك">مشترك / طفولة مبكرة</option>
                    </SelectControl>
                  )}

                  {/* اختيار المرحلة */}
                  {(baseGroup === 'school' || baseGroup === 'program') && (
                    <SelectControl
                      label={`المرحلة المحيطة`}
                      value={surroundingLevel || 'all'}
                      onChange={(e) => setSurroundingLevel && setSurroundingLevel(e.target.value)}
                    >
                      <option value="all">الكل (جميع المراحل)</option>
                      <option value="رياض الأطفال">رياض الأطفال</option>
                      <option value="الابتدائية">المرحلة الابتدائية</option>
                      <option value="المتوسطة">المرحلة المتوسطة</option>
                      <option value="الثانوية">المرحلة الثانوية</option>
                    </SelectControl>
                  )}

                  {/* بطاقة المدرسة الأساسية المحددة والنتائج */}
                  {surroundingBaseSchool && (
                    <div className="bg-slate-100 p-2 rounded-lg border border-slate-300 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-black text-slate-800">
                        <School className="h-3.5 w-3.5 text-indigo-700 shrink-0" />
                        <span className="truncate">{surroundingBaseSchool.name}</span>
                      </div>
                      
                      <button
                        onClick={() => setSurroundingBaseSchool && setSurroundingBaseSchool(null)}
                        className="flex items-center gap-1.5 text-[10px] font-extrabold text-red-600 hover:text-red-700 transition-colors px-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>حذف {baseLabels.singular} الأساسية</span>
                      </button>
                      
                      <div className="border-t border-slate-200 pt-1.5">
                        <p className="text-[10px] font-extrabold text-slate-700 mb-1">النتائج ({surroundingSchools.length}):</p>
                        {surroundingSchools.length > 0 ? (
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar text-[10px]">
                            {surroundingSchools
                              .map(s => ({ school: s, distance: getDistanceMeters(surroundingBaseSchool.lat, surroundingBaseSchool.lng, s.lat, s.lng) }))
                              .sort((a, b) => a.distance - b.distance)
                              .map(item => {
                                const s = item.school;
                                const distText = item.distance < 1000 ? `${Math.round(item.distance)}م` : `${(item.distance / 1000).toFixed(1)}كم`;
                                return (
                                  <div key={s.id} className="flex justify-between items-center bg-white p-1 rounded border border-slate-200 font-bold">
                                    <span className="text-slate-900 truncate max-w-[110px] font-bold">{s.name}</span>
                                    <span className="font-mono font-black text-indigo-800 bg-indigo-50 px-1 rounded text-[9px] shrink-0">{distText}</span>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-[10px] italic font-bold text-slate-500 text-center py-2">لا توجد نتائج بالمجال</p>
                        )}
                      </div>

                      {/* زر الطباعة التقرير */}
                      <Button
                        onClick={onPrintReportClick}
                        className="w-full gap-1 mt-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold py-1.5 text-xs shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        طباعة التقرير
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {!isBeneficiary && (
            <>
              <Separator className="my-2 bg-slate-200" />

              <CollapsibleSection title="الفلاتر المتقدمة" icon={SlidersHorizontal}>
                 {showAnyFilterGroup ? (
                    <div className="space-y-2">
                    {visibleCategories.has('schools') && (
                        <FilterGroup title="فلاتر المدارس المتقدمة">
                            <SelectControl label="المرحلة الدراسية" value={filters.schools.level} onChange={e => handleFilterChange('schools', 'level', e.target.value)}>
                                <option value="all">الكل</option>
                                <option value="رياض الأطفال">رياض الأطفال</option>
                                <option value="المرحلة الإبتدائية">المرحلة الإبتدائية</option>
                                <option value="المرحلة المتوسطة">المرحلة المتوسطة</option>
                                <option value="المرحلة الثانوية">المرحلة الثانوية</option>
                            </SelectControl>
                            
                            <SelectControl label="المحافظة" value={filters.schools.governorate} onChange={e => handleFilterChange('schools', 'governorate', e.target.value)}>
                                <option value="all">الكل</option>{governorates.map(g => <option key={g} value={g}>{g}</option>)}
                            </SelectControl>
                            
                            <SelectControl label="الحي" value={filters.schools.district} onChange={e => handleFilterChange('schools', 'district', e.target.value)}>
                                <option value="">الكل (بدون تصفية حي)</option>
                                {districts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </SelectControl>

                            {/* عدد المدارس في الحي (للأدمن فقط) */}
                            {isAdmin && (
                                <>
                                    <SelectControl label="كثافة المدارس بالحي" value={filters.schools.schoolsCountPreset} onChange={e => handleFilterChange('schools', 'schoolsCountPreset', e.target.value)}>
                                        <option value="all">الكل (بدون تصفية كثافة)</option>
                                        <option value="low">منخفضة (أقل من 3)</option>
                                        <option value="medium">متوسطة (3 - 7)</option>
                                        <option value="high">مرتفعة (أكثر من 7)</option>
                                        <option value="custom">مخصص...</option>
                                    </SelectControl>
                                    {filters.schools.schoolsCountPreset === 'custom' && (
                                        <div className="flex gap-1.5">
                                            <InputControl label="الحد الأدنى" type="number" value={filters.schools.minSchoolsInDistrict} onChange={e => handleFilterChange('schools', 'minSchoolsInDistrict', e.target.value)} placeholder="2" />
                                            <InputControl label="الحد الأقصى" type="number" value={filters.schools.maxSchoolsInDistrict} onChange={e => handleFilterChange('schools', 'maxSchoolsInDistrict', e.target.value)} placeholder="15" />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* المسافة بين المدارس في الحي */}
                            <SelectControl label="تباعد بالحي نفسه" value={filters.schools.distanceInDistrictPreset} onChange={e => handleFilterChange('schools', 'distanceInDistrictPreset', e.target.value)}>
                                <option value="all">الكل (بدون تصفية تباعد)</option>
                                <option value="close">متقاربة (أقل من 500م)</option>
                                <option value="far">متباعدة (أكثر من 2000م)</option>
                                <option value="custom">مخصص...</option>
                            </SelectControl>
                            {filters.schools.distanceInDistrictPreset === 'custom' && (
                                <div className="flex gap-1.5">
                                    <InputControl label="الأدنى (م)" type="number" value={filters.schools.minDistanceInDistrict} onChange={e => handleFilterChange('schools', 'minDistanceInDistrict', e.target.value)} placeholder="100" />
                                    <InputControl label="الأقصى (م)" type="number" value={filters.schools.maxDistanceInDistrict} onChange={e => handleFilterChange('schools', 'maxDistanceInDistrict', e.target.value)} placeholder="5000" />
                                </div>
                            )}
                        </FilterGroup>
                    )}
                    </div>
                  ) : <p className="text-xs text-center font-bold text-slate-500 p-2">حدد طبقة لعرض فلاترها.</p>}
              </CollapsibleSection>
              
              <Separator className="my-2 bg-slate-200" />

              <CollapsibleSection title="التقارير والإحصائيات" icon={FileText}>
                <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-700 leading-snug">
                    إنشاء تقارير إحصائية بناءً على الطبقات والفلاتر النشطة.
                  </p>
                  <Button onClick={onReportsClick} className="w-full gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    لوحة التقارير
                  </Button>
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>

        <div className="p-2 border-t border-slate-200 bg-slate-100 shrink-0">
          <Button onClick={resetFilters} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-extrabold text-xs py-1.5 border border-slate-300">إعادة تعيين الفلاتر</Button>
        </div>
      </div>
    </aside>
  );
};

const FilterGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="p-2 bg-white rounded-lg border border-slate-200">
        <h4 className="text-xs font-black mb-2 text-slate-900 border-b border-slate-100 pb-1">{title}</h4>
        <div className="space-y-2">{children}</div>
    </div>
);

const InputControl: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label className="block text-[10px] font-black text-slate-900 mb-0.5">{label}</label>
        <input {...props} className="w-full px-2 py-1 text-xs font-bold border-2 border-slate-300 rounded focus:outline-none focus:border-indigo-600 bg-white text-slate-900" />
    </div>
);

const SelectControl: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
    <div>
        <label className="block text-[10px] font-black text-slate-900 mb-0.5">{label}</label>
        <select {...props} className="w-full px-2 py-1 text-xs font-bold border-2 border-slate-300 rounded focus:outline-none focus:border-indigo-600 bg-white text-slate-900">
            {children}
        </select>
    </div>
);