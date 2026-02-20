import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRAP_ADDRESSES = [
  "honey1@traps.lrxradar.com",
  "honey2@traps.lrxradar.com",
  "honey3@traps.lrxradar.com",
  "honey4@traps.lrxradar.com",
];

const PHISHING_TEMPLATES = [
  { domain: "paypa1-secure.com", brand: "PayPal", subject: "Action required: Verify your PayPal account" },
  { domain: "amaz0n-prime.net", brand: "Amazon", subject: "Your Amazon Prime membership is expiring" },
  { domain: "micr0soft-teams.com", brand: "Microsoft", subject: "You have a new Teams message" },
  { domain: "app1e-support.org", brand: "Apple", subject: "Your iCloud storage is full" },
  { domain: "netflix-update.info", brand: "Netflix", subject: "Payment method declined" },
  { domain: "chase-alerts.net", brand: "Chase", subject: "Unusual activity detected on your account" },
  { domain: "google-security.support", brand: "Google", subject: "Critical security alert" },
  { domain: "wells-fargo-notice.com", brand: "Wells Fargo", subject: "Important account update" },
  { domain: "coinbase-verify.net", brand: "Coinbase", subject: "Complete identity verification" },
  { domain: "instagram-appeal.org", brand: "Instagram", subject: "Your account has been flagged" },
];

const SPAM_TEMPLATES = [
  { domain: "cheap-pharma-rx.com", subject: "Save 80% on prescription medications today" },
  { domain: "seo-boost-pro.net", subject: "Get your website to page 1 of Google" },
  { domain: "bulk-email-lists.biz", subject: "10 million verified B2B contacts" },
  { domain: "diet-miracle.shop", subject: "Doctors hate this one weight loss trick" },
  { domain: "forex-profits.live", subject: "Make $3000/day from home" },
];

const SCAM_TEMPLATES = [
  { domain: "crypto-double.biz", brand: "Bitcoin", subject: "Double your Bitcoin in 12 hours" },
  { domain: "lottery-winner.info", subject: "Congratulations! You won $1,000,000" },
  { domain: "investment-returns.net", subject: "Guaranteed 500% ROI in 30 days" },
  { domain: "inheritance-claim.org", subject: "Unclaimed inheritance of $4.5 million" },
];

const BRAND_ABUSE_TEMPLATES = [
  { domain: "replica-luxury.shop", brand: "Rolex", subject: "Authentic Rolex watches 90% off" },
  { domain: "cheap-software.download", brand: "Microsoft", subject: "Windows + Office bundle $19.99" },
  { domain: "designer-outlet.store", brand: "Louis Vuitton", subject: "Designer handbags from $29" },
];

const COUNTRIES = ["RU", "CN", "UA", "NL", "DE", "US", "IN", "RO", "NG", "BR", "TR", "VN", "PH", "KR", "BG", "MD", "LT", "LV", "FR", "SG"];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomIP(): string { return `${randomInt(1,223)}.${randomInt(0,255)}.${randomInt(0,255)}.${randomInt(1,254)}`; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const count = randomInt(3, 8); // generate 3-8 new hits
    const records = [];

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let category: string, template: any;

      if (roll < 0.5) {
        category = "phishing";
        template = randomFrom(PHISHING_TEMPLATES);
      } else if (roll < 0.7) {
        category = "spam";
        template = randomFrom(SPAM_TEMPLATES);
      } else if (roll < 0.88) {
        category = "scam";
        template = randomFrom(SCAM_TEMPLATES);
      } else {
        category = "brand-abuse";
        template = randomFrom(BRAND_ABUSE_TEMPLATES);
      }

      records.push({
        trap_address: randomFrom(TRAP_ADDRESSES),
        sender_email: `${["noreply", "support", "alert", "info", "security", "admin"][randomInt(0, 5)]}@${template.domain}`,
        sender_domain: template.domain,
        sender_ip: randomIP(),
        country: randomFrom(COUNTRIES),
        subject: template.subject,
        spf_pass: Math.random() < 0.25,
        dkim_pass: Math.random() < 0.15,
        category,
        brand_mentioned: template.brand || null,
        confidence: category === "phishing" ? randomInt(75, 98) : category === "scam" ? randomInt(55, 80) : category === "brand-abuse" ? randomInt(45, 70) : randomInt(25, 50),
        received_at: new Date(Date.now() - randomInt(0, 3600000)).toISOString(), // within last hour
      });
    }

    const { error } = await supabase.from("spam_trap_hits").insert(records);
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, generated: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
