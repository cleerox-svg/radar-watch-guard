/**
 * Landing.tsx — Trust Radar public landing page.
 * Sections: Trust Score Hero, AI Agents Showcase, How It Works, Social Proof Stats, CTAs.
 */

import { Link } from "react-router-dom";
import {
  Satellite, Scan, Shield, Globe, Brain, ArrowRight, ChevronRight,
  ShieldCheck, Loader2, Bot, Zap, Target, BarChart3,
  UserCircle, LayoutDashboard, Eye, TrendingUp, Radio, Skull,
  Search, Activity, CheckCircle2, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { HeroMapBackground } from "@/components/landing/HeroMapBackground";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" as const },
  }),
};

const agents = [
  {
    icon: Target,
    name: "Triage Agent",
    description: "Auto-scores and prioritizes every incoming threat. Deduplicates IOCs across all feeds and assigns severity in real time.",
    accent: "text-cyan-500",
    accentBg: "bg-cyan-500/10",
    status: "Always On",
  },
  {
    icon: Search,
    name: "Threat Hunt Agent",
    description: "Correlates data across 24+ feeds to identify campaign clusters, shared infrastructure, and emerging coordinated attacks.",
    accent: "text-amber-500",
    accentBg: "bg-amber-500/10",
    status: "Every 6 Hours",
  },
  {
    icon: Shield,
    name: "Response Agent",
    description: "Auto-generates takedown notices, suggests erasure actions, and builds MITRE ATT&CK-aligned mitigation checklists.",
    accent: "text-rose-500",
    accentBg: "bg-rose-500/10",
    status: "On Demand",
  },
  {
    icon: Brain,
    name: "Executive Intel Agent",
    description: "Produces C-suite briefings, brand risk scorecards, and trend forecasts — ready for your board in minutes.",
    accent: "text-violet-500",
    accentBg: "bg-violet-500/10",
    status: "Daily",
  },
  {
    icon: Sparkles,
    name: "Chat Copilot",
    description: "Ask questions in plain language — it queries your threat data, creates investigation tickets, and triggers scans inline.",
    accent: "text-emerald-500",
    accentBg: "bg-emerald-500/10",
    status: "Interactive",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Measure",
    desc: "Instant Trust Score for any domain — email authentication, impersonation risk, credential exposure, and DNS health scored into a single index.",
    color: "text-cyan-500",
    icon: BarChart3,
  },
  {
    step: "02",
    title: "Monitor",
    desc: "24/7 continuous monitoring across 24+ intelligence feeds. AI agents watch for trust erosion — typosquats, breaches, spoofing, and dark web activity.",
    color: "text-emerald-500",
    icon: Eye,
  },
  {
    step: "03",
    title: "Defend",
    desc: "Automated response orchestration — takedown requests, blocklist pushes, session revocations, and abuse reports dispatched from one console.",
    color: "text-rose-500",
    icon: Shield,
  },
  {
    step: "04",
    title: "Report",
    desc: "AI-generated executive briefings with MITRE ATT&CK mapping, trend analysis, and board-ready trust scorecards delivered on schedule.",
    color: "text-violet-500",
    icon: Brain,
  },
];

export default function Landing() {
  const { user } = useAuth();

  const { data: threatCount } = useQuery({
    queryKey: ["threat_count_landing"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("threats")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const { data: feedCount } = useQuery({
    queryKey: ["feed_count_landing"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("feed_schedules")
        .select("*", { count: "exact", head: true })
        .eq("enabled", true);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 120000,
  });

  const feedLabel = feedCount != null && feedCount > 0 ? `${feedCount}+` : "24+";

  const stats = [
    { value: threatCount != null ? threatCount.toLocaleString() : "—", label: "Threats Neutralized" },
    { value: feedLabel, label: "Intelligence Feeds" },
    { value: "5", label: "AI Trust Agents" },
    { value: "24/7", label: "Continuous Monitoring" },
  ];

  return (
    <div className="min-h-screen bg-background bg-noise">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse" />
              <Satellite className="w-4 h-4 sm:w-5 sm:h-5 text-primary relative z-10" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-lg font-extrabold tracking-wider text-foreground">TRUST RADAR</span>
              <span className="hidden sm:block text-[10px] text-primary font-mono tracking-[0.2em] uppercase">Trust Intelligence Platform</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link to="/scan">
              <Button variant="ghost" size="sm" className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 h-8">
                <Scan className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Free</span> Score
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/profile" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8">
                    <UserCircle className="w-3.5 h-3.5" />
                    Profile
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button size="sm" className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 h-8">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 h-8">
                  Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO: Trust Score ═══ */}
      <section className="relative overflow-hidden">
        <HeroMapBackground />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-20 sm:pb-16 lg:pt-32 lg:pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              AI-POWERED TRUST INTELLIGENCE
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Know Your Brand's<br />
              <span className="text-gradient-radar">Trust Score</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              Trust Radar measures, monitors, and defends your brand's digital trust — powered by 5 AI agents that work 24/7 so your customers never have to question if it's really you.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to="/scan">
                <Button size="lg" className="gap-2 text-sm px-8 glow-primary">
                  <Scan className="w-4 h-4" />
                  Get Your Free Trust Score
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 text-sm px-8" onClick={() => {
                const el = document.getElementById('request-access');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>
                Request Access
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF STATS ═══ */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <p className="text-3xl font-extrabold text-gradient-radar">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ AI AGENTS SHOWCASE (Hero-level) ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-500 text-xs font-mono mb-4">
            <Bot className="w-3.5 h-3.5" /> 5 AI TRUST AGENTS
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-foreground">
            Meet Your Autonomous Trust Guardians
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Five specialized AI agents that measure trust, hunt threats, orchestrate response, brief executives, and answer your questions — all working in concert.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.name}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 card-interactive"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${agent.accentBg} flex items-center justify-center`}>
                  <agent.icon className={`w-5 h-5 ${agent.accent}`} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {agent.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{agent.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS: Measure → Monitor → Defend → Report ═══ */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl font-extrabold text-foreground">How Trust Radar Works</h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
              Four stages of trust lifecycle management — from assessment to executive reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative bg-card border border-border rounded-xl p-6"
              >
                <span className={`text-5xl font-extrabold ${item.color} opacity-15 absolute top-4 right-4`}>{item.step}</span>
                <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-3`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <h3 className={`text-lg font-bold ${item.color} mb-2`}>{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRUST VISIBILITY ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-xs font-mono mb-4">
            <Globe className="w-3.5 h-3.5" /> FULL VISIBILITY
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-foreground">
            See What Your Customers See
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Real-time visibility into your brand's trust posture — email authentication health, impersonation attempts, credential exposure, and dark web activity, all on one dashboard.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { icon: ShieldCheck, title: "Email Trust", desc: "SPF, DKIM, and DMARC compliance monitoring — see who can send email as your brand.", color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { icon: Skull, title: "Dark Web Monitoring", desc: "Continuous checks for leaked credentials, ransomware group mentions, and Tor exit node tracking.", color: "text-orange-500", bg: "bg-orange-500/10" },
            { icon: Radio, title: "Community Intel", desc: "Live IOC feeds from security researchers on social platforms — classified and scored in real time.", color: "text-sky-500", bg: "bg-sky-500/10" },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center mb-4`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ AI BRIEFING REQUEST ═══ */}
      <section id="ai-briefing-request" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-card border border-primary/20 rounded-2xl p-5 sm:p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-primary/5" />
          <div className="relative grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-500 text-xs font-mono mb-4">
                <Brain className="w-3.5 h-3.5" /> AI-POWERED
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">
                Get a Free AI Trust Assessment
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Our AI analyzes your brand's trust posture and delivers a personalized intelligence report with risk scoring and prioritized recommendations.
              </p>
              <p className="text-xs text-muted-foreground/70 italic">
                A member of our team will follow up to discuss your results.{" "}
                <a href="mailto:sales@trustradar.com" className="text-primary hover:underline">sales@trustradar.com</a>
              </p>
            </div>
            <AIBriefingForm />
          </div>
        </motion.div>
      </section>

      {/* ═══ REQUEST ACCESS ═══ */}
      <section id="request-access" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-card border border-primary/20 rounded-2xl p-5 sm:p-8 md:p-12 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5" />
          <div className="relative grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono mb-4">
                <ShieldCheck className="w-3.5 h-3.5" /> INVITE-ONLY ACCESS
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">
                Request Platform Access
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Trust Radar is an invite-only platform. Submit your details and our team will review your request and provision your account.
              </p>
              <p className="text-xs text-muted-foreground/70 italic">
                Questions? Reach us at{" "}
                <a href="mailto:sales@trustradar.com" className="text-primary hover:underline">sales@trustradar.com</a>.
              </p>
            </div>
            <AccessRequestForm />
          </div>
        </motion.div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-card border border-primary/20 rounded-2xl p-5 sm:p-8 md:p-12 text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">
              Start With a Free Trust Score
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
              See your brand's trust score in seconds — no account required. Check email authentication, impersonation risk, credential leaks, and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/scan">
                <Button size="lg" className="gap-2 px-8 glow-primary">
                  <Scan className="w-4 h-4" />
                  Get Your Trust Score
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => {
                const el = document.getElementById('request-access');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>
                Request Platform Access
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground tracking-wider">TRUST RADAR</span>
              <span className="text-[10px] text-muted-foreground font-mono">v4.0.0</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">🇨🇦 Canadian Owned & Operated</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4">
            <a href="mailto:sales@trustradar.com" className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono">
              sales@trustradar.com
            </a>
            <p className="text-[10px] text-muted-foreground font-mono">
              © {new Date().getFullYear()} Trust Radar
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Forms ── */

function AIBriefingForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("scan_leads").insert({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        domain_scanned: domain.trim() || null,
        phone: phone.trim() || null,
        submission_type: "ai_briefing",
      });
      setSubmitted(true);
      toast.success("Request submitted!", { description: "Our team will be in touch shortly." });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-background border border-border rounded-xl p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground mb-2">Request Received!</h3>
        <p className="text-sm text-muted-foreground">
          Our team will prepare your AI trust assessment and contact you shortly.
        </p>
      </div>
    );
  }

  const inputCls = "w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-border rounded-xl p-6 space-y-3">
      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className={inputCls} />
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email *" className={inputCls} />
      <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name (optional)" className={inputCls} />
      <input type="text" required value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Your domain (e.g. example.com) *" className={inputCls} />
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (optional)" className={inputCls} />
      <Button type="submit" className="w-full gap-2" disabled={submitting || !name.trim() || !email.trim() || !domain.trim()}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        {submitting ? "Submitting..." : "Request AI Trust Assessment"}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        A member of our team will follow up with your personalized report.
      </p>
    </form>
  );
}

function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("scan_leads").insert({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        phone: phone.trim() || null,
        submission_type: "platform_access",
        metadata: message.trim() ? { message: message.trim() } : {},
      });
      setSubmitted(true);
      toast.success("Access request submitted!", { description: "Our team will review and reach out." });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-background border border-border rounded-xl p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground mb-2">Request Received!</h3>
        <p className="text-sm text-muted-foreground">
          Our team will review your request and provision your account.
        </p>
      </div>
    );
  }

  const inputCls = "w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-border rounded-xl p-6 space-y-3">
      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" className={inputCls} />
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email *" className={inputCls} />
      <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name (optional)" className={inputCls} />
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (optional)" className={inputCls} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us about your use case (optional)" rows={3} className={`${inputCls} resize-none`} />
      <Button type="submit" className="w-full gap-2" disabled={submitting || !name.trim() || !email.trim()}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {submitting ? "Submitting..." : "Request Access"}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Invite-only · Our team will provision your account after review.
      </p>
    </form>
  );
}
