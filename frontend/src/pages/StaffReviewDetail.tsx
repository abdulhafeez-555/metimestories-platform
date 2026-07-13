import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

function authHeaders() {
  const token = localStorage.getItem("staff_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface StoryDetail {
  id: number;
  title: string;
  synopsis: string | null;
  content: string;
  age_min: number;
  age_max: number;
  scene_count: number;
  author_name: string;
  author_email: string;
  value_label: string | null;
}

interface AgeVariant {
  id: number;
  age_band: string;
  override_type: string;
  content: string;
}

export default function StaffReviewDetail() {
  const { storyId } = useParams();
  const [, setLocation] = useLocation();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [variants, setVariants] = useState<AgeVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [safeguarding, setSafeguarding] = useState(false);
  const [dpf, setDpf] = useState(false);
  const [ageAppropriate, setAgeAppropriate] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("staff_token");
    if (!token) { setLocation("/staff/login"); return; }
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/staff/reviews/${storyId}`, { headers: authHeaders() });
        if (res.status === 401) { setLocation("/staff/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStory(data.story);
        setVariants(data.age_variants || []);
      } catch {
        setError("Could not load this story. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storyId, setLocation]);

  const handleDecision = async (decision: "approved" | "rejected" | "revision_requested") => {
    if (decision === "approved" && (!safeguarding || !dpf || !ageAppropriate)) {
      alert("Please confirm all three checks (safeguarding, DPF compliance, age-appropriateness) before approving.");
      return;
    }
    const confirmMsg =
      decision === "approved"
        ? `Approve and publish "${story?.title}"? This will make it visible to families immediately.`
        : decision === "rejected"
        ? `Reject "${story?.title}"? The author will need to revise before resubmitting.`
        : `Request revision on "${story?.title}"? The author will be able to edit and resubmit.`;
    if (!window.confirm(confirmMsg)) return;
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/staff/reviews/${storyId}/decision`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          decision,
          notes: notes.trim() || null,
          safeguarding_check: safeguarding,
          dpf_compliance: dpf,
          age_appropriateness: ageAppropriate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record the decision.");
      setLocation("/staff/reviews");
    } catch (err: any) {
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="author-theme h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="author-theme h-screen flex items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
        <div className="rounded-[10px] border border-rose-200 bg-rose-50 text-rose-600 text-sm p-4 max-w-md">
          {error || "Story not found."}
        </div>
      </div>
    );
  }

  const sceneCount = (story.content.match(/\[\s*scene\s*\]/gi) || []).length + 1;

  return (
    <div className="author-theme min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => setLocation("/staff/reviews")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to queue
        </button>

        <div className="bg-card rounded-[10px] border border-card-border shadow-xs p-6 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="font-serif text-2xl font-bold text-foreground">{story.title}</h1>
            {story.value_label && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0" style={{ background: "hsl(var(--primary))" }}>
                {story.value_label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">{story.synopsis}</p>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground pb-4 mb-4 border-b border-border">
            <span>By {story.author_name} ({story.author_email})</span>
            <span>Ages {story.age_min}-{story.age_max}</span>
            <span>{sceneCount} scenes detected</span>
          </div>

          <div className="prose prose-sm max-w-none">
            {story.content.split(/\[\s*scene\s*\]/gi).map((scene, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Scene {i + 1}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <p className="text-[14px] leading-7 text-foreground whitespace-pre-wrap" style={{ fontFamily: "Georgia, serif" }}>
                  {scene.trim()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {variants.length > 0 && (
          <div className="bg-card rounded-[10px] border border-card-border shadow-xs p-6 mb-4">
            <h2 className="text-[13px] font-semibold text-foreground mb-3">Age variants ({variants.length})</h2>
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id} className="rounded-[7px] p-3" style={{ background: "hsl(var(--muted))" }}>
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase">{v.age_band} - {v.override_type}</div>
                  <p className="text-[13px] text-foreground" style={{ fontFamily: "Georgia, serif" }}>{v.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-[10px] border border-card-border shadow-xs p-6">
          <h2 className="text-[13px] font-semibold text-foreground mb-3">Review checks</h2>
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={safeguarding} onChange={(e) => setSafeguarding(e.target.checked)} />
              Safeguarding check passed
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={dpf} onChange={(e) => setDpf(e.target.checked)} />
              DPF (personalisation) compliance confirmed
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={ageAppropriate} onChange={(e) => setAgeAppropriate(e.target.checked)} />
              Content is age-appropriate
            </label>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the author (optional, shown for rejections and revision requests)"
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary resize-y mb-4"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDecision("approved")}
              disabled={submitting !== null}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "hsl(158 65% 40%)" }}
            >
              {submitting === "approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve & publish
            </button>
            <button
              onClick={() => handleDecision("revision_requested")}
              disabled={submitting !== null}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] text-sm font-semibold border transition-all disabled:opacity-50"
              style={{ borderColor: "hsl(35 78% 41%)", color: "hsl(35 78% 35%)" }}
            >
              {submitting === "revision_requested" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Request revision
            </button>
            <button
              onClick={() => handleDecision("rejected")}
              disabled={submitting !== null}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] text-sm font-semibold border transition-all disabled:opacity-50"
              style={{ borderColor: "hsl(0 65% 50%)", color: "hsl(0 65% 45%)" }}
            >
              {submitting === "rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

