import React, { useState } from 'react';
import { X, MessageSquare, Phone, MessageCircle, Send, User, Smartphone, Code2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { sanitizeString } from '../../lib/security';
import { sendFeedback } from '../../lib/db';

interface DeveloperContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperContactModal: React.FC<DeveloperContactModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');
    
    try {
      // Defensive coding: Sanitize inputs before submission
      const sanitizedName = sanitizeString(name) || 'مستفيد غير معروف';
      const sanitizedPhone = sanitizeString(phone);
      const sanitizedMessage = sanitizeString(message);

      if (!sanitizedMessage) {
        throw new Error('Message is empty after sanitization');
      }

      await sendFeedback({
        name: sanitizedName,
        phone: sanitizedPhone,
        message: sanitizedMessage
      });
      
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setName('');
        setPhone('');
        setMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error sending feedback:', error);
      setStatus('error');
    }
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/966553512200', '_blank');
  };

  const handleCall = () => {
    window.location.href = 'tel:0553512200';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" dir="rtl">
      <div className="bg-[#f8fafc] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-[#4d90a5] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">للملاحظات للتواصل مع المطور</h2>
              <p className="text-white/80 text-xs font-medium">يسعدنا استقبال ملاحظاتكم ومقترحاتكم والتواصل المباشر مع دعم النظام</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Programmer Section */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                  <Code2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">نبذة عن المطور ورقم التواصل</h3>
              </div>
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">مطور النظام</span>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <span className="text-slate-700 font-bold">فكرة وتطوير النظام:</span>
                  <span className="text-blue-900 font-black text-lg">الأستاذ / سالم بن محمد الترجمي</span>
                </div>

                <div className="flex items-center gap-2 px-3">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span className="text-slate-600 font-bold text-sm">رقم التواصل الخاص:</span>
                  <span className="text-blue-700 font-mono font-black text-lg tracking-wider" dir="ltr">0553512200</span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-medium px-3 italic">
                  تم تطوير هذا النظام وإعداد خوارزمياته المتقدمة لرعاية المستفيدين، وتسهيل إجراءات القبول والتسكين بالمدارس، ومتابعة بلاغات الشواغر بكفاءة عالية وشفافية كاملة.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button 
                  onClick={handleWhatsApp}
                  className="bg-[#25D366] hover:bg-[#20ba5a] text-white gap-2 flex-1 font-bold rounded-xl h-12 shadow-md"
                >
                  <MessageCircle className="h-5 w-5" />
                  تواصل عبر الواتساب
                </Button>
                <Button 
                  onClick={handleCall}
                  className="bg-[#4d90a5] hover:bg-[#3d7a8c] text-white gap-2 flex-1 font-bold rounded-xl h-12 shadow-md"
                >
                  <Phone className="h-5 w-5" />
                  اتصال مباشر
                </Button>
              </div>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">مربع لكتابة الملاحظات وإرسالها للمطور</h3>
              </div>
              <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 px-1 flex items-center gap-1">
                    اسم المستفيد <span className="text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أدخل اسمك الكريم..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all pr-10"
                    />
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 px-1 flex items-center gap-1">
                    رقم التواصل / الجوال <span className="text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all pr-10 font-mono"
                      dir="ltr"
                    />
                    <Smartphone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 px-1 flex items-center gap-1">
                  نص الملاحظة أو الاستفسار <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب جميع ملاحظاتك، مقترحاتك، أو الاستفسار هنا بالتفصيل ليتم إرسالها للمبرمج..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all min-h-[120px] resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="submit"
                  disabled={status === 'sending' || status === 'success' || (status === 'idle' && !message.trim())}
                  className={`gap-2 px-8 font-bold rounded-xl h-11 transition-all shadow-md ${
                    status === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#4d90a5] hover:bg-[#3d7a8c]'
                  } text-white disabled:opacity-50`}
                  onClick={status === 'error' ? () => setStatus('idle') : undefined}
                >
                  {status === 'idle' && (
                    <>
                      <Send className="h-4 w-4" />
                      إرسال الملاحظة للمطور
                    </>
                  )}
                  {status === 'sending' && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري الإرسال...
                    </div>
                  )}
                  {status === 'success' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      تم الإرسال بنجاح
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      فشل الإرسال - حاول مجدداً
                    </div>
                  )}
                </Button>
                
                {status === 'error' && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">
                    ⚠️ حدث خطأ أثناء الإرسال. تأكد من اتصال الإنترنت وحاول مرة أخرى.
                  </p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
