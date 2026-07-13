import { Link } from "wouter";
import { publicAssetUrl } from "@/lib/publicAssetUrl";

const BENEFITS = [
  {
    title: "Your stories, personalised for every child",
    body: "Write one story. Our platform automatically weaves in each child's name, favourite things, and personality - without you writing a single extra word.",
  },
  {
    title: "Real editorial support",
    body: "Every story is reviewed by our editorial team before it reaches a family. You get feedback, not just a publish button.",
  },
  {
    title: "A tool built for craft, not just content",
    body: "Age-adaptive scenes, a proper writing studio, and a placeholder system designed with working children's authors, not engineers.",
  },
];

export default function ForAuthors() {
  return (
    <div className="min-h-screen" style={{ background: "#0c0804", color: "#fef3e2" }}>
      <div className="px-4 sm:px-8 h-16 flex items-center justify-between border-b" style={{ borderColor: "rgba(254,243,226,0.08)" }}>
        <Link href="/" className="font-black text-lg" style={{ fontFamily: "Georgia, serif", color: "#fef3e2" }}>
          MeTime Stories
        </Link>
        <Link
          href="/author/login"
          className="text-sm font-semibold"
          style={{ color: "rgba(254,243,226,0.55)" }}
        >
          Already an author? Sign in
        </Link>
      </div>

      <section className="px-4 sm:px-8 pt-16 pb-14 max-w-3xl mx-auto text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(245,158,11,0.6)" }}>
          For Authors &amp; Illustrators
        </div>
        <h1
          className="font-black leading-[1.1] mb-6"
          style={{ color: "#fef3e2", fontFamily: "Georgia, serif", fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
        >
          Write the story once.
          <br />
          We make it feel written for one child.
        </h1>
        <p className="leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: "rgba(254,243,226,0.55)", fontSize: 17 }}>
          We partner with professional children's book authors and illustrators. You craft the story - the values,
          the world, the heart of it. We handle the personalisation, so every family gets something that feels made
          just for their child.
        </p>
        <Link
          href="/author/register"
          className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] text-base"
          style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)", color: "#1a0800" }}
        >
          Apply to become an author
        </Link>
      </section>

      <section className="px-4 sm:px-8 pb-16 max-w-4xl mx-auto">
        <img
          src={publicAssetUrl("images/illustrator.png")}
          alt="Illustrator creating a character for a Me Time Stories book"
          className="w-full rounded-3xl object-cover shadow-xl"
          style={{ maxHeight: 420 }}
        />
      </section>

      <section className="px-4 sm:px-8 py-16" style={{ background: "rgba(254,243,226,0.03)" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {BENEFITS.map((b) => (
            <div key={b.title}>
              <h3
                className="font-bold mb-2.5 leading-snug"
                style={{ color: "#fef3e2", fontFamily: "Georgia, serif", fontSize: 18 }}
              >
                {b.title}
              </h3>
              <p className="leading-relaxed" style={{ color: "rgba(254,243,226,0.5)", fontSize: 14 }}>
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-8 py-16 max-w-3xl mx-auto">
        <h2
          className="font-black text-center mb-10"
          style={{ color: "#fef3e2", fontFamily: "Georgia, serif", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
        >
          How it works
        </h2>
        <div className="space-y-6">
          {[
            { n: "1", t: "Register and tell us about yourself", d: "A short application - your background, your bio, and a bit about your writing." },
            { n: "2", t: "Write in our studio", d: "A calm, focused editor built for children's stories - placeholders, scene breaks, and age-adaptive content, all in one place." },
            { n: "3", t: "Submit for review", d: "Our editorial team checks every story for safeguarding, age-appropriateness, and platform fit before it goes live." },
            { n: "4", t: "Your story reaches real families", d: "Once approved, your story is personalised automatically for every child who reads it." },
          ].map((step) => (
            <div key={step.n} className="flex gap-4 items-start">
              <div
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
              >
                {step.n}
              </div>
              <div>
                <h4 className="font-bold mb-1" style={{ color: "#fef3e2", fontSize: 15 }}>{step.t}</h4>
                <p className="leading-relaxed" style={{ color: "rgba(254,243,226,0.5)", fontSize: 14 }}>{step.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-8 py-20 text-center border-t" style={{ borderColor: "rgba(254,243,226,0.08)" }}>
        <h2
          className="font-black mb-6"
          style={{ color: "#fef3e2", fontFamily: "Georgia, serif", fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}
        >
          Ready to write for a family tonight?
        </h2>
        <Link
          href="/author/register"
          className="inline-flex items-center gap-2 px-8 py-4 font-bold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] text-base"
          style={{ background: "linear-gradient(135deg, #f97316, #fbbf24)", color: "#1a0800" }}
        >
          Apply to become an author
        </Link>
        <p className="mt-5 text-sm" style={{ color: "rgba(254,243,226,0.4)" }}>
          Already registered?{" "}
          <Link href="/author/login" className="font-semibold underline" style={{ color: "rgba(254,243,226,0.6)" }}>
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
