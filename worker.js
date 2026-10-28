import { RENO_SOURCES, RENO_STATE_DATA } from "./reno-costs.js";

// List of US states with average amounts
// avgAmount: average funded HEI per state, Sep 2025 - Aug 2026, from HEI_CONTRACTS, rounded to the nearest $1,000.
// Refreshed 2026-10-28 (method in RENO_COSTS.md). DC and MA keep their 2025 values (under 30 HEIs in the window).
const US_STATES = [
  { code: "AZ", name: "Arizona", avgAmount: 88000 },
  { code: "CA", name: "California", avgAmount: 127000 },
  { code: "CO", name: "Colorado", avgAmount: 92000 },
  { code: "CT", name: "Connecticut", avgAmount: 88000 },
  { code: "DC", name: "District of Columbia", avgAmount: 139000 },
  { code: "FL", name: "Florida", avgAmount: 86000 },
  { code: "GA", name: "Georgia", avgAmount: 74000 },
  { code: "HI", name: "Hawaii", avgAmount: 156000 },
  { code: "IL", name: "Illinois", avgAmount: 69000 },
  { code: "IN", name: "Indiana", avgAmount: 57000 },
  { code: "KY", name: "Kentucky" },
  { code: "MA", name: "Massachusetts", avgAmount: 121000 },
  { code: "MD", name: "Maryland", avgAmount: 82000 },
  { code: "MI", name: "Michigan", avgAmount: 64000 },
  { code: "MN", name: "Minnesota", avgAmount: 67000 },
  { code: "MO", name: "Missouri", avgAmount: 56000 },
  { code: "NC", name: "North Carolina", avgAmount: 74000 },
  { code: "NJ", name: "New Jersey", avgAmount: 95000 },
  { code: "NV", name: "Nevada", avgAmount: 83000 },
  { code: "NY", name: "New York", avgAmount: 104000 },
  { code: "OH", name: "Ohio", avgAmount: 55000 },
  { code: "OR", name: "Oregon", avgAmount: 83000 },
  { code: "PA", name: "Pennsylvania", avgAmount: 67000 },
  { code: "SC", name: "South Carolina", avgAmount: 72000 },
  { code: "TN", name: "Tennessee", avgAmount: 73000 },
  { code: "UT", name: "Utah", avgAmount: 98000 },
  { code: "VA", name: "Virginia", avgAmount: 80000 },
  { code: "WA", name: "Washington", avgAmount: 101000 },
  { code: "WI", name: "Wisconsin", avgAmount: 67000 },
];

// Headline amount (in thousands of dollars) shown on /start/united-states
const START_US_AMOUNT_K = 750;

// Template function for headlines
function generateHeadline(state, amount = "600k") {
  return `Get up to $${amount} from your <br><span class="headline-underline-decoration">home equity</span> in ${state.name}.`;
}

function generateAvgPageHeadline(state) {
  return `Qualified ${state.name} homeowners get <span class="headline-underline-decoration">$${state.avgAmount.toLocaleString()}</span> on average.`;
}

function generateStateSocialProofHeadline(state) {
  return `Qualified homeowners in ${state.name} get an average of $${state.avgAmount.toLocaleString()} from Point's Home Equity Investment`;
}

function generateStartUsSocialProofHeadline(state) {
  return `Homeowners love getting cash from Point's home equity products. In ${state.name}, qualified homeowners average $${state.avgAmount.toLocaleString()}.`;
}

function addStateAvgFootnote(state) {
  return `Qualified homeowners in ${state.name} get an average of  $${state.avgAmount.toLocaleString()} from Point's Home Equity Investment`;
}

// const HELOC_DEFAULT_HEADLINE = `Get a HELOC quote with <span class="headline-underline-decoration">no impact</span> to your credit.`;

// function generateHelocHeadline(state) {
//   return `Get a HELOC quote in ${state.name} with <span class="headline-underline-decoration">no impact</span> to your credit.`;
// }

// Generate headlines for all states
const STATE_CONTENT = US_STATES.reduce((acc, state) => {
  const content = {
    code: state.code,
    name: state.name,
    avgAmount: state.avgAmount,
    headline: generateHeadline(state),
    avgPageHeadline: state.avgAmount ? generateAvgPageHeadline(state) : null,
    avgHeadline: state.avgAmount ? generateStateSocialProofHeadline(state) : null,
    footnote: state.avgAmount ? addStateAvgFootnote(state) : null,
  };

  acc[state.code] = content;
  acc[state.name.toUpperCase()] = content;

  return acc;
}, {});

// Add debugging to getStateContent function
function getStateContent(region) {
  if (!region) {
    return null;
  }

  const normalizedRegion = region.trim().toUpperCase();

  // Debug: log what we're trying to match
  // console.log(`[DEBUG] getStateContent:`, {
  //   original: region,
  //   normalized: normalizedRegion,
  //   availableKeys: Object.keys(STATE_CONTENT).filter((key) => key.includes("MASS") || key === "MA"),
  // });

  return STATE_CONTENT[normalizedRegion] || null;
}

const HOME_RENO_PATH = "/home-reno";

function formatUsd(value) {
  return `$${value.toLocaleString("en-US")}`;
}

function isAmount(value) {
  return Number.isFinite(value) && value > 0;
}

// Flat token map consumed by data-geo-template elements, e.g. {state}, {reno.avg}, {homeValue.pct}
function buildRenoTokens(state) {
  const tokens = { state: state.name };
  const data = RENO_STATE_DATA[state.code];
  if (!data) return tokens;

  // A template that needs a missing figure keeps its fallback copy
  if (isAmount(data.homeImprovementAvg)) {
    tokens["reno.avg"] = formatUsd(Math.round(data.homeImprovementAvg / 1000) * 1000);
  }

  const homeValue = data.homeValueChange5yr;
  // Copy reads "rose X%", so only send the stat when values went up
  if (homeValue && Number.isFinite(homeValue.pct) && homeValue.pct > 0 && RENO_SOURCES[homeValue.source]) {
    tokens["homeValue.pct"] = `${Math.round(homeValue.pct)}%`;
    tokens["homeValue.source"] = RENO_SOURCES[homeValue.source].label;
  }

  return tokens;
}

function handleHomeReno(request, requestId) {
  const cf = request.cf;
  // ?state=CO previews a state's content (used for QA on staging)
  const stateOverride = new URL(request.url).searchParams.get("state");
  const state = stateOverride ? getStateContent(stateOverride) : cf?.country === "US" ? getStateContent(cf?.region) : null;
  const tokens = state ? buildRenoTokens(state) : {};

  console.log(`[HOME_RENO] ${requestId}`, {
    timestamp: new Date().toISOString(),
    requestId,
    country: cf?.country,
    originalRegion: cf?.region,
    stateOverride: stateOverride,
    matchedCode: state?.code ?? "None",
    tokenCount: Object.keys(tokens).length,
  });

  return new Response(
    JSON.stringify({
      stateAbbr: state?.code ?? null,
      stateName: state?.name ?? null,
      tokens: tokens,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "max-age=3600",
        "X-Request-Id": requestId,
      },
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Handle error reporting endpoint
    if (request.url.includes("/log-error") && request.method === "POST") {
      try {
        const errorData = await request.json();
        console.error(`[CLIENT_ERROR] ${requestId}`, {
          timestamp: new Date().toISOString(),
          requestId,
          error: errorData.error,
          stack: errorData.stack,
          userAgent: request.headers.get("user-agent"),
          url: errorData.url,
          geo: {
            country: request.cf?.country,
            region: request.cf?.region,
            city: request.cf?.city,
          },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        console.error(`[ERROR_ENDPOINT_FAIL] ${requestId}`, e);
        return new Response(JSON.stringify({ success: false }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // Handle client logging endpoint
    if (request.url.includes("/log") && request.method === "POST") {
      try {
        const logData = await request.json();
        const logLevel = logData.level || "info";
        const logType = `[CLIENT_${logLevel.toUpperCase()}]`;

        console.log(`${logType} ${requestId}`, {
          timestamp: new Date().toISOString(),
          requestId,
          message: logData.message,
          data: logData.data,
          userAgent: request.headers.get("user-agent"),
          url: logData.url,
          geo: {
            country: request.cf?.country,
            region: request.cf?.region,
            city: request.cf?.city,
          },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        console.error(`[LOG_ENDPOINT_FAIL] ${requestId}`, e);
        return new Response(JSON.stringify({ success: false }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (new URL(request.url).pathname === HOME_RENO_PATH) {
      return handleHomeReno(request, requestId);
    }

    // Get geo information from the request
    const cf = request.cf;

    // Log incoming request details
    console.log(`[REQUEST] ${requestId}`, {
      timestamp: new Date().toISOString(),
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      ip: request.headers.get("cf-connecting-ip"),
      country: cf?.country,
      region: cf?.region,
      city: cf?.city,
      postalCode: cf?.postalCode,
      timezone: cf?.timezone,
      continent: cf?.continent,
      asn: cf?.asn,
      colo: cf?.colo,
    });

    const stateContent = cf?.country === "US" ? getStateContent(cf?.region) : null;

    // Check referer or query parameter to determine if we should use 750k instead of 600k
    const referer = request.headers.get("referer") || "";
    const url = new URL(request.url);
    const pathParam = url.searchParams.get("path");
    const isStartUs = referer.includes("/start/united-states") || pathParam?.includes("/start/united-states");
    const isStartUsaHea = referer.includes("/start/usa/hea") || pathParam?.includes("/start/usa/hea");
    const isAvgPage = referer.includes("/avg") || pathParam?.includes("/avg");

    // Generate headline with appropriate amount based on path
    let headline = stateContent?.headline ?? null;
    let amount = null;
    if (isAvgPage) {
      headline = stateContent?.avgPageHeadline ?? null;
    } else if (headline && isStartUs) {
      headline = headline.replace(/\$600k/g, `$${START_US_AMOUNT_K}k`).replace(/600k/g, `${START_US_AMOUNT_K}k`);
      amount = START_US_AMOUNT_K;
    }
    if (isStartUsaHea) {
      headline = null;
    }

    // Generate social proof headline with variant format for /start/united-states
    let avgHeadline = stateContent?.avgHeadline ?? null;
    if (avgHeadline && isStartUs && stateContent) {
      avgHeadline = generateStartUsSocialProofHeadline(stateContent);
    }

    // Log state matching results
    console.log(`[STATE_MATCH] ${requestId}`, {
      timestamp: new Date().toISOString(),
      requestId,
      country: cf?.country,
      originalRegion: cf?.region,
      matchedState: stateContent?.name ?? "None",
      matchedCode: stateContent?.code ?? "None",
      hasCustomContent: !!stateContent,
      referer: referer,
      isStartUs: isStartUs,
      isStartUsaHea: isStartUsaHea,
      isAvgPage: isAvgPage,
      processingTimeMs: Date.now() - startTime,
    });

    // Don't update footnote on /start/united-states or /start/usa/hea pages
    const footnote = (isStartUs || isStartUsaHea) ? null : stateContent?.footnote ?? null;

    const response = {
      headline: headline,
      amount: amount,
      avgHeadline: avgHeadline,
      footnote: footnote,
      country: cf?.country || "Unknown",
      region: cf?.region || "Unknown",
      stateAbbr: stateContent?.code ?? null,
      stateName: stateContent?.name ?? null,
      city: cf?.city || "Unknown",
      debug: {
        originalRegion: cf?.region,
        matchedStateCode: stateContent?.code ?? null,
        hasStateHeadline: !!stateContent,
        isStartUs: isStartUs,
        isStartUsaHea: isStartUsaHea,
        isAvgPage: isAvgPage,
      },
    };

    // Log response details
    console.log(`[RESPONSE] ${requestId}`, {
      timestamp: new Date().toISOString(),
      requestId,
      hasHeadline: !!response.headline,
      hasAvgHeadline: !!response.avgHeadline,
      hasFootnote: !!response.footnote,
      stateServed: response.stateName ?? "Default",
      totalTimeMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "max-age=3600",
        "X-Request-Id": requestId,
      },
    });
  },
};
