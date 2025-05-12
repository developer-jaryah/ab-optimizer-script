// A/B Optimizer Client Script Github
// This structure supports both direct loading and JSONP loading
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
  // Configuration - These values will be replaced by the server when the script is served
  const APP_URL = '{{APP_URL}}';
  const WEBSITE_ID = '{{WEBSITE_ID}}';
  
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
  
  // Debug all data-ab and data-id attributes on the page
  console.log("[AB Optimizer] Checking for elements with data-ab or data-id attributes...");
  const dataAbElements = document.querySelectorAll('[data-ab]');
  const dataIdElements = document.querySelectorAll('[data-id]');
  
  console.log("[AB Optimizer] Found data-ab elements:", dataAbElements.length);
  console.log("[AB Optimizer] Found data-id elements:", dataIdElements.length);
  
  // List all data-id elements
  if (dataIdElements.length > 0) {
    console.log("[AB Optimizer] data-id elements found:");
    dataIdElements.forEach(el => {
      console.log("  - data-id='" + el.getAttribute('data-id') + "': ", el.outerHTML.substring(0, 100) + '...');
    });
  }
  
  // Store original content to support reverting changes
  const originalContent = {
    texts: {},
    sections: {}
  };
  
  // Simple function to prepare data from selected elements in design mode
  function prepareSelectedElements() {
    // This is a simplified version that just returns the manually selected elements from design mode
    
    if (!window.abOptimizerSelectedElements) {
      return {
        texts: {},
        sections: {}
      };
    }
    
    return window.abOptimizerSelectedElements;
  }
  
  // Helper function to check if element is hidden
  function isHidden(el) {
    return (el.offsetParent === null);
  }
  
  // Helper function to get a unique selector for an element
  function getUniqueSelector(el) {
    // If element has an ID, use that
    if (el.id) {
      return `#${el.id}`;
    }
    
    // If element has a unique class combination, use that
    if (el.classList.length > 0) {
      const classSelector = Array.from(el.classList).map(c => `.${c}`).join('');
      const matches = document.querySelectorAll(classSelector);
      if (matches.length === 1) {
        return classSelector;
      }
    }
    
    // If element has a data-id or data-ab attribute, use that
    if (el.hasAttribute('data-id')) {
      return `[data-id="${el.getAttribute('data-id')}"]`;
    }
    
    if (el.hasAttribute('data-ab')) {
      return `[data-ab="${el.getAttribute('data-ab')}"]`;
    }
    
    // Otherwise, get a CSS selector path
    const path = [];
    let currentEl = el;
    
    while (currentEl && currentEl !== document.body) {
      let selector = currentEl.tagName.toLowerCase();
      
      if (currentEl.classList.length > 0) {
        // Pick the first class that seems meaningful
        for (const cls of currentEl.classList) {
          if (cls.length > 2 && !cls.startsWith('w-') && !cls.match(/^(mt|mb|pt|pb|pl|pr|mx|my|px|py)-/)) {
            selector += `.${cls}`;
            break;
          }
        }
      }
      
      const siblings = Array.from(currentEl.parentNode.children).filter(c => c.tagName === currentEl.tagName);
      if (siblings.length > 1) {
        // Find position among siblings
        const index = siblings.indexOf(currentEl) + 1;
        selector += `:nth-of-type(${index})`;
      }
      
      path.unshift(selector);
      
      // If the path already uniquely identifies the element, stop
      if (document.querySelectorAll(path.join(' ')).length === 1) {
        return path.join(' ');
      }
      
      currentEl = currentEl.parentNode;
    }
    
    // Return the path if we got one
    return path.join(' ');
  }
  
  // Function to save variation data in design mode
  function saveVariationData() {
    if (!window.abOptimizerSelectedElements) return;
    
    const variationData = prepareSelectedElements();
    
    console.log("[AB Optimizer] Variation data to save:", variationData);
    
    // Placeholder: this would send the data to the server in a real implementation
    alert("Variation data saved: " + Object.keys(variationData.texts).length + " text changes, " + 
          Object.keys(variationData.sections).length + " visibility changes");
  }

  // Function to apply experiment variations based on URL parameter or traffic allocation
  function applyExperiment() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Case 1: Direct variation access via ?exp_1 parameter
    const expParams = Array.from(urlParams.keys()).filter(key => key.startsWith('exp_'));
    if (expParams.length > 0) {
      const variationId = expParams[0].replace('exp_', '');
      console.log(`[AB Optimizer] Found variation parameter: ${expParams[0]}, variation ID: ${variationId}`);
      
      // Try loading variation directly
      const jsonpCallback = 'abOptimizerVarCallback' + Math.floor(Math.random() * 1000000);
      window[jsonpCallback] = function(variation) {
        console.log(`[AB Optimizer] Loaded variation via JSONP:`, variation);
        
        if (variation.error) {
          console.error(`[AB Optimizer] Error loading variation: ${variation.error}`);
          return;
        }
        
        if (variation && variation.content) {
          // Apply variation content directly
          applyVariationContent(variation.content);
          window.abOptimizerApplied = true;
          
          // Track impression
          trackEvent(variationId, 'impression');
          console.log(`[AB Optimizer] Applied variation ${variationId} successfully`);
        } else {
          console.warn(`[AB Optimizer] Variation ${variationId} has no content or is invalid`);
        }
        
        // Clean up the script tag and global callback
        try {
          document.body.removeChild(scriptTag);
        } catch (e) {
          console.warn("[AB Optimizer] Could not remove script tag:", e);
        }
        delete window[jsonpCallback];
      };
      
      const scriptTag = document.createElement('script');
      
      // Ensure APP_URL is defined and valid
      const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
      const websiteId = WEBSITE_ID || '1';  // Fallback to default if needed
      
      // Make sure we have a numeric websiteId
      const normalizedWebsiteId = websiteId.toString().replace(/[^0-9]/g, '');
      console.log(`[AB Optimizer] Using websiteId: ${normalizedWebsiteId} for variation request`);
      
      // Add a cache buster to prevent caching issues
      const cacheBuster = Date.now();
      
      // Construct JSONP URL with proper error handling
      scriptTag.src = `${appUrl}/api/variations/${normalizedWebsiteId}/${variationId}/jsonp?callback=${jsonpCallback}&t=${cacheBuster}`;
      scriptTag.onerror = function() {
        console.error(`[AB Optimizer] Failed to load variation ${variationId} via JSONP, trying direct fetch...`);
        
        // Try via regular API as fallback with CORS mode
        fetch(`${appUrl}/api/variations/${normalizedWebsiteId}/${variationId}?t=${cacheBuster}`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to load variation: ${response.status}`);
            }
            return response.json();
          })
          .then(variation => {
            console.log(`[AB Optimizer] Loaded variation via fetch fallback:`, variation);
            
            if (variation && variation.content) {
              // Apply variation content directly
              applyVariationContent(variation.content);
              window.abOptimizerApplied = true;
              
              // Track impression
              trackEvent(variationId, 'impression');
              console.log(`[AB Optimizer] Applied variation ${variationId} successfully via fetch`);
            } else {
              console.warn(`[AB Optimizer] Variation ${variationId} has no content or is invalid`);
            }
          })
          .catch(error => {
            console.error(`[AB Optimizer] Error loading variation via fetch:`, error);
            
            // Last resort - try without CORS as a final attempt
            console.log(`[AB Optimizer] Trying one last attempt with no-cors mode...`);
            fetch(`${appUrl}/api/variations/${normalizedWebsiteId}/${variationId}?t=${cacheBuster}`, {
              method: 'GET',
              mode: 'no-cors'
            })
            .then(response => {
              // We can't actually access the response data in no-cors mode
              console.log("[AB Optimizer] Made no-cors request as last resort");
            })
            .catch(err => {
              console.error("[AB Optimizer] Even no-cors request failed:", err);
            });
          });
      };
      
      document.body.appendChild(scriptTag);
      return;
    }
    
    // Case 2: Load experiment by URL (if no variation parameter was found)
    // Loading via JSONP to avoid CORS issues
    const jsonpCallback = 'abOptimizerCallback' + Math.floor(Math.random() * 1000000);
    window[jsonpCallback] = function(response) {
      console.log(`[AB Optimizer] Loaded response via JSONP:`, response);
      
      // Check for error at the top level
      if (response.error) {
        console.error(`[AB Optimizer] Error loading experiments: ${response.error}`);
        return;
      }
      
      // Log debug information if available
      if (response.debug) {
        console.log(`[AB Optimizer] Server debug info:`, response.debug);
        console.log(`[AB Optimizer] Request timestamp: ${response.debug.requestTimestamp}, Server timestamp: ${response.debug.serverTimestamp}`);
        console.log(`[AB Optimizer] Total variations: ${response.debug.totalVariationsQueried}, Active variations: ${response.debug.activeVariationsFiltered}`);
      }
      
      // Get the variations from the response, check both formats for backward compatibility
      const variations = Array.isArray(response) ? response : (response.variations || []);
      
      console.log(`[AB Optimizer] Processing ${variations.length} variations`);
      
      // If there are active variations, select one based on traffic allocation
      if (variations.length > 0) {
        // First check for any 100% traffic allocation variations
        // This ensures they're always applied consistently
        const full100PctVariation = variations.find(v => 
          Number(v.trafficAllocation) === 100
        );
        
        if (full100PctVariation) {
          console.log(`[AB Optimizer] Found variation with 100% traffic allocation (ID: ${full100PctVariation.id})`);
          
          // Apply the 100% variation directly, skipping regular selection algorithm
          applyExperimentChanges(full100PctVariation, full100PctVariation.id);
        } else {
          // Normal selection via weighted algorithm
          const selectedVariation = selectExperimentByTraffic(variations);
          
          if (selectedVariation) {
            // Apply variation changes
            console.log(`[AB Optimizer] Selected variation ${selectedVariation.id} with ${selectedVariation.trafficAllocation}% traffic allocation`);
            applyExperimentChanges(selectedVariation, selectedVariation.id);
          } else {
            console.log('[AB Optimizer] No variation selected from traffic allocation');
          }
        }
      } else {
        console.log('[AB Optimizer] No active variations for this website');
      }
      
      // Clean up the script tag and global callback
      document.body.removeChild(scriptTag);
      delete window[jsonpCallback];
    };
    
    const scriptTag = document.createElement('script');
    
    // Ensure APP_URL is defined and valid
    const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
    
    // Construct JSONP URL with timestamp and random value for cache busting
    const timestamp = new Date().getTime();
    const randomValue = Math.floor(Math.random() * 1000000);
    
    // Add cache busting parameters to ensure we get fresh data
    scriptTag.src = `${appUrl}/api/experiments/${WEBSITE_ID}/active/jsonp?callback=${jsonpCallback}&t=${timestamp}&r=${randomValue}`;
    
    // Set error handler to try fetch API as a fallback
    scriptTag.onerror = function() {
      console.error(`[AB Optimizer] Failed to load active experiments via JSONP, trying fetch API...`);
      loadExperimentsLegacy();
    };
    
    document.body.appendChild(scriptTag);
  }
  
  // Function to load experiment data by URL
  function loadExperimentByUrl(expId) {
    // API endpoint to get variation data directly
    const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
    
    // Try to load the variation from the server
    fetch(`${appUrl}/api/variations/${expId}`, {
      method: 'GET',
      mode: 'cors'
    })
      .then(response => {
        // Check if response is OK
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        
        return response.json();
      })
      .then(variation => {
        console.log(`[AB Optimizer] Loaded variation:`, variation);
        
        // Apply variation content directly
        if (variation && variation.content) {
          trackEvent(variation.id, 'impression');
          applyVariationContent(variation.content);
          console.log(`[AB Optimizer] Applied forced variation #${variation.id} (${variation.name})`);
        } else {
          console.log(`[AB Optimizer] Variation ${expId} has no content or not found`);
        }
      })
      .catch(error => {
        console.error("[AB Optimizer] Error loading variation:", error);
        
        // Show error message to the user
        if (window.abOptimizerShowError) {
          window.abOptimizerShowError(error);
        }
      });
  }
  
  // Function to load all active experiments
  function loadActiveExperiments() {
    // API endpoint to get active experiments
    const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
    
    // First check URL for force-refresh flag for caching troubleshooting
    const urlParams = new URLSearchParams(window.location.search);
    const forceClearCache = urlParams.has('ab_clear_cache');
    
    // Clear all AB Optimizer assignments if the special query param is present
    if (forceClearCache) {
      console.log('[AB Optimizer] Force clearing all cached assignments due to ab_clear_cache parameter');
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('ab_optimizer_assignment')) {
            console.log(`[AB Optimizer] Clearing: ${key}`);
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('[AB Optimizer] Error clearing cached assignments:', e);
      }
    }
    
    // Try to load the experiments from the server via JSONP (to avoid CORS)
    try {
      const jsonpCallback = 'abOptimizerCallback' + Math.floor(Math.random() * 1000000);
      const timestamp = new Date().getTime();
      const noCache = forceClearCache ? '&noCache=true' : '';
      
      // Define the callback function
      window[jsonpCallback] = function(response) {
        console.log(`[AB Optimizer] Loaded active experiments via JSONP:`, response);
        
        // Check for errors
        if (response.error) {
          console.error(`[AB Optimizer] Error loading experiments: ${response.error}`);
          return;
        }
        
        // Log debug information if available
        if (response.debug) {
          console.log(`[AB Optimizer] Server debug info:`, response.debug);
          console.log(`[AB Optimizer] Request timestamp: ${response.debug.requestTimestamp}, Server timestamp: ${response.debug.serverTimestamp}`);
          console.log(`[AB Optimizer] Total variations: ${response.debug.totalVariationsQueried}, Active variations: ${response.debug.activeVariationsFiltered}`);
        }
        
        // Get the variations from the response, handle both formats for backward compatibility
        const variations = Array.isArray(response) ? response : (response.variations || []);
        
        // Process the variations - apply one based on traffic allocation
        if (variations.length > 0) {
          // Ensure 100% traffic allocations are properly handled as numbers
          variations.forEach(v => {
            if (v.trafficAllocation !== undefined) {
              v.trafficAllocation = Number(v.trafficAllocation);
              console.log(`[AB Optimizer] Variation ${v.id} has ${v.trafficAllocation}% traffic allocation`);
            }
          });
          
          // First check for any 100% traffic allocation variations
          const full100PctVariation = variations.find(v => v.trafficAllocation === 100);
          
          if (full100PctVariation) {
            console.log(`[AB Optimizer] Found variation with 100% traffic allocation (ID: ${full100PctVariation.id})`);
            
            // Apply the 100% variation directly, skipping regular selection algorithm
            trackEvent(full100PctVariation.id, 'impression');
            applyVariationContent(full100PctVariation.content);
            console.log(`[AB Optimizer] Applied 100% variation #${full100PctVariation.id} (${full100PctVariation.name})`);
          } else {
            // Normal selection via weighted algorithm  
            const variation = selectExperimentByTraffic(variations);
            
            if (variation) {
              // Apply variation content directly
              trackEvent(variation.id, 'impression');
              applyVariationContent(variation.content);
              console.log(`[AB Optimizer] Applied variation #${variation.id} (${variation.name}) with ${variation.trafficAllocation}% traffic`);
            } else {
              console.log('[AB Optimizer] No variation selected from traffic allocation');
            }
          }
        } else {
          console.log('[AB Optimizer] No active variations for this website');
        }
        
        // Clean up the script tag and global callback
        document.body.removeChild(scriptTag);
        delete window[jsonpCallback];
      };
      
      // Create the script tag for JSONP
      const scriptTag = document.createElement('script');
      // Add random value to prevent caching issues
      const randomValue = Math.random().toString(36).substring(2, 15);
      scriptTag.src = `${appUrl}/api/experiments/${WEBSITE_ID}/active/jsonp?callback=${jsonpCallback}&t=${timestamp}&r=${randomValue}${noCache}`;
      
      // Add additional attributes to prevent caching
      scriptTag.setAttribute('crossorigin', 'anonymous');
      
      scriptTag.onerror = function() {
        console.error("[AB Optimizer] JSONP request failed, falling back to fetch API");
        loadExperimentsLegacy();
      };
      
      document.body.appendChild(scriptTag);
    } catch (error) {
      console.error("[AB Optimizer] Error with JSONP: ", error);
      loadExperimentsLegacy();
    }
  }
  
  // Legacy function to load experiments with fetch API
  function loadExperimentsLegacy() {
    console.log('[AB Optimizer] Using legacy API fallback to load active experiments');
    
    // API endpoint to get active experiments
    const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
    
    // Check for cache clearing parameter
    const urlParams = new URLSearchParams(window.location.search);
    const forceClearCache = urlParams.has('ab_clear_cache');
    const timestamp = new Date().getTime();
    const randomValue = Math.floor(Math.random() * 1000000); // Add random value for better cache busting
    const noCache = forceClearCache ? `&noCache=true` : '';
    
    // Try to load the experiments from the server
    fetch(`${appUrl}/api/experiments/${WEBSITE_ID}/active?t=${timestamp}&r=${randomValue}${noCache}`, {
      method: 'GET',
      mode: 'cors'
    })
      .then(response => {
        // Check if response is OK
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        
        return response.json();
      })
      .then(response => {
        console.log(`[AB Optimizer] Loaded active experiments:`, response);
        
        // Check for error at the top level
        if (response.error) {
          console.error(`[AB Optimizer] Error loading experiments: ${response.error}`);
          return;
        }
        
        // Log debug information if available
        if (response.debug) {
          console.log(`[AB Optimizer] Server debug info:`, response.debug);
        }
        
        // Get the variations from the response, handle both formats for backward compatibility
        const variations = Array.isArray(response) ? response : (response.variations || []);
        
        // Process the variations - apply one based on traffic allocation
        if (variations.length > 0) {
          // Ensure 100% traffic allocations are properly handled as numbers
          variations.forEach(v => {
            if (v.trafficAllocation !== undefined) {
              v.trafficAllocation = Number(v.trafficAllocation);
              console.log(`[AB Optimizer] Variation ${v.id} has ${v.trafficAllocation}% traffic allocation`);
            }
          });
          
          // First check for any 100% traffic allocation variations
          const full100PctVariation = variations.find(v => v.trafficAllocation === 100);
          
          if (full100PctVariation) {
            console.log(`[AB Optimizer] Found variation with 100% traffic allocation (ID: ${full100PctVariation.id})`);
            
            // Apply the 100% variation directly, skipping regular selection algorithm
            trackEvent(full100PctVariation.id, 'impression');
            applyVariationContent(full100PctVariation.content);
            console.log(`[AB Optimizer] Applied 100% variation #${full100PctVariation.id} (${full100PctVariation.name})`);
          } else {
            // Normal selection via weighted algorithm  
            const variation = selectExperimentByTraffic(variations);
            
            if (variation) {
              // Apply variation content directly
              trackEvent(variation.id, 'impression');
              applyVariationContent(variation.content);
              console.log(`[AB Optimizer] Applied variation #${variation.id} (${variation.name}) with ${variation.trafficAllocation}% traffic`);
            } else {
              console.log('[AB Optimizer] No variation selected from traffic allocation');
            }
          }
        } else {
          console.log('[AB Optimizer] No active variations for this website');
        }
      })
      .catch(error => {
        console.error("[AB Optimizer] Error loading experiments:", error);
      });
  }
  
  // Helper function to select an experiment based on traffic allocation
  function selectExperimentByTraffic(experiments) {
    console.log('[AB Optimizer - DEBUG] Starting traffic allocation with:', experiments);
    
    // Ensure all trafficAllocation values are numbers
    experiments.forEach(exp => {
      if (exp.trafficAllocation !== undefined) {
        exp.trafficAllocation = Number(exp.trafficAllocation);
      }
    });
    
    // First check if we're forcing a specific variation via URL parameter
    // This takes precedence over everything else
    const urlParams = new URLSearchParams(window.location.search);
    const expParam = Array.from(urlParams.keys()).find(key => key.startsWith('exp_'));
    
    if (expParam) {
      const forcedVariationId = expParam.replace('exp_', '');
      const forcedVariation = experiments.find(exp => exp.id == forcedVariationId);
      
      if (forcedVariation) {
        console.log(`[AB Optimizer] Using forced variation #${forcedVariationId} from URL parameter`);
        return forcedVariation;
      } else {
        console.warn(`[AB Optimizer] Forced variation #${forcedVariationId} not found`);
      }
    }
    
    // If no variations available, return null
    if (!experiments || experiments.length === 0) {
      console.log('[AB Optimizer] No experiments available');
      return null;
    }
    
    // Check if this visitor has already been assigned to a specific variation
    // We'll use localStorage to persist this assignment across page visits
    const websiteId = WEBSITE_ID || '1';
    const currentPath = window.location.pathname;
    
    // Check if we have 100% allocation to a single variation
    // We need to ensure the trafficAllocation is parsed as a number (it might be a string)
    const singleVariation100Pct = experiments.length === 1 && 
                                 (Number(experiments[0].trafficAllocation) === 100);
    
    console.log(`[AB Optimizer - DEBUG] Single variation with 100% check:`, 
                {length: experiments.length, 
                 trafficValue: experiments[0]?.trafficAllocation,
                 trafficValueAsNumber: Number(experiments[0]?.trafficAllocation),
                 is100Percent: singleVariation100Pct});
    
    // Include more specific data in the key so assignments refresh when allocations change
    // This forces re-assignment when traffic allocations change significantly
    const storageKey = `ab_optimizer_assignment_v3_${websiteId}_${currentPath}_${singleVariation100Pct ? experiments[0].id : 'multi'}`;
    
    // If we detect a 100% traffic allocation, clear any old cached assignments
    // This ensures a clean state when admin specifically sets a variation to 100%
    if (singleVariation100Pct) {
      try {
        // Look for any keys that match the pattern but might be using older versions
        // This ensures old cache versions don't interfere with new assignments
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes(`ab_optimizer_assignment_`) && 
              key.includes(`_${websiteId}_`) &&
              key.includes(`_${currentPath}_`) &&
              key !== storageKey) {
            console.log(`[AB Optimizer] Clearing outdated assignment: ${key}`);
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('[AB Optimizer] Error clearing old assignments:', e);
      }
    }
    
    // Try to get existing assignment if available
    try {
      const existingAssignment = localStorage.getItem(storageKey);
      if (existingAssignment) {
        const assignmentData = JSON.parse(existingAssignment);
        
        // Make sure assignment isn't expired (default: 30 days)
        const now = new Date().getTime();
        if (now < assignmentData.expiresAt) {
          // Special handling for 100% allocation assignments - use them if they exist
          // This helps ensure consistency with 100% allocation changes
          if (assignmentData.is100Percent === true && singleVariation100Pct) {
            console.log(`[AB Optimizer] Using 100% allocation stored assignment for variation #${assignmentData.experimentId}`);
            // Find the assigned experiment/variation
            const assignedExperiment = experiments.find(exp => exp.id === assignmentData.experimentId);
            if (assignedExperiment) {
              return assignedExperiment;
            }
          }
          
          // For normal assignments, proceed with regular lookup
          const assignedExperiment = experiments.find(exp => exp.id === assignmentData.experimentId);
          if (assignedExperiment) {
            console.log(`[AB Optimizer] Using stored assignment: variation #${assignmentData.experimentId}`);
            return assignedExperiment;
          }
        } else {
          console.log(`[AB Optimizer] Assignment expired, will create new assignment`);
        }
      }
    } catch (e) {
      console.warn('[AB Optimizer] Error reading stored assignment:', e);
      // Continue with normal selection if there's any error
    }
    
    // Special case: If there's only one experiment with 100% traffic allocation, select it directly
    // This guarantees it will always be chosen regardless of random values
    if (singleVariation100Pct) {
      console.log(`[AB Optimizer] Using single variation with 100% traffic allocation: variation #${experiments[0].id}`);
      
      // Create a more persistent assignment with a special marking for 100% case
      try {
        const expiresAt = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
        const assignmentData = {
          experimentId: experiments[0].id,
          assignedAt: new Date().getTime(),
          expiresAt: expiresAt,
          is100Percent: true
        };
        
        localStorage.setItem(storageKey, JSON.stringify(assignmentData));
        console.log(`[AB Optimizer] Stored 100% assignment for variation #${experiments[0].id}`);
      } catch (e) {
        console.warn('[AB Optimizer] Error saving 100% assignment:', e);
      }
      
      return experiments[0];
    }
    
    // Generate a random decimal number between 0 and 100 for more precise distribution
    const random = Math.random() * 100;
    
    // Calculate total allocated traffic across all variations
    const totalAllocated = experiments.reduce((sum, variation) => {
      return sum + (Number(variation.trafficAllocation) || 0);
    }, 0);
    
    // Calculate remaining traffic for default page (original content)
    const defaultTraffic = Math.max(0, 100 - totalAllocated);
    
    console.log(`[AB Optimizer] Traffic allocation: variations=${totalAllocated.toFixed(1)}%, default=${defaultTraffic.toFixed(1)}%`);
    console.log(`[AB Optimizer] Random value for selection: ${random.toFixed(2)}`);
    
    // If total is 0, no allocations set, return null to show default page
    if (totalAllocated === 0) {
      console.log('[AB Optimizer] No traffic allocated to variations, showing default page');
      return null;
    }
    
    // If random number is less than or equal to default traffic, show default page
    if (random <= defaultTraffic) {
      console.log(`[AB Optimizer] Random value (${random.toFixed(2)}) is within default page allocation (${defaultTraffic.toFixed(1)}%)`);
      
      // Store default page assignment to keep visitor experience consistent
      try {
        const expiresAt = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
        const assignmentData = {
          experimentId: 'default',
          assignedAt: new Date().getTime(),
          expiresAt: expiresAt
        };
        localStorage.setItem(storageKey, JSON.stringify(assignmentData));
      } catch (e) {
        console.warn('[AB Optimizer] Error saving default assignment:', e);
      }
      
      return null;
    }
    
    // The selectExperimentByTraffic logic is revised to fix traffic allocation issues
    // Since we already handled the default case above (random <= defaultTraffic),
    // we're now only concerned with the non-default range (random > defaultTraffic)
    // We need to recalculate within the allocated traffic percent (100% - defaultTraffic)
    let selectedExperiment = null;
    
    // Calculate a new random value that only exists within the allocated traffic portion
    // This makes our random value effectively a percentage within the variation allocations
    const adjustedRandom = ((random - defaultTraffic) / totalAllocated) * 100;
    console.log(`[AB Optimizer] Adjusted random value for variation selection: ${adjustedRandom.toFixed(2)}`);
    
    let cumulativeTraffic = 0;
    
    for (const variation of experiments) {
      const variationTraffic = Number(variation.trafficAllocation) || 0;
      
      // Skip variations with no traffic allocation
      if (variationTraffic <= 0) continue;
      
      // Calculate what percentage of the total allocated traffic this variation gets
      const normalizedTraffic = (variationTraffic / totalAllocated) * 100;
      cumulativeTraffic += normalizedTraffic;
      
      if (adjustedRandom <= cumulativeTraffic) {
        console.log(`[AB Optimizer] Selected variation #${variation.id} (${variationTraffic}% of total, ${normalizedTraffic.toFixed(1)}% of allocated traffic)`);
        selectedExperiment = variation;
        break;
      }
    }
    
    // Store the assignment in localStorage for consistency
    if (selectedExperiment) {
      try {
        // Assignment expires in 30 days
        const expiresAt = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
        const assignmentData = {
          experimentId: selectedExperiment.id,
          assignedAt: new Date().getTime(),
          expiresAt: expiresAt
        };
        
        localStorage.setItem(storageKey, JSON.stringify(assignmentData));
      } catch (e) {
        console.warn('[AB Optimizer] Error saving assignment:', e);
        // Non-fatal, we can continue without saving the assignment
      }
    } else {
      console.warn('[AB Optimizer] No variation selected, this should not happen with proper math');
    }
    
    // Return the selected experiment, or first one as fallback if all else fails
    return selectedExperiment || (experiments.length > 0 ? experiments[0] : null);
  }
  
  // Apply content changes from a variation directly
  function applyVariationContent(content) {
    console.log('[AB Optimizer] Applying variation content:', content);
    
    if (!content) {
      console.warn('[AB Optimizer] No content provided to apply');
      return;
    }
    
    // Special case for direct format (spans, etc.)
    if (typeof content === 'object' && !content.texts && !content.sections) {
      // This is likely in our new direct format where the keys are element IDs
      // Convert it to the expected format with texts {}
      const restructuredContent = { texts: {} };
      
      Object.entries(content).forEach(([elementId, newText]) => {
        console.log(`[AB Optimizer] Processing direct element: ${elementId} = ${newText}`);
        
        // Look for the element with matching ID or data attribute
        let element = document.getElementById(elementId);
        
        // Try data attributes if ID not found
        if (!element) {
          const dataElements = document.querySelectorAll(`[data-ab="${elementId}"], [data-id="${elementId}"], [data-ab-auto="${elementId}"]`);
          if (dataElements.length > 0) {
            element = dataElements[0];
          }
        }
        
        if (element) {
          console.log(`[AB Optimizer] Updated text for '${elementId}': '${newText}'`);
          element.innerText = newText;
        } else {
          console.warn(`[AB Optimizer] Could not find element with ID or data attribute: ${elementId}`);
        }
      });
      
      return; // Exit early after processing direct format
    }
    
    // Apply text and media changes
    if (content.texts) {
      // Check for special hero heading first and prioritize it
      if (content.texts['text-hero-heading']) {
        try {
          console.log(`[AB Optimizer] Prioritizing hero heading update`);
          const heroHeadingText = content.texts['text-hero-heading'];
          
          // Find hero heading using multiple strategies
          let heroElement = document.querySelector('[data-hero-heading="true"], [data-ab="text-hero-heading"]');
          
          if (!heroElement) {
            // Try common hero heading classes
            heroElement = document.querySelector('h1.hero-heading, h1.landing-page-hero-title, h1.hero-title');
          }
          
          if (!heroElement) {
            // Look in hero sections
            const heroSection = document.querySelector('.hero, .hero-section, [class*="hero"], [id*="hero"]');
            if (heroSection) {
              const heading = heroSection.querySelector('h1, h2');
              if (heading) heroElement = heading;
            }
          }
          
          if (!heroElement) {
            // Last resort - first h1 on page
            heroElement = document.querySelector('h1');
          }
          
          if (heroElement) {
            console.log(`[AB Optimizer] Found hero heading element:`, heroElement);
            heroElement.innerHTML = heroHeadingText;
            heroElement.setAttribute('data-ab', 'text-hero-heading');
            heroElement.setAttribute('data-hero-heading', 'true');
            console.log(`[AB Optimizer] Updated hero heading with text: "${heroHeadingText}"`);
          } else {
            console.warn(`[AB Optimizer] Could not find hero heading element to update`);
          }
        } catch (error) {
          console.error(`[AB Optimizer] Error updating hero heading:`, error);
        }
      }
      
      // Process all other text changes
      Object.entries(content.texts).forEach(([selector, textData]) => {
        // Skip the hero heading as we've already handled it specially
        if (selector === 'text-hero-heading') return;
        
        try {
          // Get the element by its CSS selector
          // First, try the exact selector
          let elements = document.querySelectorAll(selector);
          
          // Special case for the text-hero-heading
          if (elements.length === 0 && selector === 'text-hero-heading') {
            console.log(`[AB Optimizer] Detected text-hero-heading identifier, looking for main heading`);
            // Try to find the main heading element - common patterns for hero headings
            elements = document.querySelectorAll('h1.hero-heading, h1.landing-page-hero-title, h1.hero-title, h1.hero_heading, h1.main-heading, h1');
            
            if (elements.length === 0) {
              // If still not found, look for any prominent h1 in the hero section
              const heroSections = document.querySelectorAll('.hero, .hero-section, [class*="hero"], [id*="hero"]');
              if (heroSections.length > 0) {
                heroSections.forEach(section => {
                  const headings = section.querySelectorAll('h1, h2');
                  if (headings.length > 0 && elements.length === 0) {
                    elements = headings;
                  }
                });
              }
              
              // Last resort: find the first h1 on the page
              if (elements.length === 0) {
                elements = document.querySelectorAll('h1');
              }
            }
          }
          // Other heading selectors that use CSS path
          else if (elements.length === 0 && (selector.includes('h1') || selector.includes('h2') || selector.includes('h3') || 
              selector.includes('h4') || selector.includes('h5') || selector.includes('h6'))) {
            console.log(`[AB Optimizer] Heading selector not found, trying data-ab attribute: ${selector}`);
            
            // Try finding by data-ab attribute
            const selectorId = selector.replace(/[#.]/g, '').trim();
            elements = document.querySelectorAll(`[data-ab="${selectorId}"]`);
            
            // If still not found, try by innerText matching
            if (elements.length === 0 && typeof textData === 'string') {
              console.log(`[AB Optimizer] Trying to find heading by innerText similarity`);
              
              // Get all headings
              const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
              
              // Find the first heading that matches within a reasonable distance
              const headingElements = Array.from(allHeadings).filter(heading => {
                // Skip elements that already have data-ab attributes
                if (heading.hasAttribute('data-ab')) return false;
                
                // Check if content is relatively similar
                const similar = heading.innerText.trim() !== "" && 
                               (heading.innerText.includes(textData.substring(0, 10)) || 
                                textData.includes(heading.innerText.substring(0, 10)));
                
                if (similar) {
                  console.log(`[AB Optimizer] Found potential heading match: ${heading.innerText}`);
                  // Mark this element for future reference
                  heading.setAttribute('data-ab', selectorId);
                }
                return similar;
              });
              
              if (headingElements.length > 0) {
                elements = headingElements;
              }
            }
          }
          
          if (elements.length > 0) {
            elements.forEach(el => {
              // Check if this is a special media type
              if (typeof textData === 'object' && textData !== null && textData.type) {
                // Handle different element types
                switch (textData.type) {
                  case 'image':
                    if (el.tagName.toLowerCase() === 'img') {
                      // Store original source if not already stored
                      if (!el.hasAttribute('data-original-src')) {
                        el.setAttribute('data-original-src', el.src);
                      }
                      
                      // Update image source
                      if (textData.src) {
                        el.src = textData.src;
                      }
                      
                      // Update alt text if provided
                      if (textData.alt) {
                        el.alt = textData.alt;
                      }
                      
                      // Handle visibility with design mode consideration
                      if (textData.visible === false) {
                        if (window.abOptimizerDesignMode === true) {
                          // In design mode, fade elements but don't hide completely
                          el.style.display = '';
                          el.style.opacity = '0.3';
                          el.style.outline = '1px dotted #ef4444';
                        } else {
                          // Normal visibility handling - hide completely in regular view
                          el.style.display = 'none';
                          el.style.opacity = '0';
                        }
                      } else {
                        // Show element normally
                        el.style.display = '';
                        el.style.opacity = '1';
                        el.style.outline = '';
                      }
                      
                      console.log(`[AB Optimizer] Updated image for "${selector}" with src: "${textData.src}"`);
                    }
                    break;
                    
                  case 'video':
                    // Find video element (could be the element itself or a child)
                    const videoEl = el.tagName.toLowerCase() === 'video' ? el : el.querySelector('video');
                    if (videoEl) {
                      // Store original source if not already stored
                      if (!videoEl.hasAttribute('data-original-src')) {
                        videoEl.setAttribute('data-original-src', videoEl.src);
                      }
                      
                      // Update video source
                      if (textData.src) {
                        videoEl.src = textData.src;
                        
                        // Update any source elements
                        videoEl.querySelectorAll('source').forEach(source => {
                          source.src = textData.src;
                        });
                        
                        // Reload the video
                        videoEl.load();
                      }
                      
                      // Handle visibility with design mode consideration
                      if (textData.visible === false) {
                        if (window.abOptimizerDesignMode === true) {
                          // In design mode, fade elements but don't hide completely
                          el.style.display = '';
                          el.style.opacity = '0.3';
                          el.style.outline = '1px dotted #ef4444';
                        } else {
                          // Normal visibility handling - hide completely in regular view
                          el.style.display = 'none';
                          el.style.opacity = '0';
                        }
                      } else {
                        // Show element normally
                        el.style.display = '';
                        el.style.opacity = '1';
                        el.style.outline = '';
                      }
                      
                      console.log(`[AB Optimizer] Updated video for "${selector}" with src: "${textData.src}"`);
                    }
                    break;
                    
                  case 'iframe':
                    // Find iframe element (could be the element itself or a child)
                    const iframeEl = el.tagName.toLowerCase() === 'iframe' ? el : el.querySelector('iframe');
                    if (iframeEl) {
                      // Store original source if not already stored
                      if (!iframeEl.hasAttribute('data-original-src')) {
                        iframeEl.setAttribute('data-original-src', iframeEl.src);
                      }
                      
                      // Update iframe source
                      if (textData.src) {
                        iframeEl.src = textData.src;
                      }
                      
                      // Handle visibility with design mode consideration
                      if (textData.visible === false) {
                        if (window.abOptimizerDesignMode === true) {
                          // In design mode, fade elements but don't hide completely
                          el.style.display = '';
                          el.style.opacity = '0.3';
                          el.style.outline = '1px dotted #ef4444';
                        } else {
                          // Normal visibility handling - hide completely in regular view
                          el.style.display = 'none';
                          el.style.opacity = '0';
                        }
                      } else {
                        // Show element normally
                        el.style.display = '';
                        el.style.opacity = '1';
                        el.style.outline = '';
                      }
                      
                      console.log(`[AB Optimizer] Updated iframe for "${selector}" with src: "${textData.src}"`);
                    }
                    break;
                    
                  default:
                    // For unknown types, just use text content
                    const newText = textData.content || textData.text || '';
                    el.innerHTML = newText;
                    console.log(`[AB Optimizer] Updated text for "${selector}" with unknown type: "${newText}"`);
                }
              } else {
                // Handle standard text format: direct string or object with content/text property
                const newText = typeof textData === 'string' ? textData : 
                                (textData.content || textData.text || '');
                
                // Check if the element is a heading
                const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName.toUpperCase());
                
                // Check if the element is a button or link
                const isButtonOrLink = 
                  el.tagName.toLowerCase() === 'button' || 
                  el.tagName.toLowerCase() === 'a' ||
                  el.classList.contains('button') ||
                  el.classList.contains('btn') ||
                  el.classList.contains('w-button');
                
                if (isHeading) {
                  // For headings, we want to be extra careful to ensure the content is updated
                  el.innerHTML = newText;
                  console.log(`[AB Optimizer] Updated heading element with innerHTML: "${newText}"`);
                  
                  // Store additional data to help with future matching
                  el.setAttribute('data-ab-heading-updated', 'true');
                  
                  // Special handling for hero heading with text-hero-heading identifier
                  if (selector === 'text-hero-heading') {
                    // Mark this element as the hero heading for easier identification
                    el.setAttribute('data-ab', 'text-hero-heading');
                    el.setAttribute('data-hero-heading', 'true');
                    console.log(`[AB Optimizer] Marked element as hero heading with text-hero-heading identifier`);
                  } else {
                    // Save the selector for easier matching in future
                    el.setAttribute('data-ab', selector);
                  }
                }
                else if (isButtonOrLink) {
                  // For buttons, we need to preserve any existing child elements
                  // that aren't text nodes (like icons)
                  const nonTextNodes = Array.from(el.childNodes).filter(node => 
                    node.nodeType !== Node.TEXT_NODE && 
                    node.nodeType !== Node.COMMENT_NODE
                  );
                  
                  // Clear the element
                  el.innerHTML = '';
                  
                  // Add the new text
                  el.appendChild(document.createTextNode(newText));
                  
                  // Re-add any non-text nodes (like icons)
                  nonTextNodes.forEach(node => el.appendChild(node));
                  
                  console.log(`[AB Optimizer] Updated button/link element with innerHTML approach: "${newText}"`);
                } else {
                  // Use innerHTML for regular elements
                  el.innerHTML = newText; // Use innerHTML instead of innerText to support HTML formatting
                  console.log(`[AB Optimizer] Updated text for "${selector}": "${newText}"`);
                }
              }
            });
          } else {
            console.warn(`[AB Optimizer] No elements found for selector: ${selector}`);
          }
        } catch (error) {
          console.error(`[AB Optimizer] Error applying content change to ${selector}:`, error);
        }
      });
    }
    
    // Apply visibility changes
    if (content.sections) {
      Object.entries(content.sections).forEach(([selector, sectionData]) => {
        try {
          // Get the element by its CSS selector
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              // Handle both formats: boolean or object with visible property
              const isVisible = typeof sectionData === 'boolean' ? sectionData : 
                               (sectionData.visible === true);
                               
              // Store original display state if not already stored
              if (!el.hasAttribute('data-original-display')) {
                const computedDisplay = window.getComputedStyle(el).display;
                el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
              }
              
              // Store original position if not already stored
              if (!el.hasAttribute('data-original-position')) {
                const computedPosition = window.getComputedStyle(el).position;
                el.setAttribute('data-original-position', computedPosition);
              }
              
              // Add a data attribute to track visibility state for easy inspection
              el.setAttribute('data-ab-visibility', isVisible ? 'visible' : 'hidden');
              
              // Check if we're in design mode
              const isDesignMode = new URLSearchParams(window.location.search).has('design');
              const isExpMode = new URLSearchParams(window.location.search).has('exp_');
              const shouldKeepSelectable = isDesignMode || window.abOptimizerDesignMode === true;
              
              // Apply visibility change
              if (isVisible) {
                // Restore to original display value or use a sensible default
                const originalDisplay = el.getAttribute('data-original-display') || '';
                el.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
                el.style.opacity = '1';
                el.style.transition = 'opacity 0.3s ease';
                el.style.pointerEvents = 'auto'; // Enable interaction
                
                // If in design mode, add a visual indicator
                if (isDesignMode) {
                  el.style.outline = '1px dotted #22c55e';
                  el.style.outlineOffset = '1px';
                }
              } else {
                // Apply different styles based on mode
                if (shouldKeepSelectable) {
                  // DESIGN MODE: fade the element but keep it visible and selectable
                  el.style.opacity = '0.3';
                  el.style.transition = 'opacity 0.3s ease';
                  el.style.pointerEvents = 'auto'; // Keep interactive in design mode
                  
                  // Keep the original display to maintain the DOM structure
                  const originalDisplay = el.getAttribute('data-original-display') || '';
                  if (originalDisplay === 'none') {
                    el.style.display = 'block'; // Force display if it was none
                  } else {
                    el.style.display = originalDisplay;
                  }
                  
                  // Add visual indicator for hidden elements
                  el.style.outline = '1px dotted #ef4444';
                  el.style.outlineOffset = '1px';
                  console.log(`[AB Optimizer] Design mode: Fading element but keeping visible: ${selector}`);
                } else {
                  // EXPERIMENT MODE: fade the element but don't completely hide it
                  el.style.opacity = '0.3'; // Fade instead of hiding
                  el.style.transition = 'opacity 0.3s ease';
                  
                  // Keep the original display to maintain the DOM structure
                  const originalDisplay = el.getAttribute('data-original-display') || '';
                  el.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
                  
                  // Still prevent interactions with faded elements
                  el.style.pointerEvents = 'none';
                  console.log(`[AB Optimizer] Experiment mode: Fading element: ${selector}`);
                }
              }
              
              console.log(`[AB Optimizer] ${isVisible ? 'Showing' : 'Hiding'} element: ${selector} (opacity: ${isVisible ? '1' : '0.3'})`);
            });
          } else {
            console.warn(`[AB Optimizer] No elements found for selector: ${selector}`);
          }
        } catch (error) {
          console.error(`[AB Optimizer] Error applying visibility change to ${selector}:`, error);
        }
      });
    }
  }

  // Helper function to apply experiment changes to the page
  function applyExperimentChanges(experiment, expId) {
    console.log('[AB Optimizer] Attempting to apply experiment/variation changes:', experiment);
    
    if (!experiment || experiment.error) {
      console.error('[AB Optimizer] Error in experiment data:', experiment?.error || 'No data received');
      return;
    }
    
    // Set a flag to prevent double-application of experiment
    if (window.abOptimizerApplied) {
      console.log('[AB Optimizer] Experiment already applied, skipping');
      return;
    }
    
    // Check if we're in design mode and set a global flag
    window.abOptimizerDesignMode = new URLSearchParams(window.location.search).has('design');
    console.log(`[AB Optimizer] Design mode: ${window.abOptimizerDesignMode ? 'enabled' : 'disabled'}`);
    
    // IMPORTANT: First check if this is a direct variation object that contains content
    // This handles the case of variations returned directly from the server with 100% allocation
    if (experiment.content) {
      console.log('[AB Optimizer] Direct variation with content detected, applying immediately');
      // Mark as applied before doing anything else
      window.abOptimizerApplied = true;
      // Apply the content directly from the variation object
      applyVariationContent(experiment.content);
      console.log('[AB Optimizer] Applied variation content directly');
      return; // Exit after applying the content
    }
    
    // For legacy experiments, continue with the old logic
    window.abOptimizerApplied = true;
    
    if (experiment.status !== 'active' && !experiment.content) {
      console.log('[AB Optimizer] Experiment is not active');
      return;
    }
    
    // Check if this is a new format experiment with traffic settings and variation references
    if (experiment.trafficSettings && Object.keys(experiment.trafficSettings).length > 0) {
      // First, check if we have a previously assigned variation in localStorage
      const websiteId = WEBSITE_ID || '1';
      const currentPath = window.location.pathname;
      const storageKey = `ab_optimizer_variation_${websiteId}_${expId}_${currentPath}`;
      
      let variationId = null;
      let isNewAssignment = true;
      
      // Try to retrieve existing assignment
      try {
        const storedAssignment = localStorage.getItem(storageKey);
        if (storedAssignment) {
          const assignmentData = JSON.parse(storedAssignment);
          
          // Check if assignment is still valid (not expired)
          const now = new Date().getTime();
          if (now < assignmentData.expiresAt) {
            variationId = assignmentData.variationId;
            isNewAssignment = false;
            console.log(`[AB Optimizer] Using stored variation assignment: ${variationId}`);
          }
        }
      } catch (e) {
        console.warn('[AB Optimizer] Error reading stored variation assignment:', e);
      }
      
      // If no stored assignment, select a variation based on traffic allocation
      if (!variationId) {
        const variationIds = Object.keys(experiment.trafficSettings);
        if (variationIds.length === 0) {
          console.warn('[AB Optimizer] No variations found in experiment');
          return;
        }
        
        // Generate a random number between 0 and 100
        const random = Math.floor(Math.random() * 100);
        let cumulativeTraffic = 0;
        
        // Calculate total traffic allocation
        const totalTraffic = variationIds.reduce((sum, id) => {
          return sum + (experiment.trafficSettings[id] || 0);
        }, 0);
        
        // Special case: if total is 0, show default page (no variation)
        if (totalTraffic === 0) {
          console.log('[AB Optimizer] No traffic allocated, showing default page');
          return;
        }
        
        // If random number is beyond total allocation, show default page
        if (random > totalTraffic) {
          console.log(`[AB Optimizer] Random (${random}) exceeds total allocation (${totalTraffic}), showing default page`);
          return;
        }
        
        // Iterate through variations to find which one to show
        for (const id of variationIds) {
          const allocation = experiment.trafficSettings[id] || 0;
          cumulativeTraffic += allocation;
          
          if (random <= cumulativeTraffic) {
            variationId = id;
            console.log(`[AB Optimizer] Selected variation ${id} (${allocation}% traffic)`);
            break;
          }
        }
        
        // Default to first variation if we somehow didn't find one
        if (!variationId && variationIds.length > 0) {
          variationId = variationIds[0];
          console.log(`[AB Optimizer] Falling back to first variation: ${variationId}`);
        }
        
        // Store the assignment in localStorage for consistency across visits
        try {
          // Assignment expires in 30 days (or keep as long as experiment is running)
          const expiresAt = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
          const assignmentData = {
            experimentId: expId,
            variationId: variationId,
            assignedAt: new Date().getTime(),
            expiresAt: expiresAt
          };
          
          localStorage.setItem(storageKey, JSON.stringify(assignmentData));
        } catch (e) {
          console.warn('[AB Optimizer] Error saving variation assignment:', e);
        }
      }
      
      // Load and apply the selected variation using our enhanced multi-fallback approach
      if (variationId) {
        // Load variation content with multiple fallback strategies
        const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
        const cacheBuster = Date.now();
        
        // Start with JSONP attempt for best browser compatibility
        const jsonpCallback = 'abOptimizerVarCallback' + Math.floor(Math.random() * 1000000);
        window[jsonpCallback] = function(variation) {
          console.log(`[AB Optimizer] Loaded variation for experiment via JSONP:`, variation);
          
          if (variation && variation.content) {
            // Apply variation content
            applyVariationContent(variation.content);
            
            // Track impression if this is a new assignment
            if (isNewAssignment) {
              trackEvent(variationId, 'impression');
            }
          } else {
            console.warn(`[AB Optimizer] Variation ${variationId} has no content or is invalid`);
          }
          
          // Clean up the script tag and global callback
          try {
            document.body.removeChild(scriptTag);
          } catch (e) {} 
          delete window[jsonpCallback];
        };
        
        const scriptTag = document.createElement('script');
        scriptTag.src = `${appUrl}/api/variations/${websiteId}/${variationId}/jsonp?callback=${jsonpCallback}&t=${cacheBuster}`;
        
        // Set up error handler for fallback
        scriptTag.onerror = function() {
          console.warn(`[AB Optimizer] JSONP request failed, trying fetch API as fallback...`);
          
          // Immediately clean up the failed JSONP attempt
          delete window[jsonpCallback];
          try {
            document.body.removeChild(scriptTag);
          } catch (e) {}
          
          // Attempt to fetch the variation directly
          fetch(`${appUrl}/api/variations/${websiteId}/${variationId}?t=${cacheBuster}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
          })
          .then(variation => {
            if (variation && variation.content) {
              // Apply the variation content
              applyVariationContent(variation.content);
              
              // Track an impression if this is a new assignment
              if (isNewAssignment) {
                trackEvent(variationId, 'impression');
              }
            } else {
              console.warn(`[AB Optimizer] Variation ${variationId} has no content`);
            }
          })
          .catch(error => {
            console.error(`[AB Optimizer] Failed to load variation ${variationId}:`, error);
          });
        };
        
        document.body.appendChild(scriptTag);
        return;
      }
    }
    
    // Legacy format - apply variations directly from experiment
    
    // Apply text changes
    if (experiment.variations && experiment.variations.texts) {
      Object.entries(experiment.variations.texts).forEach(([id, newText]) => {
        if (!newText) return; // Skip if no text provided
        
        console.log(`[AB Optimizer] Looking for elements with ID: ${id}`);
        
        // Look for elements with data-ab attribute
        let elements = document.querySelectorAll(`[data-ab="${id}"]`);
        
        // If none found, check for data-id attribute (for compatibility)
        if (elements.length === 0 && id.startsWith('text-')) {
          const txtId = 'txt-' + id.substring(5); // Convert "text-1" to "txt-1"
          elements = document.querySelectorAll(`[data-id="${txtId}"]`);
        }
        
        // If none found, try data-ab-auto attribute (from auto-detection)
        if (elements.length === 0) {
          elements = document.querySelectorAll(`[data-ab-auto="${id}"]`);
        }
        
        // If none found, try Webflow style attribute format (data-ab-text-*)
        if (elements.length === 0) {
          const webflowAttr = `data-ab-${id}`;
          elements = document.querySelectorAll(`[${webflowAttr}]`);
          console.log(`[AB Optimizer] Looking for Webflow format attribute: ${webflowAttr}, found: ${elements.length}`);
        }
        
        // If still none found, try again with auto-detection selectors
        if (elements.length === 0) {
          // Try to match heading elements if this is a heading variation
          if (id.includes('heading')) {
            const headings = document.querySelectorAll('h1, .hero-heading, .heading-large, .heading-jumbo');
            if (headings.length > 0) {
              elements = [headings[0]]; // Use the first heading
              console.log(`[AB Optimizer] Auto-matched heading for "${id}":`, elements[0]);
            }
          }
          // Try to match button elements if this is a button variation
          else if (id.includes('button')) {
            const buttons = document.querySelectorAll('.button, .btn, a.w-button');
            if (buttons.length > 0) {
              elements = [buttons[0]]; // Use the first button
              console.log(`[AB Optimizer] Auto-matched button for "${id}":`, elements[0]);
            }
          }
        }
        
        if (elements.length > 0) {
          console.log(`[AB Optimizer] Updating ${elements.length} elements with id "${id}" to: "${newText}"`);
          elements.forEach(el => {
            // Check if the element is a button or link
            const isButtonOrLink = 
              el.tagName.toLowerCase() === 'button' || 
              el.tagName.toLowerCase() === 'a' ||
              el.classList.contains('button') ||
              el.classList.contains('btn') ||
              el.classList.contains('w-button');
            
            // Use innerHTML for buttons/links to handle nested spans and formatting
            if (isButtonOrLink) {
              // For buttons, we need to preserve any existing child elements
              // that aren't text nodes (like icons)
              const nonTextNodes = Array.from(el.childNodes).filter(node => 
                node.nodeType !== Node.TEXT_NODE && 
                node.nodeType !== Node.COMMENT_NODE
              );
              
              // Clear the element
              el.innerHTML = '';
              
              // Add the new text
              el.appendChild(document.createTextNode(newText));
              
              // Re-add any non-text nodes (like icons)
              nonTextNodes.forEach(node => el.appendChild(node));
              
              console.log(`[AB Optimizer] Updated button/link element with innerHTML approach`);
            } else {
              // Use innerText for regular elements
              el.innerText = newText;
            }
          });
        } else {
          console.warn(`[AB Optimizer] No elements found for text variation "${id}"`);
        }
      });
    }
    
    // Apply visibility changes
    if (experiment.variations && experiment.variations.sections) {
      Object.entries(experiment.variations.sections).forEach(([id, visible]) => {
        // Look for elements with data-ab attribute
        let elements = document.querySelectorAll(`[data-ab="${id}"]`);
        
        // If none found, check for data-id attribute (for compatibility)
        if (elements.length === 0) {
          elements = document.querySelectorAll(`[data-id="${id}"]`);
        }
        
        // If none found, try data-ab-auto attribute (from auto-detection)
        if (elements.length === 0) {
          elements = document.querySelectorAll(`[data-ab-auto="${id}"]`);
        }
        
        // If still none found, try again with section selectors
        if (elements.length === 0 && id.includes('section')) {
          const sections = document.querySelectorAll('.section, .w-section, [class*="section"]');
          if (sections.length > 0) {
            // Use index from section ID if possible, otherwise first section
            const match = id.match(/section-(\d+)/);
            const index = match ? parseInt(match[1]) - 1 : 0;
            if (sections[index]) {
              elements = [sections[index]];
              console.log(`[AB Optimizer] Auto-matched section for "${id}":`, elements[0]);
            }
          }
        }
        
        if (elements.length > 0) {
          console.log(`[AB Optimizer] ${visible ? 'Showing' : 'Hiding'} ${elements.length} elements with id "${id}"`);
          elements.forEach(el => {
            // Store original display state if not already stored
            if (!el.hasAttribute('data-original-display')) {
              const computedDisplay = window.getComputedStyle(el).display;
              el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
            }
            
            // Mark visibility state in data attribute
            el.setAttribute('data-ab-visibility', visible ? 'visible' : 'hidden');
            
            // Check if we're in design mode
            const isDesignMode = new URLSearchParams(window.location.search).has('design');
            const isExpMode = new URLSearchParams(window.location.search).has('exp_');
            const shouldKeepSelectable = isDesignMode || window.abOptimizerDesignMode === true;
            
            // Apply visibility change based on mode
            if (visible) {
              // Restore to original display value or use a sensible default
              const originalDisplay = el.getAttribute('data-original-display') || '';
              el.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
              el.style.opacity = '1';
              el.style.visibility = 'visible';
              
              // If in design mode, add a visual indicator
              if (isDesignMode) {
                el.style.outline = '1px dotted #22c55e';
                el.style.outlineOffset = '1px';
              }
            } else {
              if (shouldKeepSelectable) {
                // DESIGN MODE: fade but keep visible and selectable
                el.style.opacity = '0.3';
                el.style.transition = 'opacity 0.3s ease';
                el.style.pointerEvents = 'auto'; // Keep interactive in design mode
                
                // Keep original display to maintain layout
                const originalDisplay = el.getAttribute('data-original-display') || '';
                if (originalDisplay === 'none') {
                  el.style.display = 'block'; // Force display if it was none
                } else {
                  el.style.display = originalDisplay;
                }
                
                // Add visual indicator for hidden elements
                el.style.outline = '1px dotted #ef4444';
                el.style.outlineOffset = '1px';
                console.log(`[AB Optimizer] Design mode: Fading element but keeping visible: ${id}`);
              } else {
                // EXPERIMENT MODE: completely hide the element
                el.style.display = 'none'; // Hide in experiment/preview mode
                el.style.visibility = 'hidden';
                console.log(`[AB Optimizer] Experiment mode: Completely hiding element: ${id}`);
              }
            }
          });
        } else {
          console.warn(`[AB Optimizer] No elements found for section variation "${id}"`);
        }
      });
    }
    
    // Track impression
    trackEvent(expId, 'impression');
  }
  
  // Function to track events
  function trackEvent(expId, eventType) {
    const data = {
      siteId: WEBSITE_ID,
      expId: expId,
      event: eventType,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[AB Optimizer] Tracking event: ${eventType} for experiment ${expId}`);
    
    // Create a JSONP request by adding a script tag to the page
    // This avoids CORS issues completely
    const jsonpCallback = 'abOptimizerCallback' + Math.floor(Math.random() * 1000000);
    window[jsonpCallback] = function(response) {
      console.log(`[AB Optimizer] Track event response:`, response);
      // Clean up the script tag and global callback
      delete window[jsonpCallback];
      document.body.removeChild(scriptTag);
    };
    
    const scriptTag = document.createElement('script');
    scriptTag.src = `${APP_URL}/api/track-jsonp?callback=${jsonpCallback}&data=${encodeURIComponent(JSON.stringify(data))}`;
    document.body.appendChild(scriptTag);
    
    // Also try the regular methods as backup
    try {
      // Use sendBeacon for better reliability, especially when page is unloading
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(`${APP_URL}/api/track`, blob);
      } else {
        // Fallback to fetch
        fetch(`${APP_URL}/api/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          mode: 'cors', // Changed from no-cors to cors
          credentials: 'omit',
          keepalive: true
        }).catch(err => console.error('Error tracking event:', err));
      }
    } catch (err) {
      console.log('[AB Optimizer] Error in backup tracking method:', err);
    }
  }
  
  // Function to load site variations
  async function loadSiteVariations(websiteId) {
    try {
      // Get the app URL
      const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
      
      // Try public endpoint first - specifically designed for non-authenticated access
      console.log(`[AB Optimizer] Fetching variations from public endpoint: ${appUrl}/api/public/variations/${websiteId}`);
      try {
        const publicResponse = await fetch(`${appUrl}/api/public/variations/${websiteId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (publicResponse.ok) {
          const variations = await publicResponse.json();
          console.log(`[AB Optimizer] Success! Found ${variations.length} variations from public endpoint`);
          return variations;
        }
      } catch (publicErr) {
        console.error(`[AB Optimizer] Public endpoint failed: ${publicErr}`);
      }
      
      // If public endpoint fails, try the authenticated endpoint
      console.log(`[AB Optimizer] Trying authenticated endpoint: ${appUrl}/api/variations/${websiteId}`);
      
      // Try with credentials & improved headers
      const response = await fetch(`${appUrl}/api/variations/${websiteId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`[AB Optimizer] Failed to load variations: ${response.status} ${response.statusText}`);
        
        // Finally try JSONP as last resort
        console.log("[AB Optimizer] Trying JSONP as final fallback");
        return await fetchPublicVariations(websiteId);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[AB Optimizer] Server did not return valid JSON for variations');
        
        // Try public endpoint as fallback
        console.log("[AB Optimizer] Trying public endpoint due to content type mismatch");
        return await fetchPublicVariations(websiteId);
      }
      
      const variations = await response.json();
      return variations;
    } catch (error) {
      console.error('[AB Optimizer] Error loading variations:', error);
      
      // Try public endpoint as fallback
      console.log("[AB Optimizer] Trying public endpoint due to fetch error");
      return await fetchPublicVariations(websiteId);
    }
  }
  
  // Fetch variations from public endpoint that doesn't require authentication
  async function fetchPublicVariations(websiteId) {
    try {
      // Get the app URL
      const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
      
      // Use timestamp for cache busting
      const timestamp = Date.now(); 
      
      // Array of strategies to try in order
      const fetchStrategies = [
        // 1. Try the public REST API endpoint first
        async () => {
          const response = await fetch(`${appUrl}/api/public/variations/${websiteId}?t=${timestamp}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          });
          
          if (!response.ok) {
            throw new Error(`Public REST endpoint failed: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data && data.variations) {
            return data.variations;
          } else if (Array.isArray(data)) {
            return data;
          } else {
            throw new Error('Invalid data format from public REST endpoint');
          }
        },
        
        // 2. Try the enhanced site-specific public JSONP endpoint 
        async () => {
          return new Promise((resolve) => {
            // Set a global callback function
            window.abOptimizerCallback = function(data) {
              delete window.abOptimizerCallback;
              
              if (data && data.variations) {
                resolve(data.variations);
              } else if (Array.isArray(data)) {
                resolve(data);
              } else {
                resolve([]);
              }
            };
            
            // Create and inject script tag for the enhanced endpoint
            const script = document.createElement('script');
            script.src = `${appUrl}/api/public/variations/site/${websiteId}/jsonp?callback=abOptimizerCallback&t=${timestamp}`;
            script.onerror = () => {
              delete window.abOptimizerCallback;
              resolve([]);
            };
            
            document.head.appendChild(script);
            
            // Set timeout to prevent hanging if callback never fires
            setTimeout(() => {
              if (window.abOptimizerCallback) {
                delete window.abOptimizerCallback;
                resolve([]);
              }
            }, 5000);
          });
        },
        
        // 3. Try the regular variations API endpoint as last resort
        async () => {
          const response = await fetch(`${appUrl}/api/variations/${websiteId}?t=${timestamp}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
          });
          
          if (!response.ok) {
            throw new Error(`Regular API endpoint failed: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          return data;
        }
      ];
      
      // Try each strategy in order
      for (const strategy of fetchStrategies) {
        try {
          const result = await strategy();
          return result;
        } catch (strategyError) {
          // Continue to next strategy silently
        }
      }
      
      // If all strategies failed, return empty array
      return [];
    } catch (error) {
      console.error("[AB Optimizer] Error fetching variations:", error);
      return [];
    }
  }
  
  // Initialize design mode if URL parameter is present
  async function initDesignMode() {
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
    let existingVariationId = null;
    if (urlParams.has('variation')) {
      existingVariationId = urlParams.get('variation');
      console.log(`[AB Optimizer] Editing existing variation ID: ${existingVariationId}`);
      
      try {
        // First try to find the variation in our loaded variations
        const existingVariation = variations.find(v => v.id == existingVariationId);
        
        if (existingVariation) {
          console.log(`[AB Optimizer] Loaded existing variation from cache: ${existingVariation.name}`);
          window.abOptimizerVariationName = existingVariation.name;
          
          // Initialize the selection objects based on existing content
          window.abOptimizerSelectedElements = {
            texts: {},
            sections: {}
          };
          
          window.abOptimizerElementSelectors = {
            texts: {},
            sections: {}
          };
          
          // Copy content from variation to our selected elements
          if (existingVariation.content) {
            // Handle text changes
            if (existingVariation.content.texts) {
              Object.entries(existingVariation.content.texts).forEach(([selector, textData]) => {
                // Determine the text value (handle both string and object formats)
                const textValue = typeof textData === 'string' ? textData : 
                                 (textData.content || textData.text || '');
                
                // Store in selected elements
                window.abOptimizerSelectedElements.texts[selector] = textValue;
                window.abOptimizerElementSelectors.texts[selector] = selector;
                
                // Add highlight to element to show it's selected
                try {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    elements.forEach(el => {
                      el.style.outline = '2px dashed #22c55e';
                      el.style.outlineOffset = '2px';
                      el.setAttribute('data-ab', selector);
                    });
                  }
                } catch (e) {
                  console.error(`[AB Optimizer] Error highlighting element ${selector}:`, e);
                }
              });
            }
            
            // Handle visibility changes
            if (existingVariation.content.sections) {
              Object.entries(existingVariation.content.sections).forEach(([selector, sectionData]) => {
                // Determine the visibility value (handle both boolean and object formats)
                const isVisible = typeof sectionData === 'boolean' ? sectionData : 
                                 (sectionData.visible === true);
                
                // Store in selected elements
                window.abOptimizerSelectedElements.sections[selector] = isVisible;
                window.abOptimizerElementSelectors.sections[selector] = selector;
                
                // Add highlight to element to show it's selected
                try {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    elements.forEach(el => {
                      el.style.outline = '2px dashed #22c55e';
                      el.style.outlineOffset = '2px';
                      el.style.opacity = isVisible ? '1' : '0.2';
                      el.setAttribute('data-ab', selector);
                    });
                  }
                } catch (e) {
                  console.error(`[AB Optimizer] Error highlighting element ${selector}:`, e);
                }
              });
            }
          }
          
          // Apply the content to show current state
          applyVariationContent(existingVariation.content);
          
          // Store the variation data for the editor
          window.abOptimizerExistingContent = existingVariation.content;
          
          // Store the variation ID for updating instead of creating
          window.abOptimizerExistingVariationId = existingVariationId;
          
          // Update the counter
          updateSelectedCount();
        } else {
          // If not found in our loaded variations, try to load it directly from API
          const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
          console.log(`[AB Optimizer] Fetching variation details from: ${appUrl}/api/variations/${websiteId}/${existingVariationId}`);
          
          try {
            const response = await fetch(`${appUrl}/api/variations/${websiteId}/${existingVariationId}`, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              throw new Error(`[AB Optimizer] Fetch error: ${response.status} ${response.statusText}`);
            }
            
            const variation = await response.json();
            
            if (variation) {
              console.log(`[AB Optimizer] Loaded existing variation from API: ${variation.name}`);
              window.abOptimizerVariationName = variation.name;
              
              // Initialize the selection objects based on existing content
              window.abOptimizerSelectedElements = {
                texts: {},
                sections: {}
              };
              
              window.abOptimizerElementSelectors = {
                texts: {},
                sections: {}
              };
              
              // Copy content from variation to our selected elements
              if (variation.content) {
                // Handle text changes
                if (variation.content.texts) {
                  Object.entries(variation.content.texts).forEach(([selector, textData]) => {
                    // Determine the text value (handle both string and object formats)
                    const textValue = typeof textData === 'string' ? textData : 
                                     (textData.content || textData.text || '');
                    
                    // Store in selected elements
                    window.abOptimizerSelectedElements.texts[selector] = textValue;
                    window.abOptimizerElementSelectors.texts[selector] = selector;
                    
                    // Add highlight to element to show it's selected
                    try {
                      const elements = document.querySelectorAll(selector);
                      if (elements.length > 0) {
                        elements.forEach(el => {
                          el.style.outline = '2px dashed #22c55e';
                          el.style.outlineOffset = '2px';
                          el.setAttribute('data-ab', selector);
                        });
                      }
                    } catch (e) {
                      console.error(`[AB Optimizer] Error highlighting element ${selector}:`, e);
                    }
                  });
                }
                
                // Handle visibility changes
                if (variation.content.sections) {
                  Object.entries(variation.content.sections).forEach(([selector, sectionData]) => {
                    // Determine the visibility value (handle both boolean and object formats)
                    const isVisible = typeof sectionData === 'boolean' ? sectionData : 
                                     (sectionData.visible === true);
                    
                    // Store in selected elements
                    window.abOptimizerSelectedElements.sections[selector] = isVisible;
                    window.abOptimizerElementSelectors.sections[selector] = selector;
                    
                    // Add highlight to element to show it's selected
                    try {
                      const elements = document.querySelectorAll(selector);
                      if (elements.length > 0) {
                        elements.forEach(el => {
                          el.style.outline = '2px dashed #22c55e';
                          el.style.outlineOffset = '2px';
                          el.style.opacity = isVisible ? '1' : '0.2';
                          el.setAttribute('data-ab', selector);
                        });
                      }
                    } catch (e) {
                      console.error(`[AB Optimizer] Error highlighting element ${selector}:`, e);
                    }
                  });
                }
              }
              
              // Apply the content to show current state
              applyVariationContent(variation.content);
              
              // Store the variation data for the editor
              window.abOptimizerExistingContent = variation.content;
              
              // Store the variation ID for updating instead of creating
              window.abOptimizerExistingVariationId = existingVariationId;
              
              // Update the counter
              updateSelectedCount();
            }
          } catch (err) {
            console.error('[AB Optimizer] Error loading variation from API:', err);
          }
        }
      } catch (error) {
        console.error('[AB Optimizer] Error loading existing variation:', error);
      }
    }
    
    // Create design mode UI
    const designPanel = document.createElement('div');
    designPanel.id = 'ab-optimizer-design-panel';
    designPanel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      height: 60px;
      border-top: 2px solid #6366f1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 999999;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    // Add design mode toolbar
    designPanel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <!-- Modern toggle switch style -->
        <div style="display: flex; align-items: center;">
          <label for="ab-select-toggle" style="position: relative; display: inline-block; width: 60px; height: 34px; margin: 0; cursor: pointer;">
            <input type="checkbox" id="ab-select-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="ab-select-toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;">
              <span id="ab-select-toggle-knob" style="position: absolute; content: ''; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%;"></span>
            </span>
          </label>
          <span style="margin-left: 10px; font-weight: 500;">Select Elements</span>
        </div>
        <span id="ab-selection-mode-info" style="margin-left: 10px; color: #6b7280; font-size: 14px;">Toggle to select elements</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
        <span id="ab-selected-count" style="color: #6b7280; font-size: 14px;">0 elements selected</span>
        <button id="ab-design-save" class="ab-design-btn" style="background: #22c55e; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">Save Variation</button>
      </div>
    `;
    
    document.body.appendChild(designPanel);
    
    // Create editor panel (hidden by default)
    const editorPanel = document.createElement('div');
    editorPanel.id = 'ab-optimizer-editor-panel';
    editorPanel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      width: 400px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 1000000;
      padding: 20px;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    document.body.appendChild(editorPanel);
    
    // Create overlay for element selection
    const overlay = document.createElement('div');
    overlay.id = 'ab-optimizer-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 60px;
      background: rgba(0,0,0,0.05);
      z-index: 999998;
      pointer-events: none;
      display: none;
    `;
    
    document.body.appendChild(overlay);
    
    // Initialize global variables for storing selected elements
    if (!window.abOptimizerSelectedElements) {
      window.abOptimizerSelectedElements = {
        texts: {},
        images: {},
        videos: {},
        sections: {}
      };
    }
    
    // Store original element selectors
    if (!window.abOptimizerElementSelectors) {
      window.abOptimizerElementSelectors = {
        texts: {},
        images: {},
        videos: {},
        sections: {}
      };
    }
    
    // Add event listener for the new toggle switch
    document.getElementById('ab-select-toggle').addEventListener('change', function() {
      const toggleCheckbox = document.getElementById('ab-select-toggle');
      const selectedModeInfo = document.getElementById('ab-selection-mode-info');
      const toggleSlider = document.getElementById('ab-select-toggle-slider');
      const toggleKnob = document.getElementById('ab-select-toggle-knob');
      
      if (toggleCheckbox.checked) {
        // Toggle is ON - Enable select mode
        toggleSlider.style.backgroundColor = '#4ADE80'; // Green color when active
        toggleKnob.style.transform = 'translateX(26px)'; // Move knob to right
        
        // Update visual cue text
        selectedModeInfo.textContent = 'Click on elements to edit';
        
        // Enable selection mode
        enableSelectMode();
      } else {
        // Toggle is OFF - Disable select mode
        toggleSlider.style.backgroundColor = '#ccc'; // Gray color when inactive
        toggleKnob.style.transform = 'translateX(0)'; // Move knob to left
        
        // Update visual cue text
        selectedModeInfo.textContent = 'Toggle switch to select elements';
        
        // Hide overlay and remove event listeners
        document.getElementById('ab-optimizer-overlay').style.display = 'none';
        document.querySelectorAll('body *').forEach(el => {
          el.removeEventListener('mouseenter', highlightElement);
          el.removeEventListener('mouseleave', removeHighlight);
          el.removeEventListener('click', handleElementClick);
        });
      }
    });
    document.getElementById('ab-design-save').addEventListener('click', saveVariation);
    
    // Enable select mode and update toggle by default
    setTimeout(() => {
      // Set the toggle to checked state
      const toggleCheckbox = document.getElementById('ab-select-toggle');
      if (toggleCheckbox) {
        toggleCheckbox.checked = true;
        
        // Update toggle appearance
        const toggleSlider = document.getElementById('ab-select-toggle-slider');
        const toggleKnob = document.getElementById('ab-select-toggle-knob');
        
        if (toggleSlider) toggleSlider.style.backgroundColor = '#4ADE80';
        if (toggleKnob) toggleKnob.style.transform = 'translateX(26px)';
      }
      
      // Enable selection mode
      enableSelectMode();
    }, 500); // Short delay to ensure DOM is ready
    
    // Function to enable element selection mode
    function enableSelectMode() {
      // Update info text
      const infoText = document.getElementById('ab-selection-mode-info');
      if (infoText) {
        infoText.textContent = 'Click on elements to edit';
      }
      
      // Show the overlay to indicate we're in select mode
      document.getElementById('ab-optimizer-overlay').style.display = 'block';
      
      // Make all elements available for selection
      document.querySelectorAll('body *').forEach(el => {
        if (el.id !== 'ab-optimizer-design-panel' && 
            el.id !== 'ab-optimizer-editor-panel' && 
            el.id !== 'ab-optimizer-overlay' &&
            !el.closest('#ab-optimizer-design-panel') && 
            !el.closest('#ab-optimizer-editor-panel') &&
            !el.matches('#ab-optimizer-design-panel *, #ab-optimizer-editor-panel *')) {
          
          // Remove existing event listeners to avoid duplicates
          el.removeEventListener('mouseenter', highlightElement);
          el.removeEventListener('mouseleave', removeHighlight);
          el.removeEventListener('click', handleElementClick);
          
          // Add event listeners - using mouseenter/mouseleave instead of mouseover/mouseout for better reliability
          el.addEventListener('mouseenter', highlightElement);
          el.addEventListener('mouseleave', removeHighlight);
          el.addEventListener('click', handleElementClick);
        }
      });
    }
    
    // Function to disable selection mode - we've removed the Navigate button
    // but keeping this function for compatibility with existing code
    function enableNavigateMode() {
      console.log('[AB Optimizer] Navigate mode called (deprecated)');
      
      // Get select button and update it
      const selectBtn = document.getElementById('ab-design-select');
      if (selectBtn) {
        selectBtn.style.background = '#f3f4f6';
        selectBtn.style.backgroundColor = '#f3f4f6';
        selectBtn.style.color = '#111827';
        selectBtn.style.border = '1px solid #d1d5db';
        
        // Update toggle indicator
        const indicator = document.getElementById('toggle-indicator');
        if (indicator) {
          indicator.style.display = 'none';
        }
      }
      
      // Update info text
      const infoText = document.getElementById('ab-selection-mode-info');
      if (infoText) {
        infoText.textContent = 'Selection mode disabled. Click "Select Elements" to enable.';
      }
      
      // Hide the overlay since we're in normal mode
      document.getElementById('ab-optimizer-overlay').style.display = 'none';
      
      // Remove event listeners from all elements
      document.querySelectorAll('body *').forEach(el => {
        el.removeEventListener('mouseenter', highlightElement);
        el.removeEventListener('mouseleave', removeHighlight);
        el.removeEventListener('click', handleElementClick);
      });
    }
    
    // Track the current highlighted element
    window.currentHighlightedElement = null;
    
    // Function to highlight elements on mouseenter
    function highlightElement(e) {
      e.stopPropagation();
      const el = e.currentTarget;
      
      // Store the current element for reference
      window.currentHighlightedElement = el;
      
      // Create or update element info tooltip
      let tooltipEl = document.getElementById('ab-element-tooltip');
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'ab-element-tooltip';
        tooltipEl.style.cssText = `
          position: absolute;
          background: rgba(17, 24, 39, 0.97);
          color: white;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000001;
          max-width: 300px;
          word-break: break-all;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.15);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: opacity 0.2s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          opacity: 0;
          transform: translateY(0);
        `;
        document.body.appendChild(tooltipEl);
      }
      
      // Get element info for tooltip
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = Array.from(el.classList).map(c => `.${c}`).join('');
      
      // Generate selector for this element
      const selector = getUniqueSelector(el);
      
      // Create tooltip content
      let tooltipContent = `<div style="font-weight: bold; color: #a3e635;">${tag}${id}${classes}</div>`;
      
      // Add extra info for semantic elements 
      if (tag === 'img') {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Image element</div>`;
      } else if (tag === 'a') {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Link element</div>`;
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Heading element</div>`;
      } else if (tag === 'button') {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Button element</div>`;
      } else if (tag === 'input') {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Input element (${el.type || 'text'})</div>`;
      } else if (tag === 'video' || el.querySelector('video')) {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Video element</div>`;
      } else if (tag === 'iframe' || el.querySelector('iframe')) {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Embedded content</div>`;
      } else if (tag === 'div' || tag === 'section') {
        tooltipContent += `<div style="color: #94a3b8; margin-top: 3px;">Container element</div>`;
      }
      
      // Show the selector in the tooltip
      tooltipContent += `<div style="font-family: monospace; margin-top: 3px; color: #cbd5e1; font-size: 11px;">${selector}</div>`;
      
      // Update tooltip content and position
      tooltipEl.innerHTML = tooltipContent;
      tooltipEl.style.display = 'block';
      
      // First, force the tooltip to be visible but out of the way to get its dimensions
      tooltipEl.style.visibility = 'hidden';
      tooltipEl.style.left = '0px';
      tooltipEl.style.top = '0px';
      
      // Get element position relative to document for absolute positioning
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Get tooltip dimensions after rendering content
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;
      
      // Calculate available spaces in different directions around the element
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;
      
      // Determine best position based on available space
      let position;
      
      // Check if tooltip fits above element
      if (spaceAbove >= tooltipHeight + 10) {
        position = 'above';
      } 
      // Check if tooltip fits below element
      else if (spaceBelow >= tooltipHeight + 10) {
        position = 'below';
      }
      // Check if tooltip fits to the right of element
      else if (spaceRight >= tooltipWidth + 10) {
        position = 'right';
      }
      // Check if tooltip fits to the left of element
      else if (spaceLeft >= tooltipWidth + 10) {
        position = 'left';
      }
      // Default: fixed position near the element but always in view
      else {
        position = 'fixed';
      }
      
      // Set position based on determined best position
      let top, left;
      
      switch (position) {
        case 'above':
          top = rect.top + scrollTop - tooltipHeight - 10; // 10px above the element
          left = rect.left + scrollLeft + (rect.width - tooltipWidth) / 2; // Centered horizontally
          break;
          
        case 'below':
          top = rect.bottom + scrollTop + 10; // 10px below the element
          left = rect.left + scrollLeft + (rect.width - tooltipWidth) / 2; // Centered horizontally
          break;
          
        case 'right':
          top = rect.top + scrollTop + (rect.height - tooltipHeight) / 2; // Centered vertically
          left = rect.right + scrollLeft + 10; // 10px to the right
          break;
          
        case 'left':
          top = rect.top + scrollTop + (rect.height - tooltipHeight) / 2; // Centered vertically
          left = rect.left + scrollLeft - tooltipWidth - 10; // 10px to the left
          break;
          
        case 'fixed':
          // Default position in the bottom-right of the viewport, but always visible
          top = scrollTop + window.innerHeight - tooltipHeight - 20;
          left = scrollLeft + window.innerWidth - tooltipWidth - 20;
          break;
      }
      
      // Final boundary checks to ensure tooltip stays within viewport
      // Check horizontal boundaries
      if (left < scrollLeft + 10) {
        left = scrollLeft + 10; // Keep 10px from left edge
      } else if (left + tooltipWidth > scrollLeft + window.innerWidth - 10) {
        left = scrollLeft + window.innerWidth - tooltipWidth - 10; // Keep 10px from right edge
      }
      
      // Check vertical boundaries
      if (top < scrollTop + 10) {
        top = scrollTop + 10; // Keep 10px from top edge
      } else if (top + tooltipHeight > scrollTop + window.innerHeight - 10) {
        top = scrollTop + window.innerHeight - tooltipHeight - 10; // Keep 10px from bottom edge
      }
      
      // Make sure any pending hide operations are canceled
      if (window.tooltipHideTimer) {
        clearTimeout(window.tooltipHideTimer);
        window.tooltipHideTimer = null;
      }
      
      // Set position for the tooltip
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
      
      // Make tooltip immediately visible without animation if it's already shown
      // Otherwise, do a fade-in animation
      if (tooltipEl.style.display === 'block' && tooltipEl.style.visibility === 'visible') {
        // Already visible, just update position
      } else {
        // Set up for fade-in
        tooltipEl.style.display = 'block';
        tooltipEl.style.visibility = 'visible';
        tooltipEl.style.opacity = '0';
        
        // Trigger animation in next frame
        requestAnimationFrame(() => {
          tooltipEl.style.opacity = '0.97';
        });
      }
      
      // Use a different highlight style for already selected elements
      if (el.hasAttribute('data-ab')) {
        el.setAttribute('data-ab-temp', 'highlight-edit');
        el.style.outline = '2px dashed #f97316'; // Orange outline for edit mode
        el.style.outlineOffset = '2px';
        el.style.cursor = 'pointer';
        return;
      }
      
      el.setAttribute('data-ab-temp', 'highlight');
      el.style.outline = '2px dashed #6366f1';
      el.style.outlineOffset = '2px';
      el.style.cursor = 'pointer';
    }
    
    // Function to remove highlight on mouseleave
    function removeHighlight(e) {
      const tempHighlight = e.currentTarget.getAttribute('data-ab-temp');
      
      // Clear the current highlighted element
      window.currentHighlightedElement = null;
      
      // First check if cursor is really outside element with a small delay
      // This prevents tooltip flicker when cursor moves within the element
      setTimeout(() => {
        // If another element became highlighted in the meantime, don't hide
        if (window.currentHighlightedElement) {
          return;
        }
        
        // Hide the tooltip with a fade-out effect
        const tooltipEl = document.getElementById('ab-element-tooltip');
        if (tooltipEl) {
          // Start the fade-out animation
          tooltipEl.style.opacity = '0';
          
          // Set a timer to hide the tooltip after animation completes
          // Store the timer ID so we can cancel it if mouseenter happens again
          window.tooltipHideTimer = setTimeout(() => {
            tooltipEl.style.display = 'none';
            window.tooltipHideTimer = null;
          }, 200);
        }
      }, 50); // Short delay to prevent flicker
      
      if (tempHighlight === 'highlight') {
        // For standard highlights, remove completely
        e.currentTarget.removeAttribute('data-ab-temp');
        e.currentTarget.style.outline = '';
        e.currentTarget.style.outlineOffset = '';
        e.currentTarget.style.cursor = '';
      } 
      else if (tempHighlight === 'highlight-edit') {
        // For already selected elements, revert to green selection indicator
        e.currentTarget.removeAttribute('data-ab-temp');
        e.currentTarget.style.outline = '2px dashed #22c55e';  // Green outline for selected elements
        e.currentTarget.style.outlineOffset = '2px';
        e.currentTarget.style.cursor = '';
      }
    }
    
    // Function to handle element click for editing
    function handleElementClick(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const el = e.currentTarget;
      let id;
      
      // Check if it's already selected - if so, we'll allow re-editing
      if (el.hasAttribute('data-ab')) {
        id = el.getAttribute('data-ab');
        console.log('[AB Optimizer] Re-editing already selected element with selector:', id);
      } else {
        // Generate a unique selector for this element
        id = getUniqueSelector(el);
        console.log('[AB Optimizer] Editing new element with selector:', id);
      }
      
      // Check element type to determine editing mode
      const tagName = el.tagName.toLowerCase();
      
      // Special handling for images
      if (tagName === 'img') {
        showImageEditor(el, id);
        return;
      }
      
      // Special handling for videos
      if (tagName === 'video' || el.querySelector('video')) {
        showVideoEditor(el, id);
        return;
      }
      
      // Special handling for iframes (embedded videos)
      if (tagName === 'iframe' || el.querySelector('iframe')) {
        showIframeEditor(el, id);
        return;
      }
      
      // Check if element is a heading
      const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName);
      
      // Special case for main hero heading - use a well-known ID
      if (isHeading && 
          (el.tagName === 'H1' || 
           el.classList.contains('hero-heading') || 
           el.classList.contains('landing-page-hero-title') || 
           el.classList.contains('hero-title') ||
           el.closest('[class*="hero"]'))) {
        // This is likely the main hero heading - use a special identifier
        id = 'text-hero-heading';
        console.log('[AB Optimizer] Using special identifier for hero heading:', id);
      }
      
      // Check if element is mostly text or a container
      const isTextElement = el.childNodes.length === 1 && 
                          el.childNodes[0].nodeType === Node.TEXT_NODE;
      
      const hasOnlySimpleChildren = Array.from(el.children).every(child => {
        return ['B', 'I', 'STRONG', 'EM', 'SPAN', 'A', 'SMALL', 'BR'].includes(child.tagName);
      });
      
      const hasText = el.innerText && el.innerText.trim().length > 0;
      
      // Always use the text editor for headings, regardless of their child nodes
      if (isHeading || ((isTextElement || hasOnlySimpleChildren) && hasText)) {
        showTextEditor(el, id);
      } else {
        toggleSectionVisibility(el, id);
      }
    }
    
    // Function to show image editor
    function showImageEditor(el, id) {
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Edit Image</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Current Image:</label>
          <div style="padding: 10px; background: #f3f4f6; border-radius: 4px; text-align: center; margin-bottom: 10px;">
            <img src="${el.src}" style="max-width: 100%; max-height: 150px;">
            <div style="font-size: 12px; color: #6b7280; margin-top: 5px; word-break: break-all;">${el.src}</div>
          </div>
          
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">New Image URL:</label>
          <input id="ab-image-src-editor" type="text" value="${el.src}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 10px;">
          
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="img-visibility" value="show" checked> 
              <span style="font-size: 14px; color: #1f2937;">Show image</span>
            </label>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="img-visibility" value="hide"> 
              <span style="font-size: 14px; color: #1f2937;">Hide image</span>
            </label>
          </div>
          
          ${el.alt ? `
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Alt Text:</label>
          <input id="ab-image-alt-editor" type="text" value="${el.alt}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
          ` : ''}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-apply" style="background: #6366f1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        el.removeAttribute('data-ab-temp');
      });
      
      document.getElementById('ab-editor-apply').addEventListener('click', () => {
        const newSrc = document.getElementById('ab-image-src-editor').value;
        const hideImage = document.querySelector('input[name="img-visibility"]:checked').value === 'hide';
        const altInput = document.getElementById('ab-image-alt-editor');
        const newAlt = altInput ? altInput.value : el.alt;
        
        // Store the original source in a data attribute if not already stored
        if (!el.hasAttribute('data-original-src')) {
          el.setAttribute('data-original-src', el.src);
        }
        
        // Create the element data structure if needed
        if (!window.abOptimizerSelectedElements.texts) {
          window.abOptimizerSelectedElements.texts = {};
        }
        if (!window.abOptimizerElementSelectors.texts) {
          window.abOptimizerElementSelectors.texts = {};
        }
        
        // Add to selected elements
        window.abOptimizerSelectedElements.texts[id] = {
          type: 'image',
          src: newSrc,
          visible: !hideImage,
          alt: newAlt
        };
        window.abOptimizerElementSelectors.texts[id] = id;
        
        // Store original display state if not already stored
        if (!el.hasAttribute('data-original-display')) {
          const computedDisplay = window.getComputedStyle(el).display;
          el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
        }
        
        // Add visibility tracking attribute
        el.setAttribute('data-ab-visibility', !hideImage ? 'visible' : 'hidden');
        
        // Apply the new source if changing
        if (newSrc !== el.src) {
          el.src = newSrc;
        }
        
        // Apply alt text if provided
        if (newAlt) el.alt = newAlt;
        
        // Apply visibility changes based on design mode
        if (!hideImage) {
          // Show the image
          el.style.display = ''; // Reset to default display
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease';
          el.style.visibility = 'visible';
        } else {
          // In design mode, make faded but still visible and selectable
          el.style.opacity = '0.3';
          el.style.transition = 'opacity 0.3s ease';
          
          // Keep original display to maintain layout
          const originalDisplay = el.getAttribute('data-original-display') || '';
          if (originalDisplay === 'none') {
            el.style.display = 'block'; // Force display if it was none
          } else {
            el.style.display = originalDisplay;
          }
          
          // Ensure element remains interactive in design mode
          el.style.pointerEvents = 'auto';
          el.style.visibility = 'visible';
          
          console.log(`[AB Optimizer] In design mode: Image marked as hidden but kept visible with opacity 0.3`);
        }
        
        // Show selection indicator on element
        el.style.outline = '2px dashed #22c55e';
        el.style.outlineOffset = '2px';
        
        // Update count
        updateSelectedCount();
        
        // Change to data-ab attribute for persistence
        el.setAttribute('data-ab', id);
        el.removeAttribute('data-ab-temp');
        
        editorPanel.style.display = 'none';
      });
    }
    
    // Function to show video editor
    function showVideoEditor(el, id) {
      // Find the video element, which may be either the element itself or a child
      const videoEl = el.tagName.toLowerCase() === 'video' ? el : el.querySelector('video');
      
      if (!videoEl) {
        console.error('[AB Optimizer] Could not find video element');
        return;
      }
      
      // Get current video sources
      const sources = Array.from(videoEl.querySelectorAll('source')).map(source => ({
        src: source.src,
        type: source.type
      }));
      
      const currentSrc = videoEl.src || (sources.length > 0 ? sources[0].src : '');
      
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Edit Video</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Current Video Source:</label>
          <div style="padding: 10px; background: #f3f4f6; border-radius: 4px; font-size: 12px; color: #6b7280; margin-bottom: 10px; word-break: break-all;">
            ${currentSrc}
          </div>
          
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">New Video URL:</label>
          <input id="ab-video-src-editor" type="text" value="${currentSrc}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 10px;">
          
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="video-visibility" value="show" checked> 
              <span style="font-size: 14px; color: #1f2937;">Show video</span>
            </label>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="video-visibility" value="hide"> 
              <span style="font-size: 14px; color: #1f2937;">Hide video</span>
            </label>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-apply" style="background: #6366f1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        el.removeAttribute('data-ab-temp');
      });
      
      document.getElementById('ab-editor-apply').addEventListener('click', () => {
        const newSrc = document.getElementById('ab-video-src-editor').value;
        const hideVideo = document.querySelector('input[name="video-visibility"]:checked').value === 'hide';
        
        // Store the original source
        if (!videoEl.hasAttribute('data-original-src')) {
          videoEl.setAttribute('data-original-src', currentSrc);
        }
        
        // Create the element data structure if needed
        if (!window.abOptimizerSelectedElements.texts) {
          window.abOptimizerSelectedElements.texts = {};
        }
        if (!window.abOptimizerElementSelectors.texts) {
          window.abOptimizerElementSelectors.texts = {};
        }
        
        // Add to selected elements
        window.abOptimizerSelectedElements.texts[id] = {
          type: 'video',
          src: newSrc,
          visible: !hideVideo
        };
        window.abOptimizerElementSelectors.texts[id] = id;
        
        // Store original display state if not already stored
        if (!el.hasAttribute('data-original-display')) {
          const computedDisplay = window.getComputedStyle(el).display;
          el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
        }
        
        // Add visibility tracking attribute
        el.setAttribute('data-ab-visibility', !hideVideo ? 'visible' : 'hidden');
        
        // Apply source changes
        if (!hideVideo || window.location.search.includes('design')) {
          videoEl.src = newSrc;
          
          // Update any source elements
          videoEl.querySelectorAll('source').forEach(source => {
            source.src = newSrc;
          });
          
          // Reload the video
          videoEl.load();
        }
        
        // Apply visibility changes based on design mode
        if (!hideVideo) {
          // Show the video
          el.style.display = ''; // Reset to default display
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease';
          el.style.visibility = 'visible';
        } else {
          // Check if we're in design mode
          if (window.location.search.includes('design') || window.abOptimizerDesignMode === true) {
            // In design mode, make faded but still visible and selectable
            el.style.opacity = '0.3';
            el.style.transition = 'opacity 0.3s ease';
            
            // Keep original display to maintain layout
            const originalDisplay = el.getAttribute('data-original-display') || '';
            if (originalDisplay === 'none') {
              el.style.display = 'block'; // Force display if it was none
            } else {
              el.style.display = originalDisplay;
            }
            
            // Ensure element remains interactive in design mode
            el.style.pointerEvents = 'auto';
            el.style.visibility = 'visible';
            
            console.log(`[AB Optimizer] In design mode: Video marked as hidden but kept visible with opacity 0.3`);
          } else {
            // In preview/experiment mode, completely hide the element
            el.style.display = 'none'; // Hide in experiment/preview mode
            el.style.visibility = 'hidden';
            console.log(`[AB Optimizer] Experiment mode: Completely hiding video`);
          }
        }
        
        // Show selection indicator on element
        el.style.outline = '2px dashed #22c55e';
        el.style.outlineOffset = '2px';
        
        // Update count
        updateSelectedCount();
        
        // Change to data-ab attribute for persistence
        el.setAttribute('data-ab', id);
        el.removeAttribute('data-ab-temp');
        
        editorPanel.style.display = 'none';
      });
    }
    
    // Function to show iframe editor for embedded content
    function showIframeEditor(el, id) {
      // Find the iframe element, which may be either the element itself or a child
      const iframeEl = el.tagName.toLowerCase() === 'iframe' ? el : el.querySelector('iframe');
      
      if (!iframeEl) {
        console.error('[AB Optimizer] Could not find iframe element');
        return;
      }
      
      const currentSrc = iframeEl.src || '';
      
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Edit Embedded Content</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Current Embed Source:</label>
          <div style="padding: 10px; background: #f3f4f6; border-radius: 4px; font-size: 12px; color: #6b7280; margin-bottom: 10px; word-break: break-all;">
            ${currentSrc}
          </div>
          
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">New Embed URL:</label>
          <input id="ab-iframe-src-editor" type="text" value="${currentSrc}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 10px;">
          
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="iframe-visibility" value="show" checked> 
              <span style="font-size: 14px; color: #1f2937;">Show embed</span>
            </label>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="iframe-visibility" value="hide"> 
              <span style="font-size: 14px; color: #1f2937;">Hide embed</span>
            </label>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-apply" style="background: #6366f1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        el.removeAttribute('data-ab-temp');
      });
      
      document.getElementById('ab-editor-apply').addEventListener('click', () => {
        const newSrc = document.getElementById('ab-iframe-src-editor').value;
        const hideIframe = document.querySelector('input[name="iframe-visibility"]:checked').value === 'hide';
        
        // Store the original source
        if (!iframeEl.hasAttribute('data-original-src')) {
          iframeEl.setAttribute('data-original-src', currentSrc);
        }
        
        // Create the element data structure if needed
        if (!window.abOptimizerSelectedElements.texts) {
          window.abOptimizerSelectedElements.texts = {};
        }
        if (!window.abOptimizerElementSelectors.texts) {
          window.abOptimizerElementSelectors.texts = {};
        }
        
        // Add to selected elements
        window.abOptimizerSelectedElements.texts[id] = {
          type: 'iframe',
          src: newSrc,
          visible: !hideIframe
        };
        window.abOptimizerElementSelectors.texts[id] = id;
        
        // Store original display state if not already stored
        if (!el.hasAttribute('data-original-display')) {
          const computedDisplay = window.getComputedStyle(el).display;
          el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
        }
        
        // Add visibility tracking attribute
        el.setAttribute('data-ab-visibility', !hideIframe ? 'visible' : 'hidden');
        
        // Apply source changes
        if (!hideIframe || window.location.search.includes('design')) {
          iframeEl.src = newSrc;
        }
        
        // Apply visibility changes based on design mode
        if (!hideIframe) {
          // Show the iframe
          el.style.display = ''; // Reset to default display
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease';
          el.style.visibility = 'visible';
        } else {
          // Check if we're in design mode
          if (window.location.search.includes('design') || window.abOptimizerDesignMode === true) {
            // In design mode, make faded but still visible and selectable
            el.style.opacity = '0.3';
            el.style.transition = 'opacity 0.3s ease';
            
            // Keep original display to maintain layout
            const originalDisplay = el.getAttribute('data-original-display') || '';
            if (originalDisplay === 'none') {
              el.style.display = 'block'; // Force display if it was none
            } else {
              el.style.display = originalDisplay;
            }
            
            // Ensure element remains interactive in design mode
            el.style.pointerEvents = 'auto';
            el.style.visibility = 'visible';
            
            console.log(`[AB Optimizer] In design mode: Iframe marked as hidden but kept visible with opacity 0.3`);
          } else {
            // In preview/experiment mode, completely hide the element
            el.style.display = 'none'; // Hide in experiment/preview mode
            el.style.visibility = 'hidden';
            console.log(`[AB Optimizer] Experiment mode: Completely hiding iframe`);
          }
        }
        
        // Show selection indicator on element
        el.style.outline = '2px dashed #22c55e';
        el.style.outlineOffset = '2px';
        
        // Update count
        updateSelectedCount();
        
        // Change to data-ab attribute for persistence
        el.setAttribute('data-ab', id);
        el.removeAttribute('data-ab-temp');
        
        editorPanel.style.display = 'none';
      });
    }
    
    // Helper function to get a unique CSS selector for an element
    function getUniqueSelector(el) {
      // If element has an ID, use that
      if (el.id) {
        return `#${el.id}`;
      }
      
      // If element has a unique class combination, use that
      if (el.classList.length > 0) {
        const classSelector = Array.from(el.classList).map(c => `.${c}`).join('');
        const matches = document.querySelectorAll(classSelector);
        if (matches.length === 1) {
          return classSelector;
        }
      }
      
      // Otherwise, get a CSS selector path
      const path = [];
      let currentEl = el;
      
      while (currentEl && currentEl !== document.body) {
        let selector = currentEl.tagName.toLowerCase();
        
        if (currentEl.classList.length > 0) {
          // Pick the first class that seems meaningful
          for (const cls of currentEl.classList) {
            if (cls.length > 2 && !cls.startsWith('w-') && !cls.match(/^(mt|mb|pt|pb|pl|pr|mx|my|px|py)-/)) {
              selector += `.${cls}`;
              break;
            }
          }
        }
        
        const siblings = Array.from(currentEl.parentNode.children).filter(c => c.tagName === currentEl.tagName);
        if (siblings.length > 1) {
          // Find position among siblings
          const index = siblings.indexOf(currentEl) + 1;
          selector += `:nth-of-type(${index})`;
        }
        
        path.unshift(selector);
        
        // If the path already uniquely identifies the element, stop
        if (document.querySelectorAll(path.join(' ')).length === 1) {
          return path.join(' ');
        }
        
        currentEl = currentEl.parentNode;
      }
      
      // Return the path if we got one
      return path.join(' ');
    }
    
    // Function to show text editor
    function showTextEditor(el, id) {
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Edit Text</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Original Text:</label>
          <div style="padding: 10px; background: #f3f4f6; border-radius: 4px; font-size: 14px; color: #6b7280; margin-bottom: 10px;">
            ${el.innerHTML}
          </div>
          
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">New Text:</label>
          <textarea id="ab-text-editor" style="width: 100%; height: 100px; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">${el.innerHTML}</textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-apply" style="background: #6366f1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        el.removeAttribute('data-ab-temp');
      });
      
      document.getElementById('ab-editor-apply').addEventListener('click', () => {
        const newText = document.getElementById('ab-text-editor').value;
        
        // Add to selected elements
        window.abOptimizerSelectedElements.texts[id] = newText;
        window.abOptimizerElementSelectors.texts[id] = id;
        
        // Preview change
        el.innerHTML = newText;
        
        // Show selection indicator on element
        el.style.outline = '2px dashed #22c55e';
        el.style.outlineOffset = '2px';
        
        // Update count
        updateSelectedCount();
        
        // Change to data-ab attribute for persistence
        el.setAttribute('data-ab', id);
        el.removeAttribute('data-ab-temp');
        
        editorPanel.style.display = 'none';
      });
    }
    
    function toggleSectionVisibility(el, id) {
      // Create a simple form to toggle visibility
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      
      // Determine current visibility state
      let isCurrentlyVisible = true;
      
      // Check if this element already has a visibility setting in our variations
      if (window.abOptimizerSelectedElements && 
          window.abOptimizerSelectedElements.sections && 
          id in window.abOptimizerSelectedElements.sections) {
        isCurrentlyVisible = window.abOptimizerSelectedElements.sections[id];
      } else {
        // Check for data-ab-visibility attribute first
        if (el.hasAttribute('data-ab-visibility')) {
          isCurrentlyVisible = el.getAttribute('data-ab-visibility') === 'visible';
        } 
        // Then check opacity
        else if (el.style.opacity === '0.3' || el.style.opacity === '0') {
          isCurrentlyVisible = false;
        }
        // Finally check display
        else if (el.style.display === 'none') {
          isCurrentlyVisible = false;
        }
      }
      
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Toggle Element Visibility</h3>
        <div style="margin-bottom: 15px;">
          <div style="background: #f9fafb; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
            <div style="font-weight: 500; margin-bottom: 5px; color: #4b5563;">Current state:</div>
            <div style="color: ${isCurrentlyVisible ? '#22c55e' : '#ef4444'}; font-weight: 500;">
              ${isCurrentlyVisible ? 'Visible' : 'Hidden'}
            </div>
          </div>
          
          <p style="margin: 0 0 15px; font-size: 14px; color: #6b7280;">Select whether to show or hide this element in your variation:</p>
          
          <div style="display: flex; gap: 10px;">
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="visibility" value="show" ${isCurrentlyVisible ? 'checked' : ''}> 
              <span style="font-size: 14px; color: #1f2937;">Show element</span>
            </label>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
              <input type="radio" name="visibility" value="hide" ${!isCurrentlyVisible ? 'checked' : ''}> 
              <span style="font-size: 14px; color: #1f2937;">Hide element</span>
            </label>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-apply" style="background: #6366f1; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Apply</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        el.removeAttribute('data-ab-temp');
      });
      
      document.getElementById('ab-editor-apply').addEventListener('click', () => {
        const showElement = document.querySelector('input[name="visibility"][value="show"]').checked;
        
        // Create the element data structure if needed
        if (!window.abOptimizerSelectedElements.sections) {
          window.abOptimizerSelectedElements.sections = {};
        }
        if (!window.abOptimizerElementSelectors.sections) {
          window.abOptimizerElementSelectors.sections = {};
        }
        
        // Store original display state if not already stored
        if (!el.hasAttribute('data-original-display')) {
          const computedDisplay = window.getComputedStyle(el).display;
          el.setAttribute('data-original-display', computedDisplay === 'none' ? 'block' : computedDisplay);
        }
        
        // Store original position if not already stored
        if (!el.hasAttribute('data-original-position')) {
          const computedPosition = window.getComputedStyle(el).position;
          el.setAttribute('data-original-position', computedPosition);
        }
        
        // Add to selected elements (true means visible, false means hidden)
        window.abOptimizerSelectedElements.sections[id] = showElement;
        window.abOptimizerElementSelectors.sections[id] = id;
        
        // Add visibility tracking attribute
        el.setAttribute('data-ab-visibility', showElement ? 'visible' : 'hidden');
        
        // Apply different visibility handling in design mode vs preview
        if (showElement) {
          // Restore original display or use a sensible default
          const originalDisplay = el.getAttribute('data-original-display') || '';
          el.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease';
          el.style.pointerEvents = 'auto'; // Make sure it's interactive
          el.style.visibility = 'visible'; // Ensure visibility
        } else {
          // In design mode, we always just reduce opacity but keep elements visible and selectable
          // This ensures we can toggle them back later
          el.style.opacity = '0.3';
          el.style.transition = 'opacity 0.3s ease';
          
          // Keep original display to maintain layout, but ensure visible
          const originalDisplay = el.getAttribute('data-original-display') || '';
          if (originalDisplay === 'none') {
            el.style.display = 'block'; // Force display if it was none
          } else {
            el.style.display = originalDisplay;
          }
          
          // Ensure element remains interactive in design mode
          el.style.pointerEvents = 'auto';
          el.style.visibility = 'visible';
          
          console.log(`[AB Optimizer] In design mode: Element marked as hidden but kept visible with opacity 0.3`);
        }
        
        // Show selection indicator on element if it's visible
        if (showElement) {
          el.style.outline = '2px dashed #22c55e';
          el.style.outlineOffset = '2px';
        }
        
        // Update count
        updateSelectedCount();
        
        // Change to data-ab attribute for persistence
        el.setAttribute('data-ab', id);
        el.removeAttribute('data-ab-temp');
        
        editorPanel.style.display = 'none';
      });
    }
    
    function updateSelectedCount() {
      const textCount = Object.keys(window.abOptimizerSelectedElements.texts).length;
      const imageCount = Object.keys(window.abOptimizerSelectedElements.images).length;
      const videoCount = Object.keys(window.abOptimizerSelectedElements.videos).length;
      const sectionCount = Object.keys(window.abOptimizerSelectedElements.sections).length;
      const totalCount = textCount + imageCount + videoCount + sectionCount;
      
      document.getElementById('ab-selected-count').innerText = `${totalCount} elements selected`;
    }
    
    // Function to show and edit existing variations
    async function showVariationsList() {
      console.log("[AB Optimizer] Showing variations list");
      
      // Get the website ID
      let websiteId = WEBSITE_ID;
      if (websiteId.includes('{{')) {
        const scriptTag = document.querySelector('script[data-website-id]');
        if (scriptTag) {
          websiteId = scriptTag.getAttribute('data-website-id');
        } else {
          alert("Could not determine website ID. Please check your installation.");
          return;
        }
      }
      
      // Fetch variations again to ensure we have the latest
      const variations = await loadSiteVariations(websiteId);
      
      if (!variations || variations.length === 0) {
        alert("You don't have any saved variations yet. Create one by selecting and modifying elements on your page.");
        return;
      }
      
      // Show variations list in editor panel
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      
      let variationsListHtml = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Your Variations</h3>
        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 15px;">
      `;
      
      variations.forEach(variation => {
        const textChanges = variation.content && variation.content.texts ? 
                          Object.keys(variation.content.texts).length : 0;
        const imageChanges = variation.content && variation.content.images ? 
                          Object.keys(variation.content.images).length : 0;
        const videoChanges = variation.content && variation.content.videos ? 
                          Object.keys(variation.content.videos).length : 0;
        const visibilityChanges = variation.content && variation.content.sections ? 
                                Object.keys(variation.content.sections).length : 0;
        
        variationsListHtml += `
          <div style="margin-bottom: 10px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <h4 style="margin: 0; font-size: 15px; color: #111827;">${variation.name}</h4>
              <span style="font-size: 13px; color: #6b7280;">${variation.trafficAllocation || 0}% Traffic</span>
            </div>
            <div style="margin-bottom: 8px; font-size: 13px; color: #6b7280;">
              ${textChanges} text, ${imageChanges} image, ${videoChanges} video, ${visibilityChanges} visibility changes
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="ab-view-variation" data-id="${variation.id}" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 4px 8px; border-radius: 4px; font-size: 13px; cursor: pointer;">View</button>
              <button class="ab-edit-variation" data-id="${variation.id}" style="background: #6366f1; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 13px; cursor: pointer;">Edit</button>
              <button class="ab-delete-variation" data-id="${variation.id}" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 13px; cursor: pointer;">Delete</button>
            </div>
          </div>
        `;
      });
      
      variationsListHtml += `
        </div>
        <button id="ab-close-variations" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer; width: 100%;">Close</button>
      `;
      
      editorPanel.innerHTML = variationsListHtml;
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-close-variations').addEventListener('click', () => {
        editorPanel.style.display = 'none';
      });
      
      document.querySelectorAll('.ab-view-variation').forEach(button => {
        button.addEventListener('click', () => {
          const variationId = button.getAttribute('data-id');
          window.open(`${window.location.origin}${window.location.pathname}?exp_${variationId}`, '_blank');
        });
      });
      
      document.querySelectorAll('.ab-edit-variation').forEach(button => {
        button.addEventListener('click', () => {
          const variationId = button.getAttribute('data-id');
          editExistingVariation(variationId, variations);
        });
      });
      
      document.querySelectorAll('.ab-delete-variation').forEach(button => {
        button.addEventListener('click', async () => {
          const variationId = button.getAttribute('data-id');
          
          if (!confirm("Are you sure you want to delete this variation? This action cannot be undone.")) {
            return;
          }
          
          try {
            // Get the app URL
            const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
            
            // Delete the variation
            const response = await fetch(`${appUrl}/api/variations/${variationId}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            
            if (!response.ok) {
              throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }
            
            // Show success message with timeout
            button.closest('div[style*="border"]').innerHTML = `
              <div style="text-align: center; padding: 10px;">
                <p style="color: #22c55e; font-weight: 500; margin: 0;">Variation deleted successfully</p>
              </div>
            `;
            
            // Refresh the variations list after a short delay
            setTimeout(() => {
              showVariationsList();
            }, 1500);
            
          } catch (error) {
            console.error("[AB Optimizer] Error deleting variation:", error);
            alert(`Error deleting variation: ${error.message}`);
          }
        });
      });
    }
    
    // Function to edit an existing variation
    function editExistingVariation(variationId, variations) {
      const variation = variations.find(v => v.id == variationId);
      if (!variation) {
        alert('Could not find the variation to edit.');
        return;
      }
      
      console.log("[AB Optimizer] Editing variation:", variation);
      
      // Reset current selection
      window.abOptimizerSelectedElements = {
        texts: variation.content && variation.content.texts ? { ...variation.content.texts } : {},
        sections: variation.content && variation.content.sections ? { ...variation.content.sections } : {}
      };
      
      // Reset element selectors map (we'll rebuild it when elements are selected)
      window.abOptimizerElementSelectors = {
        texts: {},
        sections: {}
      };
      
      // Update count
      updateSelectedCount();
      
      // Show save dialog pre-populated with variation data
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Edit Variation</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Variation Name:</label>
          <input id="ab-variation-name" type="text" value="${variation.name}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 15px;">
          
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Traffic Allocation (%):</label>
          <input id="ab-variation-traffic" type="number" min="0" max="100" value="${variation.trafficAllocation || 50}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 15px;">
          
          <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">Current Changes:</p>
          <ul style="margin: 0 0 15px; padding-left: 20px; font-size: 14px; color: #1f2937;">
            <li>${Object.keys(window.abOptimizerSelectedElements.texts).length} text element changes</li>
            <li>${Object.keys(window.abOptimizerSelectedElements.sections).length} visibility changes</li>
          </ul>
          
          <div style="background: #fffbeb; border: 1px solid #fbbf24; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              You can make additional changes by navigating back to the editor, selecting elements, and then saving again.
            </p>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-update" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Update Variation</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
        
        // Reset selections
        window.abOptimizerSelectedElements = {
          texts: {},
          sections: {}
        };
        updateSelectedCount();
      });
      
      document.getElementById('ab-editor-update').addEventListener('click', async () => {
        const variationName = document.getElementById('ab-variation-name').value.trim();
        const trafficAllocation = parseInt(document.getElementById('ab-variation-traffic').value) || 0;
        
        if (!variationName) {
          alert("Please enter a name for your variation.");
          return;
        }
        
        // Validate traffic allocation
        if (trafficAllocation < 0 || trafficAllocation > 100) {
          alert("Traffic allocation must be between 0 and 100.");
          return;
        }
        
        // Get the website ID
        let websiteId = WEBSITE_ID;
        if (websiteId.includes('{{')) {
          const scriptTag = document.querySelector('script[data-website-id]');
          if (scriptTag) {
            websiteId = scriptTag.getAttribute('data-website-id');
          } else {
            alert("Could not determine website ID. Please check your installation.");
            return;
          }
        }
        
        // Create a update button loading state
        const updateButton = document.getElementById('ab-editor-update');
        const originalButtonText = updateButton.innerHTML;
        updateButton.innerHTML = 'Updating...';
        updateButton.disabled = true;
        updateButton.style.opacity = '0.7';
        
        // Prepare variation data - ensure we have clean JSON
        let cleanContent;
        try {
          // Make a safe copy of the selected elements
          cleanContent = JSON.parse(JSON.stringify(window.abOptimizerSelectedElements));
        } catch (jsonError) {
          console.error("[AB Optimizer] Error stringifying content:", jsonError);
          alert("Could not process variation data: " + jsonError.message);
          updateButton.innerHTML = originalButtonText;
          updateButton.disabled = false;
          updateButton.style.opacity = '1';
          return;
        }
        
        // Prepare variation data
        const variationData = {
          name: variationName,
          trafficAllocation: trafficAllocation,
          content: cleanContent
        };
        
        console.log("[AB Optimizer] Updating variation data:", variationData);
        
        try {
          // Get the app URL
          const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
          const endpoint = `${appUrl}/api/variations/${variationId}`;
          
          console.log("[AB Optimizer] Sending to endpoint:", endpoint);
          
          // Make sure the endpoint is accessible
          const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(variationData)
          });
          
          if (!response) {
            throw new Error("No response received from server");
          }
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status} ${response.statusText}: ${errorText}`);
          }
          
          let result;
          try {
            result = await response.json();
          } catch (jsonError) {
            throw new Error("Could not parse server response: " + jsonError.message);
          }
          
          // Show success message without close button
          editorPanel.innerHTML = `
            <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">Variation ${isEditing ? 'Updated' : 'Saved'}!</h3>
            <div style="margin-bottom: 15px; text-align: center;">
              <div style="width: 50px; height: 50px; margin: 0 auto 15px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p style="margin-bottom: 15px; font-size: 14px; color: #1f2937;">Your variation "${variationName}" has been ${isEditing ? 'updated' : 'saved'} successfully!</p>
              <p style="margin-bottom: 10px; font-size: 14px; color: #1f2937;">To test your variation, visit your page with: <strong>?exp_${variationId}</strong></p>
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
              <p style="margin: 0 0 8px; color: #0369a1; font-weight: 500; font-size: 14px;">Next Steps:</p>
              <ol style="margin: 0; padding-left: 20px; color: #0369a1; font-size: 14px;">
                <li style="margin-bottom: 5px;">Return to the A/B Optimizer dashboard</li>
                <li style="margin-bottom: 5px;">Set traffic allocation percentages for all variations</li>
                <li style="margin-bottom: 0;">View and manage your variations</li>
              </ol>
            </div>
          `;
          
          // Automatically reset editor mode
          // But don't hide the panel so user can see the success message
          // Reset selected elements
          window.abOptimizerSelectedElements = {
            texts: {},
            images: {},
            videos: {},
            sections: {}
          };
          updateSelectedCount();
          
          // Disable visual editor mode
          enableNavigateMode();
          
        } catch (error) {
          console.error("[AB Optimizer] Error updating variation:", error);
          
          // Reset button state
          updateButton.innerHTML = originalButtonText;
          updateButton.disabled = false;
          updateButton.style.opacity = '1';
          
          alert("Error updating variation: " + error.message);
        }
      });
    }
    
    // Function to save a new variation
    function saveVariation() {
      // Get selected elements
      const selectedElements = window.abOptimizerSelectedElements;
      const textCount = Object.keys(selectedElements.texts).length;
      const sectionCount = Object.keys(selectedElements.sections).length;
      const totalCount = textCount + sectionCount;
      
      // Check if we have any elements selected
      if (totalCount === 0) {
        alert("Please select at least one element to include in your variation.");
        return;
      }
      
      // Check if we're editing an existing variation
      const isEditing = !!window.abOptimizerExistingVariationId;
      
      // Show save dialog
      const editorPanel = document.getElementById('ab-optimizer-editor-panel');
      editorPanel.innerHTML = `
        <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">${isEditing ? 'Update' : 'Save'} Variation</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #6b7280;">Variation Name:</label>
          <input id="ab-variation-name" type="text" value="${window.abOptimizerVariationName || 'New Variation'}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 15px;">
          
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px 12px; border-radius: 4px; margin-bottom: 15px;">
            <p style="margin: 0; color: #0369a1; font-size: 14px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 5px; vertical-align: -3px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Traffic allocation percentages can be set in the dashboard after saving.
            </p>
          </div>
          
          <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">Selected Elements:</p>
          <ul style="margin: 0 0 15px; padding-left: 20px; font-size: 14px; color: #1f2937;">
            <li>${textCount} text element changes</li>
            <li>${sectionCount} visibility changes</li>
          </ul>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="ab-editor-cancel" style="background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="ab-editor-save" style="background: #22c55e; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">${isEditing ? 'Update' : 'Save'} Variation</button>
        </div>
      `;
      
      editorPanel.style.display = 'block';
      
      // Add event listeners
      document.getElementById('ab-editor-cancel').addEventListener('click', () => {
        editorPanel.style.display = 'none';
      });
      
      document.getElementById('ab-editor-save').addEventListener('click', async () => {
        const variationName = document.getElementById('ab-variation-name').value.trim();
        // Default to 0 traffic allocation - will be configured in dashboard
        const trafficAllocation = 0;
        
        if (!variationName) {
          alert("Please enter a name for your variation.");
          return;
        }
        
        // Get the website ID
        let websiteId = WEBSITE_ID;
        if (websiteId.includes('{{')) {
          const scriptTag = document.querySelector('script[data-website-id]');
          if (scriptTag) {
            websiteId = scriptTag.getAttribute('data-website-id');
          } else {
            alert("Could not determine website ID. Please check your installation.");
            return;
          }
        }
        
        // Create a save button loading state
        const saveButton = document.getElementById('ab-editor-save');
        const originalButtonText = saveButton.innerHTML;
        saveButton.innerHTML = isEditing ? 'Updating...' : 'Saving...';
        saveButton.disabled = true;
        saveButton.style.opacity = '0.7';
        
        // First check for duplicate variation names
        if (!isEditing) {
          // Get website ID
          let websiteId = WEBSITE_ID;
          if (websiteId.includes('{{')) {
            const scriptTag = document.querySelector('script[data-website-id]');
            if (scriptTag) {
              websiteId = scriptTag.getAttribute('data-website-id');
            }
          }
          
          // Fetch existing variations to check for duplicate names
          try {
            const existingVariations = await loadSiteVariations(websiteId);
            const duplicateVariation = existingVariations.find(v => 
              v.name.toLowerCase() === variationName.toLowerCase() && 
              (!window.abOptimizerExistingVariationId || v.id !== window.abOptimizerExistingVariationId)
            );
            
            if (duplicateVariation) {
              alert(`A variation with the name "${variationName}" already exists. Please choose a different name.`);
              saveButton.innerHTML = originalButtonText;
              saveButton.disabled = false;
              saveButton.style.opacity = '1';
              return;
            }
          } catch (error) {
            console.warn("[AB Optimizer] Could not check for duplicate variation names:", error);
            // Continue anyway, server will handle duplicates
          }
        }
        
        // Prepare variation data - ensure we have clean JSON
        let cleanContent;
        try {
          // Make a safe copy of the selected elements
          cleanContent = JSON.parse(JSON.stringify(selectedElements));
        } catch (jsonError) {
          console.error("[AB Optimizer] Error stringifying content:", jsonError);
          alert("Could not process variation data: " + jsonError.message);
          saveButton.innerHTML = originalButtonText;
          saveButton.disabled = false;
          saveButton.style.opacity = '1';
          return;
        }
        
        // Prepare variation data
        const variationData = {
          name: variationName,
          websiteId: parseInt(websiteId),
          url: window.location.pathname,
          trafficAllocation: trafficAllocation,
          content: cleanContent
        };
        
        console.log("[AB Optimizer] Saving variation data:", variationData);
        
        try {
          function showSuccess(data) {
            const variationId = data.id;
            
            // Store the variation name for next time
            window.abOptimizerVariationName = variationName;
            
            // Store the variation ID if we're creating a new one
            if (!isEditing) {
              window.abOptimizerExistingVariationId = variationId;
            }
            
            // Show simplified success message, centered with full-width button
            editorPanel.innerHTML = `
              <div style="text-align: center;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827; text-align: center;">Variation ${isEditing ? 'Updated' : 'Saved'}!</h3>
                <div style="margin-bottom: 15px; text-align: center;">
                  <div style="width: 50px; height: 50px; margin: 0 auto 15px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <p style="margin-bottom: 20px; font-size: 14px; color: #1f2937; text-align: center;">Your variation "${variationName}" has been ${isEditing ? 'updated' : 'saved'} successfully!</p>
                </div>
                <button id="ab-editor-view" style="width: 100%; background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; padding: 10px 0; border-radius: 4px; cursor: pointer; text-align: center; font-weight: 500;">View Variation</button>
              </div>
            `;
            
            // Disable design mode when variation is saved
            window.abOptimizerDesignMode = false;
            
            // Remove any highlight UI elements
            document.querySelectorAll('.ab-optimizer-highlight').forEach(el => el.remove());
            document.querySelectorAll('.ab-optimizer-selected').forEach(el => {
              el.classList.remove('ab-optimizer-selected');
            });
            
            // Remove editor controls
            const controlsPanel = document.getElementById('ab-optimizer-controls');
            if (controlsPanel) controlsPanel.remove();
            
            // Remove toolbar if it exists
            const toolbar = document.getElementById('ab-optimizer-toolbar');
            if (toolbar) toolbar.remove();
            
            // Hide the selection overlay if it exists
            const overlay = document.getElementById('ab-optimizer-overlay');
            if (overlay) overlay.style.display = 'none';
            
            // Properly disable selection mode - remove all event listeners
            document.querySelectorAll('body *').forEach(el => {
              // We need to reference the functions defined in initDesignMode
              if (typeof highlightElement === 'function') {
                el.removeEventListener('mouseenter', highlightElement);
              }
              if (typeof removeHighlight === 'function') {
                el.removeEventListener('mouseleave', removeHighlight);
              }
              if (typeof handleElementClick === 'function') {
                el.removeEventListener('click', handleElementClick);
              }
            });
            
            // Remove the design panel if it exists
            const designPanel = document.getElementById('ab-optimizer-design-panel');
            if (designPanel) designPanel.remove();
            
            // Setup view button event
            document.getElementById('ab-editor-view').addEventListener('click', () => {
              // Open a new tab with the variation preview and close the editor panel
              window.open(`${window.location.origin}${window.location.pathname}?exp_${variationId}`, '_blank');
              editorPanel.style.display = 'none';
            });
          }
          
          function showError(error) {
            console.error("[AB Optimizer] Error saving variation:", error);
            
            // Reset button state
            saveButton.innerHTML = originalButtonText;
            saveButton.disabled = false;
            saveButton.style.opacity = '1';
            
            alert("Error saving variation: " + error.message);
          }
          
          // Get the app URL
          const appUrl = APP_URL || hostUrl || `${window.location.protocol}//${window.location.host}`;
          
          if (isEditing) {
            // Update existing variation
            const existingId = window.abOptimizerExistingVariationId;
            
            // Try both authenticated and public endpoints with a fallback approach
            let response;
            let errorMsg = '';
            
            // Try the new PUT endpoint first (public, no auth required)
            try {
              console.log(`[AB Optimizer] Attempting to update variation with PUT endpoint: ${appUrl}/api/variations/${existingId}`);
              
              response = await fetch(`${appUrl}/api/variations/${existingId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  name: variationData.name,
                  trafficAllocation: variationData.trafficAllocation,
                  elementData: variationData.content
                })
              });
              
              if (!response.ok) {
                errorMsg = `PUT request failed: ${response.status} ${response.statusText}`;
                console.warn(`[AB Optimizer] ${errorMsg}`);
                throw new Error(errorMsg);
              }
            } catch (putError) {
              // If PUT request fails, try the authenticated PATCH endpoint
              console.log(`[AB Optimizer] PUT endpoint failed, trying authenticated PATCH endpoint`);
              
              response = await fetch(`${appUrl}/api/variations/${existingId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  name: variationData.name,
                  trafficAllocation: variationData.trafficAllocation,
                  content: variationData.content
                })
              });
            }
            
            if (!response.ok) {
              let errorMsg = `Server returned ${response.status} ${response.statusText}`;
              try {
                // Try to get the response as text first to see what we're dealing with
                const errorText = await response.text();
                console.error("[AB Optimizer] Error response text:", errorText);
                
                // Try to parse as JSON if it looks like JSON
                if (errorText.trim().startsWith('{')) {
                  try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message) {
                      errorMsg += `: ${errorData.message}`;
                    }
                  } catch (jsonError) {
                    console.error("[AB Optimizer] Failed to parse error as JSON:", jsonError);
                  }
                } else {
                  // If it's HTML or another format, include a truncated version
                  if (errorText.length > 100) {
                    errorMsg += `: ${errorText.substring(0, 100)}...`;
                  } else {
                    errorMsg += `: ${errorText}`;
                  }
                }
              } catch (e) {
                console.error("[AB Optimizer] Failed to read error response:", e);
              }
              throw new Error(errorMsg);
            }
            
            const updatedVariation = await response.json();
            showSuccess(updatedVariation);
          }
          else {
            // Create new variation with fallback approach
            let response;
            let errorMsg = '';
            
            // Try the direct API endpoint first (no auth required)
            try {
              console.log(`[AB Optimizer] Attempting to create variation with direct API endpoint: ${appUrl}/api/variations`);
              
              response = await fetch(`${appUrl}/api/variations`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  name: variationData.name,
                  websiteId: parseInt(websiteId),
                  url: variationData.url,
                  elementData: variationData.content
                })
              });
              
              if (!response.ok) {
                errorMsg = `Direct API failed: ${response.status} ${response.statusText}`;
                console.warn(`[AB Optimizer] ${errorMsg}`);
                throw new Error(errorMsg);
              }
            } catch (directError) {
              // If direct API fails, try the authenticated endpoint
              console.log(`[AB Optimizer] Direct API failed, trying authenticated endpoint`);
              
              response = await fetch(`${appUrl}/api/variations/${websiteId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(variationData)
              });
            }
            
            if (!response.ok) {
              let errorMsg = `Server returned ${response.status} ${response.statusText}`;
              try {
                // Try to get the response as text first to see what we're dealing with
                const errorText = await response.text();
                console.error("[AB Optimizer] Error response text:", errorText);
                
                // Try to parse as JSON if it looks like JSON
                if (errorText.trim().startsWith('{')) {
                  try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message) {
                      errorMsg += `: ${errorData.message}`;
                    }
                  } catch (jsonError) {
                    console.error("[AB Optimizer] Failed to parse error as JSON:", jsonError);
                  }
                } else {
                  // If it's HTML or another format, include a truncated version
                  if (errorText.length > 100) {
                    errorMsg += `: ${errorText.substring(0, 100)}...`;
                  } else {
                    errorMsg += `: ${errorText}`;
                  }
                }
              } catch (e) {
                console.error("[AB Optimizer] Failed to read error response:", e);
              }
              throw new Error(errorMsg);
            }
            
            const newVariation = await response.json();
            showSuccess(newVariation);
          }
        } catch (error) {
          console.error("[AB Optimizer] Error saving variation:", error);
          
          // Reset button state
          saveButton.innerHTML = originalButtonText;
          saveButton.disabled = false;
          saveButton.style.opacity = '1';
          
          alert("Error saving variation: " + error.message);
        }
      });
    }
  }
  
  // Initialize the script based on URL parameters
  function initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we need to clear the cache
    if (urlParams.has('ab_clear_cache')) {
      console.log('[AB Optimizer] Clearing all cached data by user request');
      try {
        // Find and clear all AB Optimizer related items in localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('ab_optimizer')) {
            keysToRemove.push(key);
          }
        }
        
        // Remove all found keys
        keysToRemove.forEach(key => {
          console.log(`[AB Optimizer] Removing cached data: ${key}`);
          localStorage.removeItem(key);
        });
        
        console.log(`[AB Optimizer] Cleared ${keysToRemove.length} cached items`);
        
        // Redirect to the same page without the clear cache parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('ab_clear_cache');
        window.location.replace(newUrl.toString());
        return; // Stop execution while redirect happens
      } catch (e) {
        console.error('[AB Optimizer] Error clearing cache:', e);
      }
    }
    
    // Check for design mode
    if (urlParams.has('design')) {
      console.log("[AB Optimizer] Design mode detected");
      initDesignMode();
      return;
    }
    
    // Check if there's a direct experiment or variation access
    if (Array.from(urlParams.keys()).some(key => key.startsWith('exp_'))) {
      console.log("[AB Optimizer] Direct variation access detected");
      applyExperiment();
      return;
    }
    
    // Cache clearing is now handled at the beginning of the function
    
    if (urlParams.has('experiment')) {
      const experimentId = urlParams.get('experiment');
      console.log(`[AB Optimizer] Direct experiment access detected: ${experimentId}`);
      loadExperimentByUrl(experimentId);
      return;
    }
    
    // Otherwise, check for active experiments
    console.log("[AB Optimizer] Checking for active experiments...");
    applyExperiment();
  }
  
  // Initialize when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
}

// Auto-initialize if loaded directly (not via JSONP)
if (typeof window !== 'undefined') {
  // Check if we're not being loaded via JSONP
  if (!window.abOptimizerJsonpLoading) {
    abOptimizerInit();
  }
}
