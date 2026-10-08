import { Activity } from 'lucide-react';

export function ReportsPage({ data }) {
  return <section className="reports-coming panel"><div className="report-icon"><Activity size={24} /></div><span className="eyebrow">قريبًا · المرحلة الثانية</span><h2>الصورة الكاملة، في تقرير واحد.</h2><p>التقارير التفصيلية حسب المدرس والمادة والمجموعة والفترة الزمنية ستكون متاحة في المرحلة التالية.</p><div className="report-preview"><span><b>{data?.present ?? 0}</b><small>حضور اليوم</small></span><span><b>{data?.absent ?? 0}</b><small>غياب اليوم</small></span><span><b>{data?.students ?? 0}</b><small>طلاب نشطون</small></span></div></section>;
}
