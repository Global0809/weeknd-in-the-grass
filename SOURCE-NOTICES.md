# Source and asset notices

## Creative concept and reference

**The Weeknd — In the Grass** is an independent creative presentation concept. It does not claim endorsement by The Weeknd, XO, Republic Records or Apple.

The commissioning user identified themselves as the designer of [Karma Tracks](https://karma-tracks.com/c/pop) and requested this adaptation. The meadow's authored grass/flora shaders, ground treatment, mathematical card layout, portrait-card composition, foil/pearl material treatment and interaction model were ported from the publicly delivered reference into the local `src/` modules. The original landing room and its other environments are not included.

Design/source reference: [Karma Tracks / Pop](https://karma-tracks.com/c/pop), inspected 9 November 2026. [Ground texture](https://karma-tracks.com/lab/ground-grass3.jpg), retained as `public/reference/ground-grass3.jpg`. This notice records provenance; it does not assert a separate public license for the reference's code or artwork.

## Artist content

Era names, release metadata, official listening links and remote preview URLs were prepared from [The Weeknd's Apple Music catalog](https://music.apple.com/us/artist/the-weeknd/479756766) and Apple's public catalog API on 9 November 2026. Local cover images were downloaded from the catalog's Apple media CDN URLs. New short era descriptions are original creative copy, not copied editorial or song lyrics.

The nine local cover assets and their sources are listed below. The catalog edition's copyright year can differ from the original release year displayed in the experience.

| Local cover file                              | Official catalog edition                                                                               | Artwork source                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/artist/hurry-up-tomorrow.jpg`         | [Hurry Up Tomorrow](https://music.apple.com/us/album/hurry-up-tomorrow/1793654348)                     | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/49/9b/6e/499b6e2d-648f-1a4e-31b8-fb7f06a8123c/25UMGIM09490.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/dawn-fm.jpg`                   | [Dawn FM](https://music.apple.com/us/album/dawn-fm/1603171516)                                         | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2f/22/a9/2f22a9a6-5af1-5846-a44e-ba016724ed69/21UM1IM58860.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/after-hours.jpg`               | [After Hours](https://music.apple.com/us/album/after-hours/1499378108)                                 | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/my-dear-melancholy.jpg`        | [My Dear Melancholy,](https://music.apple.com/us/album/my-dear-melancholy/1363309866)                  | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2a/aa/b4/2aaab42a-a4cb-a600-4a25-d78961495960/18UMGIM17204.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/starboy.jpg`                   | [Starboy](https://music.apple.com/us/album/starboy/1440871397)                                         | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/61/f8/e261f8c1-73db-9a7a-c89e-1068f19970e0/16UMGIM67863.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/beauty-behind-the-madness.jpg` | [Beauty Behind the Madness](https://music.apple.com/us/album/beauty-behind-the-madness/1440826239)     | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/40/cd/1a/40cd1a65-7948-eb96-74c6-1c4b3497456c/15UMGIM36513.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/kiss-land.jpg`                 | [Kiss Land](https://music.apple.com/us/album/kiss-land/1422667786)                                     | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f1/7f/7a/f17f7a98-1e96-b29d-2916-df7fcf63f34e/13UAAIM69533.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/trilogy.jpg`                   | [Trilogy](https://music.apple.com/us/album/trilogy/1714908584)                                         | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/66/d5/13/66d513dd-3cb0-b86b-4d11-1fbab2e6a639/12UMGIM54989.rgb.jpg/1200x1200bb.jpg) |
| `public/artist/house-of-balloons.jpg`         | [House of Balloons (Original)](https://music.apple.com/us/album/house-of-balloons-original/1558941834) | [Apple media CDN](https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/31/18/fa/3118fab0-90ea-2ae5-cf6c-bc64054ab9e3/21UMGIM21449.rgb.jpg/1200x1200bb.jpg) |

Catalog copyright credits include The Weeknd XO, Inc.; The Weeknd XO Music ULC; XO&co., Inc.; Republic Records; and UMG Recordings, Inc. Album art, artist identity and recordings remain the property of their respective rights holders. The project does not grant a new license to those assets.

`public/artist/xo-logo.png` is a retained transparent XO asset from [The Weeknd's official website](https://www.theweeknd.com/wp-content/uploads/sites/2105/2024/08/xo-logo-250.png). The header and favicon use this official asset.

All 27 preview URLs are stored in `src/eras.js` and fetched remotely only when needed. Full songs are not included in the package. Excerpt lengths and remote availability are controlled by the catalog provider. The experience links to the official catalog for complete releases.

Kiss Land's displayed original release date, 10 September 2013, follows [Universal Music Canada's release announcement](https://www.universalmusic.ca/2013/07/22/the-weeknds-kiss-land-to-arrive-september-10/) rather than the current catalog edition's generic January date. Trilogy retains its original 2012 release year while linking to the current catalog edition.

## Fonts

The fonts are self-hosted under `public/fonts/`. Both families use the **SIL Open Font License, Version 1.1**. Their complete license texts accompany the binaries in `public/fonts/licenses/`.

| Family / files                                                       | Copyright and upstream license                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gloock / `gloock-latin.woff2`                                        | Copyright 2022 The Gloock Project Authors ([project](https://github.com/duartp/gloock)); [OFL](public/fonts/licenses/Gloock-OFL.txt), [upstream copy](https://raw.githubusercontent.com/google/fonts/main/ofl/gloock/OFL.txt)                    |
| Space Mono / `space-mono-latin.woff2`, `space-mono-bold-latin.woff2` | Copyright 2016 The Space Mono Project Authors ([project](https://github.com/googlefonts/spacemono)); [OFL](public/fonts/licenses/Space-Mono-OFL.txt), [upstream copy](https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/OFL.txt) |

The supplied font binaries match the Karma reference's self-hosted Latin subsets. Gloock's italic appearance is synthesized by the browser/canvas, as in the reference.

## Runtime packages

The application uses React, Three.js, GSAP and Lucide React within the supplied Vinext/Sites/Cloudflare starter. Exact versions are recorded in `package.json` and `package-lock.json`; each dependency's license remains in its installed package. Preserve the existing vendored Sites plugin license under `scripts/vite/` when distributing the source. This notices file does not replace those dependency licenses.

## Optimized visual derivatives

The page serves 1024-pixel WebP versions of the cover photographs at quality 90, and a quality-88 WebP of the reference ground image. These are compression and format derivatives of the credited originals; no generative image changes were made. Original JPEG downloads remain in the source package for reference. Across the nine covers and the ground texture, the served image files total 2,060,076 bytes, compared with 5,165,249 bytes for the original JPEG files (about 60% less). The meadow waits for its first two rows and the artwork needed around the current view. Other card artwork is deferred until it approaches the viewport. Resize and quality replacements become visible together after their required artwork is ready.
