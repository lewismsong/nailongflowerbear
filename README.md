# nailongflowerbear

A small shared “I miss you” web app backed by Firebase Realtime Database.

## Firebase tooling

The app connects to the existing Realtime Database at `https://hi-baby-e6e24-default-rtdb.firebaseio.com`. The repository's Firebase CLI project alias is `hi-baby-e6e24`.

Install the development tools and sign in with the Google account that has access to that project:

```sh
npm ci
npm run firebase:login
npm run firebase:projects
npm run firebase -- database:instances:list
```

The official Firebase CLI is a development dependency; the static website still loads its browser SDK from the existing CDN scripts. CLI authentication is separate from the app's browser-side name selection. Credentials stay in the CLI's user configuration outside this repository. No Hosting configuration or replacement database rules are created by this setup.

See the [Firebase CLI documentation](https://firebase.google.com/docs/cli) for authentication and project management.

## Project structure

```text
.
├── coinflip.html           # animated white-bear-or-brown-bear coin flip
├── cities.html             # shared visited-cities scratch map
├── france.html             # itinerary and reservations
├── index.html              # miss counter and shared call state
├── todo.html               # shared Firebase-backed editable scratchpad
└── assets
    ├── css
    │   ├── all-time-adjustments.css # home-page all-time miss controls
    │   ├── base.css        # shared theme, reset, and bottom navigation
    │   ├── cities.css      # responsive scratch-map layout
    │   ├── coinflip.css    # coin flip layout and animation
    │   ├── france.css      # itinerary and reservation components
    │   ├── pixel-companions.css # draggable Pakku and house animation
    │   ├── styles.css      # home-page layout and components
    │   └── todo.css        # scratchpad layout and components
    ├── images
    │   ├── bear-with-flower.webp
    │   ├── bears-sitting-lake.webp
    │   ├── bears.jpg
    │   ├── cat-house.png
    │   └── cat-sprite-sheet-v3.webp
    ├── data
    │   └── world.svg       # country paths for the visited map
    └── js
        ├── all-time-adjustments.js # shared all-time miss adjustment behavior
        ├── app.js          # main application state and interactions
        ├── auth-guard.js   # blocks protected pages while logged out
        ├── cities.js       # city search, map state, and Firebase visits
        ├── coinflip.js     # coin flip state and interaction
        ├── config.js       # Firebase and game configuration
        ├── france.js       # itinerary and reservation state
        ├── miss-history.js # incremental miss totals, daily counts, and latest events
        ├── navigation.js   # shared bottom tab navigation
        ├── pixel-companions.js # draggable Pakku and house behavior
        ├── platform.js     # safe storage and Firebase initialization
        ├── todo.js         # shared todo state and interactions
        ├── trip-itinerary.js # shared day-note and trip-date editor
        └── trip-reservations.js # shared reservation editor
```

## Performance and validation

Miss history uses Firebase child events and incremental counters. Regular additions and forward timestamp corrections do not scan the history; deleting or moving a latest event backwards can require a scan. Calendar rendering reads daily counters rather than recalculating every event. Initial child events share a queued render, and date/time formatters are reused.

Trip pages share one itinerary editor and subscribe to individual day notes rather than the trip root. Text saves are debounced, unchanged blur events do not write, and subscription/write failures appear in the page. One-time setup checks its marker before starting a transaction, while retaining the transaction's marker check for concurrent first visits. Today's miss reset removes events and adjustments in one atomic database update.

Page scripts use `defer` in dependency order. Fonts load directly from HTML with connection hints, and navigation images use lazy loading and asynchronous decoding. Existing full-size artwork remains available as source assets.

Run the dependency-free regression tests from the repository root:

```sh
node --test tests/*.test.cjs
```

Browser validation of all nine main pages used a local HTTP server and mocked Firebase. It covers page initialization, live miss changes/removals, remote trip notes, and avoiding duplicate saves. It does not verify deployed Firebase rules or production network timings.

## Limits before larger-scale use

- The stored name and JavaScript passwords are UI gates, not server authentication. No Firebase Authentication integration or deployed database rules are included in this repo. Configure authenticated, authorized access and validate writes in Firebase before exposing private data to more users. See [Firebase's access guidance](https://firebase.google.com/docs/database/web/lists-of-data).
- Startup still downloads the full miss history to preserve lifetime totals and historical calendars without a database migration. Bounded reads require trusted daily/lifetime aggregates plus paginated history; limiting the existing query alone would make totals incorrect. Todo and city pages also subscribe to whole collections and rebuild their lists, so large collections need pagination and narrower subscriptions.
- Several full-size WebP images are hundreds of kilobytes, including artwork used as small icons. Lazy loading reduces initial work when those icons are offscreen, but generating appropriately sized image variants would further reduce cold-load transfer. Firebase SDK upgrades and a move from compat scripts to a modular build should be verified against the real backend before deployment.
