import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { publicAssetUrl } from "@/lib/publicAssetUrl";
import { useChildName } from "@/contexts/ChildNameContext";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [location] = useLocation();
  const { childName, openPrompt, clearChildName } = useChildName();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  const isActive = (path: string) => location === path;

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? "text-amber-500 border-b-2 border-amber-500 pb-0.5"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          boxShadow: scrolled ? "0 1px 16px rgba(0,0,0,0.10)" : "0 1px 0 rgba(0,0,0,0.07)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0 group">
            <img
              src={publicAssetUrl("images/metime-logo-animated.gif")}
              alt="Me Time Stories"
              className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 ml-8">
            <Link href="/" className={navLinkClass("/")}>Home</Link>
            <Link href="/about" className={navLinkClass("/about")}>About</Link>
            <Link href="/families" className={navLinkClass("/families")}>For Families</Link>
            <Link href="/for-authors" className={navLinkClass("/for-authors")}>For Authors</Link>

            {/* Solutions dropdown */}
            <div className="relative">
              <button
                onClick={() => setSolutionsOpen(!solutionsOpen)}
                onBlur={() => setTimeout(() => setSolutionsOpen(false), 150)}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Solutions
                <i className={`ri-arrow-down-s-line transition-transform ${solutionsOpen ? "rotate-180" : ""}`}></i>
              </button>
              {solutionsOpen && (
                <div
                  className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-xl py-2 border border-gray-100 z-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Link href="/for-academies" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700" onClick={() => setSolutionsOpen(false)}>
                    <i className="ri-school-line text-blue-600"></i> Football Academies
                  </Link>
                  <Link href="/csr" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700" onClick={() => setSolutionsOpen(false)}>
                    <i className="ri-building-line text-green-600"></i> Corporate CSR
                  </Link>
                  <Link href="/football-matrix" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700" onClick={() => setSolutionsOpen(false)}>
                    <i className="ri-football-line text-orange-500"></i> Football Matrix
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Desktop CTA buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            {childName && (
              <div className="hidden lg:flex items-center gap-1 rounded-full overflow-hidden"
                style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.22)" }}>
                <button
                  onClick={openPrompt}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-semibold transition-all hover:bg-orange-100/40"
                  style={{ color: "#f97316" }}
                  title="Edit child name"
                >
                  <i className="ri-user-smile-line text-[11px]"></i>
                  For {childName}
                </button>
                <button
                  onClick={clearChildName}
                  className="flex items-center justify-center w-6 h-6 mr-1 rounded-full text-[10px] transition-all hover:bg-orange-200/50"
                  style={{ color: "#f97316" }}
                  title="Not this child? Clear name"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            )}
            <Link
              href="/family/register"
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all hover:bg-orange-50"
              style={{ color: "#f97316" }}
            >
              <i className="ri-play-circle-fill"></i>
              {childName ? `${childName}'s Free Story` : "Try Free Story"}
            </Link>
            <Link
              href="/family/login"
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:bg-amber-50"
              style={{ color: "#92400e", border: "1.5px solid rgba(249,115,22,0.25)" }}
            >
              Sign In
            </Link>
            <Link
              href="/family/register"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-all hover:scale-[1.03] hover:shadow-md shadow-sm"
              style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)", color: "#1a0800" }}
            >
              <i className="ri-book-open-line"></i>
              {childName ? `${childName}'s Free Story` : "Read Free Story"}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-900"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <i className="ri-menu-line text-xl"></i>
          </button>
        </div>
      </header>

      {/* ── Mobile menu overlay ───────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-50 md:hidden transition-opacity duration-200"
        style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "auto" : "none" }}
        onClick={() => setMobileOpen(false)}
      >
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.40)", backdropFilter: "blur(2px)" }} />
      </div>

      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] md:hidden flex flex-col shadow-2xl transition-transform duration-300"
        style={{
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(20px)",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Link href="/" onClick={() => setMobileOpen(false)}>
            <img src={publicAssetUrl("images/metime-logo-animated.gif")} alt="Me Time Stories" className="h-8 w-auto" />
          </Link>
          <button onClick={() => setMobileOpen(false)} className="w-8 h-8 flex items-center justify-center text-gray-500">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {[
            { href: "/", label: "Home", icon: "ri-home-line" },
            { href: "/about", label: "About", icon: "ri-information-line" },
            { href: "/families", label: "For Families", icon: "ri-heart-line" },
            { href: "/for-authors", label: "For Authors", icon: "ri-pen-nib-line" },
            { href: "/for-academies", label: "Football Academies", icon: "ri-school-line" },
            { href: "/csr", label: "Corporate CSR", icon: "ri-building-line" },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive(href) ? "bg-orange-50 text-orange-700" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <i className={`${icon} text-base`} style={{ color: isActive(href) ? "#f97316" : "#9ca3af" }}></i>
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 pb-6 pt-2 space-y-2.5 border-t border-gray-100">
          <Link
            href="/family/register"
            onClick={() => setMobileOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white font-bold rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)", color: "#1a0800" }}
          >
            <i className="ri-book-open-line"></i>
            {childName ? `${childName}'s Free Story` : "Start Your Child's Story"}
          </Link>
          <Link
            href="/family/login"
            onClick={() => setMobileOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="flex-1 pt-[60px]">
        {children}
      </main>

      {/* ── Scroll to top ────────────────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
        style={{
          background: "linear-gradient(135deg, #f97316, #fbbf24)",
          color: "#1a0800",
          opacity: showScrollTop ? 1 : 0,
          pointerEvents: showScrollTop ? "auto" : "none",
          transform: showScrollTop ? "translateY(0) scale(1)" : "translateY(8px) scale(0.9)",
        }}
      >
        <i className="ri-arrow-up-s-line text-lg font-bold"></i>
      </button>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ background: "#0d0a08", color: "rgba(254,243,226,0.80)" }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Brand + Contact */}
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="inline-block mb-4">
                <img
                  src={publicAssetUrl("images/metime-logo-animated.gif")}
                  alt="Me Time Stories"
                  className="h-12 w-auto object-contain"
                  style={{ opacity: 0.45, mixBlendMode: "screen" }}
                />
              </Link>
              <p className="text-sm leading-relaxed max-w-xs mb-5" style={{ color: "rgba(254,243,226,0.45)" }}>
                Fully personalised children's books where your child's name, personality, favourite animal, and biggest dreams live on every page — not just the cover.
              </p>

              {/* Social icons */}
              <div className="flex gap-3 mb-6">
                <a href="#" aria-label="Instagram"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-amber-400/20 transition-colors"
                  style={{ background: "rgba(254,243,226,0.08)" }}>
                  <i className="ri-instagram-line text-sm"></i>
                </a>
                <a href="#" aria-label="TikTok"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-amber-400/20 transition-colors"
                  style={{ background: "rgba(254,243,226,0.08)" }}>
                  <i className="ri-tiktok-line text-sm"></i>
                </a>
                <a href="#" aria-label="Facebook"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-amber-400/20 transition-colors"
                  style={{ background: "rgba(254,243,226,0.08)" }}>
                  <i className="ri-facebook-fill text-sm"></i>
                </a>
                <a href="https://www.linkedin.com/in/taku-chiweshe-a342a1324/" target="_blank" rel="noopener noreferrer" aria-label="Taku on LinkedIn"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-400/20 transition-colors"
                  style={{ background: "rgba(254,243,226,0.08)" }}>
                  <i className="ri-linkedin-fill text-sm"></i>
                </a>
                <a href="https://www.linkedin.com/in/michael-mcdermott-477a83230/" target="_blank" rel="noopener noreferrer" aria-label="Michael on LinkedIn"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-400/20 transition-colors"
                  style={{ background: "rgba(254,243,226,0.08)" }}>
                  <i className="ri-linkedin-fill text-sm"></i>
                </a>
              </div>

              {/* Contact info */}
              <div className="space-y-2.5">
                <a href="tel:+447402256217"
                  className="flex items-center gap-2.5 text-sm group transition-colors hover:text-amber-300"
                  style={{ color: "rgba(254,243,226,0.50)" }}>
                  <i className="ri-phone-line" style={{ color: "#fbbf24" }}></i>
                  07402 256 217
                </a>
                <a href="mailto:Admin@MeTimeStories.co.uk"
                  className="flex items-center gap-2.5 text-sm group transition-colors hover:text-amber-300"
                  style={{ color: "rgba(254,243,226,0.50)" }}>
                  <i className="ri-mail-line" style={{ color: "#fbbf24" }}></i>
                  Admin@MeTimeStories.co.uk
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(254,243,226,0.35)" }}>Product</h4>
              <ul className="space-y-2.5">
                {[
                  { href: "/families", label: "For Families" },
                  { href: "/for-authors", label: "For Authors" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm hover:text-amber-300 transition-colors" style={{ color: "rgba(254,243,226,0.45)" }}>
                      {label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/family/register" className="text-sm hover:text-amber-300 transition-colors text-left" style={{ color: "rgba(254,243,226,0.45)" }}>
                    🚜 Start Your Child's Story
                  </Link>
                </li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(254,243,226,0.35)" }}>Solutions</h4>
              <ul className="space-y-2.5 mb-8">
                {[
                  { href: "/for-academies", label: "Football Academies" },
                  { href: "/csr", label: "Corporate CSR" },
                  { href: "/football-matrix", label: "Football Matrix" },
                  { href: "/about", label: "About Us" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm hover:text-amber-300 transition-colors" style={{ color: "rgba(254,243,226,0.45)" }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(254,243,226,0.35)" }}>Get in Touch</h4>
              <a href="mailto:Admin@MeTimeStories.co.uk"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#f97316,#fbbf24)", color: "#1a0800" }}>
                <i className="ri-mail-send-line"></i> Email Us
              </a>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderColor: "rgba(254,243,226,0.08)" }}>
            <p className="text-sm" style={{ color: "rgba(254,243,226,0.25)" }}>© 2025 Me Time Stories Ltd. All rights reserved.</p>
            <div className="flex gap-5 text-sm" style={{ color: "rgba(254,243,226,0.25)" }}>
              <a href="#" className="hover:text-amber-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-amber-300 transition-colors">Terms of Service</a>
              <Link href="/family/login" className="hover:text-amber-300 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
