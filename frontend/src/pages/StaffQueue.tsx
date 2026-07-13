import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, BookOpen, Clock, User } from "lucide-react";
import StaffLayout from "@/layouts/StaffLayout";

interface ReviewStory {
  id: number;
  title: string;
  synopsis: string | null;
  age_min: number;
  age_max: number;
  scene_count: number;
  author_name: string;
  author_email: string;
  value_label: string | null;
  value_colour: string | null;
  updated_at: string;
}

function authHeaders() {
  const token = localStorage.getItem("staff_token");
  return { Authorization: `Bearer ${token}` };
}

export default function StaffQueue() {
  const [, setLocation] = useLocation();
  const [stories, setStories] = useState<ReviewStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("staff_token");
    if (!token) {
      setLocation("/staff/login");
      return;
    }
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/staff/reviews", { headers: authHeaders() });
        if (res.status === 401) { setLocation("/staff/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStories(data.stories || []);
      } catch {
        setError("Could not load the review queue. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setLocation]);

  return (
    <StaffLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-1">Review queue</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {loading ? "Loading..." : `${stories.length} ${stories.length === 1 ? "story" : "stories"} awaiting review`}
        </p>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[10px] border border-rose-200 bg-rose-50 text-rose-600 text-sm p-4">{error}</div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "hsl(var(--muted))" }}>
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Nothing to review right now</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              New submissions from authors will appear here.
            </p>
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <div className="space-y-3">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => setLocation(`/staff/reviews/${story.id}`)}
                className="w-full text-left bg-card rounded-[10px] border border-card-border shadow-xs hover:shadow-md transition-all p-5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif font-semibold text-foreground text-base leading-snug">{story.title}</h3>
                  {story.value_label && (
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0"
                      style={{ background: story.value_colour || "hsl(var(--primary))" }}
                    >
                      {story.value_label}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                  {story.synopsis || "No synopsis provided."}
                </p>
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground pt-2 border-t border-border mt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />{story.author_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />Ages {story.age_min}-{story.age_max}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />Submitted
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
