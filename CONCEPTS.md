# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as the compound-engineering plugin's `/ce-compound` and `/ce-compound-refresh` commands process learnings (direct edits are fine too, and the file is useful without the plugin). Glossary only, not a spec or catch-all.

## Sister Apps & Shared Infrastructure

### Sister Apps
The pair of separately-deployed WTCS apps — this Map Vote/Ban app and the Community Polls app — that deliberately share infrastructure and conventions (a single analytics project, parallel branding and config) yet run as independent deployments on different origins.

Parity between them is maintained by mirroring deliberately; there is no automated sync, so drift is silent. A shared resource that both apps feed is told apart per app via the App Tag. A change worth mirroring is backported to both sides only when it is an improvement, not reflexively.

### App Tag
The per-app identifier attached to every analytics event so the two Sister Apps can be distinguished within the single analytics project they share. Each app sends its own fixed value, which is what makes per-app filtering possible without paying for a separate project per app.
