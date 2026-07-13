import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, PenLine, BookOpen, Clock, LayoutGrid, CheckCircle2, RotateCcw, XCircle, Loader2, Trash2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import PortalShell from "@/layouts/PortalShell";
import OnboardingModal from "@/components/OnboardingModal";

type StoryStatus = "draft" | "in_review" | "published" | "rejected" | "archived";

interface Story {
  id: number;
  uuid: string;
  title: string;
  synopsis: string | null;
  status: StoryStatus;
  age_min: number;
  age_max: number;
  scene_count: number;
  value_label: string | null;
  value_colour: string | null;
  updated_at: string;
}

const STATUS_CONFIG: Record<StoryStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft:     { label: "Draft",     className: "bg-neutral-100 text-neutral-600 border-neutral-200", icon: <PenLine className="w-3 h-3" /> },
  in_review: { label: "In Review", className: "bg-amber-50 text-amber-700 border-amber-200",        icon: <RotateCcw className="w-3 h-3" /> },
  published: { label: "Published", className: "bg-emerald-50 text-emerald-700 border-emerald-200",  icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:  { label: "Rejected",  className: "bg-rose-50 text-rose-600 border-rose-200",           icon: <XCircle className="w-3 h-3" /> },
  archived:  { label: "Archived",  className: "bg-neutral-100 text-neutral-400 border-neutral-200", icon: <Archive className="w-3 h-3" /> },
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  return `${weeks} weeks ago`;
}

function authHeaders() {
  const token = localStorage.getItem("author_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState<number | null>(null);

  const authorRaw = localStorage.getItem("author");
  const author = authorRaw ? JSON.parse(authorRaw) : null;
  const authorName = author?.display_name?.split(" ")[0] || "there";

  useEffect(() => {
    const token = localStorage.getItem("author_token");
    if (!token) {
      setLocation("/author/login");
    }
  }, [setLocation]);

  const fetchStories = async () => {
    const token = localStorage.getItem("author_token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/author/stories", { headers: authHeaders() });
      if (res.status === 401) {
        localStorage.removeItem("author_token");
        localStorage.removeItem("author");
        setLocation("/author/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load your stories.");
      const data = await res.json();
      setStories(data.stories || []);
    } catch {
      setError("Something went wrong loading your stories. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLocation]);

  useEffect(() => {
    if (!localStorage.getItem("mts_onboarding_seen")) {
      const t = setTimeout(() => setShowOnboarding(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const handleNewStory = () => {
    setLocation("/author/stories/new");
  };

  const handleDelete = async (e: React.MouseEvent, story: Story) => {
    e.stopPropagation();
    const isWithdraw = story.status === "in_review";
    const confirmMsg = isWithdraw
      ? `Withdraw "${story.title}" from review? You can edit and resubmit it afterwards.`
      : `Delete "${story.title}"? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setActioningId(story.id);
    try {
      const res = await fetch(`/api/author/stories/${story.id}`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Could not delete this story.");
        return;
      }
      await fetchStories();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  const handleArchive = async (e: React.MouseEvent, story: Story) => {
    e.stopPropagation();
    if (!window.confirm(`Archive "${story.title}"? Families will no longer see it, but all reading history is kept.`)) return;

    setActioningId(story.id);
    try {
      const res = await fetch(`/api/author/stories/${story.id}/archive`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Could not archive this story.");
        return;
      }
      await fetchStories();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setActioningId(null);
    }
  };

  const draftCount = stories.filter((s) => s.status === "draft").length;
  const inReviewCount = stories.filter((s) => s.status === "in_review").length;
  const publishedCount = stories.filter((s) => s.status === "published").length;

  return (
    <PortalShell>
      <div
        className="h-14 flex items-center justify-between px-7 shrink-0"
        style={{ background: "hsl(var(--card))", borderBottom: "0.5px solid hsl(var(--border))" }}
      >
        <span className="text-[15px] font-semibold text-foreground">Dashboard</span>
        <Button onClick={handleNewStory} size="sm" className="text-xs h-8">
          <Plus className="w-3 h-3 mr-1.5" />
          New story
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: "hsl(var(--background))" }}>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Drafts", value: draftCount },
            { label: "In review", value: inReviewCount },
            { label: "Published", value: publishedCount },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[8px] p-4" style={{ background: "hsl(var(--muted))" }}>
              <div className="text-[12px] text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-[28px] font-semibold leading-none" style={{ color: "hsl(var(--primary))" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold text-foreground">Your stories, {authorName}.</h2>
          {!loading && stories.length > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {draftCount} draft * {inReviewCount} in review * {publishedCount} published
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading your stories...</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[10px] border border-rose-200 bg-rose-50 text-rose-600 text-sm p-4 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "hsl(var(--muted))" }}>
              <PenLine className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Write your first story</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Every MeTime Stories tale starts here. Your words, personalised for every child who reads them.
            </p>
            <Button onClick={handleNewStory} size="sm">
              <Plus className="w-3 h-3 mr-1.5" />
              New story
            </Button>
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((story, i) => {
              const canDelete = story.status === "draft" || story.status === "rejected";
              const canWithdraw = story.status === "in_review";
              const canArchive = story.status === "published";
              const isActioning = actioningId === story.id;

              return (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.22 }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setLocation(`/author/stories/${story.id}/edit`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLocation(`/author/stories/${story.id}/edit`); }}
                    className="w-full text-left bg-card rounded-[10px] border border-card-border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[story.status].className}`}>
                        {STATUS_CONFIG[story.status].icon}
                        {STATUS_CONFIG[story.status].label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {story.value_label && (
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                            style={{ background: story.value_colour || "hsl(var(--primary))" }}
                          >
                            {story.value_label}
                          </span>
                        )}
                        {(canDelete || canWithdraw) && (
                          <button
                            onClick={(e) => handleDelete(e, story)}
                            disabled={isActioning}
                            title={canWithdraw ? "Withdraw from review" : "Delete"}
                            className="p-1.5 rounded-full hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors disabled:opacity-40"
                          >
                            {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {canArchive && (
                          <button
                            onClick={(e) => handleArchive(e, story)}
                            disabled={isActioning}
                            title="Archive"
                            className="p-1.5 rounded-full hover:bg-neutral-100 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-foreground text-[15px] leading-snug mb-1">
                        {story.title}
                      </h3>
                      <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                        {story.synopsis || "No synopsis yet."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />Ages {story.age_min}-{story.age_max}
                      </span>
                      <span className="flex items-center gap-1">
                        <LayoutGrid className="w-3 h-3" />{story.scene_count} scenes
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />{timeAgo(story.updated_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button
              onClick={handleNewStory}
              className="min-h-[160px] rounded-[10px] border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/3 transition-all group flex flex-col items-center justify-center gap-2.5 text-muted-foreground hover:text-primary"
            >
              <div className="w-9 h-9 rounded-[8px] border-2 border-current flex items-center justify-center transition-transform group-hover:scale-110">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[12px] font-semibold">Write a new story</span>
            </button>
          </div>
        )}
      </div>

      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </PortalShell>
  );
}

