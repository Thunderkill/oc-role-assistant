// ==UserScript==
// @name          OC Role Assistant
// @namespace     https://github.com/Thunderkill/oc-role-assistant
// @version       1.6.15
// @license       MIT
// @description   Highlights best OC role using configurable CPR priorities
// @author        Cypher-[2641265], Renger [3125174], Thunderkill [3201787]
// @match         https://www.torn.com/*
// @icon          https://www.torn.com/favicon.ico
// @grant         GM_xmlhttpRequest
// @connect       raw.githubusercontent.com
// @downloadURL   https://raw.githubusercontent.com/Thunderkill/oc-role-assistant/refs/heads/main/OC%20Role%20Assistant.user.js
// @updateURL     https://raw.githubusercontent.com/Thunderkill/oc-role-assistant/refs/heads/main/OC%20Role%20Assistant.user.js
// ==/UserScript==

//-----Changelog-----
// v1.6.15 - Center the highlighted role in the nearest scrollable view when possible.
// v1.6.14 - Allow any faction type value on the organized crimes route.
// v1.6.13 - Relaxed faction crimes hash matching and hardened mutation handling for Torn route/content changes.
// v1.6.12 - Restricted activation to the faction crimes route and anchored the status banner only to the visible OC list.
// v1.6.11 - Added GitHub raw update and download URLs.
// v1.6.10 - Added an in-page OC Assistant status banner when no matching role qualifies.
// v1.6.9 - Improved Torn OC page detection, stronger visible role outline, config fetch fallback, and low-noise console diagnostics.
// v1.6.8 - Switched to generic fork metadata, public GitHub config, new cache keys, and full embedded fallback config.
// v1.6.7 - Forked config loading. Removed third-party usage logging and GreasyFork update URLs.
// v1.6.6 - Corrected logic around counting scenarios, scenarios with 1+ people currently planning will now go towards the max counts, instead of all crimes of that level which it was previously using. - Prevented roles being highlighted when currently planning a role causing highlight to switch.
// v1.6.5 - Added JSON toggle to enable or disable usage logging on config refresh. - Changed usage logging to run only when the GitHub config refreshes.
// v1.6.4 - Added one-time user usage logging for username/id/version tracking.
// v1.6.3 - Fixed missing item highlighting icon improperly.
// v1.6.2 - Added configurable treat-as-stalled timer to prioritize crimes nearing stall. - Updated DOM selectors and fallback detection for improved compatibility after Torn page changes. - Fixed recruit-page highlight behavior, auto-scroll, and cleaned up temporary debugging instrumentation.
// v1.6.1 - Added scenario-level stall policy controls (start/join rules and selection order) to help not over fill scenarios - Published new Json with stall policies - added a maximum amount of crimes that can be started. 
// v1.5.0 - Added Changelog - Migrated priority data source from Pastebin to GitHub for better accessibility - Changed paused scenario priority - will now select viable paused scenario roles of any level

(function () {
  "use strict";

  // Configuration settings
  const CONFIG = {
    SCENARIOS_CACHE_DURATION: 2000, // 2 seconds
    NAVIGATION_CACHE_DURATION: 5000, // 5 seconds
    USER_STATE_CACHE_DURATION: 1000, // 1 second
    DEBOUNCE_DELAY: 150, // 150ms debounce
    INTERVAL_CHECK: 10000, // Check every 10 seconds
  };

  const CONFIG_URL =
    "https://raw.githubusercontent.com/Thunderkill/oc-role-assistant/refs/heads/main/oc-role-assistant-config.json";
  const CONFIG_CACHE_KEY = "oc-role-assistant-config-cache-v1";
  const CONFIG_TIMESTAMP_KEY = "oc-role-assistant-config-timestamp-v1";
  const CONFIG_CACHE_DURATION = 6 * 60 * 60 * 1000;

  const DEFAULT_OC_CONFIG = {
    "priorities": {
      "1": [
        { "scenario": "Ace in the Hole", "level": 9, "role": "Hacker", "minCPR": 67 },
      ],
      "2": [
        { "scenario": "Ace in the Hole", "level": 9, "role": "Imitator", "minCPR": 65 },
        { "scenario": "Ace in the Hole", "level": 9, "role": "Muscle #2", "minCPR": 66 },
        { "scenario": "Ace in the Hole", "level": 9, "role": "Muscle #1", "minCPR": 65 },
      ],
      "3": [
        { "scenario": "Ace in the Hole", "level": 9, "role": "Driver", "minCPR": 55 },
        { "scenario": "Break the Bank", "level": 8, "role": "Muscle #3", "minCPR": 72 },
        { "scenario": "Break the Bank", "level": 8, "role": "Thief #2", "minCPR": 72 },
      ],
      "4": [
        { "scenario": "Stacking the Deck", "level": 8, "role": "Imitator", "minCPR": 72 },
        { "scenario": "Clinical Precision", "level": 8, "role": "Imitator", "minCPR": 75 },
      ],
      "5": [
        { "scenario": "Break the Bank", "level": 8, "role": "Robber", "minCPR": 65 },
        { "scenario": "Break the Bank", "level": 8, "role": "Muscle #1", "minCPR": 65 },
        { "scenario": "Break the Bank", "level": 8, "role": "Muscle #2", "minCPR": 65 },
        { "scenario": "Stacking the Deck", "level": 8, "role": "Cat Burglar", "minCPR": 68 },
        { "scenario": "Stacking the Deck", "level": 8, "role": "Hacker", "minCPR": 68 },
        { "scenario": "Clinical Precision", "level": 8, "role": "Cat Burglar", "minCPR": 72 },
        { "scenario": "Clinical Precision", "level": 8, "role": "Cleaner", "minCPR": 72 },
        { "scenario": "Clinical Precision", "level": 8, "role": "Assassin", "minCPR": 70 },
      ],
      "6": [
        { "scenario": "Blast from the Past", "level": 7, "role": "Muscle", "minCPR": 80 },
        { "scenario": "Blast from the Past", "level": 7, "role": "Engineer", "minCPR": 78 },
        { "scenario": "Stacking the Deck", "level": 8, "role": "Driver", "minCPR": 55 },
      ],
      "7": [
        { "scenario": "Blast from the Past", "level": 7, "role": "Bomber", "minCPR": 75 },
        { "scenario": "Blast from the Past", "level": 7, "role": "Picklock #1", "minCPR": 70 },
        { "scenario": "Blast from the Past", "level": 7, "role": "Hacker", "minCPR": 70 },
        { "scenario": "Window of Opportunity", "level": 7, "role": "Engineer", "minCPR": 75 },
        { "scenario": "Window of Opportunity", "level": 7, "role": "Looter #1", "minCPR": 75 },
        { "scenario": "Window of Opportunity", "level": 7, "role": "Looter #2", "minCPR": 75 },
        { "scenario": "Window of Opportunity", "level": 7, "role": "Muscle #1", "minCPR": 75 },
        { "scenario": "Window of Opportunity", "level": 7, "role": "Muscle #2", "minCPR": 75 },
      ],
      "991": [
        { "scenario": "Break the Bank", "level": 8, "role": "Thief #1", "minCPR": 50 },
      ],
      "992": [
        { "scenario": "Blast from the Past", "level": 7, "role": "Picklock #2", "minCPR": 1 },
      ],
      "9999": [
        { "scenario": "Manifest Cruelty", "level": 8, "role": "Cat Burglar", "minCPR": 99 },
        { "scenario": "Manifest Cruelty", "level": 8, "role": "Hacker", "minCPR": 99 },
        { "scenario": "Manifest Cruelty", "level": 8, "role": "Interrogator", "minCPR": 99 },
        { "scenario": "Manifest Cruelty", "level": 8, "role": "Reviver", "minCPR": 99 },
        { "scenario": "Gone Fission", "level": 9, "role": "Hijacker", "minCPR": 99 },
        { "scenario": "Gone Fission", "level": 9, "role": "Engineer", "minCPR": 99 },
        { "scenario": "Gone Fission", "level": 9, "role": "Pickpocket", "minCPR": 99 },
        { "scenario": "Gone Fission", "level": 9, "role": "Imitator", "minCPR": 99 },
        { "scenario": "Gone Fission", "level": 9, "role": "Bomber", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Sniper", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Lookout", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Engineer", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Bomber", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Muscle #1", "minCPR": 99 },
        { "scenario": "Crane Reaction", "level": 10, "role": "Muscle #2", "minCPR": 99 },
      ],
    },
    "stallPolicy": {
      "default": {
        "start": "allow",
        "selectionOrder": "join-first",
        "join": {
          "allow": true,
          "minHoursBeforeStall": 0,
          "maxHoursBeforeStall": 48,
        },
      },
      "scenarios": {
        "Ace in the Hole": {
          "start": "allow",
          "selectionOrder": "start-first",
          "join": {
            "allow": true,
          },
        },
        "Break the Bank": {
          "start": "allow",
          "selectionOrder": "start-first",
          "join": {
            "allow": true,
            "minHoursBeforeStall": 0,
            "maxHoursBeforeStall": 36,
          },
        },
        "Stacking the Deck": {
          "start": "allow",
          "selectionOrder": "start-first",
          "join": {
            "allow": true,
          },
        },
        "Clinical Precision": {
          "start": "allow",
          "selectionOrder": "start-first",
          "join": {
            "allow": true,
            "minHoursBeforeStall": 0,
            "maxHoursBeforeStall": 36,
          },
        },
        "Blast from the Past": {
          "start": "allow",
          "selectionOrder": "join-first",
          "join": {
            "allow": true,
            "minHoursBeforeStall": 0,
            "maxHoursBeforeStall": 24,
          },
        },
        "Window of Opportunity": {
          "start": "allow",
          "selectionOrder": "join-first",
          "join": {
            "allow": true,
            "minHoursBeforeStall": 0,
            "maxHoursBeforeStall": 24,
          },
        },
        "Manifest Cruelty": {
          "start": "never",
          "join": {
            "allow": false,
          },
        },
        "Gone Fission": {
          "start": "never",
          "join": {
            "allow": false,
          },
        },
        "Crane Reaction": {
          "start": "never",
          "join": {
            "allow": false,
          },
        },
      },
    },
    "maxCount": {
      "10": 0,
      "9": 2,
      "8": 99,
      "7": 9,
    },
    "usageLogging": "no",
    "treatAsStalled": 6,
  };

  // Fallback values
  const fallbackMinCPR = { 7: 70 };

  // Will be populated from configured priority data
  let stallPolicy;
  let maxCounts = {};
  let treatAsStalledHours = null;

  // Priority-based data structure
  let priorityData;

  // Current user info - will be populated when needed
  let currentUser = null;

  // User role state cache - will be populated when needed
  let userRoleState = null;

  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function getScenarioRoles(scenario) {
    const candidates = Array.from(
      scenario.querySelectorAll('div[class^="wrapper___"], div[class*="wrapper___"]'),
    ).filter(
      (element) =>
        queryFirst(element, [
          'div[class^="successChance___"]',
          'div[class*="successChance"]',
        ]) &&
        queryFirst(element, [
          'span[class^="title___"]',
          'span[class*="title"]',
        ]),
    );

    return candidates.filter(
      (candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other)),
    );
  }

  function getSlotIconElement(role) {
    return queryFirst(role, ['.slotIcon___VVnQy', '[class*="slotIcon"]']);
  }

  function getPlanningElement(root) {
    return queryFirst(root, ['.planning___CjB09', '[class*="planning"]']);
  }

  function getInactiveElement(root) {
    return queryFirst(root, ['.inactive___Dpqh0', '[class*="inactive"]']);
  }

  function getBadgeElement(role) {
    return queryFirst(role, ['.badge___E7fuw', '[class*="badge"]']);
  }

  function getScenarioLevelElement(scenario) {
    return queryFirst(scenario, [
      'span[class^="levelValue___"]',
      'span[class*="levelValue"]',
    ]);
  }

  function getScenarioLevel(scenario) {
    const levelEl = getScenarioLevelElement(scenario);
    if (!levelEl) return null;

    const level = parseInt(levelEl.textContent.trim(), 10);
    return Number.isFinite(level) ? level : null;
  }

  function isScenarioPaused(scenario) {
    return !!queryFirst(scenario, [
      '.phase___LcbAX .paused___oWz6S',
      '[class*="phase"] [class*="paused"]',
      '[class*="paused"]',
    ]);
  }

  function isStatusIconLink(link) {
    return !!link.closest('ul.status-icons___gPkXF, ul[class*="status-icons"], li[class^="icon"], li[class*="icon"]');
  }

  function isElementActive(element) {
    if (!element) return false;

    const className =
      typeof element.className === 'string'
        ? element.className
        : element.getAttribute('class') || '';

    return (
      /active/i.test(className) ||
      element.getAttribute('aria-selected') === 'true' ||
      element.getAttribute('aria-current') === 'page' ||
      element.getAttribute('data-state') === 'active'
    );
  }

  function getActiveTextMatchedElement(textPattern) {
    return getTextMatchedElements(textPattern).find((element) => {
      const container = element.closest('[role="tab"], button, a, [class*="button"], [class*="tab"]') || element;
      return isElementActive(element) || isElementActive(container);
    });
  }

  function getScenarioTimingData(scenario) {
    const noRolesFilled = hasNoRolesFilled(scenario);

    if (noRolesFilled) {
      return {
        noRolesFilled,
        bufferSeconds: 0,
        hoursBeforeStall: 0,
      };
    }

    let zeroDegCount = 0;
    const roles = getScenarioRoles(scenario);
    roles.forEach((role) => {
      const slotIcon = getSlotIconElement(role);
      if (
        slotIcon &&
        !getPlanningElement(slotIcon) &&
        !getInactiveElement(slotIcon) &&
        slotIcon.querySelector("svg")
      ) {
        zeroDegCount++;
      }
    });

    const clockStr =
      scenario
        .querySelector('[class*="title"] span[aria-hidden="true"], span[aria-hidden="true"]')
        ?.textContent.trim() || "";

    const parts = clockStr.split(":").map((value) => parseInt(value, 10));
    let totalSeconds = Number.POSITIVE_INFINITY;

    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      const [days, hours, minutes, seconds] = parts;
      totalSeconds = ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
    }

    const minSeconds = zeroDegCount * 24 * 60 * 60;
    const bufferSeconds = Number.isFinite(totalSeconds)
      ? Math.max(0, totalSeconds - minSeconds)
      : Number.POSITIVE_INFINITY;

    return {
      noRolesFilled,
      bufferSeconds,
      hoursBeforeStall: Number.isFinite(bufferSeconds)
        ? bufferSeconds / 3600
        : Number.POSITIVE_INFINITY,
      treatAsStalled:
        !noRolesFilled &&
        typeof treatAsStalledHours === "number" &&
        Number.isFinite(bufferSeconds) &&
        bufferSeconds / 3600 <= treatAsStalledHours,
    };
  }

  function getCandidateUrgencyRank(candidate) {
    return candidate.treatAsStalled ? 0 : 1;
  }

  function getResolvedScenarioPolicy(scenarioName) {
    const policy = stallPolicy || {};
    const defaults = policy.default || {};
    const defaultJoin = defaults.join || {};
    const scenarioOverrides = (policy.scenarios || {})[scenarioName] || {};
    const scenarioJoin = scenarioOverrides.join || {};

    return {
      start: scenarioOverrides.start || defaults.start || "allow",
      selectionOrder:
        scenarioOverrides.selectionOrder || defaults.selectionOrder || "join-first",
      join: {
        allow:
          typeof scenarioJoin.allow === "boolean"
            ? scenarioJoin.allow
            : typeof defaultJoin.allow === "boolean"
              ? defaultJoin.allow
              : true,
        minHoursBeforeStall:
          typeof scenarioJoin.minHoursBeforeStall === "number"
            ? scenarioJoin.minHoursBeforeStall
            : defaultJoin.minHoursBeforeStall,
        maxHoursBeforeStall:
          typeof scenarioJoin.maxHoursBeforeStall === "number"
            ? scenarioJoin.maxHoursBeforeStall
            : defaultJoin.maxHoursBeforeStall,
      },
    };
  }

  function isStartCandidateAllowed(resolvedPolicy) {
    return resolvedPolicy.start !== "never";
  }

  function isJoinCandidateAllowed(
    resolvedPolicy,
    hoursBeforeStall,
    ignoreTimingWindow,
  ) {
    if (!resolvedPolicy.join.allow) return false;

    if (ignoreTimingWindow) {
      return true;
    }

    const minHours = resolvedPolicy.join.minHoursBeforeStall;
    const maxHours = resolvedPolicy.join.maxHoursBeforeStall;

    if (typeof minHours === "number") {
      if (!Number.isFinite(hoursBeforeStall) || hoursBeforeStall < minHours) {
        return false;
      }
    }

    if (typeof maxHours === "number") {
      if (!Number.isFinite(hoursBeforeStall) || hoursBeforeStall > maxHours) {
        return false;
      }
    }

    return true;
  }

  function isCandidateAllowedByPolicy(candidate) {
    if (candidate.actionType === "start") {
      return isStartCandidateAllowed(candidate.resolvedPolicy);
    }

    return isJoinCandidateAllowed(
      candidate.resolvedPolicy,
      candidate.hoursBeforeStall,
      candidate.ignoreTimingWindow,
    );
  }

  function countTotalScenarios(levelCheck) {
    let count = 0;

    getCachedScenarios().forEach((scenario) => {
      const level = getScenarioLevel(scenario);
      if (!Number.isFinite(level)) return;

      if (level === levelCheck) {
        if (!hasNoRolesFilled(scenario)) {
          count++;
        }
      }
    });

    return count;
  }

  function isLevelOverMaxCount(level) {
    const configuredMax = Number(maxCounts?.[level]);
    if (!Number.isFinite(configuredMax)) return false;

    const currentCount = countTotalScenarios(level);
    return currentCount > configuredMax;
  }

  function getActionPriorityRank(actionType, selectionOrder) {
    const order = selectionOrder || "join-first";
    if (order === "start-first") {
      return actionType === "start" ? 0 : 1;
    }
    return actionType === "join" ? 0 : 1;
  }

  function getTextMatchedElements(textPattern) {
    return Array.from(document.querySelectorAll("button, a, [role='tab']")).filter(
      (element) => textPattern.test(element.textContent.trim()),
    );
  }

  // Cache for expensive DOM queries
  let cachedScenarios = null;
  let scenariosCacheTime = 0;

  // Function to get scenarios with caching
  function getCachedScenarios() {
    const now = Date.now();
    if (
      cachedScenarios &&
      now - scenariosCacheTime < CONFIG.SCENARIOS_CACHE_DURATION
    ) {
      return cachedScenarios;
    }

    cachedScenarios = document.querySelectorAll('[data-oc-id]');
    scenariosCacheTime = now;
    return cachedScenarios;
  }

  // Function to get current user information
  function getCurrentUser() {
    if (currentUser?.id && currentUser?.name) return currentUser;

    const knownUser = currentUser || {};

    try {
      // Method 1: Try to get from torn-user hidden input (most reliable)
      const tornUserInput = document.getElementById("torn-user");
      if (tornUserInput && tornUserInput.value) {
        try {
          const userData = JSON.parse(tornUserInput.value);
          currentUser = {
            id: userData.id || knownUser.id || null,
            name: userData.playername || userData.username || knownUser.name || null,
            avatar: userData.avatar || knownUser.avatar || null,
          };
          return currentUser;
        } catch {
          // Continue to fallback methods
        }
      }

      // Method 2: Try to extract from profile link in settings menu
      const profileLink = document.querySelector(
        '.settings-menu .link a[href*="/profiles.php?XID="]',
      );
      if (profileLink) {
        const href = profileLink.getAttribute("href");
        const xidMatch = href.match(/XID=(\d+)/);
        if (xidMatch) {
          currentUser = {
            id: xidMatch[1],
            name: knownUser.name || null,
            avatar: knownUser.avatar || null,
          };
          return currentUser;
        }
      }

      // Method 3: Try to extract from avatar image src
      const avatarImg = document.querySelector(".mini-avatar-image");
      if (avatarImg) {
        const src = avatarImg.getAttribute("src");
        if (src) {
          const idMatch = src.match(/-(\d+)\.gif$/);
          if (idMatch) {
            currentUser = {
              id: idMatch[1],
              name: knownUser.name || null,
              avatar: src,
            };
            return currentUser;
          }
        }
      }

      currentUser = knownUser.id || knownUser.name ? knownUser : null;
      return currentUser;
    } catch {
      return currentUser;
    }
  }

  // Helper function to check if a role is in active planning state
  function isRoleInPlanning(role) {
    const slotIcon = getSlotIconElement(role);
    if (!slotIcon) return false;

    const planningDiv = getPlanningElement(slotIcon);
    if (!planningDiv) return false;

    const style = planningDiv.getAttribute("style");
    if (!style) return false;

    // Check if the conic-gradient does not equal 0deg
    const gradientMatch = style.match(
      /var\(--oc-clock-planning-bg\)\s*(\d+(?:\.\d+)?)deg/,
    );
    if (gradientMatch) {
      const degreeValue = parseFloat(gradientMatch[1]);
      return degreeValue > 0;
    }

    return false;
  }

  // Helper function to get user's role state (cached)
  function getUserRoleState() {
    const now = Date.now();
    if (
      userRoleState &&
      now - userRoleState.lastChecked < CONFIG.USER_STATE_CACHE_DURATION
    ) {
      return userRoleState;
    }

    const user = getCurrentUser();
    const newState = {
      hasRole: false,
      role: null,
      isPlanning: false,
      hasMissingItems: false,
      lastChecked: now,
    };

    if (!user || !user.name) {
      userRoleState = newState;
      return userRoleState;
    }

    // Find user's role
    getCachedScenarios().forEach((scenario) => {
      scenario
        .querySelectorAll('div[class^="wrapper___Lpz_D"], div[class*="wrapper___"]')
        .forEach((role) => {
          const badge = getBadgeElement(role);
          if (badge && badge.textContent.trim() === user.name) {
            newState.hasRole = true;
            newState.role = role;
            newState.isPlanning = isRoleInPlanning(role);

            // Check if role is inactive (missing items)
            const slotIcon = getSlotIconElement(role);
            if (slotIcon) {
              // Check for inactive class (primary method)
              const hasInactiveClass = getInactiveElement(slotIcon);

              // Check for specific missing items SVG pattern (backup method)
              const missingItemsSvg = slotIcon.querySelector(
                'svg path[fill="#ff794c"]',
              );
              let isMissingItemsIcon = false;

              if (missingItemsSvg) {
                const pathData = missingItemsSvg.getAttribute("d");
                // Missing items icon has this specific pattern with circle and diagonal lines
                if (
                  pathData &&
                  pathData.includes("M5,0a5,5,0,1,0,5,5A5,5,0,0,0,5,0Z")
                ) {
                  isMissingItemsIcon = true;
                }
              }

              if (hasInactiveClass || isMissingItemsIcon) {
                newState.hasMissingItems = true;
              }
            }
          }
        });
    });

    userRoleState = newState;
    return userRoleState;
  }

  // Helper function to check if user has missing items
  function doesUserHaveMissingItems() {
    return getUserRoleState().hasMissingItems;
  }

  // Cache for navigation links
  let cachedNavigationLinks = null;
  let navigationCacheTime = 0;

  // Helper function to get navigation links for highlighting
  function getNavigationLinks() {
    const now = Date.now();
    if (
      cachedNavigationLinks &&
      now - navigationCacheTime < CONFIG.NAVIGATION_CACHE_DURATION
    ) {
      return cachedNavigationLinks;
    }

    cachedNavigationLinks = {
      crimesLinks: Array.from(
        document.querySelectorAll(
          'a[href*="factions.php?step=your"], a[href*="#/tab=crimes"], a[href="#faction-crimes"]',
        ),
      ).filter((a) => {
        if (isStatusIconLink(a)) {
          return false;
        }

        const text = a.textContent.trim().toLowerCase();
        const label = (a.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('crime') || label.includes('organized crime');
      }),

      // Fallback "My Faction" links
      myFactionLinks: Array.from(
        document.querySelectorAll('a'),
      ).filter((a) => a.textContent.trim().toLowerCase() === "my faction"),

      // Crimes tab link
      crimesTabLink: document.querySelector(
        'a.ui-tabs-anchor[href="#faction-crimes"]',
      ),
    };

    navigationCacheTime = now;
    return cachedNavigationLinks;
  }

  // Helper function to apply highlighting to navigation elements
  function highlightNavigationElements(cssClass) {
    const links = getNavigationLinks();

    // Highlight primary navigation links
    links.crimesLinks.forEach((link) => link.classList.add(cssClass));

    // Use fallback if primary links not found
    if (
      links.crimesLinks.length === 0 &&
      links.myFactionLinks.length > 0
    ) {
      links.myFactionLinks.forEach((link) => link.classList.add(cssClass));
    }

    // Highlight crimes tab
    if (links.crimesTabLink) {
      links.crimesTabLink.classList.add(cssClass);
    }
  }

  function startHighlighting() {
    let highlightTimeout = null; // Debounce timeout for highlighting
    let isHighlighting = false; // Flag to prevent overlapping highlights
    let currentHighlightedRole = null;
    let lastScanMessage = "";
    const startupTime = Date.now();

    function logScanState(message, details = {}) {
      const signature = `${message}:${JSON.stringify(details)}`;
      if (signature === lastScanMessage) {
        return;
      }

      lastScanMessage = signature;
      console.log(`[OC Assistant] ${message}`, details);
    }

    function isTargetCrimesPage() {
      const urlParams = new URLSearchParams(window.location.search);
      const step = urlParams.get("step");
      const hash = window.location.hash.toLowerCase();
      const isCrimesHash =
        hash.includes("tab=crimes") || hash.includes("faction-crimes");

      return (
        window.location.pathname.endsWith("/factions.php") &&
        step === "your" &&
        isCrimesHash
      );
    }

    function hasActiveTabText(textPattern) {
      return !!getActiveTextMatchedElement(textPattern);
    }

    // Check if we're on the recruiting tab. Torn has changed tab markup before,
    // so fall back to the crimes page with visible OC scenario cards.
    function isOnRecruitingPage() {
      if (!isTargetCrimesPage()) {
        return false;
      }

      if (hasActiveTabText(/recruiting|recruitment|available/i)) {
        return true;
      }

      if (hasActiveTabText(/planning|planned/i)) {
        return false;
      }

      return getCachedScenarios().length > 0;
    }

    // Inject styles once
    injectStyles();

    // Inject required CSS styles once
    function injectStyles() {
      if (!document.getElementById("oc-assistant-styles")) {
        const style = document.createElement("style");
        style.id = "oc-assistant-styles";
        style.textContent = `
          @keyframes pulseGlow {
            0% { box-shadow: 0 0 12px 4px #00ffee; }
            50% { box-shadow: 0 0 18px 8px #00ffee; }
            100% { box-shadow: 0 0 12px 4px #00ffee; }
          }
          .pulsing-glow {
            animation: pulseGlow 1.5s infinite;
            border-radius: 8px;
            outline: 2px solid #00ffee !important;
            outline-offset: 2px;
            position: relative;
            z-index: 2;
          }
          .oc-highlight {
            background: #4e8c1a !important;
            color: #fff !important;
            border-radius: 4px;
            padding: 0 4px;
            transition: background 0.3s, color 0.3s;
            text-shadow: 0 1px 2px #222;
          }
          .oc-missing-items-highlight {
            background: #ff4444 !important;
            color: #fff !important;
            border-radius: 4px;
            padding: 0 4px;
            transition: background 0.3s, color 0.3s;
            text-shadow: 0 1px 2px #222;
          }
          #oc-assistant-status {
            box-sizing: border-box;
            width: 100%;
            margin: 8px 0 10px;
            padding: 8px 10px;
            border: 1px solid rgba(226, 169, 36, 0.55);
            border-left: 4px solid #e2a924;
            border-radius: 4px;
            background: rgba(226, 169, 36, 0.14);
            color: inherit;
            font-size: 12px;
            line-height: 1.35;
          }
          #oc-assistant-status.oc-assistant-status-hidden {
            display: none !important;
          }
          #oc-assistant-status .oc-assistant-status-title {
            display: block;
            font-weight: 700;
          }
          #oc-assistant-status .oc-assistant-status-detail {
            display: block;
            margin-top: 2px;
            opacity: 0.82;
          }
        `;
        document.head.appendChild(style);
      }
    }

    function getAssistantStatusHost() {
      return document.querySelector("[data-oc-id]")?.parentElement || null;
    }

    function getAssistantStatusElement() {
      let status = document.getElementById("oc-assistant-status");
      const host = getAssistantStatusHost();
      const firstScenario = document.querySelector("[data-oc-id]");

      if (!host || !firstScenario) {
        removeAssistantStatus();
        return null;
      }

      if (!status) {
        status = document.createElement("div");
        status.id = "oc-assistant-status";
        status.className = "oc-assistant-status-hidden";

        const title = document.createElement("span");
        title.className = "oc-assistant-status-title";
        status.appendChild(title);

        const detail = document.createElement("span");
        detail.className = "oc-assistant-status-detail";
        status.appendChild(detail);
      }

      if (status.parentElement !== host) {
        host.insertBefore(status, firstScenario);
      } else if (status.nextElementSibling !== firstScenario) {
        host.insertBefore(status, firstScenario);
      }

      return status;
    }

    function setAssistantStatus(titleText, detailText) {
      if (!isTargetCrimesPage()) {
        removeAssistantStatus();
        return false;
      }

      const status = getAssistantStatusElement();
      if (!status) {
        return false;
      }

      queryFirst(status, [".oc-assistant-status-title"]).textContent = titleText;
      queryFirst(status, [".oc-assistant-status-detail"]).textContent = detailText;
      status.classList.remove("oc-assistant-status-hidden");
      return true;
    }

    function hideAssistantStatus() {
      const status = document.getElementById("oc-assistant-status");
      if (status) {
        status.classList.add("oc-assistant-status-hidden");
      }
    }

    function removeAssistantStatus() {
      document.getElementById("oc-assistant-status")?.remove();
    }

    function clearCurrentHighlight() {
      if (currentHighlightedRole && currentHighlightedRole.isConnected) {
        currentHighlightedRole.classList.remove("pulsing-glow");
      }
      currentHighlightedRole = null;
    }

    function isScrollableElement(element) {
      if (!element || element === document.body) return false;

      const style = window.getComputedStyle(element);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);
      return canScrollY && element.scrollHeight > element.clientHeight + 4;
    }

    function getScrollableAncestor(element) {
      let parent = element?.parentElement || null;

      while (parent && parent !== document.body && parent !== document.documentElement) {
        if (isScrollableElement(parent)) {
          return parent;
        }

        parent = parent.parentElement;
      }

      return document.scrollingElement || document.documentElement;
    }

    function centerRoleInView(role) {
      const scroller = getScrollableAncestor(role);
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 4) {
        return;
      }

      const roleRect = role.getBoundingClientRect();
      const scrollerRect =
        scroller === document.scrollingElement || scroller === document.documentElement
          ? { top: 0, height: window.innerHeight || document.documentElement.clientHeight }
          : scroller.getBoundingClientRect();
      const roleCenter = roleRect.top + roleRect.height / 2;
      const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
      const delta = roleCenter - scrollerCenter;

      if (Math.abs(delta) < 24) {
        return;
      }

      scroller.scrollBy({
        top: delta,
        behavior: "smooth",
      });
    }

    function applyRoleHighlight(role) {
      if (currentHighlightedRole === role) {
        return;
      }

      if (currentHighlightedRole && currentHighlightedRole.isConnected) {
        currentHighlightedRole.classList.remove("pulsing-glow");
      }

      currentHighlightedRole = role;

      if (currentHighlightedRole) {
        currentHighlightedRole.classList.add("pulsing-glow");
        centerRoleInView(currentHighlightedRole);
      }
    }

    function getRoleDebugLabel(role) {
      const scenario = role.closest("[data-oc-id]");
      const crimeName = scenario ? getCrimeName(scenario) : "Unknown crime";
      const roleName =
        queryFirst(role, [
          'span[class^="title___"]',
          'span[class*="title"]',
        ])?.textContent.trim() || "Unknown role";
      const chance =
        queryFirst(role, [
          'div[class^="successChance___"]',
          'div[class*="successChance"]',
        ])?.textContent.trim() || "unknown CPR";

      return `${crimeName} / ${roleName} / ${chance}`;
    }

    function isUserStateReadyForFallback(userState) {
      if (userState.hasRole) {
        return true;
      }

      // Torn role assignment can lag briefly after page load. Do not fall back
      // to non-user recommendations until a short warmup window has elapsed.
      const warmupElapsed = Date.now() - startupTime > 2500;
      return warmupElapsed;
    }

    // Function to check for missing items (inactive roles for current user)
    function checkForMissingItems() {
      if (!isTargetCrimesPage()) {
        localStorage.removeItem("oc_missing_items");
        removeRedHighlighting();
        return;
      }

      const user = getCurrentUser();
      if (!user || !user.name) return;

      // Use helper function to check if user has missing items
      const hasMissingItems = doesUserHaveMissingItems();

      if (hasMissingItems) {
        localStorage.setItem("oc_missing_items", "1");
        highlightNavigationForMissingItems();
      } else {
        localStorage.removeItem("oc_missing_items");
        removeRedHighlighting();
      }
    }

    // Function to highlight the Crimes tab and "Organized Crimes" navigation button in red
    let joinMissingItemsPollId = null;

    function highlightNavigationForMissingItems() {
      highlightNavigationElements("oc-missing-items-highlight");
    }

    // Function to remove red highlighting for missing items
    function removeRedHighlighting() {
      document
        .querySelectorAll(".oc-missing-items-highlight")
        .forEach((el) => el.classList.remove("oc-missing-items-highlight"));
    }

    function clearPageEffects() {
      clearCurrentHighlight();
      removeAssistantStatus();
      removeRedHighlighting();
      document
        .querySelectorAll(".oc-highlight")
        .forEach((el) => el.classList.remove("oc-highlight"));
    }

    // After a join, poll briefly for missing-items state (inactive icon can appear late)
    function startJoinMissingItemsPolling() {
      if (joinMissingItemsPollId) {
        clearInterval(joinMissingItemsPollId);
      }

      const pollStart = performance.now();
      const maxPollMs = 12000;
      const pollIntervalMs = 250;

      joinMissingItemsPollId = setInterval(() => {
        if (!isTargetCrimesPage()) {
          clearInterval(joinMissingItemsPollId);
          joinMissingItemsPollId = null;
          return;
        }

        userRoleState = null;
        cachedScenarios = null;

        const state = getUserRoleState();

        if (state.hasMissingItems) {
          clearInterval(joinMissingItemsPollId);
          joinMissingItemsPollId = null;
          localStorage.setItem("oc_missing_items", "1");
          highlightNavigationForMissingItems();
          return;
        }

        if (performance.now() - pollStart >= maxPollMs) {
          clearInterval(joinMissingItemsPollId);
          joinMissingItemsPollId = null;
        }
      }, pollIntervalMs);
    }

    // Consolidated function to find and highlight best role (checks user priorities first)
    function highlightBestRole() {
      // Prevent overlapping highlight operations
      if (isHighlighting) return false;
      isHighlighting = true;

      try {
        // Only highlight roles if we're on the recruiting page
        if (!isOnRecruitingPage()) {
          clearCurrentHighlight();
          if (isTargetCrimesPage()) {
            setAssistantStatus(
              "OC Role Assistant is waiting for recruitable roles.",
              "Open the recruiting view, or wait for Torn to finish loading the organized crimes list.",
            );
          } else {
            clearPageEffects();
          }
          logScanState("Waiting for the OC recruiting page", {
            path: window.location.pathname,
            hash: window.location.hash,
            scenarios: getCachedScenarios().length,
          });
          return false;
        }

        // Cache user state once at the beginning to avoid circular dependencies
        const userState = getUserRoleState();
        const userHasMissingItems = userState.hasMissingItems;
        const userIsPlanning = userState.isPlanning;

        if (!isUserStateReadyForFallback(userState)) {
          setAssistantStatus(
            "OC Role Assistant is scanning roles.",
            "Waiting briefly for Torn to finish loading your current role state.",
          );
          logScanState("Waiting for Torn to finish loading role state", {
            scenarios: getCachedScenarios().length,
          });
          return false;
        }

        let bestRole = null;

        // PRIORITY 1: Check if user has missing items - highlight their inactive role
        if (userHasMissingItems) {
          if (userState.role) {
            bestRole = userState.role;
          }
        }

        // PRIORITY 2: Check if user is planning - highlight their planning role
        if (!bestRole && userIsPlanning) {
          if (userState.role) {
            bestRole = userState.role;
          }
        }

        // PRIORITY 3: Check paused scenarios first (but use priority-based selection)
        if (!bestRole) {
          bestRole = findBestPausedScenarioRole(
            userHasMissingItems,
            userIsPlanning,
          );
        }

        // PRIORITY 4: If no paused scenarios, use scenario-based logic with priority groups
        if (!bestRole) {
          bestRole = findBestScenarioRole(userHasMissingItems, userIsPlanning);
        }

        if (bestRole) {
          applyRoleHighlight(bestRole);
          hideAssistantStatus();
          logScanState("Highlighted a recommended role", {
            role: getRoleDebugLabel(bestRole),
          });
          return true;
        }

        clearCurrentHighlight();
        setAssistantStatus(
          "No matching OC role found.",
          `Visible OCs: ${getCachedScenarios().length}. Priority groups: ${
            priorityData ? Object.keys(priorityData).length : 0
          }. No open visible role met the configured CPR, policy, and timing rules.`,
        );
        logScanState("No qualifying role found", {
          scenarios: getCachedScenarios().length,
          priorityGroups: priorityData ? Object.keys(priorityData).length : 0,
          userHasRole: userState.hasRole,
          userHasMissingItems,
          userIsPlanning,
        });
        return false;
      } finally {
        isHighlighting = false;
      }
    }

    // Debounced highlight function to prevent flicker
    function debouncedHighlight() {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      // Set a new timeout
      highlightTimeout = setTimeout(() => {
        highlightBestRole();
        highlightTimeout = null;
      }, CONFIG.DEBOUNCE_DELAY); // 150ms debounce
    }

    // Immediate check for missing items without debounce
    let missingItemsCheckTimeout = null;
    function debouncedMissingItemsCheck() {
      if (missingItemsCheckTimeout) {
        clearTimeout(missingItemsCheckTimeout);
      }
      missingItemsCheckTimeout = setTimeout(() => {
        checkForMissingItems();
        missingItemsCheckTimeout = null;
      }, 50); // 50ms debounce - faster for missing items
    }

    // Function to find best role using role priority-based logic
    function findBestScenarioRole(userHasMissingItems, userIsPlanning) {
      let bestRole = null;
      const isOverLevel7MaxCount = isLevelOverMaxCount(7);

      // Get all priority levels and sort them (lowest number = highest priority)
      const priorityLevels = priorityData
        ? Object.keys(priorityData)
            .map((p) => parseInt(p))
            .sort((a, b) => a - b)
        : [];

      // Go through each priority group in order
      for (const priority of priorityLevels) {
        if (bestRole) break;

        const priorityGroup = priorityData[priority.toString()];
        if (!priorityGroup) continue;

        // For this priority group, find all qualifying roles across all scenarios
        const qualifyingRoles = [];
        const user = getCurrentUser();

        // Check each role definition in this priority group
        for (const roleConfig of priorityGroup) {
          const {
            scenario: scenarioName,
            role: roleName,
            minCPR,
            level,
          } = roleConfig;

          // Find all scenarios that match this scenario name
          getCachedScenarios().forEach((scenario) => {
            const currentScenarioName = getCrimeName(scenario);
            if (currentScenarioName !== scenarioName) return;

            const isPaused = isScenarioPaused(scenario);
            const timingData = getScenarioTimingData(scenario);
            const { noRolesFilled, hoursBeforeStall, treatAsStalled } = timingData;
            const resolvedPolicy = getResolvedScenarioPolicy(scenarioName);
            const actionType = noRolesFilled ? "start" : "join";

            // Find the specific role in this scenario
            const roleElement = findRoleInScenario(scenario, roleName);
            if (!roleElement) return;

            // Check if role is available and get its info
            const roleInfo = extractRoleInfo(
              roleElement,
              user,
              userHasMissingItems,
              userIsPlanning,
            );
            if (!roleInfo) return;

            const { chance } = roleInfo;
            if (chance < minCPR) return; // Doesn't meet minimum CPR

            // Calculate stalling metrics for this scenario
            let stallingScore = calculateStallingScore(
              scenario,
              isPaused,
              noRolesFilled,
              timingData,
            );

            const candidate = {
              roleElement,
              chance,
              priority,
              minCPR,
              level,
              stallingScore,
              isPaused,
              noRolesFilled,
              actionType,
              treatAsStalled,
              ignoreTimingWindow:
                level === 7 && actionType === "join" && isOverLevel7MaxCount,
              hoursBeforeStall,
              resolvedPolicy,
              scenarioName,
              roleName,
            };

            if (!isCandidateAllowedByPolicy(candidate)) return;

            qualifyingRoles.push(candidate);
          });
        }

        if (qualifyingRoles.length === 0) continue;

        // Sort qualifying roles by:
        // 1. Treat-as-stalled crimes first
        // 2. Scenario-specific join/start preference
        // 3. Closest to stalling
        // 4. Highest CPR within the group
        qualifyingRoles.sort((a, b) => {
          const aUrgencyRank = getCandidateUrgencyRank(a);
          const bUrgencyRank = getCandidateUrgencyRank(b);
          if (aUrgencyRank !== bUrgencyRank) {
            return aUrgencyRank - bUrgencyRank;
          }

          // First priority: scenario-specific join/start preference
          const aActionRank = getActionPriorityRank(
            a.actionType,
            a.resolvedPolicy.selectionOrder,
          );
          const bActionRank = getActionPriorityRank(
            b.actionType,
            b.resolvedPolicy.selectionOrder,
          );
          if (aActionRank !== bActionRank) {
            return aActionRank - bActionRank;
          }

          // First priority: stalling score (lower = more urgent)
          if (a.stallingScore !== b.stallingScore) {
            return a.stallingScore - b.stallingScore;
          }
          // Second priority: highest CPR
          return b.chance - a.chance;
        });

        // Take the best role from this priority group
        bestRole = qualifyingRoles[0].roleElement;
        break; // Found our role, don't check lower priority groups
      }

      // FALLBACK: Level-based priorities for unknown roles (priority 999)
      if (!bestRole) {
        bestRole = findFallbackRole(userHasMissingItems, userIsPlanning);
      }

      return bestRole;
    }

    // Helper function to find a specific role in a scenario
    function findRoleInScenario(scenario, roleName) {
      const roles = getScenarioRoles(scenario);
      for (const role of roles) {
        const roleNameEl = queryFirst(role, [
          'span[class^="title___"]',
          'span[class*="title"]',
        ]);
        const currentRoleName = roleNameEl ? roleNameEl.textContent.trim() : "";
        if (currentRoleName === roleName) {
          return role;
        }
      }
      return null;
    }

    // Function to find best role in paused scenarios using priority-based selection
    function findBestPausedScenarioRole(userHasMissingItems, userIsPlanning) {
      let bestRole = null;
      const isOverLevel7MaxCount = isLevelOverMaxCount(7);

      // Get all priority levels and sort them (lowest number = highest priority)
      const priorityLevels = priorityData
        ? Object.keys(priorityData)
            .map((p) => parseInt(p))
            .sort((a, b) => a - b)
        : [];

      // Go through each priority group in order
      for (const priority of priorityLevels) {
        if (bestRole) break;

        const priorityGroup = priorityData[priority.toString()];
        if (!priorityGroup) continue;

        // For this priority group, find all qualifying roles in PAUSED scenarios only
        const qualifyingRoles = [];
        const user = getCurrentUser();

        // Check each role definition in this priority group
        for (const roleConfig of priorityGroup) {
          const {
            scenario: scenarioName,
            role: roleName,
            minCPR,
            level,
          } = roleConfig;

          // Find all scenarios that match this scenario name
          getCachedScenarios().forEach((scenario) => {
            // Only consider paused scenarios
            const isPaused = isScenarioPaused(scenario);
            if (!isPaused) return;

            const currentScenarioName = getCrimeName(scenario);
            if (currentScenarioName !== scenarioName) return;

            const timingData = getScenarioTimingData(scenario);
            const { noRolesFilled, hoursBeforeStall, treatAsStalled } = timingData;
            const resolvedPolicy = getResolvedScenarioPolicy(scenarioName);
            const actionType = noRolesFilled ? "start" : "join";

            // Find the specific role in this scenario
            const roleElement = findRoleInScenario(scenario, roleName);
            if (!roleElement) return;

            // Check if role is available and get its info
            const roleInfo = extractRoleInfo(
              roleElement,
              user,
              userHasMissingItems,
              userIsPlanning,
            );
            if (!roleInfo) return;

            const { chance } = roleInfo;
            if (chance < minCPR) return; // Doesn't meet minimum CPR

            const candidate = {
              roleElement,
              chance,
              priority,
              minCPR,
              level,
              stallingScore: calculateStallingScore(
                scenario,
                isPaused,
                noRolesFilled,
                timingData,
              ),
              noRolesFilled,
              actionType,
              treatAsStalled,
              ignoreTimingWindow:
                level === 7 && actionType === "join" && isOverLevel7MaxCount,
              hoursBeforeStall,
              resolvedPolicy,
              scenarioName,
              roleName,
            };

            if (!isCandidateAllowedByPolicy(candidate)) return;

            qualifyingRoles.push(candidate);
          });
        }

        if (qualifyingRoles.length === 0) continue;

        // Sort qualifying roles by:
        // 1. Treat-as-stalled crimes first
        // 2. Scenario-specific join/start preference
        // 3. Stalling urgency
        // 4. Highest CPR within the group
        qualifyingRoles.sort((a, b) => {
          const aUrgencyRank = getCandidateUrgencyRank(a);
          const bUrgencyRank = getCandidateUrgencyRank(b);
          if (aUrgencyRank !== bUrgencyRank) {
            return aUrgencyRank - bUrgencyRank;
          }

          // First priority: scenario-specific join/start preference
          const aActionRank = getActionPriorityRank(
            a.actionType,
            a.resolvedPolicy.selectionOrder,
          );
          const bActionRank = getActionPriorityRank(
            b.actionType,
            b.resolvedPolicy.selectionOrder,
          );
          if (aActionRank !== bActionRank) {
            return aActionRank - bActionRank;
          }

          // Second priority: stalling urgency
          if (a.stallingScore !== b.stallingScore) {
            return a.stallingScore - b.stallingScore;
          }

          // Third priority: highest CPR
          return b.chance - a.chance;
        });

        // Take the best role from this priority group in paused scenarios
        bestRole = qualifyingRoles[0].roleElement;
        break; // Found our role, don't check lower priority groups
      }

      return bestRole;
    }

    // Helper function to calculate stalling score (lower = more urgent)
    function calculateStallingScore(scenario, isPaused, noRolesFilled, timingData) {
      const timing = timingData || getScenarioTimingData(scenario);

      // Empty scenarios are highest priority within normal (non-paused) groups
      if (noRolesFilled || timing.noRolesFilled) return 0;

      if (!Number.isFinite(timing.bufferSeconds)) return Number.MAX_SAFE_INTEGER;

      // Return buffer as score (lower buffer = higher priority)
      // Add 1 to ensure active scenarios come after empty (0)
      return 1 + Math.max(0, timing.bufferSeconds);
    }

    // Fallback function for unknown roles: level 7 only, CPR >= 70 or Picklock #2
    function findFallbackRole(userHasMissingItems, userIsPlanning) {
      const fallbackMin = fallbackMinCPR[7] || 70;
      const user = getCurrentUser();
      let bestRole = null;
      let bestChance = -Infinity;

      for (const scenario of getCachedScenarios()) {
        const level = getScenarioLevel(scenario);
        if (level !== 7) continue;

        const roles = getScenarioRoles(scenario);
        for (const role of roles) {
          const roleInfo = extractRoleInfo(
            role,
            user,
            userHasMissingItems,
            userIsPlanning,
          );
          if (!roleInfo) continue;

          const { chance } = roleInfo;
          if (chance >= fallbackMin && chance > bestChance) {
            bestChance = chance;
            bestRole = role;
          }
        }
      }

      if (bestRole) return bestRole;

      const fallbackRoleName = "Picklock #2";
      for (const scenario of getCachedScenarios()) {
        const level = getScenarioLevel(scenario);
        if (level !== 7) continue;

        const role = findRoleInScenario(scenario, fallbackRoleName);
        if (!role) continue;

        const roleInfo = extractRoleInfo(
          role,
          user,
          userHasMissingItems,
          userIsPlanning,
        );
        if (!roleInfo) continue;

        return role;
      }

      return null;
    }

    function handlePageStateChanged() {
      cachedScenarios = null;
      cachedNavigationLinks = null;
      userRoleState = null;

      if (!isTargetCrimesPage()) {
        clearPageEffects();
        logScanState("Route inactive", {
          path: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
        });
        return;
      }

      debouncedMissingItemsCheck();
      debouncedHighlight();
      highlightOCMenuIfNeeded();
    }

    function installRouteChangeHooks() {
      const marker = "__ocRoleAssistantRouteHooksInstalled";
      if (window[marker]) {
        return;
      }

      window[marker] = true;

      ["pushState", "replaceState"].forEach((method) => {
        const original = history[method];
        history[method] = function (...args) {
          const result = original.apply(this, args);
          window.dispatchEvent(new Event("oc-assistant-route-change"));
          return result;
        };
      });

      window.addEventListener("hashchange", handlePageStateChanged);
      window.addEventListener("popstate", handlePageStateChanged);
      window.addEventListener("oc-assistant-route-change", handlePageStateChanged);
    }

    function highlightOCMenuIfNeeded() {
      if (!isTargetCrimesPage()) {
        document
          .querySelectorAll(".oc-highlight")
          .forEach((el) => el.classList.remove("oc-highlight"));
        return;
      }

      const ocStatusIcon = Array.from(
        document.querySelectorAll('a[aria-label]'),
      ).find((a) =>
        a.getAttribute("aria-label").toLowerCase().includes("organized crime"),
      );

      if (!ocStatusIcon) {
        highlightNavigationElements("oc-highlight");
      } else {
        document
          .querySelectorAll(".oc-highlight")
          .forEach((el) => el.classList.remove("oc-highlight"));
      }
    }

    installRouteChangeHooks();
    highlightOCMenuIfNeeded();
    const ocMenuObserver = new MutationObserver(highlightOCMenuIfNeeded);
    ocMenuObserver.observe(document.body, { childList: true, subtree: true });

    const observer = new MutationObserver((mutations) => {
      // Only process if there are meaningful changes
      let shouldUpdate = false;
      let hasBadgeChange = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          shouldUpdate = true;

          const target = mutation.target;
          if (
            target.classList &&
            (target.classList.contains("pulsing-glow") ||
              target.parentElement?.classList.contains("pulsing-glow"))
          ) {
            return;
          }

          // Check for badge changes (user joining/leaving)
          if (
            target instanceof Element &&
            target.matches('.badge___E7fuw, [class*="badge"]')
          ) {
            hasBadgeChange = true;
          }
          if (
            target instanceof Element &&
            target.closest('.badge___E7fuw, [class*="badge"]')
          ) {
            hasBadgeChange = true;
          }
        }
      });

      if (!shouldUpdate) return;

      if (!isTargetCrimesPage()) {
        clearPageEffects();
        return;
      }

      // Clear caches when DOM changes
      cachedScenarios = null;
      cachedNavigationLinks = null;

      // If badge changed (user joined/left), check for missing items immediately without debounce
      if (hasBadgeChange) {
        checkForMissingItems();
      } else {
        debouncedMissingItemsCheck();
      }

      if (isOnRecruitingPage()) {
        debouncedHighlight();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Direct event listener for join button clicks for instant missing items detection
    document.addEventListener(
      "click",
      (e) => {
        if (!isTargetCrimesPage()) {
          return;
        }

        const joinButton = e.target.closest('.joinButton___Ikoyy, [class*="joinButton"], button, a');
        if (joinButton && /join/i.test(joinButton.textContent.trim())) {
          // Clear user role state cache to force refresh
          userRoleState = null;
          cachedScenarios = null;
          cachedNavigationLinks = null;

          // Short-lived polling to wait for DOM update after join
          const pollStart = performance.now();
          const maxPollMs = 8000;
          const pollIntervalMs = 200;
          const pollId = setInterval(() => {
            userRoleState = null;
            cachedScenarios = null;
            const state = getUserRoleState();

            if (state.hasRole) {
              clearInterval(pollId);
              checkForMissingItems();
              startJoinMissingItemsPolling();
              return;
            }

            if (performance.now() - pollStart >= maxPollMs) {
              clearInterval(pollId);
              checkForMissingItems();
            }
          }, pollIntervalMs);
        }
      },
      true,
    ); // Use capture phase for more reliable detection

    // Initial scan with a short delay to allow Torn's in-page route/content to settle.
    setTimeout(handlePageStateChanged, 300);

    setInterval(() => {
      handlePageStateChanged();
    }, CONFIG.INTERVAL_CHECK);
  }

  // Helper function to extract role information from DOM element
  function extractRoleInfo(role, user, userHasMissingItems, userIsPlanning) {
    const badge = getBadgeElement(role);
    const isOccupied = badge && badge.textContent.trim() !== user?.name;

    // If it's the user's role, check if it has missing items or is in planning
    if (badge && badge.textContent.trim() === user?.name) {
      if (userHasMissingItems || userIsPlanning) {
        return null; // Skip this role
      }
    } else if (isOccupied) {
      return null; // Skip occupied roles
    }

    const roleNameEl = queryFirst(role, [
      'span[class^="title___"]',
      'span[class*="title"]',
    ]);
    const roleName = roleNameEl ? roleNameEl.textContent.trim() : "";
    const chanceEl = queryFirst(role, [
      'div[class^="successChance___"]',
      'div[class*="successChance"]',
    ]);
    if (!chanceEl) return null;

    let chance = chanceEl.textContent.trim().replace("%", "");
    chance = parseFloat(chance);

    return { role, roleName, chance };
  }

  // Helper functions for role selection
  function getCrimeName(scenario) {
    const titleEl = queryFirst(scenario, [
      'p.panelTitle___aoGuV',
      'p[class*="panelTitle"]',
    ]);
    return titleEl ? titleEl.textContent.trim() : null;
  }

  function hasNoRolesFilled(scenario) {
    return !getScenarioRoles(scenario).some((role) => getBadgeElement(role));
  }

  function applyFactionConfig(config, source) {
    priorityData =
      config.priorities && typeof config.priorities === "object"
        ? config.priorities
        : {};
    stallPolicy = config.stallPolicy || null;
    maxCounts = config.maxCount || {};
    treatAsStalledHours =
      typeof config.treatAsStalled === "number" ? config.treatAsStalled : null;

    const ruleCount = Object.values(priorityData).reduce(
      (total, group) => total + (Array.isArray(group) ? group.length : 0),
      0,
    );

    console.log(
      `[OC Assistant] Loaded config from ${source}: ${ruleCount} role rules.`,
    );

    startHighlighting();
  }

  function getCachedFactionConfig(allowExpired = false) {
    const cachedData = localStorage.getItem(CONFIG_CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CONFIG_TIMESTAMP_KEY);

    if (!cachedData || !cacheTimestamp) {
      return null;
    }

    const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);
    if (!allowExpired && cacheAge > CONFIG_CACHE_DURATION) {
      return null;
    }

    try {
      return JSON.parse(cachedData);
    } catch (error) {
      console.log("[OC Assistant] Invalid cached faction config:", error);
      return null;
    }
  }

  function cacheFactionConfig(configText) {
    localStorage.setItem(CONFIG_CACHE_KEY, configText);
    localStorage.setItem(CONFIG_TIMESTAMP_KEY, Date.now().toString());
  }

  function loadFallbackConfig(source) {
    const cachedConfig = getCachedFactionConfig(true);
    applyFactionConfig(
      cachedConfig || DEFAULT_OC_CONFIG,
      cachedConfig ? "cache" : `${source} fallback`,
    );
  }

  function handleConfigResponse(status, responseText) {
    if (status < 200 || status >= 300) {
      console.log("[OC Assistant] Config fetch failed:", status);
      loadFallbackConfig("embedded");
      return;
    }

    try {
      const githubConfig = JSON.parse(responseText);
      cacheFactionConfig(responseText);
      applyFactionConfig(githubConfig, "GitHub");
    } catch (error) {
      console.log("[OC Assistant] Error parsing config:", error);
      loadFallbackConfig("embedded");
    }
  }

  function loadFactionConfig() {
    if (typeof GM_xmlhttpRequest !== "function") {
      fetch(CONFIG_URL, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-cache",
      })
        .then((response) =>
          response.text().then((text) => ({
            status: response.status,
            text,
          })),
        )
        .then(({ status, text }) => handleConfigResponse(status, text))
        .catch((error) => {
          console.log("[OC Assistant] Error fetching config:", error);
          loadFallbackConfig("embedded");
        });
      return;
    }

    GM_xmlhttpRequest({
      method: "GET",
      url: CONFIG_URL,
      headers: {
        Accept: "application/json",
      },
      onload: function (response) {
        handleConfigResponse(response.status, response.responseText);
      },
      onerror: function (error) {
        console.log("[OC Assistant] Error fetching config:", error);
        loadFallbackConfig("embedded");
      },
    });
  }

  // Load the configured priorities
  loadFactionConfig();
})();
