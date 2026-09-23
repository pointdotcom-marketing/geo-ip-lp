--- Repository Documentation ---

# Geo IP Landing Page Documentation

## Overview

This repository provides a simple geo-detection system. It uses Cloudflare Workers to dynamically update landing page content based on the visitor's location. The system consists of a Cloudflare Worker for location detection and a client-side JavaScript script for page updates.

## Quick Start

1. **Install Wrangler:**

   ```bash
   npm install -g wrangler
   ```

2. **Authenticate with Cloudflare:**

   ```bash
   wrangler login
   ```

3. **Install project dependencies:**

   ```bash
   npm install
   ```

4. **Deploy the worker:**

   ```bash
   wrangler deploy
   ```

   During first deployment, Wrangler will prompt you to set up a `*.workers.dev` subdomain if you haven't configured one.

5. **Integrate with your landing page:**
   - Copy the content of `client.js`
   - Paste it into your landing page's custom code section (e.g., in Webflow)
   - **Important:** Update `WORKER_URL` in `client.js` with your deployed worker URL (format: `https://<your-worker>.<your-subdomain>.workers.dev`)

## Development

1. **Start local development server:**

   ```bash
   wrangler dev
   ```

   This will start a local server at `localhost:8787` for testing your Worker.

2. **View logs from deployed Worker:**

   ```bash
   wrangler tail
   ```

   This command will start a session to livestream logs from your deployed Worker.

3. **Check deployment status:**
   ```bash
   wrangler deployments list
   ```
   View recent deployments and their status.

## Configuration

### Cloudflare Worker (`worker.js`)

- **`US_STATES` Array:** Defines US states and their corresponding average amounts. Customize this array to modify headlines and data for each state.
- **`generateHeadline(state)` Function:** Template for generating the main headline. Edit this function to change the headline structure.
- **`generateStateSocialProofHeadline(state)` Function:** Template for generating the social proof headline. Edit this function to change the social proof headline structure.
- **`STATE_HEADLINES` Constant:** Generated headlines for each state based on `generateHeadline`.
- **`STATE_AVG_HEADLINES` Constant:** Generated social proof headlines for each state based on `generateStateSocialProofHeadline`.
- **`fetch(request)` Function:**
  - Handles incoming requests to the worker.
  - Detects visitor location using Cloudflare's `request.cf` object.
  - Returns a JSON response containing:
    - `headline`: Location-specific headline (US states only).
    - `avgHeadline`: Location-specific average homeowner headline (US states only).
    - `country`: Visitor's country.
    - `region`: Visitor's region (state in the US).
    - `city`: Visitor's city.
    - `debug`: Debugging information.
  - Sets CORS headers to allow cross-origin requests.
  - Sets `Cache-Control` header for browser caching.

### Client-side Script (`client.js`)

- **`WORKER_URL` Variable:** **Required configuration.** Update this to the URL of your deployed Cloudflare Worker.
- **`HEADLINE_SELECTOR` Variable:** CSS selector for the HTML element to be updated with the main headline (default: `h1`).
- **`AVG_HOMEOWNER_SELECTOR` Variable:** CSS selector for the HTML element to be updated with the average homeowner headline (default: `#avg-homeowner`).
- **`AVG_HOMEOWNER_FOOTNOTE_SELECTOR` Variable:** CSS selector for the HTML element to be updated with footnote (currently unused in provided code).
- **`updateHeadline()` Function:**
  - Fetches geo data from the Cloudflare Worker at `WORKER_URL`.
  - Updates the HTML content of the elements selected by `HEADLINE_SELECTOR` and `AVG_HOMEOWNER_SELECTOR` with data received from the worker.
  - Logs debug information and handles potential errors during the fetch process.
- The script executes `updateHeadline()` when the DOM is fully loaded (`DOMContentLoaded` event).

### Wrangler Configuration (`wrangler.toml`)

- **`name`:** Defines the name of your Cloudflare Worker (`geo-ip-detector`).
- **`main`:** Specifies the main worker script file (`worker.js`).
- **`compatibility_date`:** Sets the compatibility date for Cloudflare Workers runtime features (`2024-01-01`).

## Dependencies

- **`wrangler`:** Cloudflare Workers CLI for development and deployment.

## Customization

- **Headlines:** Modify the `generateHeadline` and `generateStateSocialProofHeadline` functions in `worker.js` to customize the generated headlines.
- **Target Elements:** Change `HEADLINE_SELECTOR`, `AVG_HOMEOWNER_SELECTOR` in `client.js` to target different HTML elements on your landing page.
- **State Data:** Update the `US_STATES` array in `worker.js` to adjust average amounts or add/modify states.
- **Extend Worker Logic:** Expand the `fetch` function in `worker.js` to include more complex logic or data processing based on location information.

## Best Practices and Recommendations

### Client-side Script (`client.js`)

#### Current Strengths

- Well-structured and readable code with descriptive variable names
- Proper use of `DOMContentLoaded` event
- Effective use of `async/await` for fetch operations
- Good error handling for network requests and missing DOM elements

#### Recommended Improvements

1. **Performance**

   - Use `document.querySelector` instead of `querySelectorAll` when targeting single elements
   - Consider adding loading states while fetching data
   - Add JSON parsing error handling with try/catch around `response.json()`

2. **Production Readiness**

   - Remove or reduce `console.log` statements
   - Consider implementing a more structured logging approach if detailed logging is needed

3. **Security**
   - If response content becomes untrusted in the future, implement HTML sanitization
   - Consider using `textContent` instead of `innerHTML` if HTML tags aren't needed

### Cloudflare Worker (`worker.js`)

#### Current Strengths

- Well-organized code with good use of constants
- Efficient data structure usage
- Proper CORS configuration
- Effective browser caching implementation (1-hour cache)
- Good handling of missing geo-location data

#### Recommended Improvements

1. **Error Handling**

   - Add try/catch blocks if implementing more complex logic or external API calls
   - Consider more explicit error handling for edge cases

2. **Security**

   - For production, consider restricting `Access-Control-Allow-Origin` to specific trusted domains instead of "\*"
   - Regularly review exposed data sensitivity
   - Implement input validation if adding user input handling

3. **Performance**
   - Current implementation is lightweight and efficient
   - Consider adjusting cache duration based on your update frequency needs

### General Best Practices

1. **Testing**

   - Implement thorough testing for both client and worker code
   - Test with various geo-locations and edge cases
   - Test browser compatibility

2. **Monitoring**

   - Consider implementing proper logging and monitoring in production
   - Monitor worker execution times and error rates
   - Track cache hit rates

3. **Documentation**
   - Keep code comments up to date
   - Document any security considerations for future developers
   - Maintain changelog for significant updates

--- End of Documentation ---
