import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import PortalShell from "@/layouts/PortalShell";

interface PersonalisationField {
  id: number;
  field_key: string;
  label: string;
  scope: "profile" | "story";
}

const HINTS: Record<string, string> = {
  child_name: "Hero character name in all scene images.",
  child_age: "Controls the age band shown - adjusts scene complexity and vocabulary.",
  child_photo: "Used to guide the hero's appearance in illustrations.",
  favourite_colour: "Applied to hero clothing and key emotional objects.",
  favourite_animal: "Companion creature in scene images.",
  favourite_food: "Can be woven into cosy or celebratory moments.",
  favourite_place: "Useful for a comforting or familiar setting.",
  best_friend_name: "Secondary character name.",
  pet_name: "Pet companion in scene images.",
  magic_object: "Prominent in the first appearance and climax scenes.",
  special_power: "Visually represented at the story's climax.",
  dream_place: "Primary setting for adventure scenes.",
  hero_name: "Named character for longer or multi-character stories.",
  villain_name: "Antagonist name - appears in conflict scenes.",
  confidence_level: "Used by the platform to adjust tone, not typically referenced directly.",
  friendship_stage: "Used by the platform to adjust tone, not typically referenced directly.",
  current_challenge: "Used by the platform to adjust tone, not typically referenced directly.",
};

const SCOPE_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  profile: {
    bg: "hsl(245 40% 51% / 0.1)", color: "hsl(245 40% 30%)",
    border: "hsl(245 40% 51%)", label: "profile",
  },
  story: {
    bg: "hsl(35 78% 41% / 0.1)", color: "hsl(35 78% 28%)",
    border: "hsl(35 78% 41%)", label: "story",
  },
};

function authHeaders() {
  const token = localStorage.getItem("author_token");
  return { Authorization: `Bearer ${token}` };
}

export default function FieldsPage() {
  const [fields, setFields] = useState<PersonalisationField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/personalisation/fields", { headers: authHeaders() });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setFields(data.fields || []);
      } catch {
        setError("Could not load the field reference. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <PortalShell>
      <div
        className="h-14 flex items-center px-7 shrink-0"
        style={{ background: "hsl(var(--card))", borderBottom: "0.5px solid hsl(var(--border))" }}
      >
        <span className="text-[15px] font-semibold text-foreground">Field reference</span>
      </div>

      <div
        className="flex-1 overflow-y-auto p-6"
        style={{ background: "hsl(var(--background))" }}
      >
        <div className="max-w-4xl">
          <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed max-w-2xl">
            These are all the placeholder fields available in the MeTime Stories platform. Use them in your story content
            to create personalised experiences for every child. Profile fields come from the child's saved profile;
            story fields are collected when a parent starts a story.
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading field reference...</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-sm px-4 py-3">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="bg-card rounded-[10px] border border-card-border shadow-xs overflow-hidden">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr style={{ background: "hsl(var(--muted))" }}>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Placeholder</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Label</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Pipeline hint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, i) => {
                      const ts = SCOPE_STYLE[field.scope] || SCOPE_STYLE.profile;
                      return (
                        <tr
                          key={field.field_key}
                          style={{
                            borderBottom: "0.5px solid hsl(var(--border))",
                            background: i % 2 === 1 ? "hsl(var(--muted) / 0.4)" : "transparent",
                          }}
                        >
                          <td className="px-4 py-2.5">
                            <code
                              className="px-2 py-0.5 rounded text-[12px] font-mono font-medium"
                              style={{ background: ts.bg, color: ts.color }}
                            >
                              {`{{${field.field_key}}}`}
                            </code>
                          </td>
                          <td className="px-4 py-2.5 text-foreground">{field.label}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                              style={{ background: ts.bg, color: ts.color, borderColor: ts.border }}
                            >
                              {ts.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-[12px]">
                            {HINTS[field.field_key] || "Insert this placeholder anywhere it fits naturally in the story."}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap gap-5 text-[12px] text-muted-foreground">
                {Object.entries(SCOPE_STYLE).map(([key, ts]) => (
                  <span key={key} className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-flex"
                      style={{ background: ts.bg, color: ts.color, borderColor: ts.border }}
                    >
                      {ts.label}
                    </span>
                    {key === "profile" ? "Comes from the child's saved profile" : "Asked when a parent starts this story"}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
