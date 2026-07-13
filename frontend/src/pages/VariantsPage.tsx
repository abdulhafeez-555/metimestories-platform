import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PortalShell from "@/layouts/PortalShell";

type AgeBand = "little" | "young" | "middle" | "older";
type UiSection = "opening" | "emotional_peak" | "resolution" | "vocabulary";
type OverrideType = "intro" | "climax" | "ending" | "vocab";

const SECTION_TO_OVERRIDE: Record<UiSection, OverrideType> = {
  opening: "intro",
  emotional_peak: "climax",
  resolution: "ending",
  vocabulary: "vocab",
};
const OVERRIDE_TO_SECTION: Record<OverrideType, UiSection> = {
  intro: "opening",
  climax: "emotional_peak",
  ending: "resolution",
  vocab: "vocabulary",
};

const AGE_BANDS: { key: AgeBand; label: string; range: string; colour: string }[] = [
  { key: "little", label: "Little", range: "Ages 3-5", colour: "#22c55e" },
  { key: "young", label: "Young", range: "Ages 6-8", colour: "#3b82f6" },
  { key: "middle", label: "Middle", range: "Ages 9-11", colour: "#8b5cf6" },
  { key: "older", label: "Older", range: "Ages 12+", colour: "#f97316" },
];

const SECTIONS: { key: UiSection; label: string; description: string }[] = [
  {
    key: "opening",
    label: "Opening",
    description: "How the story begins - the first impression. Simpler language for littler readers, richer narrative for older ones.",
  },
  {
    key: "emotional_peak",
    label: "Emotional peak",
    description: "The moment of greatest feeling - fear, hope, joy, loss. Calibrate the emotional intensity to the age group.",
  },
  {
    key: "resolution",
    label: "Resolution",
    description: "How the story resolves and what lesson lands. Younger children need explicit clarity; older children can hold nuance.",
  },
  {
    key: "vocabulary",
    label: "Vocabulary notes",
    description: "Key words or phrases to substitute for this age band.",
  },
];

function authHeaders() {
  const token = localStorage.getItem("author_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function VariantsPage() {
  const { storyId } = useParams();
  const [, setLocation] = useLocation();
  const [activeBand, setActiveBand] = useState<AgeBand>("little");
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [variantIds, setVariantIds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storyTitle, setStoryTitle] = useState("");

  const getKey = (band: AgeBand, section: UiSection) => `${band}-${section}`;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/author/stories/${storyId}`, { headers: authHeaders() });
        if (res.status === 401) { setLocation("/author/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setStoryTitle(data.story?.title || "");
        const loaded: Record<string, string> = {};
        const ids: Record<string, number> = {};
        (data.age_variants || []).forEach((v: any) => {
          const section = OVERRIDE_TO_SECTION[v.override_type as OverrideType];
          if (!section) return;
          const k = getKey(v.age_band, section);
          loaded[k] = v.content;
          ids[k] = v.id;
        });
        setVariants(loaded);
        setVariantIds(ids);
      } catch {
        setError("Could not load age variants for this story. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storyId, setLocation]);

  const handleChange = (band: AgeBand, section: UiSection, value: string) => {
    const k = getKey(band, section);
    setVariants((v) => ({ ...v, [k]: value }));
    setSaved((s) => ({ ...s, [k]: false }));
  };

  const handleSave = async (band: AgeBand, section: UiSection) => {
    const k = getKey(band, section);
    const content = variants[k] || "";
    if (!content.trim()) return;
    setSaving((s) => ({ ...s, [k]: true }));
    try {
      const res = await fetch(`/api/author/stories/${storyId}/variants`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ age_band: band, override_type: SECTION_TO_OVERRIDE[section], content }),
      });
      if (!res.ok) throw new Error();
      setSaved((s) => ({ ...s, [k]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [k]: false })), 2000);
    } catch {
      // could add an inline error state later
    } finally {
      setSaving((s) => ({ ...s, [k]: false }));
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

  return (
    <PortalShell>
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => setLocation(`/author/stories/${storyId}/edit`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to editor
            </button>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Age variants{storyTitle ? ` - ${storyTitle}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              Optionally tailor key story moments for different age groups. Most stories don't need this - only use it when the emotional content needs meaningful adjustment.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground font-medium">
            <Info className="w-3.5 h-3.5" />
            Optional feature
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-sm px-4 py-3">{error}</div>
        )}

        <Tabs value={activeBand} onValueChange={(v) => setActiveBand(v as AgeBand)}>
          <TabsList className="grid grid-cols-4 w-full mb-6">
            {AGE_BANDS.map((band) => (
              <TabsTrigger key={band.key} value={band.key} className="flex flex-col gap-0.5 h-auto py-2.5">
                <span className="font-semibold text-sm">{band.label}</span>
                <span className="text-[10px] text-muted-foreground font-normal">{band.range}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {AGE_BANDS.map((band) => (
            <TabsContent key={band.key} value={band.key} className="space-y-4 mt-0">
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: `${band.colour}14`, border: `1px solid ${band.colour}30`, color: band.colour }}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: band.colour }} />
                {band.label} readers - {band.range}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SECTIONS.map((section) => {
                  const k = getKey(band.key, section.key);
                  const isSaved = saved[k];
                  const isSaving = saving[k];
                  return (
                    <div key={section.key} className="bg-card rounded-2xl border border-card-border p-5 space-y-3">
                      <div>
                        <h3 className="font-semibold text-sm text-foreground mb-1">{section.label}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{section.description}</p>
                      </div>

                      <Textarea
                        placeholder={`Write the ${section.label.toLowerCase()} for ${band.label} readers...`}
                        value={variants[k] || ""}
                        onChange={(e) => handleChange(band.key, section.key, e.target.value)}
                        rows={4}
                        className="text-sm font-serif leading-relaxed resize-none"
                        style={{ fontFamily: "Georgia, serif" }}
                      />

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {(variants[k] || "").length > 0
                            ? `${(variants[k] || "").length} characters`
                            : "Optional - leave blank to use the main story text"}
                        </span>
                        {(variants[k] || "").length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSave(band.key, section.key)}
                            disabled={isSaving}
                            className={`text-xs h-7 ${isSaved ? "text-emerald-600 border-emerald-300" : ""}`}
                          >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : isSaved ? "Saved" : "Save"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      </div>
    </PortalShell>
  );
}

