/**
 * scan-domain — Brand Risk Assessor edge function.
 *
 * Performs four OSINT scans on a given domain:
 * 1. Email Spoofing Risk (DMARC/SPF via DNS-over-HTTPS)
 * 2. Typosquat Detection (domain permutations + DNS resolution)
 * 3. Certificate Transparency (crt.sh query for lookalike certs)
 * 4. Credential Exposure (HIBP breach data for the domain)
 *
 * Returns a composite risk score (0-100) and detailed findings.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── DNS-over-HTTPS helper ──────────────────────────────────────────────
async function dnsLookup(name: string, type: string): Promise<any[]> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/dns-json" },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.Answer || [];
  } catch {
    return [];
  }
}

// ── 1. DMARC / SPF Check ──────────────────────────────────────────────
interface EmailSpoofResult {
  dmarc_record: string | null;
  dmarc_policy: string | null;
  spf_record: string | null;
  spf_strict: boolean;
  risk: "critical" | "high" | "medium" | "low";
  details: string;
  penalty: number;
}

async function checkEmailSpoofing(domain: string): Promise<EmailSpoofResult> {
  // DMARC
  const dmarcAnswers = await dnsLookup(`_dmarc.${domain}`, "TXT");
  const dmarcTxt = dmarcAnswers
    .map((a: any) => (a.data || "").replace(/"/g, ""))
    .find((t: string) => t.startsWith("v=DMARC1"));

  let dmarcPolicy: string | null = null;
  if (dmarcTxt) {
    const match = dmarcTxt.match(/p=(\w+)/);
    dmarcPolicy = match ? match[1] : null;
  }

  // SPF
  const spfAnswers = await dnsLookup(domain, "TXT");
  const spfTxt = spfAnswers
    .map((a: any) => (a.data || "").replace(/"/g, ""))
    .find((t: string) => t.startsWith("v=spf1"));

  const spfStrict = spfTxt ? spfTxt.includes("-all") : false;

  // Score
  let risk: EmailSpoofResult["risk"] = "low";
  let penalty = 0;
  let details = "";

  if (!dmarcTxt) {
    risk = "critical";
    penalty = 40;
    details = "No DMARC record found. Anyone can spoof emails from this domain.";
  } else if (dmarcPolicy === "none") {
    risk = "critical";
    penalty = 35;
    details = "DMARC policy is set to 'none' — spoofed emails are delivered without restriction.";
  } else if (dmarcPolicy === "quarantine") {
    risk = "medium";
    penalty = 15;
    details = "DMARC policy is 'quarantine' — spoofed emails may be flagged but not fully blocked.";
  } else if (dmarcPolicy === "reject") {
    risk = "low";
    penalty = 0;
    details = "DMARC policy is 'reject' — strong protection against email spoofing.";
  }

  if (!spfTxt) {
    penalty += 10;
    details += " No SPF record found.";
    if (risk === "low") risk = "medium";
  } else if (!spfStrict) {
    penalty += 5;
    details += " SPF uses soft-fail (~all) instead of hard-fail (-all).";
  }

  return {
    dmarc_record: dmarcTxt || null,
    dmarc_policy: dmarcPolicy,
    spf_record: spfTxt || null,
    spf_strict: spfStrict,
    risk,
    details: details.trim(),
    penalty,
  };
}

// ── 2. Typosquat Detection ─────────────────────────────────────────────
interface TyposquatResult {
  total_permutations: number;
  registered: { domain: string; has_mx: boolean; has_web: boolean }[];
  risk: "critical" | "high" | "medium" | "low";
  penalty: number;
}

function generatePermutations(domain: string): string[] {
  const parts = domain.split(".");
  if (parts.length < 2) return [];
  const name = parts[0];
  const tld = parts.slice(1).join(".");
  const perms = new Set<string>();

  // Character substitutions
  const subs: Record<string, string[]> = {
    o: ["0"], i: ["1", "l"], l: ["1", "i"], e: ["3"],
    a: ["4", "@"], s: ["5", "$"], t: ["7"], g: ["9", "q"],
    b: ["d"], d: ["b"], m: ["n", "rn"], n: ["m"],
    c: ["k"], k: ["c"], u: ["v"], v: ["u"], w: ["vv"],
  };

  // Homoglyph substitutions
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (subs[ch]) {
      for (const s of subs[ch]) {
        perms.add(name.slice(0, i) + s + name.slice(i + 1) + "." + tld);
      }
    }
  }

  // Character omission
  for (let i = 0; i < name.length; i++) {
    perms.add(name.slice(0, i) + name.slice(i + 1) + "." + tld);
  }

  // Character repetition
  for (let i = 0; i < name.length; i++) {
    perms.add(name.slice(0, i + 1) + name[i] + name.slice(i + 1) + "." + tld);
  }

  // Adjacent transposition
  for (let i = 0; i < name.length - 1; i++) {
    perms.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2) + "." + tld);
  }

  // Common prefixes/suffixes
  for (const affix of ["login", "secure", "support", "portal", "account", "verify"]) {
    perms.add(name + "-" + affix + "." + tld);
    perms.add(affix + "-" + name + "." + tld);
  }

  // Alt TLDs
  for (const alt of ["com", "net", "org", "co", "info", "xyz", "io"]) {
    if (alt !== tld) perms.add(name + "." + alt);
  }

  perms.delete(domain);
  return [...perms].slice(0, 60); // cap at 60 to keep scan fast
}

async function checkTyposquats(domain: string): Promise<TyposquatResult> {
  const permutations = generatePermutations(domain);
  const registered: TyposquatResult["registered"] = [];

  // Check permutations in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < Math.min(permutations.length, 40); i += batchSize) {
    const batch = permutations.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (perm) => {
        const aRecords = await dnsLookup(perm, "A");
        if (aRecords.length === 0) return null;
        const mxRecords = await dnsLookup(perm, "MX");
        return {
          domain: perm,
          has_mx: mxRecords.length > 0,
          has_web: aRecords.length > 0,
        };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) registered.push(r.value);
    }
  }

  const weaponized = registered.filter((r) => r.has_mx).length;
  let risk: TyposquatResult["risk"] = "low";
  let penalty = 0;

  if (weaponized >= 3) {
    risk = "critical";
    penalty = 30;
  } else if (weaponized >= 1) {
    risk = "high";
    penalty = 20;
  } else if (registered.length >= 3) {
    risk = "medium";
    penalty = 10;
  }

  return {
    total_permutations: permutations.length,
    registered,
    risk,
    penalty,
  };
}

// ── 3. Certificate Transparency ────────────────────────────────────────
interface CTResult {
  certificates: { issuer: string; common_name: string; not_before: string; not_after: string }[];
  risk: "critical" | "high" | "medium" | "low";
  penalty: number;
}

async function checkCertTransparency(domain: string): Promise<CTResult> {
  try {
    const resp = await fetch(
      `https://crt.sh/?q=%25${encodeURIComponent(domain)}&output=json`,
      { headers: { Accept: "application/json" } }
    );
    if (!resp.ok) {
      await resp.text();
      return { certificates: [], risk: "low", penalty: 0 };
    }

    const data = await resp.json();
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Filter to recent certs not matching the exact domain
    const suspicious = (data as any[])
      .filter((cert: any) => {
        const notBefore = new Date(cert.not_before).getTime();
        const cn = (cert.common_name || "").toLowerCase();
        const exactDomain = domain.toLowerCase();
        return (
          notBefore >= ninetyDaysAgo &&
          cn !== exactDomain &&
          cn !== `*.${exactDomain}` &&
          cn.includes(exactDomain.split(".")[0])
        );
      })
      .slice(0, 20)
      .map((cert: any) => ({
        issuer: cert.issuer_name || "Unknown",
        common_name: cert.common_name,
        not_before: cert.not_before,
        not_after: cert.not_after,
      }));

    let risk: CTResult["risk"] = "low";
    let penalty = 0;

    if (suspicious.length >= 10) {
      risk = "high";
      penalty = 15;
    } else if (suspicious.length >= 3) {
      risk = "medium";
      penalty = 10;
    } else if (suspicious.length >= 1) {
      risk = "low";
      penalty = 5;
    }

    return { certificates: suspicious, risk, penalty };
  } catch {
    return { certificates: [], risk: "low", penalty: 0 };
  }
}

// ── 4. Credential Exposure (HIBP) ──────────────────────────────────────
interface CredentialExposureResult {
  breaches: {
    name: string;
    title: string;
    domain: string;
    breach_date: string;
    pwn_count: number;
    data_classes: string[];
    is_verified: boolean;
  }[];
  total_exposed_accounts: number;
  risk: "critical" | "high" | "medium" | "low";
  penalty: number;
  details: string;
}

async function checkCredentialExposure(domain: string): Promise<CredentialExposureResult> {
  try {
    // HIBP public breaches API — no key required
    const resp = await fetch("https://haveibeenpwned.com/api/v3/breaches", {
      headers: {
        "User-Agent": "LRX-Radar-Scanner",
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      await resp.text();
      return { breaches: [], total_exposed_accounts: 0, risk: "low", penalty: 0, details: "Unable to query breach database." };
    }

    const allBreaches = await resp.json() as any[];

    // Filter breaches that match this domain exactly or are from the same organization
    const domainName = domain.split(".")[0].toLowerCase();
    const matchingBreaches = allBreaches
      .filter((b: any) => {
        const bDomain = (b.Domain || "").toLowerCase();
        const bName = (b.Name || "").toLowerCase();
        return (
          bDomain === domain.toLowerCase() ||
          bDomain.endsWith(`.${domain.toLowerCase()}`) ||
          bName.includes(domainName)
        );
      })
      .map((b: any) => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        breach_date: b.BreachDate,
        pwn_count: b.PwnCount || 0,
        data_classes: b.DataClasses || [],
        is_verified: b.IsVerified || false,
      }))
      .sort((a: any, b: any) => b.pwn_count - a.pwn_count)
      .slice(0, 15);

    const totalExposed = matchingBreaches.reduce((sum: number, b: any) => sum + b.pwn_count, 0);

    let risk: CredentialExposureResult["risk"] = "low";
    let penalty = 0;
    let details = "";

    if (matchingBreaches.length === 0) {
      details = "No known breaches found for this domain in the HIBP database.";
    } else {
      const verifiedBreaches = matchingBreaches.filter((b) => b.is_verified);
      const hasPasswords = matchingBreaches.some((b) =>
        b.data_classes.some((dc: string) => dc.toLowerCase().includes("password"))
      );

      if (totalExposed > 1_000_000 || (verifiedBreaches.length >= 2 && hasPasswords)) {
        risk = "critical";
        penalty = 25;
        details = `${matchingBreaches.length} breach(es) found with ${totalExposed.toLocaleString()} total exposed accounts. Password data compromised — high ATO risk.`;
      } else if (totalExposed > 100_000 || hasPasswords) {
        risk = "high";
        penalty = 20;
        details = `${matchingBreaches.length} breach(es) found with ${totalExposed.toLocaleString()} exposed accounts. Credential stuffing attacks likely.`;
      } else if (matchingBreaches.length >= 1) {
        risk = "medium";
        penalty = 10;
        details = `${matchingBreaches.length} breach(es) found with ${totalExposed.toLocaleString()} exposed records. Monitor for credential reuse.`;
      }
    }

    return {
      breaches: matchingBreaches,
      total_exposed_accounts: totalExposed,
      risk,
      penalty,
      details,
    };
  } catch (e) {
    console.error("HIBP check error:", e);
    return {
      breaches: [],
      total_exposed_accounts: 0,
      risk: "low",
      penalty: 0,
      details: "Breach database check unavailable.",
    };
  }
}

// ── 5. Dangling DNS / Subdomain Hijacking ──────────────────────────────
interface DanglingDNSResult {
  subdomains_checked: number;
  vulnerable: {
    subdomain: string;
    cname_target: string;
    provider: string;
    status: "dangling" | "suspicious";
  }[];
  risk: "critical" | "high" | "medium" | "low";
  penalty: number;
  details: string;
}

// Known cloud provider CNAME fingerprints that indicate potential hijacking
const CLOUD_FINGERPRINTS: { pattern: RegExp; provider: string }[] = [
  { pattern: /\.s3\.amazonaws\.com$/i, provider: "AWS S3" },
  { pattern: /\.s3-website[.-].*\.amazonaws\.com$/i, provider: "AWS S3 Website" },
  { pattern: /\.elasticbeanstalk\.com$/i, provider: "AWS Elastic Beanstalk" },
  { pattern: /\.cloudfront\.net$/i, provider: "AWS CloudFront" },
  { pattern: /\.herokuapp\.com$/i, provider: "Heroku" },
  { pattern: /\.herokudns\.com$/i, provider: "Heroku DNS" },
  { pattern: /\.azurewebsites\.net$/i, provider: "Azure App Service" },
  { pattern: /\.blob\.core\.windows\.net$/i, provider: "Azure Blob Storage" },
  { pattern: /\.cloudapp\.azure\.com$/i, provider: "Azure Cloud App" },
  { pattern: /\.trafficmanager\.net$/i, provider: "Azure Traffic Manager" },
  { pattern: /\.azure-api\.net$/i, provider: "Azure API Management" },
  { pattern: /\.azureedge\.net$/i, provider: "Azure CDN" },
  { pattern: /\.azurefd\.net$/i, provider: "Azure Front Door" },
  { pattern: /\.ghost\.io$/i, provider: "Ghost" },
  { pattern: /\.myshopify\.com$/i, provider: "Shopify" },
  { pattern: /\.surge\.sh$/i, provider: "Surge" },
  { pattern: /\.bitbucket\.io$/i, provider: "Bitbucket" },
  { pattern: /\.github\.io$/i, provider: "GitHub Pages" },
  { pattern: /\.gitlab\.io$/i, provider: "GitLab Pages" },
  { pattern: /\.netlify\.app$/i, provider: "Netlify" },
  { pattern: /\.fly\.dev$/i, provider: "Fly.io" },
  { pattern: /\.vercel\.app$/i, provider: "Vercel" },
  { pattern: /\.pantheonsite\.io$/i, provider: "Pantheon" },
  { pattern: /\.zendesk\.com$/i, provider: "Zendesk" },
  { pattern: /\.teamwork\.com$/i, provider: "Teamwork" },
  { pattern: /\.freshdesk\.com$/i, provider: "Freshdesk" },
  { pattern: /\.wpengine\.com$/i, provider: "WP Engine" },
  { pattern: /\.unbounce\.com$/i, provider: "Unbounce" },
  { pattern: /\.cargocollective\.com$/i, provider: "Cargo" },
  { pattern: /\.fastly\.net$/i, provider: "Fastly" },
  { pattern: /\.firebaseapp\.com$/i, provider: "Firebase" },
  { pattern: /\.web\.app$/i, provider: "Firebase Hosting" },
  { pattern: /\.appspot\.com$/i, provider: "Google App Engine" },
  { pattern: /\.storage\.googleapis\.com$/i, provider: "Google Cloud Storage" },
];

// Common subdomains to check
const COMMON_SUBDOMAINS = [
  "www", "mail", "remote", "blog", "webmail", "server", "ns1", "ns2",
  "smtp", "secure", "vpn", "api", "dev", "staging", "test", "portal",
  "admin", "app", "cdn", "cloud", "docs", "ftp", "git", "help",
  "internal", "login", "m", "media", "shop", "status", "store",
  "support", "wiki", "beta", "demo", "dashboard", "auth",
];

async function checkDanglingDNS(domain: string): Promise<DanglingDNSResult> {
  const vulnerable: DanglingDNSResult["vulnerable"] = [];

  // Check subdomains in parallel batches
  const batchSize = 10;
  const subsToCheck = COMMON_SUBDOMAINS.slice(0, 40);

  for (let i = 0; i < subsToCheck.length; i += batchSize) {
    const batch = subsToCheck.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        const fqdn = `${sub}.${domain}`;
        // Check for CNAME
        const cnameRecords = await dnsLookup(fqdn, "CNAME");
        if (cnameRecords.length === 0) return null;

        const cnameTarget = (cnameRecords[0].data || "").replace(/\.$/, "").toLowerCase();
        if (!cnameTarget) return null;

        // Check if CNAME points to a known cloud provider
        const matched = CLOUD_FINGERPRINTS.find((fp) => fp.pattern.test(cnameTarget));
        if (!matched) return null;

        // Check if the CNAME target actually resolves (if not → dangling)
        const targetA = await dnsLookup(cnameTarget, "A");
        const isDangling = targetA.length === 0;

        // Also check if the subdomain itself has no A record despite having CNAME
        const subdomainA = await dnsLookup(fqdn, "A");

        if (isDangling || subdomainA.length === 0) {
          return {
            subdomain: fqdn,
            cname_target: cnameTarget,
            provider: matched.provider,
            status: isDangling ? "dangling" as const : "suspicious" as const,
          };
        }

        return null;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) vulnerable.push(r.value);
    }
  }

  const danglingCount = vulnerable.filter((v) => v.status === "dangling").length;
  let risk: DanglingDNSResult["risk"] = "low";
  let penalty = 0;
  let details = "";

  if (danglingCount >= 3) {
    risk = "critical";
    penalty = 25;
    details = `${danglingCount} dangling DNS records found pointing to unclaimed cloud resources. Immediate subdomain takeover risk.`;
  } else if (danglingCount >= 1) {
    risk = "high";
    penalty = 20;
    details = `${danglingCount} dangling DNS record(s) detected. Attackers can claim the cloud resource and serve content on your subdomain.`;
  } else if (vulnerable.length >= 1) {
    risk = "medium";
    penalty = 10;
    details = `${vulnerable.length} suspicious CNAME(s) pointing to cloud providers. Verify ownership of these resources.`;
  } else {
    details = "No dangling DNS records or subdomain hijacking risks detected.";
  }

  return {
    subdomains_checked: subsToCheck.length,
    vulnerable,
    risk,
    penalty,
    details,
  };
}

// ── Composite Score ────────────────────────────────────────────────────
function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  return "F";
}

// ── Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { domain } = await req.json();

    if (!domain || typeof domain !== "string") {
      return new Response(JSON.stringify({ error: "domain is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize
    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    // Run all five checks in parallel
    const [emailResult, typosquatResult, ctResult, credResult, danglingResult] = await Promise.all([
      checkEmailSpoofing(cleanDomain),
      checkTyposquats(cleanDomain),
      checkCertTransparency(cleanDomain),
      checkCredentialExposure(cleanDomain),
      checkDanglingDNS(cleanDomain),
    ]);

    const totalPenalty = emailResult.penalty + typosquatResult.penalty + ctResult.penalty + credResult.penalty + danglingResult.penalty;
    const score = Math.max(0, 100 - totalPenalty);
    const grade = computeGrade(score);

    // Determine overall risk
    const risks = [emailResult.risk, typosquatResult.risk, ctResult.risk, credResult.risk, danglingResult.risk];
    let overallRisk = "low";
    if (risks.includes("critical")) overallRisk = "critical";
    else if (risks.includes("high")) overallRisk = "high";
    else if (risks.includes("medium")) overallRisk = "medium";

    return new Response(
      JSON.stringify({
        domain: cleanDomain,
        score,
        grade,
        overall_risk: overallRisk,
        email_spoofing: emailResult,
        typosquats: typosquatResult,
        certificate_transparency: ctResult,
        credential_exposure: credResult,
        dangling_dns: danglingResult,
        scanned_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("scan-domain error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Scan failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
