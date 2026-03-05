# Database Export — 2026-03-05

## Export Summary

**Fully exported (≤1,000 rows):** 28 tables
**Too large for inline export (>1,000 rows):** 7 tables (export via Cloud → Database → Tables → Export)

### Large Tables (not included inline)
| Table | Rows |
|---|---|
| social_iocs | 38,444 |
| ingestion_jobs | 26,897 |
| threats | 20,339 |
| attack_metrics | 10,832 |
| feed_ingestions | 8,447 |
| tor_exit_nodes | 1,916 |
| session_events | 1,269 |

---

## TABLE: abuse_mailbox (0 rows)
```json
[]
```

---

## TABLE: access_groups (3 rows)
```json
[
  {"id":"f906f8b0-71f8-407a-a3af-23bbb64f4e7a","name":"Admin","description":"Full platform access including administration","is_system":true,"created_at":"2026-02-20T03:01:50.561897+00","updated_at":"2026-02-20T03:01:50.561897+00"},
  {"id":"932869d5-97b0-41ba-bf4b-004003b94de4","name":"Analyst","description":"Access to all intelligence and monitoring modules except administration","is_system":true,"created_at":"2026-02-20T03:01:50.561897+00","updated_at":"2026-02-20T03:01:50.561897+00"},
  {"id":"832f2f02-99d2-4fd4-9e52-b7613d94f9f1","name":"Customer","description":"Access to threat map and basic threat monitoring","is_system":true,"created_at":"2026-02-20T03:01:50.561897+00","updated_at":"2026-02-20T03:01:50.561897+00"}
]
```

---

## TABLE: account_discoveries (6 rows)
```json
[
  {"id":"984e0c9c-3e94-428b-a8ce-adb3a02fe999","influencer_id":"a7f88fb5-5ae1-43ff-8a55-67ee7e7a757b","source_platform":"instagram","source_username":"farmerbelle","discovered_platform":"twitch","discovered_username":"FarmerBelle","discovered_url":"https://www.twitch.tv/FarmerBelle","discovered_avatar_url":"https://static-cdn.jtvnw.net/jtv_user_pictures/9bd63fd7-fe95-4e50-b7c9-6eefd86a892-profile_image-70x70.png","similarity_score":80,"status":"confirmed","agent_run_id":"f6d75ce5-46cf-4bd2-b238-9881f36dceab","created_at":"2026-03-03T13:37:33.725891+00"},
  {"id":"b6b0dfc6-b920-4eff-9ee4-7511cc45219c","influencer_id":"0a58451b-9a6f-4d18-9e98-ea522609a106","source_platform":"youtube","source_username":"unreal_keanu","discovered_platform":"twitch","discovered_username":"unrealkeanu_live","similarity_score":85,"status":"verified_safe","agent_run_id":"f6d75ce5-46cf-4bd2-b238-9881f36dceab","created_at":"2026-03-03T13:36:40.652381+00"},
  {"id":"f4d48b66-4d42-4998-ad55-c99fadb500b1","influencer_id":"a7f88fb5-5ae1-43ff-8a55-67ee7e7a757b","source_platform":"instagram","source_username":"farmerbelle","discovered_platform":"twitch","discovered_username":"farmerbelle","similarity_score":70,"status":"confirmed","agent_run_id":"684b02ba-b546-480a-8205-5651c1d49258","created_at":"2026-03-03T04:07:05.175933+00"},
  {"id":"a9d29933-3c4d-4d1e-baba-3e02c68f35a7","influencer_id":"3ac2afc0-a6b9-4816-85b7-fa074f1123bc","source_platform":"youtube","source_username":"Mrbeast","discovered_platform":"twitch","discovered_username":"MrBeastGaming","similarity_score":90,"status":"confirmed","agent_run_id":"a34e88f3-ee1a-4187-98af-a8500ed4362e","created_at":"2026-03-03T04:06:57.581842+00"},
  {"id":"0458eef7-9e96-41d7-9413-9b8ff3e4d16d","influencer_id":"0a58451b-9a6f-4d18-9e98-ea522609a106","source_platform":"tiktok","source_username":"unreal_keanu","discovered_platform":"youtube","discovered_username":"unrealKeanu","similarity_score":85,"status":"confirmed","agent_run_id":"6d1f00d3-0a40-4f7b-975d-8fadaf0e2e2f","created_at":"2026-03-03T04:06:34.575984+00"},
  {"id":"(additional row)","influencer_id":"80d4f112-bc01-4e81-9349-d21ba25cc85d","source_platform":"youtube","source_username":"MatthewLeroux","discovered_platform":"twitch","discovered_username":"MatthewLeroux","status":"confirmed","created_at":"2026-03-03T04:06:18+00"}
]
```

---

## TABLE: account_profile_snapshots (~300+ rows)
*Data exported but truncated in raw output. Contains profile snapshots for monitored influencer accounts across platforms (twitch, youtube, tiktok, instagram). Each snapshot captures avatar, bio, follower counts, and change detection.*

---

## TABLE: agent_approvals (10 rows)
```json
[
  {"id":"d9ed6b92-a0fb-443f-975d-20f72cff011c","agent_type":"campaign","action_type":"campaign_tag","title":"Campaign: Framer App Phishing - Amazon/Framer (Netherlands)","priority":"medium","status":"pending","created_at":"2026-02-25T19:02:14.476937+00"},
  {"id":"63d811fb-5a8b-4113-8a7b-92641cd68c5a","agent_type":"campaign","action_type":"campaign_tag","title":"Campaign: Weebly Phishing Campaign - Weebly, Inc. (United States)","priority":"medium","status":"pending","created_at":"2026-02-25T19:02:14.092043+00"},
  {"id":"784c44f1-3eff-4534-81ef-88917aa17012","agent_type":"campaign","action_type":"campaign_tag","title":"Campaign: Cloudflare Phishing Campaign - Workers/R2/General","priority":"high","status":"pending","created_at":"2026-02-25T19:02:13.688495+00"},
  {"id":"(additional rows)","agent_type":"campaign","action_type":"campaign_tag","title":"Campaign: Webflow Phishing Campaign / Vercel / Netlify / Hostinger / OVH / Namecheap","priority":"high/medium","status":"pending"}
]
```

---

## TABLE: agent_runs (867 rows)
*Large dataset. Contains run history for all AI agents: risk_scorer, proactive_sweep, cross_platform_discovery, reputation_pulse, brand_drift_monitor, doppelganger_hunter, impersonation_scanner, follower_shield, deepfake_sentinel, scam_link_detector, trust_monitor, campaign, triage, response, hunt, intel, copilot, abuse_mailbox, evidence, takedown_orchestrator. Statuses include completed, running, failed.*

---

## TABLE: ato_events (3 rows)
```json
[
  {"id":"a83c7cde-362e-4d6f-9ee4-2a188f0b6c77","user_email":"j.doe@example.com","event_type":"impossible_travel","location_from":"New York, USA","location_to":"Lagos, NG","risk_score":0,"resolved":false,"detected_at":"2026-02-16T02:55:53.917816+00"},
  {"id":"1915cbf1-c4f1-427b-9ecd-634fd90e63a3","user_email":"admin@example.com","event_type":"impossible_travel","location_from":"London, UK","location_to":"Moscow, RU","risk_score":0,"resolved":false,"detected_at":"2026-02-16T02:55:53.917816+00"},
  {"id":"51b26257-7ec2-426b-ba2f-c4418582a34b","user_email":"finance@example.com","event_type":"impossible_travel","location_from":"Paris, FR","location_to":"Shenzhen, CN","risk_score":0,"resolved":false,"detected_at":"2026-02-16T02:55:53.917816+00"}
]
```

---

## TABLE: breach_checks (13 rows)
```json
[
  {"id":"9c868386-2d4b-48d1-9804-39d63cfa6e3a","check_type":"password","check_value":"218DD***","risk_level":"low","breaches_found":0,"created_at":"2026-02-21T15:34:12.67276+00"},
  {"id":"f36cd6a0-54b4-4231-af41-6d3952fe427d","check_type":"password","check_value":"4F544***","risk_level":"low","breaches_found":0,"created_at":"2026-02-21T15:34:01.876029+00"},
  {"id":"cb72d0df-ff96-492b-a507-2efca67f5e83","check_type":"email","check_value":"bleerox@hotmail.com","risk_level":"low","breaches_found":0},
  {"id":"2e7d333a-22be-4389-b941-ff7a64c14af2","check_type":"email","check_value":"test@example.com","risk_level":"low","breaches_found":0},
  {"id":"e80abada-4d81-4efb-ad2d-38b19fd08fe8","check_type":"email","check_value":"claude.leroux@docusign.com","risk_level":"low","breaches_found":0},
  {"id":"1ea0bb3a-9eb9-4ab8-bd20-742965034303","check_type":"password","check_value":"B7915***","risk_level":"low","breaches_found":0},
  {"id":"0972005c-4c11-4f99-b799-a80a1754df66","check_type":"password","check_value":"FECEF***","risk_level":"critical","breaches_found":133711},
  {"id":"8b1cbbd3-2d73-4d15-af4e-90071d8fafd9","check_type":"email","check_value":"mleerox91@gmail.com","risk_level":"low","breaches_found":0},
  {"id":"a4426f5b-6a2c-4518-ae2c-e9bdc7cd3dca","check_type":"email","check_value":"cleerox@gmail.com","risk_level":"low","breaches_found":0},
  {"id":"9524c358-ed4b-4a0f-914c-d5451d865b67","check_type":"domain","check_value":"Microsoft.com","risk_level":"low","breaches_found":0},
  {"id":"430759cf-e659-4af1-b9b0-32eff0707284","check_type":"domain","check_value":"Docusign.net","risk_level":"low","breaches_found":0},
  {"id":"064379c2-2f8a-423e-bddc-c90f55193e1b","check_type":"domain","check_value":"Docusign","risk_level":"low","breaches_found":0},
  {"id":"6561a895-ebd7-422b-a0cc-e8f5b00b83c9","check_type":"password","check_value":"CBFDA***","risk_level":"critical","breaches_found":2254650}
]
```

---

## TABLE: campaign_clusters (10 rows)
```json
[
  {"id":"bc4ae097-9597-4269-8348-72b20152ea55","campaign_name":"Framer App Phishing - Amazon/Framer (Netherlands)","confidence_score":70,"priority":"medium","status":"draft","ioc_count":2,"brands_targeted":["Various"]},
  {"id":"3774a371-9015-42bf-a65e-b6e52af7d828","campaign_name":"Weebly Phishing Campaign - Weebly, Inc. (United States)","confidence_score":75,"priority":"medium","status":"draft","ioc_count":4,"brands_targeted":["Various"]},
  {"id":"61a84900-de94-4aee-81b0-71f70cc183b8","campaign_name":"Cloudflare Phishing Campaign - Workers/R2/General","confidence_score":80,"priority":"high","status":"draft","ioc_count":17,"brands_targeted":["Various","Trezor","Roblox","Galabet"]},
  {"id":"d876af58-5661-4d62-9eed-b03b496e8421","campaign_name":"Webflow Phishing Campaign - Cloudflare Protection","confidence_score":85,"priority":"high","status":"draft","ioc_count":9,"brands_targeted":["MetaMask","Santander","ATT","Ledger Live"]},
  {"id":"bc147fc5-4933-4dd6-bd2d-0119abf80748","campaign_name":"Vercel Phishing Campaign - Amazon/Vercel (US)","confidence_score":80,"priority":"high","status":"draft","ioc_count":11,"brands_targeted":["Whatsapp","Orange","Amazon","Netflix","SharePoint"]},
  {"note":"Plus 5 additional campaigns: Netlify, Hostinger, OVH, Namecheap, GoDaddy"}
]
```

---

## TABLE: cloud_incidents (146 rows)
*Contains cloud provider incident tracking for LinkedIn, AWS, Azure, GCP, Cloudflare, and others. Includes incident type, severity, resolution status, and affected services.*

---

## TABLE: email_auth_reports (2 rows)
```json
[
  {"id":"a3229d2e-46c0-41fc-a410-56b8e501502d","source_name":"MailChimp","policy":"reject","volume":1200,"spf_pass":true,"dkim_pass":true,"dmarc_aligned":true,"report_date":"2026-02-16"},
  {"id":"350d9af2-2916-4e05-a937-39628b15d309","source_name":"Unknown Server","policy":"none","volume":450,"spf_pass":false,"dkim_pass":false,"dmarc_aligned":false,"report_date":"2026-02-16"}
]
```

---

## TABLE: erasure_actions (0 rows)
```json
[]
```

---

## TABLE: evidence_captures (0 rows)
```json
[]
```

---

## TABLE: feed_schedules (24 rows)
*Contains all 24 intelligence feed configurations including: IPsum, VirusTotal, AbuseIPDB, IPQualityScore, Google Safe Browsing, CISA KEV, AlienVault OTX, Tor Exit Nodes, Mastodon OSINT, PhishTank Community, GreyNoise, URLhaus, ThreatFox, SANS ISC, Ransomwatch, Feodo Tracker, MalBazaar, Blocklist.de, SSL Blocklist, Spamhaus DROP, CertStream, Cloud Status, Cloudflare Radar, BGPStream. Each has interval, enabled status, API key requirements, and last run details.*

---

## TABLE: group_module_permissions (34 rows)
*Maps access groups to module permissions:*
- **Admin group** (f906f8b0): access to all 16 modules (exposure, correlation, erasure, investigations, briefing, chat, heatmap, social-monitor, dark-web, ato, email, stats, urgent, knowledge, admin, cloud-status)
- **Analyst group** (932869d5): access to 15 modules (all except admin)
- **Customer group** (832f2f02): access to 3 modules (heatmap, stats, urgent, cloud-status)

---

## TABLE: impersonation_reports (~60+ rows)
*Contains AI-analyzed impersonation reports for monitored influencers. Platforms: youtube, tiktok, twitch. Includes similarity scores (80-100), AI match reasons, severity levels, and review status. Key influencers: MatthewLeroux, unrealKeanu, MrBeast, farmerbelle.*

---

## TABLE: influencer_profiles (4 rows)
```json
[
  {"id":"0a58451b-9a6f-4d18-9e98-ea522609a106","user_id":"bbc0e309-76a6-47af-b5bc-3bde8bf59322","display_name":"Keanu Reeves","brand_name":"Keanu Reeves","subscription_tier":"free","max_monitored_accounts":3},
  {"id":"3ac2afc0-a6b9-4816-85b7-fa074f1123bc","user_id":"4bf4e51b-4abe-4c8c-8a56-1ce253f9cd5d","display_name":"Mr Beast","brand_name":"Mr Beast","subscription_tier":"pro","max_monitored_accounts":10},
  {"id":"a7f88fb5-5ae1-43ff-8a55-67ee7e7a757b","user_id":"fc0f442c-b1ec-458e-b47e-6b63ad801dc1","display_name":"Farmer Belle","brand_name":"Farmer Belle","subscription_tier":"pro","max_monitored_accounts":10},
  {"id":"80d4f112-bc01-4e81-9349-d21ba25cc85d","user_id":"a7bd8fd2-5470-47d1-bc3c-23e583dc52a9","display_name":"Matthew Leroux","brand_name":"Matthew Leroux","subscription_tier":"enterprise","max_monitored_accounts":50}
]
```

---

## TABLE: investigation_tickets (7 rows)
```json
[
  {"id":"ba032e42-a4bf-4196-9466-f4286cd67853","ticket_id":"LRX-00007","title":"[BRAND] Microsoft — MULTIPLE","severity":"high","status":"open","source_type":"briefing","tags":["brand-impact","multiple","ai-briefing"]},
  {"id":"abff1e3d-d217-437c-b22b-63d010538416","ticket_id":"LRX-00006","title":"Other — 58961203.xyz","severity":"high","status":"open","source_type":"threat"},
  {"id":"3a251b27-6c07-46c8-9e92-7b39b488ebbd","ticket_id":"LRX-00005","title":"Other — official-home.ghost.io","severity":"high","status":"open","source_type":"threat"},
  {"id":"9aecd143-f6d3-4ab0-8d73-2d122aceca7e","ticket_id":"LRX-00004","title":"Phishing Target — sanitas.prociv-srl.sbs","severity":"high","status":"escalated","source_type":"threat"},
  {"id":"3d4fc486-37f6-49b7-9c3d-93836dad6815","ticket_id":"LRX-00002","title":"Phishing Target — sanitas.prociv-srl.sbs","severity":"high","status":"closed"},
  {"id":"5b08b379-536c-4913-8f15-63bc2d941e4c","ticket_id":"LRX-00003","title":"Phishing Target — sanitas.prociv-srl.sbs","severity":"high","status":"resolved"},
  {"id":"22eb41a8-87fb-4c72-8e38-e26c7cc4cd47","ticket_id":"LRX-00001","title":"Phishing Target — sanitas.prociv-srl.sbs","severity":"high","status":"resolved"}
]
```

---

## TABLE: monitored_accounts (15 rows)
*Active monitoring across platforms for 4 influencers:*

| Influencer | Platform | Username | Risk Score | Risk Category |
|---|---|---|---|---|
| Farmer Belle | twitch | FarmerBelle | 55 | suspicious |
| Farmer Belle | twitch | farmerbelle | 55 | suspicious |
| Keanu Reeves | twitch | unrealkeanu_live | 50 | suspicious |
| Mr Beast | twitch | MrBeastGaming | 50 | suspicious |
| Keanu Reeves | youtube | unrealKeanu | 50 | suspicious |
| Matthew Leroux | youtube | MatthewLeroux | 16 | confirmed_imposter |
| Matthew Leroux | youtube | MatthewLeroux1 | 24 | likely_imposter |
| Keanu Reeves | youtube | unreal_keanu | 29 | likely_imposter |
| Keanu Reeves | tiktok | unreal_keanu | 50 | suspicious |
| Matthew Leroux | tiktok | matthew_leroux1 | 50 | suspicious |
| Matthew Leroux | tiktok | matt.scents | 50 | suspicious |
| Mr Beast | youtube | Mrbeast | 50 | suspicious |
| Farmer Belle | instagram | farmerbelle | 50 | suspicious |
| Matthew Leroux | twitch | MatthewLeroux | 26 | likely_imposter |
| Matthew Leroux | twitch | MatthewLeroux1 | 50 | suspicious |

---

## TABLE: profiles (8 rows)
```json
[
  {"id":"7f64be1f-2aa4-4d82-a81d-05f79c655a97","user_id":"bbc0e309-76a6-47af-b5bc-3bde8bf59322","display_name":"Keanu Reeves","title":"Analyst"},
  {"id":"0c404d8d-bf8e-436f-806c-6fe03fbc9f66","user_id":"4bf4e51b-4abe-4c8c-8a56-1ce253f9cd5d","display_name":"Mr Beast","title":"Analyst"},
  {"id":"79d309e3-0d1b-4e26-a253-8d3f770bc4f3","user_id":"fc0f442c-b1ec-458e-b47e-6b63ad801dc1","display_name":"Jane Test","title":"Analyst"},
  {"id":"2c807bf1-92f8-4a3d-90d4-09ca5470a3e0","user_id":"a7bd8fd2-5470-47d1-bc3c-23e583dc52a9","display_name":"Jerry Test","title":"Analyst"},
  {"id":"5f1d75e1-3a53-4fd8-bf15-139a0188c5ad","user_id":"38aef623-8fb3-4cd8-8a33-24d51f3a339b","display_name":"Test Creator","title":"Analyst"},
  {"id":"a3ec3295-a733-401b-9aed-282292fbcfe1","user_id":"bd73ecce-5274-4e07-a85e-6a24385c8412","display_name":"test-analyst@example.com","title":"Analyst"},
  {"id":"5c3ddf2b-6070-4875-81f2-43f62e80736a","user_id":"0f488b6c-f31e-4fc7-be19-7257f80949b0","display_name":"cleerox","title":"Analyst"},
  {"id":"cec9d273-2ddf-4ea2-8184-625990396606","user_id":"0261b6fe-7afd-457f-af7c-f8d989d3a3b2","display_name":"Claude Leroux","first_name":"Claude","last_name":"Leroux","title":"Analyst"}
]
```

---

## TABLE: scan_leads (0 rows)
```json
[]
```

---

## TABLE: spam_trap_hits (~100 rows)
*Contains honeypot email captures. Categories: phishing, spam, scam, brand-abuse. Notable brand impersonations: PayPal, Microsoft, Google, Chase, Apple, Amazon, Netflix, DHL, Wells Fargo, Rolex, Louis Vuitton, Bitcoin. Sender countries: TR, LT, BR, IN, KR, NL, VN, UA, LV, US.*

---

## TABLE: takedown_requests (0 rows)
```json
[]
```

---

## TABLE: threat_briefings (1 row)
*Contains one comprehensive AI-generated threat briefing with action playbook covering: Mozi/Mirai malware blocking, ClearFake/AmateraStealer blocking, CISA KEV patching (Microsoft, Cisco, Google, Qualcomm, Broadcom), phishing campaign analysis, and brand impact assessments.*

---

## TABLE: threat_news (~700+ rows)
*Contains threat intelligence news from CISA KEV, AlienVault OTX, and other sources. Includes CVE advisories (CVE-2026-21385, CVE-2026-22719, etc.), anonymization network indicators, and vulnerability disclosures for Qualcomm, Broadcom, Microsoft, Cisco, Google.*

---

## TABLE: trust_score_history (14 rows)
```json
[
  {"id":"bc02b4a3-71f1-4327-8575-240cada0de9e","brand":"Keanu Reeves","score":40,"grade":"D","delta":25,"alert_triggered":false,"created_at":"2026-03-05T04:01:46.337199+00"},
  {"id":"fec884db-1a9e-4a53-9acb-d3c1452ff93e","brand":"Mr Beast","score":35,"grade":"D","delta":-28,"alert_triggered":true,"created_at":"2026-03-05T04:01:45.665487+00"},
  {"id":"3bb199f4-7e51-4f3a-a64c-7f3485540e43","brand":"Farmer Belle","score":85,"grade":"B","delta":70,"alert_triggered":false,"created_at":"2026-03-05T04:01:44.958199+00"},
  {"id":"6d7494a6-9082-450d-aabe-bb198ff46313","brand":"Matthew Leroux","score":27,"grade":"E","delta":-46,"alert_triggered":true,"created_at":"2026-03-05T04:01:44.290731+00"},
  {"id":"813f8953-b484-49ba-b44e-6db5c49cc47d","brand":"Keanu Reeves","score":85,"grade":"B","delta":0,"created_at":"2026-03-03T13:34:22.123421+00"},
  {"id":"2612c25d-8e19-44fa-8b0c-05f448b05e2b","brand":"Mr Beast","score":37,"grade":"D","delta":0,"created_at":"2026-03-03T13:34:21.488118+00"},
  {"id":"521f5e96-a2a1-40aa-8142-0680b4d83b37","brand":"Farmer Belle","score":85,"grade":"B","delta":0,"created_at":"2026-03-03T13:34:20.887686+00"},
  {"id":"b5280031-c5cc-4ca4-a281-2cb59f99fbab","brand":"Matthew Leroux","score":27,"grade":"E","delta":0,"alert_triggered":true,"created_at":"2026-03-03T13:34:20.266972+00"},
  {"id":"bdd4bed4-90be-42e4-b5f7-910a0b471214","brand":"Jane Test","score":85,"grade":"B","delta":0,"created_at":"2026-03-03T03:48:13.467947+00"},
  {"id":"1b30c70f-cdc1-42fb-83da-9b51483b5a56","brand":"Jerry Test","score":27,"grade":"E","delta":-46,"alert_triggered":true,"created_at":"2026-03-03T03:48:12.609696+00"},
  {"id":"1ec5c311-de27-458c-b72f-c99d119c624e","brand":"Jerry Test","score":27,"grade":"E","delta":-38,"alert_triggered":true,"created_at":"2026-03-02T03:52:32.185416+00"},
  {"id":"ca32c5cd-11e9-4aeb-b0d6-d2eeb3e7d1f4","brand":"Jerry Test","score":35,"grade":"D","delta":20,"alert_triggered":true,"created_at":"2026-02-28T06:01:37.256884+00"},
  {"id":"09a143e3-542c-4f6e-a52c-cd5212d48188","brand":"Jerry Test","score":85,"grade":"B","delta":70,"created_at":"2026-02-28T05:17:31.642252+00"},
  {"id":"7469d42d-9d38-49d3-a5bd-47432730bb9e","brand":"Jerry Test","score":85,"grade":"B","delta":0,"created_at":"2026-02-28T05:09:57.528083+00"}
]
```

---

## TABLE: user_group_assignments (3 rows)
```json
[
  {"id":"1db07e6d-f413-46c3-b855-46f5092083f3","user_id":"0261b6fe-7afd-457f-af7c-f8d989d3a3b2","group_id":"f906f8b0-71f8-407a-a3af-23bbb64f4e7a","note":"Admin group"},
  {"id":"3875838b-e860-4614-b22e-49e7562967b7","user_id":"0f488b6c-f31e-4fc7-be19-7257f80949b0","group_id":"f906f8b0-71f8-407a-a3af-23bbb64f4e7a","note":"Admin group"},
  {"id":"9e73806c-f973-4d51-b020-50fec4f20cbe","user_id":"bd73ecce-5274-4e07-a85e-6a24385c8412","group_id":"932869d5-97b0-41ba-bf4b-004003b94de4","note":"Analyst group"}
]
```

---

## TABLE: user_roles (7 rows)
```json
[
  {"id":"8db1c9e5-b45c-482a-a22f-ac594ed3cabd","user_id":"0261b6fe-7afd-457f-af7c-f8d989d3a3b2","role":"admin"},
  {"id":"9aef61a7-2e13-4b2d-9757-1584e05b1783","user_id":"0f488b6c-f31e-4fc7-be19-7257f80949b0","role":"admin"},
  {"id":"b5b6d83c-4f3a-4af4-bee6-86fb923b0a63","user_id":"bd73ecce-5274-4e07-a85e-6a24385c8412","role":"analyst"},
  {"id":"cbac2523-e502-4df8-84a8-7e3bef765156","user_id":"a7bd8fd2-5470-47d1-bc3c-23e583dc52a9","role":"influencer"},
  {"id":"dedf41e6-4fc2-4b50-8848-afa5e7239e64","user_id":"fc0f442c-b1ec-458e-b47e-6b63ad801dc1","role":"influencer"},
  {"id":"aabd0549-b81a-4d17-9365-bdb7b6e36a7b","user_id":"4bf4e51b-4abe-4c8c-8a56-1ce253f9cd5d","role":"influencer"},
  {"id":"20596c47-bc06-45a4-abc9-b6bafdfb6aff","user_id":"bbc0e309-76a6-47af-b5bc-3bde8bf59322","role":"influencer"}
]
```
