/**
 * SMVDU - BIO: Herbarium Database Controller (js/database.js)
 * 15-Item Paginated Ledger, Card Inspector Modal, Specimen QR Generator,
 * High-Capacity IndexedDB Photo Intake & 4x6 Plaque Print Engine.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Filters Dropdown Toggle
    const btnFilters = document.getElementById('btn-filters');
    const filtersDropdown = document.getElementById('filters-dropdown');

    btnFilters?.addEventListener('click', (e) => {
        e.stopPropagation();
        filtersDropdown.style.display = filtersDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Prevent dropdown from closing when clicking inside it
    filtersDropdown?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (filtersDropdown && !btnFilters?.contains(e.target) && !filtersDropdown?.contains(e.target)) {
            filtersDropdown.style.display = 'none';
        }
    });

    // Core Elements
    const tableBody = document.getElementById('flora-table-body');
    const searchInput = document.getElementById('flora-search');
    const filterZone = document.getElementById('filter-zone');
    const filterHabit = document.getElementById('filter-habit');
    const filterToxicity = document.getElementById('filter-toxicity');
    const btnReset = document.getElementById('btn-reset-filters');
    const btnExportCsv = document.getElementById('btn-export-csv');

    // Telemetry Stat Targets
    const elDbTotal = document.getElementById('db-stat-total');
    const elDbFamilies = document.getElementById('db-stat-families');
    const elDbObs = document.getElementById('db-stat-observations');
    const elDbVisible = document.getElementById('db-stat-visible');

    // Pagination State & Controls
    const PAGE_SIZE = 15;
    let currentPage = 1;
    let currentFilteredRecords = [];

    const btnPrevPage = document.getElementById('btn-prev-page');
    const btnNextPage = document.getElementById('btn-next-page');
    const elCurrentPageNum = document.getElementById('current-page-num');
    const elTotalPagesNum = document.getElementById('total-pages-num');
    const elPaginationInfo = document.getElementById('pagination-info');

    // Specimen Inspection Card Modal Elements
    const cardModal = document.getElementById('specimen-card-modal');
    const btnCloseCardModal = document.getElementById('btn-close-card-modal');

    // Dedicated Specimen QR Modal Elements
    const qrModal = document.getElementById('specimen-qr-modal');
    const btnCloseQrModal = document.getElementById('btn-close-specimen-qr');
    const qrModalId = document.getElementById('qr-modal-id');
    const qrModalBotanical = document.getElementById('qr-modal-botanical');
    const qrModalCommon = document.getElementById('qr-modal-common');
    const qrModalImg = document.getElementById('specimen-qr-image');
    const btnDownloadQr = document.getElementById('btn-download-qr');
    const btnPrintQrPlaque = document.getElementById('btn-print-qr-plaque');
    let activeQrItem = null;

    // Observation Intake Form & Modal Elements
    const observationModal = document.getElementById('observation-modal');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const formAddSpecimen = document.getElementById('form-add-specimen');

    // GPS Auto-Acquire Elements
    const btnAcquireGps = document.getElementById('btn-acquire-gps');
    const inputLat = document.getElementById('input-lat');
    const inputLng = document.getElementById('input-lng');
    const gpsStatusMsg = document.getElementById('gps-status-msg');

    // High-Capacity HD Photo Intake State
    const inputPhoto = document.getElementById('input-photo');
    const previewWrap = document.getElementById('photo-preview-wrap');
    const previewImg = document.getElementById('photo-preview-img');
    const photoStatus = document.getElementById('photo-status');
    let highResPhotoBase64 = "";

    // Helper: Permanent Deep Link URL
    function getSpecimenDeepLink(id) {
        const origin = window.location.origin && window.location.origin !== "null"
            ? window.location.origin
            : "https://smvdu.ac.in/bio";
        const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        return `${origin}${path}database.html?q=${encodeURIComponent(id)}`;
    }

    // Helper: Construct QR Code API URL
    function getQrCodeUrl(dataString, size = 200) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(dataString)}&margin=1`;
    }

    // ==========================================
    // 1. One-Tap High-Accuracy GPS Auto-Fill
    // ==========================================
    btnAcquireGps?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            if (gpsStatusMsg) gpsStatusMsg.textContent = "Geolocation is not supported by your browser.";
            return;
        }

        const originalBtnHtml = btnAcquireGps.innerHTML;
        btnAcquireGps.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locking GPS...';
        btnAcquireGps.disabled = true;
        if (gpsStatusMsg) gpsStatusMsg.textContent = "Acquiring satellite constellation lock...";

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(5);
                const lng = pos.coords.longitude.toFixed(5);
                const acc = Math.round(pos.coords.accuracy);

                if (inputLat) inputLat.value = lat;
                if (inputLng) inputLng.value = lng;

                if (gpsStatusMsg) {
                    gpsStatusMsg.innerHTML = `<span style="color: var(--text-success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Fixed: ${lat}°N, ${lng}°E (±${acc}m accuracy)</span>`;
                }

                btnAcquireGps.innerHTML = '<i class="fa-solid fa-check"></i> Captured';
                btnAcquireGps.disabled = false;
                setTimeout(() => { btnAcquireGps.innerHTML = originalBtnHtml; }, 2500);
            },
            (err) => {
                console.warn("GPS Acquisition failed:", err);
                let message = "Unable to retrieve GPS coordinates.";
                if (err.code === 1) message = "Location permission denied by user.";
                else if (err.code === 2) message = "Position unavailable (low satellite reception).";
                else if (err.code === 3) message = "GPS request timed out.";

                if (gpsStatusMsg) {
                    gpsStatusMsg.innerHTML = `<span style="color: var(--icon-fg-red);"><i class="fa-solid fa-triangle-exclamation"></i> ${message}</span>`;
                }
                btnAcquireGps.innerHTML = originalBtnHtml;
                btnAcquireGps.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0
            }
        );
    });

    // ==========================================
    // 2. High-Capacity HD Canvas Photo Processor
    // ==========================================
    inputPhoto?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            highResPhotoBase64 = "";
            if (previewWrap) previewWrap.style.display = 'none';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDimension = 1600; // Increased to 1600px HD now that IndexedDB handles 1GB+

                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // High quality JPEG encoding (0.85)
                highResPhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);

                if (previewImg && previewWrap && photoStatus) {
                    previewImg.src = highResPhotoBase64;
                    previewWrap.style.display = 'flex';
                    const approxKb = Math.round((highResPhotoBase64.length * (3 / 4)) / 1024);
                    photoStatus.textContent = `IndexedDB HD: ~${approxKb} KB`;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ==========================================
    // 3. Telemetry Refresh Utility
    // ==========================================
    function refreshTelemetry(visibleCount) {
        if (typeof getCampusTelemetry === 'function') {
            const telemetry = getCampusTelemetry();
            if (elDbTotal) elDbTotal.textContent = telemetry.totalSpecies;
            if (elDbFamilies) elDbFamilies.textContent = telemetry.totalFamilies;
            if (elDbObs) elDbObs.textContent = telemetry.records.length;
        }
        if (elDbVisible) elDbVisible.textContent = visibleCount;
    }

    // ==========================================
    // 4. Paginated Ledger Renderer (15 items/page)
    // ==========================================
    function renderPaginatedTable() {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        const totalRecords = currentFilteredRecords.length;
        refreshTelemetry(totalRecords);

        if (totalRecords === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                        <i class="fa-solid fa-seedling" style="font-size: 1.8rem; color: var(--accent-gold); margin-bottom: 0.5rem; display: block;"></i>
                        No botanical specimens match your active query filters.
                    </td>
                </tr>
            `;
            if (elPaginationInfo) elPaginationInfo.innerHTML = "Showing <strong>0</strong> specimens";
            if (elCurrentPageNum) elCurrentPageNum.textContent = "1";
            if (elTotalPagesNum) elTotalPagesNum.textContent = "1";
            if (btnPrevPage) btnPrevPage.disabled = true;
            if (btnNextPage) btnNextPage.disabled = true;
            return;
        }

        const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);
        const pageItems = currentFilteredRecords.slice(startIndex, endIndex);

        if (elPaginationInfo) {
            elPaginationInfo.innerHTML = `Showing <strong>${startIndex + 1}–${endIndex}</strong> of <strong>${totalRecords}</strong> specimens`;
        }
        if (elCurrentPageNum) elCurrentPageNum.textContent = currentPage;
        if (elTotalPagesNum) elTotalPagesNum.textContent = totalPages;
        if (btnPrevPage) btnPrevPage.disabled = (currentPage === 1);
        if (btnNextPage) btnNextPage.disabled = (currentPage === totalPages);

        pageItems.forEach(item => {
            const tr = document.createElement('tr');
            const isToxic = item.toxicity === 'Toxic';
            const isIrritant = item.toxicity === 'Mild Irritant';
            const chipClass = isToxic ? 'hazard-toxic' : (isIrritant ? 'hazard-irritant' : 'hazard-safe');

            tr.innerHTML = `
                <td class="font-mono" style="font-weight: 700; color: var(--primary); font-size: 0.78rem;">${escapeHtml(item.id)}</td>
                <td>
                    <strong style="font-style: italic; color: var(--text-heading); font-size: 0.95rem; display: block;">${escapeHtml(item.botanicalName)}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.commonName)}</span>
                </td>
                <td style="color: var(--accent-gold); font-weight: 600; font-size: 0.84rem;">${escapeHtml(item.dogriName || '--')}</td>
                <td style="font-size: 0.84rem;">${escapeHtml(item.family || 'N/A')}</td>
                <td style="font-size: 0.84rem;">${escapeHtml(item.habit || 'N/A')}</td>
                <td style="font-size: 0.84rem;">${escapeHtml(item.zone || 'N/A')}</td>
                <td><span class="hazard-chip ${chipClass}">${escapeHtml(item.toxicity || 'Safe')}</span></td>
                <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button type="button" class="btn-action btn-outline btn-tool btn-view-card" data-id="${escapeHtml(item.id)}" title="Inspect Full Specimen Card">
                            <i class="fa-solid fa-id-card"></i> View Card
                        </button>
                        <button type="button" class="btn-action btn-tool btn-open-qr" data-id="${escapeHtml(item.id)}" title="Generate &amp; Print QR Tag" style="background: var(--accent-gold); border-color: var(--accent-gold);">
                            <i class="fa-solid fa-qrcode"></i> QR Plaque
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-view-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const target = currentFilteredRecords.find(r => r.id === id);
                if (target) openSpecimenModal(target);
            });
        });

        document.querySelectorAll('.btn-open-qr').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const target = currentFilteredRecords.find(r => r.id === id);
                if (target) openSpecimenQrModal(target);
            });
        });
    }

    btnPrevPage?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPaginatedTable();
            document.querySelector('.density-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    btnNextPage?.addEventListener('click', () => {
        const totalPages = Math.ceil(currentFilteredRecords.length / PAGE_SIZE);
        if (currentPage < totalPages) {
            currentPage++;
            renderPaginatedTable();
            document.querySelector('.density-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // ==========================================
    // 5. Dedicated Specimen QR Code Modal
    // ==========================================
    function openSpecimenQrModal(item) {
        if (!qrModal) return;
        activeQrItem = item;

        const deepLink = getSpecimenDeepLink(item.id);
        const qrUrl = getQrCodeUrl(deepLink, 220);

        if (qrModalId) qrModalId.textContent = item.id;
        if (qrModalBotanical) qrModalBotanical.textContent = item.botanicalName;
        if (qrModalCommon) qrModalCommon.textContent = `${item.commonName} ${item.dogriName ? `(${item.dogriName})` : ''}`;
        if (qrModalImg) qrModalImg.src = qrUrl;

        qrModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeSpecimenQrModal() {
        if (!qrModal) return;
        qrModal.style.display = 'none';
        document.body.style.overflow = '';
        activeQrItem = null;
    }

    btnCloseQrModal?.addEventListener('click', closeSpecimenQrModal);
    qrModal?.addEventListener('click', (e) => {
        if (e.target === qrModal) closeSpecimenQrModal();
    });

    btnDownloadQr?.addEventListener('click', () => {
        if (!activeQrItem || !qrModalImg) return;
        const link = document.createElement('a');
        link.href = qrModalImg.src;
        link.download = `QR_${activeQrItem.id}_${activeQrItem.botanicalName.replace(/\s+/g, '_')}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    btnPrintQrPlaque?.addEventListener('click', () => {
        if (activeQrItem) {
            printBotanicalPlaque(activeQrItem);
        }
    });

    // ==========================================
    // 6. Specimen Detailed Modal Inspection Card
    // ==========================================
    function openSpecimenModal(item) {
        if (!cardModal) return;

        document.getElementById('modal-card-botanical').innerHTML = `<i class="fa-solid fa-seedling"></i> ${escapeHtml(item.botanicalName)}`;
        document.getElementById('modal-card-id').textContent = item.id;
        document.getElementById('modal-card-common').textContent = item.commonName;
        document.getElementById('modal-card-dogri').textContent = item.dogriName ? `Dogri: ${item.dogriName}` : '';
        document.getElementById('modal-card-family').textContent = item.family || 'N/A';
        document.getElementById('modal-card-habit').textContent = item.habit || 'N/A';
        document.getElementById('modal-card-zone').textContent = item.zone || 'N/A';
        document.getElementById('modal-card-elevation').textContent = item.elevation || '820m MSL';
        document.getElementById('modal-card-coords').textContent = `${item.coords[0].toFixed(5)}° N, ${item.coords[1].toFixed(5)}° E`;
        document.getElementById('modal-card-iucn').textContent = item.iucn || 'LC';
        document.getElementById('modal-card-phenology').textContent = item.phenology || 'Standard foothill phenological pattern.';
        document.getElementById('modal-card-notes').textContent = item.notes || 'Specimen documented under campus survey framework.';

        const toxEl = document.getElementById('modal-card-toxicity');
        toxEl.className = `hazard-chip ${item.toxicity === 'Toxic' ? 'hazard-toxic' : (item.toxicity === 'Mild Irritant' ? 'hazard-irritant' : 'hazard-safe')}`;
        toxEl.textContent = item.toxicity || 'Safe';

        const photoContainer = document.getElementById('modal-card-photo-container');
        const photoEl = document.getElementById('modal-card-photo');
        if (item.photo) {
            photoEl.src = item.photo;
            photoContainer.style.display = 'block';
        } else {
            photoContainer.style.display = 'none';
        }

        const mapLink = document.getElementById('modal-card-maplink');
        if (mapLink) {
            mapLink.href = `maps.html?lat=${item.coords[0]}&lng=${item.coords[1]}&id=${encodeURIComponent(item.id)}`;
        }

        const printBtn = document.getElementById('modal-card-printbtn');
        if (printBtn) {
            printBtn.onclick = () => printBotanicalPlaque(item);
        }

        cardModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeSpecimenModal() {
        if (!cardModal) return;
        cardModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    btnCloseCardModal?.addEventListener('click', closeSpecimenModal);
    cardModal?.addEventListener('click', (e) => {
        if (e.target === cardModal) closeSpecimenModal();
    });

    // ==========================================
    // 7. Query & Facet Filter Engine
    // ==========================================
    function applyFilters() {
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const selectedZone = filterZone ? filterZone.value : 'ALL';
        const selectedHabit = filterHabit ? filterHabit.value : 'ALL';
        const selectedToxicity = filterToxicity ? filterToxicity.value : 'ALL';

        const allRecords = (typeof getFloraData === 'function') ? getFloraData() : [];

        currentFilteredRecords = allRecords.filter(item => {
            const matchesSearch = !query ||
                (item.botanicalName && item.botanicalName.toLowerCase().includes(query)) ||
                (item.commonName && item.commonName.toLowerCase().includes(query)) ||
                (item.dogriName && item.dogriName.toLowerCase().includes(query)) ||
                (item.family && item.family.toLowerCase().includes(query)) ||
                (item.id && item.id.toLowerCase().includes(query));

            const matchesZone = (selectedZone === 'ALL' || item.zone === selectedZone);
            const matchesHabit = (selectedHabit === 'ALL' || item.habit === selectedHabit);
            const matchesToxicity = (selectedToxicity === 'ALL' || item.toxicity === selectedToxicity);

            return matchesSearch && matchesZone && matchesHabit && matchesToxicity;
        });

        renderPaginatedTable();
    }

    searchInput?.addEventListener('input', () => { currentPage = 1; applyFilters(); });
    filterZone?.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterHabit?.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterToxicity?.addEventListener('change', () => { currentPage = 1; applyFilters(); });

btnReset?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (filterZone) filterZone.value = 'ALL';
    if (filterHabit) filterHabit.value = 'ALL';
    if (filterToxicity) filterToxicity.value = 'ALL';

    currentPage = 1;
    applyFilters();

    if (filtersDropdown) {
        filtersDropdown.style.display = 'none';
    }
});

    // Listen to background IndexedDB readiness & changes
    window.addEventListener('smvdu:dataready', () => applyFilters());
    window.addEventListener('smvdu:datachanged', () => applyFilters());

    // ==========================================
    // 8. Observation Intake Modal Handling
    // ==========================================
    function toggleObservationModal(show) {
        if (!observationModal) return;
        observationModal.style.display = show ? 'flex' : 'none';
        if (show) {
            document.body.style.overflow = 'hidden';
            formAddSpecimen?.reset();
            highResPhotoBase64 = "";
            if (previewWrap) previewWrap.style.display = 'none';
            if (gpsStatusMsg) gpsStatusMsg.textContent = 'Manual entry active or click "Get Current GPS" during field sampling.';
            document.getElementById('input-botanical')?.focus();
        } else {
            document.body.style.overflow = '';
        }
    }

    btnOpenModal?.addEventListener('click', () => toggleObservationModal(true));
    btnCloseModal?.addEventListener('click', () => toggleObservationModal(false));
    btnCancelModal?.addEventListener('click', () => toggleObservationModal(false));

    observationModal?.addEventListener('click', (e) => {
        if (e.target === observationModal) toggleObservationModal(false);
    });

    formAddSpecimen?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newEntry = {
            botanicalName: document.getElementById('input-botanical').value,
            commonName: document.getElementById('input-common').value,
            dogriName: document.getElementById('input-dogri').value,
            family: document.getElementById('input-family').value,
            habit: document.getElementById('input-habit').value,
            zone: document.getElementById('input-zone').value,
            toxicity: document.getElementById('input-toxicity').value,
            elevation: document.getElementById('input-elevation').value || '820m MSL',
            lat: parseFloat(inputLat.value) || 32.94190,
            lng: parseFloat(inputLng.value) || 74.95380,
            notes: document.getElementById('input-notes').value,
            photo: highResPhotoBase64 || null
        };

        if (typeof logObservation === 'function') {
            await logObservation(newEntry);
        }

        toggleObservationModal(false);
        currentPage = 1;
        applyFilters();
    });

    // ==========================================
    // 9. CSV Dataset Export Engine
    // ==========================================
    btnExportCsv?.addEventListener('click', () => {
        const records = (typeof getFloraData === 'function') ? getFloraData() : [];
        if (records.length === 0) return;

        const headers = ["Specimen ID", "Botanical Name", "Common English Name", "Dogri Vernacular", "Family", "Habit", "Sector Zone", "Elevation", "Toxicity", "Latitude", "Longitude", "IUCN Status", "Field Notes", "Portal URL"];

        const rows = records.map(r => [
            `"${r.id}"`,
            `"${r.botanicalName}"`,
            `"${r.commonName}"`,
            `"${r.dogriName || ''}"`,
            `"${r.family || ''}"`,
            `"${r.habit || ''}"`,
            `"${r.zone || ''}"`,
            `"${r.elevation || ''}"`,
            `"${r.toxicity || 'Safe'}"`,
            r.coords[0],
            r.coords[1],
            `"${r.iucn || 'LC'}"`,
            `"${(r.notes || '').replace(/"/g, '""')}"`,
            `"${getSpecimenDeepLink(r.id)}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SMVDU_Flora_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ==========================================
    // 10. 4x6 Botanical Plaque Print Generator
    // ==========================================
    function printBotanicalPlaque(item) {
        const printStage = document.getElementById('plaque-print-stage');
        if (!printStage) return;

        const deepLink = getSpecimenDeepLink(item.id);
        const qrUrl = getQrCodeUrl(deepLink, 140);

        printStage.innerHTML = `
            <div class="plaque-outer-frame">
                <div class="plaque-header-sub">
                    <span>SMVDU CAMPUS FLORA PROJECT &bull; FIELD HERBARIUM ARCHIVE</span>
                    <span>${escapeHtml(item.id)}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 6px;">
                    <div style="flex: 1; padding-right: 12px;">
                        <div class="plaque-botanical-name" style="margin-top: 0;">${escapeHtml(item.botanicalName)}</div>
                        <div class="plaque-vernacular">
                            <strong>Common:</strong> ${escapeHtml(item.commonName)}
                            ${item.dogriName ? ` &bull; <strong>Dogri:</strong> ${escapeHtml(item.dogriName)}` : ''}
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <img src="${qrUrl}" alt="Plaque QR" style="width: 85px; height: 85px; border: 1px solid #1e4620; padding: 2px;">
                        <div style="font-size: 6pt; font-family: 'Courier New', monospace; color: #555; margin-top: 2px;">SCAN TELEMETRY</div>
                    </div>
                </div>

                <div class="plaque-meta-grid" style="margin-top: 4px;">
                    <div><strong>FAMILY:</strong> ${escapeHtml(item.family || 'N/A')}</div>
                    <div><strong>HABIT:</strong> ${escapeHtml(item.habit || 'N/A')}</div>
                    <div><strong>SECTOR:</strong> ${escapeHtml(item.zone || 'N/A')}</div>
                    <div><strong>ELEVATION:</strong> ${escapeHtml(item.elevation || '820m MSL')}</div>
                    <div><strong>GPS:</strong> ${item.coords[0].toFixed(5)}°N, ${item.coords[1].toFixed(5)}°E</div>
                    <div><strong>TOXICITY:</strong> ${escapeHtml(item.toxicity || 'Safe')}</div>
                </div>

                <div class="plaque-notes">
                    <strong>ETHNOBOTANICAL &amp; FIELD NOTES:</strong><br>
                    ${escapeHtml(item.notes || 'Specimen cataloged under standardized campus quadrat survey protocol.')}
                </div>

                <div class="plaque-footer">
                    <span>SHRI MATA VAISHNO DEVI UNIVERSITY, KATRA</span>
                    <span>DYD BATCH OF 2026 &bull; GIS CAMPUS AUDIT</span>
                </div>
            </div>
        `;

        setTimeout(() => {
            window.print();
        }, 300);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam && searchInput) {
        searchInput.value = queryParam;
    }

    applyFilters();

    if (queryParam) {
        const records = (typeof getFloraData === 'function') ? getFloraData() : [];
        const exactMatch = records.find(r => r.id.toLowerCase() === queryParam.toLowerCase());
        if (exactMatch) {
            setTimeout(() => openSpecimenModal(exactMatch), 300);
        }
    }
});