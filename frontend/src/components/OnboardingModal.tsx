import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  BookOpen, Users, Sparkles, LayoutTemplate, ShieldCheck,
  ArrowRight, ArrowLeft
} from "lucide-react";

interface Step {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: <BookOpen className="w-7 h-7" />,
    iconBg: "bg-primary/10 text-primary",
    title: "Welcome to your writing studio.",
    body: (
      <p className="text-muted-foreground leading-relaxed">
        Let&apos;s show you how MeTime Stories brings your stories to life. It takes two minutes - and we think you&apos;ll love what you discover.
      </p>
    ),
  },
  {
    icon: <Users className="w-7 h-7" />,
    iconBg: "bg-sky-100 text-sky-600",
    title: "One story. Personalised for every child.",
    body: (
      <p className="text-muted-foreground leading-relaxed">
        You write a single story template. MeTime Stories automatically personalises it for every child who reads it - their name, their personality, their world, woven into every page.
      </p>
    ),
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    iconBg: "bg-amber-100 text-amber-600",
    title: "Magic placeholders.",
    body: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Anywhere you want the child&apos;s details to appear, you place a placeholder. The platform swaps it in automatically for each reader.
        </p>
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-0.5 shrink-0">You write</span>
            <p className="font-serif text-sm text-foreground leading-relaxed">
              "One morning,{" "}
              <span className="inline-flex items-center bg-primary/10 text-primary text-xs font-mono px-1.5 py-0.5 rounded font-medium">
                {"{{child_name}}"}
              </span>{" "}
              found a{" "}
              <span className="inline-flex items-center bg-primary/10 text-primary text-xs font-mono px-1.5 py-0.5 rounded font-medium">
                {"{{favourite_animal}}"}
              </span>{" "}
              in the garden."
            </p>
          </div>
          <div className="border-t border-border" />
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 pt-0.5 shrink-0">They read</span>
            <p className="font-serif text-sm text-foreground leading-relaxed italic">
              "One morning, <strong className="not-italic text-amber-600">Emma</strong> found a <strong className="not-italic text-amber-600">rabbit</strong> in the garden."
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <LayoutTemplate className="w-7 h-7" />,
    iconBg: "bg-violet-100 text-violet-600",
    title: "Scene breaks become pages.",
    body: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed">
          Divide your story into scenes using a scene break. Each scene becomes its own beautifully illustrated page in the finished book.
        </p>
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground px-2 tracking-wide">Scene Break</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <p className="text-xs text-muted-foreground">
          You control the pacing. Our illustrators bring each scene to life.
        </p>
      </div>
    ),
  },
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    iconBg: "bg-emerald-100 text-emerald-600",
    title: "Your work is in good hands.",
    body: (
      <p className="text-muted-foreground leading-relaxed">
        Every story you submit is reviewed by our editorial team before it reaches any family. We&apos;re here to support your craft - not rush it. Take your time, write beautifully, and trust that we&apos;ll take care of the rest.
      </p>
    ),
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [dontShow, setDontShow] = useState(false);
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      // TODO: wire to API â€” save "don't show again" preference
      if (dontShow) localStorage.setItem("mts_onboarding_seen", "1");
      onClose();
      setStep(0);
      return;
    }
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handleSkip = () => {
    localStorage.setItem("mts_onboarding_seen", "1");
    onClose();
    setStep(0);
  };

  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent
        className="max-w-[380px] p-0 overflow-hidden rounded-2xl border-border shadow-xl"
        data-testid="onboarding-modal"
      >
        <DialogTitle className="sr-only">Getting started with MeTime Stories</DialogTitle>
        <DialogDescription className="sr-only">A short guide to writing personalised stories for children.</DialogDescription>

        {/* Top decorative bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="px-6 pt-4 pb-5">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Getting started
            </span>
            <button
              onClick={handleSkip}
              data-testid="button-skip-onboarding"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            >
              Skip
            </button>
          </div>

          {/* Animated step content */}
          <div className="relative overflow-hidden" style={{ minHeight: 140 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="space-y-5"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${current.iconBg}`}>
                  {current.icon}
                </div>

                {/* Title */}
                <h2 className="font-serif text-xl font-semibold text-foreground leading-snug">
                  {current.title}
                </h2>

                {/* Body */}
                <div className="text-sm">
                  {current.body}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-4 mb-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                data-testid={`onboarding-dot-${i}`}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  background: i === step
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                }}
              />
            ))}
          </div>

          {/* Don't show again on last step */}
          {isLast && (
            <div className="flex items-center gap-2 mb-5">
              <Checkbox
                id="dont-show"
                checked={dontShow}
                onCheckedChange={(v) => setDontShow(!!v)}
                data-testid="checkbox-dont-show-again"
              />
              <Label htmlFor="dont-show" className="text-sm text-muted-foreground cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={goBack}
                data-testid="button-onboarding-back"
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            )}
            <Button
              onClick={goNext}
              data-testid="button-onboarding-next"
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isLast ? "Start writing" : "Next"}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}







