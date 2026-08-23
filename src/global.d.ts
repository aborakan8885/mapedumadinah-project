import type * as GeoJSON from 'geojson';

declare global {
  interface Window {
    XLSX: any;
    JSZip: any;
    toGeoJSON: {
      kml: (xml: Document) => GeoJSON.FeatureCollection;
      gpx: (xml: Document) => GeoJSON.FeatureCollection;
    };
    L: any; // Leaflet
    jspdf: any;
    docx: any;
    PptxGenJS: any;
  }
}

export {};
