/**
 * Landing.tsx — Public-facing sales pitch page for LRX Radar.
 * Showcases top platform features with hero, feature grid, stats, and CTA.
 */

import { Link } from "react-router-dom";
import { Satellite, Scan, Zap, Shield, Globe, Brain, Radio, Skull, ShieldCheck, UsersRound, ArrowRight, ChevronRight, Ticket, BarChart3, UserCircle, LayoutDashboard, Loader2, Search, ShieldOff, AlertTriangle, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { HeroMapBackground } from "@/components/landing/HeroMapBackground";
import aiBriefingMockup from "@/assets/ai-briefing-mockup.jpg";

const features = [
  {
    icon: Scan,
    title: "Brand Exposure Mapping",
    description: "Pre-attack surface analysis — typosquats, spoofing risk, credential leaks, and dangling DNS — scored into a single Brand Exposure Index.",
    accent: "text-cyan-500",
    accentBg: "bg-cyan-500/10",
  },
  {
    icon: Zap,
    title: "Cross-Signal Correlation",
    description: "AI-powered engine that connects DMARC failures, ATO events, social IOCs, and breach data into high-confidence campaign alerts with kill-chain mapping.",
    accent: "text-amber-500",
    accentBg: "bg-amber-500/10",
  },
  {
    icon: Shield,
    title: "Automated Takedown & Response",
    description: "Orchestrate blocklist pushes to Proofpoint/Mimecast, fire takedown requests via Netcraft/Bolster, and revoke sessions through Okta — all from one console.",
    accent: "text-rose-500",
    accentBg: "bg-rose-500/10",
  },
  {
    icon: Brain,
    title: "AI Threat Briefings",
    description: "Daily AI-generated intelligence reports with MITRE ATT&CK mapping, trend analysis, and prioritized recommendations — ready for your exec team.",
    accent: "text-violet-500",
    accentBg: "bg-violet-500/10",
  },
  {
    icon: Globe,
    title: "Global Threat Heatmap",
    description: "Real-time geographic visualization of threat origins and targets across 10+ intelligence feeds, with interactive drill-down by country and source.",
    accent: "text-emerald-500",
    accentBg: "bg-emerald-500/10",
  },
  {
    icon: Skull,
    title: "Dark Web & Breach Monitoring",
    description: "Continuous credential exposure checks, Tor exit node tracking, and ransomware group activity monitoring — all correlated against your brand assets.",
    accent: "text-orange-500",
    accentBg: "bg-orange-500/10",
  },
  {
    icon: Radio,
    title: "Social IOC Intelligence",
    description: "Automated ingestion from TweetFeed and Mastodon threat intel communities — IOCs classified, tagged, and scored in real time.",
    accent: "text-sky-500",
    accentBg: "bg-sky-500/10",
  },
  {
    icon: UsersRound,
    title: "Account Takeover War Room",
    description: "Impossible travel detection, credential stuffing identification, and session hijack tracking with geolocation risk scoring and resolution workflows.",
    accent: "text-pink-500",
    accentBg: "bg-pink-500/10",
  },
  {
    icon: Ticket,
    title: "Investigation Tracker",
    description: "Full-lifecycle case management — create tickets from any threat, assign analysts, track resolution, and maintain an audit trail across investigations.",
    accent: "text-violet-500",
    accentBg: "bg-violet-500/10",
  },
];




const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Landing() {
  const { user } = useAuth();
  /** Live threat count from the database */
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

  const stats = [
    { value: threatCount != null ? threatCount.toLocaleString() : "—", label: "Threats Tracked" },
    { value: "24+", label: "Intelligence Feeds" },
    { value: "3", label: "Core Modules" },
    { value: "24/7", label: "Continuous Monitoring" },
  ];

  return (
    <div className="min-h-screen bg-background bg-noise">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse" />
              <Satellite className="w-5 h-5 text-primary relative z-10" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-wider text-foreground">LRX RADAR</span>
              <span className="hidden sm:block text-[10px] text-primary font-mono tracking-[0.2em] uppercase">Threat Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/scan">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5">
                <Scan className="w-3.5 h-3.5" />
                Free Scan
              </Button>
            </Link>
            {user ? (
              <>
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="text-xs gap-1.5">
                    <UserCircle className="w-3.5 h-3.5" />
                    Profile
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button size="sm" className="text-xs gap-1.5">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" className="text-xs gap-1.5">
                  Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroMapBackground />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-24 text-center">
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
              LIVE THREAT INTELLIGENCE
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              See Threats Before<br />
              <span className="text-gradient-radar">They See You</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
              LRX Radar is the intelligence layer that correlates threats across your entire attack surface — and uses your existing security tools to neutralize them automatically.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to="/scan">
                <Button size="lg" className="gap-2 text-sm px-8 glow-primary">
                  <Scan className="w-4 h-4" />
                  Try Free Domain Scan
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="gap-2 text-sm px-8">
                  Access Platform
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
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

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Full-Spectrum Threat Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Three core modules cover the entire attack lifecycle — from pre-attack reconnaissance through active correlation to automated response.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 card-interactive"
            >
              <div className={`w-10 h-10 rounded-lg ${feature.accentBg} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-5 h-5 ${feature.accent}`} />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">How It Works</h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
              Three stages, one unified timeline — from detection to neutralization.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Detect", desc: "Continuous ingestion from 10+ threat feeds with automated brand exposure scanning and dark web monitoring.", color: "text-cyan-500" },
              { step: "02", title: "Correlate", desc: "AI connects signals across DMARC, ATO, social IOCs, and breach data — surfacing campaigns humans would miss.", color: "text-amber-500" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative bg-card border border-border rounded-xl p-6"
              >
                <span className={`text-5xl font-extrabold ${item.color} opacity-20 absolute top-4 right-4`}>{item.step}</span>
                <h3 className={`text-lg font-bold ${item.color} mb-2`}>{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}

            {/* Step 03: Respond — expanded with action categories */}
            <motion.div
              custom={2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="relative bg-card border border-border rounded-xl p-6 md:col-span-1"
            >
              <span className="text-5xl font-extrabold text-rose-500 opacity-20 absolute top-4 right-4">03</span>
              <h3 className="text-lg font-bold text-rose-500 mb-3">Respond</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">One-click orchestration through your existing tools — organized into four action categories.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Search, label: "Investigate", desc: "OSINT & WHOIS", color: "text-cyan-500", bg: "bg-cyan-500/10" },
                  { icon: ShieldOff, label: "Defend", desc: "Block & Erasure", color: "text-rose-500", bg: "bg-rose-500/10" },
                  { icon: AlertTriangle, label: "Escalate", desc: "Abuse & LE Reports", color: "text-amber-500", bg: "bg-amber-500/10" },
                  { icon: Eye, label: "Track", desc: "Tickets & Watchlists", color: "text-violet-500", bg: "bg-violet-500/10" },
                ].map((action) => (
                  <div key={action.label} className={`${action.bg} rounded-lg p-2.5 border border-border`}>
                    <action.icon className={`w-3.5 h-3.5 ${action.color} mb-1`} />
                    <p className={`text-[11px] font-bold ${action.color}`}>{action.label}</p>
                    <p className="text-[9px] text-muted-foreground">{action.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Analysis Preview */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-500 text-xs font-mono mb-4">
            <Brain className="w-3.5 h-3.5" /> AI-POWERED ANALYSIS
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            AI Threat Briefings With Actionable Playbooks
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Daily AI-generated intelligence reports with MITRE ATT&CK mapping, campaign identification, and a prioritized action playbook you can execute directly from the platform.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden border border-border shadow-2xl"
        >
          <img
            src={aiBriefingMockup}
            alt="AI Threat Intelligence Briefing with Action Playbook"
            className="w-full h-auto blur-[3px] opacity-70"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <h3 className="text-lg sm:text-xl font-extrabold text-foreground mb-2">Executive Summary • Campaigns • Action Playbook</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mb-4">
              Every briefing includes executable actions — open investigation tickets, push domain blocks, file abuse reports, or generate law enforcement referral templates.
            </p>
            <Link to="/login">
              <Button size="sm" className="gap-2">
                <Brain className="w-4 h-4" />
                Try AI Briefings
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* AI Briefing Request */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-card border border-primary/20 rounded-2xl p-8 sm:p-12 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-primary/5" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-500 text-xs font-mono mb-4">
                <Brain className="w-3.5 h-3.5" /> AI-POWERED
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">
                Get a Free AI Threat Intelligence Briefing
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Our AI analyzes your brand's threat landscape and delivers a personalized intelligence report with MITRE ATT&CK mapping and prioritized recommendations.
              </p>
              <p className="text-xs text-muted-foreground/70 italic">
                A member of our sales team will follow up to discuss your results and how LRX Radar can protect your organization. You can also reach us directly at{" "}
                <a href="mailto:sales@lrxradar.com" className="text-primary hover:underline">sales@lrxradar.com</a>.
              </p>
            </div>
            <AIBriefingForm />
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-card border border-primary/20 rounded-2xl p-8 sm:p-12 text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4">
              Start With a Free Domain Scan
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
              See your brand's exposure score in seconds — no account required. Check email spoofing risk, typosquat domains, credential leaks, and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/scan">
                <Button size="lg" className="gap-2 px-8 glow-primary">
                  <Scan className="w-4 h-4" />
                  Scan Your Domain
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="gap-2 px-8">
                  Request Platform Access
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground tracking-wider">LRX RADAR</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-2">v3.1.0</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-[10px] text-muted-foreground font-mono">🇨🇦 Canadian Owned & Operated</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:sales@lrxradar.com" className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono">
              sales@lrxradar.com
            </a>
            <p className="text-[10px] text-muted-foreground font-mono">
              © {new Date().getFullYear()} LRX Radar · Threat Intelligence Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AIBriefingForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
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
          Our sales team will prepare your AI threat intelligence briefing and contact you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-border rounded-xl p-6 space-y-3">
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name *"
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Work email *"
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company name (optional)"
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number (optional)"
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <Button type="submit" className="w-full gap-2" disabled={submitting || !name.trim() || !email.trim()}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        {submitting ? "Submitting..." : "Request AI Briefing"}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        A member of our sales team will follow up with your personalized report.
        <br />
        Or email us directly at{" "}
        <a href="mailto:sales@lrxradar.com" className="text-primary hover:underline">sales@lrxradar.com</a>
      </p>
    </form>
  );
}
