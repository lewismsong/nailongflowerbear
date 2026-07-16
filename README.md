# nailongflowerbear

A small shared “I miss you” web app backed by Firebase Realtime Database.

## Project structure

```text
.
├── coinflip.html           # animated white-bear-or-brown-bear coin flip
├── index.html              # page structure and external resource loading
├── todo.html               # shared Firebase-backed editable scratchpad
└── assets
    ├── css
    │   ├── coinflip.css    # coin flip layout and animation
    │   ├── styles.css      # main app layout and components
    │   └── todo.css        # scratchpad layout and components
    ├── images
    │   ├── bear-with-flower.png
    │   └── bears.jpg
    └── js
        ├── app.js          # main application state and interactions
        ├── coinflip.js     # coin flip state and interaction
        ├── config.js       # Firebase and game configuration
        ├── navigation.js   # shared bottom tab navigation
        └── todo.js         # shared todo state and interactions
```
