import { useLocation } from "wouter";
import { LogOut } from "lucide-react";

interface StaffProfile {
  id: number;
  uuid: string;
  email: string;
  display_name: string;
  role: string;
  staff_role: string;
}

function getStoredStaff(): StaffProfile | null {
  const raw = localStorage.getItem("staff");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffProfile;
  } catch {
    return null;
  }
}

interface StaffLayoutProps {
  children: React.ReactNode;
}

export default function StaffLayout({ children }: StaffLayoutProps) {
  const [, setLocation] = useLocation();
  const staff = getStoredStaff();

  const handleLogout = () => {
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff");
    setLocation("/staff/login");
  };

  return (
    <div className="author-theme h-screen overflow-hidden flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <div
        className="h-14 flex items-center justify-between px-7 shrink-0"
        style={{ background: "hsl(var(--sidebar))", borderBottom: "0.5px solid hsl(var(--sidebar-border))" }}
      >
        <div>
          <span className="text-[15px] font-semibold" style={{ color: "#fff", fontFamily: "Georgia, serif" }}>
            MeTime Stories
          </span>
          <span className="text-[11px] ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            Editorial Review
          </span>
        </div>
        <div className="flex items-center gap-3">
          {staff && (
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {staff.display_name}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
