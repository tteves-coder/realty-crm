import { ui } from "@/components/uiStyles";

export default function CrmShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={ui.page}>
      <div className={ui.header}>
        <div>
          <h1 className={ui.title}>{title}</h1>
          {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
        </div>
      </div>

      {children}
    </div>
  );
}
