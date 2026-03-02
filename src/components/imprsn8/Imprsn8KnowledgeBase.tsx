/**
 * Imprsn8KnowledgeBase.tsx — Searchable documentation center for imprsn8.
 * Covers platform features, account statuses, AI agents, and FAQs.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Search, Shield, Users, AlertTriangle, FileText, Eye, Bot,
  CheckCircle2, Clock, AlertCircle, RefreshCw, BookOpen, Zap,
  Globe, Lock, Bell, TrendingUp, Fingerprint, Link2, UserX
} from "lucide-react";

interface KBArticle {
  id: string;
  title: string;
  category: string;
  icon: typeof Shield;
  tags: string[];
  content: string;
}

const CATEGORIES = [
  { key: "all", label: "All", icon: BookOpen },
  { key: "getting-started", label: "Getting Started", icon: Zap },
  { key: "accounts", label: "Accounts", icon: Users },
  { key: "statuses", label: "Statuses", icon: Clock },
  { key: "agents", label: "AI Agents", icon: Bot },
  { key: "reports", label: "Reports", icon: AlertTriangle },
  { key: "takedowns", label: "Takedowns", icon: FileText },
  { key: "security", label: "Security", icon: Lock },
];

const ARTICLES: KBArticle[] = [
  {
    id: "what-is-imprsn8",
    title: "What is imprsn8?",
    category: "getting-started",
    icon: Shield,
    tags: ["overview", "introduction", "protection", "impersonation"],
    content: `**imprsn8** is an AI-powered influencer protection platform that monitors your social media accounts across Twitter/X, Instagram, TikTok, and YouTube for impersonators, look-alike accounts, and brand abuse.

**How it works:**
1. You add your official social media accounts to monitoring
2. Our AI agents continuously scan for accounts impersonating you
3. Detected impersonators are flagged with severity scores
4. You can initiate takedown requests directly from the platform
5. Your followers can also report suspicious accounts via your embeddable widget

imprsn8 operates with **alert-only autonomy** — no automated actions are taken without your review and approval.`,
  },
  {
    id: "adding-accounts",
    title: "How to Add Monitored Accounts",
    category: "getting-started",
    icon: Users,
    tags: ["accounts", "setup", "onboarding", "add"],
    content: `To start monitoring your social media accounts:

1. Navigate to **My Accounts** in the sidebar
2. Click **Add Account**
3. Select the platform (Twitter/X, Instagram, TikTok, or YouTube)
4. Enter your username (without the @ symbol)
5. The profile URL auto-fills, but you can customize it
6. Click **Add Account**

**Account limits** depend on your subscription tier:
- **Free tier**: Up to 3 monitored accounts
- **Paid tier**: Higher limits set by your administrator

Your capacity is shown in the progress bar at the top of the accounts page.`,
  },
  {
    id: "subscription-tiers",
    title: "Subscription Tiers",
    category: "getting-started",
    icon: TrendingUp,
    tags: ["pricing", "free", "paid", "tier", "subscription", "plan"],
    content: `imprsn8 offers two subscription tiers:

**Free Tier**
- Monitor up to 3 social media accounts
- Basic impersonation detection
- Manual takedown request submission
- Community follower reporting widget

**Paid Tier**
- Increased account monitoring limits
- Priority AI scanning with all 7 agents
- Automated DMCA notice generation
- Advanced deepfake detection
- Brand drift monitoring
- Daily reputation risk scores
- Priority support`,
  },
  {
    id: "status-pending",
    title: "What Does 'Pending' Status Mean?",
    category: "statuses",
    icon: Clock,
    tags: ["pending", "status", "waiting", "new", "account"],
    content: `**Pending** means your account has been successfully added to imprsn8 but has not yet been scanned by any of our AI agents.

**Why is my account pending?**
- You just added the account and the next scan cycle hasn't run yet
- The scanner agents run on scheduled intervals (every 30 minutes to 24 hours depending on the scan type)
- The system queues new accounts for the next available scan window

**What to expect:**
- Your account will automatically move to **Scanning** when an agent picks it up
- After the first successful scan, it transitions to **Active**
- No action is required from you — just wait for the next scan cycle

**Typical wait times:**
- Username Variation Scanner: runs every 6 hours
- Bio Matcher: runs every 12 hours  
- Follower Reports processor: runs every 30 minutes
- Full Platform Sweep: runs every 24 hours`,
  },
  {
    id: "status-active",
    title: "What Does 'Active' Status Mean?",
    category: "statuses",
    icon: CheckCircle2,
    tags: ["active", "status", "monitoring", "protected"],
    content: `**Active** means your account is being actively monitored and has been successfully scanned at least once.

This is the healthy, normal state. Our AI agents are continuously watching for:
- Username variations and look-alikes
- Bio/content copying
- Follower-reported suspicious accounts
- Deepfake imagery
- Scam links targeting your audience

The **Last scan** date shows when the most recent scan completed. Scans happen automatically at their prescribed intervals.`,
  },
  {
    id: "status-scanning",
    title: "What Does 'Scanning' Status Mean?",
    category: "statuses",
    icon: RefreshCw,
    tags: ["scanning", "status", "in-progress", "running"],
    content: `**Scanning** means an AI agent is currently analyzing your account right now.

During a scan, agents may:
- Search for username variations across platforms
- Compare bio text and profile images
- Cross-reference known impersonator databases
- Analyze recent follower reports

Scans typically complete in 1-5 minutes. The status returns to **Active** when done.`,
  },
  {
    id: "status-error",
    title: "What Does 'Error' Status Mean?",
    category: "statuses",
    icon: AlertCircle,
    tags: ["error", "status", "problem", "issue", "fix"],
    content: `**Error** means the last scan attempt failed for this account.

**Common causes:**
- The profile URL is incorrect or the account was deleted/suspended
- The platform temporarily blocked our scanner (rate limiting)
- Network connectivity issues during the scan

**How to fix it:**
1. Verify your profile URL is correct by clicking the external link
2. Edit the account to update any incorrect details
3. Wait for the next automatic scan cycle to retry
4. If the error persists, contact your administrator

Errors are automatically retried on the next scan cycle. A single error does not mean your account is unprotected — previous scan results remain valid.`,
  },
  {
    id: "status-verified",
    title: "What Does the 'Verified' Badge Mean?",
    category: "statuses",
    icon: CheckCircle2,
    tags: ["verified", "badge", "confirmed", "authentic"],
    content: `The **Verified** badge (green) confirms that imprsn8 has validated this account genuinely belongs to you.

Verification helps our AI agents:
- Distinguish your real account from impersonators more accurately
- Reduce false positives in detection
- Prioritize protection for confirmed accounts

Verification is typically done by administrators or through platform-level confirmation signals.`,
  },
  {
    id: "agent-doppelganger",
    title: "Doppelgänger Hunter Agent",
    category: "agents",
    icon: Fingerprint,
    tags: ["agent", "doppelganger", "look-alike", "username", "fuzzy", "detection"],
    content: `The **Doppelgänger Hunter** is the primary detection agent that finds accounts impersonating you.

**What it does:**
- Generates username variations (typosquats, underscore/dot tricks, appended numbers)
- Searches across platforms using web scraping via Firecrawl
- Compares profile images using visual similarity analysis
- Uses AI to assess impersonation likelihood

**Schedule:** Every 6 hours
**Rate limiting:** 2-3 second delays between searches, max 20 accounts per run

**Example detections:**
- \`@yourname\` → \`@y0urname\`, \`@yourname_official\`, \`@your.name\``,
  },
  {
    id: "agent-deepfake",
    title: "Deepfake Sentinel Agent",
    category: "agents",
    icon: Eye,
    tags: ["agent", "deepfake", "AI", "image", "fake", "photo", "video"],
    content: `The **Deepfake Sentinel** analyzes images associated with flagged accounts to detect AI-generated or stolen content.

**What it does:**
- Uses vision AI (Gemini) to analyze profile photos and posted images
- Detects signs of AI generation, face-swapping, or manipulation
- Identifies stolen/repurposed photos from your real accounts
- Assigns confidence scores for deepfake likelihood

**Schedule:** Every 12 hours
**Triggers:** Automatically runs on newly flagged impersonation reports`,
  },
  {
    id: "agent-scam-link",
    title: "Scam Link Detector Agent",
    category: "agents",
    icon: Link2,
    tags: ["agent", "scam", "phishing", "link", "url", "malicious"],
    content: `The **Scam Link Detector** monitors for phishing and malicious links that target your audience.

**What it does:**
- Scans bio links and posted URLs from flagged impersonator accounts
- Cross-references with the Trust Radar threat database (phishing, malware, etc.)
- Detects crypto scam patterns, fake giveaway links, and phishing pages
- Flags URLs mimicking your official website or merch store

**Schedule:** Every 4 hours
**Integration:** Leverages Trust Radar's threat intelligence feeds for real-time URL reputation`,
  },
  {
    id: "agent-takedown-orchestrator",
    title: "Takedown Orchestrator Agent",
    category: "agents",
    icon: FileText,
    tags: ["agent", "takedown", "DMCA", "removal", "report", "automated"],
    content: `The **Takedown Orchestrator** automates the process of reporting and removing impersonator accounts.

**What it does:**
- Generates DMCA takedown notices with proper legal formatting
- Tracks platform-specific SLA timelines (Twitter: 24-48h, Instagram: 48-72h, etc.)
- Monitors takedown request status and escalates stalled requests
- Requires **human approval** before submitting any takedown (HITL workflow)

**Schedule:** Every 1 hour (checks for pending approvals and stalled requests)
**Important:** All takedown actions go through the approval queue — nothing is submitted automatically.`,
  },
  {
    id: "agent-follower-shield",
    title: "Follower Shield Agent",
    category: "agents",
    icon: UserX,
    tags: ["agent", "follower", "victim", "exposure", "audience", "protection"],
    content: `The **Follower Shield** estimates how many of your real followers may have been exposed to impersonator accounts.

**What it does:**
- Analyzes engagement patterns on impersonator accounts
- Estimates victim exposure based on follower overlap signals
- Prioritizes impersonators with the highest victim reach
- Alerts you when an impersonator gains significant traction

**Schedule:** Every 12 hours`,
  },
  {
    id: "agent-brand-drift",
    title: "Brand Drift Monitor Agent",
    category: "agents",
    icon: Globe,
    tags: ["agent", "brand", "drift", "merch", "unauthorized", "asset"],
    content: `The **Brand Drift Monitor** searches the web for unauthorized use of your brand assets.

**What it does:**
- Searches for your brand name, logos, and catchphrases across the web
- Detects unauthorized merchandise or products using your likeness
- Identifies fake websites posing as your official presence
- Content fingerprinting to find stolen videos or images

**Schedule:** Every 24 hours`,
  },
  {
    id: "agent-reputation-pulse",
    title: "Reputation Pulse Agent",
    category: "agents",
    icon: TrendingUp,
    tags: ["agent", "reputation", "risk", "score", "grade", "daily"],
    content: `The **Reputation Pulse** computes a daily impersonation risk score for your brand.

**What it does:**
- Calculates an A-F risk grade based on multiple factors
- Factors include: active reports, critical threats, stalled takedowns, deepfake flags
- Tracks score history over time to show trends
- Triggers alerts when your risk score drops significantly

**Schedule:** Daily (once every 24 hours)

**Grading scale:**
- **A** (90-100): Minimal risk, strong protection
- **B** (75-89): Low risk, minor issues
- **C** (60-74): Moderate risk, attention needed
- **D** (40-59): High risk, action required
- **F** (0-39): Critical risk, immediate action needed`,
  },
  {
    id: "report-sources",
    title: "How Impersonation Reports Are Created",
    category: "reports",
    icon: AlertTriangle,
    tags: ["report", "source", "detection", "follower", "manual", "AI"],
    content: `Impersonation reports come from three sources:

**1. AI Agent Detection** (source: "agent")
Our AI agents automatically create reports when they find suspicious accounts. These include similarity scores and AI analysis.

**2. Follower Reports** (source: "follower_report")
Your followers can submit reports through the embeddable widget you place on your website or link in your bio.

**3. Manual Reports** (source: "manual")
You or your admin can manually create reports for accounts you've discovered yourself.

**Report severity levels:**
- 🔴 **Critical**: High-confidence match, verified impersonation
- 🟠 **High**: Strong signals of impersonation
- 🟡 **Medium**: Moderate similarity, needs review
- 🟢 **Low**: Minor resemblance, likely coincidental`,
  },
  {
    id: "report-statuses",
    title: "Understanding Report Statuses",
    category: "reports",
    icon: AlertTriangle,
    tags: ["report", "status", "new", "reviewing", "confirmed", "dismissed"],
    content: `Reports progress through these statuses:

- **New**: Just detected or submitted, awaiting review
- **Reviewing**: An admin or you have started evaluating the report
- **Confirmed**: Verified as a real impersonation — eligible for takedown
- **Dismissed**: Determined to be a false positive or not impersonation
- **Takedown Requested**: A takedown request has been filed for this report

Only **Confirmed** reports can have takedown requests created against them.`,
  },
  {
    id: "takedown-process",
    title: "How Takedowns Work",
    category: "takedowns",
    icon: FileText,
    tags: ["takedown", "DMCA", "process", "removal", "platform", "report"],
    content: `The takedown process in imprsn8:

**1. Report Confirmation**
An impersonation report must be confirmed before a takedown can be initiated.

**2. Request Creation**
Create a takedown request specifying the type (DMCA, platform report, or legal notice).

**3. AI-Assisted Drafting**
The Takedown Orchestrator agent can generate DMCA notices and platform-specific reports.

**4. Human Approval**
All takedowns require your approval before submission (HITL workflow).

**5. Submission & Tracking**
Once approved, the request is submitted. imprsn8 tracks:
- Platform case IDs
- Expected SLA timelines
- Resolution status

**Platform typical response times:**
- Twitter/X: 24-48 hours
- Instagram: 48-72 hours
- TikTok: 48-72 hours
- YouTube: 24-48 hours`,
  },
  {
    id: "report-widget",
    title: "Follower Report Widget",
    category: "security",
    icon: Bell,
    tags: ["widget", "embed", "follower", "report", "crowdsource"],
    content: `The **Report Widget** lets your followers report suspicious accounts directly to you.

**How to use it:**
1. Go to **Report Widget** in your dashboard
2. Copy your unique widget URL or embed code
3. Place it on your website, link tree, or bio

**What followers see:**
A simple form to submit the impersonator's username, platform, and description. No account required.

**Security:**
- Each influencer gets a unique widget token
- Reports are validated and deduplicated
- Spam protection is built in`,
  },
  {
    id: "data-protection",
    title: "How Your Data Is Protected",
    category: "security",
    icon: Lock,
    tags: ["security", "privacy", "data", "RLS", "encryption"],
    content: `imprsn8 takes data protection seriously:

**Access Control:**
- Row-Level Security (RLS) ensures you can only see your own data
- Admins have separate elevated access for platform management
- All API calls are authenticated

**Data Isolation:**
- Your monitored accounts, reports, and takedowns are isolated to your influencer profile
- Other influencers cannot see your data
- AI agent results are scoped to individual accounts

**Scanning Ethics:**
- We only scan publicly available information
- No private messages or DMs are accessed
- Rate limiting respects platform terms of service
- All scanning uses ethical scraping practices with proper delays`,
  },
];

export function Imprsn8KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ARTICLES.filter((a) => {
      const matchCategory = activeCategory === "all" || a.category === activeCategory;
      if (!q) return matchCategory;
      const matchSearch =
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.content.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-imprsn8" />
          Knowledge Base
        </h3>
        <p className="text-sm text-muted-foreground">
          Everything you need to know about imprsn8 protection
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search articles... (e.g. 'pending', 'takedown', 'deepfake')"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat.key
                ? "bg-imprsn8-gold-dim text-imprsn8 border border-imprsn8/30"
                : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
            }`}
          >
            <cat.icon className="w-3 h-3" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} article{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Articles */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-imprsn8/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              No articles match your search.<br />Try different keywords.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((article) => (
            <AccordionItem key={article.id} value={article.id} className="border rounded-lg px-1 bg-card/50">
              <AccordionTrigger className="px-3 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-imprsn8-gold-dim shrink-0">
                    <article.icon className="w-4 h-4 text-imprsn8" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{article.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] border-imprsn8/20 text-imprsn8">
                        {CATEGORIES.find((c) => c.key === article.category)?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground text-[13px] leading-relaxed whitespace-pre-line">
                  {article.content.split(/(\*\*[^**]+\*\*)/).map((part, i) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {article.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[9px] cursor-pointer hover:bg-imprsn8-gold-dim"
                      onClick={() => setSearch(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
