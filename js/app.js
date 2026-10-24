/**
 * VELOCITY — Premium Automotive Digital Showroom
 * Official BTNG Frontend Final Project Script
 * 
 * Features:
 * - Direct REST API integration (https://api-web.dnccudinus.org/api/mobil)
 * - Safe DOM manipulation (document.createElement, textContent)
 * - Dynamic filtering (search, brand, fuel type) & multi-criterion sorting
 * - Live dynamic counters (total, available, brands)
 * - Accessible <dialog> modal with backdrop light-dismiss fallback
 * - Graceful image fallback & infinite error loop prevention
 * - Mobile navigation drawer & active section observer
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Constants & Application State
  // -------------------------------------------------------------------------
  const API_ENDPOINT = 'https://api-web.dnccudinus.org/api/mobil';
  const FALLBACK_IMAGE = 'assets/images/fallback-car.svg';

  const state = {
    allVehicles: [],
    filteredVehicles: [],
    isLoading: false,
    errorMessage: null,
    filters: {
      searchQuery: '',
      brand: 'all',
      fuel: 'all',
      sort: 'default'
    }
  };

  // Rupiah Currency Formatter using standard Intl.NumberFormat
  const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  });

  // -------------------------------------------------------------------------
  // 2. DOM Elements Cache
  // -------------------------------------------------------------------------
  const DOM = {
    // Navigation
    header: document.getElementById('header'),
    mobileToggleBtn: document.getElementById('mobile-toggle-btn'),
    mobileDrawer: document.getElementById('mobile-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    mobileNavLinks: document.querySelectorAll('.mobile-nav-link'),
    desktopNavLinks: document.querySelectorAll('.desktop-nav .nav-link'),

    // Hero Section
    heroStatTotal: document.getElementById('hero-stat-total'),
    heroStatAvailable: document.getElementById('hero-stat-available'),
    heroStatBrands: document.getElementById('hero-stat-brands'),
    heroCarImage: document.getElementById('hero-car-image'),
    heroCarBrand: document.getElementById('hero-car-brand'),
    heroCarName: document.getElementById('hero-car-name'),

    // Collection Intro Stats
    statTotalCount: document.getElementById('stat-total-count'),
    statAvailableCount: document.getElementById('stat-available-count'),
    statSoldCount: document.getElementById('stat-sold-count'),

    // Controls
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterBrand: document.getElementById('filter-brand'),
    filterFuel: document.getElementById('filter-fuel'),
    sortBy: document.getElementById('sort-by'),
    btnResetFilters: document.getElementById('btn-reset-filters'),

    // Status Bar & Grid
    visibleCount: document.getElementById('visible-count'),
    totalCount: document.getElementById('total-count'),
    activeTagsList: document.getElementById('active-tags-list'),
    vehiclesGrid: document.getElementById('vehicles-grid'),

    // UI States
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    btnRetryFetch: document.getElementById('btn-retry-fetch'),
    emptyState: document.getElementById('empty-state'),
    btnEmptyReset: document.getElementById('btn-empty-reset'),

    // Detail Modal Dialog
    vehicleModal: document.getElementById('vehicle-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalDismiss: document.getElementById('btn-modal-dismiss'),
    btnModalInquire: document.getElementById('btn-modal-inquire'),
    modalInquiryToast: document.getElementById('modal-inquiry-toast'),
    modalVehicleImage: document.getElementById('modal-vehicle-image'),
    modalVehicleStatus: document.getElementById('modal-vehicle-status'),
    modalVehicleId: document.getElementById('modal-vehicle-id'),
    modalVehicleRuang: document.getElementById('modal-vehicle-ruang'),
    modalVehicleBrand: document.getElementById('modal-vehicle-brand'),
    modalVehicleName: document.getElementById('modal-vehicle-name'),
    modalVehiclePrice: document.getElementById('modal-vehicle-price'),
    modalSpecBrand: document.getElementById('modal-spec-brand'),
    modalSpecYear: document.getElementById('modal-spec-year'),
    modalSpecTransmission: document.getElementById('modal-spec-transmission'),
    modalSpecFuel: document.getElementById('modal-spec-fuel'),
    modalSpecStatus: document.getElementById('modal-spec-status'),
    modalSpecId: document.getElementById('modal-spec-id'),

    // Footer
    currentYear: document.getElementById('current-year')
  };

  // -------------------------------------------------------------------------
  // 3. API Communication Layer
  // -------------------------------------------------------------------------
  /**
   * Fetches official vehicle data from BTNG API endpoint
   */
  async function fetchVehicles() {
    setLoadingState(true);
    setErrorState(false);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP status ${response.status} (${response.statusText || 'Error'})`);
      }

      const payload = await response.json();

      if (!payload || payload.success !== true) {
        throw new Error(payload && payload.message ? payload.message : 'API reported unsuccessful transaction');
      }

      if (!Array.isArray(payload.data)) {
        throw new Error('Invalid data format received from API: expected an array of vehicles');
      }

      // Store validated raw data
      state.allVehicles = payload.data;
      state.isLoading = false;

      // Populate filter dropdowns from actual data
      populateFilterOptions(state.allVehicles);

      // Update hero & live counters
      updateLiveMetrics(state.allVehicles);

      // Apply initial filters and render
      applyFiltersAndSort();

      setLoadingState(false);
    } catch (err) {
      console.error('[VELOCITY] API Integration Error:', err);
      state.isLoading = false;
      state.errorMessage = err.message || 'Network error encountered while connecting to showroom catalog.';
      setLoadingState(false);
      setErrorState(true, state.errorMessage);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Live Statistics & Hero Dynamic Showcase
  // -------------------------------------------------------------------------
  /**
   * Derives live statistics from actual API response and populates Hero spotlight
   */
  function updateLiveMetrics(vehicles) {
    const totalCount = vehicles.length;
    const availableCount = vehicles.filter(v => String(v.status).toLowerCase() === 'tersedia').length;
    const soldCount = totalCount - availableCount;

    // Unique Brands set
    const uniqueBrands = new Set(vehicles.map(v => v.brand ? v.brand.trim() : '').filter(Boolean));

    // Update Hero stats
    if (DOM.heroStatTotal) DOM.heroStatTotal.textContent = totalCount;
    if (DOM.heroStatAvailable) DOM.heroStatAvailable.textContent = availableCount;
    if (DOM.heroStatBrands) DOM.heroStatBrands.textContent = uniqueBrands.size;

    // Update Collection Intro stats
    if (DOM.statTotalCount) DOM.statTotalCount.textContent = totalCount;
    if (DOM.statAvailableCount) DOM.statAvailableCount.textContent = availableCount;
    if (DOM.statSoldCount) DOM.statSoldCount.textContent = soldCount;

    // Populate Hero showcase using the first available or premier vehicle
    if (vehicles.length > 0) {
      const spotlightVehicle = vehicles.find(v => String(v.status).toLowerCase() === 'tersedia') || vehicles[0];
      
      if (DOM.heroCarImage) {
        DOM.heroCarImage.src = spotlightVehicle.foto || FALLBACK_IMAGE;
        DOM.heroCarImage.alt = `${spotlightVehicle.nama} featured in VELOCITY showroom`;
        DOM.heroCarImage.onerror = function () {
          this.onerror = null;
          this.src = FALLBACK_IMAGE;
        };
      }
      if (DOM.heroCarBrand) {
        DOM.heroCarBrand.textContent = spotlightVehicle.brand || 'PREMIER SHOWCASE';
      }
      if (DOM.heroCarName) {
        DOM.heroCarName.textContent = spotlightVehicle.nama || 'Curated Automobile';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Dynamic Filter Controls Population
  // -------------------------------------------------------------------------
  /**
   * Extracts unique brands and fuel types from actual API data to populate <select> options
   */
  function populateFilterOptions(vehicles) {
    // Collect unique brands
    const brands = [...new Set(vehicles.map(v => (v.brand || '').trim()).filter(Boolean))].sort();
    
    // Reset brand select
    DOM.filterBrand.innerHTML = '<option value="all">All Brands</option>';
    brands.forEach(brand => {
      const option = document.createElement('option');
      option.value = brand;
      option.textContent = brand;
      DOM.filterBrand.appendChild(option);
    });

    // Collect unique fuel types
    const fuels = [...new Set(vehicles.map(v => (v.bahan_bakar || '').trim()).filter(Boolean))].sort();
    
    // Reset fuel select
    DOM.filterFuel.innerHTML = '<option value="all">All Fuel Types</option>';
    fuels.forEach(fuel => {
      const option = document.createElement('option');
      option.value = fuel;
      option.textContent = fuel;
      DOM.filterFuel.appendChild(option);
    });
  }

  // -------------------------------------------------------------------------
  // 6. Filtering & Sorting Logic
  // -------------------------------------------------------------------------
  /**
   * Applies search text, brand filter, fuel filter, and sorting
   */
  function applyFiltersAndSort() {
    const { searchQuery, brand, fuel, sort } = state.filters;
    const cleanQuery = searchQuery.trim().toLowerCase();

    // Filter collection
    let results = state.allVehicles.filter(vehicle => {
      // 1. Search Query Match (by vehicle name or brand)
      if (cleanQuery) {
        const nameMatch = (vehicle.nama || '').toLowerCase().includes(cleanQuery);
        const brandMatch = (vehicle.brand || '').toLowerCase().includes(cleanQuery);
        if (!nameMatch && !brandMatch) return false;
      }

      // 2. Brand Match
      if (brand !== 'all') {
        if ((vehicle.brand || '').trim().toLowerCase() !== brand.toLowerCase()) return false;
      }

      // 3. Fuel Type Match
      if (fuel !== 'all') {
        if ((vehicle.bahan_bakar || '').trim().toLowerCase() !== fuel.toLowerCase()) return false;
      }

      return true;
    });

    // Sort results
    results = sortVehicles(results, sort);

    state.filteredVehicles = results;

    // Update status bar & active tags
    updateStatusBar();

    // Render cards into grid
    renderVehicleGrid(results);
  }

  /**
   * Sorts array of vehicles based on selected sort criteria
   */
  function sortVehicles(list, criteria) {
    const sorted = [...list];

    switch (criteria) {
      case 'price-asc':
        return sorted.sort((a, b) => (Number(a.harga) || 0) - (Number(b.harga) || 0));
      case 'price-desc':
        return sorted.sort((a, b) => (Number(b.harga) || 0) - (Number(a.harga) || 0));
      case 'year-desc':
        return sorted.sort((a, b) => (Number(b.tahun) || 0) - (Number(a.tahun) || 0));
      case 'name-asc':
        return sorted.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
      case 'default':
      default:
        // Preserves original order from API
        return sorted;
    }
  }

  // -------------------------------------------------------------------------
  // 7. DOM Rendering Layer (Safe createElement & appendChild)
  // -------------------------------------------------------------------------
  /**
   * Renders vehicle cards into DOM container using safe document.createElement
   */
  function renderVehicleGrid(vehicles) {
    // Clear existing grid contents
    DOM.vehiclesGrid.innerHTML = '';

    if (vehicles.length === 0) {
      setEmptyState(true);
      return;
    }

    setEmptyState(false);

    // Document fragment for optimal DOM performance
    const fragment = document.createDocumentFragment();

    vehicles.forEach(vehicle => {
      const card = createVehicleCardElement(vehicle);
      fragment.appendChild(card);
    });

    DOM.vehiclesGrid.appendChild(fragment);
  }

  /**
   * Constructs an individual vehicle card element with safe textContent
   */
  function createVehicleCardElement(vehicle) {
    const card = document.createElement('article');
    card.className = 'vehicle-card';
    card.setAttribute('data-id', vehicle.id);

    // 1. Media container
    const media = document.createElement('div');
    media.className = 'card-media';

    const img = document.createElement('img');
    img.className = 'card-image';
    img.src = vehicle.foto || FALLBACK_IMAGE;
    img.alt = `${vehicle.nama || 'Vehicle'} — ${vehicle.brand || 'VELOCITY'}`;
    img.loading = 'lazy';
    
    // Prevent infinite fallback loop
    img.onerror = function () {
      this.onerror = null;
      this.src = FALLBACK_IMAGE;
    };

    // Availability status badge
    const isAvailable = String(vehicle.status || '').toLowerCase() === 'tersedia';
    const statusBadge = document.createElement('span');
    statusBadge.className = `card-status-badge ${isAvailable ? 'status-tersedia' : 'status-sold'}`;
    statusBadge.textContent = isAvailable ? 'TERSEDIA' : 'TERJUAL';

    // Year badge
    const yearBadge = document.createElement('span');
    yearBadge.className = 'card-year-badge';
    yearBadge.textContent = vehicle.tahun || '—';

    media.appendChild(img);
    media.appendChild(statusBadge);
    media.appendChild(yearBadge);

    // 2. Card Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const brand = document.createElement('span');
    brand.className = 'card-brand';
    brand.textContent = vehicle.brand || 'Curated Model';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = vehicle.nama || 'Untitled Vehicle';

    // Specification tags (Transmission, Fuel)
    const specTags = document.createElement('div');
    specTags.className = 'card-spec-tags';

    if (vehicle.transmisi) {
      const pillTrans = document.createElement('span');
      pillTrans.className = 'spec-pill';
      pillTrans.textContent = vehicle.transmisi;
      specTags.appendChild(pillTrans);
    }

    if (vehicle.bahan_bakar) {
      const pillFuel = document.createElement('span');
      pillFuel.className = 'spec-pill';
      pillFuel.textContent = vehicle.bahan_bakar;
      specTags.appendChild(pillFuel);
    }

    const pillYear = document.createElement('span');
    pillYear.className = 'spec-pill';
    pillYear.textContent = `Tahun ${vehicle.tahun || '—'}`;
    specTags.appendChild(pillYear);

    const divider = document.createElement('div');
    divider.className = 'card-divider';

    // 3. Card Footer (Price & Action Button)
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const priceBlock = document.createElement('div');
    priceBlock.className = 'card-price-block';

    const priceLabel = document.createElement('span');
    priceLabel.className = 'card-price-label';
    priceLabel.textContent = 'VALUATION';

    const priceVal = document.createElement('span');
    priceVal.className = 'card-price-value';
    priceVal.textContent = vehicle.harga ? rupiahFormatter.format(vehicle.harga) : 'Hubungi Showroom';

    priceBlock.appendChild(priceLabel);
    priceBlock.appendChild(priceVal);

    const btnDetail = document.createElement('button');
    btnDetail.type = 'button';
    btnDetail.className = 'btn btn-outline btn-card-detail';
    btnDetail.textContent = 'View Details';
    btnDetail.setAttribute('aria-haspopup', 'dialog');
    btnDetail.setAttribute('aria-label', `View full specifications for ${vehicle.nama}`);

    // Click event to open detail modal
    btnDetail.addEventListener('click', () => {
      openVehicleDetailModal(vehicle);
    });

    footer.appendChild(priceBlock);
    footer.appendChild(btnDetail);

    // Assemble Card
    body.appendChild(brand);
    body.appendChild(title);
    body.appendChild(specTags);
    body.appendChild(divider);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);

    return card;
  }

  /**
   * Updates filter status counter and active tag chips
   */
  function updateStatusBar() {
    const visible = state.filteredVehicles.length;
    const total = state.allVehicles.length;

    if (DOM.visibleCount) DOM.visibleCount.textContent = visible;
    if (DOM.totalCount) DOM.totalCount.textContent = total;

    // Render active filter chips
    if (DOM.activeTagsList) {
      DOM.activeTagsList.innerHTML = '';

      const { searchQuery, brand, fuel } = state.filters;

      if (searchQuery.trim()) {
        const tag = createFilterTag('Search', `"${searchQuery.trim()}"`, () => {
          state.filters.searchQuery = '';
          DOM.searchInput.value = '';
          DOM.btnClearSearch.hidden = true;
          applyFiltersAndSort();
        });
        DOM.activeTagsList.appendChild(tag);
      }

      if (brand !== 'all') {
        const tag = createFilterTag('Brand', brand, () => {
          state.filters.brand = 'all';
          DOM.filterBrand.value = 'all';
          applyFiltersAndSort();
        });
        DOM.activeTagsList.appendChild(tag);
      }

      if (fuel !== 'all') {
        const tag = createFilterTag('Fuel', fuel, () => {
          state.filters.fuel = 'all';
          DOM.filterFuel.value = 'all';
          applyFiltersAndSort();
        });
        DOM.activeTagsList.appendChild(tag);
      }
    }
  }

  /**
   * Helper to construct removable filter tag pill
   */
  function createFilterTag(label, value, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'active-tag';

    const lbl = document.createElement('span');
    lbl.className = 'tag-label';
    lbl.textContent = `${label}: `;

    const val = document.createElement('strong');
    val.textContent = value;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-tag-remove';
    btn.setAttribute('aria-label', `Remove ${label} filter`);
    btn.innerHTML = '&times;';
    btn.addEventListener('click', onRemove);

    tag.appendChild(lbl);
    tag.appendChild(val);
    tag.appendChild(btn);

    return tag;
  }

  // -------------------------------------------------------------------------
  // 8. Vehicle Detail Modal Dialog (<dialog> & Modern Web Guidance)
  // -------------------------------------------------------------------------
  /**
   * Populates and displays the modal for a selected vehicle
   */
  function openVehicleDetailModal(vehicle) {
    if (!DOM.vehicleModal) return;

    // Populate media & status
    DOM.modalVehicleImage.src = vehicle.foto || FALLBACK_IMAGE;
    DOM.modalVehicleImage.alt = `${vehicle.nama || 'Vehicle'} specification preview`;
    DOM.modalVehicleImage.onerror = function () {
      this.onerror = null;
      this.src = FALLBACK_IMAGE;
    };

    const isAvailable = String(vehicle.status || '').toLowerCase() === 'tersedia';
    DOM.modalVehicleStatus.textContent = isAvailable ? 'AVAILABLE FOR SHOWCASE' : 'ARCHIVED / SOLD';
    DOM.modalVehicleStatus.style.color = isAvailable ? '#4ADE80' : '#F87171';

    // Populate header details
    DOM.modalVehicleId.textContent = vehicle.id || '--';
    DOM.modalVehicleRuang.textContent = vehicle.ruang ? `Collection: ${vehicle.ruang}` : 'Public Showroom';
    DOM.modalVehicleBrand.textContent = vehicle.brand || 'MANUFACTURER';
    DOM.modalVehicleName.textContent = vehicle.nama || 'Automotive Showcase';
    DOM.modalVehiclePrice.textContent = vehicle.harga ? rupiahFormatter.format(vehicle.harga) : 'Price on Request';

    // Populate specs definition list
    DOM.modalSpecBrand.textContent = vehicle.brand || '—';
    DOM.modalSpecYear.textContent = vehicle.tahun || '—';
    DOM.modalSpecTransmission.textContent = vehicle.transmisi || '—';
    DOM.modalSpecFuel.textContent = vehicle.bahan_bakar || '—';
    DOM.modalSpecStatus.textContent = isAvailable ? 'Tersedia di Showroom' : 'Terjual (Showroom Archive)';
    DOM.modalSpecId.textContent = `#${vehicle.id || '--'}`;

    // Hide any previous toast notification
    if (DOM.modalInquiryToast) {
      DOM.modalInquiryToast.hidden = true;
    }

    // Lock body scrolling
    document.body.style.overflow = 'hidden';

    // Open via native showModal()
    if (typeof DOM.vehicleModal.showModal === 'function') {
      DOM.vehicleModal.showModal();
    } else {
      // Fallback for browsers without native dialog
      DOM.vehicleModal.setAttribute('open', '');
    }
  }

  /**
   * Closes the vehicle detail modal
   */
  function closeVehicleDetailModal() {
    if (!DOM.vehicleModal) return;

    if (typeof DOM.vehicleModal.close === 'function') {
      DOM.vehicleModal.close();
    } else {
      DOM.vehicleModal.removeAttribute('open');
    }

    document.body.style.overflow = '';
  }

  /**
   * Sets up accessible dialog event listeners according to Modern Web Guidance:
   * - Fallback for light-dismiss (clicking the backdrop outside dialog bounding rect)
   * - Native escape handling
   * - Close buttons
   */
  function setupModalListeners() {
    if (!DOM.vehicleModal) return;

    // 1. Close button handlers
    if (DOM.btnCloseModal) {
      DOM.btnCloseModal.addEventListener('click', closeVehicleDetailModal);
    }
    if (DOM.btnModalDismiss) {
      DOM.btnModalDismiss.addEventListener('click', closeVehicleDetailModal);
    }

    // 2. Modern Web Guidance Fallback for light-dismiss:
    // If browser doesn't natively support closedby="any", check coordinate boundary on dialog click
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      DOM.vehicleModal.addEventListener('click', (event) => {
        // Only trigger when the click is on the dialog element itself (the backdrop)
        if (event.target !== DOM.vehicleModal) return;

        const rect = DOM.vehicleModal.getBoundingClientRect();
        const isClickInside = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (!isClickInside) {
          closeVehicleDetailModal();
        }
      });
    }

    // 3. Restore body scroll on native dialog close or escape
    DOM.vehicleModal.addEventListener('close', () => {
      document.body.style.overflow = '';
    });
    DOM.vehicleModal.addEventListener('cancel', () => {
      document.body.style.overflow = '';
    });

    // 4. Inquiry action simulation
    if (DOM.btnModalInquire && DOM.modalInquiryToast) {
      DOM.btnModalInquire.addEventListener('click', () => {
        DOM.modalInquiryToast.hidden = false;
      });
    }
  }

  // -------------------------------------------------------------------------
  // 9. State UI Toggles (Loading, Error, Empty)
  // -------------------------------------------------------------------------
  function setLoadingState(loading) {
    if (DOM.loadingState) DOM.loadingState.hidden = !loading;
    if (DOM.vehiclesGrid) DOM.vehiclesGrid.style.display = loading ? 'none' : 'grid';
  }

  function setErrorState(show, message) {
    if (DOM.errorState) {
      DOM.errorState.hidden = !show;
      if (DOM.errorMessage && message) {
        DOM.errorMessage.textContent = message;
      }
    }
  }

  function setEmptyState(show) {
    if (DOM.emptyState) DOM.emptyState.hidden = !show;
  }

  // -------------------------------------------------------------------------
  // 10. Controls & Filter Event Listeners
  // -------------------------------------------------------------------------
  function setupControlListeners() {
    // Search input (with debounce for smooth responsiveness)
    let searchDebounceTimeout;
    DOM.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      DOM.btnClearSearch.hidden = !val;

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        state.filters.searchQuery = val;
        applyFiltersAndSort();
      }, 200);
    });

    // Clear search button
    DOM.btnClearSearch.addEventListener('click', () => {
      DOM.searchInput.value = '';
      DOM.btnClearSearch.hidden = true;
      state.filters.searchQuery = '';
      DOM.searchInput.focus();
      applyFiltersAndSort();
    });

    // Brand filter select
    DOM.filterBrand.addEventListener('change', (e) => {
      state.filters.brand = e.target.value;
      applyFiltersAndSort();
    });

    // Fuel filter select
    DOM.filterFuel.addEventListener('change', (e) => {
      state.filters.fuel = e.target.value;
      applyFiltersAndSort();
    });

    // Sort order select
    DOM.sortBy.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      applyFiltersAndSort();
    });

    // Reset button
    DOM.btnResetFilters.addEventListener('click', resetAllFilters);

    // Empty state reset button
    DOM.btnEmptyReset.addEventListener('click', resetAllFilters);

    // Retry fetch button in error state
    DOM.btnRetryFetch.addEventListener('click', () => {
      fetchVehicles();
    });
  }

  function resetAllFilters() {
    state.filters.searchQuery = '';
    state.filters.brand = 'all';
    state.filters.fuel = 'all';
    state.filters.sort = 'default';

    DOM.searchInput.value = '';
    DOM.btnClearSearch.hidden = true;
    DOM.filterBrand.value = 'all';
    DOM.filterFuel.value = 'all';
    DOM.sortBy.value = 'default';

    applyFiltersAndSort();
  }

  // -------------------------------------------------------------------------
  // 11. Navigation, Mobile Menu & Active Link Spy
  // -------------------------------------------------------------------------
  function setupNavigation() {
    // Mobile Drawer Toggle
    if (DOM.mobileToggleBtn && DOM.mobileDrawer) {
      DOM.mobileToggleBtn.addEventListener('click', () => {
        const isOpen = DOM.mobileDrawer.classList.contains('is-open');
        if (isOpen) {
          closeMobileDrawer();
        } else {
          openMobileDrawer();
        }
      });
    }

    if (DOM.btnCloseDrawer) {
      DOM.btnCloseDrawer.addEventListener('click', closeMobileDrawer);
    }

    // Close drawer when clicking backdrop outside content
    if (DOM.mobileDrawer) {
      DOM.mobileDrawer.addEventListener('click', (e) => {
        if (e.target === DOM.mobileDrawer) {
          closeMobileDrawer();
        }
      });
    }

    // Close drawer when a navigation link is clicked
    DOM.mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeMobileDrawer();
      });
    });

    // Close mobile drawer on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.mobileDrawer && DOM.mobileDrawer.classList.contains('is-open')) {
        closeMobileDrawer();
      }
    });

    // Active link highlighting via IntersectionObserver
    const sections = document.querySelectorAll('section[id]');
    if ('IntersectionObserver' in window && sections.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const currentId = entry.target.getAttribute('id');
            updateActiveNavLink(currentId);
          }
        });
      }, {
        rootMargin: '-30% 0px -60% 0px'
      });

      sections.forEach(section => observer.observe(section));
    }
  }

  function openMobileDrawer() {
    DOM.mobileDrawer.classList.add('is-open');
    DOM.mobileDrawer.setAttribute('aria-hidden', 'false');
    DOM.mobileToggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileDrawer() {
    DOM.mobileDrawer.classList.remove('is-open');
    DOM.mobileDrawer.setAttribute('aria-hidden', 'true');
    DOM.mobileToggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function updateActiveNavLink(sectionId) {
    DOM.desktopNavLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${sectionId}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 12. Dynamic Copyright Year
  // -------------------------------------------------------------------------
  function setupCopyrightYear() {
    if (DOM.currentYear) {
      DOM.currentYear.textContent = new Date().getFullYear();
    }
  }

  // -------------------------------------------------------------------------
  // 13. Application Initialization
  // -------------------------------------------------------------------------
  function init() {
    setupCopyrightYear();
    setupNavigation();
    setupModalListeners();
    setupControlListeners();

    // Fetch initial dataset from BTNG API
    fetchVehicles();
  }

  // Start application on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
