(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const WORKER_URL = "https://geo-ip-detector.ops-1df.workers.dev/"; // Update this with your worker URL
    const HEADLINE_SELECTOR = "h1"; // Update this if you want to target a specific h1 with an ID or class
    const SOCIAL_PROOF_HEADLINE_SELECTOR = "#avg-homeowner"; // Selector for the avg-homeowner element
    const AVG_HOMEOWNER_FOOTNOTE_SELECTOR = "#footnote-rtf"; // Selector for the footnote-rtf element to update with avg amount details.
    const AVG_HOMEOWNER_SELECTOR = "#avg-homeowner"; // Added AVG_HOMEOWNER_SELECTOR

    // Function to send logs to worker
    /**
     * @param {"info" | "warn" | "error"} level
     * @param {string} message
     * @param {Record<string, unknown>} [data]
     */
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
    /**
     * @param {any} error Error object, message string, or rejection reason.
     * @param {string | Record<string, unknown>} context
     */
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

    async function updateHeadline() {
      const startTime = performance.now();

      try {
        await serverLog("info", "Fetching geo data from worker");
        // Pass pathname as query parameter for reliable path detection (fallback if referer is blocked)
        const pathname = window.location.pathname;
        const workerUrl = `${WORKER_URL}${pathname ? `?path=${encodeURIComponent(pathname)}` : ""}`;
        const response = await fetch(workerUrl);

        if (!response.ok) {
          const error = new Error(`Network response was not ok: ${response.status}`);
          await serverLog("error", "Fetch failed", { status: response.status });
          await reportError(error, "fetch_failed");
          throw error;
        }

        const data = await response.json();
        const fetchTime = performance.now() - startTime;

        await serverLog("info", "Geo data received", {
          ...data,
          fetchTimeMs: fetchTime.toFixed(2),
          requestId: response.headers.get("X-Request-Id"),
          debug: data.debug,
        });

        let elementsUpdated = [];

        // Only update if we have a US state headline
        if (data.headline) {
          const headlines = document.querySelectorAll(HEADLINE_SELECTOR);
          await serverLog("info", `Found ${headlines.length} headline elements`);

          if (headlines.length > 0) {
            headlines[0].innerHTML = data.headline; // Use innerHTML since we're receiving HTML content
            await serverLog("info", "Updated headline with state-specific content");
            elementsUpdated.push("headline");
          } else {
            await serverLog("warn", "No headlines found", { selector: HEADLINE_SELECTOR });
            await reportError(new Error("No headline elements found"), { selector: HEADLINE_SELECTOR, hasHeadlineData: true });
          }
        } else {
          await serverLog("info", "No headline available for location", {
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
            await serverLog("info", "Updated avg-homeowner element");
            elementsUpdated.push("avgHomeowner");
          } else {
            avgHomeowner.textContent = "Homeowners love getting cash from Point's home equity products.";
            await serverLog("info", "Set avg-homeowner element to default text (state not approved)");
          }
        } else {
          await serverLog("warn", "No avg-homeowner element found", { selector: AVG_HOMEOWNER_SELECTOR });
        }

        // Update footnote element if available
        if (data.footnote) {
          const footnoteElement = document.querySelector(AVG_HOMEOWNER_FOOTNOTE_SELECTOR);
          if (footnoteElement) {
            const orderedList = footnoteElement.querySelector("ol");
            if (orderedList) {
              // Store the existing legal text content
              const existingLegalText = /** @type {HTMLLIElement} */ (orderedList.querySelector("li")).textContent;

              // Clear and recreate the list
              orderedList.innerHTML = "";
              orderedList.setAttribute("start", "1");
              orderedList.setAttribute("role", "list");

              // Create single list item containing both pieces of text
              const listItem = document.createElement("li");
              listItem.innerHTML = `${data.footnote}.<br><br>${existingLegalText}`;
              orderedList.appendChild(listItem);

              await serverLog("info", "Updated footnote with state-specific content");
              elementsUpdated.push("footnote");
            } else {
              await serverLog("warn", "No ordered list found in footnote element");
            }
          } else {
            await serverLog("warn", "No footnote element found", { selector: AVG_HOMEOWNER_FOOTNOTE_SELECTOR });
          }
        }

        const totalTime = performance.now() - startTime;
        await serverLog("info", `Page personalization complete in ${totalTime.toFixed(2)}ms`, {
          elementsUpdated,
          state: data.stateName || "Default",
          country: data.country,
        });
      } catch (error) {
        await serverLog("error", "Error fetching or applying geo data", { error: /** @type {any} */ (error).message });
        await reportError(error, "updateHeadline_error");
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
