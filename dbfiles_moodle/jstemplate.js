(function() {
  // =========================================
  // CONFIGURATION & CONSTANTS
  // =========================================
  const CONFIG = {
    baseSlotMinutes: 5,
    day: { start: { h: 8, m: 0 }, end: { h: 22, m: 0 } },
    days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
    get storageKey() { return buildStorageKey(); },
    get metaKey() { return buildStorageKey() + '_meta'; },
    get zoomKey() { return buildStorageKey() + '_zoom'; },
    get gridConfigKey() { return buildStorageKey() + '_gridConfig'; }
  };

  // Grid Configuration Presets
  const GRID_PRESETS = {
    'standard-week': {
      name: 'Standard-Woche',
      days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: [
        { days: ['all'], start: '12:00', duration: 60 }
      ]
    },
    'weekend-seminar': {
      name: 'Wochenendseminar',
      days: ['Freitag', 'Samstag', 'Sonntag'],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: [
        { days: ['all'], start: '12:00', duration: 60 }
      ]
    },
    'half-week-mo-mi': {
      name: 'Halbe Woche (Mo-Mi)',
      days: ['Montag', 'Dienstag', 'Mittwoch'],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: [
        { days: ['all'], start: '12:00', duration: 60 }
      ]
    },
    'half-week-mi-fr': {
      name: 'Halbe Woche (Mi-Fr)',
      days: ['Mittwoch', 'Donnerstag', 'Freitag'],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: [
        { days: ['all'], start: '12:00', duration: 60 }
      ]
    },
    'compact-day': {
      name: 'Kompakttag',
      days: ['Montag'],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: [
        { days: ['all'], start: '12:00', duration: 60 }
      ]
    },
    'custom': {
      name: 'Individuelle Konfiguration',
      days: [],
      timeRange: { start: '08:30', end: '17:30' },
      granularity: 15,
      breaks: []
    }
  };

  const ZOOM_LEVELS = [
    { id: 'fine', label: '5 Min', slotMinutes: 5, slotPx: 18, labelEverySlots: 3, showMinor: true },
    { id: 'medium', label: '15 Min', slotMinutes: 15, slotPx: 26, labelEverySlots: 1, showMinor: true },
    { id: 'coarse', label: '30 Min', slotMinutes: 30, slotPx: 30, labelEverySlots: 2, showMinor: false }
  ];

  // =========================================
  // UTILITY FUNCTIONS
  // =========================================
  function buildStorageKey() {
    const path = location.pathname.replace(/\/+$/, '');
    return 'seminarplan_' + path;
  }

  function toMin(h, m) {
    return h * 60 + m;
  }

  function label(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function formatTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function parseTimeToMinutes(value) {
    if (!value) return null;
    const [hh, mm] = value.split(':').map(part => Number.parseInt(part, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return toMin(hh, mm);
  }

  function snapDuration(raw) {
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return CONFIG.baseSlotMinutes;
    }
    const snapped = Math.ceil(Math.max(CONFIG.baseSlotMinutes, numeric) / CONFIG.baseSlotMinutes) * CONFIG.baseSlotMinutes;
    return Math.max(CONFIG.baseSlotMinutes, snapped);
  }

  function snapToGridStart(min) {
    if (!Number.isFinite(min)) return CONFIG.day.start.h * 60 + CONFIG.day.start.m;
    const DAY_START = toMin(CONFIG.day.start.h, CONFIG.day.start.m);
    const DAY_END = toMin(CONFIG.day.end.h, CONFIG.day.end.m);
    const clamped = Math.min(Math.max(min, DAY_START), DAY_END);
    const offset = clamped - DAY_START;
    const snapped = Math.floor(offset / CONFIG.baseSlotMinutes) * CONFIG.baseSlotMinutes;
    return DAY_START + snapped;
  }

  function randomId() {
    return 'id-' + Math.random().toString(36).slice(2);
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, s => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[s];
    });
  }

  // =========================================
  // SEMINARPLANNER CLASS
  // =========================================
  class Seminarplaner {
    constructor() {
      this.wrapper = document.querySelector('.sp-wrapper');
      this.zoomIndex = 2;
      this.plan = this.loadPlan();
      this.cardLookup = Object.create(null);
      this.modalKeydownHandler = null;
      this.configModalKeydownHandler = null;
      this.gridConfig = this.loadGridConfig();
      
      if (!this.wrapper || this.wrapper.dataset.spInitialized === '1') {
        return;
      }
      
      this.wrapper.dataset.spInitialized = '1';
      this.init();
    }

    init() {
      this.createModal();
      this.createConfigModal();
      this.bindEvents();
      this.loadZoomPreference();
      this.applyGridConfig();
      this.setupConstants();
      this.refreshLayout();
      this.bindMetaInputs();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.plan));
    }

    setupConstants() {
      const DAY_START = toMin(CONFIG.day.start.h, CONFIG.day.start.m);
      const DAY_END = toMin(CONFIG.day.end.h, CONFIG.day.end.m);
      
      console.log('Setting up constants:');
      console.log('- CONFIG.day:', CONFIG.day);
      console.log('- DAY_START:', DAY_START, '(', label(DAY_START), ')');
      console.log('- DAY_END:', DAY_END, '(', label(DAY_END), ')');
      console.log('- CONFIG.days:', CONFIG.days);
      
      this.DAY_START = DAY_START;
      this.DAY_END = DAY_END;
      this.slotMinutes = ZOOM_LEVELS[this.zoomIndex].slotMinutes;
      this.slotPx = ZOOM_LEVELS[this.zoomIndex].slotPx;
      this.slotsPerDay = (DAY_END - DAY_START) / this.slotMinutes;
      
      console.log('- slotMinutes:', this.slotMinutes);
      console.log('- slotsPerDay:', this.slotsPerDay);
      
      this.timesContainer = document.getElementById('sp-times');
      this.msg = document.getElementById('sp-msg');
      this.printTable = document.getElementById('sp-print-table');
      
      this.wrapper.style.setProperty('--slot-height', this.slotPx + 'px');
    }

    createModal() {
      this.modal = document.createElement('div');
      this.modal.className = 'sp-modal';
      this.modal.innerHTML = `
        <div class="sp-modal__backdrop" data-modal-close="1"></div>
        <div class="sp-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="sp-break-modal-title">
          <header class="sp-modal__header">
            <h2 id="sp-break-modal-title">Pause hinzufügen</h2>
            <button type="button" class="sp-modal__close" data-modal-close="1" aria-label="Modal schließen">✕</button>
          </header>
          <form class="sp-modal__body" id="sp-break-form">
            <label class="sp-modal__field">
              <span class="sp-modal__label">Tag</span>
              <select name="day" id="sp-break-day" required>
                ${CONFIG.days.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </label>
            <label class="sp-modal__field">
              <span class="sp-modal__label">Startzeit</span>
              <input type="time" name="start" id="sp-break-start" min="08:00" max="21:55" required>
            </label>
            <label class="sp-modal__field">
              <span class="sp-modal__label">Dauer (Minuten)</span>
              <input type="number" name="duration" id="sp-break-duration" min="5" step="5" value="15" required>
            </label>
            <div class="sp-modal__actions">
              <button type="button" class="sp-btn sp-btn--ghost" data-modal-close="1">Abbrechen</button>
              <button type="submit" class="sp-btn sp-btn--primary">Übernehmen</button>
            </div>
          </form>
        </div>`;
      
      this.breakForm = this.modal.querySelector('#sp-break-form');
      this.breakDayField = this.modal.querySelector('#sp-break-day');
      this.breakStartField = this.modal.querySelector('#sp-break-start');
      this.breakDurationField = this.modal.querySelector('#sp-break-duration');
      
      this.breakStartField.setAttribute('min', formatTime(this.DAY_START));
      this.breakStartField.setAttribute('max', formatTime(this.DAY_END - CONFIG.baseSlotMinutes));
      
      this.wrapper.appendChild(this.modal);
      this.modal.setAttribute('aria-hidden', 'true');
      this.resetBreakForm();
    }

    createConfigModal() {
      console.log('Creating config modal...');
      this.configModal = document.getElementById('sp-config-modal');
      console.log('Config modal found:', !!this.configModal);
      
      if (!this.configModal) {
        console.error('Config modal not found!');
        return;
      }
      
      // Try direct DOM queries as fallback
      this.configForm = this.configModal.querySelector('#sp-config-form') || document.querySelector('#sp-config-form');
      this.presetSelect = this.configModal.querySelector('#sp-config-preset') || document.querySelector('#sp-config-preset');
      this.daysCheckboxes = this.configModal.querySelectorAll('input[name="days"]').length > 0 ? 
        this.configModal.querySelectorAll('input[name="days"]') : 
        document.querySelectorAll('input[name="days"]');
      this.timeStartInput = this.configModal.querySelector('#sp-config-time-start') || document.querySelector('#sp-config-time-start');
      this.timeEndInput = this.configModal.querySelector('#sp-config-time-end') || document.querySelector('#sp-config-time-end');
      this.granularityRadios = this.configModal.querySelectorAll('input[name="granularity"]').length > 0 ? 
        this.configModal.querySelectorAll('input[name="granularity"]') : 
        document.querySelectorAll('input[name="granularity"]');
      this.breaksList = this.configModal.querySelector('#sp-breaks-list') || document.querySelector('#sp-breaks-list');
      this.previewGrid = this.configModal.querySelector('#sp-preview-grid') || document.querySelector('#sp-preview-grid');
      this.addBreakBtn = this.configModal.querySelector('#sp-add-break') || document.querySelector('#sp-add-break');
      // Individual days functionality removed - grid uses longest day automatically
      
      console.log('Modal elements found:');
      console.log('- configForm:', !!this.configForm);
      console.log('- presetSelect:', !!this.presetSelect);
      console.log('- daysCheckboxes:', this.daysCheckboxes.length);
      console.log('- timeStartInput:', !!this.timeStartInput);
      console.log('- timeEndInput:', !!this.timeEndInput);
      console.log('- granularityRadios:', this.granularityRadios.length);
      console.log('- breaksList:', !!this.breaksList);
      console.log('- previewGrid:', !!this.previewGrid);
      console.log('- addBreakBtn:', !!this.addBreakBtn);
      // Individual days functionality removed
      
      this.configModal.setAttribute('aria-hidden', 'true');
      this.initializeConfigModal();
    }

    bindEvents() {
      // Zoom controls
      const zoomOutBtn = document.getElementById('sp-zoom-out');
      const zoomInBtn = document.getElementById('sp-zoom-in');
      
      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => this.changeZoom(-1));
      }
      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => this.changeZoom(1));
      }

      // Export/Import
      const exportBtn = document.getElementById('sp-export');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportPlan());
      }

      const importInput = document.getElementById('sp-import');
      if (importInput) {
        importInput.addEventListener('change', e => this.importPlan(e));
      }

      // Clear and Print
      const clearBtn = document.getElementById('sp-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearPlan());
      }

      const printBtn = document.getElementById('sp-print');
      if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
      }

      // Break modal
      const addBreakBtn = document.getElementById('sp-addbreak');
      if (addBreakBtn) {
        addBreakBtn.addEventListener('click', () => this.openBreakModal());
      }

      if (this.breakForm) {
        this.breakForm.addEventListener('submit', e => this.handleBreakFormSubmit(e));
      }

      // Config modal
      const configBtn = document.getElementById('sp-config');
      if (configBtn) {
        configBtn.addEventListener('click', () => this.openConfigModal());
      }

      if (this.configForm) {
        this.configForm.addEventListener('submit', e => this.handleConfigFormSubmit(e));
      }

      if (this.presetSelect) {
        this.presetSelect.addEventListener('change', () => this.handlePresetChange());
      }

      if (this.addBreakBtn) {
        this.addBreakBtn.addEventListener('click', () => this.addBreakItem());
      }

      // Add fallback submit button handler
      const submitBtn = document.querySelector('#sp-config-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('Submit button clicked (fallback)');
          this.handleConfigFormSubmit(e);
        });
        console.log('Fallback submit button handler attached');
      } else {
        console.warn('Submit button not found');
      }

      // Also try to find the form directly
      const form = document.querySelector('#sp-config-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          console.log('Form submit event (direct)');
          this.handleConfigFormSubmit(e);
        });
        console.log('Direct form submit handler attached');
      } else {
        console.warn('Form not found in DOM');
      }

      // Modal events
      this.modal.addEventListener('click', event => {
        if (event.target && event.target.getAttribute('data-modal-close') === '1') {
          event.preventDefault();
          this.closeBreakModal();
        }
      });

      this.modal.addEventListener('submit', event => {
        if (event.target && event.target.id === 'sp-break-form') {
          this.handleBreakFormSubmit(event);
        }
      });

      // Config modal events
      if (this.configModal) {
        this.configModal.addEventListener('click', event => {
          if (event.target && event.target.getAttribute('data-modal-close') === 'config') {
            event.preventDefault();
            this.closeConfigModal();
          }
          
          // Handle submit button click via event delegation
          const submitBtn = event.target.closest('button[type="submit"]');
          if (submitBtn && this.configModal.contains(submitBtn)) {
            const form = submitBtn.closest('form');
            if (form && form.id === 'sp-config-form') {
              event.preventDefault();
              console.log('Submit button clicked via event delegation');
              this.handleConfigFormSubmit(event);
            }
          }
        });

        this.configModal.addEventListener('submit', event => {
          console.log('Form submit event caught in configModal listener');
          if (event.target && event.target.id === 'sp-config-form') {
            event.preventDefault();
            console.log('Calling handleConfigFormSubmit from modal submit listener');
            this.handleConfigFormSubmit(event);
          }
        });
      }

      // Document click handler for item actions
      document.addEventListener('click', e => this.handleDocumentClick(e));
      
      // Global event delegation for config modal submit button
      // This works regardless of when the modal is opened
      document.addEventListener('click', (e) => {
        // Check if clicked element is the submit button in config modal
        const submitBtn = e.target.closest('#sp-config-modal button[type="submit"]');
        if (submitBtn && this.configModal && this.configModal.contains(submitBtn)) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Global event delegation: Submit button clicked!');
          this.handleConfigFormSubmit(e);
        }
      });
    }

    // =========================================
    // GRID CONFIGURATION MANAGEMENT
    // =========================================
    loadGridConfig() {
      try {
        const raw = localStorage.getItem(CONFIG.gridConfigKey);
        console.log('Loading grid config from localStorage:', raw);
        if (!raw) {
          console.log('No grid config found in localStorage');
          return null;
        }
        const config = JSON.parse(raw);
        console.log('Parsed grid config:', config);
        
        // Ensure tableColumns exists with defaults if not present
        if (!config.tableColumns) {
          config.tableColumns = {
            uhrzeit: true,
            title: true,
            description: false,
            flow: true,
            objectives: true,
            risks: false,
            materials: true,
            sonstiges: false
          };
        } else {
          // Ensure uhrzeit is always true
          config.tableColumns.uhrzeit = true;
          // Convert all values to booleans in case they were stored as strings
          Object.keys(config.tableColumns).forEach(key => {
            if (typeof config.tableColumns[key] !== 'boolean') {
              config.tableColumns[key] = config.tableColumns[key] === true || config.tableColumns[key] === 'true';
            }
          });
        }
        
        return config;
      } catch (e) {
        console.error('Error loading grid config:', e);
        return null;
      }
    }

    saveGridConfig(config) {
      try {
        console.log('Saving grid config to localStorage:', config);
        localStorage.setItem(CONFIG.gridConfigKey, JSON.stringify(config));
        console.log('Grid config saved successfully');
      } catch (e) {
        console.warn('Failed to save grid config:', e);
      }
    }

    applyGridConfig() {
      console.log('Applying grid config:', this.gridConfig);
      console.log('Table columns in gridConfig:', this.gridConfig?.tableColumns);
      
      if (!this.gridConfig) {
        // Load default preset if no config exists
        console.log('No grid config found, loading default preset');
        this.gridConfig = GRID_PRESETS['standard-week'];
        // Add default tableColumns
        this.gridConfig.tableColumns = {
          uhrzeit: true,
          title: true,
          description: false,
          flow: true,
          objectives: true,
          risks: false,
          materials: true,
          sonstiges: false
        };
        this.saveGridConfig(this.gridConfig);
      } else if (!this.gridConfig.tableColumns) {
        // Ensure tableColumns exists even if config was loaded from preset
        console.log('Adding default tableColumns to existing config');
        this.gridConfig.tableColumns = {
          uhrzeit: true,
          title: true,
          description: false,
          flow: true,
          objectives: true,
          risks: false,
          materials: true,
          sonstiges: false
        };
        this.saveGridConfig(this.gridConfig);
      } else {
        // Ensure uhrzeit is always true, but preserve other settings
        this.gridConfig.tableColumns.uhrzeit = true;
        console.log('Preserved tableColumns:', this.gridConfig.tableColumns);
      }

      // Apply configuration to CONFIG object
      CONFIG.days = this.gridConfig.days || CONFIG.days;
      CONFIG.baseSlotMinutes = this.gridConfig.granularity || CONFIG.baseSlotMinutes;
      
      console.log('Updated CONFIG.days:', CONFIG.days);
      console.log('Updated CONFIG.baseSlotMinutes:', CONFIG.baseSlotMinutes);
      
      if (this.gridConfig.timeRange) {
        const [startH, startM] = this.gridConfig.timeRange.start.split(':').map(Number);
        const [endH, endM] = this.gridConfig.timeRange.end.split(':').map(Number);
        
        // Force update CONFIG.day object
        CONFIG.day.start.h = startH;
        CONFIG.day.start.m = startM;
        CONFIG.day.end.h = endH;
        CONFIG.day.end.m = endM;
        
        console.log('Updated CONFIG.day:', CONFIG.day);
        console.log('Time range:', this.gridConfig.timeRange.start, 'to', this.gridConfig.timeRange.end);
      }

      // Update constants FIRST
      this.setupConstants();
      
      // Add breaks to plan
      if (this.gridConfig.breaks) {
        this.addBreaksToPlan(this.gridConfig.breaks);
      }

      console.log('Grid config applied successfully');
    }

    addBreaksToPlan(breaks) {
      breaks.forEach(breakConfig => {
        const days = breakConfig.days.includes('all') ? CONFIG.days : breakConfig.days;
        
        days.forEach(day => {
          if (!this.plan.days[day]) {
            this.plan.days[day] = [];
          }
          
          // Use standard time range for all days - grid will adapt to longest day
          const startMin = parseTimeToMinutes(breakConfig.start);
          const duration = breakConfig.duration;
          const endMin = startMin + duration;
          
          const breakItem = {
            uid: randomId(),
            title: 'Pause',
            startMin,
            endMin,
            kind: 'break',
            cardHtml: `<p class="sp-print-card__text"><strong>Pause</strong> – ${duration} Min</p>`,
            entryId: null
          };
          
          // Only add if no collision
          if (!this.hasCollision(this.plan.days[day], breakItem)) {
            this.plan.days[day].push(breakItem);
          }
        });
      });
    }

    initializeConfigModal() {
      if (!this.configModal) return;
      
      // Add event listeners for live updates
      this.daysCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          this.updatePreview();
          this.applyCurrentConfig();
          // Days changed - no individual day handling needed
        });
      });
      
      if (this.timeStartInput) {
        this.timeStartInput.addEventListener('change', () => {
          this.updatePreview();
          this.applyCurrentConfig();
          // Time range changed - no individual day handling needed
        });
      }
      
      if (this.timeEndInput) {
        this.timeEndInput.addEventListener('change', () => {
          this.updatePreview();
          this.applyCurrentConfig();
          // Time range changed - no individual day handling needed
        });
      }
      
      this.granularityRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          this.updatePreview();
          this.applyCurrentConfig();
        });
      });
      
      // Ensure form submission is properly handled
      if (this.configForm) {
        this.configForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleConfigFormSubmit(e);
        });
        console.log('Form submit handler attached');
      } else {
        console.warn('Config form not found, cannot attach submit handler');
      }
    }

    applyCurrentConfig() {
      // Get current configuration from modal
      const config = this.getConfigFromModalDirect();
      if (!config.days.length) {
        console.log('No days selected, skipping config application');
        return;
      }
      
      console.log('Applying current config from modal:', config);
      
      // Update grid config and apply
      this.gridConfig = config;
      this.saveGridConfig(config);
      this.applyGridConfig();
      this.rebuildGrid();
      console.log('Current config applied successfully');
    }

    openConfigModal() {
      if (!this.configModal) return;
      
      console.log('openConfigModal called');
      
      // Ensure form reference is up-to-date when modal opens
      this.configForm = this.configModal.querySelector('#sp-config-form') || document.querySelector('#sp-config-form');
      console.log('openConfigModal - configForm found:', !!this.configForm);
      
      this.loadConfigIntoModal();
      
      // Find and attach handler to submit button AFTER loading config (so button exists)
      const submitBtn = this.configModal.querySelector('button[type="submit"]');
      console.log('Submit button found in openConfigModal:', !!submitBtn);
      
      if (submitBtn) {
        // Remove any existing click handlers by cloning the button
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Attach fresh handler
        newSubmitBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Submit button clicked - HANDLER FIRED!');
          this.handleConfigFormSubmit(e);
        });
        console.log('Submit button click handler attached');
      }
      
      this.configModal.classList.add('sp-modal--visible');
      this.configModal.removeAttribute('aria-hidden');
      this.updatePreview();
      
      if (this.configModalKeydownHandler) {
        document.removeEventListener('keydown', this.configModalKeydownHandler);
      }
      
      this.configModalKeydownHandler = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeConfigModal();
        }
      };
      
      document.addEventListener('keydown', this.configModalKeydownHandler);
    }

    closeConfigModal() {
      if (!this.configModal) return;
      
      this.configModal.classList.remove('sp-modal--visible');
      this.configModal.setAttribute('aria-hidden', 'true');
      
      if (this.configModalKeydownHandler) {
        document.removeEventListener('keydown', this.configModalKeydownHandler);
        this.configModalKeydownHandler = null;
      }
    }

    loadConfigIntoModal() {
      const config = this.gridConfig || GRID_PRESETS['standard-week'];
      
      // Load preset
      if (this.presetSelect) {
        this.presetSelect.value = config.preset || 'standard-week';
      }
      
      // Load days
      this.daysCheckboxes.forEach(checkbox => {
        checkbox.checked = config.days.includes(checkbox.value);
      });
      
      // Load time range
      if (this.timeStartInput) {
        this.timeStartInput.value = config.timeRange.start;
      }
      if (this.timeEndInput) {
        this.timeEndInput.value = config.timeRange.end;
      }
      
      // Load granularity
      this.granularityRadios.forEach(radio => {
        radio.checked = radio.value === String(config.granularity);
      });
      
      // Load breaks
      this.loadBreaksIntoModal(config.breaks || []);
      
      // Load table columns
      const tableColumns = config.tableColumns || {
        uhrzeit: true,
        title: true,
        description: false,
        flow: true,
        objectives: true,
        risks: false,
        materials: true,
        sonstiges: false
      };
      
      console.log('Loading table columns into modal:', tableColumns);
      
      // Ensure all values are booleans (in case they were stored as strings)
      Object.keys(tableColumns).forEach(key => {
        if (typeof tableColumns[key] !== 'boolean') {
          tableColumns[key] = tableColumns[key] === true || tableColumns[key] === 'true';
        }
      });
      
      // Try to find checkboxes - first in modal, then globally
      let columnCheckboxes = this.configModal?.querySelectorAll('input[name="tableColumns"]') || [];
      if (columnCheckboxes.length === 0) {
        columnCheckboxes = document.querySelectorAll('input[name="tableColumns"]');
      }
      
      console.log('Found column checkboxes for loading:', columnCheckboxes.length);
      
      columnCheckboxes.forEach(checkbox => {
        const columnName = checkbox.value;
        if (columnName === 'uhrzeit') {
          checkbox.checked = true;
          checkbox.disabled = true;
          console.log(`Set ${columnName}: checked=true, disabled=true`);
        } else {
          // Convert to boolean if needed
          const isChecked = typeof tableColumns[columnName] === 'boolean' 
            ? tableColumns[columnName] 
            : (tableColumns[columnName] === true || tableColumns[columnName] === 'true');
          checkbox.checked = isChecked;
          checkbox.disabled = false;
          console.log(`Set ${columnName}: checked=${isChecked}`);
        }
      });
      
      console.log('Finished loading table columns into modal');
      
      // Individual days functionality removed
    }

    loadBreaksIntoModal(breaks) {
      if (!this.breaksList) return;
      
      this.breaksList.innerHTML = '';
      breaks.forEach((breakConfig, index) => {
        this.addBreakItem(breakConfig, index);
      });
    }

    addBreakItem(breakConfig = null, index = null) {
      if (!this.breaksList) return;
      
      const breakIndex = index !== null ? index : this.breaksList.children.length;
      const config = breakConfig || { days: ['all'], start: '12:00', duration: 60 };
      
      const breakItem = document.createElement('div');
      breakItem.className = 'sp-break-item';
      breakItem.innerHTML = `
        <div class="sp-break-days">
          <select name="breakDays" class="sp-break-days-select">
            <option value="all" ${config.days.includes('all') ? 'selected' : ''}>Alle Tage</option>
            ${CONFIG.days.map(day => 
              `<option value="${day}" ${config.days.includes(day) ? 'selected' : ''}>${day}</option>`
            ).join('')}
          </select>
        </div>
        <input type="time" name="breakStart" value="${config.start}" class="sp-break-start">
        <input type="number" name="breakDuration" value="${config.duration}" min="5" step="5" class="sp-break-duration">
        <button type="button" class="sp-btn sp-btn--small sp-btn--danger" data-remove-break="${breakIndex}">✕</button>
      `;
      
      this.breaksList.appendChild(breakItem);
      
      // Add remove event listener
      const removeBtn = breakItem.querySelector(`[data-remove-break="${breakIndex}"]`);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          breakItem.remove();
          this.updatePreview();
          this.applyCurrentConfig();
        });
      }
      
      // Add change listeners for live updates
      breakItem.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => {
          this.updatePreview();
          this.applyCurrentConfig();
        });
      });
      
      this.updatePreview();
      this.applyCurrentConfig();
    }

    // Individual days functionality removed - grid uses longest day automatically

    handlePresetChange() {
      if (!this.presetSelect) return;
      
      const presetKey = this.presetSelect.value;
      const preset = GRID_PRESETS[presetKey];
      
      if (preset) {
        console.log('Preset selected:', presetKey, preset);
        
        // Update form with preset values
        this.daysCheckboxes.forEach(checkbox => {
          checkbox.checked = preset.days.includes(checkbox.value);
        });
        
        if (this.timeStartInput) {
          this.timeStartInput.value = preset.timeRange.start;
        }
        if (this.timeEndInput) {
          this.timeEndInput.value = preset.timeRange.end;
        }
        
        this.granularityRadios.forEach(radio => {
          radio.checked = radio.value === String(preset.granularity);
        });
        
        this.loadBreaksIntoModal(preset.breaks);
        // Individual days functionality removed
        
        this.updatePreview();
        
        // Apply configuration to grid (both presets and custom)
        // Check if there's existing content that would be overwritten
        const hasExistingContent = this.hasExistingPlanContent();
        
        if (hasExistingContent) {
          const confirmed = confirm(
            `Das aktuelle Grid wird überschrieben!\n\n` +
            `Alle vorherigen Einstellungen und Inhalte werden gelöscht.\n` +
            `Möchten Sie fortfahren?`
          );
          if (!confirmed) {
            // Reset the select to previous value
            this.presetSelect.value = this.gridConfig?.preset || 'custom';
            return;
          }
        }
        
        console.log('Applying configuration immediately to grid...');
        this.gridConfig = preset;
        this.saveGridConfig(preset);
        this.applyGridConfig();
        this.rebuildGrid();
        console.log('Configuration applied to grid successfully');
      }
    }

    hasExistingPlanContent() {
      // Check if there are any items in the plan
      for (const day of CONFIG.days) {
        const dayItems = this.plan.days[day] || [];
        if (dayItems.length > 0) {
          return true;
        }
      }
      return false;
    }

    handleConfigFormSubmit(event) {
      console.log('Config form submitted');
      event.preventDefault();
      
      console.log('Modal elements before getting config:');
      console.log('- daysCheckboxes:', this.daysCheckboxes?.length || 'undefined');
      console.log('- timeStartInput:', !!this.timeStartInput);
      console.log('- timeEndInput:', !!this.timeEndInput);
      console.log('- configModal:', !!this.configModal);
      
      // Ensure we have access to the modal when reading values
      const config = this.getConfigFromModalDirect();
      console.log('Config from modal:', config);
      
      if (!config || !config.days || !config.days.length) {
        this.warn('Bitte mindestens einen Wochentag auswählen.');
        return;
      }
      
      // Check if there's existing content that would be overwritten
      const hasExistingContent = this.hasExistingPlanContent();
      
      if (hasExistingContent) {
        const confirmed = confirm(
          `Das aktuelle Grid wird überschrieben!\n\n` +
          `Alle vorherigen Einstellungen und Inhalte werden gelöscht.\n` +
          `Möchten Sie fortfahren?`
        );
        if (!confirmed) {
          return;
        }
      }
      
      console.log('Applying config...');
      console.log('Config before setting:', config);
      console.log('Table columns in config:', config.tableColumns);
      this.gridConfig = config;
      console.log('gridConfig after setting:', this.gridConfig);
      console.log('tableColumns in gridConfig:', this.gridConfig.tableColumns);
      this.saveGridConfig(config);
      
      // Ensure tableColumns are preserved during applyGridConfig
      const savedTableColumns = JSON.parse(JSON.stringify(this.gridConfig.tableColumns));
      
      this.applyGridConfig();
      
      // Restore tableColumns in case they were overwritten
      if (!this.gridConfig.tableColumns || JSON.stringify(this.gridConfig.tableColumns) !== JSON.stringify(savedTableColumns)) {
        console.log('Restoring tableColumns after applyGridConfig');
        this.gridConfig.tableColumns = savedTableColumns;
        this.saveGridConfig(this.gridConfig);
      }
      
      console.log('gridConfig before rebuildGrid:', this.gridConfig);
      console.log('tableColumns before rebuildGrid:', this.gridConfig.tableColumns);
      
      this.rebuildGrid();
      
      // Update print table with new column configuration
      console.log('Calling renderPrintTable...');
      console.log('gridConfig in renderPrintTable context:', this.gridConfig);
      this.renderPrintTable();
      
      this.closeConfigModal();
      this.clearWarn();
      console.log('Config applied successfully');
    }

    getConfigFromModal() {
      console.log('Getting config from modal...');
      console.log('Days checkboxes found:', this.daysCheckboxes.length);
      console.log('Time start input:', this.timeStartInput);
      console.log('Time end input:', this.timeEndInput);
      console.log('Preset select:', this.presetSelect);
      
      const selectedDays = Array.from(this.daysCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);
      
      console.log('Selected days:', selectedDays);
      
      const breaks = Array.from(this.breaksList.children).map(breakItem => {
        const daysSelect = breakItem.querySelector('.sp-break-days-select');
        const startInput = breakItem.querySelector('.sp-break-start');
        const durationInput = breakItem.querySelector('.sp-break-duration');
        
        const days = daysSelect.value === 'all' ? ['all'] : [daysSelect.value];
        
        return {
          days,
          start: startInput.value,
          duration: parseInt(durationInput.value, 10)
        };
      });
      
      console.log('Breaks:', breaks);
      
      // Individual days functionality removed
      
      const config = {
        preset: this.presetSelect.value,
        days: selectedDays,
        timeRange: {
          start: this.timeStartInput.value,
          end: this.timeEndInput.value
        },
        granularity: parseInt(
          Array.from(this.granularityRadios).find(radio => radio.checked)?.value || '15',
          10
        ),
        breaks
      };
      
      console.log('Final config:', config);
      return config;
    }

    getConfigFromModalDirect() {
      console.log('Getting config from modal directly from DOM...');
      
      // Try to use the stored modal reference, or find it
      const modal = this.configModal || document.querySelector('#sp-config-modal');
      console.log('Modal reference:', !!modal);
      
      // Use modal if available, otherwise fall back to document
      const querySelector = modal ? (sel) => modal.querySelector(sel) : (sel) => document.querySelector(sel);
      const querySelectorAll = modal ? (sel) => modal.querySelectorAll(sel) : (sel) => document.querySelectorAll(sel);
      
      const daysCheckboxes = querySelectorAll('input[name="days"]');
      const timeStartInput = querySelector('#sp-config-time-start');
      const timeEndInput = querySelector('#sp-config-time-end');
      const presetSelect = querySelector('#sp-config-preset');
      const granularityRadios = querySelectorAll('input[name="granularity"]');
      const breaksList = querySelector('#sp-breaks-list');
      
      console.log('Direct DOM elements found:');
      console.log('- daysCheckboxes:', daysCheckboxes.length);
      console.log('- timeStartInput:', !!timeStartInput);
      console.log('- timeEndInput:', !!timeEndInput);
      console.log('- presetSelect:', !!presetSelect);
      console.log('- granularityRadios:', granularityRadios.length);
      console.log('- breaksList:', !!breaksList);
      
      const selectedDays = Array.from(daysCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);
      
      console.log('Selected days:', selectedDays);
      
      const breaks = Array.from(breaksList?.children || []).map(breakItem => {
        const daysSelect = breakItem.querySelector('.sp-break-days-select');
        const startInput = breakItem.querySelector('.sp-break-start');
        const durationInput = breakItem.querySelector('.sp-break-duration');
        
        const days = daysSelect?.value === 'all' ? ['all'] : [daysSelect?.value || ''];
        
        return {
          days,
          start: startInput?.value || '12:00',
          duration: parseInt(durationInput?.value || '60', 10)
        };
      });
      
      console.log('Breaks:', breaks);
      
      // Get table columns - prefer finding within modal
      let tableColumnCheckboxes = modal ? modal.querySelectorAll('input[name="tableColumns"]') : [];
      if (tableColumnCheckboxes.length === 0) {
        tableColumnCheckboxes = document.querySelectorAll('input[name="tableColumns"]');
      }
      
      console.log('Found table column checkboxes:', tableColumnCheckboxes.length);
      
      if (tableColumnCheckboxes.length === 0) {
        console.error('ERROR: No table column checkboxes found!');
      }
      
      const tableColumns = {
        uhrzeit: true
      };
      
      // Log each checkbox state
      tableColumnCheckboxes.forEach(checkbox => {
        const columnName = checkbox.value;
        const isChecked = checkbox.checked;
        console.log(`Checkbox ${columnName}: checked=${isChecked}, disabled=${checkbox.disabled}, value=${checkbox.value}`);
        // Explicitly convert to boolean
        tableColumns[columnName] = columnName === 'uhrzeit' ? true : Boolean(isChecked);
      });
      
      console.log('Table columns from checkboxes:', tableColumns);
      
      const config = {
        preset: presetSelect?.value || 'standard-week',
        days: selectedDays,
        timeRange: {
          start: timeStartInput?.value || '08:30',
          end: timeEndInput?.value || '17:30'
        },
        granularity: parseInt(
          Array.from(granularityRadios).find(radio => radio.checked)?.value || '15',
          10
        ),
        breaks,
        tableColumns
      };
      
      console.log('Final config from direct DOM:', config);
      console.log('Table columns in config:', config.tableColumns);
      return config;
    }

    updatePreview() {
      if (!this.previewGrid) return;
      
      const config = this.getConfigFromModal();
      if (!config.days.length) {
        this.previewGrid.innerHTML = '<div class="sp-preview-empty">Bitte mindestens einen Tag auswählen</div>';
        return;
      }
      
      const startMin = parseTimeToMinutes(config.timeRange.start);
      const endMin = parseTimeToMinutes(config.timeRange.end);
      const granularity = config.granularity;
      
      // Create preview header
      const headerRow = document.createElement('div');
      headerRow.className = 'sp-preview-header';
      headerRow.style.setProperty('--preview-columns', config.days.length);
      
      headerRow.innerHTML = `
        <div class="sp-preview-header-cell">Zeit</div>
        ${config.days.map(day => `<div class="sp-preview-header-cell">${day}</div>`).join('')}
      `;
      
      // Create time rows
      const timeRows = [];
      for (let time = startMin; time < endMin; time += granularity) {
        const row = document.createElement('div');
        row.className = 'sp-preview-row';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = `60px repeat(${config.days.length}, 1fr)`;
        row.style.gap = '1px';
        
        const timeLabel = label(time);
        row.innerHTML = `
          <div class="sp-preview-time-cell">${timeLabel}</div>
          ${config.days.map(day => `<div class="sp-preview-day-cell" data-day="${day}" data-time="${time}"></div>`).join('')}
        `;
        
        timeRows.push(row);
      }
      
      // Add breaks to preview
      config.breaks.forEach(breakConfig => {
        const breakStartMin = parseTimeToMinutes(breakConfig.start);
        const breakEndMin = breakStartMin + breakConfig.duration;
        const days = breakConfig.days.includes('all') ? config.days : breakConfig.days;
        
        days.forEach(day => {
          timeRows.forEach(row => {
            const dayCell = row.querySelector(`[data-day="${day}"]`);
            if (dayCell) {
              const cellTime = parseInt(dayCell.dataset.time, 10);
              if (cellTime >= breakStartMin && cellTime < breakEndMin) {
                dayCell.innerHTML = '<div class="sp-preview-break"></div>';
              }
            }
          });
        });
      });
      
      // Render preview
      this.previewGrid.innerHTML = '';
      this.previewGrid.appendChild(headerRow);
      timeRows.forEach(row => this.previewGrid.appendChild(row));
    }

    // =========================================
    // PLAN MANAGEMENT
    // =========================================
    defaultPlan() {
      const days = {};
      CONFIG.days.forEach(d => (days[d] = []));
      return { days };
    }

    loadPlan() {
      try {
        const raw = localStorage.getItem(CONFIG.storageKey);
        if (!raw) return this.defaultPlan();
        
        const data = JSON.parse(raw);
        if (!data || !data.days) return this.defaultPlan();
        
        CONFIG.days.forEach(day => {
          if (!Array.isArray(data.days[day])) {
            data.days[day] = [];
          }
          data.days[day] = data.days[day].map(item => this.normalizePlanItem(item));
        });
        
        return data;
      } catch (e) {
        return this.defaultPlan();
      }
    }

    normalizePlanItem(item) {
      const next = Object.assign({}, item);
      if (!next.kind) next.kind = 'method';
      
      if (typeof next.startMin !== 'number' || typeof next.endMin !== 'number') {
        if (typeof next.start === 'number' && typeof next.end === 'number') {
          next.startMin = next.start;
          next.endMin = next.end;
        }
      }
      
      next.startMin = snapToGridStart(next.startMin);
      const snappedDuration = snapDuration(next.endMin - next.startMin);
      let snappedEnd = next.startMin + snappedDuration;
      
      if (snappedEnd > this.DAY_END) {
        snappedEnd = this.DAY_END;
        next.startMin = snapToGridStart(snappedEnd - snappedDuration);
      }
      
      let ensuredEnd = Math.max(next.startMin + CONFIG.baseSlotMinutes, snappedEnd);
      if (ensuredEnd > this.DAY_END) {
        ensuredEnd = this.DAY_END;
        next.startMin = snapToGridStart(ensuredEnd - CONFIG.baseSlotMinutes);
      }
      
      next.endMin = ensuredEnd;
      next.details = this.cloneDetails(next.details);
      return next;
    }

    savePlan() {
      this.hydratePlanDetailsFromLookup();
      this.renderOverlays();
      this.renderPrintTable();
      this.updateSums();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.plan));
    }

    // =========================================
    // ZOOM MANAGEMENT
    // =========================================
    getCurrentLevel() {
      return ZOOM_LEVELS[this.zoomIndex];
    }

    updateGridDimensions() {
      const level = this.getCurrentLevel();
      this.slotMinutes = level.slotMinutes;
      this.slotPx = level.slotPx;
      this.slotsPerDay = Math.max(1, Math.round((this.DAY_END - this.DAY_START) / this.slotMinutes));
      this.wrapper.style.setProperty('--slot-height', this.slotPx + 'px');
      this.wrapper.dataset.spZoom = level.id;
    }

    changeZoom(delta) {
      const next = Math.min(Math.max(this.zoomIndex + delta, 0), ZOOM_LEVELS.length - 1);
      if (next === this.zoomIndex) return;
      
      this.zoomIndex = next;
      this.updateGridDimensions();
      this.refreshLayout({ preserveScroll: true });
      this.persistZoom();
    }

    persistZoom() {
      try {
        localStorage.setItem(CONFIG.zoomKey, String(this.zoomIndex));
      } catch (err) {
        // ignore persistence errors
      }
    }

    loadZoomPreference() {
      try {
        const stored = localStorage.getItem(CONFIG.zoomKey);
        const parsed = Number.parseInt(stored, 10);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed < ZOOM_LEVELS.length) {
          this.zoomIndex = parsed;
        }
      } catch (err) {
        this.zoomIndex = 2;
      }
      this.updateGridDimensions();
    }

    updateZoomControls() {
      const level = this.getCurrentLevel();
      const zoomInBtn = document.getElementById('sp-zoom-in');
      const zoomOutBtn = document.getElementById('sp-zoom-out');
      const zoomIndicator = document.getElementById('sp-zoom-indicator');
      
      if (zoomInBtn) {
        zoomInBtn.disabled = this.zoomIndex === 0;
      }
      if (zoomOutBtn) {
        zoomOutBtn.disabled = this.zoomIndex === ZOOM_LEVELS.length - 1;
      }
      if (zoomIndicator) {
        zoomIndicator.textContent = level.label;
        zoomIndicator.setAttribute('data-zoom', level.id);
      }
    }

    // =========================================
    // LAYOUT MANAGEMENT
    // =========================================
    refreshLayout(options = {}) {
      const { preserveScroll = false } = options;
      let scrollMemory;
      
      if (preserveScroll) {
        scrollMemory = [];
        document.querySelectorAll('.sp-daycol').forEach((dayCol, idx) => {
          scrollMemory[idx] = dayCol.scrollTop;
        });
      }
      
      console.log('Refreshing layout with CONFIG.days:', CONFIG.days);
      console.log('Refreshing layout with CONFIG.day:', CONFIG.day);
      
      this.buildTimeColumn();
      this.setupDayGrids();
      this.normalizeSidebar();
      this.hydratePlanDetailsFromLookup();
      this.renderOverlays();
      this.renderPrintTable();
      this.updateSums();
      
      if (preserveScroll && scrollMemory) {
        document.querySelectorAll('.sp-daycol').forEach((dayCol, idx) => {
          if (typeof scrollMemory[idx] === 'number') {
            dayCol.scrollTop = scrollMemory[idx];
          }
        });
      }
      
      this.updateZoomControls();
    }

    buildTimeColumn() {
      const level = ZOOM_LEVELS[this.zoomIndex];
      const labelEvery = level.labelEverySlots || Math.max(1, Math.round(60 / this.slotMinutes));
      const showMinor = level.showMinor;
      const frag = document.createDocumentFragment();
      
      for (let t = this.DAY_START, i = 0; t < this.DAY_END; t += this.slotMinutes, i++) {
        const d = document.createElement('div');
        const isMajor = i % labelEvery === 0;
        const classes = ['sp-timeslot'];
        classes.push(isMajor ? 'sp-timeslot--major' : showMinor ? 'sp-timeslot--minor' : 'sp-timeslot--quiet');
        d.className = classes.join(' ');
        d.textContent = isMajor ? label(t) : '';
        d.style.textAlign = 'right';
        d.style.paddingRight = '8px';
        d.style.fontSize = '12px';
        if (i === 0) {
          d.style.borderTop = 'none';
        }
        frag.appendChild(d);
      }
      
      this.timesContainer.innerHTML = '';
      this.timesContainer.appendChild(frag);
    }

    setupDayGrids() {
      const level = ZOOM_LEVELS[this.zoomIndex];
      const labelEvery = level.labelEverySlots || Math.max(1, Math.round(60 / this.slotMinutes));
      const showMinor = level.showMinor;
      
      // Generate dynamic columns based on CONFIG.days
      this.generateDynamicColumns();
      
      document.querySelectorAll('.sp-daycol').forEach(dayCol => {
        dayCol.style.setProperty('--rows', this.slotsPerDay);
        dayCol.style.setProperty('--slot-height', this.slotPx + 'px');

        const grid = dayCol.querySelector('.sp-grid');
        if (grid) {
          grid.style.setProperty('--rows', this.slotsPerDay);
          grid.innerHTML = '';
          for (let i = 0; i < this.slotsPerDay; i++) {
            const cell = document.createElement('div');
            const isMajor = i % labelEvery === 0;
            const classes = ['sp-timeslot'];
            classes.push(isMajor ? 'sp-timeslot--major' : showMinor ? 'sp-timeslot--minor' : 'sp-timeslot--quiet');
            cell.className = classes.join(' ');
            cell.addEventListener('dragover', e => e.preventDefault());
            cell.addEventListener('drop', e => this.onDrop(e, grid, i));
            grid.appendChild(cell);
          }
        }

        const overlay = dayCol.querySelector('.sp-overlay');
        if (overlay) {
          overlay.style.setProperty('--rows', this.slotsPerDay);
          overlay.style.setProperty('--slot-height', this.slotPx + 'px');
        }
      });
    }

    generateDynamicColumns() {
      console.log('Generating dynamic columns for days:', CONFIG.days);
      
      const headerRow = document.getElementById('sp-header');
      const mainRow = headerRow.nextElementSibling;
      
      if (!headerRow || !mainRow) {
        console.error('Header or main row not found');
        return;
      }
      
      // Clear existing dynamic content
      const existingHeaders = headerRow.querySelectorAll('.sp-colhead');
      const existingColumns = mainRow.querySelectorAll('.sp-daycol');
      
      console.log('Removing existing headers:', existingHeaders.length);
      console.log('Removing existing columns:', existingColumns.length);
      
      existingHeaders.forEach(header => header.remove());
      existingColumns.forEach(column => column.remove());
      
      // Generate header columns
      CONFIG.days.forEach(day => {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'sp-colhead';
        headerDiv.innerHTML = `${day} <div class="sp-sum" data-sum="${day}">0 Min</div>`;
        headerRow.appendChild(headerDiv);
      });
      
      // Generate day columns
      CONFIG.days.forEach(day => {
        const dayCol = document.createElement('div');
        dayCol.className = 'sp-daycol';
        dayCol.innerHTML = `
          <div class="sp-grid" data-day="${day}"></div>
          <div class="sp-overlay" data-overlay="${day}"></div>
        `;
        mainRow.appendChild(dayCol);
      });
      
      // Update grid template columns
      const dayCount = CONFIG.days.length;
      headerRow.style.gridTemplateColumns = `120px repeat(${dayCount}, minmax(180px, 1fr))`;
      mainRow.style.gridTemplateColumns = `120px repeat(${dayCount}, minmax(180px, 1fr))`;
      
      console.log('Generated', dayCount, 'columns');
    }

    rebuildGrid() {
      console.log('Rebuilding entire grid...');
      
      // Force update constants
      this.setupConstants();
      
      // Clear existing plan data for days that no longer exist
      const currentPlanDays = Object.keys(this.plan.days);
      const configDays = CONFIG.days;
      
      // Remove plan data for days that are no longer in config
      currentPlanDays.forEach(day => {
        if (!configDays.includes(day)) {
          delete this.plan.days[day];
          console.log('Removed plan data for day:', day);
        }
      });
      
      // Ensure plan has data for all config days
      configDays.forEach(day => {
        if (!this.plan.days[day]) {
          this.plan.days[day] = [];
        }
      });
      
      // Rebuild the entire layout
      this.refreshLayout();
      
      console.log('Grid rebuild complete');
    }

    // =========================================
    // CARD MANAGEMENT
    // =========================================
    normalizeSidebar() {
      const sidebar = document.getElementById('sp-methods');
      if (!sidebar) return;
      
      const cards = [...sidebar.querySelectorAll('.sp-card')];
      for (const key in this.cardLookup) {
        delete this.cardLookup[key];
      }

      cards.forEach(card => {
        const titleEl = card.querySelector('.sp-title-text');
        const moreAnchor = card.querySelector('.sp-morelink a');
        
        if (titleEl) {
          titleEl.setAttribute('draggable', 'false');
          titleEl.addEventListener('dragstart', ev => ev.preventDefault());
        }

        const titleText = (card.querySelector('.sp-titletext')?.textContent || '').trim();
        const durationRaw = (card.querySelector('.sp-duration')?.textContent || '').toString();
        const durationValue = parseInt(durationRaw.replace(/\D+/g, ''), 10);
        const dur = snapDuration(Number.isFinite(durationValue) ? durationValue : CONFIG.baseSlotMinutes);
        
        card.style.removeProperty('min-height');

        const entryId = moreAnchor ? this.extractEntryId(moreAnchor.getAttribute('href')) : null;
        const details = this.extractCardDetails(card);
        const cardHtml = this.prepareCardHtml(card);
        
        if (entryId) {
          card.dataset.entryId = entryId;
          this.cardLookup[entryId] = { html: cardHtml, title: titleText, details: this.cloneDetails(details) };
        } else {
          delete card.dataset.entryId;
        }
        
        card.dataset.printHtml = cardHtml;
        card.dataset.dragTitle = titleText;
        card.dataset.dragDuration = String(dur);
        card.dataset.dragDetails = JSON.stringify(this.cloneDetails(details));

        if (!card.dataset.boundDrag) {
          card.dataset.boundDrag = '1';
          const dragGuardReset = () => {
            delete card.dataset.dragGuard;
          };
          
          card.addEventListener('pointerdown', ev => {
            card.dataset.dragGuard = ev.target.closest('.sp-title-text') ? '0' : '1';
          });
          card.addEventListener('pointerup', dragGuardReset);
          card.addEventListener('pointercancel', dragGuardReset);
          card.addEventListener('mouseleave', dragGuardReset);
          
          card.addEventListener('dragstart', e => {
            if (card.dataset.dragGuard === '0') {
              e.preventDefault();
              return;
            }
            
            let payloadDetails;
            try {
              payloadDetails = card.dataset.dragDetails ? JSON.parse(card.dataset.dragDetails) : this.cloneDetails(details);
            } catch (err) {
              payloadDetails = this.cloneDetails(details);
            }
            
            const payload = {
              type: 'method',
              title: card.dataset.dragTitle || '',
              duration: snapDuration(Number.parseInt(card.dataset.dragDuration || String(CONFIG.baseSlotMinutes), 10)),
              cardHtml: card.dataset.printHtml || '',
              entryId: card.dataset.entryId || null,
              details: payloadDetails
            };
            
            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
          });
        }
      });
    }

    extractEntryId(href) {
      if (!href) return null;
      try {
        const parsed = new URL(href, location.origin);
        const rid = parsed.searchParams.get('rid') || parsed.searchParams.get('id') || parsed.searchParams.get('recordid');
        if (rid) return rid;
      } catch (err) {
        const match = href.match(/[?&](?:rid|recordid|id)=([^&]+)/i);
        if (match) return match[1];
      }
      return null;
    }

    prepareCardHtml(card) {
      const clone = card.cloneNode(true);
      clone.removeAttribute('draggable');
      clone.removeAttribute('title');
      clone.classList.remove('sp-card');
      clone.querySelectorAll('.sp-morelink').forEach(el => el.remove());
      clone.querySelectorAll('.sp-btn').forEach(el => el.remove());
      clone.querySelectorAll('.sp-hidden-data, .sp-hidden').forEach(el => el.remove());
      return clone.innerHTML.trim();
    }

    extractCardDetails(card) {
      const get = field => {
        const el = card.querySelector(`[data-field="${field}"]`);
        if (!el) return '';
        return (el.innerHTML || '').trim();
      };
      
      return {
        description: get('description'),
        reflection: get('reflection'),
        requirements: get('requirements'),
        materials: get('materials'),
        flow: get('flow'),
        risks: get('risks'),
        resources: get('materialsList'),
        objectives: get('objectives'),
        contact: get('contact')
      };
    }

    cloneDetails(details = {}) {
      return {
        description: details.description || '',
        reflection: details.reflection || '',
        requirements: details.requirements || '',
        materials: details.materials || '',
        flow: details.flow || '',
        risks: details.risks || '',
        resources: details.resources || '',
        objectives: details.objectives || '',
        contact: details.contact || ''
      };
    }

    hydratePlanDetailsFromLookup() {
      CONFIG.days.forEach(day => {
        const entries = this.plan.days[day] || [];
        entries.forEach(item => {
          if (!item || item.kind === 'break') return;
          
          item.details = this.cloneDetails(item.details);
          if (item.entryId && this.cardLookup[item.entryId] && this.cardLookup[item.entryId].details) {
            const lookup = this.cloneDetails(this.cardLookup[item.entryId].details);
            item.details = this.cloneDetails({ ...lookup, ...item.details });
          }
        });
      });
    }

    // =========================================
    // DRAG & DROP
    // =========================================
    minutesToIndex(min) {
      return Math.floor((min - this.DAY_START) / this.slotMinutes);
    }

    indexToMinutes(idx) {
      return this.DAY_START + idx * this.slotMinutes;
    }

    withinBounds(s, e) {
      return s >= this.DAY_START && e <= this.DAY_END;
    }

    overlaps(a, b) {
      return a.startMin < b.endMin && b.startMin < a.endMin;
    }

    hasCollision(list, cand) {
      return (list || []).some(x => this.overlaps(x, cand));
    }

    onDrop(e, col, slotIndex) {
      e.preventDefault();
      const day = col.getAttribute('data-day');
      if (!this.plan.days[day]) {
        this.plan.days[day] = [];
      }
      
      const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      const startMin = this.indexToMinutes(slotIndex);

      if (payload.type === 'move') {
        this.handleMoveItem(payload, day, startMin);
      } else if (payload.type === 'method') {
        this.handleAddMethod(payload, day, startMin);
      }
    }

    handleMoveItem(payload, day, startMin) {
      const items = this.plan.days[payload.day] || [];
      const moving = items.find(x => x.uid === payload.uid);
      if (!moving) return;
      
      const duration = snapDuration(moving.endMin - moving.startMin);
      const candidate = { ...moving, startMin, endMin: startMin + duration };
      
      if (!this.withinBounds(candidate.startMin, candidate.endMin)) {
        return this.warn('Außerhalb des Rasters (08:00–22:00).');
      }
      
      const targetList = day === payload.day ? items.filter(x => x.uid !== payload.uid) : this.plan.days[day] || [];
      if (this.hasCollision(targetList, candidate)) {
        return this.warn('Zeitüberschneidung im Zieltag.');
      }
      
      this.plan.days[payload.day] = items.filter(x => x.uid !== payload.uid);
      this.plan.days[day].push(candidate);
      this.savePlan();
      this.clearWarn();
    }

    handleAddMethod(payload, day, startMin) {
      const duration = snapDuration(payload.duration);
      const endMin = startMin + duration;
      
      if (!this.withinBounds(startMin, endMin)) {
        return this.warn('Dauer überschreitet das Tagesraster (08:00–22:00).');
      }
      
      let payloadDetails = {};
      if (payload.details) {
        if (typeof payload.details === 'string') {
          try {
            payloadDetails = JSON.parse(payload.details);
          } catch (err) {
            payloadDetails = {};
          }
        } else if (typeof payload.details === 'object') {
          payloadDetails = payload.details;
        }
      }
      
      if ((!payloadDetails.description || !payloadDetails.reflection) && payload.entryId) {
        const lookupDetails = this.cardLookup[payload.entryId]?.details;
        if (lookupDetails) {
          payloadDetails = { ...lookupDetails, ...payloadDetails };
        }
      }
      
      const item = {
        uid: randomId(),
        title: payload.title,
        startMin,
        endMin,
        kind: 'method',
        cardHtml: payload.cardHtml || '',
        entryId: payload.entryId || null,
        details: this.cloneDetails(payloadDetails)
      };
      
      if (this.hasCollision(this.plan.days[day], item)) {
        return this.warn('Zeitüberschneidung in ' + day + '.');
      }
      
      this.plan.days[day].push(item);
      this.savePlan();
      this.clearWarn();
    }

    // =========================================
    // BREAK MANAGEMENT
    // =========================================
    resetBreakForm() {
      const defaultStart = Math.min(
        this.DAY_END - CONFIG.baseSlotMinutes,
        Math.max(this.DAY_START, snapToGridStart(this.DAY_START + 4 * 60))
      );
      this.breakDayField.value = CONFIG.days[0];
      this.breakStartField.value = formatTime(defaultStart);
      this.breakDurationField.value = String(15);
    }

    openBreakModal(options = {}) {
      this.resetBreakForm();
      const {
        day = CONFIG.days[0],
        startMin = snapToGridStart(this.DAY_START + 4 * 60),
        duration = 15
      } = options;
      
      if (CONFIG.days.includes(day)) {
        this.breakDayField.value = day;
      }
      
      const editableStart = Math.min(
        this.DAY_END - CONFIG.baseSlotMinutes,
        Math.max(this.DAY_START, snapToGridStart(startMin))
      );
      this.breakStartField.value = formatTime(editableStart);
      this.breakDurationField.value = String(snapDuration(duration));
      
      this.modal.classList.add('sp-modal--visible');
      this.modal.removeAttribute('aria-hidden');
      this.clearWarn();
      
      if (this.modalKeydownHandler) {
        document.removeEventListener('keydown', this.modalKeydownHandler);
      }
      
      this.modalKeydownHandler = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeBreakModal();
        }
      };
      
      document.addEventListener('keydown', this.modalKeydownHandler);
      setTimeout(() => {
        this.breakStartField.focus();
      }, 0);
    }

    closeBreakModal() {
      this.modal.classList.remove('sp-modal--visible');
      this.modal.setAttribute('aria-hidden', 'true');
      
      if (this.modalKeydownHandler) {
        document.removeEventListener('keydown', this.modalKeydownHandler);
        this.modalKeydownHandler = null;
      }
      
      this.resetBreakForm();
    }

    handleBreakFormSubmit(event) {
      event.preventDefault();
      const selectedDay = this.breakDayField.value;
      
      if (!CONFIG.days.includes(selectedDay || '')) {
        this.warn('Ungültiger Tag.');
        return;
      }
      
      const startValue = parseTimeToMinutes(this.breakStartField.value);
      if (!Number.isFinite(startValue)) {
        this.warn('Bitte eine gültige Startzeit wählen.');
        return;
      }
      
      const durationValue = Number.parseInt(this.breakDurationField.value, 10);
      const duration = snapDuration(durationValue);
      if (!duration) {
        this.warn(`Bitte eine sinnvolle Dauer angeben (>=${CONFIG.baseSlotMinutes}).`);
        return;
      }
      
      const startMin = snapToGridStart(startValue);
      const endMin = startMin + duration;
      
      if (!this.withinBounds(startMin, endMin)) {
        this.warn('Außerhalb des Rasters (08:00–22:00).');
        return;
      }
      
      if (!this.plan.days[selectedDay]) {
        this.plan.days[selectedDay] = [];
      }
      
      const candidate = {
        uid: randomId(),
        title: 'Pause',
        startMin,
        endMin,
        kind: 'break',
        cardHtml: `<p class="sp-print-card__text"><strong>Pause</strong> – ${duration} Min</p>`,
        entryId: null
      };
      
      if (this.hasCollision(this.plan.days[selectedDay], candidate)) {
        this.warn('Überschneidung mit bestehender Einheit.');
        return;
      }
      
      this.plan.days[selectedDay].push(candidate);
      this.savePlan();
      this.clearWarn();
      this.closeBreakModal();
    }

    // =========================================
    // RENDERING
    // =========================================
    renderOverlays() {
      const allDays = CONFIG.days;
      allDays.forEach(day => {
        const overlay = document.querySelector(`[data-overlay="${day}"]`);
        const items = (this.plan.days[day] || []).slice().sort((a, b) => a.startMin - b.startMin);
        if (!overlay) return;
        
        overlay.innerHTML = '';
        overlay.style.setProperty('--rows', this.slotsPerDay);
        overlay.style.setProperty('--slot-height', this.slotPx + 'px');
        
        const level = ZOOM_LEVELS[this.zoomIndex];
        const placeholderThreshold = level.slotMinutes;
        const placeholderMode = level.slotMinutes >= 30;
        
        items.forEach(it => {
          let startIdx = this.minutesToIndex(it.startMin) + 1;
          let endIdx = this.minutesToIndex(it.endMin) + 1;
          if (endIdx <= startIdx) {
            endIdx = startIdx + 1;
          }
          
          const div = document.createElement('div');
          const durationMinutes = Math.max(CONFIG.baseSlotMinutes, it.endMin - it.startMin);
          const isShort = durationMinutes <= this.slotMinutes * 2;
          const isPlaceholder = isShort || (placeholderMode && durationMinutes < placeholderThreshold);
          
          div.className = 'sp-item' +
            (it.kind === 'break' ? ' sp-item--break' : '') +
            (isPlaceholder ? ' sp-item--placeholder' : '');
          div.style.gridRow = `${startIdx} / ${endIdx}`;
          div.style.gridColumn = '1 / -1';
          div.draggable = true;
          
          div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move', day, uid: it.uid }));
          });
          
          const adjustButtons = it.kind !== 'break'
            ? `<button type="button" class="sp-btn" data-act="shorten" data-uid="${it.uid}" title="Dauer um ${CONFIG.baseSlotMinutes} Minuten verkürzen">−${CONFIG.baseSlotMinutes}</button>` +
              `<button type="button" class="sp-btn" data-act="extend" data-uid="${it.uid}" title="Dauer um ${CONFIG.baseSlotMinutes} Minuten verlängern">+${CONFIG.baseSlotMinutes}</button>`
            : '';
          
          const actions = `
            <div class="sp-item-actions" role="group" aria-label="Aktionen">
              ${adjustButtons}
              <button type="button" class="sp-btn" data-act="delete" data-uid="${it.uid}" title="Eintrag vom Plan entfernen">Löschen</button>
            </div>`;
          
          if (isPlaceholder) {
            div.innerHTML = `
              <div class="sp-item-placeholder" title="${escapeHtml(it.title)}">
                <span class="sp-placeholder-dot" aria-hidden="true"></span>
                <span class="sp-placeholder-title">${escapeHtml(it.title)}</span>
                <span class="sp-placeholder-meta">${label(it.startMin)} · ${durationMinutes} Min${it.kind === 'break' ? ' · Pause' : ''}</span>
              </div>
              ${actions}`;
          } else {
            div.innerHTML = `
              <div class="sp-item-content">
                <div class="sp-title">${escapeHtml(it.title)}</div>
                <div class="sp-meta">${label(it.startMin)}–${label(it.endMin)} · ${durationMinutes} Min</div>
              </div>
              ${actions}`;
          }
          
          overlay.appendChild(div);
        });
      });
    }

    renderPrintList() {
      if (!this.printList) return;
      
      const frag = document.createDocumentFragment();
      const activeDays = CONFIG.days.filter(day =>
        (this.plan.days[day] || []).some(entry => entry && entry.kind !== 'break')
      );
      
      activeDays.forEach(day => {
        const methods = (this.plan.days[day] || [])
          .filter(item => item && item.kind !== 'break')
          .slice()
          .sort((a, b) => a.startMin - b.startMin);
        
        if (!methods.length) return;

        const daySection = document.createElement('section');
        daySection.className = 'sp-print-day';

        const heading = document.createElement('h2');
        heading.className = 'sp-print-day__title';
        heading.textContent = day;
        daySection.appendChild(heading);

        methods.forEach(item => {
          const duration = Math.max(CONFIG.baseSlotMinutes, item.endMin - item.startMin);
          const details = this.getItemDetails(item);
          const card = document.createElement('article');
          card.className = 'sp-print-card';

          const header = document.createElement('header');
          header.className = 'sp-print-card__header';
          header.innerHTML = `
            <div class="sp-print-card__heading">
              <h3 class="sp-print-card__name">${escapeHtml(item.title)}</h3>
              <div class="sp-print-card__time">${label(item.startMin)}–${label(item.endMin)} · ${duration} Min</div>
            </div>`;
          card.appendChild(header);

          const body = document.createElement('div');
          body.className = 'sp-print-card__body';

          this.appendPrintSection(body, 'Kurzbeschreibung', details.description);
          this.appendPrintSection(body, 'Ablauf', details.flow);
          this.appendPrintSection(body, 'Reflexion', details.reflection);
          this.appendPrintSection(body, 'Raumanforderungen &amp; Material/Technik', this.combineRequirements(details));
          this.appendPrintSection(body, 'Materialien', details.resources);
          this.appendPrintSection(body, 'Risiken & Tipps', details.risks);
          this.appendPrintSection(body, 'Lernziele', details.objectives);
          this.appendPrintSection(body, 'Kontakt', details.contact);

          if (body.children.length) {
            card.appendChild(body);
          }

          daySection.appendChild(card);
        });

        frag.appendChild(daySection);
      });
      
      this.printList.innerHTML = '';
      this.printList.appendChild(frag);
      this.printList.setAttribute('aria-hidden', this.printList.childElementCount ? 'false' : 'true');
    }

    renderPrintTable() {
      if (!this.printTable) return;
      
      // Get table columns configuration
      const tableColumns = (this.gridConfig && this.gridConfig.tableColumns) || {
        uhrzeit: true,
        title: true,
        description: false,
        flow: true,
        objectives: true,
        risks: false,
        materials: true,
        sonstiges: false
      };
      
      console.log('renderPrintTable - gridConfig:', this.gridConfig);
      console.log('renderPrintTable - tableColumns:', tableColumns);
      
      // Define column order and labels - FESTE REIHENFOLGE
      const columnDefinitions = [
        { key: 'uhrzeit', label: 'Uhrzeit' },
        { key: 'title', label: 'Titel der Methode' },
        { key: 'objectives', label: 'Lernziele' },
        { key: 'description', label: 'Kurzbeschreibung' },
        { key: 'flow', label: 'Ablauf' },
        { key: 'risks', label: 'Risiken/Tipps' },
        { key: 'materials', label: 'Material/Technik' },
        { key: 'sonstiges', label: 'Sonstiges' }
      ];
      
      // Filter to only enabled columns (uhrzeit is always enabled)
      const enabledColumns = columnDefinitions.filter(col => {
        const isEnabled = tableColumns[col.key] === true;
        console.log(`Column ${col.key}: ${isEnabled} (value: ${tableColumns[col.key]})`);
        return isEnabled;
      });
      
      console.log('Enabled columns:', enabledColumns.map(c => c.key));
      
      if (enabledColumns.length === 0) {
        // If only uhrzeit is enabled, still show it
        enabledColumns.push({ key: 'uhrzeit', label: 'Uhrzeit' });
      }
      
      const frag = document.createDocumentFragment();
      const activeDays = CONFIG.days.filter(day =>
        (this.plan.days[day] || []).some(entry => entry && entry.kind !== 'break')
      );
      
      activeDays.forEach(day => {
        const methods = (this.plan.days[day] || [])
          .filter(entry => entry && entry.kind !== 'break')
          .slice()
          .sort((a, b) => a.startMin - b.startMin);
        
        if (!methods.length) return;
        
        const section = document.createElement('section');
        section.className = 'sp-table-day';
        const heading = document.createElement('h2');
        heading.className = 'sp-table-day__title';
        heading.textContent = day;
        section.appendChild(heading);

        const table = document.createElement('table');
        table.className = 'sp-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Generate header cells
        enabledColumns.forEach(col => {
          const th = document.createElement('th');
          th.textContent = col.label;
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        methods.forEach(item => {
          const details = this.getItemDetails(item);
          const row = document.createElement('tr');

          // Generate cells for each enabled column
          enabledColumns.forEach(col => {
            const cell = document.createElement('td');
            let cellContent = '';
            
            switch (col.key) {
              case 'uhrzeit':
                cellContent = `${label(item.startMin)} – ${label(item.endMin)}`;
                cell.textContent = cellContent;
                break;
              case 'title':
                const title = item.title || (item.entryId && this.cardLookup[item.entryId] && this.cardLookup[item.entryId].title) || '';
                cell.innerHTML = this.formatTableCellText(title);
                break;
              case 'description':
                cell.innerHTML = this.formatTableCellText(details.description);
                break;
              case 'flow':
                cell.innerHTML = this.formatTableCellText(details.flow);
                break;
              case 'objectives':
                cell.innerHTML = this.formatTableCellText(details.objectives);
                break;
              case 'risks':
                cell.innerHTML = this.formatTableCellText(details.risks);
                break;
              case 'materials':
                cell.innerHTML = this.formatTableCellText(details.materials);
                break;
              case 'sonstiges':
                // Empty cell for handwritten additions (no content, just empty)
                cell.innerHTML = '';
                break;
              default:
                cell.innerHTML = '—';
            }
            
            row.appendChild(cell);
          });

          tbody.appendChild(row);
        });

        table.appendChild(tbody);
        section.appendChild(table);
        frag.appendChild(section);
      });

      this.printTable.innerHTML = '';
      if (frag.childElementCount > 0) {
        this.printTable.appendChild(frag);
        this.printTable.style.display = 'block';
      } else {
        this.printTable.style.display = 'none';
      }
    }

    updateSums() {
      CONFIG.days.forEach(day => {
        const sum = (this.plan.days[day] || []).reduce((a, b) => a + (b.endMin - b.startMin), 0);
        const el = document.querySelector(`[data-sum="${day}"]`);
        if (el) {
          el.textContent = Math.floor(sum / 60) + ' Std ' + (sum % 60) + ' Min';
        }
      });
    }

    // =========================================
    // UTILITY METHODS
    // =========================================
    formatTableCellText(text) {
      const html = this.normalizeContent(text);
      return html || '—';
    }

    normalizeContent(value) {
      if (!value) return '';
      const raw = typeof value === 'string' ? value : String(value);
      const trimmed = raw.trim();
      if (!trimmed) return '';
      if (/[<>]/.test(trimmed)) return trimmed;
      return trimmed.replace(/\r?\n/g, '<br>');
    }

    appendPrintSection(container, label, value) {
      const html = this.normalizeContent(value);
      if (!html) return;
      const section = document.createElement('section');
      section.className = 'sp-print-card__section';
      section.innerHTML = `<h3>${label}</h3><div>${html}</div>`;
      container.appendChild(section);
    }

    combineRequirements(details) {
      const segments = [];
      if (details.requirements && details.requirements.trim()) {
        segments.push(details.requirements.trim());
      }
      if (details.materials && details.materials.trim()) {
        segments.push(details.materials.trim());
      }
      if (details.resources && details.resources.trim()) {
        segments.push(details.resources.trim());
      }
      return segments.join('<br><br>');
    }

    getItemDetails(item) {
      if (item.details && typeof item.details === 'object') {
        return item.details;
      }
      
      let sourceDetails = null;
      if (item.entryId && this.cardLookup[item.entryId] && this.cardLookup[item.entryId].details) {
        sourceDetails = this.cloneDetails(this.cardLookup[item.entryId].details);
      } else if (item.details && typeof item.details === 'string') {
        try {
          sourceDetails = this.cloneDetails(JSON.parse(item.details));
        } catch (err) {
          sourceDetails = this.cloneDetails();
        }
      } else {
        sourceDetails = this.cloneDetails();
      }
      
      item.details = sourceDetails;
      return sourceDetails;
    }

    // =========================================
    // EXPORT/IMPORT
    // =========================================
    exportPlan() {
      const payload = {
        version: 1,
        raster: { slotMinutes: this.slotMinutes, day: { start: this.DAY_START, end: this.DAY_END } },
        plan: this.plan
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'seminarplan.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    importPlan(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.plan || !data.plan.days) {
            throw new Error('Ungültiges Format');
          }
          this.plan = data.plan;
          this.savePlan();
        } catch (err) {
          this.warn('Import fehlgeschlagen: ' + err.message);
        }
      };
      reader.readAsText(f);
    }

    clearPlan() {
      if (confirm('Gesamten Plan löschen?')) {
        this.plan = this.defaultPlan();
        this.savePlan();
      }
    }

    // =========================================
    // META MANAGEMENT
    // =========================================
    loadMeta() {
      try {
        const raw = localStorage.getItem(CONFIG.metaKey);
        if (!raw) return {};
        return JSON.parse(raw) || {};
      } catch (e) {
        return {};
      }
    }

    saveMeta(meta) {
      localStorage.setItem(CONFIG.metaKey, JSON.stringify(meta));
      this.updatePrintHeader(meta);
    }

    updatePrintHeader(meta) {
      const $phTitle = document.getElementById('sp-ph-title');
      const $phDate = document.getElementById('sp-ph-date');
      const $phNumber = document.getElementById('sp-ph-number');
      const $phContact = document.getElementById('sp-ph-contact');
      const $printTitle = document.getElementById('sp-print-title');
      const defaultPrintTitle = 'Seminarplaner (Drag & Drop)';
      
      if ($phTitle) $phTitle.textContent = meta.title || '—';
      if ($phDate) $phDate.textContent = meta.date || '—';
      if ($phNumber) $phNumber.textContent = meta.number || '—';
      if ($phContact) $phContact.textContent = meta.contact || '—';
      
      if ($printTitle) {
        const parts = [];
        if (meta.title) parts.push(meta.title);
        if (meta.date) parts.push(meta.date);
        if (meta.number) parts.push(`Nr. ${meta.number}`);
        if (meta.contact) parts.push(meta.contact);
        $printTitle.textContent = parts.length ? parts.join(' · ') : defaultPrintTitle;
      }
    }

    bindMetaInputs() {
      const $metaTitle = document.getElementById('sp-meta-title');
      const $metaDate = document.getElementById('sp-meta-date');
      const $metaNumber = document.getElementById('sp-meta-number');
      const $metaContact = document.getElementById('sp-meta-contact');
      
      const meta = Object.assign({}, { title: '', date: '', number: '', contact: '' }, this.loadMeta());
      
      if ($metaTitle) $metaTitle.value = meta.title;
      if ($metaDate) $metaDate.value = meta.date;
      if ($metaNumber) $metaNumber.value = meta.number;
      if ($metaContact) $metaContact.value = meta.contact;
      
      this.updatePrintHeader(meta);

      const handler = () => {
        const current = {
          title: $metaTitle ? $metaTitle.value.trim() : '',
          date: $metaDate ? $metaDate.value.trim() : '',
          number: $metaNumber ? $metaNumber.value.trim() : '',
          contact: $metaContact ? $metaContact.value.trim() : ''
        };
        this.saveMeta(current);
      };
      
      [$metaTitle, $metaDate, $metaNumber, $metaContact].forEach(el => {
        if (el) {
          el.addEventListener('input', handler);
        }
      });
    }

    // =========================================
    // EVENT HANDLERS
    // =========================================
    handleDocumentClick(e) {
      const btn = e.target.closest('button.sp-btn');
      if (!btn) return;
      
      const act = btn.getAttribute('data-act');
      if (!act) return;
      
      const uid = btn.getAttribute('data-uid');
      const day = CONFIG.days.find(d => (this.plan.days[d] || []).some(x => x.uid === uid));
      if (!day) return;
      
      const list = this.plan.days[day];
      const idx = list.findIndex(x => x.uid === uid);
      if (idx < 0) return;
      
      const it = list[idx];

      if (act === 'delete') {
        // Show confirmation for all deletions
        const itemTitle = it.title || (it.kind === 'break' ? 'Pause' : 'Methode');
        const itemType = it.kind === 'break' ? 'Pause' : 'Methode';
        const confirmed = confirm(`${itemType} "${itemTitle}" wirklich löschen?\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
        if (!confirmed) return;
        
        list.splice(idx, 1);
        this.savePlan();
        return;
      }

      if (it.kind === 'break') return;

      if (act === 'extend' || act === 'shorten') {
        const delta = act === 'extend' ? CONFIG.baseSlotMinutes : -CONFIG.baseSlotMinutes;
        const dur = it.endMin - it.startMin + delta;
        if (dur < CONFIG.baseSlotMinutes) {
          return this.warn(`Mindestdauer ${CONFIG.baseSlotMinutes} Minuten.`);
        }
        const candidate = { ...it, endMin: it.startMin + dur };
        if (!this.withinBounds(candidate.startMin, candidate.endMin)) {
          return this.warn('Grenze des Tagesrasters erreicht.');
        }
        if (this.hasCollision(list.filter(x => x.uid !== it.uid), candidate)) {
          return this.warn('Überschneidung bei Anpassung.');
        }
        list[idx] = candidate;
        this.savePlan();
        this.clearWarn();
      }
    }

    // =========================================
    // MESSAGING
    // =========================================
    warn(text) {
      if (this.msg) {
        this.msg.textContent = text;
      }
    }

    clearWarn() {
      if (this.msg) {
        this.msg.textContent = '';
      }
    }
  }

  // =========================================
  // INITIALIZATION
  // =========================================
  function initSeminarplaner() {
    new Seminarplaner();
  }

  window.initSeminarplaner = initSeminarplaner;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSeminarplaner);
  } else {
    initSeminarplaner();
  }
})();