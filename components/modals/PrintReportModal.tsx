import React, { useMemo } from 'react';
import { X, Printer, Info, FileText, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { EducationalPlace, FileMapping, User } from '../../types';
import { 
  getSchoolLevel, 
  getSchoolGender, 
  getPlaceGroup, 
  getPlaceGroupLabel 
} from '../../App';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  surroundingBaseSchool: EducationalPlace | null;
  surroundingSchools: EducationalPlace[];
  surroundingRadius: number;
  surroundingGender: string;
  surroundingLevel: string;
  fileMappings: Record<string, FileMapping>;
  currentUser: User | null;
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

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  surroundingBaseSchool,
  surroundingSchools,
  surroundingRadius,
  surroundingGender,
  surroundingLevel,
  fileMappings,
  currentUser,
}) => {
  if (!isOpen || !surroundingBaseSchool) return null;

  const baseGroup = getPlaceGroup(surroundingBaseSchool);
  const baseLabels = getPlaceGroupLabel(baseGroup);

  const handlePrint = () => {
    // Focus and call print
    window.focus();
    window.print();
  };

  const downloadPrintableHTML = () => {
    const title = `تقرير_المدارس_المحيطة_${surroundingBaseSchool.name.replace(/\s+/g, '_')}`;
    
    // Sort and calculate distances
    const sortedSchools = [...surroundingSchools]
      .map(s => ({ school: s, distance: getDistanceMeters(surroundingBaseSchool.lat, surroundingBaseSchool.lng, s.lat, s.lng) }))
      .sort((a, b) => a.distance - b.distance);

    const baseGroup = getPlaceGroup(surroundingBaseSchool);
    const baseLabels = getPlaceGroupLabel(baseGroup);

    // Build the table rows
    const rowsHTML = sortedSchools.map((item, idx) => {
      const s = item.school;
      const formattedDist = item.distance < 1000 ? `${Math.round(item.distance)} متر` : `${(item.distance / 1000).toFixed(2)} كم`;
      
      let extraCols = '';
      if (baseGroup === 'school' || baseGroup === 'program') {
        const level = getSchoolLevel(s, fileMappings) || 'غير محدد';
        const gender = getSchoolGender(s, fileMappings) || 'غير محدد';
        extraCols = `
          <td class="p-3 border-b border-gray-200">${level}</td>
          <td class="p-3 border-b border-gray-200">${gender}</td>
        `;
      }

      return `
        <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50/30 transition-colors">
          <td class="p-3 border-b border-gray-200 font-bold text-gray-500 text-center">${idx + 1}</td>
          <td class="p-3 border-b border-gray-200 font-bold text-gray-900">${s.name}</td>
          <td class="p-3 border-b border-gray-200 text-gray-700">${s.spatialDistrict || 'غير محدد'}</td>
          ${extraCols}
          <td class="p-3 border-b border-gray-200 font-bold text-indigo-700 text-left">${formattedDist}</td>
        </tr>
      `;
    }).join('');

    const extraHeaders = (baseGroup === 'school' || baseGroup === 'program') ? `
      <th class="p-3 text-right text-xs font-bold text-indigo-900 border-b-2 border-indigo-200">المرحلة</th>
      <th class="p-3 text-right text-xs font-bold text-indigo-900 border-b-2 border-indigo-200">الجنس</th>
    ` : '';

    const schoolLevelAndGenderInfo = (baseGroup === 'school' || baseGroup === 'program') ? `
      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <span class="block text-xs font-bold text-gray-400 mb-0.5">المرحلة الدراسية:</span>
        <span class="text-sm font-bold text-gray-900">${getSchoolLevel(surroundingBaseSchool, fileMappings) || 'غير محددة'}</span>
      </div>
      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <span class="block text-xs font-bold text-gray-400 mb-0.5">الجنس:</span>
        <span class="text-sm font-bold text-gray-900">${getSchoolGender(surroundingBaseSchool, fileMappings) || 'غير محدد'}</span>
      </div>
    ` : '';

    const filterCriteriaInfo = (baseGroup === 'school' || baseGroup === 'program') ? `
      <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
        <span class="block text-xs font-bold text-amber-600 mb-0.5">فلترة الجنس:</span>
        <span class="text-xs font-bold text-gray-900">${surroundingGender === 'all' ? 'الكل (بنين وبنات)' : surroundingGender}</span>
      </div>
      <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
        <span class="block text-xs font-bold text-amber-600 mb-0.5">فلترة المرحلة:</span>
        <span class="text-xs font-bold text-gray-900">${surroundingLevel === 'all' ? 'الكل (جميع المراحل)' : surroundingLevel}</span>
      </div>
    ` : `
      <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm col-span-2">
        <span class="block text-xs font-bold text-amber-600 mb-0.5">نوع الطبقة المحددة:</span>
        <span class="text-xs font-bold text-gray-900">${baseLabels.plural} الجغرافية</span>
      </div>
    `;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${surroundingBaseSchool.name} - تقرير النطاق الجغرافي</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;950&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Tajawal', sans-serif;
      background-color: #f9fafb;
    }
    @media print {
      body {
        background-color: #ffffff;
      }
      .no-print {
        display: none !important;
      }
      .print-shadow-none {
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body class="p-4 sm:p-8 text-gray-900">
  <!-- شريط أدوات الطباعة العلوي (مخفي أثناء الطباعة) -->
  <div class="max-w-4xl mx-auto mb-6 bg-indigo-900 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
    <div class="flex items-center gap-3">
      <div class="bg-white/10 p-2 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <h4 class="font-bold text-sm">نسخة الطباعة الفورية والمباشرة</h4>
        <p class="text-[11px] text-indigo-200">لقد قمت بتحميل نسخة تقرير مخصصة للطباعة بنجاح لتجاوز أي قيود في المتصفح.</p>
      </div>
    </div>
    <button onclick="window.print()" class="bg-amber-500 hover:bg-amber-600 text-indigo-950 font-bold px-6 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 shadow-md">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      اطبع التقرير الآن
    </button>
  </div>

  <!-- التقرير الفعلي للطباعة -->
  <div class="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl border border-gray-200 shadow-sm print-shadow-none">
    
    <!-- عنوان التقرير الفرعي -->
    <div class="text-center mb-8">
      <h2 class="text-base font-black text-indigo-950 inline-block bg-indigo-50 border border-indigo-100/80 px-8 py-2 rounded-xl shadow-sm">
        تقرير تحليل النطاق الجغرافي ومسح ${baseLabels.plural} المحيطة
      </h2>
    </div>

    <!-- بيانات العنصر الأساسي المستهدف -->
    <div class="bg-indigo-50/40 border border-indigo-100/80 rounded-xl p-6 mb-6">
      <h3 class="text-sm font-extrabold text-indigo-900 mb-4 border-r-4 border-indigo-700 pr-3">بيانات ${baseLabels.singular} المستهدف كمركز للنطاق</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-white p-3 rounded-lg border border-gray-200">
          <span class="block text-xs font-bold text-gray-400 mb-0.5">الاسم الكامل:</span>
          <span class="text-sm font-black text-gray-900">${surroundingBaseSchool.name}</span>
        </div>
        <div class="bg-white p-3 rounded-lg border border-gray-200">
          <span class="block text-xs font-bold text-gray-400 mb-0.5">الحي الجغرافي:</span>
          <span class="text-sm font-bold text-gray-900">${surroundingBaseSchool.spatialDistrict || 'خارج الحدود المعتمدة'}</span>
        </div>
        ${schoolLevelAndGenderInfo}
        <div class="bg-white p-3 rounded-lg border border-gray-200">
          <span class="block text-xs font-bold text-gray-400 mb-0.5">المحافظة:</span>
          <span class="text-sm font-bold text-gray-900">${surroundingBaseSchool.rawData['المحافظة'] || 'المدينة المنورة'}</span>
        </div>
        <div class="bg-white p-3 rounded-lg border border-gray-200">
          <span class="block text-xs font-bold text-gray-400 mb-0.5">الإحداثيات الجغرافية:</span>
          <span class="text-xs font-mono font-bold text-indigo-700">${surroundingBaseSchool.lat.toFixed(6)}, ${surroundingBaseSchool.lng.toFixed(6)}</span>
        </div>
      </div>
    </div>

    <!-- معايير المسح الجغرافي والفلترة -->
    <div class="bg-amber-50/40 border border-amber-100/80 rounded-xl p-5 mb-6">
      <h3 class="text-xs font-extrabold text-amber-800 mb-3 border-r-4 border-amber-500 pr-3">معايير المسح الجغرافي والفلترة المعتمدة</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
          <span class="block text-xs font-bold text-amber-600 mb-0.5">مسافة النطاق المحدد:</span>
          <span class="text-xs font-bold text-gray-900">${surroundingRadius < 1000 ? `${surroundingRadius} متر` : `${surroundingRadius / 1000} كم`}</span>
        </div>
        ${filterCriteriaInfo}
      </div>
    </div>

    <!-- إجمالي النتائج -->
    <div class="mb-6 flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 gap-3">
      <span class="text-xs font-bold text-gray-600">إجمالي ${baseLabels.plural} المجاورة والمحيطة المكتشفة تابعة للنطاق الجغرافي:</span>
      <span class="text-sm font-black text-indigo-700 bg-white border border-indigo-100 px-5 py-1.5 rounded-lg shadow-sm">
        ${surroundingSchools.length} ${baseLabels.singular}
      </span>
    </div>

    <!-- جدول التفاصيل -->
    <div>
      <h3 class="text-sm font-extrabold text-gray-800 mb-4 border-r-4 border-gray-600 pr-3">قائمة ${baseLabels.plural} المحيطة والمسافات الفاصلة (مرتبة بالأقرب جغرافياً)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-right border-collapse">
          <thead>
            <tr class="bg-indigo-950 text-white">
              <th class="p-3 text-center text-xs font-bold border-b border-indigo-950 w-12">#</th>
              <th class="p-3 text-right text-xs font-bold border-b border-indigo-950">اسم ${baseLabels.singular}</th>
              <th class="p-3 text-right text-xs font-bold border-b border-indigo-950">الحي</th>
              ${extraHeaders}
              <th class="p-3 text-left text-xs font-bold border-b border-indigo-950 w-32">المسافة المستقيمة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
            ${surroundingSchools.length === 0 ? `
              <tr>
                <td colspan="6" class="p-12 text-center text-gray-400 italic font-medium bg-white border border-gray-200">
                  لم يتم العثور على أي نتائج مطابقة للمعايير المحددة ضمن نطاق المسح الجغرافي.
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    </div>

  </div>

  <script>
    // تشغيل الطباعة التلقائية بمجرد فتح الملف للراحة وسهولة الاستخدام
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>
    `;

    // Download the file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${title}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <Card
        className="w-full max-w-4xl bg-gray-50 shadow-2xl relative flex flex-col my-8 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس النافذة */}
        <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2.5 text-indigo-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold">معاينة وطباعة التقرير الجغرافي</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* تنبيه إرشادي بخصوص بيئة الـ iFrame / المعاينة */}
        <div className="px-6 pt-4 shrink-0">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-indigo-950 text-xs flex gap-3 leading-relaxed">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1 text-indigo-900">💡 حل ذكي ومباشر لطباعة التقارير بنجاح:</p>
              <p className="leading-relaxed">
                لتجاوز قيود الحماية داخل نافذة المعاينة (iFrame)، قمنا بإتاحة خيار <span className="font-bold text-indigo-700">"تصدير وطباعة فورية (موصى به)"</span>. 
                سيقوم النظام بتحميل ملف التقرير بتنسيق مستقل يحافظ على التنسيقات والألوان ويدعم الخطوط العربية بنسبة 100%، ويفتح لك نافذة الطباعة تلقائياً بمجرد فتحه، دون الحاجة لفتح التطبيق في صفحة مستقلة.
              </p>
            </div>
          </div>
        </div>

        {/* محتوى المعاينة القابل للتمرير */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-3xl mx-auto text-right text-gray-900">
            {/* عنوان التقرير الفرعي */}
            <div className="text-center mb-8">
              <h2 className="text-base font-black text-indigo-950 inline-block bg-indigo-50 border border-indigo-100/80 px-8 py-2 rounded-xl shadow-sm">
                تقرير تحليل النطاق الجغرافي ومسح {baseLabels.plural} المحيطة
              </h2>
            </div>

            {/* بيانات العنصر الأساسي المستهدف */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-5 mb-5">
              <h3 className="text-sm font-bold text-indigo-900 mb-3 border-r-3 border-indigo-700 pr-2">بيانات {baseLabels.singular} المستهدف كمركز للنطاق</h3>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div><span className="font-bold text-gray-500">الاسم: </span><span className="text-gray-950 font-bold">{surroundingBaseSchool.name}</span></div>
                <div><span className="font-bold text-gray-500">الحي الجغرافي: </span><span className="text-gray-950 font-semibold">{surroundingBaseSchool.spatialDistrict || 'خارج الحدود المعتمدة'}</span></div>
                
                {(baseGroup === 'school' || baseGroup === 'program') && (
                  <>
                    <div><span className="font-bold text-gray-500">المرحلة الدراسية: </span><span className="text-gray-950 font-semibold">{getSchoolLevel(surroundingBaseSchool, fileMappings) || 'غير محددة'}</span></div>
                    <div><span className="font-bold text-gray-500">الجنس: </span><span className="text-gray-950 font-semibold">{getSchoolGender(surroundingBaseSchool, fileMappings) || 'غير محدد'}</span></div>
                  </>
                )}
                
                <div><span className="font-bold text-gray-500">المحافظة: </span><span className="text-gray-950 font-semibold">{surroundingBaseSchool.rawData['المحافظة'] || 'المدينة المنورة'}</span></div>
                <div><span className="font-bold text-gray-500">الإحداثيات الجغرافية: </span><span className="text-gray-950 font-mono">{surroundingBaseSchool.lat.toFixed(6)}, {surroundingBaseSchool.lng.toFixed(6)}</span></div>
              </div>
            </div>

            {/* معايير التصفية */}
            <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-4 mb-5">
              <h3 className="text-xs font-bold text-amber-800 mb-2 border-r-3 border-amber-500 pr-2">معايير المسح الجغرافي والفلترة المعتمدة</h3>
              <div className="grid grid-cols-3 gap-3 text-[11px] text-gray-700">
                <div className="bg-white p-2 rounded border border-amber-100/50"><span className="block text-gray-400">مسافة النطاق:</span> <span className="text-gray-950 font-bold">{surroundingRadius < 1000 ? `${surroundingRadius} متر` : `${surroundingRadius / 1000} كم`}</span></div>
                
                {(baseGroup === 'school' || baseGroup === 'program') ? (
                  <>
                    <div className="bg-white p-2 rounded border border-amber-100/50"><span className="block text-gray-400">فلترة الجنس:</span> <span className="text-gray-950 font-bold">{surroundingGender === 'all' ? 'الكل (بنين وبنات)' : surroundingGender}</span></div>
                    <div className="bg-white p-2 rounded border border-amber-100/50"><span className="block text-gray-400">فلترة المرحلة:</span> <span className="text-gray-950 font-bold">{surroundingLevel === 'all' ? 'الكل (جميع المراحل)' : surroundingLevel}</span></div>
                  </>
                ) : (
                  <div className="bg-white p-2 rounded border border-amber-100/50 col-span-2"><span className="block text-gray-400">نوع الطبقة المحددة:</span> <span className="text-gray-950 font-bold">{baseLabels.plural} الجغرافية</span></div>
                )}
              </div>
            </div>

            {/* إجمالي المكتشفات */}
            <div className="mb-5 flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs font-bold">
              <span className="text-gray-700">إجمالي {baseLabels.plural} المجاورة والمحيطة المكتشفة:</span>
              <span className="text-sm font-extrabold text-indigo-700 bg-white border border-indigo-100 px-4 py-1 rounded shadow-sm">{surroundingSchools.length} {baseLabels.singular}</span>
            </div>

            {/* جدول التفاصيل والمسافات */}
            <div>
              <h3 className="text-xs font-bold text-gray-800 mb-2.5 border-r-3 border-gray-700 pr-2">قائمة {baseLabels.plural} المحيطة والمسافات الفاصلة (مرتبة بالأقرب جغرافياً)</h3>
              <table className="w-full text-right border-collapse text-[11px]">
                <thead>
                  <tr className="bg-indigo-950 text-white font-bold border border-indigo-950">
                    <th className="p-2 border-l border-indigo-800">#</th>
                    <th className="p-2 border-l border-indigo-800">اسم {baseLabels.singular}</th>
                    <th className="p-2 border-l border-indigo-800">الحي</th>
                    
                    {(baseGroup === 'school' || baseGroup === 'program') && (
                      <>
                        <th className="p-2 border-l border-indigo-800">المرحلة</th>
                        <th className="p-2 border-l border-indigo-800">الجنس</th>
                      </>
                    )}
                    
                    <th className="p-2">المسافة المستقيمة</th>
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
                          <td className="p-2 border-l border-gray-200 font-bold">{idx + 1}</td>
                          <td className="p-2 border-l border-gray-200 font-bold text-gray-900">{s.name}</td>
                          <td className="p-2 border-l border-gray-200">{s.spatialDistrict || 'غير محدد'}</td>
                          
                          {(baseGroup === 'school' || baseGroup === 'program') && (
                            <>
                              <td className="p-2 border-l border-gray-200">{getSchoolLevel(s, fileMappings) || 'غير محدد'}</td>
                              <td className="p-2 border-l border-gray-200">{getSchoolGender(s, fileMappings) || 'غير محدد'}</td>
                            </>
                          )}
                          
                          <td className="p-2 font-bold text-indigo-700">{formattedDist}</td>
                        </tr>
                      );
                    })
                  }
                  {surroundingSchools.length === 0 && (
                    <tr>
                      <td colSpan={(baseGroup === 'school' || baseGroup === 'program') ? 6 : 4} className="p-8 text-center text-gray-400 italic font-medium bg-white border border-gray-200">
                        لم يتم العثور على أي نتائج مطابقة للمعايير المحددة ضمن هذا النطاق الجغرافي.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ذيل النافذة المحتوي على أزرار التحكم */}
        <div className="bg-gray-100 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 rounded-b-lg border-t border-gray-200 shrink-0">
          <Button
            onClick={downloadPrintableHTML}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-extrabold gap-2 shadow-lg transition-all"
          >
            <Download className="h-4 w-4" />
            تصدير وطباعة فورية (موصى به)
          </Button>
          <Button
            onClick={handlePrint}
            variant="secondary"
            className="w-full sm:w-auto bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة مباشرة (أداة المتصفح)
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            إلغاء المعاينة
          </Button>
        </div>
      </Card>
    </div>
  );
};
