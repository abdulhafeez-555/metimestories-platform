import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import PortalShell from "@/layouts/PortalShell";

interface Persona {
  name: string;
  age: number;
  animal: string;
  colour: string;
  friend: string;
  pet: string;
  power: string;
  magicObject: string;
  dreamPlace: string;
  villain: string;
  food: string;
  place: string;
}

const PERSONAS: Persona[] = [
  { name: "Emma", age: 6, animal: "rabbit", colour: "yellow", friend: "Maya", pet: "Biscuit", power: "talking to animals", magicObject: "golden key", dreamPlace: "a cloud kingdom", villain: "the Shadow", food: "strawberries", place: "the treehouse" },
  { name: "Noah", age: 7, animal: "fox", colour: "blue", friend: "Eli", pet: "Rusty", power: "flying", magicObject: "silver compass", dreamPlace: "an underwater city", villain: "the Storm King", food: "pancakes", place: "the old lighthouse" },
  { name: "Zara", age: 5, animal: "dragon", colour: "purple", friend: "Lena", pet: "Sparkle", power: "making things grow", magicObject: "glowing seed", dreamPlace: "a garden in the sky", villain: "the Frost Witch", food: "mango", place: "grandma's kitchen" },
];

function fillPlaceholders(text: string, p: Persona): string {
  return text
    .replace(/\{\{child_name\}\}/g, p.name)
    .replace(/\{\{child_age\}\}/g, String(p.age))
    .replace(/\{\{favourite_animal\}\}/g, p.animal)
    .replace(/\{\{favourite_colour\}\}/g, p.colour)
    .replace(/\{\{favourite_food\}\}/g, p.food)
    .replace(/\{\{favourite_place\}\}/g, p.place)
    .replace(/\{\{best_friend_name\}\}/g, p.friend)
    .replace(/\{\{pet_name\}\}/g, p.pet)
    .replace(/\{\{special_power\}\}/g, p.power)
    .replace(/\{\{hero_name\}\}/g, p.name)
    .replace(/\{\{villain_name\}\}/g, p.villain)
    .replace(/\{\{magic_object\}\}/g, p.magicObject)
    .replace(/\{\{dream_place\}\}/g, p.dreamPlace)
    .replace(/\{\{child_photo\}\}/g, "[photo]")
    .replace(/\{\{confidence_level\}\}/g, "confident")
    .replace(/\{\{friendship_stage\}\}/g, "close friends")
    .replace(/\{\{current_challenge\}\}/g, "trying something new");
}

function splitScenes(text: string): string[] {
  return text
    .split(/\[\s*scene\s*\]/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

function authHeaders() {
  const token = localStorage.getItem("author_token");
  return { Authorization: `Bearer ${token}` };
}

export default function PreviewPage() {
  const { storyId } = useParams();
  const [, setLocation] = useLocation();
  const [personaIdx, setPersonaIdx] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const persona = PERSONAS[personaIdx];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/author/stories/${storyId}`, { headers: authHeaders() });
        if (res.status === 401) { setLocation("/author/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTitle(data.story?.title || "Untitled story");
        setContent(data.story?.content || "");
      } catch {
        setError("Could not load this story. Please go back and try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storyId, setLocation]);

  if (loading) {
    return (
      <PortalShell>
        <div className="flex-1 flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </PortalShell>
    );
  }

  const scenes = content ? splitScenes(fillPlaceholders(content, persona)) : [];

  return (
    <PortalShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between gap-4 mb-8">
          <button
            onClick={() => setLocation(`/author/stories/${storyId}/edit`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to editor
          </button>

          <div className="flex items-center gap-2 bg-card border border-card-border rounded-xl px-3 py-2 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Previewing as:</span>
            <div className="flex gap-1">
              {PERSONAS.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPersonaIdx(i)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                    i === personaIdx ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {p.name}, {p.age}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-sm px-4 py-3">{error}</div>
        )}

        {!error && (
          <div className="bg-card rounded-3xl border border-card-border shadow-lg overflow-hidden">
            <div
              className="px-10 pt-10 pb-6 text-center border-b border-border"
              style={{ background: "linear-gradient(160deg, hsl(38 35% 97%) 0%, hsl(200 25% 95%) 100%)" }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                MeTime Stories - Preview (approximate)
              </p>
              <h1 className="font-serif text-2xl font-bold text-foreground mb-1">{title}</h1>
              <p className="text-sm text-muted-foreground">
                A story just for <span className="font-semibold text-primary">{persona.name}</span>, age {persona.age}
              </p>
            </div>

            <div className="px-8 md:px-12 py-10 space-y-10">
              {scenes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center italic">
                  This story has no content yet, or no [SCENE] breaks to preview.
                </p>
              )}
              {scenes.map((scene, i) => (
                <div key={i} className="space-y-4">
                  {i > 0 && (
                    <div className="flex items-center gap-4 py-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                        Scene {i + 1}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none">
                    {scene.split("\n\n").filter(Boolean).map((para, j) => (
                      <p
                        key={j}
                        className="font-serif text-base leading-8 text-foreground"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {para.split(persona.name).map((part, k, arr) =>
                          k < arr.length - 1 ? (
                            <span key={k}>
                              {part}
                              <mark
                                className="font-semibold rounded px-0.5 not-italic"
                                style={{ background: "hsl(200 48% 42% / 0.12)", color: "hsl(200 48% 30%)" }}
                              >
                                {persona.name}
                              </mark>
                            </span>
                          ) : (
                            <span key={k}>{part}</span>
                          )
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-8 py-5 border-t border-border bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">
                This is an approximate preview using sample data. Real personalisation, age-adaptive content, and illustrations are applied during production for each real child.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 bg-card rounded-2xl border border-card-border p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Preview profile - {persona.name}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Name", value: persona.name },
              { label: "Age", value: `${persona.age} years old` },
              { label: "Favourite animal", value: persona.animal },
              { label: "Favourite colour", value: persona.colour },
              { label: "Best friend", value: persona.friend },
              { label: "Pet", value: persona.pet },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
