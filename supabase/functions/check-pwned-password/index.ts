/**
 * check-pwned-password — Checks password hashes against HIBP Pwned Passwords API.
 * Uses k-anonymity (only sends first 5 chars of SHA-1 hash).
 * Free, no API key needed.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha1Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });

    if (!res.ok) throw new Error(`HIBP API error ${res.status}`);
    const text = await res.text();

    // Each line is "SUFFIX:COUNT"
    let count = 0;
    for (const line of text.split("\r\n")) {
      const [lineSuffix, lineCount] = line.split(":");
      if (lineSuffix === suffix) {
        count = parseInt(lineCount, 10);
        break;
      }
    }

    return new Response(
      JSON.stringify({
        pwned: count > 0,
        count,
        risk: count > 100 ? "critical" : count > 10 ? "high" : count > 0 ? "medium" : "safe",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("HIBP check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
