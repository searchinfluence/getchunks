# Google Tag Manager

getchunks uses the **shared Search Influence GTM container `GTM-4G43`** — the same
container as AI Website Grader and Ontologizer.

The ID is hardcoded in [public/index.html](public/index.html) (script tag in `<head>`
plus the `<noscript>` iframe). There is no build-time injection; the old
`scripts/build.js` + `GTM_ID` env var mechanism was removed in v3.1 because it
mutated the source file in place, and GTM container IDs are public in page
source anyway.

To change the container, edit both occurrences of the ID in `public/index.html`.
