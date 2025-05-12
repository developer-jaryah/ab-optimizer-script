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
    
    // Logging the configuration for debugging
    console.log("[AB Optimizer] Using configuration:", { 
      APP_URL, 
      WEBSITE_ID, 
      source: window.abOptimizerConfig ? 'GitHub' : 'Direct/JSONP'
    });
    
    // The rest of your client script unchanged from here
    // Selected elements and their content to be modified
    let selectedElements = [];
    
    // Check if we're in design mode
    const isDesignMode = new URLSearchParams(window.location.search).has('design');
    
    // Track whether a variation is being viewed
    const expParam = Array.from(new URLSearchParams(window.location.search).keys())
      .find(key => key.startsWith('exp_'));
    const isViewingVariation = !!expParam;
    
    // Function to prepare selected elements data for saving
    function prepareSelectedElements() {
      return selectedElements.map(el => {
        const data = {
          selector: el.selector,
          type: el.type,
          originalContent: el.originalContent,
          newContent: el.newContent,
          action: el.action || 'modify',
          visibility: el.visibility,
        };
        
        // Add content field if it exists
        if (el.content) {
          data.content = el.content;
        }
        
        return data;
      });
    }
    
    // Helper to check if an element is hidden
    function isHidden(el) {
      return el.offsetParent === null;
    }
    
    // Generate a unique CSS selector for an element
    function getUniqueSelector(el) {
      // If the element has an ID, use that
      if (el.id) return '#' + el.id;
      
      // If it has a class, try using that with the tag name
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
    
    // Save variation data to the server
    function saveVariationData() {
      // Prepare data to be sent
      const variationData = {
        websiteId: WEBSITE_ID,
        name: document.getElementById('variation-name').value,
        elementData: prepareSelectedElements(),
        url: window.location.href.split('?')[0], // Remove query parameters
      };
      
      // Check if variation name is provided
      if (!variationData.name) {
        alert('Please enter a variation name');
        return;
      }
      
      // Check if elements are selected
      if (variationData.elementData.length === 0) {
        alert('Please select at least one element to modify');
        return;
      }
      
      // Send to server
      fetch(`${APP_URL}/api/variations`, {
        method: 'POST',
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
        const actionPanel = document.querySelector('.ab-optimizer-action-panel');
        if (actionPanel) {
          actionPanel.innerHTML = `
            <div class="ab-optimizer-success">
              <h3>Variation Saved Successfully!</h3>
              <p>Your variation "${data.name}" has been saved.</p>
              <p>To view this variation, add <code>?exp_${data.id}</code> to your URL.</p>
            </div>
          `;
          
          // Auto disable design mode after 3 seconds
          setTimeout(() => {
            window.location.href = window.location.href.split('?')[0];
          }, 3000);
        }
      })
      .catch(error => {
        console.error('Error saving variation:', error);
        alert('Error saving variation. Please try again.');
      });
    }
    
    // Apply experiments based on traffic allocation
    function applyExperiment() {
      if (isDesignMode) {
        console.log('[AB Optimizer] Design mode active, not applying experiments');
        initDesignMode();
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
      fetch(`${APP_URL}/api/experiments/${expId}/public`, {
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
      fetch(`${APP_URL}/api/websites/${WEBSITE_ID}/active-experiments`, {
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
      fetch(`${APP_URL}/api/websites/${WEBSITE_ID}/public-variations`, {
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
        
        console.log('[AB Optimizer] Applying experiment with variation:', selectedVariation);
        
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
      fetch(`${APP_URL}/api/track`, {
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
        const response = await fetch(`${APP_URL}/api/websites/${websiteId}/variations`);
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
        const response = await fetch(`${APP_URL}/api/websites/${websiteId}/public-variations`);
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
    async function initDesignMode() {
      console.log('[AB Optimizer] Initializing design mode');
      
      // Create styles for the design mode UI
      const style = document.createElement('style');
      style.textContent = `
        .ab-optimizer-design-mode {
          position: fixed;
          top: 0;
          right: 0;
          width: 300px;
          height: 100vh;
          background: #fff;
          box-shadow: -2px 0 5px rgba(0,0,0,0.1);
          z-index: 99999;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .ab-optimizer-header {
          padding: 15px;
          background: #4a6cf7;
          color: white;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ab-optimizer-close {
          cursor: pointer;
          font-size: 16px;
        }
        .ab-optimizer-content {
          padding: 15px;
          overflow-y: auto;
          flex: 1;
        }
        .ab-optimizer-footer {
          padding: 15px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between;
        }
        .ab-optimizer-button {
          padding: 8px 12px;
          background: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .ab-optimizer-button:hover {
          background: #3a5ce7;
        }
        .ab-optimizer-button-secondary {
          padding: 8px 12px;
          background: #f1f1f1;
          color: #333;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .ab-optimizer-button-secondary:hover {
          background: #e1e1e1;
        }
        .ab-optimizer-highlight {
          outline: 2px dashed #4a6cf7 !important;
          outline-offset: 2px !important;
        }
        .ab-optimizer-selected {
          outline: 2px solid #ff6b6b !important;
          outline-offset: 2px !important;
        }
        .ab-optimizer-form-group {
          margin-bottom: 15px;
        }
        .ab-optimizer-label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .ab-optimizer-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .ab-optimizer-selected-count {
          background: #4a6cf7;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 12px;
          margin-left: 10px;
        }
        .ab-optimizer-tabs {
          display: flex;
          border-bottom: 1px solid #ddd;
          margin-bottom: 15px;
        }
        .ab-optimizer-tab {
          padding: 8px 15px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }
        .ab-optimizer-tab.active {
          border-bottom: 2px solid #4a6cf7;
          font-weight: bold;
        }
        .ab-optimizer-success {
          text-align: center;
          padding: 20px 0;
        }
        .ab-optimizer-success h3 {
          color: #4caf50;
          margin-bottom: 10px;
        }
        .ab-optimizer-success code {
          background: #f1f1f1;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .ab-optimizer-mode-selector {
          display: flex;
          margin-bottom: 15px;
          background: #f1f1f1;
          border-radius: 4px;
          overflow: hidden;
        }
        .ab-optimizer-mode {
          flex: 1;
          text-align: center;
          padding: 8px;
          cursor: pointer;
        }
        .ab-optimizer-mode.active {
          background: #4a6cf7;
          color: white;
        }
        .ab-optimizer-variation-item {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
          cursor: pointer;
        }
        .ab-optimizer-variation-item:hover {
          background: #f9f9f9;
        }
        .ab-optimizer-selected-elements {
          margin-top: 15px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
          max-height: 300px;
          overflow-y: auto;
        }
        .ab-optimizer-element-item {
          padding: 8px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ab-optimizer-element-info {
          font-size: 12px;
          color: #666;
        }
        .ab-optimizer-element-remove {
          color: #ff6b6b;
          cursor: pointer;
        }
        .ab-optimizer-editor {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 4px;
          box-shadow: 0 0 10px rgba(0,0,0,0.2);
          z-index: 100000;
          width: 80%;
          max-width: 600px;
        }
        .ab-optimizer-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .ab-optimizer-editor-close {
          cursor: pointer;
          font-size: 20px;
        }
        .ab-optimizer-editor-content {
          margin-bottom: 15px;
        }
        .ab-optimizer-editor-actions {
          display: flex;
          justify-content: flex-end;
        }
        .ab-optimizer-editor-button {
          padding: 8px 12px;
          background: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
        }
      `;
      document.head.appendChild(style);
      
      // Create the design mode panel
      const panel = document.createElement('div');
      panel.className = 'ab-optimizer-design-mode';
      panel.innerHTML = `
        <div class="ab-optimizer-header">
          <div>A/B Optimizer Design Mode</div>
          <div class="ab-optimizer-close">×</div>
        </div>
        <div class="ab-optimizer-content">
          <div class="ab-optimizer-mode-selector">
            <div class="ab-optimizer-mode active" data-mode="select">Select Elements</div>
            <div class="ab-optimizer-mode" data-mode="navigate">Navigate</div>
          </div>
          
          <div class="ab-optimizer-form-group">
            <label class="ab-optimizer-label">Variation Name</label>
            <input type="text" id="variation-name" class="ab-optimizer-input" placeholder="Enter variation name">
          </div>
          
          <div class="ab-optimizer-selected-elements">
            <div class="ab-optimizer-selected-count-wrapper">
              Selected elements: <span class="ab-optimizer-selected-count">0</span>
            </div>
            <div id="selected-elements-list">
              <div class="ab-optimizer-empty-selection">No elements selected. Click on elements to select them.</div>
            </div>
          </div>
        </div>
        <div class="ab-optimizer-footer">
          <button class="ab-optimizer-button-secondary" id="load-variations">Load Variations</button>
          <button class="ab-optimizer-button" id="save-variation">Save Variation</button>
        </div>
      `;
      document.body.appendChild(panel);
      
      // Add event listeners for the panel controls
      document.querySelector('.ab-optimizer-close').addEventListener('click', () => {
        window.location.href = window.location.href.split('?')[0];
      });
      
      document.querySelectorAll('.ab-optimizer-mode').forEach(mode => {
        mode.addEventListener('click', () => {
          document.querySelectorAll('.ab-optimizer-mode').forEach(m => m.classList.remove('active'));
          mode.classList.add('active');
          
          const selectedMode = mode.getAttribute('data-mode');
          if (selectedMode === 'select') {
            enableSelectMode();
          } else {
            enableNavigateMode();
          }
        });
      });
      
      document.getElementById('save-variation').addEventListener('click', saveVariationData);
      document.getElementById('load-variations').addEventListener('click', showVariationsList);
      
      // Initialize with select mode
      enableSelectMode();
      
      // Variables for tracking selected elements
      let currentHighlightedElement = null;
      
      // Enable element selection mode
      function enableSelectMode() {
        document.querySelectorAll('*').forEach(el => {
          // Don't add these events to our UI elements
          if (
            el.closest('.ab-optimizer-design-mode') || 
            el.closest('.ab-optimizer-editor') || 
            el === document.body || 
            el === document.documentElement
          ) return;
          
          el.addEventListener('mouseover', highlightElement);
          el.addEventListener('mouseout', removeHighlight);
          el.addEventListener('click', handleElementClick);
        });
      }
      
      // Enable normal navigation mode (disable element selection)
      function enableNavigateMode() {
        document.querySelectorAll('*').forEach(el => {
          el.removeEventListener('mouseover', highlightElement);
          el.removeEventListener('mouseout', removeHighlight);
          el.removeEventListener('click', handleElementClick);
        });
        
        if (currentHighlightedElement) {
          currentHighlightedElement.classList.remove('ab-optimizer-highlight');
          currentHighlightedElement = null;
        }
      }
      
      // Highlight elements on mouseover
      function highlightElement(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Remove highlight from previous element
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
        e.preventDefault();
        
        if (currentHighlightedElement) {
          currentHighlightedElement.classList.remove('ab-optimizer-highlight');
          currentHighlightedElement = null;
        }
      }
      
      // Handle element click in selection mode
      function handleElementClick(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const el = e.target;
        
        // Don't select our UI elements
        if (
          el.closest('.ab-optimizer-design-mode') || 
          el.closest('.ab-optimizer-editor')
        ) return;
        
        // Decide what to do based on element type
        if (el.tagName === 'IMG') {
          showImageEditor(el, Date.now());
        } else if (el.tagName === 'VIDEO' || (el.tagName === 'IFRAME' && el.src.includes('youtube'))) {
          showVideoEditor(el, Date.now());
        } else if (el.tagName === 'IFRAME' && !el.src.includes('youtube')) {
          showIframeEditor(el, Date.now());
        } else {
          // Text element
          showTextEditor(el, Date.now());
        }
      }
      
      // Show image editor
      function showImageEditor(el, id) {
        const selector = getUniqueSelector(el);
        const currentSrc = el.src;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Image</h3>
            <div class="ab-optimizer-editor-close">×</div>
          </div>
          <div class="ab-optimizer-editor-content">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-label">Image URL</label>
              <input type="text" class="ab-optimizer-input image-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <div>
                <label class="ab-optimizer-label">Visibility</label>
                <select class="ab-optimizer-input visibility-select">
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>
          <div class="ab-optimizer-editor-actions">
            <button class="ab-optimizer-editor-button cancel">Cancel</button>
            <button class="ab-optimizer-editor-button save">Save</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Set up event listeners
        editor.querySelector('.ab-optimizer-editor-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.cancel').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.save').addEventListener('click', () => {
          const newImageUrl = editor.querySelector('.image-url').value;
          const visibility = editor.querySelector('.visibility-select').value;
          
          // Add to selected elements
          selectedElements.push({
            id,
            selector,
            type: 'image',
            originalContent: currentSrc,
            newContent: newImageUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify',
            visibility
          });
          
          // Update UI
          updateSelectedCount();
          
          // Update element in real-time preview
          if (visibility === 'hidden') {
            el.style.opacity = '0.3';
          } else {
            el.src = newImageUrl;
          }
          
          // Mark as selected
          el.classList.add('ab-optimizer-selected');
          
          // Close editor
          document.body.removeChild(editor);
        });
      }
      
      // Show video editor
      function showVideoEditor(el, id) {
        // Get current video source
        let currentSrc = '';
        if (el.tagName === 'VIDEO') {
          currentSrc = el.querySelector('source') ? el.querySelector('source').src : el.src;
        } else {
          // Extract YouTube video ID
          currentSrc = el.src;
        }
        
        const selector = getUniqueSelector(el);
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Video</h3>
            <div class="ab-optimizer-editor-close">×</div>
          </div>
          <div class="ab-optimizer-editor-content">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-label">Video URL</label>
              <input type="text" class="ab-optimizer-input video-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <div>
                <label class="ab-optimizer-label">Visibility</label>
                <select class="ab-optimizer-input visibility-select">
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>
          <div class="ab-optimizer-editor-actions">
            <button class="ab-optimizer-editor-button cancel">Cancel</button>
            <button class="ab-optimizer-editor-button save">Save</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Set up event listeners
        editor.querySelector('.ab-optimizer-editor-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.cancel').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.save').addEventListener('click', () => {
          const newVideoUrl = editor.querySelector('.video-url').value;
          const visibility = editor.querySelector('.visibility-select').value;
          
          // Add to selected elements
          selectedElements.push({
            id,
            selector,
            type: 'video',
            originalContent: currentSrc,
            newContent: newVideoUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify',
            visibility
          });
          
          // Update UI
          updateSelectedCount();
          
          // Update element in real-time preview
          if (visibility === 'hidden') {
            el.style.opacity = '0.3';
          } else {
            if (el.tagName === 'VIDEO') {
              if (el.querySelector('source')) {
                el.querySelector('source').src = newVideoUrl;
                el.load();
              } else {
                el.src = newVideoUrl;
                el.load();
              }
            } else {
              el.src = newVideoUrl;
            }
          }
          
          // Mark as selected
          el.classList.add('ab-optimizer-selected');
          
          // Close editor
          document.body.removeChild(editor);
        });
      }
      
      // Show iframe editor
      function showIframeEditor(el, id) {
        const selector = getUniqueSelector(el);
        const currentSrc = el.src;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit IFrame</h3>
            <div class="ab-optimizer-editor-close">×</div>
          </div>
          <div class="ab-optimizer-editor-content">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-label">IFrame URL</label>
              <input type="text" class="ab-optimizer-input iframe-url" value="${currentSrc}">
            </div>
            <div class="ab-optimizer-form-group">
              <div>
                <label class="ab-optimizer-label">Visibility</label>
                <select class="ab-optimizer-input visibility-select">
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>
          <div class="ab-optimizer-editor-actions">
            <button class="ab-optimizer-editor-button cancel">Cancel</button>
            <button class="ab-optimizer-editor-button save">Save</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Set up event listeners
        editor.querySelector('.ab-optimizer-editor-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.cancel').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.save').addEventListener('click', () => {
          const newIframeUrl = editor.querySelector('.iframe-url').value;
          const visibility = editor.querySelector('.visibility-select').value;
          
          // Add to selected elements
          selectedElements.push({
            id,
            selector,
            type: 'iframe',
            originalContent: currentSrc,
            newContent: newIframeUrl,
            action: visibility === 'hidden' ? 'hide' : 'modify',
            visibility
          });
          
          // Update UI
          updateSelectedCount();
          
          // Update element in real-time preview
          if (visibility === 'hidden') {
            el.style.opacity = '0.3';
          } else {
            el.src = newIframeUrl;
          }
          
          // Mark as selected
          el.classList.add('ab-optimizer-selected');
          
          // Close editor
          document.body.removeChild(editor);
        });
      }
      
      // Generate a unique CSS selector for an element
      function getUniqueSelector(el) {
        // If the element has an ID, use that
        if (el.id) return '#' + el.id;
        
        // If it has a class, try using that with the tag name
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
      
      // Show text editor
      function showTextEditor(el, id) {
        const selector = getUniqueSelector(el);
        
        // Special handling for heading elements
        let content = el.tagName.match(/^H[1-6]$/) ? el.textContent : el.innerHTML;
        
        const editor = document.createElement('div');
        editor.className = 'ab-optimizer-editor';
        editor.innerHTML = `
          <div class="ab-optimizer-editor-header">
            <h3>Edit Text Content</h3>
            <div class="ab-optimizer-editor-close">×</div>
          </div>
          <div class="ab-optimizer-editor-content">
            <div class="ab-optimizer-form-group">
              <label class="ab-optimizer-label">Content</label>
              <textarea class="ab-optimizer-input text-content" rows="5">${content}</textarea>
            </div>
            <div class="ab-optimizer-form-group">
              <div>
                <label class="ab-optimizer-label">Visibility</label>
                <select class="ab-optimizer-input visibility-select">
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>
          <div class="ab-optimizer-editor-actions">
            <button class="ab-optimizer-editor-button cancel">Cancel</button>
            <button class="ab-optimizer-editor-button save">Save</button>
          </div>
        `;
        document.body.appendChild(editor);
        
        // Set up event listeners
        editor.querySelector('.ab-optimizer-editor-close').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.cancel').addEventListener('click', () => {
          document.body.removeChild(editor);
        });
        
        editor.querySelector('.save').addEventListener('click', () => {
          const newContent = editor.querySelector('.text-content').value;
          const visibility = editor.querySelector('.visibility-select').value;
          
          // Add to selected elements
          selectedElements.push({
            id,
            selector,
            type: 'text',
            originalContent: content,
            newContent: newContent,
            action: visibility === 'hidden' ? 'hide' : 'modify',
            visibility
          });
          
          // Update UI
          updateSelectedCount();
          
          // Update element in real-time preview
          if (visibility === 'hidden') {
            toggleSectionVisibility(el, 'hidden');
          } else {
            // For heading elements, we need to use textContent
            if (el.tagName.match(/^H[1-6]$/)) {
              el.textContent = newContent;
            } else {
              el.innerHTML = newContent;
            }
          }
          
          // Mark as selected
          el.classList.add('ab-optimizer-selected');
          
          // Close editor
          document.body.removeChild(editor);
        });
      }
      
      // Toggle element visibility
      function toggleSectionVisibility(el, visibility) {
        el.style.opacity = visibility === 'hidden' ? '0.3' : '1';
      }
      
      // Update the selected elements count in the UI
      function updateSelectedCount() {
        const countEl = document.querySelector('.ab-optimizer-selected-count');
        countEl.textContent = selectedElements.length;
        
        // Update the selected elements list
        const listEl = document.getElementById('selected-elements-list');
        
        if (selectedElements.length === 0) {
          listEl.innerHTML = '<div class="ab-optimizer-empty-selection">No elements selected. Click on elements to select them.</div>';
          return;
        }
        
        // Clear the list
        listEl.innerHTML = '';
        
        // Add each selected element to the list
        selectedElements.forEach((element, index) => {
          const el = document.createElement('div');
          el.className = 'ab-optimizer-element-item';
          el.innerHTML = `
            <div>
              <strong>${element.type}</strong>
              <div class="ab-optimizer-element-info">${element.selector}</div>
            </div>
            <div class="ab-optimizer-element-remove" data-index="${index}">×</div>
          `;
          listEl.appendChild(el);
          
          // Add event listener for remove button
          el.querySelector('.ab-optimizer-element-remove').addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            
            // Find the element on the page and remove the selected class
            const selector = selectedElements[index].selector;
            const pageEl = document.querySelector(selector);
            if (pageEl) {
              pageEl.classList.remove('ab-optimizer-selected');
              // Reset visibility if it was changed
              if (selectedElements[index].action === 'hide') {
                pageEl.style.opacity = '1';
              }
            }
            
            // Remove from the array
            selectedElements.splice(index, 1);
            
            // Update the UI
            updateSelectedCount();
          });
        });
      }
      
      // Show the list of existing variations
      async function showVariationsList() {
        try {
          // Load existing variations
          const variations = await loadSiteVariations(WEBSITE_ID);
          
          if (!variations || variations.length === 0) {
            alert('No variations found for this website');
            return;
          }
          
          // Create the UI for variations list
          const container = document.querySelector('.ab-optimizer-content');
          
          // Store original content to restore it later
          const originalContent = container.innerHTML;
          
          container.innerHTML = `
            <div class="ab-optimizer-header-small">
              <h3>Select a Variation to Edit</h3>
              <button class="ab-optimizer-button-secondary" id="back-to-editor">Back to Editor</button>
            </div>
            <div class="ab-optimizer-variations-list">
              ${variations.map((variation, index) => `
                <div class="ab-optimizer-variation-item" data-id="${variation.id}">
                  <strong>${variation.name}</strong>
                  <div>Created: ${new Date(variation.createdAt).toLocaleDateString()}</div>
                  <div>${variation.elementData.length} elements modified</div>
                </div>
              `).join('')}
            </div>
          `;
          
          // Add event listeners
          document.getElementById('back-to-editor').addEventListener('click', () => {
            container.innerHTML = originalContent;
            
            // Restore event listeners
            document.getElementById('save-variation').addEventListener('click', saveVariationData);
            document.getElementById('load-variations').addEventListener('click', showVariationsList);
            
            // Update selected elements count
            updateSelectedCount();
          });
          
          document.querySelectorAll('.ab-optimizer-variation-item').forEach(item => {
            item.addEventListener('click', () => {
              const variationId = item.getAttribute('data-id');
              editExistingVariation(variationId, variations);
            });
          });
        } catch (error) {
          console.error('Error loading variations:', error);
          alert('Error loading variations');
        }
      }
      
      // Edit an existing variation
      function editExistingVariation(variationId, variations) {
        const variation = variations.find(v => v.id === parseInt(variationId));
        
        if (!variation) {
          alert('Variation not found');
          return;
        }
        
        // Clear current selected elements
        selectedElements.forEach(element => {
          const pageEl = document.querySelector(element.selector);
          if (pageEl) {
            pageEl.classList.remove('ab-optimizer-selected');
            // Reset visibility
            if (element.action === 'hide') {
              pageEl.style.opacity = '1';
            }
          }
        });
        
        selectedElements = [];
        
        // Add variation elements to selected elements
        variation.elementData.forEach(element => {
          const pageEl = document.querySelector(element.selector);
          
          if (pageEl) {
            // Add element to selected elements
            selectedElements.push({
              id: Date.now() + Math.random(),
              selector: element.selector,
              type: element.type,
              originalContent: element.originalContent,
              newContent: element.newContent,
              action: element.action || 'modify',
              visibility: element.visibility || 'visible'
            });
            
            // Apply changes to the page
            if (element.action === 'hide') {
              pageEl.style.opacity = '0.3';
            } else {
              if (element.type === 'text') {
                // Special handling for heading elements
                if (pageEl.tagName.match(/^H[1-6]$/)) {
                  pageEl.textContent = element.newContent;
                } else {
                  pageEl.innerHTML = element.newContent;
                }
              } else if (element.type === 'image' && pageEl.tagName === 'IMG') {
                pageEl.src = element.newContent;
              } else if (element.type === 'video' && (pageEl.tagName === 'VIDEO' || pageEl.tagName === 'IFRAME')) {
                if (pageEl.tagName === 'VIDEO') {
                  if (pageEl.querySelector('source')) {
                    pageEl.querySelector('source').src = element.newContent;
                    pageEl.load();
                  } else {
                    pageEl.src = element.newContent;
                    pageEl.load();
                  }
                } else if (pageEl.tagName === 'IFRAME') {
                  pageEl.src = element.newContent;
                }
              }
            }
            
            // Mark as selected
            pageEl.classList.add('ab-optimizer-selected');
          }
        });
        
        // Update UI
        const container = document.querySelector('.ab-optimizer-content');
        container.innerHTML = `
          <div class="ab-optimizer-mode-selector">
            <div class="ab-optimizer-mode active" data-mode="select">Select Elements</div>
            <div class="ab-optimizer-mode" data-mode="navigate">Navigate</div>
          </div>
          
          <div class="ab-optimizer-form-group">
            <label class="ab-optimizer-label">Variation Name</label>
            <input type="text" id="variation-name" class="ab-optimizer-input" value="${variation.name}" placeholder="Enter variation name">
          </div>
          
          <div class="ab-optimizer-selected-elements">
            <div class="ab-optimizer-selected-count-wrapper">
              Selected elements: <span class="ab-optimizer-selected-count">${selectedElements.length}</span>
            </div>
            <div id="selected-elements-list"></div>
          </div>
        `;
        
        // Restore event listeners
        document.querySelectorAll('.ab-optimizer-mode').forEach(mode => {
          mode.addEventListener('click', () => {
            document.querySelectorAll('.ab-optimizer-mode').forEach(m => m.classList.remove('active'));
            mode.classList.add('active');
            
            const selectedMode = mode.getAttribute('data-mode');
            if (selectedMode === 'select') {
              enableSelectMode();
            } else {
              enableNavigateMode();
            }
          });
        });
        
        // Update the selected elements list
        updateSelectedCount();
      }
      
      // Function to save a variation
      function saveVariation() {
        const variationName = document.getElementById('variation-name').value;
        
        if (!variationName) {
          alert('Please enter a variation name');
          return;
        }
        
        if (selectedElements.length === 0) {
          alert('Please select at least one element to modify');
          return;
        }
        
        const variationData = {
          websiteId: WEBSITE_ID,
          name: variationName,
          elementData: selectedElements.map(el => ({
            selector: el.selector,
            type: el.type,
            originalContent: el.originalContent,
            newContent: el.newContent,
            action: el.action,
            visibility: el.visibility
          })),
          url: window.location.href.split('?')[0]
        };
        
        fetch(`${APP_URL}/api/variations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(variationData),
          credentials: 'include'
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(response.statusText);
          }
          return response.json();
        })
        .then(data => {
          function showSuccess(data) {
            const actionPanel = document.querySelector('.ab-optimizer-action-panel');
            if (actionPanel) {
              actionPanel.innerHTML = `
                <div class="ab-optimizer-success">
                  <h3>Variation Saved Successfully!</h3>
                  <p>Your variation "${data.name}" has been saved.</p>
                  <p>To view this variation, add <code>?exp_${data.id}</code> to your URL.</p>
                </div>
              `;
              
              // Auto disable design mode after 3 seconds
              setTimeout(() => {
                window.location.href = window.location.href.split('?')[0];
              }, 3000);
            }
          }
          
          function showError(error) {
            console.error('Error saving variation:', error);
            alert('Error saving variation: ' + error.message);
          }
          
          const container = document.querySelector('.ab-optimizer-content');
          container.innerHTML = `
            <div class="ab-optimizer-success">
              <h3>Variation Saved Successfully!</h3>
              <p>Your variation "${data.name}" has been saved.</p>
              <p>To view this variation, add <code>?exp_${data.id}</code> to your URL.</p>
            </div>
          `;
          
          // Auto disable design mode after 3 seconds
          setTimeout(() => {
            window.location.href = window.location.href.split('?')[0];
          }, 3000);
        })
        .catch(error => {
          console.error('Error saving variation:', error);
          alert('Error saving variation: ' + error.message);
        });
      }
    }
    
    // Initialize the script
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
  initABOptimizer();
}
