import React, { useState } from 'react';
import { MapPin, LogIn, LogOut, Settings, ShieldCheck, EyeOff, Menu, X, HelpCircle } from 'lucide-react';
import { Button } from './ui/Button';
import type { User as UserType } from '../types';
import { MinistryLogo } from './MinistryLogo';
import { GuideModal } from './modals/GuideModal';

interface HeaderProps {
  user: UserType | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onAdminPanelClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLoginClick, onLogoutClick, onAdminPanelClick }) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-primary-dark shadow-lg z-30 shrink-0 border-b-4 border-primary-light">
      <div className="container mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Right Section: Logo & Mobile Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden min-w-[48px] min-h-[48px] p-2 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-light"
            aria-label="قائمة الخيارات"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6 text-primary-light" /> : <Menu className="h-6 w-6 text-white" />}
          </button>

          {/* Official Ministry of Education Logo Badge */}
          <MinistryLogo />
        </div>

        {/* Center Section: Centered Fluid Title */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 text-white text-center flex-1 md:flex-initial px-1">
          <MapPin className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary-light shrink-0" />
          <div className="text-right sm:text-center">
            <h1 className="text-fluid-base sm:text-fluid-lg md:text-fluid-xl font-bold tracking-tight leading-tight">
              الخارطة التعليمية للقبول
              <span className="text-fluid-2xs font-normal text-primary-light/90 mr-1.5 px-1.5 py-0.5 rounded-full bg-primary-light/10 border border-primary-light/30">v2.0</span>
            </h1>
            <p className="text-fluid-2xs font-medium text-gray-300 hidden sm:block">
              الإدارة العامة للتعليم بمنطقة المدينة المنورة
            </p>
          </div>
        </div>

        {/* Left Section: Desktop Auth & User Actions */}
        <div className="hidden md:flex items-center justify-end gap-2.5 shrink-0" dir="rtl">
          {/* Quick Guide Button */}
          <Button
            onClick={() => setIsGuideOpen(true)}
            variant="ghost"
            size="sm"
            className="min-h-[40px] px-3 gap-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-xl"
            title="دليل الاستخدام"
          >
            <HelpCircle className="h-4 w-4 text-primary-light" />
            <span>الدليل</span>
          </Button>

          {user ? (
            <>
              {/* User Mode Badge */}
              <div className="flex flex-col items-start bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-white text-right">
                <div className="flex items-center gap-1.5">
                  {user.role === 'admin' && <ShieldCheck className="h-4 w-4 text-blue-400" />}
                  {user.userType === 'employee' && user.role !== 'admin' && <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                  {user.userType === 'beneficiary' && <EyeOff className="h-4 w-4 text-amber-400" />}
                  <span className="text-xs font-bold">{user.name}</span>
                </div>
                <span className="text-[10px] text-gray-300 font-medium">
                  {user.role === 'admin' && 'مسؤول النظام'}
                  {user.userType === 'employee' && user.role !== 'admin' && `منسوبي الإدارة (${user.civilId ? 'سجل: ' + user.civilId : 'مفعل'})`}
                  {user.userType === 'beneficiary' && 'مستفيد (بدون إحداثيات)'}
                </span>
              </div>

              {user.role === 'admin' && (
                <Button 
                  onClick={onAdminPanelClick} 
                  variant="ghost" 
                  size="sm" 
                  className="min-h-[40px] gap-1.5 text-xs text-white hover:bg-white/10 rounded-xl border border-white/15"
                >
                  <Settings className="h-4 w-4 text-amber-300" />
                  <span>لوحة التحكم</span>
                </Button>
              )}
              <Button 
                onClick={onLogoutClick} 
                variant="ghost" 
                size="sm" 
                className="min-h-[40px] gap-1 text-xs text-red-200 hover:text-white hover:bg-red-500/20 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                <span>تبديل الحساب</span>
              </Button>
            </>
          ) : (
            <Button 
              onClick={onLoginClick} 
              variant="primary" 
              size="sm" 
              className="min-h-[44px] px-4 gap-2 bg-primary-light hover:bg-primary-hover text-slate-900 font-extrabold shadow-md rounded-xl"
            >
              <LogIn className="h-4 w-4" />
              <span>تسجيل الدخول / اختيار الحساب</span>
            </Button>
          )}
        </div>

        {/* Mobile Quick Action Pill */}
        <div className="flex md:hidden items-center gap-1">
          {user ? (
            <div className="bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/20 text-white text-right max-w-[120px] truncate flex items-center gap-1 text-[11px] font-bold">
              {user.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
              {user.userType === 'employee' && user.role !== 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              {user.userType === 'beneficiary' && <EyeOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              <span className="truncate">{user.name}</span>
            </div>
          ) : (
            <button 
              onClick={onLoginClick} 
              className="min-h-[48px] min-w-[48px] px-3 flex items-center justify-center gap-1 rounded-xl bg-primary-light text-slate-900 font-extrabold text-xs shadow-md"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden xs:inline">الدخول</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile & Tablet Responsive Drawer Sheet */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-white/15 flex flex-col gap-2.5 animate-fadeIn">
          {/* User info status row on mobile */}
          {user && (
            <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold">{user.name}</div>
                <div className="text-[10px] text-gray-300">
                  {user.role === 'admin' && 'مسؤول النظام'}
                  {user.userType === 'employee' && user.role !== 'admin' && 'منسوبي الإدارة'}
                  {user.userType === 'beneficiary' && 'مستفيد (عرض بدون إحداثيات)'}
                </div>
              </div>
              {user.role === 'admin' && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onAdminPanelClick();
                  }}
                  className="min-h-[48px] px-3 flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold"
                >
                  <Settings className="h-4 w-4" />
                  <span>لوحة التحكم</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Menu Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsGuideOpen(true);
              }}
              className="min-h-[48px] p-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/10"
            >
              <HelpCircle className="h-4 w-4 text-primary-light" />
              <span>دليل الاستخدام</span>
            </button>

            {user ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogoutClick();
                }}
                className="min-h-[48px] p-2 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-xl text-xs font-bold border border-red-500/30"
              >
                <LogOut className="h-4 w-4" />
                <span>تبديل الحساب</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLoginClick();
                }}
                className="min-h-[48px] p-2 flex items-center justify-center gap-2 bg-primary-light text-slate-900 rounded-xl text-xs font-extrabold"
              >
                <LogIn className="h-4 w-4" />
                <span>تسجيل الدخول</span>
              </button>
            )}
          </div>
        </div>
      )}

      {isGuideOpen && (
        <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      )}
    </header>
  );
};
