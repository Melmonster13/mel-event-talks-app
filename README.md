# BigQuery Release Hub

BigQuery Release Hub is a modern, premium single-page web portal designed to monitor, filter, bookmark, and share official Google Cloud BigQuery release updates. 

It fetches the live Atom XML feed from Google Cloud, segments bulk updates into readable category-specific cards, and provides an integrated, real-time X (Twitter) compose drafting simulator.

---

## Key Features

* **Granular Release Cards**: Daily release updates are parsed and split into individual cards by category (*Feature*, *Announcement*, *Issue*).
* **Caching & Fallbacks**: Server-side in-memory caching keeps the feed loaded under 1 hour. If Google Cloud's servers are unreachable, it falls back to serving the cached copy with a user toast notification.
* **Search & Filters**: Instantly query releases using keywords or narrow them down by category (*Features*, *Announcements*, *Issues*) directly from the sidebar.
* **X (Twitter) Sharing Intent**: Compose and preview updates in a responsive X mock card that measures character length (280 characters target) and triggers an official Twitter intent window.
* **Bookmarks & Local Logs**: Bookmark updates or look back at a timeline log of what you have drafted to post on X—persisted locally using browser `localStorage`.
* **Sleek Aesthetics**: Modern dark mode with glassmorphic cards, neon accent highlights, and smooth micro-animations.

---

## File Directory

* [app.py](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/app.py) — Flask server, endpoint configuration, caching, and XML/HTML parsing logic.
* [templates/index.html](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/templates/index.html) — Base HTML structure, navigation tabs, filter sidebar, and modal wrapper.
* [static/style.css](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/static/style.css) — Custom stylesheet providing dark theme palettes, glowing badges, animations, and modals.
* [static/app.js](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/static/app.js) — DOM controller, search/filter algorithms, modal inputs, character counting, and storage interfaces.
* [requirements.txt](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/requirements.txt) — Project packages (`Flask`, `requests`, and `beautifulsoup4`).
* [run.sh](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/run.sh) — Virtual environment automation and server initialization.
* [.gitignore](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/.gitignore) — Tells Git which temp/compiled folders to ignore.

---

## Quick Start Setup

To run the application locally on macOS/Linux:

1. **Clone & Navigate** into the project:
   ```bash
   cd bq-releases-notes
   ```

2. **Run the Initialization Script**:
   Run the automatic installer script to set up your virtual environment, install requirements, and boot up the server:
   ```bash
   chmod +x run.sh
   ./run.sh
   ```

3. **Open the Portal**:
   Once the server starts up, open your web browser and navigate to:
   ```
   http://localhost:8000
   ```

---

## Technical Details

### Server-Side Segmenter
Inside [app.py](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/app.py), we download the Atom XML feed. Daily updates can contain multiple release announcements grouped together. We parse this structure utilizing Python's `BeautifulSoup` to look for heading `<h3>` headers. We extract everything between headers to output separate records, providing clean raw HTML and extracted plain-text payloads for the frontend.

### Client-Side State
The frontend in [app.js](file:///Users/melcadd/developer/agy-cli-projects/bq-releases-notes/static/app.js) tracks the active tab and search filters. All rendering is performed dynamically on the client side using template strings. When saving items or drafting a tweet, the browser's `localStorage` API stores the changes securely on your local device.
