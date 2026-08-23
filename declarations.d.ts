
// This file provides type declarations for globally available libraries.
// It resolves TypeScript errors for libraries loaded via <script> tags in index.html.

// FIX: Import base Leaflet types to make them available for augmentation.
import 'leaflet';
// FIX: Add all required Leaflet types to fix type errors in MapCanvas.
import type {
  DivIcon,
  Icon,
  Layer,
  LatLngBounds,
  MapOptions,
  TileLayerOptions,
  DivIconOptions,
  LatLngExpression,
  MarkerOptions,
  GeoJSONOptions,
  Control,
  GeoJSON as GeoJSONType,
  Point
} from 'leaflet';

declare global {
  // Augment the L (Leaflet) namespace
  namespace L {
    // Re-exporting types to be available under L namespace e.g. L.Map
    type Map = import('leaflet').Map;
    type TileLayer = import('leaflet').TileLayer;
    type Marker = import('leaflet').Marker;
    type FeatureGroup = import('leaflet').FeatureGroup;

    // Define core leaflet functions that are used
    function map(id: string | HTMLElement, options?: MapOptions): L.Map;
    function tileLayer(urlTemplate: string, options?: TileLayerOptions): L.TileLayer;
    function divIcon(options: DivIconOptions): DivIcon;
    function marker(latlng: LatLngExpression, options?: MarkerOptions): L.Marker;
    function geoJSON(geojson?: any, options?: GeoJSONOptions): GeoJSONType;
    // FIX: Added missing point factory function to resolve type errors in MapCanvas.tsx.
    function point(x: number, y: number, round?: boolean): Point;
    
    // Define control namespace and its functions
    const control: Control.Static;

    // Define DomEvent
    const DomEvent: typeof import('leaflet').DomEvent;

    // Define the markercluster plugin's main function and class
    function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;

    interface MarkerClusterGroupOptions {
      iconCreateFunction?: (cluster: MarkerCluster) => DivIcon | Icon;
      // Other leaflet.markercluster options can be added here
      // FIX: Added missing properties to resolve type error in MapCanvas.tsx
      showCoverageOnHover?: boolean;
      maxClusterRadius?: number;
      // FIX: Added missing properties to satisfy usage in MapCanvas.tsx
      spiderfyOnMaxZoom?: boolean;
      disableClusteringAtZoom?: number;
      // FIX: Added missing 'animate' property to resolve type error in MapCanvas.tsx.
      animate?: boolean;
      // FIX: Added missing 'spiderfyDistanceMultiplier' property to resolve type error in MapCanvas.tsx.
      spiderfyDistanceMultiplier?: number;
    }

    interface MarkerCluster extends L.Marker {
      getChildCount(): number;
      getAllChildMarkers(): L.Marker[];
    }

    interface MarkerClusterGroup extends L.FeatureGroup {
      addLayer(layer: Layer): this;
      removeLayer(layer: Layer): this;
      addLayers(layers: Layer[]): this;
      removeLayers(layers: Layer[]): this;
      clearLayers(): this;
      getBounds(): LatLngBounds;
      zoomToShowLayer(layer: Layer, callback?: () => void): void;
      getChildCount(): number;
      getAllChildMarkers(): L.Marker[];
      hasLayer(layer: Layer): boolean;
      getLayers(): Layer[];
    }
  }

  // FIX: Add minimal GeoJSON type definitions for to-GeoJSON library.
  namespace GeoJSON {
    interface GeoJsonObject {
      type: string;
      bbox?: number[];
    }
    // FIX: Add Geometry interface to resolve type error in App.tsx.
    interface Geometry extends GeoJsonObject {
      type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' | 'GeometryCollection';
      coordinates: any;
    }
    interface FeatureCollection<G = Geometry, P = any> extends GeoJsonObject {
      type: "FeatureCollection";
      features: Feature<G, P>[];
    }
    interface Feature<G = Geometry, P = any> extends GeoJsonObject {
      type: "Feature";
      geometry: G;
      properties: P;
    }
  }

  // --- JSZip ---
  interface JSZipObject {
    name: string;
    dir: boolean;
    date: Date;
    comment: string | null;
    unixPermissions: number | string | null;
    dosPermissions: number | null;
    async(type: 'string'): Promise<string>;
    async(type: 'base64'): Promise<string>;
    async(type: 'binarystring'): Promise<string>;
    async(type: 'array'): Promise<number[]>;
    async(type: 'uint8array'): Promise<Uint8Array>;
    async(type: 'arraybuffer'): Promise<ArrayBuffer>;
    async(type: 'blob'): Promise<Blob>;
    // nodebuffer type is omitted for browser environment
  }

  interface JSZip {
    files: { [key: string]: JSZipObject };
    loadAsync(data: any, options?: any): Promise<JSZip>;
  }

  // --- togeojson ---
  interface ToGeoJSON {
    kml(doc: Document | Element): GeoJSON.FeatureCollection;
  }

  // --- SheetJS/xlsx ---
  // FIX: Add missing properties to XLSX type definition to support report generation.
  interface XLSX {
    read(data: any, opts: any): any;
    utils: {
      sheet_to_json(worksheet: any, opts?: any): any[];
      json_to_sheet(data: any[], opts?: any): any;
      book_new(): any;
      book_append_sheet(workbook: any, worksheet: any, sheetName: string): void;
    };
    writeFile(workbook: any, filename: string, opts?: any): void;
  }

  // Augment the global Window interface
  interface Window {
    JSZip: {
      loadAsync(data: any, options?: any): Promise<JSZip>;
    };
    toGeoJSON: ToGeoJSON;
    XLSX: XLSX;
  }
}

// This export statement is required to make this file a module and allow global augmentation.
export {};
