# Europe display geography

Made with Natural Earth. Relief and lakes are **public domain** according to the [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/). Natural Earth permits commercial use, modification and redistribution. Credit: Tom Patterson, Nathaniel Vaughn Kelso, Natural Earth contributors and NACIS. The Natural Earth Europe lake supplement credits the European Commission, Joint Research Centre (CCM 2.1); Natural Earth explicitly releases its generalized supplement as public domain. This project uses that supplement, **not the separately licensed original CCM database**.

Downloaded 2026-10-12:

| Dataset | Source description | Archive |
| --- | --- | --- |
| Shaded Relief Basic, medium, 3.2.0 | [10m shaded relief](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-shaded-relief/), SRTM Plus derived grayscale land hillshade | [SR_LR.zip](https://naciscdn.org/naturalearth/10m/raster/SR_LR.zip) |
| Lakes + Reservoirs, 5.0.0 | [10m lakes](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/) | [ne_10m_lakes.zip](https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip) |
| Europe lake supplement, 5.0.0 | Same page, Europe supplement and its explicit public-domain statement | [ne_10m_lakes_europe.zip](https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes_europe.zip) |
| Global 110m countries | Natural Earth contributor repository; source for non-playable land barriers | [ne_110m_admin_0_countries.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson) |

`scripts/generate_topography.py` crops the georeferenced EPSG:4326 TIFF using its world file, then resamples to the existing map's linear longitude/latitude projection: west −25.5°, east 55°, south 33.2°, north 73.5°. It emits a 3200×1800 RGBA PNG aligned with the 1600×900 world. Flat gray (206) is removed; actual dark and light terrain values become transparent shadows and highlights. Per-pixel alpha is capped at 18%, then rendered at 65% opacity (maximum effective relief opacity about 11.7%). No mountain positions are invented. This covers the Alps, Pyrenees, Carpathians, Apennines, Dinarides, Balkan and Scandinavian mountains directly from the raster.

The two lake datasets produce 988 features intersecting the map extent, including Constance/Bodensee, Geneva/Genfersee, Garda, Balaton, Vänern, Vättern and Saimaa. Lake polygons retain islands with even-odd filling; projected linework is simplified at 0.12 world pixels. Lake fill uses 50% muted blue-gray. The renderer clips both lakes and relief to the existing geographical land outlines and caches the entire layer at DPR 2. Labels, cities, combat and controls render above it. Rivers are omitted to keep the map quiet.

Checked-in outputs are `src/assets/europe-relief.png`, `src/assets/topography-sources.json` (dimensions, extent, input SHA-256 hashes), `src/data/topography.ts`, and `src/data/navigation-barriers.ts`. No download, Python package or geographic service is needed at runtime or in Docker/CI. Relief and lake geography are display-only: they never modify ownership, land/water classification, defense or movement rules. A separately generated navigation barrier mask excludes non-playable real African/Asian land from sea routes; this corrects ocean accessibility without turning those areas into playable territory.

To reproduce, download the three linked ZIP archives and the global country GeoJSON to one temporary directory, create a temporary Python environment, install `Pillow==11.3.0` and `pyshp==3.1.6`, then run:

```sh
python scripts/generate_topography.py /path/to/archives
npm run build
```

The existing country outlines and navigation raster remain the repository's Natural Earth 110m derivation (`src/data/europe.ts`). Consequently, very small islands, narrow straits and coastline details are limited by that existing raster; hillshade and lake data do not silently change gameplay coastlines. Maritime routes use four-neighbor ocean cells and cannot cross a raster land barrier even if a real-world strait is narrower than one cell.
