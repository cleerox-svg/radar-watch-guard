# Trust Radar & imprsn8 — Complete Platform Documentation

> **Version:** 4.1 · **Operator:** Canadian Owned & Operated · **Architecture:** Investigation Graph + Connective Tissue Engine

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Public-Facing Website (Landing Page)](#2-public-facing-website)
3. [Trust Radar — Authenticated Dashboard](#3-trust-radar-authenticated-dashboard)
4. [imprsn8 — Influencer Protection Platform](#4-imprsn8-influencer-protection-platform)
5. [Backend Architecture](#5-backend-architecture)
6. [Intelligence Feeds (24+ Sources)](#6-intelligence-feeds)
7. [AI Agents (Trust Guardians)](#7-ai-agents)
8. [APIs & Edge Functions](#8-apis--edge-functions)
9. [Authentication, Roles & Access Control](#9-authentication-roles--access-control)
10. [Database Schema Overview](#10-database-schema-overview)

---

## 1. Platform Overview

**Trust Radar** is a Trust Intelligence Platform that monitors, correlates, and responds to threats against brand trust. It ingests data from 24+ intelligence feeds, processes them through AI agents, and presents actionable intelligence to security analysts. It operates as an "Investigation Graph" — connecting signals across the full attack lifecycle (phishing domains, credential leaks, impersonation, email spoofing, dark web activity, infrastructure abuse) into a single correlated view.

**imprsn8** is an integrated sub-platform purpose-built for influencer brand protection. It monitors social media accounts across 8 platforms (X, Instagram, TikTok, YouTube, Twitch, Facebook, LinkedIn, Threads) for impersonation, using AI agents to discover, score, and take down fake accounts. It operates under the same authentication system but has its own distinct UI, theme (dark purple and gold), and navigation.

Both platforms share the same backend infrastructure, user authentication, and AI gateway.

---

## 2. Public-Facing Website

**URL:** https://radar-watch-guard.lovable.app (Landing Page)

The landing page is the public entry point for Trust Radar. It is designed as an invite-only lead generation funnel — there are no direct sign-up links. All access requests are captured as leads.

### 2.1 Hero Section
- **Trust Score Scanner**: A real-time domain scanner that evaluates any domain's trust posture across email authentication (SPF, DKIM, DMARC), impersonation risk, credential exposure, and DNS health. Results are displayed as a letter grade (A+ through F) and a numeric score (0–100).
- **Live Statistics**: Dynamic counters pulled from the database showing:
  - Total threats tracked (from the `threats` table)
  - Active intelligence feeds (from `feed_schedules` where enabled = true)
  - Social IOCs monitored (from `social_iocs` table)
- **Animated Threat Heatmap**: A geographically accurate world map with pulsing markers showing real threat distribution by country, rendered using `react-simple-maps` with live data from the `threats` table.

### 2.2 AI Agents Showcase
A categorized grid of 10 "Trust Guardians" organized into four categories:
- **Detect**: Triage Agent, Threat Hunt Agent, Impersonation Detector
- **Respond**: Takedown Orchestrator, Evidence Preservation, Abuse Mailbox Triage
- **Monitor**: Campaign Correlator, Trust Score Monitor
- **Analyze**: Executive Intel Agent, TrustBot

Each agent card displays its name, description, operational status (Always On, Scheduled, On Demand, etc.), and category badge.

### 2.3 How It Works
A four-step visual flow:
1. **Measure** — Instant Trust Score for any domain
2. **Monitor** — 24/7 continuous monitoring across 24+ feeds
3. **Defend** — Automated response orchestration (takedowns, blocklists, session revocations)
4. **Report** — AI-generated executive briefings with MITRE ATT&CK mapping

### 2.4 Human-in-the-Loop (HITL) Section
Titled "AI Proposes. Humans Decide." — explains the platform's philosophy that AI agents recommend actions but humans approve critical decisions (takedowns, blocklist pushes, session revocations).

### 2.5 Trust Visibility Showcase
Six deep-dive cards covering:
- Campaign Clustering
- Forensic Evidence Capture
- Signal Correlation
- Brand Risk Assessment
- Dark Web Monitoring
- Email Authentication Analysis

### 2.6 Lead Capture
Two primary CTAs:
- **"Request a Briefing"** — Captures name, email, company, and domain into the `scan_leads` table with `submission_type = 'briefing_request'`
- **"Request Platform Access"** — Same form, `submission_type = 'platform_access'`

No self-service sign-up exists. All accounts are provisioned via admin invitation.

### 2.7 Public Scanner
A standalone page (`/scanner`) that allows anyone to run a domain trust score assessment without authentication. Results include SPF/DKIM/DMARC checks, lookalike domain detection, and breach exposure. Lead capture is integrated into the results flow.

---

## 3. Trust Radar — Authenticated Dashboard

**Route:** `/login` → `/` (main dashboard)

Once authenticated, analysts access the full Trust Radar console. The sidebar organizes modules into four categories:

### 3.1 Mission Control

#### Threat Map (`heatmap`)
- Interactive world map showing real-time global threat distribution
- Threats plotted by country with severity-coded markers (critical = red, high = orange, medium = yellow, low = green)
- Click-to-drill-down on any country to see specific threats
- Data source: `threats` table, filtered by `country` field

#### Brand Exposure Engine (`exposure`)
- Attack surface overview showing all brands under monitoring
- Aggregated threat counts by brand, attack type, and severity
- Brand risk scoring combining threat volume, severity distribution, and trend velocity
- Exposure timeline showing threat accumulation over time

#### Critical Alerts (`urgent`)
- Real-time feed of high-severity threats requiring immediate analyst action
- Auto-prioritized by severity (critical first), then by recency
- Includes vulnerability advisories from `threat_news` table (CVEs, vendor/product info)
- One-click investigation ticket creation

#### Daily Briefing (`briefing`)
- AI-generated threat intelligence briefing using Gemini via the Lovable AI Gateway
- Streaming SSE delivery with 12-hour TTL cache (stored in `threat_briefings` table)
- Includes:
  - Executive summary with key findings
  - Top 5 Impacted Brands analysis (Microsoft, Google, PayPal, etc.)
  - Finding drill-downs with correlation logic and evidence
  - Actionable playbook with executable outcomes
  - TLP:AMBER Intelligence Bulletins for external communication
- Chronological history sidebar showing all past briefings
- PDF export capability for board-ready reporting

### 3.2 Investigate

#### Signal Correlation (`correlation`)
- Cross-reference panel that correlates signals across all data sources
- Input any IOC (domain, IP, email, hash) and see connections across:
  - Threat database
  - Social IOCs
  - Breach checks
  - Tor exit nodes
  - Spam trap hits
  - ATO events
- Visual correlation matrix showing relationship strength between indicators

#### Investigations (`investigations`)
- Case management system with auto-generated ticket IDs (format: `LRX-00001`)
- Ticket fields: title, description, severity, priority, status, assigned analyst, tags
- Status workflow: Open → In Progress → Resolved → Closed
- Notes system with timestamped entries (stored as JSONB array)
- Source linking — tickets reference the originating threat, briefing finding, or IOC
- Data source: `investigation_tickets` table

#### Takedown & Response (`erasure`)
- Erasure Orchestrator for dispatching takedown actions
- Action types: DMCA notices, abuse reports, registrar complaints, CERT notifications
- Provider tracking with status pipeline: Pending → Submitted → Acknowledged → Resolved
- Integration with evidence captures for attaching forensic proof
- Data source: `erasure_actions` table

### 3.3 Agents & Automation

#### Agent Hub (`agents`)
- Centralized Agent Command Center managing all Trust Guardian AI agents
- Dashboard showing:
  - Agent health status (active, idle, error)
  - Recent run history with execution logs
  - Items processed vs. items flagged metrics
  - Run duration and performance tracking
- Manual trigger buttons for each agent
- Human-in-the-Loop (HITL) approval queue for pending agent actions
- Approval workflow: Pending → Approved/Rejected (with review notes)
- Data sources: `agent_runs`, `agent_approvals` tables

#### TrustBot (`chat`)
- AI-powered conversational assistant with full database context
- Streaming responses via SSE using Gemini through the Lovable AI Gateway
- Context injection: Every query includes live snapshots of:
  - 100 most recent threats
  - 15 latest vulnerability advisories
  - 10 recent ATO events
  - 30 social IOCs
  - 10 breach check results
  - 20 Tor exit nodes
  - 10 active takedown actions
  - 24 latest feed ingestion health records
- Capabilities: threat analysis, trend comparison, cross-referencing, actionable recommendations
- Markdown-formatted responses with tables, bullet lists, and highlighted findings

### 3.4 Intelligence Feeds

#### Social Intel (`social-monitor`)
- Community-sourced threat indicators from social media
- IOC types: domains, IPs, URLs, hashes
- Confidence scoring (high/medium/low)
- Tagging system for categorization
- Source attribution (TweetFeed, Mastodon, manual submission)
- Data source: `social_iocs` table

#### Dark Web Monitor (`dark-web`)
- Breach and credential exposure monitoring
- Breach checks by email and domain
- Risk level assessment (critical/high/medium/low)
- Breach name tracking with historical records
- Data source: `breach_checks` table

#### Account Takeover (`ato`)
- Suspicious login detection and tracking
- Event types: impossible travel, new device, new location, credential stuffing
- Risk scoring per event (0-100)
- Geographic tracking (location_from → location_to)
- IP address correlation
- Resolution status tracking
- Data source: `ato_events` table

#### Email Authentication (`email`)
- SPF, DKIM, and DMARC compliance monitoring
- Volume tracking by sending source
- DMARC alignment reporting
- Policy tracking (none, quarantine, reject)
- Historical trend analysis
- Data source: `email_auth_reports` table

#### Analytics Dashboard (`stats`)
- Comprehensive feed analytics with dual-view interface:
  - **Command Center Grid**: High-density KPI monitoring (IOC volume, active CVEs, feed health, threat velocity)
  - **Intelligence Narrative**: Vertical storytelling flow of platform health, geographic distribution, and brand risks
- Interactive filters for source-specific analysis
- Data freshness tracking across all feeds

#### Cloud Status Intelligence (`cloud-status`)
- Real-time monitoring of cloud service providers and social media platform status
- **Cloud providers monitored**: AWS, Azure, GCP, Cloudflare, GitHub, Datadog
- **Social media platforms monitored**: Facebook, Instagram, X (Twitter), YouTube, TikTok, Reddit, Discord, Twitch, LinkedIn, Snapchat
- Provider health grid with company logos (via Clearbit API)
- Incident types tracked: outages, degradation, BGP anomalies, DDoS attacks
- Impact scoring per incident (0-100)
- Correlation with Cloudflare Radar (DDoS/internet outages) and BGPStream (routing anomalies)
- Data source: `cloud_incidents` table

### 3.5 Platform (Admin-Only)

#### Knowledge Base (`knowledge`)
- Searchable documentation organized into four pillars:
  - Detect & Respond
  - AI Insights
  - Live Monitoring
  - Data Pipeline
- Technical descriptions of all functions, API integration instructions, data source mappings

#### Spam Trap Intelligence (`spam-traps`)
- Honeypot email address monitoring
- Categorization: spam, phishing, malware delivery
- Sender analysis: email, domain, IP, country
- SPF/DKIM pass/fail tracking
- Brand mention detection in spam content
- Admin-only access (RLS restricted)
- Data source: `spam_trap_hits` table

#### Admin Panel (`admin`)
- User management (invite, revoke, role assignment)
- Access group management (create, edit, delete groups)
- Module permission toggles per group
- Feed schedule management (enable/disable, set intervals)
- Session event monitoring (login/logout audit trail)
- Data sources: `profiles`, `user_roles`, `access_groups`, `user_group_assignments`, `group_module_permissions`, `feed_schedules`, `session_events`

#### Leads Management (`leads`)
- View and manage form submissions from the landing page
- Filter by submission type (brand_scan, briefing_request, platform_access)
- Lead details: name, email, company, phone, domain scanned, scan grade/score
- Data source: `scan_leads` table

---

## 4. imprsn8 — Influencer Protection Platform

**Route:** `/imprsn8`  
**Theme:** Dark Purple & Gold (distinct from Trust Radar's cyan/dark theme)

imprsn8 is accessed via a platform switcher in the sidebar. Influencer users are automatically routed here after login.

### 4.1 Dashboard (`dashboard`)
- Protection overview showing:
  - Total monitored accounts across all platforms
  - Active threats / impersonation reports
  - Pending takedown requests
  - Recent agent activity
- Alert feed showing latest threats and discoveries

### 4.2 Monitored Accounts (`accounts`)
- List of all social media accounts being actively monitored
- Supported platforms: X, Instagram, TikTok, YouTube, Twitch, Facebook, LinkedIn, Threads
- Per-account data:
  - Platform username and URL
  - Current follower/following/post counts
  - Verification status (platform-verified and Trust Radar-verified)
  - Risk score (0-100 Legitimacy Score, where 80-100 = Legitimate, <20 = Confirmed Imposter)
  - Risk category and contributing factors
  - Last scanned timestamp
  - Profile change history count
- Profile snapshot history showing bio, avatar, follower changes over time
- Manual scan trigger per account
- Data sources: `monitored_accounts`, `account_profile_snapshots` tables

### 4.3 Threats Found (`threats`)
- Impersonation reports from all detection sources (AI agents, manual reports, community widget)
- Report fields:
  - Impersonator username, display name, URL
  - Platform
  - Similarity score (0-100%)
  - Severity (critical/high/medium/low)
  - AI analysis (LLM-generated assessment stored as JSONB)
  - Evidence URLs and screenshots
  - Reporter information
- Status workflow: New → Under Review → Confirmed → Resolved / Dismissed
- One-click takedown request creation from any report
- Data source: `impersonation_reports` table

### 4.4 Takedowns (`takedowns`)
- Takedown request tracking with full lifecycle:
  - **Draft** — Request created, evidence being gathered
  - **Submitted** — Sent to platform (with `submitted_at` timestamp)
  - **Acknowledged** — Platform confirmed receipt (with `platform_case_id`)
  - **Resolved** — Account removed or action taken (with `resolved_at` timestamp)
- Request types: DMCA, trademark violation, impersonation report
- Notes field for analyst commentary
- Linked to originating impersonation report
- Data source: `takedown_requests` table

### 4.5 AI Agents (`agents`)
- Agent health dashboard showing all imprsn8-specific agents
- Manual trigger buttons for each agent
- Recent run log with execution details
- See [Section 7.2](#72-imprsn8-agents) for detailed agent descriptions

### 4.6 Settings (`settings`)
- Influencer profile management (display name, bio, avatar, website, brand name)
- Notification preferences (report email for alerts)
- Subscription tier display
- Widget token for community reporting widget

### 4.7 Admin-Only Modules

#### All Influencers (`all_influencers`)
- Master roster of all influencer profiles in the system
- Bulk management capabilities
- Subscription tier overview
- Account limits (max monitored accounts per tier)

#### Admin Console (`admin`)
- Data feeds management (scanner schedules, run logs)
- User and group management within imprsn8 context
- Agent configuration

---

## 5. Backend Architecture

### 5.1 Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives), Framer Motion (animations), Recharts (charts)
- **Data Fetching**: TanStack Query (React Query) with automatic refetch intervals
- **Backend**: Supabase (Lovable Cloud)
  - PostgreSQL database with Row-Level Security (RLS)
  - Edge Functions (Deno runtime) for serverless compute
  - Supabase Auth for authentication
  - Supabase Storage for file uploads (profile avatars)
- **AI Gateway**: Lovable AI Gateway (`ai.gateway.lovable.dev`) proxying to Google Gemini and OpenAI models
- **Email**: Brevo for automated email delivery (invitations, notifications)

### 5.2 Database Design
- **30+ tables** with comprehensive RLS policies
- Role-based access via `user_roles` table (separate from profiles, preventing privilege escalation)
- Group-based module permissions via `access_groups` → `user_group_assignments` → `group_module_permissions` chain
- Composite unique constraints for feed deduplication
- JSONB columns for flexible metadata storage
- Auto-generated ticket IDs via PostgreSQL sequence (`ticket_seq`)
- `updated_at` triggers for automatic timestamp management

### 5.3 Security Model
- **Row-Level Security (RLS)** on every table — no unauthenticated access to sensitive data
- **Security Definer Functions** for role checks (`has_role`, `user_has_module_access`) to avoid recursive RLS evaluation
- **Service Role** isolation — ingestion functions use the service role key, user-facing queries use the anon key with auth context
- **Session Event Logging** — all login/logout events tracked with user agent and IP
- **Idle Timeout** — configurable per-user session timeout with warning dialog
- **Session Revocation** — admin ability to force-logout users by setting `revoked_at` on profiles

### 5.4 Real-Time Capabilities
- Supabase Realtime subscriptions available for live data streaming
- Tables enabled for realtime via `ALTER PUBLICATION supabase_realtime ADD TABLE`
- Used for: live threat feed updates, agent run status changes, approval queue notifications

---

## 6. Intelligence Feeds

Trust Radar ingests data from 24+ specialized threat intelligence sources. These are orchestrated by a central **Ingestion Coordinator** edge function that dispatches parallel workers with a tiered priority system.

### 6.1 Feed Architecture

#### Ingestion Coordinator (`ingest-coordinator`)
- Central orchestrator that triggers all feed workers in parallel
- Tiered priority system (Tiers 1-5):
  - **Tier 1 (Critical)**: ThreatFox, Feodo, PhishTank — core threat indicators
  - **Tier 2 (High)**: CISA KEV, SSL Blocklist, MalBazaar — vulnerability and malware data
  - **Tier 3 (Standard)**: SANS ISC, Ransomwatch, Tor Exits — situational awareness
  - **Tier 4 (Social)**: TweetFeed, Mastodon — community intelligence
  - **Tier 5 (API-Gated)**: AbuseIPDB, VirusTotal, IPQualityScore — rate-limited commercial APIs
- Flexible `records_processed` mapping to handle varied feed response structures
- Circuit-breaker logic for API-gated feeds with 24-hour/1-hour cooldown periods

#### Scheduling
- Automated via PostgreSQL `pg_cron` and `pg_net`
- Configurable intervals per feed (stored in `feed_schedules` table)
- Manual trigger available from Admin Panel

#### Tracking
- All ingestion runs logged in `feed_ingestions` table (source, status, records fetched/new, errors)
- Granular job tracking in `ingestion_jobs` table (batch size, retry count, priority, metadata)

### 6.2 Feed Sources — Detailed Breakdown

#### Tier 1: Core Threat Intelligence

| Feed | Edge Function | Source | Data Type | Update Frequency |
|------|--------------|--------|-----------|-----------------|
| **ThreatFox** | `ingest-threatfox` | abuse.ch | IOCs (domains, IPs, URLs, hashes) | Every 15 min |
| **Feodo Tracker** | `ingest-feodo` | abuse.ch | Botnet C2 servers | Every 30 min |
| **PhishTank Community** | `ingest-phishtank-community` | OpenDNS/Cisco | Verified phishing URLs | Every 30 min |

#### Tier 2: Vulnerability & Malware

| Feed | Edge Function | Source | Data Type | Update Frequency |
|------|--------------|--------|-----------|-----------------|
| **CISA KEV** | `ingest-cisa-kev` | US CISA | Known Exploited Vulnerabilities | Every 6 hours |
| **SSL Blocklist** | `ingest-ssl-blocklist` | abuse.ch | Malicious SSL certificates | Every 30 min |
| **MalBazaar** | `ingest-malbazaar` | abuse.ch | Malware samples & hashes | Every 30 min |

#### Tier 3: Situational Awareness

| Feed | Edge Function | Source | Data Type | Update Frequency |
|------|--------------|--------|-----------|-----------------|
| **SANS ISC** | `ingest-sans-isc` | SANS Institute | Top attacking IPs and ports | Every hour (15s timeout) |
| **Ransomwatch** | `ingest-ransomwatch` | Community | Ransomware group leak sites | Every 6 hours |
| **Tor Exit Nodes** | `ingest-tor-exits` | Tor Project | Active Tor exit node IPs | Every hour |
| **IPsum** | `ingest-ipsum` | Community | Level 3+ reputation-scored IPs | Every hour |
| **Spamhaus DROP** | `ingest-spamhaus-drop` | Spamhaus | Don't Route Or Peer IP lists | Every 6 hours |
| **Blocklist.de** | `ingest-blocklist-de` | blocklist.de | Attack source IPs | Every hour |

#### Tier 4: Social & Community Intelligence

| Feed | Edge Function | Source | Data Type | Update Frequency |
|------|--------------|--------|-----------|-----------------|
| **TweetFeed** | `ingest-tweetfeed` | TweetFeed.live | IOCs shared on X/Twitter | Every 30 min |
| **Mastodon** | `ingest-mastodon` | Mastodon instances | IOCs shared on Mastodon | Every 30 min |

#### Tier 5: API-Gated Commercial Feeds

| Feed | Edge Function | API Key Required | Data Type | Rate Limit |
|------|--------------|-----------------|-----------|-----------|
| **AbuseIPDB** | `ingest-abuseipdb` | `ABUSEIPDB_API_KEY` | IP reputation scores | 1000/day |
| **VirusTotal** | `ingest-virustotal` | `VIRUSTOTAL_API_KEY` | URL/file/domain analysis | 500/day (free tier) |
| **IPQualityScore** | `ingest-ipqualityscore` | `IPQUALITYSCORE_API_KEY` | Fraud scoring | 5000/month |

#### Tier 6: Infrastructure Monitoring

| Feed | Edge Function | Source | Data Type | Update Frequency |
|------|--------------|--------|-----------|-----------------|
| **CertStream** | `ingest-certstream` | Certificate Transparency | New SSL certificate registrations | Continuous (15s windows) |
| **Google Safe Browsing** | `ingest-google-safebrowsing` | Google | Malicious URL database | Every hour |
| **Cloud Status** | `ingest-cloud-status` | Status Pages | CSP/SaaS/Social media outages | Every 15 min |
| **Cloudflare Radar** | `ingest-cloudflare-radar` | Cloudflare | DDoS attacks, internet outages | Every 30 min |
| **BGPStream** | `ingest-bgpstream` | RIPE RIS | BGP routing anomalies | Every 30 min |
| **GreyNoise** | `ingest-greynoise` | GreyNoise | Internet background noise IPs | Every hour |

#### Specialized Feeds

| Feed | Edge Function | Source | Data Type |
|------|--------------|--------|-----------|
| **OTX Pulses** | `ingest-otx-pulses` | AlienVault | Community threat pulses |
| **URLhaus (via abuse.ch)** | Uses `ABUSECH_AUTH_KEY` | abuse.ch | Malware distribution URLs |

### 6.3 Data Flow
```
External Feed API → Edge Function (Deno) → Parse & Normalize → Upsert to PostgreSQL
                                                                    ↓
                                                            Deduplication via
                                                         composite unique constraints
                                                                    ↓
                                                         feed_ingestions log entry
                                                                    ↓
                                                      Available in Dashboard via
                                                         TanStack Query polling
```

### 6.4 Cloud Status — Provider Coverage

The Cloud Status feed monitors 16 providers via their official status page APIs:

**Cloud & SaaS:**
- AWS (health.aws.amazon.com)
- Azure (status.azure.com — RSS feed)
- GCP (status.cloud.google.com — JSON API)
- Cloudflare (cloudflarestatus.com — Statuspage API)
- GitHub (githubstatus.com — Statuspage API)
- Datadog (status.datadoghq.com — Statuspage API)

**Social Media:**
- Facebook/Meta (metastatus.com — Statuspage API)
- X/Twitter (api.twitterstat.us — Statuspage API)
- Reddit (redditstatus.com — Statuspage API)
- Discord (discordstatus.com — Statuspage API)
- Twitch (status.twitch.tv — Statuspage API)
- LinkedIn (linkedin-status.com — Statuspage API)
- Snapchat (status.snapchat.com — Statuspage API)
- TikTok (status.tiktok.com — Statuspage API)

Each provider's incidents are parsed, normalized (severity mapped to critical/high/medium/low, status mapped to active/monitoring/resolved), and upserted with deduplication on `(provider, title, started_at)`.

---

## 7. AI Agents (Trust Guardians)

All AI agents operate through the Lovable AI Gateway, primarily using **Google Gemini** models (gemini-2.5-flash for speed, gemini-2.5-pro for complex analysis). Agents follow a hybrid execution model: scheduled (automated via cron), manual (analyst-triggered), or event-driven (triggered by data changes).

### 7.1 Trust Radar Agents

#### Triage Agent (`agent-triage`)
- **Purpose**: Auto-scores and prioritizes every incoming threat
- **Trigger**: Always On (runs on new threat ingestion)
- **Process**:
  1. Receives new threats from ingestion pipeline
  2. Deduplicates IOCs across all feeds
  3. Assigns severity based on confidence score, source reliability, and attack type
  4. Cross-references against existing threats for campaign linkage
  5. Creates agent approval if action is recommended
- **Output**: Prioritized threat queue with severity assignments
- **Data written**: Updates `threats` table severity/status, creates `agent_approvals` entries

#### Threat Hunt Agent (`agent-hunt`)
- **Purpose**: Correlates data across 24+ feeds to identify campaign clusters
- **Trigger**: Every 6 hours (scheduled) or manual
- **Process**:
  1. Queries recent threats, social IOCs, and breach data
  2. Clusters threats by shared infrastructure (IP ranges, ASNs, registrars, SSL patterns)
  3. Identifies emerging coordinated attacks
  4. Generates campaign cluster records with confidence scores
- **Output**: Campaign clusters with threat linkage and infrastructure patterns
- **Data written**: `campaign_clusters` table, updates `threats` with campaign associations

#### Impersonation Detector (`agent-impersonation`)
- **Purpose**: Monitors for lookalike domains, homoglyph attacks, and brand impersonation
- **Trigger**: Continuous (event-driven from CertStream ingestion)
- **Process**:
  1. Analyzes new SSL certificate registrations from CertStream
  2. Compares against monitored brand names using fuzzy matching
  3. Checks for homoglyph substitutions (e.g., paypa1.com, g00gle.com)
  4. Scores similarity and assigns threat severity
- **Output**: New threat entries for confirmed lookalike domains
- **Data written**: `threats` table with `attack_type = 'impersonation'`

#### Takedown Orchestrator (`agent-takedown-orchestrator`)
- **Purpose**: Drafts and dispatches abuse notices to hosting providers and registrars
- **Trigger**: On demand (human-initiated after threat confirmation)
- **Process**:
  1. Gathers threat evidence (DNS records, WHOIS data, screenshots)
  2. Identifies responsible parties (hosting provider, registrar, abuse contacts)
  3. Generates takedown notice templates (DMCA, trademark, abuse report)
  4. Submits for human approval via HITL queue
  5. Upon approval, creates erasure action records
- **Output**: Takedown requests with drafted notices
- **HITL**: Always requires human approval before any external communication
- **Data written**: `erasure_actions`, `agent_approvals` tables

#### Evidence Preservation Agent (`agent-evidence`)
- **Purpose**: Captures forensic-grade snapshots of threat infrastructure
- **Trigger**: Auto-trigger on new critical/high threats, manual for others
- **Process**:
  1. Performs DNS lookups (A, AAAA, MX, NS, TXT, CNAME records)
  2. Captures WHOIS registration data
  3. Records SSL certificate details
  4. Takes page content snapshots
  5. Generates SHA-256 hashes for integrity verification
  6. Builds chain-of-custody metadata (timestamps, capture method, operator)
- **Output**: Tamper-proof evidence packages
- **Data written**: `evidence_captures` table with `chain_of_custody` JSONB

#### Abuse Mailbox Triage (`agent-abuse-mailbox`)
- **Purpose**: Processes reported phishing emails from the abuse mailbox
- **Trigger**: Always On (event-driven on new submissions)
- **Process**:
  1. Parses incoming email reports (subject, sender, headers)
  2. Extracts IOCs (URLs, domains, IPs, email addresses)
  3. Cross-references extracted IOCs against the threat database
  4. Auto-classifies by severity (phishing, spam, legitimate, malware)
  5. Assigns confidence score
  6. Records auto-actions taken
- **Output**: Classified abuse reports with extracted IOCs
- **Data written**: Updates `abuse_mailbox` table with classification, confidence, extracted IOCs, cross-references

#### Campaign Correlator (`agent-campaign`)
- **Purpose**: Clusters threats by shared infrastructure patterns
- **Trigger**: Scheduled (every 6 hours)
- **Process**:
  1. Analyzes IP ranges, ASN ownership, SSL certificate issuers, and registrar patterns
  2. Groups threats sharing 2+ infrastructure elements
  3. Assigns campaign names and confidence scores
  4. Tracks campaign evolution over time
- **Output**: Campaign cluster records with IOC counts and brand targeting analysis
- **Data written**: `campaign_clusters` table

#### Trust Score Monitor (`agent-trust-monitor`)
- **Purpose**: Tracks brand trust scores and alerts on significant changes
- **Trigger**: Continuous
- **Process**:
  1. Calculates trust score based on: active threat count, severity distribution, email auth compliance, breach exposure, impersonation attempts
  2. Compares against historical scores
  3. Computes delta (change) and assigns grade (A+ through F)
  4. Triggers alerts when score drops below thresholds
- **Output**: Trust score history with factor breakdown
- **Data written**: `trust_score_history` table

#### Executive Intel Agent (`agent-intel`)
- **Purpose**: Produces C-suite briefings and brand risk scorecards
- **Trigger**: Daily (scheduled) or manual
- **Process**:
  1. Aggregates all threat data from the past 24 hours
  2. Queries Gemini to generate executive-level summary
  3. Includes: key findings, brand impact analysis, trend forecasts, recommended actions
  4. Formats for board-ready presentation
- **Output**: Structured briefing stored as JSONB
- **Data written**: `threat_briefings` table

#### TrustBot / Copilot (`agent-copilot`)
- **Purpose**: Interactive AI assistant for analyst queries
- **Trigger**: Interactive (user-initiated via chat)
- **Model**: Google Gemini 3 Flash Preview (streaming)
- **Context Window**: Injected with live snapshots of ALL platform data:
  - 100 threats, 15 advisories, 10 ATO events, 30 social IOCs, 10 breach checks, 20 Tor nodes, 10 erasure actions, 24 ingestion health records
- **Capabilities**:
  - Natural language threat analysis ("What brands are most targeted this week?")
  - Cross-feed correlation ("Are any of our ATO events linked to known phishing domains?")
  - Trend identification ("Show me the trend in credential stuffing attacks")
  - Actionable recommendations ("What should we prioritize today?")
- **Edge Function**: `threat-chat` (streaming SSE response)

### 7.2 imprsn8 Agents

#### Doppelgänger Hunter (`agent-doppelganger-hunter`)
- **Purpose**: Discovers impersonation accounts across social platforms
- **Trigger**: Manual or scheduled daily sweeps
- **Process**:
  1. Takes monitored account data (username, display name, bio, avatar)
  2. Uses Firecrawl to search each platform for similar accounts
  3. Analyzes discovered profiles with Gemini for similarity assessment
  4. Scores similarity (0-100) based on: username similarity, bio overlap, avatar similarity, display name match
  5. Creates impersonation report for any match ≥50%
- **Platforms searched**: X, Instagram, TikTok, YouTube, Facebook, LinkedIn
- **Data written**: `impersonation_reports` table

#### Cross-Platform Discovery Agent (`agent-cross-platform-discovery`)
- **Purpose**: Identifies an influencer's legitimate presence across platforms
- **Trigger**: Automatic on new account addition, weekly sweeps, or manual (Compass icon 🧭)
- **Process**:
  1. Takes a known verified account as the source
  2. Uses Firecrawl to search for matching usernames/display names on other platforms
  3. Analyzes discovered profiles with Gemini
  4. Creates discovery records for human review
- **HITL Review Queue** — Three actions:
  - **Monitor**: Add to continuous monitoring (needs more time to determine)
  - **Safe**: Confirmed legitimate account → auto-promoted to monitored accounts with `verified: true`
  - **Impersonate**: Confirmed threat → creates impersonation report for takedown
- **Data written**: `account_discoveries` table

#### Proactive Sweep Agent (`agent-proactive-sweep`)
- **Purpose**: Actively crawls for impersonation accounts using search engine indexing
- **Trigger**: Scheduled or manual
- **Process**:
  1. For each monitored influencer, generates `site:platform.com "Influencer Name"` queries
  2. Uses Firecrawl Search to perform Google queries (bypasses login-walled platforms)
  3. Scrapes profile metadata from indexed pages
  4. Analyzes scraped data with Gemini for similarity against verified accounts
  5. Logs matches (≥50% similarity) as impersonation reports
- **Key advantage**: Works around platform API restrictions by leveraging search engine indexing
- **Data written**: `impersonation_reports` table

#### Risk Scorer Agent (`agent-risk-scorer`)
- **Purpose**: Evaluates monitored accounts on a Legitimacy Score (0-100)
- **Trigger**: Manual per account, per influencer group, or global "Score All"
- **Scoring Logic**:
  - **80-100**: Legitimate (high follower engagement, consistent posting, verified)
  - **50-79**: Needs Review (some suspicious signals)
  - **20-49**: Suspicious (low engagement, recent creation, copied content)
  - **0-19**: Confirmed Imposter (multiple red flags)
- **Factors analyzed**:
  - Follower-to-following ratio
  - Post frequency and content patterns
  - Account age
  - Cross-reference with Trust Radar feeds (threats, social_iocs, spam_trap_hits)
  - Profile metadata consistency
- **Fallback**: Accounts without fetched profile data get neutral score of 50
- **Data written**: Updates `monitored_accounts` (risk_score, risk_category, risk_factors)

#### Profile Snapshot Agent (`fetch-profile-snapshot`)
- **Purpose**: Captures point-in-time snapshots of monitored account profiles
- **Trigger**: Scheduled or manual
- **Process**:
  1. Fetches current profile data from social platforms via Firecrawl
  2. Compares against previous snapshot to detect changes
  3. Records: display name, bio, avatar (with hash), follower/following/post counts, verification status, location, website
  4. Flags significant changes (name change, bio change, avatar change, follower spike/drop)
- **Data written**: `account_profile_snapshots` table, updates `monitored_accounts` current fields

#### Impersonation Scanner (`agent-imprsn8-scanner`)
- **Purpose**: Lightweight scanner for quick impersonation checks
- **Trigger**: Manual
- **Process**: Simplified version of the Doppelgänger Hunter for ad-hoc checks

#### Additional imprsn8 Agents
- **Brand Drift Monitor** (`agent-brand-drift-monitor`): Watches for gradual changes in monitored account behavior that may indicate compromise
- **Deepfake Sentinel** (`agent-deepfake-sentinel`): Analyzes visual content for AI-generated imagery used in impersonation
- **Follower Shield** (`agent-follower-shield`): Monitors follower lists for bot networks and coordinated follow campaigns
- **Reputation Pulse** (`agent-reputation-pulse`): Tracks sentiment and reputation metrics across platforms
- **Scam Link Detector** (`agent-scam-link-detector`): Identifies malicious links shared by impersonator accounts

---

## 8. APIs & Edge Functions

All backend logic runs as **Supabase Edge Functions** (Deno runtime). Functions are deployed automatically and accessed via:

```
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

### 8.1 Edge Function Inventory

| Function | Auth Required | Purpose |
|----------|--------------|---------|
| `threat-chat` | Yes (Bearer token) | Streaming AI chat with full database context |
| `threat-briefing` | No (JWT disabled) | Generate AI threat briefing |
| `analyze-threat` | No | Deep analysis of a specific threat |
| `scan-domain` | No | Public domain trust score scanner |
| `check-breach` | No | Check email/domain against breach databases |
| `check-pwned-password` | No | Check password against Have I Been Pwned |
| `converged-intel` | No | Combined intelligence query across all feeds |
| `generate-spam-trap-demo` | No | Generate demo spam trap data |
| `invite-analyst` | No | Send analyst invitation email |
| `invite-influencer` | No | Send influencer invitation email |
| `revoke-sessions` | No | Force-revoke user sessions |
| `report-impersonator` | No | Submit impersonation report via widget |
| `fetch-profile-snapshot` | No | Capture social media profile snapshot |
| `ingest-coordinator` | No | Orchestrate all feed ingestion |
| `ingest-*` (20+ functions) | No | Individual feed ingestion workers |
| `agent-*` (15+ functions) | No | Individual AI agent workers |

### 8.2 AI Gateway Integration

All AI functionality routes through the Lovable AI Gateway:

```
Endpoint: https://ai.gateway.lovable.dev/v1/chat/completions
Auth: Bearer <LOVABLE_API_KEY>
Protocol: OpenAI-compatible (chat/completions)
Streaming: SSE (Server-Sent Events)
```

**Models used:**
- `google/gemini-3-flash-preview` — Primary model for TrustBot chat (fast, good reasoning)
- `google/gemini-2.5-flash` — Feed analysis, agent processing (balanced speed/quality)
- `google/gemini-2.5-pro` — Executive briefings, complex correlation (highest quality)

### 8.3 External API Integrations

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| **Firecrawl** | Web scraping and search for imprsn8 agents | `FIRECRAWL_API_KEY` (connector-managed) |
| **AbuseIPDB** | IP reputation scoring | `ABUSEIPDB_API_KEY` |
| **VirusTotal** | URL/file/domain analysis | `VIRUSTOTAL_API_KEY` |
| **IPQualityScore** | Fraud and risk scoring | `IPQUALITYSCORE_API_KEY` |
| **abuse.ch** | ThreatFox, Feodo, MalBazaar, URLhaus | `ABUSECH_AUTH_KEY` |
| **Clearbit** | Company logo fetching for UI | No key (free tier) |
| **Brevo** | Transactional email delivery | Via edge function |

### 8.4 CORS Configuration

All edge functions include permissive CORS headers for cross-origin access from the frontend:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, 
  x-supabase-client-platform, x-supabase-client-platform-version,
  x-supabase-client-runtime, x-supabase-client-runtime-version
```

---

## 9. Authentication, Roles & Access Control

### 9.1 Authentication Flow
1. User receives invitation email (via `invite-analyst` or `invite-influencer` edge function)
2. User creates account with email + password (no anonymous sign-ups)
3. Email verification required before first login (auto-confirm disabled)
4. Upon first login:
   - `handle_new_user` trigger creates profile in `profiles` table
   - If influencer metadata present, `handle_new_influencer` trigger creates `influencer_profiles` entry and assigns `influencer` role
5. Session managed via Supabase Auth (JWT tokens)
6. Login/logout events logged to `session_events` table

### 9.2 Role System
Roles stored in `user_roles` table (separate from profiles for security):

| Role | Access Level |
|------|-------------|
| **admin** | Full access to all modules on both platforms |
| **analyst** | All modules except Admin Panel |
| **customer** | Restricted to: Threat Map, Statistics, Critical Alerts |
| **influencer** | Restricted to: imprsn8 dashboard and all imprsn8 modules |

Role checking uses a `SECURITY DEFINER` function (`has_role`) that bypasses RLS to prevent recursive policy evaluation.

### 9.3 Group-Based Access Control (GBAC)
Beyond roles, fine-grained access is managed through groups:

1. **Access Groups** (`access_groups` table): Named groups (e.g., "SOC Team", "Executive Viewers")
2. **User Assignments** (`user_group_assignments` table): Maps users to groups
3. **Module Permissions** (`group_module_permissions` table): Toggles per-module access per group

The `hasModuleAccess` hook dynamically filters:
- Sidebar navigation (hidden modules become invisible)
- Route guards (direct URL access blocked)
- Data queries (RLS policies enforce server-side)

### 9.4 Session Security
- **Idle Timeout**: Configurable per user (default 30 minutes), stored in `profiles.idle_timeout_minutes`
- **Warning Dialog**: Appears before timeout with option to extend session
- **Session Revocation**: Admin can set `profiles.revoked_at` to force-invalidate all sessions
- **Audit Trail**: All session events (login, logout, timeout, revocation) logged with user agent

---

## 10. Database Schema Overview

### 10.1 Core Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `threats` | Primary threat database (phishing domains, malware, impersonation) | Auth read, service write |
| `threat_news` | Vulnerability advisories and CVEs | Public read, service write |
| `threat_briefings` | AI-generated intelligence briefings | Auth read, service write |
| `social_iocs` | Community-sourced IOCs from social media | Public read, service write |
| `breach_checks` | Email/domain breach exposure results | Auth read, service write |
| `ato_events` | Account takeover detection events | Auth read, service write |
| `tor_exit_nodes` | Active Tor exit node IP addresses | Auth read, service write |
| `spam_trap_hits` | Honeypot email captures | Admin-only read |
| `email_auth_reports` | SPF/DKIM/DMARC compliance reports | Public read, service write |
| `cloud_incidents` | CSP/SaaS/Social media outage tracking | Public read, service write |
| `attack_metrics` | Aggregated attack statistics | Public read, service write |

### 10.2 Investigation & Response Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `investigation_tickets` | Case management with auto-generated IDs | Auth CRUD, admin delete |
| `erasure_actions` | Takedown and removal action tracking | Auth CRUD |
| `evidence_captures` | Forensic evidence with chain of custody | Auth read/create, analyst update |
| `campaign_clusters` | Grouped threat campaigns | Auth read/create, analyst update |
| `abuse_mailbox` | Phishing email triage queue | Auth read, analyst update |

### 10.3 Agent & Automation Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `agent_runs` | Execution logs for all AI agents | Auth read/create, service update |
| `agent_approvals` | HITL approval queue for agent actions | Auth read/create, reviewer update |
| `ingestion_jobs` | Feed ingestion job tracking | Auth read, service write |
| `feed_ingestions` | Feed ingestion result logging | Public read, service write |
| `feed_schedules` | Feed scheduling configuration | Auth read, admin manage |

### 10.4 imprsn8 Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `influencer_profiles` | Influencer account data and settings | Owner read/update, admin full |
| `monitored_accounts` | Social media accounts under monitoring | Owner CRUD, admin full |
| `account_profile_snapshots` | Historical profile data captures | Owner read, admin read/delete |
| `account_discoveries` | Cross-platform discovery results | Owner read/update, admin full |
| `impersonation_reports` | Confirmed/suspected impersonation records | Owner read/update, admin full, public insert |
| `takedown_requests` | Platform removal request tracking | Owner CRUD, admin full |

### 10.5 User & Access Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profile data (display name, avatar, team) | Public read, owner update |
| `user_roles` | Role assignments (admin, analyst, customer, influencer) | Via `has_role` function |
| `access_groups` | Named permission groups | Auth read, admin manage |
| `user_group_assignments` | User-to-group mappings | Auth read, admin manage |
| `group_module_permissions` | Module access toggles per group | Auth read, admin manage |
| `session_events` | Login/logout audit trail | Owner/admin read |
| `scan_leads` | Landing page form submissions | Public insert, admin read |
| `trust_score_history` | Brand trust score tracking over time | Auth read, service write |

### 10.6 Key Database Functions

| Function | Type | Purpose |
|----------|------|---------|
| `has_role(user_id, role)` | SECURITY DEFINER | Check if user has specific role (avoids RLS recursion) |
| `user_has_module_access(user_id, module_key)` | SECURITY DEFINER | Check module-level permission via group chain |
| `handle_new_user()` | Trigger | Auto-create profile on user signup |
| `handle_new_influencer()` | Trigger | Auto-create influencer profile and assign role |
| `generate_ticket_id()` | Trigger | Auto-generate `LRX-XXXXX` investigation ticket IDs |
| `update_updated_at_column()` | Trigger | Auto-update `updated_at` timestamps |
| `cleanup_expired_agent_runs()` | Scheduled | Remove expired agent run records (30-day TTL) |
| `get_hosting_provider_stats()` | SECURITY DEFINER | Aggregate hosting provider intelligence from threats |

---

## Appendix: Environment & Secrets

| Secret | Purpose | Managed By |
|--------|---------|-----------|
| `SUPABASE_URL` | Database connection endpoint | Auto-configured |
| `SUPABASE_ANON_KEY` | Public API key for client auth | Auto-configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key for edge functions | Auto-configured |
| `SUPABASE_DB_URL` | Direct PostgreSQL connection string | Auto-configured |
| `LOVABLE_API_KEY` | AI Gateway authentication | Auto-configured |
| `FIRECRAWL_API_KEY` | Web scraping for imprsn8 agents | Connector-managed |
| `ABUSECH_AUTH_KEY` | abuse.ch feed authentication | Manual |
| `ABUSEIPDB_API_KEY` | AbuseIPDB IP reputation API | Manual |
| `VIRUSTOTAL_API_KEY` | VirusTotal analysis API | Manual |
| `IPQUALITYSCORE_API_KEY` | IPQualityScore fraud API | Manual |

---

*Document generated: March 2026 · Trust Radar v4.1*
