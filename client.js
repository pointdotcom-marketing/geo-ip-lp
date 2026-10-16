(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const WORKER_URL = "https://geo-ip-detector.ops-1df.workers.dev/"; // Update this with your worker URL
    const HEADLINE_SELECTOR = "h1"; // Update this if you want to target a specific h1 with an ID or class
    const SOCIAL_PROOF_HEADLINE_SELECTOR = "#avg-homeowner"; // Selector for the avg-homeowner element
    const AVG_HOMEOWNER_FOOTNOTE_SELECTOR = "#footnote-rtf"; // Selector for the footnote-rtf element to update with avg amount details.
    const AVG_HOMEOWNER_SELECTOR = "#avg-homeowner"; // Added AVG_HOMEOWNER_SELECTOR
    const AMOUNT_SELECTOR = "[data-geo-amount]"; // Span wrapping the headline dollar amount (in thousands)
    const STATE_ANCHOR_SELECTOR = ".headline-underline-decoration"; // State name is appended after this span
    const AMOUNT_ANIMATION_MS = 700;
    const MAX_LOOKUP_MS = 2000; // Skip the amount update if the lookup is slower than this, to avoid a late flicker

    // Function to send logs to worker
    async function serverLog(level, message, data = {}) {
      try {
        await fetch(`${WORKER_URL}log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            level: level,
            message: message,
            data: data,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        // Silently fail - don't expose logging errors to console
      }
    }

    // Function to report errors to worker
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

    function prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function easeOutCubic(progress) {
      return 1 - Math.pow(1 - progress, 3);
    }

    function animateAmount(element, from, to) {
      return new Promise((resolve) => {
        let startTime = null;

        function step(now) {
          if (startTime === null) startTime = now;
          const progress = Math.min((now - startTime) / AMOUNT_ANIMATION_MS, 1);
          element.textContent = String(Math.round(from + (to - from) * easeOutCubic(progress)));
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }

        requestAnimationFrame(step);
      });
    }

    // Lock the span to its widest value so the surrounding text never moves mid-animation
    function reserveWidth(element, values) {
      const original = element.textContent;
      const widths = values.map((value) => {
        element.textContent = String(value);
        return element.getBoundingClientRect().width;
      });
      element.textContent = original;
      element.style.minWidth = `${Math.ceil(Math.max(...widths))}px`;
    }

    // Returns true if the displayed amount changed
    async function updateAmount(element, target) {
      const current = parseInt(element.textContent, 10);
      if (current === target) return false;

      if (Number.isNaN(current) || prefersReducedMotion()) {
        element.textContent = String(target);
      } else {
        reserveWidth(element, [current, target]);
        await animateAmount(element, current, target);
        element.style.minWidth = ""; // Release so fonts without tabular digits don't keep a gap
      }
      element.dataset.geoAmount = String(target);
      return true;
    }

    function appendStateName(headline, stateName) {
      if (!stateName || headline.dataset.geoStateAppended) return false;
      const anchor = headline.querySelector(STATE_ANCHOR_SELECTOR);
      if (!anchor) return false;

      anchor.after(document.createTextNode(` in ${stateName}`));
      headline.dataset.geoStateAppended = "true";
      return true;
    }

    async function applyHeadlineAmount(headline, amountElement, data, fetchTime) {
      if (fetchTime > MAX_LOOKUP_MS) {
        serverLog("info", "Skipped headline amount update (slow lookup)", { fetchTimeMs: fetchTime.toFixed(2) });
        return false;
      }

      const amountChanged = await updateAmount(amountElement, data.amount);
      const stateAppended = appendStateName(headline, data.stateName);
      serverLog("info", "Updated headline amount", { amount: data.amount, amountChanged, stateAppended });
      return amountChanged || stateAppended;
    }

    async function updateHeadline() {
      const startTime = performance.now();

      try {
        serverLog("info", "Fetching geo data from worker");
        // Pass pathname as query parameter for reliable path detection (fallback if referer is blocked)
        const pathname = window.location.pathname;
        const workerUrl = `${WORKER_URL}${pathname ? `?path=${encodeURIComponent(pathname)}` : ""}`;
        const response = await fetch(workerUrl);

        if (!response.ok) {
          const error = new Error(`Network response was not ok: ${response.status}`);
          serverLog("error", "Fetch failed", { status: response.status });
          reportError(error, "fetch_failed");
          throw error;
        }

        const data = await response.json();
        const fetchTime = performance.now() - startTime;

        serverLog("info", "Geo data received", {
          ...data,
          fetchTimeMs: fetchTime.toFixed(2),
          requestId: response.headers.get("X-Request-Id"),
          debug: data.debug,
        });

        let elementsUpdated = [];
        let headlineAmountUpdate = null;

        // Only update if we have a US state headline
        if (data.headline) {
          const headlines = document.querySelectorAll(HEADLINE_SELECTOR);
          serverLog("info", `Found ${headlines.length} headline elements`);
          const amountElement = headlines[0]?.querySelector(AMOUNT_SELECTOR);

          if (amountElement && Number.isFinite(data.amount)) {
            // Runs alongside the other updates; awaited before the final log
            headlineAmountUpdate = applyHeadlineAmount(headlines[0], amountElement, data, fetchTime);
          } else if (headlines.length > 0) {
            headlines[0].innerHTML = data.headline; // Use innerHTML since we're receiving HTML content
            serverLog("info", "Updated headline with state-specific content");
            elementsUpdated.push("headline");
          } else {
            serverLog("warn", "No headlines found", { selector: HEADLINE_SELECTOR });
            reportError(new Error("No headline elements found"), { selector: HEADLINE_SELECTOR, hasHeadlineData: true });
          }
        } else {
          serverLog("info", "No headline available for location", {
            country: data.country,
            region: data.region,
            stateAbbr: data.stateAbbr,
            hasHeadline: false,
          });
        }

        // Update avg-homeowner element if available, hide it if state is not approved
        const avgHomeowner = document.querySelector(AVG_HOMEOWNER_SELECTOR);
        if (avgHomeowner) {
          if (data.avgHeadline) {
            const isStartUs = pathname.includes("/start/united-states");
            const isStartUsaHea = pathname.includes("/start/usa/hea");
            const superscript = isStartUs ? "" : `<sup class="headline-superscript">1</sup>`;
            avgHomeowner.innerHTML = `${data.avgHeadline}${superscript}`;
            serverLog("info", "Updated avg-homeowner element");
            elementsUpdated.push("avgHomeowner");
          } else {
            avgHomeowner.textContent = "Homeowners love getting cash from Point's home equity products.";
            serverLog("info", "Set avg-homeowner element to default text (state not approved)");
          }
        } else {
          serverLog("warn", "No avg-homeowner element found", { selector: AVG_HOMEOWNER_SELECTOR });
        }

        // Update footnote element if available
        if (data.footnote) {
          const footnoteElement = document.querySelector(AVG_HOMEOWNER_FOOTNOTE_SELECTOR);
          if (footnoteElement) {
            const orderedList = footnoteElement.querySelector("ol");
            if (orderedList) {
              // Store the existing legal text content
              const existingLegalText = orderedList.querySelector("li").textContent;

              // Clear and recreate the list
              orderedList.innerHTML = "";
              orderedList.setAttribute("start", "1");
              orderedList.setAttribute("role", "list");

              // Create single list item containing both pieces of text
              const listItem = document.createElement("li");
              listItem.innerHTML = `${data.footnote}.<br><br>${existingLegalText}`;
              orderedList.appendChild(listItem);

              serverLog("info", "Updated footnote with state-specific content");
              elementsUpdated.push("footnote");
            } else {
              serverLog("warn", "No ordered list found in footnote element");
            }
          } else {
            serverLog("warn", "No footnote element found", { selector: AVG_HOMEOWNER_FOOTNOTE_SELECTOR });
          }
        }

        if (headlineAmountUpdate && (await headlineAmountUpdate)) {
          elementsUpdated.push("headline");
        }

        const totalTime = performance.now() - startTime;
        serverLog("info", `Page personalization complete in ${totalTime.toFixed(2)}ms`, {
          elementsUpdated,
          state: data.stateName || "Default",
          country: data.country,
        });
      } catch (error) {
        serverLog("error", "Error fetching or applying geo data", { error: error.message });
        reportError(error, "updateHeadline_error");
      }
    }

    // Global error handler
    window.addEventListener("error", (event) => {
      reportError(event.error || event.message, "window_error");
    });

    // Unhandled promise rejection handler
    window.addEventListener("unhandledrejection", (event) => {
      reportError(event.reason, "unhandled_promise_rejection");
    });

    // Run immediately since we're already in DOMContentLoaded
    serverLog("info", "Starting geo-personalization");
    updateHeadline();
  });
})();
