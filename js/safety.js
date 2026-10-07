/**
 * SMVDU - BIO: Toxicity & Safety Controller (safety.js)
 * Clinical Hazard Tier Filtering, First-Aid Action Rendering,
 * and GIS Spatial Deep-Linking.
 */

document.addEventListener('DOMContentLoaded', () => {
    const cardsContainer = document.getElementById('hazard-cards-stage');
    const searchInput = document.getElementById('safety-search');

    // Filter Buttons
    const btnTierAll = document.getElementById('btn-tier-all');
    const btnTierSafe = document.getElementById('btn-tier-safe');
    const btnTierIrritant = document.getElementById('btn-tier-irritant');
    const btnTierToxic = document.getElementById('btn-tier-toxic');
    const tierButtons = [btnTierAll, btnTierSafe, btnTierIrritant, btnTierToxic];

    // Telemetry Targets
    const elStatSafe = document.getElementById('safety-stat-safe');
    const elStatIrritant = document.getElementById('safety-stat-irritant');
    const elStatToxic = document.getElementById('safety-stat-toxic');

    let activeTier = 'ALL';

    // ==========================================
    // 1. Telemetry Counters Synchronization
    // ==========================================
    function updateSafetyCounters() {
        if (typeof getCampusTelemetry === 'function') {
            const telemetry = getCampusTelemetry();
            if (elStatSafe) elStatSafe.textContent = telemetry.safeCount;
            if (elStatIrritant) elStatIrritant.textContent = telemetry.irritantCount;
            if (elStatToxic) elStatToxic.textContent = telemetry.toxicCount;
        }
    }

    // ==========================================
    // 2. Hazard Cards Renderer
    // ==========================================
    function renderHazardCards(records) {
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';

        if (!records || records.length === 0) {
            cardsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border: 1px dashed var(--border-color); border-radius: 8px;">
                    <i class="fa-solid fa-shield-halved" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
                    <h3 style="font-size: 1.1rem; color: var(--text-dark);">No Corresponding Species Found</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Adjust your search term or select another toxicity tier.</p>
                </div>
            `;
            return;
        }

        records.forEach(item => {
            const isToxic = item.toxicity === 'Toxic';
            const isIrritant = item.toxicity === 'Mild Irritant';

            let borderClass = 'border-safe';
            let chipClass = 'hazard-safe';
            let iconClass = 'fa-circle-check';

            if (isToxic) {
                borderClass = 'border-toxic';
                chipClass = 'hazard-toxic';
                iconClass = 'fa-triangle-exclamation';
            } else if (isIrritant) {
                borderClass = 'border-irritant';
                chipClass = 'hazard-irritant';
                iconClass = 'fa-circle-exclamation';
            }

            const card = document.createElement('article');
            card.className = `hazard-profile-card ${borderClass}`;

            card.innerHTML = `
                <div class="hazard-card-header">
                    <span class="font-mono" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">${escapeHtml(item.id)}</span>
                    <span class="hazard-chip ${chipClass}"><i class="fa-solid ${iconClass}"></i> ${escapeHtml(item.toxicity || 'Safe')}</span>
                </div>
                <div class="hazard-card-body">
                    <h3 class="hazard-botanical-name">${escapeHtml(item.botanicalName)}</h3>
                    <div style="font-size: 0.88rem; color: var(--text-dark); margin-top: 0.2rem;">
                        ${escapeHtml(item.commonName)} ${item.dogriName ? `&bull; <span style="color: var(--accent-gold); font-weight: 600;">${escapeHtml(item.dogriName)}</span>` : ''}
                    </div>

                    <div class="toxin-agent-box">
                        <div class="toxin-agent-label">Primary Active Compound / Hazard</div>
                        <div class="toxin-agent-val">${escapeHtml(item.toxicAgent || 'Non-hazardous tissue under standard handling.')}</div>
                    </div>

                    <div class="first-aid-box">
                        <strong><i class="fa-solid fa-notes-medical"></i> Clinical Field Action</strong>
                        ${escapeHtml(item.firstAid || 'Standard field hygiene protocol applies. Wash hands after plant contact.')}
                    </div>
                </div>
                <div class="hazard-card-footer">
                    <span class="font-mono" style="font-size: 0.74rem; color: var(--text-muted);"><i class="fa-solid fa-compass"></i> Zone: ${escapeHtml(item.zone)}</span>
                    <a href="maps.html?lat=${item.coords[0]}&lng=${item.coords[1]}&id=${encodeURIComponent(item.id)}" class="btn-action btn-outline" style="font-size: 0.72rem; padding: 0.3rem 0.65rem;">
                        <i class="fa-solid fa-map-pin"></i> View Habitat Map
                    </a>
                </div>
            `;

            cardsContainer.appendChild(card);
        });
    }

    // ==========================================
    // 3. Dynamic Filter Logic
    // ==========================================
    function applySafetyFilters() {
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const allRecords = (typeof getFloraData === 'function') ? getFloraData() : [];

        const filtered = allRecords.filter(item => {
            const matchesTier = (activeTier === 'ALL' || item.toxicity === activeTier);
            const matchesSearch = !query ||
                (item.botanicalName && item.botanicalName.toLowerCase().includes(query)) ||
                (item.commonName && item.commonName.toLowerCase().includes(query)) ||
                (item.dogriName && item.dogriName.toLowerCase().includes(query)) ||
                (item.toxicAgent && item.toxicAgent.toLowerCase().includes(query));

            return matchesTier && matchesSearch;
        });

        renderHazardCards(filtered);
    }

    function setTier(tier, activeBtn) {
        activeTier = tier;
        tierButtons.forEach(btn => btn?.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
        applySafetyFilters();
    }

    btnTierAll?.addEventListener('click', () => setTier('ALL', btnTierAll));
    btnTierSafe?.addEventListener('click', () => setTier('Safe', btnTierSafe));
    btnTierIrritant?.addEventListener('click', () => setTier('Mild Irritant', btnTierIrritant));
    btnTierToxic?.addEventListener('click', () => setTier('Toxic', btnTierToxic));

    searchInput?.addEventListener('input', applySafetyFilters);

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initial Execution
    updateSafetyCounters();
    applySafetyFilters();
});
/* =========================================================
   MEDICAL CENTRE — EXT. 2222
   ========================================================= */

(() => {
    const medicalCentreCall = document.getElementById('medical-centre-call');

    if (!medicalCentreCall) return;

    medicalCentreCall.addEventListener('click', () => {
        // Give mobile/telephone applications control of the tel: link.
        // Desktop browsers may simply show their configured calling app.
        if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            console.info('Medical Centre: +91 1991 285524 — Extension 2222');
        }
    });
})();