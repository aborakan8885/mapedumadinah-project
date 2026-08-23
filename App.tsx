
import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { MapCanvas } from './components/MapCanvas';
import { Sidebar } from './components/Sidebar';
import { AuthModal } from './components/modals/AuthModal';
import { LandingPortal } from './components/auth/LandingPortal';
import { ReportsPanel } from './components/ReportsPanel';
import { PrintReportModal } from './components/modals/PrintReportModal';
import type { EducationalPlace, FilterState, Category, User, FileMapping, SchoolFilters, EarlyChildhoodFilters, DisabilitySupportFilters, SpecialEducationFilters, LandFilters, ProjectFilters, BuildingFilters } from './types';
import { Search, Menu, SlidersHorizontal } from 'lucide-react';
import { getAllFiles, deleteFile, putFile, loadFileData } from './lib/db';
import { subscribeToFilesChanges } from './lib/supabase';
import AdminPanel from './components/admin/AdminPanel';
import type * as GeoJSON from 'geojson';
// Local-Only Mode: Removed Firebase Auth import


// --- SPATIAL ANALYSIS HELPERS ---

interface OptimizedPolygon {
    outerRing: [number, number][];
    outerBbox: [number, number, number, number];
    holes: {
        ring: [number, number][];
        bbox: [number, number, number, number];
    }[];
}

interface OptimizedGeometry {
    type: string;
    bbox: [number, number, number, number] | null;
    polygons: OptimizedPolygon[];
}

interface OptimizedFeature {
    feature: GeoJSON.Feature;
    optGeom: OptimizedGeometry | null;
}

function getRingBBox(ring: [number, number][]): [number, number, number, number] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        if (!p || p.length < 2) continue;
        const x = p[0];
        const y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
}

function collectPolygonsFromGeometry(
    geometry: GeoJSON.Geometry,
    polygons: OptimizedPolygon[],
    updateGlobalBBox: (bbox: [number, number, number, number]) => void
) {
    if (!geometry) return;
    
    if (geometry.type === 'Polygon') {
        const rings = geometry.coordinates as [number, number][][];
        if (rings.length > 0 && rings[0].length > 0) {
            const outerRing = rings[0];
            const outerBbox = getRingBBox(outerRing);
            updateGlobalBBox(outerBbox);
            
            const holes = rings.slice(1).map(h => {
                const hBbox = getRingBBox(h);
                return { ring: h, bbox: hBbox };
            });
            polygons.push({ outerRing, outerBbox, holes });
        }
    } else if (geometry.type === 'MultiPolygon') {
        const polyCoords = geometry.coordinates as [number, number][][][];
        for (const rings of polyCoords) {
            if (rings.length > 0 && rings[0].length > 0) {
                const outerRing = rings[0];
                const outerBbox = getRingBBox(outerRing);
                updateGlobalBBox(outerBbox);
                
                const holes = rings.slice(1).map(h => {
                    const hBbox = getRingBBox(h);
                    return { ring: h, bbox: hBbox };
                });
                polygons.push({ outerRing, outerBbox, holes });
            }
        }
    } else if (geometry.type === 'GeometryCollection') {
        const collection = geometry as GeoJSON.GeometryCollection;
        if (collection.geometries) {
            for (const geom of collection.geometries) {
                collectPolygonsFromGeometry(geom, polygons, updateGlobalBBox);
            }
        }
    }
}

function prepareOptimizedGeometry(geometry: GeoJSON.Geometry): OptimizedGeometry | null {
    if (!geometry) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polygons: OptimizedPolygon[] = [];
    
    const updateGlobalBBox = (bbox: [number, number, number, number]) => {
        if (bbox[0] < minX) minX = bbox[0];
        if (bbox[1] < minY) minY = bbox[1];
        if (bbox[2] > maxX) maxX = bbox[2];
        if (bbox[3] > maxY) maxY = bbox[3];
    };

    collectPolygonsFromGeometry(geometry, polygons, updateGlobalBBox);
    
    if (minX === Infinity || polygons.length === 0) return null;
    return {
        type: geometry.type,
        bbox: [minX, minY, maxX, maxY],
        polygons
    };
}

function isPointInRing(point: [number, number], ring: [number, number][]): boolean {
    const x = point[0]; const y = point[1];
    let isInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function isPointInOptimizedGeometry(point: [number, number], optGeom: OptimizedGeometry): boolean {
    const px = point[0];
    const py = point[1];
    
    if (optGeom.bbox) {
        const [minX, minY, maxX, maxY] = optGeom.bbox;
        if (px < minX || px > maxX || py < minY || py > maxY) {
            return false;
        }
    }
    
    for (const poly of optGeom.polygons) {
        const [pMinX, pMinY, pMaxX, pMaxY] = poly.outerBbox;
        if (px < pMinX || px > pMaxX || py < pMinY || py > pMaxY) {
            continue;
        }
        
        if (isPointInRing(point, poly.outerRing)) {
            let inHole = false;
            for (const hole of poly.holes) {
                const [hMinX, hMinY, hMaxX, hMaxY] = hole.bbox;
                if (px < hMinX || px > hMaxX || py < hMinY || py > hMaxY) {
                    continue;
                }
                if (isPointInRing(point, hole.ring)) {
                    inHole = true;
                    break;
                }
            }
            if (!inHole) return true;
        }
    }
    
    return false;
}

function isPointInGeometry(point: [number, number], geometry: GeoJSON.Geometry): boolean {
    if (!geometry || !geometry.coordinates) return false;
    switch (geometry.type) {
        case 'Polygon':
            const [outerRing, ...innerRings] = geometry.coordinates as [number, number][][];
            if (!isPointInRing(point, outerRing)) return false;
            for (const hole of innerRings) if (isPointInRing(point, hole)) return false;
            return true;
        case 'MultiPolygon':
            for (const polygon of geometry.coordinates as [number, number][][][]) {
                 const [outer, ...inners] = polygon;
                 if (isPointInRing(point, outer)) {
                     let inHole = false;
                     for (const hole of inners) if (isPointInRing(point, hole)) { inHole = true; break; }
                     if (!inHole) return true;
                 }
            }
            return false;
        default: return false;
    }
}

function getGeometryBBox(geometry: GeoJSON.Geometry): [number, number, number, number] | null {
    if (!geometry || !geometry.coordinates) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const processCoords = (coords: any) => {
        if (typeof coords[0] === 'number') {
            const x = coords[0];
            const y = coords[1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        } else if (Array.isArray(coords)) {
            for (let i = 0; i < coords.length; i++) {
                processCoords(coords[i]);
            }
        }
    };
    
    try {
        processCoords(geometry.coordinates);
        if (minX === Infinity) return null;
        return [minX, minY, maxX, maxY];
    } catch {
        return null;
    }
}

function isGenericDistrictName(val: string): boolean {
    if (!val) return true;
    const lower = val.trim().toLowerCase();
    if (lower === 'placemark' || lower === 'polygon' || lower === 'multipolygon' ||
        lower === 'untitled' || lower === 'layer' || lower === 'layer_1' ||
        lower === 'new feature' || lower === 'feature' || lower === 'shape' ||
        lower === 'element' || lower === 'kml' || lower === 'null' || lower === 'undefined' ||
        /^(polygon|placemark|layer|shape|feature|element)\s*\d*$/i.test(lower) ||
        /^\d+$/.test(lower)) {
        return true;
    }
    return false;
}

function parseHtmlDescriptionForDistrict(desc: string): string | null {
    if (!desc || typeof desc !== 'string') return null;
    try {
        const rowRegex = /<(?:td|th)[^>]*>(.*?)<\/(?:td|th)>\s*<(?:td|th)[^>]*>(.*?)<\/(?:td|th)>/gi;
        let match;
        while ((match = rowRegex.exec(desc)) !== null) {
            const key = match[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
            const val = match[2].replace(/<[^>]+>/g, '').trim();
            if (!val || val.startsWith('<')) continue;
            if (key.includes('district') || key.includes('حي') || key.includes('اسم') || key.includes('name') || key.includes('المركز')) {
                if (!isGenericDistrictName(val)) return val;
            }
        }
    } catch {
        // ignore
    }
    return null;
}

export function extractDistrictNameFromProperties(props: any): string {
    if (!props || typeof props !== 'object') return 'حي غير مسمى';
    const keys = Object.keys(props);
    if (keys.length === 0) return 'حي غير مسمى';

    // 1. Specific Arabic District / Neighborhood / Center / Area Keys
    const arKey = keys.find(k => {
        const lower = k.toLowerCase().trim();
        return lower === 'اسم_الحي' || lower === 'اسم الحي' || lower === 'الحي' || lower === 'حي' ||
               lower === 'اسم_المركز' || lower === 'اسم المركز' || lower === 'المركز' ||
               lower === 'اسم_المنطقة' || lower === 'اسم المنطقة' ||
               (lower.includes('حي') && !lower.includes('محيط')) || lower.includes('district');
    });
    if (arKey && props[arKey] && String(props[arKey]).trim()) {
        const val = String(props[arKey]).trim();
        if (!isGenericDistrictName(val)) return val;
    }

    // 2. Standard GIS / KML District Keys
    const gisKey = keys.find(k => {
        const u = k.toUpperCase().trim();
        return u === 'DISTRICTNA' || u === 'DIST_NAME' || u === 'DISTRICT_NA' || u === 'DISTRICT_NAME' || 
               u === 'DISTRICT_N' || u === 'DISTRICT' || u === 'DIST_NA' || u === 'NAME_AR' || u === 'NAME_EN' ||
               u === 'NEIGHBORHOOD' || u === 'SUBDISTRICT' || u === 'ADM4_AR' || u === 'ADM4_EN';
    });
    if (gisKey && props[gisKey] && String(props[gisKey]).trim()) {
        const val = String(props[gisKey]).trim();
        if (!isGenericDistrictName(val)) return val;
    }

    // 3. HTML table in description tag (ArcGIS/QGIS KMZ exports)
    if (props.description && typeof props.description === 'string' && props.description.includes('<')) {
        const htmlDistrict = parseHtmlDescriptionForDistrict(props.description);
        if (htmlDistrict) return htmlDistrict;
    }

    // 4. Name / Title / Label / Placemark Name
    const nameKey = keys.find(k => {
        const u = k.toUpperCase().trim();
        return u === 'NAME' || u === 'TITLE' || u === 'LABEL' || u === 'الاسم' || u === 'اسم';
    });
    if (nameKey && props[nameKey] && String(props[nameKey]).trim()) {
        const val = String(props[nameKey]).trim();
        if (!isGenericDistrictName(val)) return val;
    }

    // 5. Any non-HTML short string property that isn't generic
    for (const k of keys) {
        if (k.toLowerCase() === 'description' || k.toLowerCase().startsWith('style')) continue;
        const val = props[k];
        if (val && typeof val === 'string' && val.trim() && !val.trim().startsWith('<') && val.length < 100) {
            const trimmed = val.trim();
            if (!isGenericDistrictName(trimmed)) return trimmed;
        }
    }

    if (props.name && String(props.name).trim()) return String(props.name).trim();

    return 'حي غير مسمى';
}

function getElementsFromXML(parent: Document | Element, localName: string): Element[] {
    const list1 = Array.from(parent.getElementsByTagName(localName));
    if (list1.length > 0) return list1;
    const list2 = Array.from(parent.getElementsByTagNameNS('*', localName));
    if (list2.length > 0) return list2;
    const list3 = Array.from(parent.getElementsByTagName(`kml:${localName}`));
    return list3;
}

function parseKMLFallback(kmlText: string): GeoJSON.FeatureCollection | null {
    try {
        let clean = kmlText.replace(/^\uFEFF/, '').trim();
        const parser = new DOMParser();
        let xmlDoc = parser.parseFromString(clean, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            clean = clean.replace(/xmlns="[^"]*"/gi, '').replace(/<[a-z0-9]+:/gi, '<').replace(/<\/[a-z0-9]+:/gi, '</');
            xmlDoc = parser.parseFromString(clean, 'text/xml');
        }

        const placemarks = getElementsFromXML(xmlDoc, 'Placemark');
        const features: GeoJSON.Feature[] = [];

        const parseCoordString = (str: string): [number, number][] => {
            const result: [number, number][] = [];
            const tupleRegex = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
            let match;
            while ((match = tupleRegex.exec(str)) !== null) {
                const lng = parseFloat(match[1]);
                const lat = parseFloat(match[2]);
                if (!isNaN(lng) && !isNaN(lat)) {
                    result.push([lng, lat]);
                }
            }
            return result;
        };

        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const props: Record<string, any> = {};

            const nameEl = getElementsFromXML(pm, 'name')[0];
            if (nameEl && nameEl.textContent) props.name = nameEl.textContent.trim();

            const descEl = getElementsFromXML(pm, 'description')[0];
            if (descEl && descEl.textContent) props.description = descEl.textContent.trim();

            const simpleDatas = getElementsFromXML(pm, 'SimpleData');
            for (let j = 0; j < simpleDatas.length; j++) {
                const sd = simpleDatas[j];
                const key = sd.getAttribute('name');
                if (key && sd.textContent) props[key] = sd.textContent.trim();
            }
            const datas = getElementsFromXML(pm, 'Data');
            for (let j = 0; j < datas.length; j++) {
                const d = datas[j];
                const key = d.getAttribute('name');
                const valEl = getElementsFromXML(d, 'value')[0] || d;
                if (key && valEl.textContent) props[key] = valEl.textContent.trim();
            }

            const polygonEls = getElementsFromXML(pm, 'Polygon');
            if (polygonEls.length > 0) {
                const multiRings: [number, number][][][] = [];
                for (let p = 0; p < polygonEls.length; p++) {
                    const poly = polygonEls[p];
                    const rings: [number, number][][] = [];
                    const outer = getElementsFromXML(poly, 'outerBoundaryIs')[0];
                    if (outer) {
                        const coordEl = getElementsFromXML(outer, 'coordinates')[0];
                        if (coordEl && coordEl.textContent) {
                            const parsed = parseCoordString(coordEl.textContent);
                            if (parsed.length >= 3) rings.push(parsed);
                        }
                    }
                    const inners = getElementsFromXML(poly, 'innerBoundaryIs');
                    for (const inner of inners) {
                        const coordEl = getElementsFromXML(inner, 'coordinates')[0];
                        if (coordEl && coordEl.textContent) {
                            const parsed = parseCoordString(coordEl.textContent);
                            if (parsed.length >= 3) rings.push(parsed);
                        }
                    }
                    if (rings.length > 0) multiRings.push(rings);
                }

                if (multiRings.length === 1) {
                    features.push({
                        type: 'Feature',
                        properties: props,
                        geometry: { type: 'Polygon', coordinates: multiRings[0] }
                    });
                } else if (multiRings.length > 1) {
                    features.push({
                        type: 'Feature',
                        properties: props,
                        geometry: { type: 'MultiPolygon', coordinates: multiRings }
                    });
                }
                continue;
            }

            const lineEls = getElementsFromXML(pm, 'LineString');
            if (lineEls.length > 0) {
                const coordEl = getElementsFromXML(lineEls[0], 'coordinates')[0];
                if (coordEl && coordEl.textContent) {
                    const parsed = parseCoordString(coordEl.textContent);
                    if (parsed.length >= 2) {
                        features.push({
                            type: 'Feature',
                            properties: props,
                            geometry: { type: 'LineString', coordinates: parsed }
                        });
                    }
                }
                continue;
            }

            const pointEls = getElementsFromXML(pm, 'Point');
            if (pointEls.length > 0) {
                const coordEl = getElementsFromXML(pointEls[0], 'coordinates')[0];
                if (coordEl && coordEl.textContent) {
                    const parsed = parseCoordString(coordEl.textContent);
                    if (parsed.length >= 1) {
                        features.push({
                            type: 'Feature',
                            properties: props,
                            geometry: { type: 'Point', coordinates: parsed[0] }
                        });
                    }
                }
            }
        }

        if (features.length === 0) return null;
        return { type: 'FeatureCollection', features };
    } catch (err) {
        console.warn("Fallback KML parser error:", err);
        return null;
    }
}

function normalizeAndSanitizeGeoJSON(rawGeojson: any): GeoJSON.FeatureCollection | null {
    if (!rawGeojson) return null;
    let features: any[] = [];

    if (rawGeojson.type === 'FeatureCollection' && Array.isArray(rawGeojson.features)) {
        features = rawGeojson.features;
    } else if (rawGeojson.type === 'Feature') {
        features = [rawGeojson];
    } else if (Array.isArray(rawGeojson.features)) {
        features = rawGeojson.features;
    } else if (Array.isArray(rawGeojson)) {
        features = rawGeojson;
    } else if (rawGeojson.type && (rawGeojson.coordinates || rawGeojson.geometries)) {
        features = [{ type: 'Feature', properties: {}, geometry: rawGeojson }];
    } else {
        return null;
    }

    const sanitizedFeatures: GeoJSON.Feature[] = [];

    for (const rawFeat of features) {
        if (!rawFeat || typeof rawFeat !== 'object') continue;
        let geom = rawFeat.geometry || rawFeat;
        if (!geom || !geom.type) continue;

        const props = { ...(rawFeat.properties || {}) };
        props.name = extractDistrictNameFromProperties(props);

        // Handle GeometryCollection by unrolling
        if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
            for (const subGeom of geom.geometries) {
                const subFc = normalizeAndSanitizeGeoJSON({ type: 'Feature', properties: props, geometry: subGeom });
                if (subFc && subFc.features) {
                    sanitizedFeatures.push(...subFc.features);
                }
            }
            continue;
        }

        if (!geom.coordinates) continue;

        const sanitizeCoords = (coords: any): any => {
            if (!Array.isArray(coords) || coords.length === 0) return null;
            if (typeof coords[0] === 'number' || typeof coords[0] === 'string') {
                let x = typeof coords[0] === 'number' ? coords[0] : parseFloat(coords[0]);
                let y = typeof coords[1] === 'number' ? coords[1] : parseFloat(coords[1]);
                if (isNaN(x) || isNaN(y)) return null;

                // Auto-fix inverted coordinates for Saudi Arabia bounds (Lat ~ 15..33, Lng ~ 34..56)
                if (x >= 15 && x <= 33 && y >= 34 && y <= 56) {
                    const temp = x;
                    x = y;
                    y = temp;
                }

                return [x, y];
            }
            const filtered = coords.map(sanitizeCoords).filter((c: any) => c !== null);
            return filtered.length > 0 ? filtered : null;
        };

        const cleanCoords = sanitizeCoords(geom.coordinates);
        if (!cleanCoords || (Array.isArray(cleanCoords) && cleanCoords.length === 0)) continue;

        // Verify polygon ring validity
        if (geom.type === 'Polygon') {
            const rings = cleanCoords.filter((ring: any) => Array.isArray(ring) && ring.length >= 3);
            if (rings.length === 0) continue;
            sanitizedFeatures.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: rings } });
        } else if (geom.type === 'MultiPolygon') {
            const multiPolys = cleanCoords.map((poly: any) => Array.isArray(poly) ? poly.filter((ring: any) => Array.isArray(ring) && ring.length >= 3) : []).filter((poly: any) => poly.length > 0);
            if (multiPolys.length === 0) continue;
            sanitizedFeatures.push({ type: 'Feature', properties: props, geometry: { type: 'MultiPolygon', coordinates: multiPolys } });
        } else {
            sanitizedFeatures.push({
                type: 'Feature',
                properties: props,
                geometry: {
                    type: geom.type,
                    coordinates: cleanCoords
                }
            });
        }
    }

    if (sanitizedFeatures.length === 0) return null;

    return {
        type: 'FeatureCollection',
        features: sanitizedFeatures
    };
}

export function validateAndVerifyBoundaryGeometry(geojson: any): GeoJSON.FeatureCollection | null {
    if (!geojson || typeof geojson !== 'object') return null;

    let featuresInput: any[] = [];
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        featuresInput = geojson.features;
    } else if (geojson.type === 'Feature') {
        featuresInput = [geojson];
    } else if (Array.isArray(geojson.features)) {
        featuresInput = geojson.features;
    } else if (Array.isArray(geojson)) {
        featuresInput = geojson;
    } else {
        return null;
    }

    const verifiedFeatures: GeoJSON.Feature[] = [];

    const validateCoordPair = (pt: any): [number, number] | null => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        let lng = typeof pt[0] === 'number' ? pt[0] : parseFloat(pt[0]);
        let lat = typeof pt[1] === 'number' ? pt[1] : parseFloat(pt[1]);

        if (isNaN(lng) || isNaN(lat)) return null;

        // Auto-fix inverted coordinates (e.g. Lat ~ 15..33, Lng ~ 34..56 for Saudi Arabia)
        if (lng >= 15 && lng <= 33 && lat >= 34 && lat <= 56) {
            const tmp = lng;
            lng = lat;
            lat = tmp;
        }

        // Standard global coordinate validation bounds
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;

        return [lng, lat];
    };

    const sanitizeRings = (ring: any[]): [number, number][] => {
        if (!Array.isArray(ring)) return [];
        const pts: [number, number][] = [];
        for (const item of ring) {
            const validPt = validateCoordPair(item);
            if (validPt) pts.push(validPt);
        }
        if (pts.length < 3) return [];

        // Ensure closed polygon ring
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            pts.push([first[0], first[1]]);
        }
        return pts;
    };

    for (const feat of featuresInput) {
        if (!feat || typeof feat !== 'object') continue;
        const geom = feat.geometry || (feat.type && feat.coordinates ? feat : null);
        if (!geom || !geom.type) continue;

        const props = { ...(feat.properties || {}) };
        props.name = extractDistrictNameFromProperties(props);

        if (geom.type === 'Polygon') {
            if (!Array.isArray(geom.coordinates)) continue;
            const validRings: [number, number][][] = [];
            for (const ring of geom.coordinates) {
                const cleanRing = sanitizeRings(ring);
                if (cleanRing.length >= 4) validRings.push(cleanRing);
            }
            if (validRings.length > 0) {
                verifiedFeatures.push({
                    type: 'Feature',
                    properties: props,
                    geometry: { type: 'Polygon', coordinates: validRings }
                });
            }
        } else if (geom.type === 'MultiPolygon') {
            if (!Array.isArray(geom.coordinates)) continue;
            const validMultiPolys: [number, number][][][] = [];
            for (const poly of geom.coordinates) {
                if (!Array.isArray(poly)) continue;
                const polyRings: [number, number][][] = [];
                for (const ring of poly) {
                    const cleanRing = sanitizeRings(ring);
                    if (cleanRing.length >= 4) polyRings.push(cleanRing);
                }
                if (polyRings.length > 0) validMultiPolys.push(polyRings);
            }
            if (validMultiPolys.length > 0) {
                verifiedFeatures.push({
                    type: 'Feature',
                    properties: props,
                    geometry: { type: 'MultiPolygon', coordinates: validMultiPolys }
                });
            }
        } else if (geom.type === 'LineString') {
            if (!Array.isArray(geom.coordinates)) continue;
            const pts = geom.coordinates.map(validateCoordPair).filter((p): p is [number, number] => p !== null);
            if (pts.length >= 2) {
                verifiedFeatures.push({
                    type: 'Feature',
                    properties: props,
                    geometry: { type: 'LineString', coordinates: pts }
                });
            }
        } else if (geom.type === 'Point') {
            const pt = validateCoordPair(geom.coordinates);
            if (pt) {
                verifiedFeatures.push({
                    type: 'Feature',
                    properties: props,
                    geometry: { type: 'Point', coordinates: pt }
                });
            }
        }
    }

    if (verifiedFeatures.length === 0) return null;

    return {
        type: 'FeatureCollection',
        features: verifiedFeatures
    };
}

async function parseSpatialFile(file: FileMapping): Promise<GeoJSON.FeatureCollection | null> {
    if (!file || !file.fileContent) return null;
    try {
        const content = file.fileContent;
        const filenameLower = (file.filename || '').toLowerCase();
        const fileTypeLower = (file.fileType || '').toLowerCase();
        let rawGeojson: any = null;

        // 1. Direct GeoJSON or JSON content
        if (fileTypeLower === 'geojson' || fileTypeLower === 'json' || filenameLower.endsWith('.geojson') || filenameLower.endsWith('.json')) {
            if (typeof content === 'object' && content !== null && !(content instanceof ArrayBuffer)) {
                rawGeojson = content;
            } else if (typeof content === 'string') {
                try { rawGeojson = JSON.parse(content); } catch (e) {}
            } else if (content instanceof ArrayBuffer) {
                try {
                    const text = new TextDecoder('utf-8').decode(content);
                    rawGeojson = JSON.parse(text);
                } catch (e) {}
            }
        }

        // 2. KMZ (Zip archive containing KML)
        let kmlText: string | undefined;
        const isKmz = fileTypeLower === 'kmz' || filenameLower.endsWith('.kmz');

        if (!rawGeojson && isKmz && window.JSZip) {
            let buffer: ArrayBuffer | null = null;
            if (content instanceof ArrayBuffer) {
                buffer = content;
            } else if (content instanceof Uint8Array) {
                buffer = content.buffer as ArrayBuffer;
            } else if (typeof Blob !== 'undefined' && content instanceof Blob) {
                buffer = await content.arrayBuffer();
            } else if (typeof content === 'string') {
                try {
                    const encoder = new TextEncoder();
                    buffer = encoder.encode(content).buffer as ArrayBuffer;
                } catch (e) {}
            }

            if (buffer) {
                try {
                    const zip = await window.JSZip.loadAsync(buffer);
                    const kmlFile = Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith('.kml')) ||
                                    Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith('.xml'));
                    if (kmlFile) {
                        kmlText = await kmlFile.async('string');
                    }
                } catch (err) {
                    console.warn("JSZip failed to read KMZ file:", err);
                }
            }
        }

        // 3. KML string or buffer
        if (!rawGeojson && !kmlText) {
            if (typeof content === 'string') {
                kmlText = content;
            } else if (content instanceof ArrayBuffer) {
                kmlText = new TextDecoder('utf-8').decode(content);
            } else if (content instanceof Uint8Array) {
                kmlText = new TextDecoder('utf-8').decode(content);
            } else if (typeof Blob !== 'undefined' && content instanceof Blob) {
                kmlText = await content.text();
            }
        }

        // Check if kmlText is actually GeoJSON string
        if (!rawGeojson && kmlText) {
            const trimmed = kmlText.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    rawGeojson = JSON.parse(trimmed);
                } catch (e) {}
            }
        }

        // 4. Convert KML text to GeoJSON using toGeoJSON or Fallback
        if (!rawGeojson && kmlText) {
            if (window.toGeoJSON && window.toGeoJSON.kml) {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
                    const parsed = window.toGeoJSON.kml(xmlDoc);
                    if (parsed && Array.isArray(parsed.features) && parsed.features.length > 0) {
                        rawGeojson = parsed;
                    }
                } catch (e) {
                    console.warn("toGeoJSON.kml failed, trying fallback:", e);
                }
            }

            if (!rawGeojson) {
                rawGeojson = parseKMLFallback(kmlText);
            }
        }

        return normalizeAndSanitizeGeoJSON(rawGeojson);
    } catch (e) {
        console.error("Error parsing spatial file:", e);
        return null;
    }
}

export const getSchoolLevel = (p: EducationalPlace, m: Record<string, FileMapping>): string | null => {
    const mConfig = m[p.fileId]?.filterMappings;
    if (mConfig && mConfig.levelColumn) {
        for (const col of mConfig.levelColumn) {
            const val = p.rawData[col];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    // Fallback 1: Search keys
    for (const key of Object.keys(p.rawData)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('مرحلة') || lowerKey.includes('المرحلة') || lowerKey.includes('الدرجة') || lowerKey.includes('درجة') || lowerKey.includes('level')) {
            const val = p.rawData[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    // Fallback 2: Search values
    for (const val of Object.values(p.rawData)) {
        if (val !== null && val !== undefined) {
            const str = String(val).trim();
            if (str.includes('ابتدائي') || str.includes('إبتدائي') || str.includes('متوسط') || str.includes('ثانوي') || str.includes('رياض الأطفال')) {
                return str;
            }
        }
    }
    // Fallback 3: Search school name
    if (p.name) {
        if (p.name.includes('ابتدائ') || p.name.includes('إبتدائ')) return 'الابتدائية';
        if (p.name.includes('متوسط')) return 'المتوسطة';
        if (p.name.includes('ثانوي')) return 'الثانوية';
        if (p.name.includes('روض') || p.name.includes('أطفال') || p.name.includes('طفولة')) return 'رياض الأطفال';
    }
    return null;
};

export const getSchoolGender = (p: EducationalPlace, m: Record<string, FileMapping>): string | null => {
    const mConfig = m[p.fileId]?.filterMappings;
    if (mConfig && mConfig.genderColumn) {
        for (const col of mConfig.genderColumn) {
            const val = p.rawData[col];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    // Fallback 1: Search keys
    for (const key of Object.keys(p.rawData)) {
        if (key.includes('جنس') || key.includes('الجنس') || key.includes('نوع') || key.includes('بنين') || key.includes('بنات')) {
            const val = p.rawData[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    // Fallback 2: Search values
    for (const val of Object.values(p.rawData)) {
        if (val !== null && val !== undefined) {
            const str = String(val).trim();
            if (str === 'بنين' || str === 'بنات' || str === 'مشترك' || str === 'ذكور' || str === 'إناث' || str === 'بنين وبنات') {
                return str;
            }
        }
    }
    // Fallback 3: Search name
    if (p.name) {
        if (p.name.includes('بنين') || p.name.includes('أولاد') || p.name.includes('ذكور')) return 'بنين';
        if (p.name.includes('بنات') || p.name.includes('إناث')) return 'بنات';
        if (p.name.includes('مشترك') || p.name.includes('طفولة') || p.name.includes('أطفال')) return 'مشترك';
    }
    return null;
};

export const getSchoolGovernorate = (p: EducationalPlace, m: Record<string, FileMapping>): string | null => {
    const mConfig = m[p.fileId]?.filterMappings;
    if (mConfig && mConfig.governorateColumn) {
        for (const col of mConfig.governorateColumn) {
            const val = p.rawData[col];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    // Fallback: deep search in rawData keys with normalization
    const keys = Object.keys(p.rawData);
    for (const key of keys) {
        const normKey = normalizeArabic(key);
        if (normKey.includes(normalizeArabic('المحافظة')) || 
            normKey.includes(normalizeArabic('محافظة')) || 
            key.toLowerCase().includes('governorate')) {
            const val = p.rawData[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    return null;
};

export const getSchoolRegion = (p: EducationalPlace, m: Record<string, FileMapping>): string | null => {
    for (const key of Object.keys(p.rawData)) {
        if (key.includes('المنطقة') || key.includes('منطقة') || key.includes('المنطقه') || key.includes('منطقه')) {
            const val = p.rawData[key];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    return null;
};

export const getPlaceGroup = (p: EducationalPlace): 'school' | 'program' | 'land' | 'project' => {
    const filename = (p.filename || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    
    if (filename.includes('برنامج') || filename.includes('برامج') || name.includes('برنامج')) {
        return 'program';
    }
    if (filename.includes('ارض') || filename.includes('أرض') || filename.includes('اراضي') || filename.includes('أراضي') || name.includes('ارض') || name.includes('أرض')) {
        return 'land';
    }
    if (filename.includes('مشروع') || filename.includes('مشاريع') || name.includes('مشروع')) {
        return 'project';
    }
    return 'school';
};

export const getPlaceGroupLabel = (group: 'school' | 'program' | 'land' | 'project'): { singular: string; plural: string } => {
    switch (group) {
        case 'program':
            return { singular: 'برنامج', plural: 'البرامج' };
        case 'land':
            return { singular: 'أرض', plural: 'الأراضي' };
        case 'project':
            return { singular: 'مشروع', plural: 'المشاريع' };
        default:
            return { singular: 'مدرسة', plural: 'المدارس' };
    }
};

export const isExcludedSchoolType = (place: EducationalPlace): boolean => {
    // Exclude Private, National/Private, International, and Foreign schools
    // Mapped terms: المدارس الخاصة والأهلية والتعليم العالمي والتعليم الأجنبي
    const searchTerms = [
        'خاصة', 'خاصه', 'خاص',
        'أهلية', 'اهلية', 'أهلي', 'اهلي',
        'عالمية', 'عالميه', 'عالمي', 'التعليم العالمي',
        'أجنبية', 'اجنبية', 'أجنبي', 'اجنبي', 'التعليم الأجنبي', 'التعليم الاجنبي',
        'دولي', 'دولية', 'دوليه'
    ];
    
    // Check name
    const nameLower = (place.name || '').toLowerCase();
    for (const term of searchTerms) {
        if (nameLower.includes(term)) return true;
    }

    // Check raw data values
    if (place.rawData) {
        for (const val of Object.values(place.rawData)) {
            if (val !== null && val !== undefined) {
                const strVal = String(val).toLowerCase();
                for (const term of searchTerms) {
                    if (strVal.includes(term)) return true;
                }
            }
        }
    }

    return false;
};

const normalizationCache = new Map<string, string>();

export const normalizeArabic = (str: string): string => {
    if (!str) return '';
    const cached = normalizationCache.get(str);
    if (cached) return cached;

    const result = str
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    
    // Limit cache size to avoid memory leaks
    if (normalizationCache.size > 2000) normalizationCache.clear();
    normalizationCache.set(str, result);
    return result;
};

// --- FILTERING LOGIC (Shared) ---

const checkValue = (place: EducationalPlace, columns: string[] | undefined, filterValue: string) => {
    if (!columns || filterValue === 'all' || !filterValue) return true;
    const lowerFilter = filterValue.toLowerCase().trim();
    return columns.some(col => {
        const val = place.rawData[col];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerFilter);
    });
};

const checkRange = (place: EducationalPlace, column: string | undefined, min: string, max: string) => {
    if (!column) return true;
    const val = parseFloat(place.rawData[column]);
    if (isNaN(val)) return true;
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    if (!isNaN(minVal) && val < minVal) return false;
    if (!isNaN(maxVal) && val > maxVal) return false;
    return true;
};

const checkGovernorate = (place: EducationalPlace, mapping: FilterColumnMappings | undefined, govFilter: string, fileMappings: Record<string, FileMapping>) => {
    if (!govFilter || govFilter === 'all') return true;
    const lowerFilter = normalizeArabic(govFilter);

    // 1. Check mapped governorate columns
    if (mapping?.governorateColumn && mapping.governorateColumn.length > 0) {
        for (const col of mapping.governorateColumn) {
            const val = place.rawData[col];
            if (val !== null && val !== undefined) {
                if (normalizeArabic(String(val)).includes(lowerFilter)) return true;
            }
        }
    }

    // 2. Check getSchoolGovernorate helper
    const gov = getSchoolGovernorate(place, fileMappings);
    if (gov && normalizeArabic(gov).includes(lowerFilter)) return true;

    // 3. Fallback: search all rawData values
    for (const val of Object.values(place.rawData)) {
        if (val !== null && val !== undefined) {
            if (normalizeArabic(String(val)).includes(lowerFilter)) return true;
        }
    }

    // 4. Check place name or address
    if (place.name && normalizeArabic(place.name).includes(lowerFilter)) return true;
    if (place.address && normalizeArabic(place.address).includes(lowerFilter)) return true;

    return false;
};

const checkDistrict = (place: EducationalPlace, mapping: FilterColumnMappings | undefined, districtFilter: string) => {
    if (!districtFilter || districtFilter.trim() === '') return true;
    const lowerFilter = normalizeArabic(districtFilter);

    // 1. Check spatialDistrict
    if (place.spatialDistrict && normalizeArabic(place.spatialDistrict).includes(lowerFilter)) {
        return true;
    }

    // 2. Check mapped district columns
    if (mapping?.districtColumn && mapping.districtColumn.length > 0) {
        for (const col of mapping.districtColumn) {
            const val = place.rawData[col];
            if (val !== null && val !== undefined) {
                if (normalizeArabic(String(val)).includes(lowerFilter)) return true;
            }
        }
    }

    // 3. Fallback: search all rawData values
    for (const val of Object.values(place.rawData)) {
        if (val !== null && val !== undefined) {
            if (normalizeArabic(String(val)).includes(lowerFilter)) return true;
        }
    }

    // 4. Check place name or address
    if (place.name && normalizeArabic(place.name).includes(lowerFilter)) return true;
    if (place.address && normalizeArabic(place.address).includes(lowerFilter)) return true;

    return false;
};

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

const passesFilters = (place: EducationalPlace, category: string, filters: FilterState, fileMappings: Record<string, FileMapping>) => {
    // Strictly exclude Private, National/Private, International, and Foreign schools from map coordinates
    if (isExcludedSchoolType(place)) {
        return false;
    }

    const mapping = fileMappings[place.fileId]?.filterMappings;
    const f = filters[category as keyof FilterState];
    if (!f) return true;

    switch (category) {
        case 'schools':
            const sf = f as SchoolFilters;
            
            // 1. Level Filter
            if (sf.level && sf.level !== 'all') {
                if (!checkValue(place, mapping?.levelColumn, sf.level)) {
                    let found = false;
                    for (const val of Object.values(place.rawData)) {
                        if (val && normalizeArabic(String(val)).includes(normalizeArabic(sf.level))) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) return false;
                }
            }
            
            // 2. Governorate Filter
            if (sf.governorate && sf.governorate !== 'all') {
                if (!checkGovernorate(place, mapping, sf.governorate, fileMappings)) return false;
            }

            // 3. District Filter
            if (sf.district && sf.district.trim() !== '') {
                if (!checkDistrict(place, mapping, sf.district)) return false;
            }

            const metrics = place.spatialMetrics;
            if (!metrics) return true;

            // 4. Number of schools in district filter
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

            // 5. Distance between schools in district filter
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
                if (sf.distanceInDistrictPreset !== 'all') {
                    return false;
                }
            }

            return true;
        default: return true;
    }
};

const isOfDerivedType = (place: EducationalPlace, type: string, fileMappings: Record<string, FileMapping>) => {
    return false;
};

// --- 1. CONTEXT DEFINITION & HOOK ---

interface DataContextType {
    allPlaces: EducationalPlace[];
    fileMappings: Record<string, FileMapping>;
    isLoading: boolean;
    loadingStage: 'loading_files' | 'processing_boundaries' | 'mapping_districts' | 'calculating_metrics' | null;
    loadingProgress: number | null;
    loadMapData: () => Promise<void>;
    deleteFileAndUpdateState: (fileId: string) => Promise<void>;
    updateFileAndUpdateState: (updatedFile: FileMapping) => Promise<void>;
    setBoundaryLayerAndUpdateState: (fileId: string) => Promise<void>;
    boundaryGeojson: GeoJSON.FeatureCollection | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) throw new Error('useData must be used within a DataProvider');
    return context;
};

const processFiles = (files: FileMapping[]): { places: EducationalPlace[], mappings: Record<string, FileMapping> } => {
    const places: EducationalPlace[] = [];
    const mappings: Record<string, FileMapping> = {};
    for (const file of files) {
        mappings[file.id] = file;
        if (file.fileType === 'tabular' && file.data && file.latColumn && file.lngColumn && file.nameColumn) {
            file.data.forEach((row, index) => {
                const lat = parseFloat(String(row[file.latColumn!]).replace(',', '.'));
                const lng = parseFloat(String(row[file.lngColumn!]).replace(',', '.'));
                if (!isNaN(lat) && !isNaN(lng)) {
                    const place: EducationalPlace = {
                        id: `${file.id}-${index}`,
                        name: row[file.nameColumn!] || 'مكان بدون اسم',
                        category: file.category,
                        lat, lng,
                        rawData: row,
                        displayColumns: file.displayColumns || [],
                        fileId: file.id,
                        filename: file.filename,
                    };
                    
                    // Exclude Private, National, International, Foreign schools entirely
                    if (!isExcludedSchoolType(place)) {
                        places.push(place);
                    }
                }
            });
        }
    }
    return { places, mappings };
};

// --- 2. DATA PROVIDER COMPONENT ---

let cachedBoundaryKey: string | null = null;
let cachedBoundaryGeojson: GeoJSON.FeatureCollection | null = null;
let cachedOptimizedFeatures: OptimizedFeature[] | null = null;
let cachedSpatialDistricts: Record<string, string> = {};

async function mapPlacesSpatialDistrictsAsync(
    places: EducationalPlace[],
    optimizedFeatures: OptimizedFeature[],
    onProgress?: (progress: number) => void
): Promise<EducationalPlace[]> {
    const result: EducationalPlace[] = [];
    const chunkSize = 150; // تقسيم العمل إلى دفعات لمنع تجميد الصفحة وإبقاء الواجهة مستجيبة بالكامل
    
    for (let i = 0; i < places.length; i += chunkSize) {
        const chunk = places.slice(i, i + chunkSize);
        
        for (const place of chunk) {
            if (cachedSpatialDistricts[place.id]) {
                result.push({ ...place, spatialDistrict: cachedSpatialDistricts[place.id] });
                continue;
            }

            let districtName = 'خارج النطاق';
            const px = place.lng;
            const py = place.lat;
            
            for (const item of optimizedFeatures) {
                if (!item.optGeom) continue;
                if (isPointInOptimizedGeometry([px, py], item.optGeom)) {
                    const props = item.feature.properties || {};
                    districtName = extractDistrictNameFromProperties(props);
                    break;
                }
            }
            cachedSpatialDistricts[place.id] = districtName;
            result.push({ ...place, spatialDistrict: districtName });
        }
        
        if (onProgress) {
            onProgress(Math.min(100, Math.round(((i + chunk.length) / places.length) * 100)));
        }
        
        // إفساح المجال لمتصفح الإنترنت للرسم ومعالجة تفاعل المستخدم
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return result;
}

async function calculateSpatialMetricsAsync(
    places: EducationalPlace[],
    mappings: Record<string, FileMapping>,
    onProgress?: (progress: number) => void
): Promise<void> {
    const schools = places.filter(p => p.category === 'schools');
    if (schools.length === 0) return;

    const schoolsByDistrict: Record<string, EducationalPlace[]> = {};
    schools.forEach(s => {
        const dist = s.spatialDistrict || 'خارج النطاق';
        if (!schoolsByDistrict[dist]) schoolsByDistrict[dist] = [];
        schoolsByDistrict[dist].push(s);
    });

    const getSchoolLevel = (p: EducationalPlace, m: Record<string, FileMapping>) => {
        const mConfig = m[p.fileId]?.filterMappings;
        if (!mConfig || !mConfig.levelColumn) return null;
        for (const col of mConfig.levelColumn) {
            const val = p.rawData[col];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
        return null;
    };

    const schoolLevels = new Map<string, string | null>();
    schools.forEach(s => {
        schoolLevels.set(s.id, getSchoolLevel(s, mappings));
    });

    const schoolsByLevel: Record<string, EducationalPlace[]> = {};
    schools.forEach(s => {
        const lvl = schoolLevels.get(s.id);
        if (lvl) {
            if (!schoolsByLevel[lvl]) schoolsByLevel[lvl] = [];
            schoolsByLevel[lvl].push(s);
        }
    });

    const chunkSize = 150;
    for (let i = 0; i < schools.length; i += chunkSize) {
        const chunk = schools.slice(i, i + chunkSize);
        
        for (const p of chunk) {
            const dist = p.spatialDistrict || 'خارج النطاق';
            const distSchools = schoolsByDistrict[dist] || [];
            const districtSchoolCount = distSchools.length;

            let minDistanceInDistrict: number | null = null;
            let minD = Infinity;
            for (let j = 0; j < distSchools.length; j++) {
                const o = distSchools[j];
                if (o.id !== p.id) {
                    const d = getDistanceMeters(p.lat, p.lng, o.lat, o.lng);
                    if (d < minD) minD = d;
                }
            }
            if (minD !== Infinity) minDistanceInDistrict = minD;

            let minNeighborD = Infinity;
            const pLevel = schoolLevels.get(p.id);
            if (pLevel) {
                const levelSchools = schoolsByLevel[pLevel] || [];
                for (let j = 0; j < levelSchools.length; j++) {
                    const o = levelSchools[j];
                    const oDist = o.spatialDistrict || 'خارج النطاق';
                    if (oDist !== dist && o.id !== p.id) {
                        const d = getDistanceMeters(p.lat, p.lng, o.lat, o.lng);
                        if (d < minNeighborD) minNeighborD = d;
                    }
                }
            }
            const distanceToNearestNeighborDistrictOfSameLevel = minNeighborD !== Infinity ? minNeighborD : null;

            p.spatialMetrics = {
                districtSchoolCount,
                distanceToNearestInDistrict: minDistanceInDistrict,
                distanceToNearestNeighborDistrictOfSameLevel
            };
        }

        if (onProgress) {
            onProgress(Math.min(100, Math.round(((i + chunk.length) / schools.length) * 100)));
        }

        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [allPlaces, setAllPlaces] = useState<EducationalPlace[]>([]);
    const [fileMappings, setFileMappings] = useState<Record<string, FileMapping>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStage, setLoadingStage] = useState<'loading_files' | 'processing_boundaries' | 'mapping_districts' | 'calculating_metrics' | null>(null);
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
    const [boundaryGeojson, setBoundaryGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
    const isLoadingRef = useRef(false);

    const loadMapData = useCallback(async () => {
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;
        setIsLoading(true);
        setLoadingStage('loading_files');
        setLoadingProgress(null);
        
        // Clear spatial districts on every load to ensure fresh and correct coordinates calculation
        cachedSpatialDistricts = {};
        
        try {
            const files = await getAllFiles();
            
            // PRO-TREATMENT: Lazily load data for all files from remote storage in parallel
            // This avoids DB timeouts and huge JSONB column issues entirely.
            setLoadingStage('loading_files');
            await Promise.all(files.map(f => loadFileData(f)));
            
            let { places, mappings } = processFiles(files);
            let boundaryFile = Object.values(mappings).find(f => f.isBoundaryLayer);
            if (!boundaryFile) {
                boundaryFile = Object.values(mappings).find(f => f.fileType === 'kmz' || f.fileType === 'kml' || f.fileType === 'geojson' || f.fileType === 'json' || !!f.fileContent);
                if (boundaryFile) {
                    boundaryFile.isBoundaryLayer = true;
                    putFile({ ...boundaryFile, isBoundaryLayer: true }).catch(console.error);
                }
            }
            let activeGeojson: GeoJSON.FeatureCollection | null = null;
            
            if (boundaryFile) {
                setLoadingStage('processing_boundaries');
                const getContentSize = (content: any): number => {
                    if (!content) return 0;
                    if (typeof content === 'string') return content.length;
                    if (content instanceof ArrayBuffer) return content.byteLength;
                    if (content.byteLength !== undefined) return content.byteLength;
                    if (content.size !== undefined) return content.size;
                    return 0;
                };
                const bKey = boundaryFile.id + '-' + getContentSize(boundaryFile.fileContent);
                let geojson: GeoJSON.FeatureCollection | null = null;
                if (cachedBoundaryKey === bKey && cachedBoundaryGeojson) {
                    geojson = cachedBoundaryGeojson;
                } else {
                    const rawParsed = await parseSpatialFile(boundaryFile);
                    if (rawParsed) {
                        geojson = validateAndVerifyBoundaryGeometry(rawParsed);
                        if (geojson) {
                            cachedBoundaryKey = bKey;
                            cachedBoundaryGeojson = geojson;
                            cachedOptimizedFeatures = null;
                        }
                    }
                }

                if (geojson && Array.isArray(geojson.features) && geojson.features.length > 0) {
                    activeGeojson = {
                        type: 'FeatureCollection',
                        features: [...geojson.features]
                    };
                    if (!cachedOptimizedFeatures) {
                        cachedOptimizedFeatures = geojson.features.map(f => {
                            return {
                                feature: f,
                                optGeom: f.geometry ? prepareOptimizedGeometry(f.geometry) : null
                            };
                        });
                    }

                    setLoadingStage('mapping_districts');
                    places = await mapPlacesSpatialDistrictsAsync(places, cachedOptimizedFeatures, (progress) => {
                        setLoadingProgress(progress);
                    });

                    setLoadingStage('calculating_metrics');
                    await calculateSpatialMetricsAsync(places, mappings, (progress) => {
                        setLoadingProgress(progress);
                    });
                }
            }
            
            setBoundaryGeojson(activeGeojson ? { type: 'FeatureCollection', features: [...activeGeojson.features] } : null);
            setAllPlaces(places);
            setFileMappings(mappings);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setIsLoading(false); 
            setLoadingStage(null);
            setLoadingProgress(null);
            isLoadingRef.current = false;
        }
    }, []);

    useEffect(() => { 
        loadMapData(); 
        const unsubscribe = subscribeToFilesChanges(() => {
            loadMapData();
        });
        return () => {
            unsubscribe();
        };
    }, [loadMapData]);
    
    const clearBoundaryCaches = () => {
        cachedBoundaryKey = null;
        cachedBoundaryGeojson = null;
        cachedOptimizedFeatures = null;
        cachedSpatialDistricts = {};
    };

    const deleteFileAndUpdateState = async (id: string) => { 
        clearBoundaryCaches();
        await deleteFile(id); 
        await loadMapData(); 
    };

    const updateFileAndUpdateState = async (f: FileMapping) => { 
        clearBoundaryCaches();
        await putFile(f); 
        await loadMapData(); 
    };

    const setBoundaryLayerAndUpdateState = async (id: string) => {
        setIsLoading(true);
        clearBoundaryCaches();
        const files = await getAllFiles();
        await Promise.all(files.map(f => putFile({ ...f, isBoundaryLayer: f.id === id })));
        await loadMapData();
    };
    
    const value = useMemo(() => ({ 
        allPlaces, 
        fileMappings, 
        isLoading, 
        loadingStage,
        loadingProgress,
        loadMapData, 
        deleteFileAndUpdateState, 
        updateFileAndUpdateState, 
        setBoundaryLayerAndUpdateState,
        boundaryGeojson
    }), [allPlaces, fileMappings, isLoading, loadingStage, loadingProgress, loadMapData, boundaryGeojson]);
    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// --- 3. THE VISIBLE APP CONTENT ---

const initialFilters: FilterState = {
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
  },
};

function AppContent() {
  const [selectedPlace, setSelectedPlace] = useState<EducationalPlace | null>(null);
  const [mapType, setMapType] = useState<'default' | 'satellite'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [visibleCategories, setVisibleCategories] = useState<Set<Category | string>>(new Set(['schools', 'kmz']));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { const s = localStorage.getItem('educational_map_current_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isReportsPanelOpen, setIsReportsPanelOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    // Local bypass check based on storage
    const syncUser = () => {
      const savedUserStr = localStorage.getItem('educational_map_current_user');
      const bypass = localStorage.getItem('educational_map_bypass_secret');
      
      if (bypass === '1068575628') {
        const adminUser: User = {
          id: 'admin-local',
          name: 'مدير النظام (دخول محلي)',
          role: 'admin',
          userType: 'employee',
          workEntity: 'الإدارة العامة للتعليم',
          status: 'active',
          email: 'aborakan8885@gmail.com',
          permissions: {
            visibleLayers: ['schools', 'kmz'],
            canViewCoordinates: true,
            canExportReports: true,
            canUseSurroundingAnalysis: true
          }
        };
        setCurrentUser(adminUser);
        localStorage.setItem('educational_map_current_user', JSON.stringify(adminUser));
      } else if (savedUserStr) {
        try {
          setCurrentUser(JSON.parse(savedUserStr));
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };

    syncUser();
    // Listen for storage changes in case of cross-tab login/logout
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, []);

  const { allPlaces, fileMappings, isLoading: isDataLoading } = useData();

  // --- طبقة المدارس المحيطة ---
  const [isSurroundingActive, setIsSurroundingActive] = useState(false);
  const [surroundingBaseSchool, setSurroundingBaseSchool] = useState<EducationalPlace | null>(null);
  const [surroundingRadius, setSurroundingRadius] = useState<number>(2000); // meters
  const [surroundingGender, setSurroundingGender] = useState<string>('all');
  const [surroundingLevel, setSurroundingLevel] = useState<string>('all');
  const [surroundingRegion, setSurroundingRegion] = useState<string>('all');
  const [surroundingGovernorate, setSurroundingGovernorate] = useState<string>('all');

  const surroundingSchools = useMemo(() => {
    if (!isSurroundingActive || !surroundingBaseSchool) return [];
    const baseGroup = getPlaceGroup(surroundingBaseSchool);
    return allPlaces.filter(p => {
      if (p.id === surroundingBaseSchool.id) return false;
      if (p.category !== 'schools' && p.category !== 'school') return false;
      
      const pGroup = getPlaceGroup(p);
      if (pGroup !== baseGroup) return false;
      
      const distance = getDistanceMeters(surroundingBaseSchool.lat, surroundingBaseSchool.lng, p.lat, p.lng);
      if (distance > surroundingRadius) return false;
      
      // Removed strict governorate/region filtering for neighbors to allow seeing close schools across borders
      // but keeping gender and level filters as they are usually more relevant for educational planning
      
      if (surroundingGender !== 'all') {
        const g = getSchoolGender(p, fileMappings);
        if (!g) return false;
        const normG = normalizeArabic(g);
        const normFilter = normalizeArabic(surroundingGender);
        if (normFilter === 'بنين') {
          if (!normG.includes('بنين') && !normG.includes('اولاد') && !normG.includes('ذكور')) return false;
        } else if (normFilter === 'بنات') {
          if (!normG.includes('بنات') && !normG.includes('اناث')) return false;
        } else if (normFilter === 'مشترك') {
          if (!normG.includes('مشترك') && !normG.includes('طفوله') && !normG.includes('اطفال')) return false;
        } else {
          if (!normG.includes(normFilter)) return false;
        }
      }
      
      if (surroundingLevel !== 'all') {
        const lvl = getSchoolLevel(p, fileMappings);
        if (!lvl) return false;
        const normLvl = lvl.toLowerCase();
        const normFilter = surroundingLevel.toLowerCase();
        if (normFilter.includes('ابتدائي') || normFilter.includes('إبتدائي')) {
          if (!normLvl.includes('ابتدائ') && !normLvl.includes('إبتدائ') && !normLvl.includes('ابتدائي')) return false;
        } else if (normFilter.includes('متوسط')) {
          if (!normLvl.includes('متوسط')) return false;
        } else if (normFilter.includes('ثانوي')) {
          if (!normLvl.includes('ثانوي')) return false;
        } else if (normFilter.includes('أطفال') || normFilter.includes('اطفال')) {
          if (!normLvl.includes('طفل') && !normLvl.includes('أطفال') && !normLvl.includes('اطفال')) return false;
        } else {
          if (!normLvl.includes(normFilter)) return false;
        }
      }
      
      return true;
    });
  }, [isSurroundingActive, surroundingBaseSchool, surroundingRadius, surroundingGender, surroundingLevel, allPlaces, fileMappings]);

  const baseGroup = useMemo(() => {
    if (!surroundingBaseSchool) return 'school';
    return getPlaceGroup(surroundingBaseSchool);
  }, [surroundingBaseSchool]);

  const baseLabels = useMemo(() => {
    return getPlaceGroupLabel(baseGroup);
  }, [baseGroup]);

  // --- تصفية النقاط التي ستظهر على الخريطة ---
  const filteredPlaces = useMemo(() => {
    return allPlaces.filter(place => {
      // 1. فحص البحث النصي
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const inName = place.name.toLowerCase().includes(q);
        const inData = Object.values(place.rawData || {}).some(v => String(v).toLowerCase().includes(q));
        if (!inName && !inData) return false;
      }

      // 2. فحص الفئات والفلترة المتقدمة
      let isVisible = false;

      // الفئة الأساسية (إذا كان الملف مرفوعاً كأرض مثلاً)
      if (visibleCategories.has(place.category) && passesFilters(place, place.category, filters, fileMappings)) {
        isVisible = true;
      }

      // الفئات المشتقة (للمدارس التي تحتوي برامج معينة)
      if (place.category === 'school') {
        const derivedTypes = ['specialEducation'];
        for (const type of derivedTypes) {
          if (visibleCategories.has(type) && isOfDerivedType(place, type, fileMappings) && passesFilters(place, type, filters, fileMappings)) {
            isVisible = true;
            break;
          }
        }
      }

      return isVisible;
    });
  }, [allPlaces, visibleCategories, filters, fileMappings, searchQuery]);

  // في حالة تفعيل طبقة المدارس المحيطة واختيار مدرسة أساسية، نعرض المدرسة الأساسية والمدارس المحيطة فقط لتجنب التشتيت
  const mapPlacesToDisplay = useMemo(() => {
    // إذا كان هناك مدرسة أساسية مختارة، نعرضها هي وجيرانها فقط بغض النظر عن فلاتر المحافظة العامة
    // لضمان عدم اختفاء النقطة المركزية حتى لو كانت خارج المحافظة المحددة للفلترة
    if (isSurroundingActive && surroundingBaseSchool) {
      return [surroundingBaseSchool, ...surroundingSchools];
    }

    let baseSet = filteredPlaces;

    // تطبيق فلاتر النطاق الجغرافي على الكل إذا كان الوضع نشطاً ولم يتم اختيار مدرسة بعد
    if (isSurroundingActive) {
      baseSet = baseSet.filter(p => {
        if (surroundingRegion !== 'all') {
          const r = getSchoolRegion(p, fileMappings);
          if (!r || (!normalizeArabic(r).includes(normalizeArabic(surroundingRegion)) && !normalizeArabic(surroundingRegion).includes(normalizeArabic(r)))) return false;
        }
        if (surroundingGovernorate !== 'all') {
          const g = getSchoolGovernorate(p, fileMappings);
          if (!g || (!normalizeArabic(g).includes(normalizeArabic(surroundingGovernorate)) && !normalizeArabic(surroundingGovernorate).includes(normalizeArabic(g)))) return false;
        }
        return true;
      });
    }
    
    return isSurroundingActive ? baseSet : filteredPlaces;
  }, [isSurroundingActive, surroundingBaseSchool, surroundingSchools, filteredPlaces, surroundingRegion, surroundingGovernorate, fileMappings]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return;
      (e.target as HTMLInputElement).blur();
      const match = filteredPlaces.find(p => p.name.toLowerCase().includes(q)) || filteredPlaces.find(p => Object.values(p.rawData).some(v => String(v).toLowerCase().includes(q)));
      if (match) setSelectedPlace(match);
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    try {
      // Local-Only: Just clear storage and reload
      localStorage.removeItem('educational_map_bypass_secret');
      localStorage.removeItem('educational_map_current_user');
      window.location.reload();
      localStorage.removeItem('educational_map_current_user');
    } catch (e) {
      console.error("Failed to remove user from storage", e);
    }
  };

  if (!currentUser) {
    return (
      <LandingPortal
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          try {
            localStorage.setItem('educational_map_current_user', JSON.stringify(u));
          } catch (e) {
            console.error("Failed to save user", e);
          }
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background font-sans print:h-auto print:w-auto" dir="rtl">
      {/* إخفاء عناصر الـ UI العادية أثناء الطباعة باستخدام print:hidden من تايلوند */}
      <div className="print:hidden h-full w-full flex flex-col">
        <Header user={currentUser} onLoginClick={() => setAuthModalOpen(true)} onLogoutClick={handleLogout} onAdminPanelClick={() => setIsAdminPanelOpen(true)} />
        <main className="flex-1 flex overflow-hidden relative">
          <Sidebar 
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
            filters={filters} 
            setFilters={setFilters} 
            visibleCategories={visibleCategories} 
            setVisibleCategories={setVisibleCategories} 
            onReportsClick={() => setIsReportsPanelOpen(true)}
            onPrintReportClick={() => setIsPrintModalOpen(true)}
            isSurroundingActive={isSurroundingActive}
            setIsSurroundingActive={setIsSurroundingActive}
            surroundingBaseSchool={surroundingBaseSchool}
            setSurroundingBaseSchool={setSurroundingBaseSchool}
            surroundingRadius={surroundingRadius}
            setSurroundingRadius={setSurroundingRadius}
            surroundingGender={surroundingGender}
            setSurroundingGender={setSurroundingGender}
            surroundingLevel={surroundingLevel}
            setSurroundingLevel={setSurroundingLevel}
            surroundingRegion={surroundingRegion}
            setSurroundingRegion={setSurroundingRegion}
            surroundingGovernorate={surroundingGovernorate}
            setSurroundingGovernorate={setSurroundingGovernorate}
            surroundingSchools={surroundingSchools}
            currentUser={currentUser}
          />
          <div className="flex-1 flex flex-col h-full relative z-0">
              {/* زر عائم مخصص لإعادة إظهار شريط الأدوات عند إخفائه */}
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)} 
                  className="absolute top-20 right-4 z-[1001] pointer-events-auto bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg shadow-2xl transition-all duration-300 flex items-center gap-2 hover:scale-105 border border-emerald-500/40 active:scale-95"
                  title="عرض شريط الأدوات"
                >
                  <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-black">عرض شريط الأدوات</span>
                </button>
              )}
              <div className="absolute top-3 right-4 z-[1000] w-72 sm:w-96 pointer-events-auto">
                <div className="relative w-full">
                  <input 
                    type="text" 
                    placeholder="ابحث عن اسم المدرسة..." 
                    value={searchQuery} 
                    onKeyDown={handleSearchSubmit} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-primary-light bg-white/95 backdrop-blur-sm text-xs font-bold text-slate-900 placeholder:text-slate-500" 
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                </div>
              </div>
            <MapCanvas 
              mapType={mapType} 
              setMapType={setMapType} 
              selectedPlace={selectedPlace} 
              onSelectPlace={setSelectedPlace} 
              searchQuery={searchQuery} 
              filters={filters} 
              visibleCategories={visibleCategories} 
              allPlaces={mapPlacesToDisplay} 
              fileMappings={fileMappings} 
              isLoading={isDataLoading} 
              isSurroundingActive={isSurroundingActive}
              surroundingBaseSchool={surroundingBaseSchool}
              setSurroundingBaseSchool={setSurroundingBaseSchool}
              surroundingRadius={surroundingRadius}
              surroundingGender={surroundingGender}
              surroundingLevel={surroundingLevel}
              surroundingRegion={surroundingRegion}
              surroundingGovernorate={surroundingGovernorate}
              surroundingSchools={surroundingSchools}
              currentUser={currentUser}
            />
          </div>
        </main>
        {isAuthModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} onLoginSuccess={(u) => { setCurrentUser(u); setAuthModalOpen(false); }} />}
        {isAdminPanelOpen && (
          <AdminPanel 
            onClose={() => setIsAdminPanelOpen(false)} 
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {isReportsPanelOpen && <ReportsPanel onClose={() => setIsReportsPanelOpen(false)} allPlaces={allPlaces} fileMappings={fileMappings} visibleCategories={visibleCategories} filters={filters} />}
        {isPrintModalOpen && (
          <PrintReportModal 
            isOpen={isPrintModalOpen} 
            onClose={() => setIsPrintModalOpen(false)} 
            surroundingBaseSchool={surroundingBaseSchool} 
            surroundingSchools={surroundingSchools} 
            surroundingRadius={surroundingRadius} 
            surroundingGender={surroundingGender} 
            surroundingLevel={surroundingLevel} 
            fileMappings={fileMappings} 
            currentUser={currentUser}
          />
        )}
      </div>

      {/* تقرير الطباعة الاحترافي للقبول والمدارس المحيطة */}
      {isSurroundingActive && surroundingBaseSchool && (
        <div className="hidden print:block bg-white text-gray-950 p-10 w-full max-w-4xl mx-auto" dir="rtl" style={{ fontFamily: "'Tajawal', system-ui, sans-serif" }}>
          <style>{`
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              .print\\:hidden {
                display: none !important;
              }
              .print\\:block {
                display: block !important;
              }
            }
          `}</style>
          
          {/* عنوان التقرير الفرعي */}
          <div className="text-center mb-8">
            <h2 className="text-base font-black text-indigo-950 inline-block bg-indigo-50 border border-indigo-100/80 px-8 py-2 rounded-xl shadow-sm">
              تقرير تحليل النطاق الجغرافي ومسح {baseLabels.plural} المحيطة
            </h2>
          </div>

          {/* بيانات المدرسة المستهدفة */}
          <div className="bg-indigo-50/70 border-2 border-indigo-100 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-indigo-900 mb-4 border-r-4 border-indigo-700 pr-3">بيانات {baseLabels.singular} المستهدف كمركز للنطاق</h2>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 text-sm">
              <div><span className="font-bold text-gray-500">اسم {baseLabels.singular}: </span><span className="text-gray-950 font-bold text-base">{surroundingBaseSchool.name}</span></div>
              <div><span className="font-bold text-gray-500">الحي الجغرافي: </span><span className="text-gray-950 font-semibold">{surroundingBaseSchool.spatialDistrict || 'خارج الحدود المعتمدة'}</span></div>
              
              {(baseGroup === 'school' || baseGroup === 'program') && (
                <>
                  <div><span className="font-bold text-gray-500">المرحلة الدراسية: </span><span className="text-gray-950 font-semibold">{getSchoolLevel(surroundingBaseSchool, fileMappings) || 'غير محددة بالملف'}</span></div>
                  <div><span className="font-bold text-gray-500">الجنس: </span><span className="text-gray-950 font-semibold">{getSchoolGender(surroundingBaseSchool, fileMappings) || 'غير محدد بالملف'}</span></div>
                </>
              )}
              
              <div><span className="font-bold text-gray-500">المحافظة: </span><span className="text-gray-950 font-semibold">{surroundingBaseSchool.rawData['المحافظة'] || 'المدينة المنورة'}</span></div>
              <div><span className="font-bold text-gray-500">الإحداثيات الجغرافية: </span><span className="text-gray-950 font-mono text-xs">{surroundingBaseSchool.lat.toFixed(6)}, {surroundingBaseSchool.lng.toFixed(6)}</span></div>
            </div>
          </div>

          {/* معايير التصفية */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 mb-6">
            <h2 className="text-base font-bold text-amber-800 mb-3 border-r-4 border-amber-500 pr-3">معايير المسح الجغرافي والفلترة</h2>
            <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-gray-700">
              <div className="bg-white p-2.5 rounded border border-amber-100"><span className="block text-gray-400 mb-0.5">نطاق المسافة المعتمد:</span> <span className="text-gray-950 font-bold">{surroundingRadius < 1000 ? `${surroundingRadius} متر` : `${surroundingRadius / 1000} كم`}</span></div>
              
              {(baseGroup === 'school' || baseGroup === 'program') ? (
                <>
                  <div className="bg-white p-2.5 rounded border border-amber-100"><span className="block text-gray-400 mb-0.5">فلترة جنس المدرسة:</span> <span className="text-gray-950 font-bold">{surroundingGender === 'all' ? 'الكل (بنين وبنات)' : surroundingGender}</span></div>
                  <div className="bg-white p-2.5 rounded border border-amber-100"><span className="block text-gray-400 mb-0.5">فلترة مرحلة المدرسة:</span> <span className="text-gray-950 font-bold">{surroundingLevel === 'all' ? 'الكل (جميع المراحل)' : surroundingLevel}</span></div>
                </>
              ) : (
                <div className="bg-white p-2.5 rounded border border-amber-100 col-span-2"><span className="block text-gray-400 mb-0.5">نوع الطبقة المحددة:</span> <span className="text-gray-950 font-bold">{baseLabels.plural} الجغرافية</span></div>
              )}
            </div>
          </div>

          {/* الإحصائيات الفورية */}
          <div className="mb-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
            <span className="text-base font-bold text-gray-700">إجمالي {baseLabels.plural} المجاورة والمحيطة المكتشفة:</span>
            <span className="text-xl font-black text-indigo-700 bg-white border-2 border-indigo-100 px-5 py-1.5 rounded-lg shadow-sm">{surroundingSchools.length} {baseLabels.singular}</span>
          </div>

          {/* جدول التفاصيل والمسافات */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3 border-r-4 border-gray-700 pr-3">قائمة {baseLabels.plural} المحيطة والمسافات الفاصلة (مرتبة بالأقرب جغرافياً)</h2>
            <div className="ds-table-container">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-indigo-950 text-white font-bold border border-indigo-950">
                    <th className="p-3 border-l border-indigo-800">#</th>
                    <th className="p-3 border-l border-indigo-800">اسم {baseLabels.singular}</th>
                    <th className="p-3 border-l border-indigo-800">الحي</th>
                    
                    {(baseGroup === 'school' || baseGroup === 'program') && (
                      <>
                        <th className="p-3 border-l border-indigo-800">المرحلة</th>
                        <th className="p-3 border-l border-indigo-800">الجنس</th>
                      </>
                    )}
                    
                    <th className="p-3">المسافة المستقيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {surroundingSchools
                    .map(s => ({ school: s, distance: getDistanceMeters(surroundingBaseSchool.lat, surroundingBaseSchool.lng, s.lat, s.lng) }))
                    .sort((a, b) => a.distance - b.distance)
                    .map((item, idx) => {
                      const s = item.school;
                      const formattedDist = item.distance < 1000 ? `${Math.round(item.distance)} متر` : `${(item.distance / 1000).toFixed(2)} كم`;
                      return (
                        <tr key={s.id} className={`border border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="p-3 border-l border-gray-200 font-bold">{idx + 1}</td>
                          <td className="p-3 border-l border-gray-200 font-bold text-gray-900">{s.name}</td>
                          <td className="p-3 border-l border-gray-200">{s.spatialDistrict || 'غير محدد'}</td>
                          
                          {(baseGroup === 'school' || baseGroup === 'program') && (
                            <>
                              <td className="p-3 border-l border-gray-200">{getSchoolLevel(s, fileMappings) || 'غير محدد'}</td>
                              <td className="p-3 border-l border-gray-200">{getSchoolGender(s, fileMappings) || 'غير محدد'}</td>
                            </>
                          )}
                          
                          <td className="p-3 font-extrabold text-indigo-700 text-sm">{formattedDist}</td>
                        </tr>
                      );
                    })
                  }
                  {surroundingSchools.length === 0 && (
                    <tr>
                      <td colSpan={(baseGroup === 'school' || baseGroup === 'program') ? 6 : 4} className="p-10 text-center text-gray-400 italic font-medium bg-white border border-gray-200">
                        لم يتم العثور على أي نتائج مطابقة للمعايير المحددة ضمن هذا النطاق الدائري.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() { 
  return <DataProvider><AppContent /></DataProvider>; 
}
