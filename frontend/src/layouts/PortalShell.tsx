import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, PenLine, BookOpen, BookMarked, HelpCircle, LogOut
} from "lucide-react";
import OnboardingModal from "@/components/OnboardingModal";

interface AuthorProfile {
  id: number;
  uuid: string;
  email: string;
  display_name: string;
  role: string;
  is_verified: boolean;
  can_self_publish: boolean;
  guidelines_accepted: boolean;
}

function getStoredAuthor(): AuthorProfile | null {
  const raw = localStorage.getItem("author");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthorProfile;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/author/dashboard", icon: LayoutDashboard },
  { label: "Field reference", href: "/author/fields",    icon: BookMarked },
];

interface PortalShellProps {
  children: React.ReactNode;
}

export default function PortalShell({ children }: PortalShellProps) {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const author = getStoredAuthor();
  const authorName = author?.display_name || "Author";
  const initials = getInitials(authorName);

  const handleLogout = () => {
    localStorage.removeItem("author_token");
    localStorage.removeItem("author");
    setLocation("/author/login");
  };

  const isActive = (href: string) => {
    if (href === "/author/dashboard") return location === "/author/dashboard";
    if (href === "/author/stories") return location.startsWith("/author/stories");
    return location === href;
  };

  return (
    <div className="author-theme h-screen overflow-hidden flex" style={{ background: "hsl(var(--background))" }}>
      {/* Sidebar */}
      <aside
        className="w-[220px] shrink-0 flex flex-col"
        style={{
          background: "hsl(var(--sidebar))",
          borderRight: "0.5px solid hsl(var(--sidebar-border))",
          height: "100vh",
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary-light)), hsl(var(--primary)))" }}
            >
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div
                className="text-[15px] font-semibold"
                style={{ color: "#fff", lineHeight: 1.2, fontFamily: "Georgia, serif" }}
              >
                MeTime Stories
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
                Author Portal
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={label} href={href}>
                <button
                  data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all"
                  style={{
                    background: active ? "hsl(var(--primary))" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "#fff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                    }
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              </Link>
            );
          })}

          <button
            onClick={() => setOnboardingOpen(true)}
            data-testid="nav-how-it-works"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={{ color: "rgba(255,255,255,0.55)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
            }}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            How it works
          </button>
        </nav>

        <div
          className="px-4 py-3.5 flex items-center gap-2.5"
          style={{ borderTop: "0.5px solid hsl(var(--sidebar-border))" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "hsl(var(--primary))" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.8)" }}>
              {authorName}
            </div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Author
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="button-logout"
            title="Sign out"
            className="text-[11px] transition-colors"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {children}
      </div>

      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}




