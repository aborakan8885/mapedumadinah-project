
import React, { useEffect, useRef, useMemo } from 'react';
import type { EducationalPlace, Category, FileMapping, User } from '../types';
import { Loader2 } from 'lucide-react';
import { useData, getPlaceGroup, getPlaceGroupLabel, extractDistrictNameFromProperties, normalizeArabic } from '../App';

// --- مساعدات العرض ---

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

const getCategoryIcon = (category: Category | string) => {
    const icons: Record<string, { color: string, html: string }> = {
        schools: { color: '#00af87', html: '🏫' },
        school: { color: '#00af87', html: '🏫' },
        default: { color: '#6b7280', html: '📍' },
    };
    const icon = icons[category] || icons.default;
    return L.divIcon({
        html: `<div style="background-color:${icon.color};" class="w-full h-full flex items-center justify-center text-lg text-white rounded-full shadow-xl border-2 border-white transform transition-transform hover:scale-110">${icon.html}</div>`,
        className: 'map-marker-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32], 
        popupAnchor: [0, -35],
    });
};

const createDistrictPopupContent = (feature: any, formattedName: string, props: any): string => {
    const extraDetails: { key: string; val: string }[] = [];
    if (props && typeof props === 'object') {
        for (const [k, v] of Object.entries(props)) {
            if (!v) continue;
            const keyLower = k.toLowerCase().trim();
            if (keyLower === 'name' || keyLower === 'description' || keyLower.startsWith('style') || keyLower.startsWith('fill') || keyLower.startsWith('stroke')) continue;
            const strVal = String(v).trim();
            if (!strVal || strVal.startsWith('<') || strVal.length > 100) continue;

            let label = k;
            if (keyLower === 'districtna' || keyLower === 'dist_name' || keyLower === 'district_name' || keyLower === 'اسم_الحي' || keyLower === 'اسم الحي') label = 'اسم الحي';
            else if (keyLower === 'gov_name' || keyLower === 'governorate' || keyLower === 'المحافظة') label = 'المحافظة';
            else if (keyLower === 'reg_name' || keyLower === 'region' || keyLower === 'المنطقة') label = 'المنطقة';
            else if (keyLower === 'area' || keyLower === 'shape_area' || keyLower === 'المساحة') label = 'المساحة';

            if (!extraDetails.some(d => d.key === label)) {
                extraDetails.push({ key: label, val: strVal });
            }
        }
    }

    return `
        <div dir="rtl" style="font-family: 'Tajawal', system-ui, sans-serif;" class="p-2 text-right min-w-[210px]">
            <div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    حدود الحي السكني
                </span>
                <span class="text-[10px] text-gray-400 font-bold">طبقة KMZ</span>
            </div>
            <h3 class="text-base font-black text-gray-950 leading-snug mb-2">
                ${formattedName}
            </h3>
            ${extraDetails.length > 0 ? `
                <div class="space-y-1.5 text-xs text-gray-700 bg-slate-50 p-2.5 rounded-lg border border-slate-150 my-1">
                    ${extraDetails.slice(0, 6).map(item => `
                        <div class="flex justify-between items-center gap-2">
                            <span class="font-bold text-gray-500 text-[11px]">${item.key}:</span>
                            <span class="font-extrabold text-slate-800 text-[11px] truncate">${item.val}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

const createPopupContent = (place: EducationalPlace): string => {
    let content = `<div class="p-1 custom-educational-popup" style="min-width: 240px; max-width: 300px; font-family: 'Tajawal', sans-serif;">
        <div class="flex items-center gap-2 border-b-2 border-primary-light/30 pb-2 mb-3">
            <div class="bg-primary-light/10 p-1.5 rounded-lg text-xl">📍</div>
            <h3 class="font-bold text-base text-primary-dark text-right leading-tight m-0">${place.name}</h3>
        </div>`;
    content += '<div class="space-y-2 text-sm max-h-60 overflow-y-auto pr-2 custom-scrollbar text-right" dir="rtl">';
    let columns = (Array.isArray(place.displayColumns) && place.displayColumns.length > 0) ? place.displayColumns : (place.rawData ? Object.keys(place.rawData) : []);
    let hasData = false;
    columns.forEach(col => {
        const val = place.rawData[col];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
            hasData = true;
            content += `<div class="flex flex-col mb-1.5 bg-gray-50/80 p-2 rounded-md border border-gray-100"><span class="font-bold text-gray-400 text-[10px] uppercase mb-0.5">${col}</span><span class="text-gray-800 font-medium text-xs">${val}</span></div>`;
        }
    });
    if (!hasData) content += `<p class="text-gray-400 italic text-center py-4">لا توجد تفاصيل إضافية</p>`;
    content += '</div><div class="border-t mt-4 pt-3 flex justify-center"><a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}" target="_blank" class="flex items-center justify-center gap-2 bg-primary-dark text-white px-5 py-2 rounded-full hover:bg-black transition-all font-bold text-xs shadow-md w-full"><span>توجيه عبر خرائط جوجل</span></a></div></div>';
    return content;
};

const DISTRICT_PALETTE = [
    { fill: '#10b981', stroke: '#047857' }, // Emerald
    { fill: '#3b82f6', stroke: '#1d4ed8' }, // Blue
    { fill: '#f59e0b', stroke: '#b45309' }, // Amber
    { fill: '#8b5cf6', stroke: '#6d28d9' }, // Purple
    { fill: '#ec4899', stroke: '#be185d' }, // Pink
    { fill: '#14b8a6', stroke: '#0f766e' }, // Teal
    { fill: '#f97316', stroke: '#c2410c' }, // Orange
    { fill: '#6366f1', stroke: '#4338ca' }, // Indigo
    { fill: '#06b6d4', stroke: '#0e7490' }, // Cyan
    { fill: '#84cc16', stroke: '#4d7c0f' }, // Lime
    { fill: '#e11d48', stroke: '#9f1239' }, // Rose
    { fill: '#a855f7', stroke: '#7e22ce' }, // Violet
];

function getDistrictFeatureStyle(feature: any, featureIndex: number) {
    return {
        fill: true,
        fillColor: '#93c5fd', // soft light blue fill
        fillOpacity: 0.15,
        color: '#3b82f6', // light blue border (أزرق خفيف وفاتح)
        weight: 2,
        opacity: 0.85,
    };
}

interface MapCanvasProps {
  mapType: 'default' | 'satellite';
  setMapType: (type: 'default' | 'satellite') => void;
  selectedPlace: EducationalPlace | null;
  onSelectPlace: (place: EducationalPlace | null) => void;
  allPlaces: EducationalPlace[];
  isLoading: boolean;
  currentUser?: User | null;
  // بقية الخصائص للتوافق ولكن لا تستخدم في الفلترة المباشرة هنا
  searchQuery?: string;
  filters?: any;
  visibleCategories?: any;
  fileMappings?: any;

  // طبقة المدارس المحيطة
  isSurroundingActive?: boolean;
  surroundingBaseSchool?: EducationalPlace | null;
  setSurroundingBaseSchool?: (school: EducationalPlace | null) => void;
  surroundingRadius?: number;
  surroundingGender?: string;
  surroundingLevel?: string;
  surroundingRegion?: string;
  surroundingGovernorate?: string;
  surroundingSchools?: EducationalPlace[];
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  mapType,
  setMapType,
  selectedPlace,
  onSelectPlace,
  allPlaces,
  isLoading,
  currentUser = null,
  filters,

  isSurroundingActive = false,
  surroundingBaseSchool = null,
  setSurroundingBaseSchool,
  surroundingRadius = 2000,
  surroundingGender = 'all',
  surroundingLevel = 'all',
  surroundingRegion = 'all',
  surroundingGovernorate = 'all',
  surroundingSchools = [],
}) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.MarkerClusterGroup | null>(null);
    const markerMap = useRef<Record<string, L.Marker>>({});

    const surroundingCircleRef = useRef<L.Circle | null>(null);
    const surroundingLinesRef = useRef<L.LayerGroup | null>(null);
    const surroundingMarkersRef = useRef<L.LayerGroup | null>(null);

    const { boundaryGeojson, loadingStage, loadingProgress } = useData();
    const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
    const isBeneficiary = currentUser?.userType === 'beneficiary';
    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, { center: [24.4686, 39.6142], zoom: 11, zoomControl: false, attributionControl: false, tap: true });
            mapRef.current = map;
            L.control.zoom({ position: 'topright' }).addTo(map);
            const layers = {
                default: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 }),
            };
            layers[mapType].addTo(map);
            (map as any)._layersCache = layers;

            if (!map.getPane('boundaryPane')) {
                const pane = map.createPane('boundaryPane');
                pane.style.zIndex = '450';
                pane.style.pointerEvents = 'auto';
            }

            markersRef.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 20, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 18, animate: true, spiderfyDistanceMultiplier: 1.5 });
            map.addLayer(markersRef.current);
            map.on('click', () => onSelectPlace(null));

            // Invalidate size after layout transition to ensure smooth rendering
            setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.invalidateSize();
                }
            }, 100);
        }
        return () => { mapRef.current?.remove(); mapRef.current = null; };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const cache = (map as any)._layersCache;
        if (map.hasLayer(cache.default)) map.removeLayer(cache.default);
        if (map.hasLayer(cache.satellite)) map.removeLayer(cache.satellite);
        cache[mapType].addTo(map);
        if (boundaryLayerRef.current) {
            boundaryLayerRef.current.bringToFront();
        }
    }, [mapType]);

    // --- تحسين الأداء القصوى: فهرسة المفاتيح وتخزين القيم المصفاة ---
    const filteredBoundaryGeojson = useMemo(() => {
        if (!isAdmin || !boundaryGeojson || !boundaryGeojson.features) return null;

        const activeRegion = isSurroundingActive ? surroundingRegion : (filters?.region || 'all');
        const activeGov = isSurroundingActive ? surroundingGovernorate : (filters?.governorate || 'all');

        if (activeRegion === 'all' && activeGov === 'all') return boundaryGeojson;

        const normActiveRegion = normalizeArabic(activeRegion);
        const normActiveGov = normalizeArabic(activeGov);

        // محاولة إيجاد أسماء الأعمدة الصحيحة مرة واحدة فقط بدلاً من البحث في كل ميزة
        let regionKey: string | null = null;
        let govKey: string | null = null;

        if (boundaryGeojson.features.length > 0) {
            const firstProps = boundaryGeojson.features[0].properties || {};
            for (const k of Object.keys(firstProps)) {
                const kn = normalizeArabic(k);
                if (!regionKey && (kn.includes('المنطقه') || k.toLowerCase().includes('region'))) regionKey = k;
                if (!govKey && (kn.includes('المحافظه') || k.toLowerCase().includes('governorate'))) govKey = k;
            }
        }

        const filteredFeatures = boundaryGeojson.features.filter(feature => {
            const props = feature.properties || {};

            if (activeRegion !== 'all' && regionKey) {
                const val = props[regionKey];
                if (!val) return false;
                const nV = normalizeArabic(String(val));
                if (!nV.includes(normActiveRegion) && !normActiveRegion.includes(nV)) return false;
            } else if (activeRegion !== 'all') {
                // Fallback if key not found in first feature
                let found = false;
                for (const [k, v] of Object.entries(props)) {
                    if (normalizeArabic(k).includes('المنطقه') || k.toLowerCase().includes('region')) {
                        const nV = normalizeArabic(String(v));
                        if (nV.includes(normActiveRegion) || normActiveRegion.includes(nV)) { found = true; break; }
                    }
                }
                if (!found) return false;
            }

            if (activeGov !== 'all' && govKey) {
                const val = props[govKey];
                if (!val) return false;
                const nV = normalizeArabic(String(val));
                if (!nV.includes(normActiveGov) && !normActiveGov.includes(nV)) return false;
            } else if (activeGov !== 'all') {
                // Fallback if key not found in first feature
                let found = false;
                for (const [k, v] of Object.entries(props)) {
                    if (normalizeArabic(k).includes('المحافظه') || k.toLowerCase().includes('governorate')) {
                        const nV = normalizeArabic(String(v));
                        if (nV.includes(normActiveGov) || normActiveGov.includes(nV)) { found = true; break; }
                    }
                }
                if (!found) return false;
            }
            return true;
        });

        return { ...boundaryGeojson, features: filteredFeatures };
    }, [boundaryGeojson, isSurroundingActive, surroundingRegion, surroundingGovernorate, filters, isAdmin]);

    // رسم طبقة الحدود الجغرافية للحي على الخريطة بشكل احترافي مع ميزات التفاعل
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (boundaryLayerRef.current) {
            map.removeLayer(boundaryLayerRef.current);
            boundaryLayerRef.current = null;
        }

        if (!filteredBoundaryGeojson || !Array.isArray(filteredBoundaryGeojson.features) || filteredBoundaryGeojson.features.length === 0) {
            return;
        }

        const animId = requestAnimationFrame(() => {
            if (!mapRef.current) return;
            try {
                if (!map.getPane('boundaryPane')) {
                    const pane = map.createPane('boundaryPane');
                    pane.style.zIndex = '450';
                    pane.style.pointerEvents = 'auto';
                }

                const geoLayer = L.geoJSON(filteredBoundaryGeojson, {
                    pane: 'boundaryPane',
                    style: (feature) => {
                        const idx = feature && (filteredBoundaryGeojson as any).features ? (filteredBoundaryGeojson as any).features.indexOf(feature) : 0;
                        return getDistrictFeatureStyle(feature, idx >= 0 ? idx : 0);
                    },
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties || {};
                        const name = extractDistrictNameFromProperties(props);
                        const formattedName = name.startsWith('حي') ? name : `حي ${name}`;

                        layer.bindTooltip(name, {
                            permanent: false,
                            direction: 'top',
                            sticky: true,
                            interactive: false,
                            className: 'font-sans font-bold text-xs bg-white text-primary-dark px-2.5 py-1.5 rounded-lg shadow-xl border border-primary-light/15 pointer-events-none',
                        });

                        // Lazy popup evaluation on click
                        layer.bindPopup(() => createDistrictPopupContent(feature, formattedName, props), {
                            closeButton: true,
                            maxWidth: 320,
                        });

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target as any;
                                // Close any ghost tooltips on the map
                                if (map) map.closeTooltip();
                                
                                if (l && typeof l.setStyle === 'function') {
                                    l.setStyle({
                                        fill: false,
                                        fillOpacity: 0,
                                        weight: 4.5,
                                        color: '#10b981', // Highlight active district border with emerald color
                                    });
                                }
                                if (l.openTooltip) l.openTooltip();
                            },
                            mouseout: (e) => {
                                const l = e.target as any;
                                if (l && typeof l.setStyle === 'function') {
                                    const idx = feature && (filteredBoundaryGeojson as any).features ? (filteredBoundaryGeojson as any).features.indexOf(feature) : 0;
                                    const origStyle = getDistrictFeatureStyle(feature, idx >= 0 ? idx : 0);
                                    l.setStyle(origStyle);
                                }
                                if (l.closeTooltip) l.closeTooltip();
                                if (map) map.closeTooltip();
                            },
                        });
                    }
                });

                geoLayer.addTo(map);
                geoLayer.bringToFront();
                boundaryLayerRef.current = geoLayer;

                // احتواء الخريطة تلقائياً لتغطي كامل المساحة الجغرافية للطبقة
                const bounds = geoLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
                }
            } catch (error) {
                console.error("خطأ أثناء عرض طبقة الحدود الجغرافية على الخريطة:", error);
            }
        });

        return () => cancelAnimationFrame(animId);
    }, [filteredBoundaryGeojson]);

    // الرسم المباشر بناءً على ما يرسله الأب (App.tsx)
    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return;
        
        // إذا كان طور المدارس المحيطة فعالاً وتم تحديد مدرسة أساسية، فنفرغ الكلاستر الأساسي لتجنب التشويش
        if (isSurroundingActive && surroundingBaseSchool) {
            markersRef.current.clearLayers();
            markerMap.current = {};
            return;
        }

        markersRef.current.clearLayers();
        markerMap.current = {};

        if (!allPlaces || allPlaces.length === 0) return;

        const animId = requestAnimationFrame(() => {
            if (!mapRef.current || !markersRef.current) return;
            const markers: L.Marker[] = [];
            allPlaces.forEach(place => {
                const marker = L.marker([place.lat, place.lng], { icon: getCategoryIcon(place.category) });
                if (!isBeneficiary) {
                    // Lazy popup creation on click with smart side-offsetting
                    marker.bindPopup(() => createPopupContent(place), { 
                        closeButton: false, 
                        autoPan: true, 
                        autoPanPaddingTop: 100,
                        autoPanPaddingLeft: 50,
                        offset: L.point(-170, 150) 
                    });
                }
                marker.on('click', (e) => { 
                    L.DomEvent.stopPropagation(e); 
                    if (isSurroundingActive && setSurroundingBaseSchool) {
                        setSurroundingBaseSchool(place);
                    } else {
                        onSelectPlace(place); 
                    }
                });
                markerMap.current[place.id] = marker;
                markers.push(marker);
            });

            if (markers.length > 0) {
                markersRef.current.addLayers(markers);
            }
        });

        return () => cancelAnimationFrame(animId);
    }, [allPlaces, isSurroundingActive, surroundingBaseSchool, isBeneficiary]);

    // تأثير خاص برسم النطاق الجغرافي والخطوط المستقيمة وحساب المسافات للمدارس المحيطة
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // تنظيف الطبقات السابقة لمنع التكرار والتداخل
        if (surroundingCircleRef.current) {
            map.removeLayer(surroundingCircleRef.current);
            surroundingCircleRef.current = null;
        }
        if (surroundingLinesRef.current) {
            map.removeLayer(surroundingLinesRef.current);
            surroundingLinesRef.current = null;
        }
        if (surroundingMarkersRef.current) {
            map.removeLayer(surroundingMarkersRef.current);
            surroundingMarkersRef.current = null;
        }

        if (isSurroundingActive && surroundingBaseSchool) {
            // 1. رسم الدائرة القطرية المعبرة عن المسافة المحددة
            const circle = L.circle([surroundingBaseSchool.lat, surroundingBaseSchool.lng], {
                radius: surroundingRadius,
                color: '#fbbf24', // لون ذهبي مميز
                weight: 2,
                dashArray: '6, 6',
                fillColor: '#fbbf24',
                fillOpacity: 0.12
            }).addTo(map);
            surroundingCircleRef.current = circle;

            // 2. إنشاء مجموعات لرسوم الخطوط المستقيمة والدبابيس
            const linesGroup = L.layerGroup().addTo(map);
            surroundingLinesRef.current = linesGroup;

            const markersGroup = L.layerGroup().addTo(map);
            surroundingMarkersRef.current = markersGroup;

            // 3. رسم الدبوس الذهبي المميز للمدرسة الأساسية (المستهدفة)
            const baseIcon = L.divIcon({
                html: `<div class="relative w-full h-full flex items-center justify-center bg-amber-500 rounded-full shadow-2xl border-4 border-white transform scale-125">
                         <span class="text-base">⭐</span>
                         <div class="absolute -inset-1.5 rounded-full border-2 border-amber-400 animate-ping opacity-75"></div>
                       </div>`,
                className: 'base-school-marker-icon',
                iconSize: [38, 38],
                iconAnchor: [19, 19],
                popupAnchor: [0, -19],
            });

            const baseGroup = getPlaceGroup(surroundingBaseSchool);
            const baseLabels = getPlaceGroupLabel(baseGroup);
            const baseLabelText = baseLabels.singular === 'مدرسة' ? 'المدرسة الأساسية المستهدفة' : `الـ ${baseLabels.singular} الأساسي المستهدف`;

            const baseMarker = L.marker([surroundingBaseSchool.lat, surroundingBaseSchool.lng], { icon: baseIcon });
            if (!isBeneficiary) {
                baseMarker.bindPopup(() => createPopupContent(surroundingBaseSchool), { 
                    closeButton: false, 
                    autoPan: true, 
                    autoPanPaddingTop: 100,
                    autoPanPaddingLeft: 50,
                    offset: L.point(-170, 150) 
                });
            }
            baseMarker.addTo(markersGroup);

            baseMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onSelectPlace(surroundingBaseSchool);
            });

            baseMarker.bindTooltip(`<b>${baseLabelText}</b><br/>` + surroundingBaseSchool.name, {
                permanent: true,
                direction: 'top',
                className: 'font-sans font-bold text-xs bg-amber-500 text-white px-2 py-1 rounded shadow-lg border border-amber-400'
            });

            // 4. رسم الخطوط المستقيمة والدبابيس الزمردية للمدارس المحيطة المستهدفة بالتحليل
            surroundingSchools.forEach(s => {
                const dist = getDistanceMeters(surroundingBaseSchool.lat, surroundingBaseSchool.lng, s.lat, s.lng);
                const distText = dist < 1000 ? `${Math.round(dist)} متر` : `${(dist / 1000).toFixed(2)} كم`;

                // رسم الخط المستقيم
                const polyline = L.polyline(
                    [[surroundingBaseSchool.lat, surroundingBaseSchool.lng], [s.lat, s.lng]],
                    {
                        color: '#6366f1', // لون بنفسجي كلاسيكي أنيق
                        weight: 3,
                        dashArray: '4, 6',
                        opacity: 0.85
                    }
                ).addTo(linesGroup);

                // إظهار المسافة كملصق مباشر فوق منتصف الخط
                polyline.bindTooltip(distText, {
                    permanent: true,
                    direction: 'center',
                    className: 'font-sans font-extrabold text-[10px] bg-white text-indigo-700 border-2 border-indigo-500 px-1.5 py-0.5 rounded shadow-lg'
                });

                const sGroup = getPlaceGroup(s);
                const emoji = sGroup === 'program' ? '📚' : sGroup === 'land' ? '🗺️' : sGroup === 'project' ? '🏗️' : '🏫';

                // رسم دبوس المدرسة المجاورة بلون أخضر زمردي جميل
                const surrIcon = L.divIcon({
                    html: `<div class="w-full h-full flex items-center justify-center bg-emerald-500 text-base text-white rounded-full shadow-xl border-2 border-white transform transition-transform hover:scale-125">${emoji}</div>`,
                    className: 'surrounding-school-marker-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    popupAnchor: [0, -15],
                });

                const surrMarker = L.marker([s.lat, s.lng], { icon: surrIcon });
                if (!isBeneficiary) {
                    surrMarker.bindPopup(() => createPopupContent(s), { 
                        closeButton: false, 
                        autoPan: true, 
                        autoPanPaddingTop: 100,
                        autoPanPaddingLeft: 50,
                        offset: L.point(-170, 150) 
                    });
                }
                surrMarker.addTo(markersGroup);

                surrMarker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onSelectPlace(s);
                });

                surrMarker.bindTooltip(`<b>${s.name}</b><br/>المسافة: ${distText}`, {
                    permanent: false,
                    direction: 'top',
                    className: 'font-sans text-xs bg-white text-gray-800 px-2 py-1 rounded shadow border border-gray-100'
                });
            });

            // ملاءمة حجم الخريطة لتغطية كامل الدائرة الجغرافية والمدارس المحيطة بها
            const bounds = circle.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [45, 45] });
            }
        }
    }, [isSurroundingActive, surroundingBaseSchool, surroundingRadius, surroundingSchools]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedPlace) return;

        map.closePopup();
        
        if (!isBeneficiary) {
            // Open the popup on the left side
            L.popup({ 
                closeButton: false, 
                autoPan: true, 
                autoPanPaddingTop: 100,
                autoPanPaddingLeft: 50,
                offset: L.point(-170, 150) 
            })
                .setLatLng([selectedPlace.lat, selectedPlace.lng])
                .setContent(createPopupContent(selectedPlace))
                .openOn(map);
        }

        // Auto-center with offset when a school is selected
        // We move the map center such that the school is to the RIGHT and slightly DOWN
        // This makes room for the popup on the LEFT and ensures the header doesn't cover it
        const zoom = map.getZoom();
        const targetZoom = zoom > 15 ? zoom : 16;
        
        // Vertical offset (to push school down)
        const latOffset = 0.0005 / Math.pow(2, targetZoom - 13); 
        // Horizontal offset (to push school right, making room for popup on left)
        const lngOffset = -0.0025 / Math.pow(2, targetZoom - 13); 
        
        map.flyTo([selectedPlace.lat + latOffset, selectedPlace.lng + lngOffset], targetZoom, {
            duration: 1.5,
            easeLinearity: 0.25
        });
    }, [selectedPlace, isBeneficiary]);

    return (
        <div className="relative h-full w-full bg-gray-100 overflow-hidden">
            <style>{`
                .leaflet-popup {
                    scale: 1 !important;
                    transition: none !important;
                    margin-left: -20px !important; /* Slight nudge for better spacing */
                }
                .leaflet-popup-content-wrapper {
                    border-radius: 20px !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5) !important;
                    border: 1px solid rgba(255, 255, 255, 0.3) !important;
                    background: white !important;
                    width: 300px !important;
                }
                .leaflet-popup-content {
                    margin: 0 !important;
                    width: 300px !important;
                    min-width: 300px !important;
                }
                .leaflet-popup-tip-container {
                    display: none !important;
                }
                .custom-educational-popup {
                    width: 100% !important;
                    box-sizing: border-box !important;
                }
                /* Ensure Leaflet pan animation accounts for top header */
                .leaflet-container {
                    cursor: crosshair !important;
                }
            `}</style>
            {isLoading && (
                <div className="absolute inset-0 bg-white/75 z-[2000] flex items-center justify-center backdrop-blur-md">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-2xl shadow-2xl border border-primary-light/10 max-w-md w-full mx-4 text-center">
                        <div className="relative flex items-center justify-center">
                            <Loader2 className="h-14 w-14 animate-spin text-primary-medium" />
                            {loadingProgress !== null && (
                                <span className="absolute text-[11px] font-bold text-primary-dark">{loadingProgress}%</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                            <span className="text-lg font-bold text-primary-dark">
                                {loadingStage === 'loading_files' && 'جاري تحميل ملفات البيانات...'}
                                {loadingStage === 'processing_boundaries' && 'جاري معالجة الحدود الجغرافية...'}
                                {loadingStage === 'mapping_districts' && 'جاري ربط المواقع بالأحياء جغرافياً...'}
                                {loadingStage === 'calculating_metrics' && 'جاري حساب المؤشرات الجغرافية (المسافات والأعداد)...'}
                                {!loadingStage && 'جاري تحديث البيانات...'}
                            </span>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed">
                                {loadingStage === 'mapping_districts' && 'يتم الآن ربط وتصنيف كل موقع جغرافياً وفقاً للأحياء المرفوعة دون إبطاء المتصفح'}
                                {loadingStage === 'calculating_metrics' && 'يتم الآن حساب المسافات البينية للمدارس وتعدادها داخل كل حي مع الحفاظ على استجابة الصفحة بالكامل'}
                                {loadingStage !== 'mapping_districts' && loadingStage !== 'calculating_metrics' && 'يرجى الانتظار لحين تهيئة الخريطة التفاعلية'}
                            </p>
                        </div>
                        {loadingProgress !== null && (
                            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-1 border border-gray-200/50">
                                <div 
                                    className="bg-gradient-to-l from-primary-medium to-primary-light h-full rounded-full transition-all duration-300" 
                                    style={{ width: `${loadingProgress}%` }} 
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div ref={mapContainerRef} className="h-full w-full z-0" />
            <div className="absolute bottom-8 left-8 z-[1000] flex flex-col gap-3">
                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg flex border border-white/50">
                    <button onClick={() => setMapType('default')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${mapType === 'default' ? 'bg-primary-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}>خريطة</button>
                    <button onClick={() => setMapType('satellite')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${mapType === 'satellite' ? 'bg-primary-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}>قمر صناعي</button>
                </div>
            </div>
        </div>
    );
};
