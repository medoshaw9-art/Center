import { CalendarDays, ChevronLeft, Menu, MoonStar, SunMedium } from 'lucide-react';
import { formatDate, todayValue } from '../utils/helpers.js';

export function Navbar({ pageTitle, onOpenMenu, theme, onToggleTheme }) {
  return <header className="topbar">
    <button className="icon-button mobile-menu-button" aria-label="فتح القائمة" onClick={onOpenMenu}><Menu size={20} /></button>
    <div className="breadcrumbs"><span>سنتر النخبة</span><ChevronLeft size={14} /><strong>{pageTitle}</strong></div>
    <div className="topbar-actions">
      <button className="theme-toggle" type="button" aria-label="تبديل الوضع" onClick={onToggleTheme}>
        {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
        <span>{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
      </button>
      <span className="today-label"><CalendarDays size={15} />{formatDate(todayValue())}</span>
      <span className="live-indicator"><i /> يعمل الآن</span>
    </div>
  </header>;
}
