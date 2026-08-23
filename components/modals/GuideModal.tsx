import React from 'react';
import { X, HelpCircle, Info, Map as MapIcon, Target, Users, BookOpen, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: <Target className="h-5 w-5 text-orange-500" />,
      title: "تفعيل النطاق الجغرافي",
      desc: "من شريط الأدوات، قم بتفعيل أيقونة تفعيل النطاق الجغرافي لتظهر لك خيارات التصفية."
    },
    {
      icon: <MapIcon className="h-5 w-5 text-[#4d90a5]" />,
      title: "المحافظة",
      desc: "عند اختيار المحافظة، تظهر قائمة منسدلة تمكنك من إخفاء الإحداثيات العامة وإظهار إحداثيات اختيارك فقط."
    },
    {
      icon: <HelpCircle className="h-5 w-5 text-[#4d90a5]" />,
      title: "المدرسة الأساسية (المستهدفة)",
      desc: "ابدأ بكتابة اسم المدرسة وسيتم فلترة النتائج فوراً. بمجرد الاختيار، ستختفي بقية المدارس وتظهر المدرسة المستهدفة بلون مميز محاطة بدائرة برتقالية وامضة مع حساب المسافات."
    },
    {
      icon: <Users className="h-5 w-5 text-[#4d90a5]" />,
      title: "مسافة النطاق والجنس",
      desc: "حدد قطر الدائرة بالكيلومتر لمعرفة المدارس المحيطة، كما يمكنك تقليص النتائج حسب جنس المدرسة (بنين/بنات)."
    },
    {
      icon: <BookOpen className="h-5 w-5 text-[#4d90a5]" />,
      title: "المرحلة الدراسية",
      desc: "يمكنك تحديد المرحلة التعليمية المحددة التي ترغب في عرضها ضمن النطاق الجغرافي."
    },
    {
      icon: <Printer className="h-5 w-5 text-[#4d90a5]" />,
      title: "النتائج والطباعة",
      desc: "تستطيع طباعة قائمة المدارس كاملة موضحاً بها المسافة الدقيقة لكل مدرسة عن النقطة المستهدفة."
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-[#1a546d] p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute left-4 top-4 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Info className="h-7 w-7 text-primary-light" />
              </div>
              <div>
                <h2 className="text-xl font-bold">شرح استخدام الخارطة التعليمية</h2>
                <p className="text-white/70 text-sm mt-1">لمنسوبي التعليم والمستفيدين والجمهور العام</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-[#f0f7f9] p-4 rounded-2xl border-r-4 border-[#4d90a5]">
              <p className="text-[#1a546d] font-bold text-lg mb-2">عزيزي المستخدم،</p>
              <p className="text-gray-600 leading-relaxed text-sm">
                هذا التطبيق يساعدك على تحديد مدرسة معينة وتحديد المدارس المحيطة بها ضمن نطاق دائري محدد. 
                الخدمة مقدمة من <strong>الإدارة العامة للتعليم بمنطقة المدينة المنورة</strong> لخدمة المستفيدين وتسهيل الوصول للمعلومات المكانية.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-[#1a546d] mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                خطوات استخدام التطبيق
              </h3>
              <div className="grid gap-4">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                    <div className="mt-1">{step.icon}</div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm mb-1">{step.title}</h4>
                      <p className="text-gray-500 text-[13px] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-[#4d90a5] font-bold italic">"ختاماً نسألكم دعوة في ظهر الغيب"</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 flex justify-center">
            <button
              onClick={onClose}
              className="bg-[#1a546d] text-white px-10 py-2 rounded-xl font-bold hover:bg-[#144357] transition-all shadow-md"
            >
              فهمت ذلك
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
