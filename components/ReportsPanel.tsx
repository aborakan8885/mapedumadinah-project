
import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Loader2, FileType2, FileBarChart2, Presentation, Sheet, Map, Building2, Landmark, Search, Settings, Download } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Separator } from './ui/Separator';
import * as XLSX from 'xlsx';
import type { EducationalPlace, FileMapping, Category, FilterState, SchoolFilters, EarlyChildhoodFilters, DisabilitySupportFilters, SpecialEducationFilters, LandFilters, ProjectFilters, BuildingFilters } from '../types';

const GOVERNORATES = ['المدينة المنورة', 'ينبع', 'العلا', 'المهد', 'الحناكية', 'خيبر', 'بدر', 'وادي الفرع'];

interface ReportsPanelProps {
  onClose: () => void;
  allPlaces: EducationalPlace[];
  fileMappings: Record<string, FileMapping>;
  visibleCategories: Set<Category | string>;
  filters: FilterState;
}

const filterKeyToName: Record<string, string> = {
  level: 'المرحلة', gender: 'الجنس', governorate: 'المحافظة', district: 'الحي',
  isPPP: 'مدارس PPP', buildingOwnership: 'ملكية المبنى', studyTime: 'وقت الدراسة',
  independenceStatus: 'حالة الاستقلالية', ownership: 'الملكية', need: 'الاحتياج',
  minArea: 'أدنى مساحة', maxArea: 'أقصى مساحة', authority: 'السلطة', curriculum: 'المنهج',
};

const categoryToName: Record<string, string> = {
  schools: 'المدارس'
};

const initializeDetailedStats = () => ({
  total: 0,
  schoolsByLevel: {} as Record<string, number>,
  privateSchoolsByLevel: {} as Record<string, number>,
  internationalSchoolsByLevel: {} as Record<string, number>,
  governmentSchoolsByLevel: {} as Record<string, number>,
  continuingGovSchoolsByLevel: {} as Record<string, number>,
  eveningGovSchoolsByLevel: {} as Record<string, number>,
  govProgramsByLevel: {} as Record<string, number>,
  ownedLandsCount: 0,
  unownedLandsCount: 0,
  evacuatedBuildingsCount: 0,
  stalledProjectsCount: 0,
});

type DetailedStats = ReturnType<typeof initializeDetailedStats>;

type ExportOptionsState = {
    privateSpecialGlobal: boolean;
    government: boolean;
    continuingGovernment: boolean;
    eveningGovernment: boolean;
    governmentPrograms: boolean;
};

export const ReportsPanel: React.FC<ReportsPanelProps> = ({
  onClose,
  allPlaces,
  fileMappings,
  visibleCategories,
  filters,
}) => {
  const [activeTab, setActiveTab] = useState<'region' | 'governorate' | 'district'>('region');
  const [groupingMethod, setGroupingMethod] = useState<'spatial' | 'text'>('spatial');
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const [selectedGovernorates, setSelectedGovernorates] = useState<string[]>(GOVERNORATES);
  const [selectedGovernorateForDistrictFilter, setSelectedGovernorateForDistrictFilter] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [exportOptions, setExportOptions] = useState<ExportOptionsState>({
    privateSpecialGlobal: true,
    government: true,
    continuingGovernment: true,
    eveningGovernment: true,
    governmentPrograms: true,
  });

  const handleExportOptionChange = (option: keyof ExportOptionsState) => {
    setExportOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const aggregatedData = useMemo(() => {
    // --- Accurate Filtering Logic (mirrors MapCanvas) ---
    const checkValue = (place: EducationalPlace, columns: string[] | undefined, filterValue: string, isExact = false) => {
        if (!columns || filterValue === 'all' || !filterValue) return true;
        const lowerFilter = filterValue.toLowerCase().trim();
        return columns.some(col => {
            const rawValue = place.rawData[col];
            if (rawValue === null || rawValue === undefined) return false;
            const lowerRaw = String(rawValue).toLowerCase().trim();
            return isExact ? lowerRaw === lowerFilter : lowerRaw.includes(lowerFilter);
        });
    };
    const checkRange = (place: EducationalPlace, column: string | undefined, min: string, max: string) => {
        if (!column) return true;
        const minVal = parseFloat(min);
        const maxVal = parseFloat(max);
        if (isNaN(minVal) && isNaN(maxVal)) return true;
        const area = parseFloat(place.rawData[column]);
        if (isNaN(area)) return false;
        if (!isNaN(minVal) && area < minVal) return false;
        if (!isNaN(maxVal) && area > maxVal) return false;
        return true;
    };
    const checkDistrict = (place: EducationalPlace, mapping: FilterColumnMappings, districtFilter: string) => {
        if (!districtFilter) return true;
        const lowerFilter = districtFilter.toLowerCase().trim();
        if (!lowerFilter) return true;
        
        if (place.spatialDistrict && place.spatialDistrict.toLowerCase().includes(lowerFilter)) {
            return true;
        }
        return checkValue(place, mapping.districtColumn, districtFilter);
    };

    const passesFilters = (place: EducationalPlace, category: keyof FilterState, filters: FilterState, mappings: Record<string, FileMapping>) => {
        const fileMapping = mappings[place.fileId]?.filterMappings;
        if (!fileMapping) return true;
        const f = filters[category];
        if (!f) return true;

        switch (category) {
            case 'schools':
                const sf = f as SchoolFilters;
                
                if (sf.level && sf.level !== 'all') {
                    if (!checkValue(place, fileMapping.levelColumn, sf.level)) return false;
                }
                if (sf.governorate && sf.governorate !== 'all') {
                    if (!checkValue(place, fileMapping.governorateColumn, sf.governorate)) return false;
                }
                if (sf.district && sf.district.trim() !== '') {
                    if (!checkDistrict(place, fileMapping, sf.district)) return false;
                }

                const metrics = place.spatialMetrics;
                if (!metrics) return true;

                if (sf.schoolsCountPreset === 'low') {
                    if (metrics.districtSchoolCount >= 3) return false;
                } else if (sf.schoolsCountPreset === 'medium') {
                    if (metrics.districtSchoolCount < 3 || metrics.districtSchoolCount > 7) return false;
                } else if (sf.schoolsCountPreset === 'high') {
                    if (metrics.districtSchoolCount <= 7) return false;
                } else if (sf.schoolsCountPreset === 'custom') {
                    const min = parseInt(sf.minSchoolsInDistrict);
                    const max = parseInt(sf.maxSchoolsInDistrict);
                    if (!isNaN(min) && metrics.districtSchoolCount < min) return false;
                    if (!isNaN(max) && metrics.districtSchoolCount > max) return false;
                }

                if (metrics.distanceToNearestInDistrict !== null) {
                    if (sf.distanceInDistrictPreset === 'close') {
                        if (metrics.distanceToNearestInDistrict >= 500) return false;
                    } else if (sf.distanceInDistrictPreset === 'far') {
                        if (metrics.distanceToNearestInDistrict <= 2000) return false;
                    } else if (sf.distanceInDistrictPreset === 'custom') {
                        const min = parseFloat(sf.minDistanceInDistrict);
                        const max = parseFloat(sf.maxDistanceInDistrict);
                        if (!isNaN(min) && metrics.distanceToNearestInDistrict < min) return false;
                        if (!isNaN(max) && metrics.distanceToNearestInDistrict > max) return false;
                    }
                } else {
                    if (sf.distanceInDistrictPreset !== 'all') return false;
                }

                if (metrics.distanceToNearestNeighborDistrictOfSameLevel !== null) {
                    if (sf.distanceNeighborPreset === 'close') {
                        if (metrics.distanceToNearestNeighborDistrictOfSameLevel >= 1000) return false;
                    } else if (sf.distanceNeighborPreset === 'far') {
                        if (metrics.distanceToNearestNeighborDistrictOfSameLevel <= 3000) return false;
                    } else if (sf.distanceNeighborPreset === 'custom') {
                        const min = parseFloat(sf.minDistanceNeighborLevel);
                        const max = parseFloat(sf.maxDistanceNeighborLevel);
                        if (!isNaN(min) && metrics.distanceToNearestNeighborDistrictOfSameLevel < min) return false;
                        if (!isNaN(max) && metrics.distanceToNearestNeighborDistrictOfSameLevel > max) return false;
                    }
                } else {
                    if (sf.distanceNeighborPreset !== 'all') return false;
                }

                return true;
            default: return true;
        }
    };
    
    const isOfDerivedType = (place: EducationalPlace, category: string, mappings: Record<string, FileMapping>) => {
         return false;
    }

    const filteredPlaces = allPlaces.filter(place => {
        let isVisible = false;
        let effectiveCategory = place.category;

        if (visibleCategories.has(place.category) && passesFilters(place, place.category as any, filters, fileMappings)) {
            isVisible = true;
        }

        if (isVisible) (place as any).effectiveCategory = effectiveCategory;
        return isVisible;
    });
    
    // --- Aggregation Logic ---
    const region: DetailedStats = initializeDetailedStats();
    const governorates: Record<string, DetailedStats> = {};
    const districts: Record<string, Record<string, DetailedStats>> = {};

    const getFirstValue = (p: EducationalPlace, cols: string[] | undefined): string | null => {
        if (!Array.isArray(cols) || cols.length === 0) return null;
        for (const col of cols) {
            if (Object.prototype.hasOwnProperty.call(p.rawData, col)) {
                const value = p.rawData[col];
                if (value !== null && value !== undefined && String(value).trim() !== '') {
                    return String(value).trim();
                }
            }
        }
        return null;
    };

    // Build a map from spatial district to the most likely governorate to handle missing data
    const spatialDistrictToGovernorateMap: Record<string, string> = {};
    if (groupingMethod === 'spatial') {
        const districtGovCounts: Record<string, Record<string, number>> = {};

        for (const place of filteredPlaces) {
            const mapping = fileMappings[place.fileId];
            if (!mapping?.filterMappings?.governorateColumn) continue;

            const spatialDist = place.spatialDistrict;
            const textGov = getFirstValue(place, mapping.filterMappings.governorateColumn);

            if (spatialDist && spatialDist !== 'خارج النطاق' && spatialDist !== 'غير محدد' && textGov) {
                if (!districtGovCounts[spatialDist]) {
                    districtGovCounts[spatialDist] = {};
                }
                const govCounts = districtGovCounts[spatialDist];
                govCounts[textGov] = (govCounts[textGov] || 0) + 1;
            }
        }

        // Now find the most frequent governorate for each district
        for (const district in districtGovCounts) {
            if (Object.prototype.hasOwnProperty.call(districtGovCounts, district)) {
                const govCounts = districtGovCounts[district];
                let maxCount = 0;
                let bestGov = '';
                for (const gov in govCounts) {
                    if (Object.prototype.hasOwnProperty.call(govCounts, gov)) {
                        const count = govCounts[gov];
                        if (count > maxCount) {
                            maxCount = count;
                            bestGov = gov;
                        }
                    }
                }
                if (bestGov) {
                    spatialDistrictToGovernorateMap[district] = bestGov;
                }
            }
        }
    }


    filteredPlaces.forEach(place => {
        const mapping = fileMappings[place.fileId];
        if (!mapping) return;
        
        let gov: string;
        let dist: string;

        if (groupingMethod === 'spatial') {
            dist = place.spatialDistrict || 'خارج النطاق';
            // New logic: Use the inferred map first, then fallback to the place's text data.
            gov = spatialDistrictToGovernorateMap[dist] 
                  || getFirstValue(place, mapping.filterMappings?.governorateColumn) 
                  || 'غير محدد';
        } else { // 'text' grouping
            gov = getFirstValue(place, mapping.filterMappings?.governorateColumn) || 'غير محدد';
            dist = getFirstValue(place, mapping.filterMappings?.districtColumn) || 'غير محدد';
        }

        const isDistrictValid = dist !== 'غير محدد' && dist !== 'خارج النطاق';

        if (!governorates[gov]) governorates[gov] = initializeDetailedStats();
        if (isDistrictValid) {
            if (!districts[gov]) districts[gov] = {};
            if (!districts[gov][dist]) districts[gov][dist] = initializeDetailedStats();
        }
        
        const updaters = [region, governorates[gov]];
        if (isDistrictValid) {
            updaters.push(districts[gov][dist]);
        }


        updaters.forEach(u => u.total += 1);

        const category = (place as any).effectiveCategory;

        if (category === 'schools') {
            const level = getFirstValue(place, mapping.filterMappings?.levelColumn) || 'غير محدد';
            const authority = getFirstValue(place, mapping.filterMappings?.authorityColumn) || '';
            const studyTime = getFirstValue(place, mapping.filterMappings?.studyTimeColumn) || '';
            const name = place.name || '';
            const rawText = JSON.stringify(place.rawData);

            // 1. الأهلي والخاص والعالمي (Private, Special, International)
            if (authority.includes('أهلي') || authority.includes('خاص') || authority.includes('عالمي') || authority.includes('أجنبي') || name.includes('أهلي') || name.includes('خاص')) {
                updaters.forEach(u => u.schoolsByLevel[level] = (u.schoolsByLevel[level] || 0) + 1);
            }

            // 2. التعليم الحكومي (Government)
            if (authority.includes('حكومي') || authority.includes('عام') || (!authority && !authority.includes('أهلي'))) {
                updaters.forEach(u => u.governmentSchoolsByLevel[level] = (u.governmentSchoolsByLevel[level] || 0) + 1);
            }

            // 3. التعليم المستمر الحكومي (Continuing Government)
            if (rawText.includes('مستمر') || name.includes('مستمر') || studyTime.includes('مستمر') || studyTime.includes('مباراة') || studyTime.includes('ليلي')) {
                updaters.forEach(u => u.continuingGovSchoolsByLevel[level] = (u.continuingGovSchoolsByLevel[level] || 0) + 1);
            }

            // 4. التعليم الحكومي المسائي (Evening Government)
            if (studyTime.includes('مسائي') || name.includes('مسائي') || rawText.includes('مسائي')) {
                updaters.forEach(u => u.eveningGovSchoolsByLevel[level] = (u.eveningGovSchoolsByLevel[level] || 0) + 1);
            }

            // 5. البرامج التعليمية الحكومية (Government Programs)
            if (name.includes('برنامج') || rawText.includes('برنامج') || name.includes('تحفيظ') || name.includes('تربية خاصة')) {
                updaters.forEach(u => u.govProgramsByLevel[level] = (u.govProgramsByLevel[level] || 0) + 1);
            }
        }
    });

    return { filteredPlaces, region, governorates, districts };

  }, [allPlaces, fileMappings, visibleCategories, filters, groupingMethod]);

    const handleGovernorateSelection = (governorate: string) => {
        setSelectedGovernorates(prev =>
            prev.includes(governorate)
                ? prev.filter(g => g !== governorate)
                : [...prev, governorate]
        );
    };
    
    useEffect(() => {
        setSelectedDistrict('all');
    }, [selectedGovernorateForDistrictFilter]);

    const availableDistrictsForDropdown = useMemo(() => {
        if (selectedGovernorateForDistrictFilter === 'all') {
            const allDistrictNames = new Set<string>();
            Object.values(aggregatedData.districts).forEach(districtsInGov => {
                Object.keys(districtsInGov).forEach(distName => allDistrictNames.add(distName));
            });
            return Array.from(allDistrictNames).sort();
        }
        const districtsInGov = aggregatedData.districts[selectedGovernorateForDistrictFilter] || {};
        return Object.keys(districtsInGov).sort();
    }, [aggregatedData.districts, selectedGovernorateForDistrictFilter]);

    const filteredGovernorateData = useMemo(() => {
        return Object.entries(aggregatedData.governorates)
            .filter(([governorate]) => selectedGovernorates.includes(governorate));
    }, [aggregatedData.governorates, selectedGovernorates]);

  const allLevels = useMemo(() => {
    const levels = new Set<string>();
    (Object.values(aggregatedData.governorates) as DetailedStats[]).forEach(gov => {
      Object.keys(gov.schoolsByLevel).forEach(level => levels.add(level));
      Object.keys(gov.privateSchoolsByLevel).forEach(level => levels.add(level));
      Object.keys(gov.internationalSchoolsByLevel).forEach(level => levels.add(level));
    });
    Object.values(aggregatedData.districts).forEach(districtsInGov => {
        (Object.values(districtsInGov) as DetailedStats[]).forEach(dist => {
          Object.keys(dist.schoolsByLevel).forEach(level => levels.add(level));
          Object.keys(dist.privateSchoolsByLevel).forEach(level => levels.add(level));
          Object.keys(dist.internationalSchoolsByLevel).forEach(level => levels.add(level));
        });
    });
    return Array.from(levels).sort();
  }, [aggregatedData.governorates, aggregatedData.districts]);
  
  const activeFilters = useMemo(() => {
    const active: { category: string, filter: string }[] = [];
    Object.entries(filters).forEach(([categoryKey, categoryFilters]) => {
      const categoryName = categoryToName[categoryKey];
      if (categoryName && visibleCategories.has(categoryKey)) {
        Object.entries(categoryFilters).forEach(([key, value]) => {
          if (value && value !== 'all' && String(value).trim() !== '') {
            active.push({ category: categoryName, filter: `${filterKeyToName[key] || key}: ${value}` });
          }
        });
      }
    });
    return active;
  }, [filters, visibleCategories]);
  
  const handleExport = async (format: 'pdf' | 'word' | 'pptx' | 'excel') => {
      setIsExporting(format);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
      
      try {
        if (format === 'excel') {
            const dataForSheet: Record<string, any>[] = [];
            const dataSource = activeTab === 'governorate' 
                ? filteredGovernorateData
                : filteredDistrictData;

            if (activeTab === 'region') {
                const regionData = aggregatedData.region;
                let row: Record<string, any> = { "البند": "الملخص الإجمالي للمنطقة" };
                
                if (exportOptions.privateSpecialGlobal) allLevels.forEach(l => row[`أهلي/خاص/عالمي (${l})`] = regionData.schoolsByLevel[l] || 0);
                if (exportOptions.government) allLevels.forEach(l => row[`حكومي (${l})`] = regionData.governmentSchoolsByLevel[l] || 0);
                if (exportOptions.continuingGovernment) allLevels.forEach(l => row[`مستمر حكومي (${l})`] = regionData.continuingGovSchoolsByLevel[l] || 0);
                if (exportOptions.eveningGovernment) allLevels.forEach(l => row[`مسائي حكومي (${l})`] = regionData.eveningGovSchoolsByLevel[l] || 0);
                if (exportOptions.governmentPrograms) allLevels.forEach(l => row[`برامج حكومية (${l})`] = regionData.govProgramsByLevel[l] || 0);
                row['الإجمالي'] = regionData.total;
                dataForSheet.push(row);

            } else { // Governorate or District
                dataSource.forEach(([name, stats]) => {
                    let row: Record<string, any> = {};
                    if (activeTab === 'district') {
                        row['الحي'] = name;
                        row['المحافظة'] = (stats as DetailedStats & { governorate: string }).governorate;
                    } else {
                        row['المحافظة'] = name;
                    }
                    
                    const s = stats as DetailedStats;

                    if (exportOptions.privateSpecialGlobal) allLevels.forEach(l => row[`أهلي/خاص/عالمي (${l})`] = s.schoolsByLevel[l] || 0);
                    if (exportOptions.government) allLevels.forEach(l => row[`حكومي (${l})`] = s.governmentSchoolsByLevel[l] || 0);
                    if (exportOptions.continuingGovernment) allLevels.forEach(l => row[`مستمر حكومي (${l})`] = s.continuingGovSchoolsByLevel[l] || 0);
                    if (exportOptions.eveningGovernment) allLevels.forEach(l => row[`مسائي حكومي (${l})`] = s.eveningGovSchoolsByLevel[l] || 0);
                    if (exportOptions.governmentPrograms) allLevels.forEach(l => row[`برامج حكومية (${l})`] = s.govProgramsByLevel[l] || 0);
                    row['الإجمالي'] = s.total;

                    dataForSheet.push(row);
                });
            }

            const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `تقرير ${activeTab}`);
            XLSX.writeFile(workbook, `report_${activeTab}.xlsx`);

        } else {
             alert(`التصدير بصيغة ${format.toUpperCase()} قيد التطوير.`);
        }
      } catch (error) {
          console.error(`Failed to export to ${format}`, error);
          alert(`حدث خطأ أثناء التصدير إلى ${format}.`);
      } finally {
          setIsExporting(null);
      }
  };

  const filteredDistrictData = useMemo(() => {
    // First, flatten the new nested district structure into the format the UI expects.
    const flattenedDistricts: [string, DetailedStats & { governorate: string }][] = [];
    Object.entries(aggregatedData.districts).forEach(([governorate, districtsInGov]) => {
        Object.entries(districtsInGov).forEach(([districtName, stats]) => {
            flattenedDistricts.push([districtName, { ...stats, governorate }]);
        });
    });
    
    let districts = flattenedDistricts;

    if (selectedGovernorateForDistrictFilter !== 'all') {
        districts = districts.filter(([, data]) => data.governorate === selectedGovernorateForDistrictFilter);
    }
    
    if (selectedDistrict !== 'all') {
        districts = districts.filter(([districtName]) => districtName === selectedDistrict);
    }

    if (districtSearch) {
        const lowerSearch = districtSearch.toLowerCase();
        districts = districts.filter(([district, data]) => 
            district.toLowerCase().includes(lowerSearch) || data.governorate.toLowerCase().includes(lowerSearch)
        );
    }
    
    return districts;
  }, [aggregatedData.districts, districtSearch, selectedGovernorateForDistrictFilter, selectedDistrict]);

  const tableHeaders = [
    ...allLevels.map(l => `التعليم الخاص (${l})`),
    ...allLevels.map(l => `أهلي (${l})`),
    ...allLevels.map(l => `أجنبي (${l})`),
    'أراضٍ مملوكة', 'أراضٍ غير مملوكة',
    'مبانٍ مخلاة', 'مشاريع متعثرة',
    'الإجمالي'
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/65 z-50 flex items-center justify-center backdrop-blur-sm p-2 sm:p-4" onClick={() => onClose()} dir="rtl">
      <Card className="w-full max-w-6xl bg-background shadow-2xl relative flex flex-col max-h-[92vh] rounded-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="p-3 sm:p-4 flex items-center justify-between border-b-4 border-primary-light bg-primary-dark text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-primary-light" />
            <h2 className="text-fluid-base sm:text-fluid-lg md:text-fluid-xl font-bold text-white">لوحة التقارير والإحصائيات</h2>
          </div>
          <button onClick={() => onClose()} className="p-2 rounded-full text-white hover:bg-white/20 transition-colors" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 custom-scrollbar">
            <div className="flex items-center justify-center border-b-2 border-slate-200 overflow-x-auto">
                <TabButton icon={Map} text="تقارير المنطقة" isActive={activeTab === 'region'} onClick={() => setActiveTab('region')} />
                <TabButton icon={Building2} text="تقارير المحافظة" isActive={activeTab === 'governorate'} onClick={() => setActiveTab('governorate')} />
                <TabButton icon={Landmark} text="تقارير الحي" isActive={activeTab === 'district'} onClick={() => setActiveTab('district')} />
            </div>

            <ReportSection title="الفلاتر النشطة">
                {activeFilters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {activeFilters.map((f, i) => (
                    <div key={i} className="bg-primary-subtle text-primary-dark text-fluid-2xs font-semibold p-2 rounded-lg border border-primary-light/30">
                        <span className="font-bold">{f.category}:</span> {f.filter}
                    </div>
                    ))}
                </div>
                ) : <p className="text-fluid-xs text-center text-slate-500 py-2">لم يتم تطبيق أي فلاتر.</p>}
            </ReportSection>
            
            <Separator />
            
            {activeTab === 'district' && (
              <>
              <ReportSection title="أساس التقرير">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center gap-2">
                        <p className="text-fluid-xs font-semibold text-slate-700">عرض أحياء:</p>
                        <select
                            value={selectedGovernorateForDistrictFilter}
                            onChange={(e) => setSelectedGovernorateForDistrictFilter(e.target.value)}
                            className="px-3 py-2 text-fluid-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light bg-white"
                        >
                            <option value="all">المنطقة بأكملها</option>
                            {GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-fluid-xs font-semibold text-slate-700">واختر الحي:</p>
                        <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            className="px-3 py-2 text-fluid-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light bg-white"
                        >
                            <option value="all">الكل</option>
                            {availableDistrictsForDropdown.map(dist => <option key={dist} value={dist}>{dist}</option>)}
                        </select>
                      </div>

                      <div className="border-l h-6 mx-2 hidden md:block"></div>
                      
                      <div className="flex items-center gap-2">
                        <p className="text-fluid-xs font-semibold text-slate-700">وتجميعها بناءً على:</p>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant={groupingMethod === 'spatial' ? 'primary' : 'secondary'} onClick={() => setGroupingMethod('spatial')} className="text-fluid-2xs">
                                طبقة الحدود (KML)
                            </Button>
                            <Button size="sm" variant={groupingMethod === 'text' ? 'primary' : 'secondary'} onClick={() => setGroupingMethod('text')} className="text-fluid-2xs">
                                بيانات الملفات
                            </Button>
                        </div>
                      </div>
                  </div>
              </ReportSection>
              <Separator />
              </>
            )}
            
            {activeTab !== 'district' && (
                <>
                <ReportSection title="أساس تقرير الحي">
                    <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                        <p className="text-fluid-xs font-semibold text-slate-700">تجميع إحصائيات الأحياء بناءً على:</p>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={groupingMethod === 'spatial' ? 'primary' : 'secondary'}
                                onClick={() => setGroupingMethod('spatial')}
                                className="text-fluid-2xs"
                            >
                                طبقة الحدود (KML)
                            </Button>
                            <Button
                                size="sm"
                                variant={groupingMethod === 'text' ? 'primary' : 'secondary'}
                                onClick={() => setGroupingMethod('text')}
                                className="text-fluid-2xs"
                            >
                                بيانات الملفات
                            </Button>
                        </div>
                    </div>
                </ReportSection>
                <Separator />
                </>
            )}


            <div className="min-h-[300px]">
                {activeTab === 'region' && (
                    <>
                    <ReportSection title="الملخص الإجمالي">
                         <div className="ds-grid-auto-fit">
                            <StatCard title="إجمالي المواقع" value={aggregatedData.region.total} />
                            <StatCard title="التعليم الخاص حسب المرحلة" value={Object.values(aggregatedData.region.schoolsByLevel).reduce((a, b) => a + b, 0)} />
                            <StatCard title="أراضٍ مملوكة" value={aggregatedData.region.ownedLandsCount} />
                            <StatCard title="أراضٍ غير مملوكة" value={aggregatedData.region.unownedLandsCount} />
                            <StatCard title="مبانٍ مخلاة" value={aggregatedData.region.evacuatedBuildingsCount} />
                            <StatCard title="مشاريع متعثرة" value={aggregatedData.region.stalledProjectsCount} />
                         </div>
                    </ReportSection>
                    <Separator className="my-6" />
                    <ReportSection title="تفاصيل الفئات">
                        <div className="ds-grid-auto-fit">
                            <DetailedStatGroup title="التعليم الخاص حسب المرحلة" data={aggregatedData.region.schoolsByLevel} />
                            <DetailedStatGroup title="التعليم الأهلي حسب المرحلة" data={aggregatedData.region.privateSchoolsByLevel} />
                            <DetailedStatGroup title="التعليم الأجنبي حسب المرحلة" data={aggregatedData.region.internationalSchoolsByLevel} />
                        </div>
                    </ReportSection>
                    </>
                )}
                {activeTab === 'governorate' && (
                    <>
                    <ReportSection title="تحديد المحافظات للتقرير">
                        <div className="flex items-center gap-4 mb-4">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedGovernorates(GOVERNORATES)}>تحديد الكل</Button>
                            <Button size="sm" variant="secondary" onClick={() => setSelectedGovernorates([])}>إلغاء تحديد الكل</Button>
                        </div>
                        <div className="ds-grid-auto-fit p-4 bg-white rounded-xl border border-slate-200">
                            {GOVERNORATES.map(gov => (
                                <CheckboxControl 
                                    key={gov}
                                    label={gov} 
                                    checked={selectedGovernorates.includes(gov)} 
                                    onChange={() => handleGovernorateSelection(gov)} 
                                
                                />
                            ))}
                        </div>
                    </ReportSection>
                    <Separator className="my-4"/>
                    <ReportSection title="إحصائيات حسب المحافظة">
                       <DataTable
                            headers={['المحافظة', ...tableHeaders]}
                            rows={filteredGovernorateData.map(([governorate, stats]: [string, DetailedStats]) => [
                                governorate,
                                ...allLevels.map(l => stats.schoolsByLevel[l] || 0),
                                ...allLevels.map(l => stats.privateSchoolsByLevel[l] || 0),
                                ...allLevels.map(l => stats.internationalSchoolsByLevel[l] || 0),
                                stats.ownedLandsCount, stats.unownedLandsCount,
                                stats.evacuatedBuildingsCount, stats.stalledProjectsCount,
                                stats.total
                            ])}
                        />
                    </ReportSection>
                    </>
                )}
                {activeTab === 'district' && (
                    <ReportSection title={`إحصائيات حسب الحي (${groupingMethod === 'spatial' ? 'تحليل مكاني' : 'بيانات نصية'})`}>
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="ابحث عن حي أو محافظة..."
                                value={districtSearch}
                                onChange={(e) => setDistrictSearch(e.target.value)}
                                className="ds-input pr-10"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        </div>
                       <DataTable
                            headers={['الحي', 'المحافظة', ...tableHeaders]}
                            rows={filteredDistrictData.map(([district, stats]) => [
                                district,
                                stats.governorate,
                                ...allLevels.map(l => stats.schoolsByLevel[l] || 0),
                                ...allLevels.map(l => stats.privateSchoolsByLevel[l] || 0),
                                ...allLevels.map(l => stats.internationalSchoolsByLevel[l] || 0),
                                stats.ownedLandsCount, stats.unownedLandsCount,
                                stats.evacuatedBuildingsCount, stats.stalledProjectsCount,
                                stats.total
                            ])}
                        />
                    </ReportSection>
                )}
            </div>

            <Separator/>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-primary-light rounded-full"></div>
                        <h3 className="text-fluid-md font-bold text-primary-dark">تخصيص محتوى التقرير للتصدير</h3>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => handleExport('excel')}
                        disabled={isExporting === 'excel'}
                        className="gap-2 bg-primary-medium hover:bg-primary-dark"
                    >
                        {isExporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span>تصدير</span>
                    </Button>
                </div>
                 <div className="ds-grid-auto-fit p-4 bg-white rounded-xl border border-slate-200">
                    <CheckboxControl label="عدد التعليم الأهلي والخاص والعالمي لكل مرحلة مفصلة بالمنطقة والمحافظات" checked={exportOptions.privateSpecialGlobal} onChange={() => handleExportOptionChange('privateSpecialGlobal')} />
                    <CheckboxControl label="عدد مدارس التعليم الحكومي لكل مرحلة مفصلة بالمنطقة والمحافظات" checked={exportOptions.government} onChange={() => handleExportOptionChange('government')} />
                    <CheckboxControl label="عدد مدارس التعليم المستمر الحكومي لكل مرحلة مفصلة بالمنطقة والمحافظات" checked={exportOptions.continuingGovernment} onChange={() => handleExportOptionChange('continuingGovernment')} />
                    <CheckboxControl label="عدد مدارس التعليم الحكومي المسائية لكل مرحلة مفصلة بالمنطقة والمحافظات" checked={exportOptions.eveningGovernment} onChange={() => handleExportOptionChange('eveningGovernment')} />
                    <CheckboxControl label="عدد البرامج التعليمية الحكومية لكل مرحلة مفصلة بالمنطقة والمحافظات" checked={exportOptions.governmentPrograms} onChange={() => handleExportOptionChange('governmentPrograms')} />
                </div>
            </section>

        </main>

        <footer className="p-3 sm:p-4 border-t bg-white rounded-b-xl flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-2 sm:gap-3">
                 <ExportButton format="excel" icon={Sheet} onClick={handleExport} isExporting={isExporting === 'excel'} />
                 <ExportButton format="pdf" icon={FileType2} onClick={handleExport} isExporting={isExporting === 'pdf'} disabled />
                 <ExportButton format="word" icon={FileBarChart2} onClick={handleExport} isExporting={isExporting === 'word'} disabled />
                 <ExportButton format="pptx" icon={Presentation} onClick={handleExport} isExporting={isExporting === 'pptx'} disabled />
            </div>
          <Button variant="secondary" onClick={() => onClose()}>إغلاق</Button>
        </footer>
      </Card>
    </div>
  );
};

const ReportSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-primary-light rounded-full"></div>
            <h3 className="text-lg font-bold text-primary-dark">{title}</h3>
        </div>
        {children}
    </section>
);

const TabButton: React.FC<{ text: string, icon: React.ElementType, isActive: boolean, onClick: () => void }> = ({ text, icon: Icon, isActive, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 font-semibold border-b-4 transition-colors ${isActive ? 'border-primary-light text-primary-dark' : 'border-transparent text-gray-500 hover:text-primary-dark'}`}>
        <Icon className="h-5 w-5" />
        <span>{text}</span>
    </button>
);

const StatCard: React.FC<{ title: string, value: number }> = ({ title, value }) => (
    <div className="p-4 bg-white border border-slate-200 rounded-xl text-center shadow-xs hover:shadow-md transition-shadow">
        <p className="text-fluid-xs font-medium text-slate-600">{title}</p>
        <p className="text-fluid-xl sm:text-fluid-2xl font-bold text-primary-dark mt-1">{value.toLocaleString()}</p>
    </div>
);

const DetailedStatGroup: React.FC<{ title: string, data: Record<string, number> }> = ({ title, data }) => (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <h4 className="text-fluid-sm font-semibold text-slate-800 mb-3 border-b border-slate-200 pb-2">{title}</h4>
        {Object.keys(data).length > 0 ? (
            <div className="space-y-2">
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-fluid-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-600">{key}</span>
                    <span className="font-bold text-primary-dark text-fluid-sm">{value.toLocaleString()}</span>
                </div>
            ))}
            </div>
        ) : (
            <p className="text-fluid-xs text-center text-slate-500 py-4">لا توجد بيانات</p>
        )}
    </div>
);

const DataTable: React.FC<{ headers: string[], rows: (string|number)[][] }> = ({ headers, rows }) => (
    <div className="ds-table-container">
        <div className="max-h-[30rem] overflow-auto custom-scrollbar">
            <table className="w-full text-fluid-xs text-right whitespace-nowrap">
                <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>{headers.map(h => <th key={h} className="px-3 py-2.5 font-bold text-slate-700 text-fluid-2xs border-b border-slate-300">{h}</th>)}</tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                    {rows.length > 0 ? rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">{row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-700">{typeof cell === 'number' ? cell.toLocaleString() : cell}</td>)}</tr>
                    )) : (
                        <tr><td colSpan={headers.length} className="text-center p-6 text-slate-500">لا توجد بيانات للعرض.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

interface ExportButtonProps {
    format: 'pdf' | 'word' | 'pptx' | 'excel';
    icon: React.ElementType;
    onClick: (format: 'pdf' | 'word' | 'pptx' | 'excel') => void;
    isExporting: boolean;
    disabled?: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({
    format,
    icon: Icon,
    onClick,
    isExporting,
    disabled = false,
}) => {
    const labels = { excel: 'Excel', pdf: 'PDF', word: 'Word', pptx: 'PowerPoint' };
    const baseClasses = "gap-2 justify-center";
    const enabledClasses = "bg-primary-medium hover:bg-primary-dark";
    const disabledClasses = "bg-gray-300 text-gray-500 cursor-not-allowed";
    return (
        <Button onClick={() => onClick(format)} disabled={isExporting || disabled} className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses}`}>
            {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
            <span>{labels[format]}</span>
        </Button>
    );
};

// FIX: Added (event: any) parameter to onChange to satisfy React's expectation for input handlers and avoid argument count errors.
const CheckboxControl: React.FC<{ label: string, checked: boolean, onChange: () => void }> = ({ label, checked, onChange }) => {
    return (
        <label className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange()}
                className="h-4 w-4 rounded border-gray-300 text-primary-light focus:ring-primary-light"
            />
            <span className="text-sm text-gray-700 font-medium">{label}</span>
        </label>
    );
};
