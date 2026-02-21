/**
 * KnowledgeBase.tsx — Documentation & API reference for the LRX Radar platform.
 *
 * Describes each module, edge function, technical capabilities,
 * and API integration instructions. Synced with platform v3.1.
 */

import { useState } from "react";
import { BookOpen, ChevronRight, Zap, Scan, Shield, Globe, Brain, MessageSquare, Radio, Skull, UsersRound, ShieldCheck, BarChart3, AlertTriangle, Server, Code, Database, Key, ExternalLink, Search, Ticket, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DocSection {
  id: string;
  icon: any;
  title: string;
  category: string;
  description: string;
  capabilities: string[];
  apiEndpoint?: string;
  apiMethod?: string;
  apiPayload?: string;
  apiResponse?: string;
  edgeFunction?: string;
  dataSources?: string[];
}

const sections: DocSection[] = [
  {
    id: "exposure",
    icon: Scan,
    title: "Brand Exposure Engine",
    category: "Detect & Respond",
    description: "Pre-attack brand risk mapping that identifies your organization's attack surface before threat actors exploit it. Scans domains for email spoofing risk, typosquat domains, certificate transparency abuse, credential exposure, and dangling DNS.",
    capabilities: [
      "DMARC/SPF/DKIM configuration analysis",
      "Typosquat domain detection with MX/web activity checks",
      "Certificate Transparency log monitoring for suspicious certs",
      "Credential exposure scoring via breach database lookups",
      "Dangling DNS / subdomain takeover detection",
      "Composite Brand Exposure Index (0-100 score, A-F grade)",
    ],
    apiEndpoint: "/functions/v1/scan-domain",
    apiMethod: "POST",
    apiPayload: '{\n  "domain": "company.com"\n}',
    apiResponse: '{\n  "domain": "company.com",\n  "score": 35,\n  "grade": "C",\n  "overall_risk": "medium",\n  "email_spoofing": { ... },\n  "typosquats": { ... },\n  "certificate_transparency": { ... },\n  "credential_exposure": { ... },\n  "dangling_dns": { ... }\n}',
    edgeFunction: "scan-domain",
    dataSources: ["DNS resolvers", "Certificate Transparency logs", "HIBP API", "CNAME resolution"],
  },
  {
    id: "correlation",
    icon: Zap,
    title: "Signal Correlation Matrix",
    category: "Detect & Respond",
    description: "The core intelligence engine that replaces siloed dashboards with a unified timeline tracking entities across the full attack lifecycle. Correlates external threats with DMARC failures, ATO events, social IOCs, and breach data to generate high-confidence Campaign Alerts with kill-chain stage classification.",
    capabilities: [
      "Cross-signal correlation: threats ↔ DMARC ↔ ATO ↔ Social IOCs ↔ Breaches",
      "AI-powered campaign attribution (Lovable AI / Gemini)",
      "Kill chain stage classification (Preparation → Exploitation)",
      "Kill-chain pipeline visualization with stage-by-stage breakdown",
      "Gap analysis: blind spots and coverage strengths",
      "Automated action recommendations with urgency prioritization",
      "Convergence scoring (0-100) with executive summaries",
      "Cross-signal timeline showing correlated events chronologically",
    ],
    apiEndpoint: "/functions/v1/converged-intel",
    apiMethod: "POST",
    apiPayload: "{}",
    apiResponse: '{\n  "correlations": {\n    "total_threats_7d": 150,\n    "correlated_dmarc_threats": 3,\n    "correlated_ato_threats": 1,\n    ...\n  },\n  "ai_analysis": {\n    "convergence_score": 72,\n    "convergence_grade": "C",\n    "active_campaigns": [...],\n    "executive_summary": "..."\n  }\n}',
    edgeFunction: "converged-intel",
    dataSources: ["threats", "email_auth_reports", "ato_events", "social_iocs", "breach_checks", "threat_news"],
  },
  {
    id: "erasure",
    icon: Shield,
    title: "Takedown & Response Orchestrator",
    category: "Detect & Respond",
    description: "Database-backed response layer for logging and tracking mitigation actions across network, infrastructure, and identity levels. Records blocklist pushes, takedown requests, and session revocations with full audit trail and status tracking.",
    capabilities: [
      "Network Level: Blocklist push logging for Proofpoint/Mimecast SEGs",
      "Infrastructure Level: Takedown request tracking via Netcraft/Bolster",
      "Identity Level: Okta session revocation and step-up MFA logging",
      "Live database-backed action tracking (erasure_actions table)",
      "Status workflow: pending → executing → completed/failed",
      "Analyst attribution — actions tied to authenticated user",
      "Filterable audit timeline with provider and type breakdown",
    ],
    apiEndpoint: "Database-backed — CRUD via Supabase SDK",
    apiMethod: "POST",
    dataSources: ["erasure_actions table", "Proofpoint API", "Mimecast API", "Netcraft API", "Bolster API", "Okta API"],
  },
  {
    id: "investigations",
    icon: Ticket,
    title: "Investigation Tracker",
    category: "Detect & Respond",
    description: "Full-lifecycle case management system for tracking security investigations from detection through resolution. Create tickets from any threat, assign analysts, add notes, and maintain a complete audit trail.",
    capabilities: [
      "Create investigation tickets from any threat or event",
      "Assign to analysts with role-based access",
      "Priority and severity classification",
      "Status workflow: open → in_progress → resolved → closed",
      "Notes and resolution tracking with timestamps",
      "Tag-based categorization for cross-referencing",
      "Source linking — tickets reference originating threat/event",
    ],
    dataSources: ["investigation_tickets table"],
  },
  {
    id: "briefing",
    icon: Brain,
    title: "AI Intelligence Briefing",
    category: "AI Insights",
    description: "AI-generated threat intelligence report that synthesizes all platform data into analyst-ready briefings. Covers threat landscape overview, MITRE ATT&CK mapping, and prioritized recommendations.",
    capabilities: [
      "Natural language threat landscape summary",
      "MITRE ATT&CK technique mapping",
      "Trend analysis across time periods",
      "Automated priority recommendations",
    ],
    apiEndpoint: "/functions/v1/threat-briefing",
    apiMethod: "POST",
    edgeFunction: "threat-briefing",
    dataSources: ["threats", "email_auth_reports", "ato_events", "threat_news"],
  },
  {
    id: "chat",
    icon: MessageSquare,
    title: "Threat Intelligence Q&A",
    category: "AI Insights",
    description: "Streaming AI chat interface for natural language threat data queries. Ask about specific threats, brands, attack types, or trends and get real-time answers from platform data.",
    capabilities: [
      "Natural language threat queries",
      "Real-time streaming responses",
      "Context-aware answers from platform data",
      "Follow-up conversation support",
    ],
    apiEndpoint: "/functions/v1/threat-chat",
    apiMethod: "POST",
    apiPayload: '{\n  "messages": [\n    { "role": "user", "content": "What threats target Microsoft?" }\n  ]\n}',
    edgeFunction: "threat-chat",
  },
  {
    id: "threat-map",
    icon: Globe,
    title: "Global Threat Map",
    category: "Live Monitoring",
    description: "Geographically accurate world map with heat map overlays showing threat density by country. Uses react-simple-maps with interactive zoom, pan, and toggleable Targets/Origins views.",
    capabilities: [
      "Geographic threat density visualization",
      "Interactive zoom and pan controls",
      "Targets vs. Origins toggle view",
      "Country-level threat tooltips with source breakdown",
      "Multi-feed data aggregation (threats, KEV, Tor exits, social IOCs)",
    ],
    dataSources: ["threats", "threat_news", "tor_exit_nodes", "social_iocs"],
  },
  {
    id: "social-ioc",
    icon: Radio,
    title: "Social Media IOC Monitor",
    category: "Live Monitoring",
    description: "Monitors social media feeds for Indicators of Compromise shared by the threat intelligence community. Ingests from TweetFeed and Mastodon hashtag feeds.",
    capabilities: [
      "TweetFeed IOC ingestion (domains, IPs, URLs, hashes)",
      "Mastodon #threatintel hashtag monitoring",
      "IOC type classification and tagging",
      "Confidence scoring",
    ],
    apiEndpoint: "/functions/v1/ingest-tweetfeed, /functions/v1/ingest-mastodon",
    edgeFunction: "ingest-tweetfeed, ingest-mastodon",
    dataSources: ["TweetFeed API", "Mastodon API"],
  },
  {
    id: "dark-web",
    icon: Skull,
    title: "Dark Web Monitor",
    category: "Live Monitoring",
    description: "Checks emails and domains against breach databases, monitors Tor exit node infrastructure, and tracks ransomware group activity.",
    capabilities: [
      "Have I Been Pwned breach lookup",
      "Password compromise checking (k-anonymity)",
      "Tor exit node tracking and correlation",
      "Ransomware group activity monitoring (via ransomwatch)",
    ],
    apiEndpoint: "/functions/v1/check-breach, /functions/v1/check-pwned-password",
    edgeFunction: "check-breach, check-pwned-password, ingest-tor-exits, ingest-ransomwatch",
    dataSources: ["HIBP API", "Tor exit node lists", "Ransomwatch"],
  },
  {
    id: "ato",
    icon: UsersRound,
    title: "Account Takeover War Room",
    category: "Live Monitoring",
    description: "Tracks impossible travel events, credential stuffing attempts, and session hijacking. Displays ATO timeline, risk scoring, and resolution status.",
    capabilities: [
      "Impossible travel detection",
      "Credential stuffing identification",
      "Session hijack tracking",
      "Geolocation-based risk scoring",
      "Resolution workflow management",
    ],
    dataSources: ["ato_events"],
  },
  {
    id: "email-auth",
    icon: ShieldCheck,
    title: "Email Authentication Center",
    category: "Live Monitoring",
    description: "DMARC/SPF/DKIM aggregate report viewer showing authentication funnel pass rates, policy enforcement status, and shadow-IT source detection.",
    capabilities: [
      "SPF → DKIM → DMARC pass rate funnel",
      "Policy enforcement visualization (none/quarantine/reject)",
      "Unauthorized sending source detection",
      "Volume-weighted authentication statistics",
    ],
    dataSources: ["email_auth_reports"],
  },
  {
    id: "feeds",
    icon: Database,
    title: "Threat Feed Ingestion",
    category: "Data Pipeline",
    description: "Edge functions that pull from external threat intelligence feeds and upsert into the platform database with deduplication and batch processing.",
    capabilities: [
      "URLhaus — Malicious URL database",
      "OpenPhish — Phishing URL feed",
      "PhishTank — Community-verified phishing",
      "ThreatFox — IOC sharing platform (Abuse.ch)",
      "SANS ISC — Internet Storm Center advisories",
      "CISA KEV — Known Exploited Vulnerabilities catalog",
      "OTX — AlienVault Open Threat Exchange pulses",
      "Ransomwatch — Ransomware group tracking",
      "Chunked batch upserts (200 records/chunk) for high-volume processing",
    ],
    apiEndpoint: "/functions/v1/ingest-threats",
    apiMethod: "POST",
    apiPayload: '{\n  "source": "urlhaus" | "openphish" | "phishtank"\n}',
    apiResponse: '{\n  "fetched": 250,\n  "new": 12\n}',
    edgeFunction: "ingest-threats, ingest-cisa-kev, ingest-otx-pulses, ingest-threatfox, ingest-sans-isc, ingest-ransomwatch, ingest-tor-exits, ingest-tweetfeed, ingest-mastodon",
  },
  {
    id: "coordinator",
    icon: Workflow,
    title: "Ingestion Coordinator",
    category: "Data Pipeline",
    description: "Orchestration function that dispatches all 10 feed workers in parallel with priority-based scheduling. Runs automatically every 15 minutes via pg_cron and tracks job state in the ingestion_jobs table.",
    capabilities: [
      "Priority-based parallel dispatch of 10 feed workers",
      "Automatic 15-minute scheduling via pg_cron + pg_net",
      "Job state tracking with retry logic (max 3 retries)",
      "Performance metrics: records processed, execution time",
      "Batch size configuration (up to 2000 records)",
      "Error logging and failure recovery",
    ],
    apiEndpoint: "/functions/v1/ingest-coordinator",
    apiMethod: "POST",
    edgeFunction: "ingest-coordinator",
    dataSources: ["ingestion_jobs table", "All feed sources"],
  },
];

const categories = ["Detect & Respond", "AI Insights", "Live Monitoring", "Data Pipeline"];

export function KnowledgeBase() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = sections.filter((s) => {
    const matchesSearch = !searchQuery || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.capabilities.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Knowledge Base
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Technical documentation for every module, edge function, and API endpoint in the LRX Radar platform.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search functions, capabilities, APIs..."
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors",
                !selectedCategory ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors",
                  selectedCategory === cat ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-3">
        {filtered.map((section) => (
          <Card key={section.id} className="border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
            >
              <section.icon className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground">
                    {section.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{section.description}</p>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expandedSection === section.id && "rotate-90")} />
            </button>

            {expandedSection === section.id && (
              <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
                <div className="pt-3">
                  <p className="text-xs text-foreground leading-relaxed">{section.description}</p>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">Capabilities</h4>
                  <div className="space-y-1">
                    {section.capabilities.map((cap, i) => (
                      <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        {cap}
                      </p>
                    ))}
                  </div>
                </div>

                {section.apiEndpoint && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">API Integration</h4>
                    <div className="bg-background rounded-lg p-3 border border-border space-y-2 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold">{section.apiMethod || "GET"}</span>
                        <span className="text-foreground">{section.apiEndpoint}</span>
                      </div>
                      {section.apiPayload && (
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-1">Request Body:</p>
                          <pre className="text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded text-[11px]">{section.apiPayload}</pre>
                        </div>
                      )}
                      {section.apiResponse && (
                        <div>
                          <p className="text-muted-foreground text-[10px] mb-1">Response:</p>
                          <pre className="text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded text-[11px]">{section.apiResponse}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {section.edgeFunction && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">Edge Functions</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {section.edgeFunction.split(", ").map((fn) => (
                        <span key={fn} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                          {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {section.dataSources && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">Data Sources</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {section.dataSources.map((ds) => (
                        <span key={ds} className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                          {ds}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Architecture Note */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            Architecture Notes
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Philosophy:</strong> LRX Radar is the connective tissue — the intelligence layer that correlates threats across vectors and uses incumbent security tools (Proofpoint, Netcraft, Okta) as the muscle for automated erasure.</p>
            <p><strong className="text-foreground">Data Flow:</strong> External feeds → Ingestion Coordinator (15-min cron) → Parallel edge function workers → Database (batch upsert with dedup) → React Query hooks (auto-refresh) → Real-time UI + toast notifications.</p>
            <p><strong className="text-foreground">AI Integration:</strong> Lovable AI Gateway (google/gemini-3-flash-preview) powers briefings, chat Q&A, and correlation analysis without requiring external API keys.</p>
            <p><strong className="text-foreground">Auth:</strong> Email + password + Google OAuth via Lovable Cloud Auth. Role-based access (admin/analyst/customer) controls module visibility through access groups.</p>
            <p><strong className="text-foreground">Response Layer:</strong> Erasure actions are persisted to the erasure_actions table with analyst attribution, status workflows, and provider tracking for full audit compliance.</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
