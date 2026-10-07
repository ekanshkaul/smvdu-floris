/**
 * SMVDU Floris: Spatial GIS & Vegetation Mapping Engine (js/maps.js)
 * Features:
 * 1. Native WGS84 Geodesic Area & Perimeter Calculation
 * 2. Mobile Field State Resilience (Auto-save draft coordinates & restoration toast)
 * 3. ArcGIS Online Tile Pipeline with Leaflet Clustering & Smooth Zooming
 * 4. Settings Dropdown Basemap Switcher (Street, Satellite, Topo) with Session Persistence
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. Geodesic Spatial Mathematics Engine (WGS84 Ellipsoid)
    // ----------------------------------------------------
    const WGS84_RADIUS = 6378137.0; // Equatorial radius in meters

    function calculateGeodesicArea(coords) {
        if (!coords || coords.length < 3) return 0;
        let total = 0;
        const len = coords.length;
        for (let i = 0; i < len; i++) {
            const p1 = coords[i];
            const p2 = coords[(i + 1) % len];
            const lat1 = (p1[0] * Math.PI) / 180;
            const lat2 = (p2[0] * Math.PI) / 180;
            const lngDiff = ((p2[1] - p1[1]) * Math.PI) / 180;
            total += lngDiff * (2 + Math.sin(lat1) + Math.sin(lat2));
        }
        return Math.abs((total * WGS84_RADIUS * WGS84_RADIUS) / 4.0);
    }

    function calculatePerimeter(coords) {
        if (!coords || coords.length < 2) return 0;
        let total = 0;
        const len = coords.length;
        for (let i = 0; i < len; i++) {
            const p1 = coords[i];
            const p2 = coords[(i + 1) % len];
            const lat1 = (p1[0] * Math.PI) / 180;
            const lat2 = (p2[0] * Math.PI) / 180;
            const deltaLat = ((p2[0] - p1[0]) * Math.PI) / 180;
            const deltaLng = ((p2[1] - p1[1]) * Math.PI) / 180;
            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
            total += WGS84_RADIUS * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        }
        return total;
    }

    function formatArea(m2) {
        return `${(m2 / 10000).toFixed(2)} Ha (${(m2 / 1e6).toFixed(3)} km²)`;
    }

    function formatLength(m) {
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        return `${Math.round(m)} m`;
    }

    // ----------------------------------------------------
    // 2. Campus Boundary & Ecological Sector Polygons
    // ----------------------------------------------------
    const CAMPUS_CENTER = [32.94190, 74.95380];
    const DEFAULT_ZOOM = 16;

    const SECTOR_DEFINITIONS = {
        "Pine Ridge Belt": {
            color: "#15803d", fillColor: "#22c55e",
            bounds: [[32.94300, 74.95300], [32.94520, 74.95320], [32.94550, 74.95600], [32.94350, 74.95620], [32.94280, 74.95480]],
            dominant: "Pinus roxburghii, Mallotus philippensis, Quercus leucotrichophora",
            desc: "Coniferous high-ridge canopy running along the northern perimeter."
        },
        "Academic Avenue": {
            color: "#a16207", fillColor: "#eab308",
            bounds: [[32.94050, 74.95250], [32.94300, 74.95280], [32.94320, 74.95500], [32.94070, 74.95480]],
            dominant: "Bauhinia variegata, Dalbergia sissoo, Cassia fistula",
            desc: "Central campus boulevard corridor uniting administrative and lecture complexes."
        },
        "Lower Scrublands": {
            color: "#c2410c", fillColor: "#f97316",
            bounds: [[32.93780, 74.95050], [32.94050, 74.95080], [32.94060, 74.95300], [32.93800, 74.95320]],
            dominant: "Acacia modesta, Calotropis procera, Ziziphus mauritiana",
            desc: "Arid south-facing terraces and boundary zones with drought-adapted thickets."
        },
        "Ravine Corridors": {
            color: "#0e7490", fillColor: "#06b6d4",
            bounds: [[32.94060, 74.95560], [32.94350, 74.95540], [32.94330, 74.95820], [32.94060, 74.95840]],
            dominant: "Equisetum ramosissimum, Adiantum capillus-veneris, Salix tetrasperma",
            desc: "Deep shaded nullah channels and seasonal drainage corridors."
        }
    };

    let totalCampusAreaM2 = 0;
    Object.keys(SECTOR_DEFINITIONS).forEach(key => {
        const sec = SECTOR_DEFINITIONS[key];
        sec.areaM2 = calculateGeodesicArea(sec.bounds);
        sec.perimeterM = calculatePerimeter(sec.bounds);
        totalCampusAreaM2 += sec.areaM2;
    });

    const mapElement = document.getElementById('campus-full-map');
    if (!mapElement || typeof L === 'undefined') return;

    const map = L.map('campus-full-map', {
        center: CAMPUS_CENTER, zoom: DEFAULT_ZOOM, zoomControl: true, attributionControl: false, preferCanvas: true
    });

    if (!map.zoomControl) {
        L.control.zoom({ position: 'topleft' }).addTo(map);
    }

    const TILE_CONFIG = { maxZoom: 19, keepBuffer: 6, updateWhenZooming: false, updateWhenIdle: true };
    const basemaps = {
        street: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', TILE_CONFIG),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', TILE_CONFIG),
        topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', TILE_CONFIG)
    };
    basemaps.street.addTo(map);

    map.invalidateSize(true);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => map.invalidateSize(true));
    }
    window.addEventListener('load', () => map.invalidateSize(true));

    if (typeof ResizeObserver !== 'undefined') {
        const mapResizeObserver = new ResizeObserver(() => map.invalidateSize());
        mapResizeObserver.observe(mapElement);
    } else {
        [50, 250, 600, 1200, 2000].forEach(delay => setTimeout(() => map.invalidateSize(true), delay));
    }
    window.addEventListener('resize', () => map.invalidateSize());

    function switchBasemap(layer, btn) {
        Object.values(basemaps).forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
        layer.addTo(map);

        const dropdownLayerButtons = document.querySelectorAll('#map-settings-dropdown [data-layer]');
        dropdownLayerButtons.forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        saveFieldState();
    }

    const sectorLayerGroup = L.featureGroup().addTo(map);
    const sectorPolygonMap = {};

    Object.keys(SECTOR_DEFINITIONS).forEach(sectorKey => {
        const info = SECTOR_DEFINITIONS[sectorKey];
        const polygon = L.polygon(info.bounds, {
            color: info.color, weight: 2, opacity: 0.85, fillColor: info.fillColor, fillOpacity: 0.18, dashArray: '4, 6'
        });
        polygon.on('click', () => highlightSector(sectorKey));
        polygon.bindTooltip(`<strong>${sectorKey}</strong><br><span style="font-size: 0.7rem;">Area: ${formatArea(info.areaM2)}</span>`, { sticky: true, className: 'sector-map-tooltip' });
        sectorPolygonMap[sectorKey] = polygon;
        sectorLayerGroup.addLayer(polygon);
    });

    const markerCluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 35, spiderfyOnMaxZoom: true, chunkedLoading: true }).addTo(map);
    let allSpecimenMarkers = [];

    function renderMapMarkers(records) {
        markerCluster.clearLayers();
        allSpecimenMarkers = [];
        records.forEach(item => {
            const colorClass = item.toxicity === "Toxic" ? "marker-toxic" : (item.toxicity === "Mild Irritant" ? "marker-irritant" : "marker-safe");
            const icon = L.divIcon({ className: 'custom-gis-pin-wrap', html: `<div class="gis-pin-node ${colorClass}"><i class="fa-solid fa-seedling"></i></div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
            const marker = L.marker(item.coords, { icon, title: item.botanicalName });
            marker.bindPopup(`<div class="gis-popup-card"><strong><em>${item.botanicalName}</em></strong><br>${item.commonName}</div>`);
            marker.specimenData = item;
            allSpecimenMarkers.push(marker);
            markerCluster.addLayer(marker);
        });
    }

    const sidebar = document.getElementById('map-sector-sidebar');
    const elSidebarTitle = document.getElementById('sidebar-sector-name');
    const elSidebarDesc = document.getElementById('sidebar-sector-desc');
    const elSidebarDominant = document.getElementById('sidebar-dominant');
    const elSidebarArea = document.getElementById('sidebar-area');
    const elSidebarSoil = document.getElementById('sidebar-soil');
    const elSidebarCount = document.getElementById('sidebar-specimen-count');

    function highlightSector(targetZone) {
        Object.keys(sectorPolygonMap).forEach(key => {
            const poly = sectorPolygonMap[key];
            if (targetZone === 'ALL' || targetZone === key) {
                poly.setStyle(targetZone === key ? { color: "#ffffff", weight: 4, fillOpacity: 0.45 } : { weight: 2, fillOpacity: 0.18 });
            } else {
                poly.setStyle({ color: "#9ca3af", weight: 1, fillOpacity: 0.08 });
            }
        });

        const allRecords = (typeof getFloraData === 'function') ? getFloraData() : [];
        if (targetZone === 'ALL') {
            map.flyTo(CAMPUS_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
            renderMapMarkers(allRecords);
            if (elSidebarTitle) elSidebarTitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> Sector Inspector`;
            if (elSidebarDesc) elSidebarDesc.textContent = "Select a sector button above or click a map polygon to inspect area and density.";
            if (elSidebarArea) elSidebarArea.textContent = `${formatArea(totalCampusAreaM2)} // Total Sum`;
            saveFieldState();
            return;
        }

        const targetPolygon = sectorPolygonMap[targetZone];
        const sectorInfo = SECTOR_DEFINITIONS[targetZone];
        if (targetPolygon) map.fitBounds(targetPolygon.getBounds(), { padding: [40, 40], maxZoom: 17, animate: true });

        const matchingRecords = allRecords.filter(r => r.zone === targetZone);
        renderMapMarkers(matchingRecords);

        if (elSidebarTitle) elSidebarTitle.innerHTML = `<i class="fa-solid fa-tree"></i> ${targetZone}`;
        if (elSidebarDesc) elSidebarDesc.textContent = sectorInfo.desc;
        if (elSidebarDominant) elSidebarDominant.textContent = sectorInfo.dominant;
        if (elSidebarArea) elSidebarArea.textContent = `${formatArea(sectorInfo.areaM2)} | Perim: ${formatLength(sectorInfo.perimeterM)}`;
        if (elSidebarCount) elSidebarCount.textContent = `${matchingRecords.length} Documented Taxa`;

        sidebar?.classList.remove('collapsed');
        saveFieldState();
    }

    const btnZoneAll = document.getElementById('filter-zone-all');
    const zoneButtons = [
        { btn: btnZoneAll, zone: 'ALL' },
        { btn: document.getElementById('filter-zone-pine'), zone: 'Pine Ridge Belt' },
        { btn: document.getElementById('filter-zone-avenue'), zone: 'Academic Avenue' },
        { btn: document.getElementById('filter-zone-scrub'), zone: 'Lower Scrublands' },
        { btn: document.getElementById('filter-zone-ravine'), zone: 'Ravine Corridors' }
    ];

    zoneButtons.forEach(({ btn, zone }) => {
        btn?.addEventListener('click', () => {
            zoneButtons.forEach(b => b.btn?.classList.remove('active'));
            btn.classList.add('active');
            highlightSector(zone);
        });
    });

    // ── Settings Dropdown Toggle & Basemap Switcher ──
    const settingsBtn = document.getElementById('btn-map-settings');
    const settingsDropdown = document.getElementById('map-settings-dropdown');

    settingsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.style.display = settingsDropdown.style.display === 'none' ? 'block' : 'none';
    });

    settingsDropdown?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
        if (settingsDropdown && !settingsBtn?.contains(e.target) && !settingsDropdown?.contains(e.target)) {
            settingsDropdown.style.display = 'none';
        }
    });

    const dropdownLayerButtons = settingsDropdown?.querySelectorAll('[data-layer]') || [];
    dropdownLayerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const layerType = btn.getAttribute('data-layer');
            if (layerType && basemaps[layerType]) {
                switchBasemap(basemaps[layerType], btn);
            }
            if (settingsDropdown) {
                settingsDropdown.style.display = 'none';
            }
        });
    });

    document.getElementById('btn-toggle-panel')?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
    document.getElementById('btn-close-sidebar')?.addEventListener('click', () => sidebar?.classList.add('collapsed'));
    document.getElementById('btn-recenter-map')?.addEventListener('click', () => {
        zoneButtons.forEach(b => b.btn?.classList.remove('active'));
        btnZoneAll?.classList.add('active');
        highlightSector('ALL');
    });

    // --- GeoJSON Export (in Settings dropdown) ---
    document.getElementById('btn-export-geojson-dropdown')?.addEventListener('click', () => {
        const records = (typeof getFloraData === 'function') ? getFloraData() : [];

        const featureCollection = {
            type: 'FeatureCollection',
            features: records
                .filter(item => Array.isArray(item.coords) && item.coords.length === 2)
                .map(item => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [item.coords[1], item.coords[0]]
                    },
                    properties: {
                        id: item.id,
                        botanicalName: item.botanicalName,
                        commonName: item.commonName,
                        dogriName: item.dogriName || null,
                        zone: item.zone,
                        toxicity: item.toxicity || 'Safe',
                        toxicAgent: item.toxicAgent || null
                    }
                }))
        };

        const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'smvdu-floris-campus-flora.geojson';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        if (settingsDropdown) settingsDropdown.style.display = 'none';
    });

    let isPinpointActive = false;
    let pinpointMarker = null;
    const btnTogglePinpoint = document.getElementById('btn-toggle-pinpoint');
    const pinpointReadout = document.getElementById('pinpoint-readout');
    const pinpointCoords = document.getElementById('pinpoint-coords');

    btnTogglePinpoint?.addEventListener('click', () => {
        isPinpointActive = !isPinpointActive;
        btnTogglePinpoint.classList.toggle('active', isPinpointActive);
        mapElement.style.cursor = isPinpointActive ? 'crosshair' : '';
        if (pinpointReadout) pinpointReadout.style.display = isPinpointActive ? 'inline-flex' : 'none';
        if (!isPinpointActive && pinpointMarker) { map.removeLayer(pinpointMarker); pinpointMarker = null; }
    });

    map.on('click', (e) => {
        if (!isPinpointActive) return;
        const coordString = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        if (pinpointCoords) pinpointCoords.textContent = coordString;
        if (!pinpointMarker) {
            pinpointMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: '#b5835a', color: '#fff', weight: 2, fillOpacity: 0.9 }).addTo(map);
        } else {
            pinpointMarker.setLatLng(e.latlng);
        }
    });

    // ── Field State Resilience ──
    const STORAGE_KEY = 'smvdu_floris_map_session';
    function saveFieldState() {
        try {
            if (!map) return;
            const c = map.getCenter();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                lat: c.lat, lng: c.lng, zoom: map.getZoom(),
                activeZone: zoneButtons.find(z => z.btn?.classList.contains('active'))?.zone || 'ALL',
                activeBasemap: document.querySelector('#map-settings-dropdown [data-layer].active')?.getAttribute('data-layer') || 'street',
                pinpointActive: isPinpointActive,
                pinpointCoords: pinpointCoords?.textContent || null,
                timestamp: Date.now()
            }));
        } catch (e) {}
    }

    map.on('moveend zoomend', saveFieldState);
    setInterval(saveFieldState, 10000);

    function offerSessionRestore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || !saved.timestamp || Math.round((Date.now() - saved.timestamp) / 60000) > 1440) return;

            document.querySelector('.field-restore-toast')?.remove();
            const toast = document.createElement('div');
            toast.className = 'field-restore-toast';
            toast.innerHTML = `
                <span><i class="fa-solid fa-clock-rotate-left" style="color: var(--primary);"></i> Previous session available.</span>
                <div class="toast-actions">
                    <button type="button" class="btn-action btn-toast" id="btn-restore-session">Restore</button>
                    <button type="button" class="btn-action btn-outline btn-toast" id="btn-dismiss-toast">&times;</button>
                </div>
            `;
            document.body.appendChild(toast);

            document.getElementById('btn-restore-session').onclick = () => {
                if (saved.lat && saved.lng) map.setView([saved.lat, saved.lng], saved.zoom || DEFAULT_ZOOM);
                if (saved.activeZone && saved.activeZone !== 'ALL') {
                    const btn = zoneButtons.find(z => z.zone === saved.activeZone)?.btn;
                    if (btn) { zoneButtons.forEach(b => b.btn?.classList.remove('active')); btn.classList.add('active'); highlightSector(saved.activeZone); }
                }
                if (saved.activeBasemap && basemaps[saved.activeBasemap]) {
                    const layerBtn = document.querySelector(`#map-settings-dropdown [data-layer="${saved.activeBasemap}"]`);
                    switchBasemap(basemaps[saved.activeBasemap], layerBtn);
                }
                toast.remove();
                localStorage.removeItem(STORAGE_KEY);
            };
            document.getElementById('btn-dismiss-toast').onclick = () => { toast.remove(); localStorage.removeItem(STORAGE_KEY); };
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 15000);
        } catch (e) {}
    }

    function syncInitialMap() {
        const records = (typeof getFloraData === 'function') ? getFloraData() : [];
        renderMapMarkers(records);

        const urlParams = new URLSearchParams(window.location.search);
        const linkLat = parseFloat(urlParams.get('lat'));
        const linkLng = parseFloat(urlParams.get('lng'));
        const linkId = urlParams.get('id');

        if (!Number.isNaN(linkLat) && !Number.isNaN(linkLng)) {
            map.setView([linkLat, linkLng], 18);
            const targetMarker = allSpecimenMarkers.find(m =>
                linkId ? (m.specimenData && m.specimenData.id === linkId) : false
            );
            if (targetMarker) {
                markerCluster.zoomToShowLayer(targetMarker, () => {
                    targetMarker.openPopup();
                });
            }
        } else {
            offerSessionRestore();
        }
    }

    syncInitialMap();
});