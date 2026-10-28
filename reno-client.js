// Home reno page personalization. Elements opt in with data-geo-template, e.g.
//   <strong data-geo-template="{state}">your state</strong>
//   <div data-geo-template="{kitchen.low} – {kitchen.high}">$25,000 – $150,000</div>
// The default text stays unless every token in the template resolves. Wrap related
// elements (one cost card) in data-geo-group so they switch together or not at all.
// Optional data-geo-fallback="..." replaces the default text whenever the template can't be
// used (no data, a state Point doesn't operate in, or a failed lookup).
(() => {
  const WORKER_URL = "https://geo-ip-detector.ops-1df.workers.dev/";
  const TEMPLATE_SELECTOR = "[data-geo-template]";
  const GROUP_SELECTOR = "[data-geo-group]";
  const TOKEN_PATTERN = /\{([\w.]+)\}/g;
  const STATE_OVERRIDE_PARAM = "geo-state"; // ?geo-state=CO previews a state on staging

  async function reportError(error, context) {
    try {
      await fetch(`${WORKER_URL}log-error`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error.message || String(error),
          stack: error.stack || "No stack trace available",
          context: context,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (reportErr) {
      // Silently fail - don't expose error reporting failures
    }
  }

  // Returns null when any token is missing, so the element keeps its default text
  function fillTemplate(template, tokens) {
    let complete = true;
    const text = template.replace(TOKEN_PATTERN, (match, key) => {
      if (!Object.hasOwn(tokens, key)) {
        complete = false;
        return match;
      }
      return tokens[key];
    });
    return complete ? text : null;
  }

  // Pass an empty token map to show fallbacks everywhere
  function applyTokens(tokens) {
    const updates = Array.from(document.querySelectorAll(TEMPLATE_SELECTOR)).map((element) => ({
      element,
      group: element.closest(GROUP_SELECTOR),
      text: fillTemplate(element.dataset.geoTemplate, tokens),
    }));
    const incompleteGroups = new Set(updates.filter((update) => update.text === null && update.group).map((update) => update.group));

    updates.forEach(({ element, group, text }) => {
      if (text !== null && !incompleteGroups.has(group)) {
        element.textContent = text;
      } else if (element.dataset.geoFallback !== undefined) {
        element.textContent = element.dataset.geoFallback;
      }
    });
  }

  function buildRequestUrl() {
    const url = new URL("home-reno", WORKER_URL);
    const stateOverride = new URLSearchParams(window.location.search).get(STATE_OVERRIDE_PARAM);
    if (stateOverride) url.searchParams.set("state", stateOverride);
    return url;
  }

  async function personalize() {
    try {
      const response = await fetch(buildRequestUrl());
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }

      const data = await response.json();
      applyTokens(data.stateName && data.tokens ? data.tokens : {});
    } catch (error) {
      applyTokens({});
      reportError(error, "home_reno_personalize");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", personalize);
  } else {
    personalize();
  }
})();
