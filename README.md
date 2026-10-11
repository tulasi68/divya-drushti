# Divya Dhrushti

A tiny, dependency-free, mobile-first voice walking companion prototype. It is plain HTML, CSS and JavaScript: no Node.js, build step, framework, login, database or paid API key.

## Features
- Browser speech output and optional speech recognition for destination entry.
- GPS location and spoken location lookup.
- Destination search using OpenStreetMap Nominatim.
- Pedestrian route instructions from the public Valhalla demo service.
- English (India), Hindi and Kannada speech-language choices (actual voice availability depends on the device).
- Experimental camera preview and periodic local snapshots; this build does **not** generate image descriptions.
- Installable PWA shell and basic offline caching for the app files.

## Run it
For GPS, speech recognition and camera access, use HTTPS. After publishing, open the site in Chrome on Android, grant permissions only when asked, and use **Add to Home screen** / **Install app** if offered. You can also run a local static server; opening the HTML as a `file://` URL may block important browser features.

## Free hosting
This repository can be hosted on GitHub Pages at:
`https://tulasi68.github.io/divya-drushti/`

For GitHub Free, the repository must be public. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, then save. Publishing may take a few minutes. GitHub Pages is free under its plan and usage rules; no provider can promise that a free service will remain available forever or never change its terms.

## Important safety limits
This is an early prototype, not a certified mobility aid. GPS is imprecise, especially indoors and near tall buildings. Route directions and estimated distances can be wrong. It cannot reliably identify vehicles, stairs, potholes, curbs, construction, signals, or moving hazards. Camera snapshots are not interpreted in this version. Never depend on it as the only means of safe travel; use a cane, guide dog or trusted assistance, and test with a qualified orientation-and-mobility professional before real-world use.

## Third-party services
Destination lookup uses OpenStreetMap Nominatim and pedestrian routing uses a public Valhalla demo endpoint. These services have their own availability, usage policies and rate limits; they are not guaranteed to be free or available forever. Do not send repeated automated requests. For production use, review each service's current policy and obtain a reliable routing/geocoding arrangement.
