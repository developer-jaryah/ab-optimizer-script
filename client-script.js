// A/B Optimizer Client Script
// This structure supports direct loading, JSONP loading, and GitHub loading
var abOptimizerInit = function(initFunction) {
  // If called via JSONP, execute the provided function
  if (typeof initFunction === 'function') {
    console.log("[AB Optimizer] Initializing via JSONP");
    return initFunction();
  }
  
  // Otherwise, run our normal initialization
  console.log("[AB Optimizer] Initializing normally");
  initABOptimizer();
};

function initABOptimizer() {
  return (function() {
    // Configuration - These values will be set in one of three ways:
    // 1. From window.abOptimizerConfig (GitHub hosted script)
    // 2. Replaced by the server when the script is served directly
    // 3. Set via JSONP parameters
    
    // Get configuration from global object if available
    const config = window.abOptimizerConfig || {};
    const APP_URL = config.apiUrl || '{{APP_URL}}';
    const WEBSITE_ID = config.websiteId || '{{WEBSITE_ID}}';
    
    // For debugging, use a hard-coded host URL if the APP_URL is still a template
    const hostUrl = APP_URL.includes('{{') ? 'https://ab-optimizer.replit.app' : APP_URL;
    
    // Check and flag design mode right away for consistent element handling
    window.abOptimizerDesignMode = new URLSearchParams(window.location.search).has('design');
    
    // Immediately log that script is loaded
    console.log("[AB Optimizer] Script loaded successfully!");
    console.log("[AB Optimizer] APP_URL:", APP_URL);
    console.log("[AB Optimizer] WEBSITE_ID:", WEBSITE_ID);
    console.log("[AB Optimizer] Using host URL:", hostUrl);
    console.log("[AB Optimizer] Design mode:", window.abOptimizerDesignMode ? "enabled" : "disabled");
    console.log("[AB Optimizer] Configuration source:", window.abOptimizerConfig ? "GitHub Config" : "Direct/JSONP");
    
    // Debug all data-ab and data-id attributes on the page
    console.log("[AB Optimizer] Checking for elements with data-ab or data-id attributes...");
    const dataAbElements = document.querySelectorAll('[data-ab]');
    const dataIdElements = document.querySelectorAll('[data-id]');
    
    console.log("[AB Optimizer] Found data-ab elements:", dataAbElements.length);
    console.log("[AB Optimizer] Found data-id elements:", dataIdElements.length);
    
    // Globals for the A/B Test functionality
    window.abOptimizerSelectedElements = [];
    window.abOptimizerActions = {
      get: 'get',
      add: 'add',
      replace: 'replace',
      update: 'update',
      delete: 'delete',
      toggle: 'toggle'
    };
    
    // Check if we're in design mode
    const isDesignMode = window.abOptimizerDesignMode;
    
    // Track whether a variation is being viewed
    const expParam = Array.from(new URLSearchParams(window.location.search).keys())
      .find(key => key.startsWith('exp_'));
    const isViewingVariation = !!expParam;
    
    // Apply experiments based on traffic allocation
    function applyExperiment() {
      if (isDesignMode) {
        console.log('[AB Optimizer] Design mode active, not applying experiments');
        // Pass existing variation if available as a query param
        const urlParams = new URLSearchParams(window.location.search);
        const existingVariationId = urlParams.has('variation') ? urlParams.get('variation') : null;
        initDesignMode(existingVariationId);
        return;
      }
      
      if (isViewingVariation) {
        console.log('[AB Optimizer] Viewing specific variation:', expParam);
        loadExperimentByUrl(expParam.split('_')[1]);
        return;
      }
      
      console.log('[AB Optimizer] Checking for active experiments');
      loadActiveExperiments();
    }
    
    // Load a specific experiment by URL parameter
    function loadExperimentByUrl(expId) {
      fetch(`${hostUrl}/api/experiments/${expId}/public`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(experiment => {
        console.log('[AB Optimizer] Loaded experiment by URL:', experiment);
        applyExperimentChanges(experiment, expId);
      })
      .catch(error => {
        console.error('Error loading experiment by URL:', error);
      });
    }
    
    // Load active experiments for the current website
    function loadActiveExperiments() {
      fetch(`${hostUrl}/api/websites/${WEBSITE_ID}/active-experiments`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(experiments => {
        if (experiments && experiments.length > 0) {
          console.log('[AB Optimizer] Active experiments found:', experiments);
          // Select an experiment based on traffic allocation
          const selectedExperiment = selectExperimentByTraffic(experiments);
          if (selectedExperiment) {
            applyExperimentChanges(selectedExperiment.experiment, selectedExperiment.id);
          } else {
            console.log('[AB Optimizer] No experiment selected based on traffic allocation');
          }
        } else {
          console.log('[AB Optimizer] No active experiments found');
        }
      })
      .catch(error => {
        console.error('Error loading active experiments:', error);
        // If we can't load active experiments, try loading legacy way
        loadExperimentsLegacy();
      });
    }
    
    // Legacy method for loading experiments (kept for backward compatibility)
    function loadExperimentsLegacy() {
      fetch(`${hostUrl}/api/websites/${WEBSITE_ID}/public-variations`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(variations => {
        if (variations && variations.length > 0) {
          // Randomly select a variation
          const randomIndex = Math.floor(Math.random() * variations.length);
          const variation = variations[randomIndex];
          console.log('[AB Optimizer] Randomly selected variation (legacy):', variation);
          applyVariationContent(variation.elementData);
          // Track impression
          trackEvent(variation.id, 'impression');
        }
      })
      .catch(error => {
        console.error('Error loading legacy variations:', error);
      });
    }
    
    // Select an experiment based on traffic allocation
    function selectExperimentByTraffic(experiments) {
      if (!experiments || !experiments.length) return null;
      
      // Get a random number between 0 and 100
      const randomValue = Math.random() * 100;
      let cumulativePercentage = 0;
      
      for (const experimentData of experiments) {
        const { trafficAllocation } = experimentData;
        
        if (!trafficAllocation || !trafficAllocation.variations) {
          continue;
        }
        
        // Calculate ranges for each variation within this experiment
        for (const variation of trafficAllocation.variations) {
          // Add this variation's percentage to the cumulative amount
          cumulativePercentage += variation.percentage;
          
          // If the random value falls within this range, select this variation
          if (randomValue <= cumulativePercentage) {
            console.log(`[AB Optimizer] Selected variation ${variation.id} with percentage ${variation.percentage}%, random value: ${randomValue}`);
            
            if (variation.isControl) {
              console.log('[AB Optimizer] Control variation selected, no changes applied');
              return null; // Return null for control/default version
            }
            
            return {
              id: experimentData.id,
              experiment: {
                ...experimentData,
                selectedVariation: variation.id
              }
            };
          }
        }
      }
      
      // If we get here, either no experiments exist or the random value exceeded all percentages
      console.log(`[AB Optimizer] No variation selected, random value: ${randomValue}, total percentage: ${cumulativePercentage}`);
      return null;
    }
    
    // Apply changes from a variation to the current page
    function applyVariationContent(elementData) {
      try {
        if (!elementData || !Array.isArray(elementData) || elementData.length === 0) {
          console.log('[AB Optimizer] No element data to apply');
          return;
        }
        
        console.log('[AB Optimizer] Applying variation with', elementData.length, 'changes');
        
        elementData.forEach(change => {
          const elements = document.querySelectorAll(change.selector);
          
          if (!elements || elements.length === 0) {
            console.log(`[AB Optimizer] Element not found: ${change.selector}`);
            return;
          }
          
          elements.forEach(element => {
            switch (change.action) {
              case 'hide':
                // Fade element instead of completely hiding
                element.style.opacity = '0.3';
                break;
                
              case 'show':
                element.style.opacity = '1.0';
                break;
                
              case 'modify':
              default:
                if (change.type === 'text') {
                  // Special handling for heading elements to ensure we properly update the right content
                  if (element.tagName.match(/^H[1-6]$/)) {
                    element.textContent = change.newContent;
                  } else {
                    element.innerHTML = change.newContent;
                  }
                } else if (change.type === 'image' && element.tagName === 'IMG') {
                  element.src = change.newContent;
                } else if (change.type === 'video' && (element.tagName === 'VIDEO' || element.tagName === 'IFRAME')) {
                  if (element.tagName === 'VIDEO') {
                    if (element.querySelector('source')) {
                      element.querySelector('source').src = change.newContent;
                      element.load();
                    } else {
                      element.src = change.newContent;
                      element.load();
                    }
                  } else if (element.tagName === 'IFRAME') {
                    element.src = change.newContent;
                  }
                } else {
                  console.log(`[AB Optimizer] Unsupported element type: ${change.type} for element:`, element);
                }
                break;
            }
          });
        });
      } catch (error) {
        console.error('[AB Optimizer] Error applying variation:', error);
      }
    }
    
    // Apply experiment changes to the current page
    function applyExperimentChanges(experiment, expId) {
      try {
        if (!experiment) {
          console.log('[AB Optimizer] No experiment data to apply');
          return;
        }
        
        const variationId = experiment.selectedVariation;
        const variations = experiment.variations;
        
        if (!variations || !Array.isArray(variations)) {
          console.log('[AB Optimizer] No variations in experiment');
          return;
        }
        
        // Find the selected variation
        const selectedVariation = variations.find(v => v.id === variationId);
        
        if (!selectedVariation) {
          console.log(`[AB Optimizer] Selected variation ${variationId} not found`);
          return;
        }
        
        console.log('[AB Optimizer] Applying experiment with variation:', selectedVariation.name);
        
        // Apply the variation's element data
        applyVariationContent(selectedVariation.elementData);
        
        // Track impression
        trackEvent(expId, 'impression');
      } catch (error) {
        console.error('[AB Optimizer] Error applying experiment:', error);
      }
    }
    
    // Track events (impressions and conversions)
    function trackEvent(expId, eventType) {
      const eventData = {
        experimentId: expId,
        eventType,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        // Include UTM parameters if present
        utmSource: new URLSearchParams(window.location.search).get('utm_source'),
        utmMedium: new URLSearchParams(window.location.search).get('utm_medium'),
        utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign'),
        utmTerm: new URLSearchParams(window.location.search).get('utm_term'),
        utmContent: new URLSearchParams(window.location.search).get('utm_content'),
      };
      
      // Send the event to the server
      fetch(`${hostUrl}/api/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log(`[AB Optimizer] Event tracked: ${eventType}`, data);
      })
      .catch(error => {
        console.error('Error tracking event:', error);
      });
    }
    
    // Load site variations for the visual editor
    async function loadSiteVariations(websiteId) {
      try {
        const response = await fetch(`${hostUrl}/api/websites/${websiteId}/variations`);
        if (!response.ok) {
          throw new Error('Failed to load variations');
        }
        return await response.json();
      } catch (error) {
        console.error('Error loading variations:', error);
        return [];
      }
    }
    
    // Get public variations for a website
    async function fetchPublicVariations(websiteId) {
      try {
        const response = await fetch(`${hostUrl}/api/websites/${websiteId}/public-variations`);
        if (!response.ok) {
          throw new Error('Failed to load public variations');
        }
        return await response.json();
      } catch (error) {
        console.error('Error loading public variations:', error);
        return [];
      }
    }
    
    // Initialize design mode
    async function initDesignMode(existingVariationId) {
      console.log("[AB Optimizer] Initializing design mode...");
      
      // Get the website ID
      let websiteId = WEBSITE_ID;
      if (websiteId.includes('{{')) {
        const scriptTag = document.querySelector('script[data-website-id]');
        if (scriptTag) {
          websiteId = scriptTag.getAttribute('data-website-id');
        } else {
          console.error("[AB Optimizer] Could not determine website ID");
          websiteId = '1'; // Fallback
        }
      }
      
      // Load existing variations
      const variations = await loadSiteVariations(websiteId);
      
      // Check if we're editing an existing variation
      const urlParams = new URLSearchParams(window.location.search);
      let existingVariation = null;
      if (existingVariationId || urlParams.has('variation')) {
        const variationId = existingVariationId || urlParams.get('variation');
        console.log(`[AB Optimizer] Editing existing variation ID: ${variationId}`);
        
        try {
          // First try to find the variation in our loaded variations
          existingVariation = variations.find(v => v.id == variationId);
          
          if (existingVariation) {
            console.log(`[AB Optimizer] Loaded existing variation from cache: ${existingVariation.name}`);
            window.abOptimizerVariationName = existingVariation.name;
            
            // Initialize the selection objects based on existing content
            if (existingVariation.elementData && Array.isArray(existingVariation.elementData)) {
              window.abOptimizerSelectedElements = existingVariation.elementData.map(item => {
                return {
                  selector: item.selector,
                  content: item.newContent,
                  action: item.action || 'modify',
                  type: item.type,
                  originalContent: item.originalContent
                };
              });
            }
          } else {
            // If not found in the cache, try to load it directly
            console.log(`[AB Optimizer] Variation not found in cache, fetching directly...`);
            try {
              const response = await fetch(`${hostUrl}/api/variations/${variationId}`);
              if (response.ok) {
                const variation = await response.json();
                existingVariation = variation;
                window.abOptimizerVariationName = variation.name;
                
                // Initialize the selection objects based on existing content
                if (variation.elementData && Array.isArray(variation.elementData)) {
                  window.abOptimizerSelectedElements = variation.elementData.map(item => {
                    return {
                      selector: item.selector,
                      content: item.newContent,
                      action: item.action || 'modify',
                      type: item.type,
                      originalContent: item.originalContent
                    };
                  });
                }
              } else {
                console.error(`[AB Optimizer] Failed to load variation ${variationId}`);
              }
            } catch (error) {
              console.error(`[AB Optimizer] Error loading variation ${variationId}:`, error);
            }
          }
        } catch (error) {
          console.error(`[AB Optimizer] Error processing variation ${variationId}:`, error);
        }
      }
      
      // Create design mode UI
      createDesignModeUI(existingVariation);
    }
    
    // Create the design mode UI
    function createDesignModeUI(existingVariation) {
      // Create the design mode panel styles
      const style = document.createElement('style');
      style.textContent = `
        .ab-optimizer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.2);
          z-index: 999990;
          display: none;
        }
      
        .ab-optimizer-design-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100vh;
          background: #fff;
          box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
          z-index: 999999;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          display: flex;
          flex-direction: column;
          border-left: 1px solid #e2e8f0;
          overflow: hidden;
        }
        
        .ab-optimizer-panel-header {
          padding: 20px;
          background: #4a6cf7;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .ab-optimizer-panel-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .ab-optimizer-panel-body {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }
        
        .ab-optimizer-panel-footer {
          padding: 15px 20px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
        }
        
        .ab-optimizer-btn {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
          outline: none;
        }
        
        .ab-optimizer-btn-primary {
          background: #4a6cf7;
          color: white;
        }
        
        .ab-optimizer-btn-primary:hover {
          background: #3a5ce7;
        }
        
        .ab-optimizer-btn-secondary {
          background: #f1f5f9;
          color: #64748b;
        }
        
        .ab-optimizer-btn-secondary:hover {
          background: #e2e8f0;
        }
        
        .ab-optimizer-form-group {
          margin-bottom: 20px;
        }
        
        .ab-optimizer-form-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
        }
        
        .ab-optimizer-form-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 14px;
          color: #334155;
          transition: border-color 0.2s;
        }
        
        .ab-optimizer-form-input:focus {
          border-color: #4a6cf7;
          outline: none;
        }
        
        .ab-optimizer-element-badge {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          color: #64748b;
          padding: 4px 8px;
          border-radius: 4px;
          margin: 4px;
          font-size: 12px;
        }
        
        .ab-optimizer-element-badge-remove {
          margin-left: 6px;
          cursor: pointer;
          opacity: 0.7;
        }
        
        .ab-optimizer-element-badge-remove:hover {
          opacity: 1;
        }
        
        .ab-optimizer-tab-header {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 20px;
        }
        
        .ab-optimizer-tab {
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        
        .ab-optimizer-tab.active {
          color: #4a6cf7;
          border-bottom: 2px solid #4a6cf7;
        }
        
        .ab-optimizer-close {
          cursor: pointer;
          font-size: 20px;
        }
        
        .ab-optimizer-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000000;
        }
        
        .ab-optimizer-modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .ab-optimizer-modal-header {
          padding: 15px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .ab-optimizer-modal-body {
          padding: 20px;
        }
        
        .ab-optimizer-modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
        }
        
        .ab-optimizer-element-selector {
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .ab-optimizer-element-selector:hover {
          background: #f8fafc;
        }
        
        .ab-optimizer-element-type {
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .ab-optimizer-element-content {
          font-size: 12px;
          color: #64748b;
        }
        
        .ab-optimizer-highlight {
          outline: 2px dashed #4a6cf7 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
        }
        
        .ab-optimizer-selected {
          outline: 2px solid #10b981 !important;
          outline-offset: 2px !important;
        }
        
        .ab-optimizer-editor {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          width: 90%;
          max-width: 600px;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          z-index: 1000001;
        }
        
        .ab-optimizer-editor-header {
          padding: 15px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .ab-optimizer-editor-body {
          padding: 20px;
        }
        
        .ab-optimizer-editor-footer {
          padding: 15px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        
        .ab-optimizer-mode-selector {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .ab-optimizer-mode-option {
          flex: 1;
          padding: 10px;
          text-align: center;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          color: #64748b;
        }
        
        .ab-optimizer-mode-option.active {
          background: #4a6cf7;
          color: white;
          border-color: #4a6cf7;
        }
        
        .ab-optimizer-selected-elements {
          margin-top: 20px;
        }
        
        .ab-optimizer-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #4a6cf7;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          font-size: 12px;
          margin-left: 8px;
        }
        
        .ab-optimizer-success-message {
          text-align: center;
          padding: 30px 20px;
        }
        
        .ab-optimizer-success-title {
          color: #10b981;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        
        .ab-optimizer-success-text {
          color: #334155;
          margin-bottom: 20px;
        }
        
        .ab-optimizer-code {
          background: #f1f5f9;
          padding: 6px 10px;
          border-radius: 4px;
          font-family: monospace;
          color: #334155;
        }
      `;
      document.head.appendChild(style);
      
      // Create the overlay
      const overlay = document.createElement('div');
      overlay.className = 'ab-optimizer-overlay';
      document.body.appendChild(overlay);
      
      // Create the design panel
      const panel = document.createElement('div');
      panel.className = 'ab-optimizer-design-panel';
      
      // Default panel content - Form for creating a new variation
      let panelContent = '';
      
      if (existingVariation) {
        // If editing existing variation, populate with existing data
        panelContent = `
          <div class="ab-optimizer-panel-header">
            <h3>Edit Variation</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-panel-body">
            <div class="ab-optimizer-mode-selector">
              <div class="ab-optimizer-mode-option active" data-mode="select">Select Elements</div>
              <div class="ab-optimizer-mode-option" data-mode="navigate">Navigate</div>
            </div>
            
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Variation Name</label>
              <input type="text" class="ab-optimizer-form-input" id="ab-optimizer-variation-name" value="${existingVariation.name}">
            </div>
            
            <div class="ab-optimizer-selected-elements">
              <h4>Selected Elements <span class="ab-optimizer-count-badge">${window.abOptimizerSelectedElements.length}</span></h4>
              <div id="ab-optimizer-selected-list">
                ${window.abOptimizerSelectedElements.length > 0 ? 
                  window.abOptimizerSelectedElements.map((el, index) => `
                    <div class="ab-optimizer-element-selector" data-index="${index}">
                      <div class="ab-optimizer-element-type">${el.type} ${el.action === 'hide' ? '(Hidden)' : ''}</div>
                      <div class="ab-optimizer-element-content">${el.selector}</div>
                    </div>
                  `).join('') : 
                  '<p>No elements selected. Click on elements on the page to modify them.</p>'
                }
              </div>
            </div>
          </div>
          <div class="ab-optimizer-panel-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-variations-btn">View Variations</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-save-btn">Update Variation</button>
          </div>
        `;
      } else {
        // Default - create new variation
        panelContent = `
          <div class="ab-optimizer-panel-header">
            <h3>Create Variation</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-panel-body">
            <div class="ab-optimizer-mode-selector">
              <div class="ab-optimizer-mode-option active" data-mode="select">Select Elements</div>
              <div class="ab-optimizer-mode-option" data-mode="navigate">Navigate</div>
            </div>
            
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Variation Name</label>
              <input type="text" class="ab-optimizer-form-input" id="ab-optimizer-variation-name" placeholder="Enter a descriptive name">
            </div>
            
            <div class="ab-optimizer-selected-elements">
              <h4>Selected Elements <span class="ab-optimizer-count-badge">0</span></h4>
              <div id="ab-optimizer-selected-list">
                <p>No elements selected. Click on elements on the page to modify them.</p>
              </div>
            </div>
          </div>
          <div class="ab-optimizer-panel-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-variations-btn">View Variations</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-save-btn">Save Variation</button>
          </div>
        `;
      }
      
      panel.innerHTML = panelContent;
      document.body.appendChild(panel);
      
      // Add event listeners for UI
      setupUIEventListeners();
      
      // Set up element selection
      setupElementSelection();
      
      // Apply existing variations if editing
      if (existingVariation && existingVariation.elementData) {
        applyExistingVariation(existingVariation);
      }
    }
    
    // Add event listeners for the design mode UI
    function setupUIEventListeners() {
      // Close button
      document.querySelector('.ab-optimizer-close').addEventListener('click', () => {
        // Redirect to the clean URL without query parameters
        window.location.href = window.location.href.split('?')[0];
      });
      
      // Mode selector (Select vs Navigate)
      document.querySelectorAll('.ab-optimizer-mode-option').forEach(option => {
        option.addEventListener('click', () => {
          document.querySelectorAll('.ab-optimizer-mode-option').forEach(opt => {
            opt.classList.remove('active');
          });
          option.classList.add('active');
          
          const mode = option.getAttribute('data-mode');
          if (mode === 'select') {
            enableSelectMode();
          } else {
            enableNavigateMode();
          }
        });
      });
      
      // Save button
      document.getElementById('ab-optimizer-save-btn').addEventListener('click', saveVariation);
      
      // Variations button
      document.getElementById('ab-optimizer-variations-btn').addEventListener('click', showVariationsList);
    }
    
    // Enable selecting elements on the page
    function setupElementSelection() {
      let currentHighlightedElement = null;
      
      // Enable element selection mode
      function enableSelectMode() {
        // Add event handlers to all elements on the page
        document.querySelectorAll('*').forEach(el => {
          // Skip our UI elements
          if (
            el.closest('.ab-optimizer-design-panel') || 
            el.closest('.ab-optimizer-overlay') || 
            el.closest('.ab-optimizer-editor') || 
            el.closest('.ab-optimizer-modal') || 
            el === document.body || 
            el === document.documentElement
          ) return;
          
          el.addEventListener('mouseover', highlightElement);
          el.addEventListener('mouseout', removeHighlight);
          el.addEventListener('click', handleElementClick);
        });
        
        // Show the overlay with lower opacity to indicate selection mode
        document.querySelector('.ab-optimizer-overlay').style.display = 'block';
        document.querySelector('.ab-optimizer-overlay').style.opacity = '0.1';
      }
      
      // Disable element selection mode
      function enableNavigateMode() {
        // Remove event handlers from all elements
        document.querySelectorAll('*').forEach(el => {
          el.removeEventListener('mouseover', highlightElement);
          el.removeEventListener('mouseout', removeHighlight);
          el.removeEventListener('click', handleElementClick);
        });
        
        // Remove any current highlight
        if (currentHighlightedElement) {
          currentHighlightedElement.classList.remove('ab-optimizer-highlight');
          currentHighlightedElement = null;
        }
        
        // Hide the overlay
        document.querySelector('.ab-optimizer-overlay').style.display = 'none';
      }
      
      // Highlight an element on mouseover
      function highlightElement(e) {
        e.stopPropagation();
        
        // Remove previous highlight
        if (currentHighlightedElement) {
          currentHighlightedElement.classList.remove('ab-optimizer-highlight');
        }
        
        // Add highlight to current element
        currentHighlightedElement = e.target;
        currentHighlightedElement.classList.add('ab-optimizer-highlight');
      }
      
      // Remove highlight on mouseout
      function removeHighlight(e) {
        e.stopPropagation();
        
        if (currentHighlightedElement) {
          currentHighlightedElement.classList.remove('ab-optimizer-highlight');
          currentHighlightedElement = null;
        }
      }
      
      // Handle clicking on an element
      function handleElementClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        
        // Show the appropriate editor based on element type
        if (element.tagName === 'IMG') {
          showImageEditor(element);
        } else if (element.tagName === 'VIDEO' || (element.tagName === 'IFRAME' && element.src.includes('youtube'))) {
          showVideoEditor(element);
        } else if (element.tagName === 'IFRAME') {
          showIframeEditor(element);
        } else {
          showTextEditor(element);
        }
      }
      
      // Show the text editor for an element
      function showTextEditor(element) {
        const selector = getUniqueSelector(element);
        
        // Special handling for heading elements
        let content = element.tagName.match(/^H[1-6]$/) ? element.textContent : element.innerHTML;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Text</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-editor-body">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Content</label>
              <textarea class="ab-optimizer-form-input" id="ab-optimizer-text-input" rows="5">${content}</textarea>
            </div>
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Visibility</label>
              <select class="ab-optimizer-form-input" id="ab-optimizer-visibility-select">
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div class="ab-optimizer-editor-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-cancel-btn">Cancel</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-apply-btn">Apply</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Event listeners for editor buttons
        editor.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-cancel-btn').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-apply-btn').addEventListener('click', () => {
          const newContent = editor.querySelector('#ab-optimizer-text-input').value;
          const visibility = editor.querySelector('#ab-optimizer-visibility-select').value;
          
          // Add to selected elements
          const elementData = {
            selector,
            type: 'text',
            originalContent: content,
            newContent,
            action: visibility === 'hidden' ? 'hide' : 'modify'
          };
          
          window.abOptimizerSelectedElements.push(elementData);
          
          // Apply the change to the element
          if (visibility === 'hidden') {
            element.style.opacity = '0.3';
          } else {
            // Special handling for heading elements
            if (element.tagName.match(/^H[1-6]$/)) {
              element.textContent = newContent;
            } else {
              element.innerHTML = newContent;
            }
          }
          
          // Mark the element as selected
          element.classList.add('ab-optimizer-selected');
          
          // Update the selected elements counter and list
          updateSelectedElementsList();
          
          // Close the editor
          document.body.removeChild(editor);
        });
      }
      
      // Show the image editor for an image element
      function showImageEditor(element) {
        const selector = getUniqueSelector(element);
        const currentSrc = element.src;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Image</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-editor-body">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Image URL</label>
              <input type="text" class="ab-optimizer-form-input" id="ab-optimizer-image-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Visibility</label>
              <select class="ab-optimizer-form-input" id="ab-optimizer-visibility-select">
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div class="ab-optimizer-editor-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-cancel-btn">Cancel</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-apply-btn">Apply</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Event listeners for editor buttons
        editor.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-cancel-btn').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-apply-btn').addEventListener('click', () => {
          const newImageUrl = editor.querySelector('#ab-optimizer-image-url').value;
          const visibility = editor.querySelector('#ab-optimizer-visibility-select').value;
          
          // Add to selected elements
          const elementData = {
            selector,
            type: 'image',
            originalContent: currentSrc,
            newContent: newImageUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify'
          };
          
          window.abOptimizerSelectedElements.push(elementData);
          
          // Apply the change to the element
          if (visibility === 'hidden') {
            element.style.opacity = '0.3';
          } else {
            element.src = newImageUrl;
          }
          
          // Mark the element as selected
          element.classList.add('ab-optimizer-selected');
          
          // Update the selected elements counter and list
          updateSelectedElementsList();
          
          // Close the editor
          document.body.removeChild(editor);
        });
      }
      
      // Show the video editor for a video element
      function showVideoEditor(element) {
        const selector = getUniqueSelector(element);
        let currentSrc = '';
        
        if (element.tagName === 'VIDEO') {
          currentSrc = element.querySelector('source') ? element.querySelector('source').src : element.src;
        } else {
          // IFRAME - YouTube or other video
          currentSrc = element.src;
        }
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Video</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-editor-body">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Video URL</label>
              <input type="text" class="ab-optimizer-form-input" id="ab-optimizer-video-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Visibility</label>
              <select class="ab-optimizer-form-input" id="ab-optimizer-visibility-select">
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div class="ab-optimizer-editor-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-cancel-btn">Cancel</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-apply-btn">Apply</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Event listeners for editor buttons
        editor.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-cancel-btn').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-apply-btn').addEventListener('click', () => {
          const newVideoUrl = editor.querySelector('#ab-optimizer-video-url').value;
          const visibility = editor.querySelector('#ab-optimizer-visibility-select').value;
          
          // Add to selected elements
          const elementData = {
            selector,
            type: 'video',
            originalContent: currentSrc,
            newContent: newVideoUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify'
          };
          
          window.abOptimizerSelectedElements.push(elementData);
          
          // Apply the change to the element
          if (visibility === 'hidden') {
            element.style.opacity = '0.3';
          } else {
            if (element.tagName === 'VIDEO') {
              if (element.querySelector('source')) {
                element.querySelector('source').src = newVideoUrl;
                element.load();
              } else {
                element.src = newVideoUrl;
                element.load();
              }
            } else {
              // IFRAME
              element.src = newVideoUrl;
            }
          }
          
          // Mark the element as selected
          element.classList.add('ab-optimizer-selected');
          
          // Update the selected elements counter and list
          updateSelectedElementsList();
          
          // Close the editor
          document.body.removeChild(editor);
        });
      }
      
      // Show the iframe editor for an iframe element
      function showIframeEditor(element) {
        const selector = getUniqueSelector(element);
        const currentSrc = element.src;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit IFrame</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-editor-body">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">IFrame URL</label>
              <input type="text" class="ab-optimizer-form-input" id="ab-optimizer-iframe-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-form-label">Visibility</label>
              <select class="ab-optimizer-form-input" id="ab-optimizer-visibility-select">
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div class="ab-optimizer-editor-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-cancel-btn">Cancel</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-apply-btn">Apply</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Event listeners for editor buttons
        editor.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-cancel-btn').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('#ab-optimizer-apply-btn').addEventListener('click', () => {
          const newIframeUrl = editor.querySelector('#ab-optimizer-iframe-url').value;
          const visibility = editor.querySelector('#ab-optimizer-visibility-select').value;
          
          // Add to selected elements
          const elementData = {
            selector,
            type: 'iframe',
            originalContent: currentSrc,
            newContent: newIframeUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify'
          };
          
          window.abOptimizerSelectedElements.push(elementData);
          
          // Apply the change to the element
          if (visibility === 'hidden') {
            element.style.opacity = '0.3';
          } else {
            element.src = newIframeUrl;
          }
          
          // Mark the element as selected
          element.classList.add('ab-optimizer-selected');
          
          // Update the selected elements counter and list
          updateSelectedElementsList();
          
          // Close the editor
          document.body.removeChild(editor);
        });
      }
      
      // Enable select mode by default
      enableSelectMode();
    }
    
    // Apply an existing variation's changes to the page
    function applyExistingVariation(variation) {
      if (!variation || !variation.elementData || !Array.isArray(variation.elementData)) {
        return;
      }
      
      variation.elementData.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        
        if (!elements || elements.length === 0) {
          console.log(`[AB Optimizer] Element not found: ${item.selector}`);
          return;
        }
        
        elements.forEach(element => {
          if (item.action === 'hide') {
            // Fade the element instead of completely hiding it
            element.style.opacity = '0.3';
          } else {
            if (item.type === 'text') {
              // Special handling for heading elements
              if (element.tagName.match(/^H[1-6]$/)) {
                element.textContent = item.newContent;
              } else {
                element.innerHTML = item.newContent;
              }
            } else if (item.type === 'image' && element.tagName === 'IMG') {
              element.src = item.newContent;
            } else if (item.type === 'video') {
              if (element.tagName === 'VIDEO') {
                if (element.querySelector('source')) {
                  element.querySelector('source').src = item.newContent;
                  element.load();
                } else {
                  element.src = item.newContent;
                  element.load();
                }
              } else if (element.tagName === 'IFRAME') {
                element.src = item.newContent;
              }
            } else if (item.type === 'iframe' && element.tagName === 'IFRAME') {
              element.src = item.newContent;
            }
          }
          
          // Mark as selected
          element.classList.add('ab-optimizer-selected');
        });
      });
      
      // Update the UI to reflect selected elements
      updateSelectedElementsList();
    }
    
    // Update the list of selected elements in the UI
    function updateSelectedElementsList() {
      const selectedList = document.getElementById('ab-optimizer-selected-list');
      const countBadge = document.querySelector('.ab-optimizer-count-badge');
      
      if (!selectedList || !countBadge) return;
      
      // Update count
      countBadge.textContent = window.abOptimizerSelectedElements.length;
      
      if (window.abOptimizerSelectedElements.length === 0) {
        selectedList.innerHTML = '<p>No elements selected. Click on elements on the page to modify them.</p>';
        return;
      }
      
      // Build the list
      let listHTML = '';
      window.abOptimizerSelectedElements.forEach((el, index) => {
        listHTML += `
          <div class="ab-optimizer-element-selector" data-index="${index}">
            <div class="ab-optimizer-element-type">${el.type} ${el.action === 'hide' ? '(Hidden)' : ''}</div>
            <div class="ab-optimizer-element-content">${el.selector}</div>
          </div>
        `;
      });
      
      selectedList.innerHTML = listHTML;
      
      // Add click handlers for editing or removing elements
      document.querySelectorAll('.ab-optimizer-element-selector').forEach(item => {
        item.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.getAttribute('data-index'));
          const element = window.abOptimizerSelectedElements[index];
          
          // Show confirmation dialog to remove the element
          if (confirm(`Remove this ${element.type} element from the selection?`)) {
            // Remove the highlight on the actual element
            const pageElement = document.querySelector(element.selector);
            if (pageElement) {
              pageElement.classList.remove('ab-optimizer-selected');
              // Reset visibility if it was changed
              if (element.action === 'hide') {
                pageElement.style.opacity = '1';
              }
            }
            
            // Remove from the array
            window.abOptimizerSelectedElements.splice(index, 1);
            
            // Update the list
            updateSelectedElementsList();
          }
        });
      });
    }
    
    // Show a list of existing variations
    async function showVariationsList() {
      try {
        // Get website ID
        let websiteId = WEBSITE_ID;
        if (websiteId.includes('{{')) {
          const scriptTag = document.querySelector('script[data-website-id]');
          if (scriptTag) {
            websiteId = scriptTag.getAttribute('data-website-id');
          } else {
            console.error("[AB Optimizer] Could not determine website ID");
            websiteId = '1'; // Fallback
          }
        }
        
        // Load variations
        const variations = await loadSiteVariations(websiteId);
        
        if (!variations || variations.length === 0) {
          alert('No variations found for this website');
          return;
        }
        
        // Store the original panel content to restore later
        const panel = document.querySelector('.ab-optimizer-design-panel');
        const originalContent = panel.innerHTML;
        
        // Create the variations list UI
        panel.innerHTML = `
          <div class="ab-optimizer-panel-header">
            <h3>Select a Variation</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-panel-body">
            <div id="ab-optimizer-variations-list">
              ${variations.map(variation => `
                <div class="ab-optimizer-element-selector" data-id="${variation.id}">
                  <div class="ab-optimizer-element-type">${variation.name}</div>
                  <div class="ab-optimizer-element-content">
                    Created: ${new Date(variation.createdAt).toLocaleDateString()}
                    <br>
                    Elements: ${variation.elementData ? variation.elementData.length : 0}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="ab-optimizer-panel-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-secondary" id="ab-optimizer-back-btn">Back</button>
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-create-new-btn">Create New</button>
          </div>
        `;
        
        // Add event listeners
        document.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          // Redirect to the clean URL without query parameters
          window.location.href = window.location.href.split('?')[0];
        });
        
        document.getElementById('ab-optimizer-back-btn').addEventListener('click', () => {
          // Restore the original panel content
          panel.innerHTML = originalContent;
          
          // Restore event listeners
          setupUIEventListeners();
        });
        
        document.getElementById('ab-optimizer-create-new-btn').addEventListener('click', () => {
          // Restore the original panel content
          panel.innerHTML = originalContent;
          
          // Restore event listeners
          setupUIEventListeners();
          
          // Reset selected elements
          window.abOptimizerSelectedElements = [];
          
          // Clear the variation name
          document.getElementById('ab-optimizer-variation-name').value = '';
          
          // Update the selected elements list
          updateSelectedElementsList();
          
          // Reset all selected elements on the page
          document.querySelectorAll('.ab-optimizer-selected').forEach(el => {
            el.classList.remove('ab-optimizer-selected');
            el.style.opacity = '1';
          });
        });
        
        // Add click handlers for each variation
        document.querySelectorAll('#ab-optimizer-variations-list .ab-optimizer-element-selector').forEach(item => {
          item.addEventListener('click', (e) => {
            const variationId = e.currentTarget.getAttribute('data-id');
            
            // Redirect to the variation edit page
            const currentUrl = window.location.href.split('?')[0];
            window.location.href = `${currentUrl}?design&variation=${variationId}`;
          });
        });
      } catch (error) {
        console.error('Error loading variations:', error);
        alert('Error loading variations: ' + error.message);
      }
    }
    
    // Save the current variation
    function saveVariation() {
      const variationName = document.getElementById('ab-optimizer-variation-name').value;
      
      if (!variationName) {
        alert('Please enter a variation name');
        return;
      }
      
      if (window.abOptimizerSelectedElements.length === 0) {
        alert('Please select at least one element to modify');
        return;
      }
      
      // Get website ID
      let websiteId = WEBSITE_ID;
      if (websiteId.includes('{{')) {
        const scriptTag = document.querySelector('script[data-website-id]');
        if (scriptTag) {
          websiteId = scriptTag.getAttribute('data-website-id');
        } else {
          console.error("[AB Optimizer] Could not determine website ID");
          websiteId = '1'; // Fallback
        }
      }
      
      // Prepare the variation data
      const variationData = {
        websiteId,
        name: variationName,
        elementData: window.abOptimizerSelectedElements,
        url: window.location.href.split('?')[0]
      };
      
      // Check if we're editing an existing variation
      const urlParams = new URLSearchParams(window.location.search);
      let existingVariationId = null;
      if (urlParams.has('variation')) {
        existingVariationId = urlParams.get('variation');
      }
      
      // Send to the server
      let url = `${hostUrl}/api/variations`;
      let method = 'POST';
      
      if (existingVariationId) {
        url = `${hostUrl}/api/variations/${existingVariationId}`;
        method = 'PUT';
      }
      
      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(variationData),
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Show success message
        const panel = document.querySelector('.ab-optimizer-design-panel');
        panel.innerHTML = `
          <div class="ab-optimizer-panel-header">
            <h3>Success!</h3>
            <span class="ab-optimizer-close">&times;</span>
          </div>
          <div class="ab-optimizer-panel-body">
            <div class="ab-optimizer-success-message">
              <div class="ab-optimizer-success-title">Variation Saved Successfully!</div>
              <p class="ab-optimizer-success-text">
                Your variation "${data.name}" has been saved.
              </p>
              <p>
                To view this variation, add <span class="ab-optimizer-code">?exp_${data.id}</span> to your URL.
              </p>
            </div>
          </div>
          <div class="ab-optimizer-panel-footer">
            <button class="ab-optimizer-btn ab-optimizer-btn-primary" id="ab-optimizer-done-btn">Done</button>
          </div>
        `;
        
        // Add event listeners
        document.querySelector('.ab-optimizer-close').addEventListener('click', () => {
          // Redirect to the clean URL without query parameters
          window.location.href = window.location.href.split('?')[0];
        });
        
        document.getElementById('ab-optimizer-done-btn').addEventListener('click', () => {
          // Redirect to the clean URL without query parameters
          window.location.href = window.location.href.split('?')[0];
        });
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          window.location.href = window.location.href.split('?')[0];
        }, 3000);
      })
      .catch(error => {
        console.error('Error saving variation:', error);
        alert('Error saving variation: ' + error.message);
      });
    }
    
    // Helper function: Get a unique CSS selector for an element
    function getUniqueSelector(el) {
      // If the element has an ID, use that
      if (el.id) return '#' + el.id;
      
      // Try using the element's classes
      if (el.className) {
        const classSelector = el.tagName.toLowerCase() + '.' + 
          Array.from(el.classList).join('.');
        
        // Check if this selector is unique
        if (document.querySelectorAll(classSelector).length === 1) {
          return classSelector;
        }
      }
      
      // Try using nth-child with parent information
      let path = '';
      let parent = el;
      
      while (parent) {
        // If we've reached the body, stop
        if (parent === document.body || parent === document || !parent.parentElement) {
          path = 'body ' + path;
          break;
        }
        
        // Find the index of the element among its siblings
        let index = 1;
        let sibling = parent;
        
        while (sibling = sibling.previousElementSibling) {
          if (sibling.tagName === parent.tagName) {
            index++;
          }
        }
        
        // Add this element to the path
        let pathSegment = parent.tagName.toLowerCase();
        
        // Add :nth-of-type only if there are multiple elements with the same tag
        const sameTagSiblings = parent.parentElement.querySelectorAll(pathSegment);
        if (sameTagSiblings.length > 1) {
          pathSegment += ':nth-of-type(' + index + ')';
        }
        
        path = pathSegment + (path ? ' > ' + path : '');
        parent = parent.parentElement;
      }
      
      return path.trim();
    }
    
    // Initialize the optimizer
    function initialize() {
      console.log('[AB Optimizer] Initializing...');
      applyExperiment();
    }
    
    // Run initialization
    initialize();
  })();
}

// Initialize if not being loaded via JSONP
if (typeof window !== 'undefined' && !window.hasInitializedABOptimizer) {
  window.hasInitializedABOptimizer = true;
  abOptimizerInit();
}
