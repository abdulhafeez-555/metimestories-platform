import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Save, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PortalShell from "@/layouts/PortalShell";

interface PersonalisationField {
  id: number;
  field_key: string;
  label: string;
  scope: "profile" | "story";
}
interface StoryValue {
  id: number;
  label: string;
  colour_hex: string;
}
type AgeBand = "little" | "young" | "middle" | "older";
type OverrideType = "intro" | "climax" | "ending" | "vocab";

const AGE_BAND_LABELS: Record<AgeBand, string> = {
  little: "Ages 3-5", young: "Ages 6-8", middle: "Ages 9-11", older: "Ages 12+",
};
const VARIANT_LABELS: Record<OverrideType, string> = {
  intro: "Opening", climax: "Emotional peak", ending: "Resolution", vocab: "Vocabulary swaps",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  in_review: { bg: "hsl(38 90% 92%)", color: "hsl(38 80% 35%)" },
  published: { bg: "hsl(158 65% 92%)", color: "hsl(158 65% 30%)" },
  rejected: { bg: "hsl(0 70% 95%)", color: "hsl(0 65% 45%)" },
  archived: { bg: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
};

function authHeaders() {
  const token = localStorage.getItem("author_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function EditorPage() {
  const { storyId } = useParams();
  const [, setLocation] = useLocation();
  const isNew = storyId === "new" || !storyId;

  const [id, setId] = useState<number | null>(isNew ? null : Number(storyId));
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [ageMin, setAgeMin] = useState(3);
  const [ageMax, setAgeMax] = useState(8);
  const [sceneCount, setSceneCount] = useState(10);
  const [readingTime, setReadingTime] = useState(7);
  const [content, setContent] = useState("");
  const [valueId, setValueId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [fields, setFields] = useState<PersonalisationField[]>([]);
  const [values, setValues] = useState<StoryValue[]>([]);

  const [ageBand, setAgeBand] = useState<AgeBand>("little");
  const [variantTab, setVariantTab] = useState<OverrideType>("intro");
  const [variantContent, setVariantContent] = useState("");
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantSaved, setVariantSaved] = useState(false);
  const [variantKeys, setVariantKeys] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saving" | "saved">("saved");
  const [submitting, setSubmitting] = useState(false);
  const [submitProblems, setSubmitProblems] = useState<string[] | null>(null);
  const [unknownPlaceholders, setUnknownPlaceholders] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [fRes, vRes] = await Promise.all([
          fetch("/api/personalisation/fields", { headers: authHeaders() }),
          fetch("/api/stories/values", { headers: authHeaders() }),
        ]);
        const fData = await fRes.json();
        const vData = await vRes.json();
        setFields(fData.fields || []);
        setValues(vData.values || []);
      } catch {
        // non-fatal
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (isNew) return;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/author/stories/${storyId}`, { headers: authHeaders() });
        if (res.status === 401) { setLocation("/author/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        const s = data.story;
        setId(s.id);
        setTitle(s.title || "");
        setSynopsis(s.synopsis || "");
        setAgeMin(s.age_min);
        setAgeMax(s.age_max);
        setSceneCount(s.scene_count);
        setReadingTime(s.reading_time_mins);
        setContent(s.content || "");
        setValueId(s.value_id || null);
        setStatus(s.status || "draft");
        const vKeys = new Set<string>((data.age_variants || []).map((v: any) => v.age_band + "-" + v.override_type));
        setVariantKeys(vKeys);
      } catch {
        setLoadError("Could not load this story. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storyId, isNew, setLocation]);

  const stats = useMemo(() => {
    const phs = content.match(/\{\{([a-z][a-z0-9_]*)\}\}/g) || [];
    const uniquePhs = [...new Set(phs)];
    const sceneMarkers = (content.match(/\[\s*scene\s*\]/gi) || []).length;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const scenesOk = sceneMarkers >= sceneCount - 1;
    return { uniquePhs, sceneMarkers, words, scenesOk };
  }, [content, sceneCount]);

  const activePlaceholderKeys = new Set(stats.uniquePhs.map((p) => p.replace(/\{\{|\}\}/g, "")));
  const activeFields = fields.filter((f) => activePlaceholderKeys.has(f.field_key));
  const profileFields = fields.filter((f) => f.scope === "profile");
  const storyFields = fields.filter((f) => f.scope === "story");

  const depth = useMemo(() => {
    const placeholderScore = Math.min(stats.uniquePhs.length, 6) / 6 * 40;
    const variantScore = Math.min(variantKeys.size, 4) / 4 * 40;
    const sceneScore = sceneCount >= 8 ? 20 : (sceneCount / 8) * 20;
    return Math.round(placeholderScore + variantScore + sceneScore);
  }, [stats.uniquePhs.length, variantKeys.size, sceneCount]);
  const depthColour = depth >= 80 ? "hsl(var(--primary))" : depth >= 60 ? "hsl(35 78% 41%)" : "hsl(var(--destructive))";
  const depthLabel = depth >= 80 ? "Excellent depth" : depth >= 60 ? "Good - add more age variants to reach Excellent" : "Add more placeholders and age variants";

  const insertAtCursor = (text: string) => {
    const ta = contentRef.current;
    if (!ta) { setContent((c) => c + text); setSaveStatus("unsaved"); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    setContent((c) => c.slice(0, s) + text + c.slice(e));
    setSaveStatus("unsaved");
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + text.length, s + text.length); }, 0);
  };
  const insertPH = (key: string) => insertAtCursor(`{{${key}}}`);
  const insertSceneBreak = () => insertAtCursor("\n\n[SCENE]\n\n");

  const handleSave = async () => {
    setSaveStatus("saving");
    const body = {
      title, synopsis, content,
      value_id: valueId,
      age_min: ageMin, age_max: ageMax,
      scene_count: sceneCount, reading_time_mins: readingTime,
    };
    try {
      const res = await fetch(
        id ? `/api/author/stories/${id}` : "/api/author/stories",
        { method: id ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(body) }
      );
      if (res.status === 401) { setLocation("/author/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setUnknownPlaceholders(data.unknown_placeholders || []);
      if (!id && data.story?.id) {
        setId(data.story.id);
        setStatus(data.story.status || "draft");
        setLocation(`/author/stories/${data.story.id}/edit`, { replace: true });
      }
      setSaveStatus("saved");
      showToast("Story saved.");
    } catch {
      setSaveStatus("unsaved");
      showToast("Could not save your story. Please try again.", "error");
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      setSubmitProblems(["Save your draft first, then submit it for review."]);
      return;
    }
    setSubmitting(true);
    setSubmitProblems(null);
    try {
      const res = await fetch(`/api/author/stories/${id}/submit`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.status === 422) { setSubmitProblems(data.problems || [data.error]); return; }
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setStatus("in_review");
      showToast("Story submitted for review. Our editorial team will be in touch.");
      setTimeout(() => setLocation("/author/dashboard"), 1200);
    } catch {
      showToast("Something went wrong submitting your story. Please try again.", "error");
      setSubmitProblems(["Something went wrong submitting your story. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveVariant = async () => {
    if (!id) return;
    setVariantSaving(true);
    setVariantSaved(false);
    try {
      const res = await fetch(`/api/author/stories/${id}/variants`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ age_band: ageBand, override_type: variantTab, content: variantContent }),
      });
      if (!res.ok) throw new Error();
      setVariantKeys((prev) => new Set(prev).add(ageBand + "-" + variantTab));
      setVariantSaved(true);
      setTimeout(() => setVariantSaved(false), 2000);
    } catch {
      // could add an error toast later
    } finally {
      setVariantSaving(false);
    }
  };

  if (loading) {
    return (
      <PortalShell>
        <div className="flex-1 flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </PortalShell>
    );
  }

  const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.draft;

  return (
    <PortalShell>
      <div
        className="h-14 flex items-center justify-between px-7 shrink-0"
        style={{ background: "hsl(var(--card))", borderBottom: "0.5px solid hsl(var(--border))" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-foreground">Story editor</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: statusStyle.bg, color: statusStyle.color }}
          >
            {status.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveStatus === "saving"} className="text-xs h-8">
            {saveStatus === "saving" ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              : saveStatus === "saved" ? <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary" />
              : <Save className="w-3 h-3 mr-1.5" />}
            {saveStatus === "saving" ? "Saving..." : "Save draft"}
          </Button>
          {id && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/author/stories/${id}/preview`)} className="text-xs h-8">
              Preview
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="text-xs h-8">
            {submitting ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Send className="w-3 h-3 mr-1.5" />}
            Submit for review
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: "hsl(var(--background))" }}>

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-sm px-4 py-3">{loadError}</div>
        )}

        {submitProblems && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Almost there - a few things need your attention:
            </p>
            <ul className="space-y-0.5">
              {submitProblems.map((p) => (
                <li key={p} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />{p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {unknownPlaceholders.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700">
              Heads up - these placeholders dont match a known field and wont be filled in: {unknownPlaceholders.join(", ")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-[1fr_300px] gap-5">
          <div className="space-y-4 min-w-0">

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-foreground">Story details</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className="text-[12px] text-muted-foreground mb-1.5">Story title</Label>
                  <Input value={title} onChange={(e) => { setTitle(e.target.value); setSaveStatus("unsaved"); }} placeholder="Give your story a title..." className="text-sm" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground mb-1.5">Synopsis</Label>
                  <Input value={synopsis} onChange={(e) => { setSynopsis(e.target.value); setSaveStatus("unsaved"); }} placeholder="One sentence - what parents see when browsing" className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[12px] text-muted-foreground mb-1.5">Age range - minimum</Label>
                    <select value={ageMin} onChange={(e) => { setAgeMin(Number(e.target.value)); setSaveStatus("unsaved"); }} className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary">
                      {[3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n} years</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[12px] text-muted-foreground mb-1.5">Age range - maximum</Label>
                    <select value={ageMax} onChange={(e) => { setAgeMax(Number(e.target.value)); setSaveStatus("unsaved"); }} className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary">
                      {[5,6,7,8,9,10,11,12].map((n) => <option key={n} value={n}>{n} years</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[12px] text-muted-foreground mb-1.5">Number of scenes</Label>
                    <input type="number" min={4} max={20} value={sceneCount} onChange={(e) => { setSceneCount(Number(e.target.value)); setSaveStatus("unsaved"); }} className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary" />
                    <p className="text-[11px] text-muted-foreground mt-1">Each scene = one illustrated page</p>
                  </div>
                  <div>
                    <Label className="text-[12px] text-muted-foreground mb-1.5">Reading time (mins)</Label>
                    <input type="number" min={2} max={20} value={readingTime} onChange={(e) => { setReadingTime(Number(e.target.value)); setSaveStatus("unsaved"); }} className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-t-[10px]" style={{ background: "hsl(var(--muted))", borderBottom: "0.5px solid hsl(var(--border))" }}>
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">Child details:</span>
                {profileFields.map((f) => (
                  <button key={f.field_key} onClick={() => insertPH(f.field_key)} className="px-2.5 py-1 rounded-[5px] text-[11px] font-medium border transition-all" style={{ background: "hsl(245 40% 51% / 0.1)", borderColor: "hsl(245 40% 51%)", color: "hsl(245 40% 30%)" }}>
                    {`{{${f.field_key}}}`}
                  </button>
                ))}
                <div className="w-px h-4 bg-border mx-0.5" />
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">Story elements:</span>
                {storyFields.map((f) => (
                  <button key={f.field_key} onClick={() => insertPH(f.field_key)} className="px-2.5 py-1 rounded-[5px] text-[11px] font-medium border transition-all" style={{ background: "hsl(35 78% 41% / 0.1)", borderColor: "hsl(35 78% 41%)", color: "hsl(35 78% 28%)" }}>
                    {`{{${f.field_key}}}`}
                  </button>
                ))}
                <div className="w-px h-4 bg-border mx-0.5" />
                <button onClick={insertSceneBreak} className="px-2.5 py-1 rounded-[5px] text-[11px] font-medium border transition-all" style={{ background: "hsl(var(--primary) / 0.1)", borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}>
                  + Scene break
                </button>
              </div>

              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => { setContent(e.target.value); setSaveStatus("unsaved"); }}
                rows={18}
                placeholder={"Begin your story here...\n\nUse the toolbar above to insert placeholders, and add a scene break wherever the page should turn."}
                className="w-full px-4 py-4 text-sm leading-8 focus:outline-none resize-y bg-transparent text-foreground placeholder:text-muted-foreground/40"
                style={{ fontFamily: "Georgia, serif", fontSize: "14px", minHeight: 320 }}
              />

              <div className="flex items-center gap-3 px-4 py-2 rounded-b-[10px] text-[11px] text-muted-foreground" style={{ background: "hsl(var(--muted))", borderTop: "0.5px solid hsl(var(--border))" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: saveStatus === "saved" ? "hsl(var(--primary))" : "hsl(35 78% 41%)" }} />
                <span>{saveStatus === "unsaved" ? "Unsaved changes" : saveStatus === "saving" ? "Saving..." : "All changes saved"}</span>
                <span className="ml-auto">{stats.words} words</span>
                <span>{stats.uniquePhs.length} placeholder{stats.uniquePhs.length !== 1 ? "s" : ""}</span>
                <span>{variantKeys.size} age variant{variantKeys.size !== 1 ? "s" : ""}</span>
                <span style={{ color: stats.scenesOk ? undefined : "hsl(var(--destructive))" }}>
                  {stats.sceneMarkers} / {sceneCount - 1} scene breaks
                </span>
              </div>
            </div>

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Age-adaptive content</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">Optional - write different versions of key moments by age band</span>
                  {id && (
                    <button
                      onClick={() => setLocation(`/author/stories/${id}/variants`)}
                      className="text-[11px] font-semibold underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Open full-page editor
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {!id && (
                  <p className="text-[12px] text-muted-foreground italic">Save your draft first to unlock age variants.</p>
                )}
                <div className="flex gap-1.5">
                  {(Object.keys(AGE_BAND_LABELS) as AgeBand[]).map((b) => (
                    <button key={b} onClick={() => setAgeBand(b)} disabled={!id} className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium border transition-all disabled:opacity-40" style={{ background: ageBand === b ? "hsl(var(--primary))" : "transparent", color: ageBand === b ? "#fff" : "hsl(var(--muted-foreground))", borderColor: ageBand === b ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                      {AGE_BAND_LABELS[b]}
                    </button>
                  ))}
                </div>
                <div className="flex border-b border-border">
                  {(Object.keys(VARIANT_LABELS) as OverrideType[]).map((tab) => (
                    <button key={tab} onClick={() => setVariantTab(tab)} disabled={!id} className="px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-all disabled:opacity-40" style={{ borderBottomColor: variantTab === tab ? "hsl(var(--primary))" : "transparent", color: variantTab === tab ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                      {VARIANT_LABELS[tab]}
                    </button>
                  ))}
                </div>
                <div>
                  <textarea
                    value={variantContent}
                    onChange={(e) => setVariantContent(e.target.value)}
                    rows={5}
                    disabled={!id}
                    placeholder={`Write the ${VARIANT_LABELS[variantTab].toLowerCase()} for ${AGE_BAND_LABELS[ageBand].toLowerCase()} readers... {{placeholders}} work here too.`}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-[7px] bg-card text-foreground focus:outline-none focus:border-primary resize-y leading-relaxed disabled:opacity-50"
                    style={{ fontFamily: "Georgia, serif" }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={handleSaveVariant} disabled={!id || variantSaving || !variantContent.trim()} className="text-xs h-7">
                      {variantSaving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : variantSaved ? <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary" /> : null}
                      {variantSaved ? "Saved" : "Save this variant"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-foreground">Personalisation depth</span>
              </div>
              <div className="p-4">
                <p className="text-[12px] text-muted-foreground mb-3">How emotionally embedded is this story?</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: "Placeholders used", val: stats.uniquePhs.length, good: stats.uniquePhs.length >= 5 },
                    { label: "Age variants saved", val: variantKeys.size, good: variantKeys.size >= 4 },
                    { label: "Scenes planned", val: sceneCount, good: sceneCount >= 8 },
                    { label: "Scene breaks placed", val: stats.sceneMarkers, good: stats.scenesOk },
                  ].map(({ label, val, good }) => (
                    <div key={label} className="rounded-[7px] p-2.5" style={{ background: "hsl(var(--muted))" }}>
                      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
                      <div className="text-[18px] font-semibold" style={{ color: good ? "hsl(var(--primary))" : "hsl(35 78% 41%)" }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">Overall depth score</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${depth}%`, background: depthColour }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>{depthLabel}</span>
                    <span className="font-semibold" style={{ color: depthColour }}>{depth}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-foreground">Value this story teaches</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {values.map((v) => (
                    <button key={v.id} onClick={() => { setValueId(v.id); setSaveStatus("unsaved"); }} className="px-2.5 py-2 rounded-[7px] text-[12px] font-medium border text-center transition-all" style={{ background: valueId === v.id ? v.colour_hex : "transparent", color: valueId === v.id ? "#fff" : "hsl(var(--foreground))", borderColor: valueId === v.id ? v.colour_hex : "hsl(var(--border))" }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">Active placeholders</span>
                <span className="text-[11px] text-muted-foreground">{activeFields.length} detected</span>
              </div>
              <div className="p-4">
                {activeFields.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No placeholders detected yet. Use the toolbar above to insert some.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeFields.map((f) => (
                      <span key={f.field_key} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border" style={{ background: f.scope === "profile" ? "hsl(245 40% 51% / 0.1)" : "hsl(35 78% 41% / 0.1)", color: f.scope === "profile" ? "hsl(245 40% 30%)" : "hsl(35 78% 28%)", borderColor: f.scope === "profile" ? "hsl(245 40% 51%)" : "hsl(35 78% 41%)" }}>
                        {f.field_key}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-[10px] border border-card-border shadow-xs">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-foreground">Scene breaks</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[24px] font-semibold" style={{ color: stats.scenesOk ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
                    {stats.sceneMarkers} / {sceneCount - 1}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {stats.scenesOk ? "Ready for review." : `Add ${sceneCount - 1 - stats.sceneMarkers} more scene break${sceneCount - 1 - stats.sceneMarkers === 1 ? "" : "s"} using the toolbar above.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{
            background: toast.type === "success" ? "hsl(158 65% 92%)" : "hsl(0 70% 95%)",
            color: toast.type === "success" ? "hsl(158 65% 25%)" : "hsl(0 65% 40%)",
            border: `1px solid ${toast.type === "success" ? "hsl(158 65% 80%)" : "hsl(0 65% 85%)"}`,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </PortalShell>
  );
}
