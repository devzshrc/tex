import { ArrowRight, CalendarDays, ListChecks, SlidersHorizontal, SquareKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { Eyebrow } from "@/components/shared/primitives";
import { Logo } from "@/components/shared/Logo";
import { navigate } from "@/lib/router";

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-6 px-4 md:px-6">
        <button onClick={() => navigate("/")} aria-label="tex home">
          <Logo />
        </button>
        <nav className="hidden items-center gap-5 text-[13px] text-muted-foreground sm:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={() => navigate("/signin")}>
            Sign in
          </Button>
          <Button size="sm" onClick={() => navigate("/o")}>
            Open app
          </Button>
        </div>
      </div>
    </header>
  );
}

function MockCard({ bars, title, meta }: { bars: string[]; title: string; meta: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-left shadow-xs">
      <div className="mb-1.5 flex gap-1">
        {bars.map((b) => (
          <span key={b} className={`h-1.5 w-8 rounded-full ${b}`} />
        ))}
      </div>
      <p className="text-[13px] leading-snug font-medium">{title}</p>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">{meta}</p>
    </div>
  );
}

function BoardMock() {
  return (
    <figure className="mx-auto w-full max-w-3xl">
      <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3 shadow-lg sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-wide">Backlog <span className="font-normal text-muted-foreground">2</span></p>
          <MockCard bars={["bg-red-500"]} title="Fix login redirect loop" meta="P0 · due fri" />
          <MockCard bars={["bg-blue-500", "bg-gray-500"]} title="Refresh pricing page" meta="3 pts" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-wide">Doing <span className="font-normal text-muted-foreground">2</span></p>
          <MockCard bars={["bg-green-500"]} title="Ship checklist progress" meta="4/5 · MK" />
          <MockCard bars={["bg-purple-500"]} title="Calendar view polish" meta="due tomorrow" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-wide">Done <span className="font-normal text-muted-foreground">1</span></p>
          <MockCard bars={["bg-teal-500"]} title="Dark mode toggle" meta="done · +3" />
        </div>
      </div>
      <figcaption className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
        your boards, exactly like this
      </figcaption>
    </figure>
  );
}

function Hero() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-20 pb-16 text-center md:px-6 md:pt-28">
      <Eyebrow className="text-center">kanban without the bloat</Eyebrow>
      <h1 className="mx-auto mt-4 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl">
        Every card. Every move. Nothing lost.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        tex is a fast, focused board for teams that live in cards — drag-and-drop lists, labels, due dates,
        checklists, files, and custom fields. Nothing you didn't ask for.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <Button size="lg" onClick={() => navigate("/o")}>
          Open the app
          <ArrowRight className="size-4" />
        </Button>
        <Button size="lg" variant="outline" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
          How it works
        </Button>
      </div>
      <p className="mt-5 font-mono text-xs text-muted-foreground">Free · One-click Google sign-in · No credit card.</p>
      <div className="mt-12">
        <BoardMock />
      </div>
    </section>
  );
}

const INCLUDED = [
  "drag-and-drop",
  "labels",
  "due dates",
  "calendar",
  "checklists",
  "attachments",
  "custom fields",
  "templates",
  "votes",
  "dark mode",
];

function Included() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center md:px-6">
        <Eyebrow className="text-center">everything included</Eyebrow>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {INCLUDED.map((item) => (
            <span key={item} className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: SquareKanban,
    title: "Drag anything",
    body: "Lists and cards reorder with smooth drag-and-drop. Optimistic updates keep it instant while the server reconciles.",
  },
  {
    icon: CalendarDays,
    title: "Dates that nag you",
    body: "Due dates with an overdue glow, a calendar view, and a due-soon feed of everything assigned to you.",
  },
  {
    icon: ListChecks,
    title: "Cards with depth",
    body: "Checklists with assignees, file attachments with previews, votes, points, and per-board custom fields.",
  },
  {
    icon: SlidersHorizontal,
    title: "Templates & labels",
    body: "Turn any card into a template and stamp out copies. Nine-color labels keep every board scannable.",
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-14">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center md:px-6">
        <Eyebrow className="text-center">what you get</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-md text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          Boards that stay out of your way.
        </h2>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title} className="shadow-none transition-colors hover:border-ring">
              <CardContent className="p-5">
                <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <f.icon className="size-4 text-foreground" />
                </span>
                <p className="mt-3 text-[15px] font-semibold tracking-tight">{f.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Sign in", body: "One click with Google. No passwords, no forms, no fuss." },
  { n: "02", title: "Make a workspace", body: "Invite the team with a link. Admins run the show, members ship." },
  { n: "03", title: "Drag cards", body: "Todo → Doing → Done. Everything else is details." },
];

function How() {
  return (
    <section id="how" className="scroll-mt-14 border-y border-border bg-muted/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center md:px-6">
        <Eyebrow className="text-center">honestly, it's three steps</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Set it once. Then just work.</h2>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="shadow-none">
              <CardContent className="p-5">
                <p className="font-mono text-xs font-semibold text-primary">{s.n}</p>
                <p className="mt-2 text-[15px] font-semibold tracking-tight">{s.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ["Is tex free?", "Yes — this is a self-hosted build. Run the backend, open the app, done. No seats, no tiers."],
  ["How do I sign in?", "Google OAuth, one click. No passwords are stored anywhere."],
  ["Where is my data?", "In your own Postgres database, files in a local uploads folder. Back them up like anything you care about."],
  ["Can I invite my team?", "Yes — workspace invites travel by link, with admin and member roles."],
  ["Does it work offline?", "Not yet — the app talks to its API over the network. An offline mutation queue is on the roadmap."],
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-14">
      <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center md:px-6">
        <Eyebrow className="text-center">the questions everyone asks</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Frequently asked questions</h2>
        <div className="mt-10 flex flex-col gap-2.5 text-left">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group rounded-lg border border-border bg-card px-4 py-3 shadow-xs open:shadow-none">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {q}
                  <span className="font-mono text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="pt-2 text-[13px] leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center md:px-6">
        <Eyebrow className="text-center">get started</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-md text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          Stop losing track.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[13px] text-muted-foreground">
          Your first board is one click away. Bring the team when you're ready.
        </p>
        <Button className="mt-7" size="lg" onClick={() => navigate("/o")}>
          Open the app
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-10 text-center md:px-6">
        <Logo />
        <p className="font-mono text-xs text-muted-foreground">boards that stay out of your way</p>
        <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <button onClick={() => navigate("/signin")} className="transition-colors hover:text-foreground">Sign in</button>
          <button onClick={() => navigate("/o")} className="transition-colors hover:text-foreground">Open app</button>
        </nav>
        <p className="font-mono text-[11px] text-muted-foreground">© 2026 tex</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main>
        <Hero />
        <Included />
        <Features />
        <How />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
