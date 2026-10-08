import { useState } from 'react';
import { ArrowLeft, Check, ShieldCheck, Sparkles, UserRound, XCircle } from 'lucide-react';

export function LoginScreen({ onSubmit, loading, toast }) {
  const [showPassword, setShowPassword] = useState(false);
  return <main className="login-screen" dir="rtl">
    <div className="login-visual">
      <div className="login-visual-top"><div className="brand-mark brand-mark-large"><span>م</span><i /></div><span>نظام إدارة السنتر التعليمي</span></div>
      <div className="login-art" aria-hidden="true">
        <div className="art-board"><div className="art-board-head"><span /><span /><span /></div><div className="art-calendar"><div className="art-calendar-title"><b>جدول الأسبوع</b><i>أكتوبر ٢٠٢٦</i></div><div className="art-grid"><span>س</span><span>ح</span><span>ن</span><span>ث</span><span>ر</span><span>خ</span><span>ج</span><i>١</i><i>٢</i><i>٣</i><i>٤</i><i className="art-highlight">٥</i><i>٦</i><i>٧</i><i>٨</i><i>٩</i><i>١٠</i><i>١١</i><i>١٢</i><i>١٣</i><i>١٤</i></div></div><div className="art-attendance"><div className="art-avatar">أ</div><span><b>أحمد محمد</b><small>حضر الحصة · ٩:١٥ ص</small></span><Check size={15} /></div></div>
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
      </div>
      <div className="login-visual-copy"><span className="eyebrow">كل شيء في مكان واحد</span><h2>يوم دراسي<br /><em>أكثر تنظيمًا.</em></h2><p>تابع المدرسين والطلاب والحضور بسهولة، وخلي وقتك للتعليم.</p></div>
      <div className="login-visual-bottom"><span>إدارة تعليمية، ببساطة.</span><span>١ / ٠١</span></div>
    </div>
    <section className="login-form-side">
      <div className="login-form-wrap">
        <div className="login-mobile-brand"><div className="brand-mark"><span>م</span><i /></div><strong>مَركز</strong></div>
        <span className="eyebrow">أهلًا بعودتك</span><h1>تسجيل الدخول</h1><p className="login-subtitle">سجّل دخولك لمتابعة تفاصيل السنتر.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label htmlFor="username">اسم المستخدم</label><div className="input-wrap"><UserRound size={17} /><input id="username" name="username" autoComplete="username" placeholder="اكتب اسم المستخدم" defaultValue="admin" required /></div>
          <div className="password-label"><label htmlFor="password">كلمة المرور</label><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'إخفاء' : 'إظهار'}</button></div>
          <div className="input-wrap"><ShieldCheck size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="اكتب كلمة المرور" defaultValue="markaz123" required /></div>
          <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}<ArrowLeft size={17} /></button>
        </form>
        <div className="demo-note"><Sparkles size={15} /><span>للتجربة: المدير <b>admin / markaz123</b></span></div>
        <div className="login-footnote"><span>© ٢٠٢٦ مَركز</span><span><ShieldCheck size={14} /> اتصال آمن</span></div>
      </div>
      {toast && <div className="toast login-toast" role="alert"><XCircle size={17} />{toast}</div>}
    </section>
  </main>;
}
