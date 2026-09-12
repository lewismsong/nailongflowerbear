# nailongflowerbear

A small shared “I miss you” web app backed by Firebase Realtime Database.

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
    │   ├── bear-with-flower.png
    │   ├── bears-sitting-lake.png
    │   ├── bears.jpg
    │   ├── cat-house.png
    │   └── cat-sprite-sheet-v3.png
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
        ├── navigation.js   # shared bottom tab navigation
        ├── pixel-companions.js # draggable Pakku and house behavior
        ├── platform.js     # safe storage and Firebase initialization
        └── todo.js         # shared todo state and interactions
```
