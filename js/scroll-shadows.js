/**
 * Dynamic scroll shadows for horizontally scrollable elements
 * Shows shadows on left/right based on scroll position
 */
(function() {
  'use strict';

  // Get scroll information from an element
  function getScrollInfo(element, checkChildren = true) {
    let scrollLeft = element.scrollLeft;
    let scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;

    if (checkChildren) {
      // Check if there's a code element inside with wider content
      const codeElement = element.querySelector('code');
      if (codeElement && codeElement.scrollWidth > scrollWidth) {
        scrollWidth = codeElement.scrollWidth;
        if (codeElement.scrollLeft > 0 || element.scrollLeft === 0) {
          scrollLeft = Math.max(scrollLeft, codeElement.scrollLeft);
        }
      }

      // Check if there's a table element inside with wider content
      const tableElement = element.querySelector('table');
      if (tableElement && tableElement.scrollWidth > scrollWidth) {
        scrollWidth = tableElement.scrollWidth;
        if (tableElement.scrollLeft > 0 || element.scrollLeft === 0) {
          scrollLeft = Math.max(scrollLeft, tableElement.scrollLeft);
        }
      }
    }

    const maxScroll = scrollWidth - clientWidth;
    // Use a 2px threshold to avoid false positives from sub-pixel rendering
    const hasOverflow = scrollWidth > clientWidth + 2;

    return { scrollLeft, scrollWidth, clientWidth, maxScroll, hasOverflow };
  }

  // Apply shadow classes based on scroll info
  function applyScrollClasses(element, scrollInfo) {
    if (!scrollInfo.hasOverflow) {
      element.classList.remove('has-scroll-shadow-left', 'has-scroll-shadow-right');
      return;
    }

    // Show left shadow if not at the start (with 5px threshold)
    if (scrollInfo.scrollLeft > 5) {
      element.classList.add('has-scroll-shadow-left');
    } else {
      element.classList.remove('has-scroll-shadow-left');
    }

    // Show right shadow if not at the end (with 5px threshold)
    if (scrollInfo.scrollLeft < scrollInfo.maxScroll - 5) {
      element.classList.add('has-scroll-shadow-right');
    } else {
      element.classList.remove('has-scroll-shadow-right');
    }
  }

  // Compatibility wrapper for old code
  function updateScrollShadows(element) {
    const scrollInfo = getScrollInfo(element);
    applyScrollClasses(element, scrollInfo);
  }

  function initScrollShadows() {
    // Select all scrollable pre elements and table wrappers
    const selectors = [
      '.post.adoc .literalblock pre',
      '.post.adoc .listingblock > .content > pre',
      '.post.md pre',  // Markdown code blocks
      '.table-wrapper',  // Detection logic will find admonitionblock inside if needed
    ];

    const scrollables = document.querySelectorAll(selectors.join(', '));
    scrollables.forEach(element => {
      // For table-wrapper, find the actual scrolling element but keep classes on wrapper
      let scrollingElement = element;
      let targetElement = element;  // Element that gets the shadow classes

      // Track if we should check for nested code/table children
      let checkChildren = true;

      if (element.classList.contains('table-wrapper')) {
        // Check for admonitionblock
        const admonitionBlock = element.querySelector(':scope > .admonitionblock');
        if (admonitionBlock) {
          const computedStyle = window.getComputedStyle(admonitionBlock);
          if (computedStyle.overflowX === 'auto' || computedStyle.overflowX === 'scroll') {
            scrollingElement = admonitionBlock;  // Read scroll from this
            targetElement = element;  // But add classes to wrapper
            checkChildren = true;  // Admonitionblock can have table children
          }
        } else {
          // Check for direct table child
          const table = element.querySelector(':scope > table');
          if (table) {
            const computedStyle = window.getComputedStyle(table);
            if (computedStyle.overflowX === 'auto' || computedStyle.overflowX === 'scroll') {
              scrollingElement = table;  // Read scroll from table
              targetElement = element;  // But add classes to wrapper
              checkChildren = false;  // Table is the scrolling element, don't check its children
            }
          }
        }
      }

      // Helper to update shadows with correct target
      const updateShadows = () => {
        const scrollInfo = getScrollInfo(scrollingElement, checkChildren);
        applyScrollClasses(targetElement, scrollInfo);
      };

      // Initial check
      updateShadows();

      // Update on scroll
      scrollingElement.addEventListener('scroll', updateShadows, { passive: true });

      // Only listen to nested code/table elements if checkChildren is true
      if (checkChildren) {
        // Also listen to scroll on the code element inside
        const codeElement = scrollingElement.querySelector('code');
        if (codeElement) {
          codeElement.addEventListener('scroll', updateShadows, { passive: true });
        }

        // Also listen to scroll on the table element inside
        const tableElement = scrollingElement.querySelector('table');
        if (tableElement) {
          tableElement.addEventListener('scroll', updateShadows, { passive: true });
        }
      }
    });

    // Update on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        scrollables.forEach(element => updateScrollShadows(element));
      }, 150);
    }, { passive: true });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollShadows);
  } else {
    initScrollShadows();
  }

  // Recheck after page fully loads (after syntax highlighting, etc.)
  window.addEventListener('load', () => {
    setTimeout(() => {
      const selectors = [
        '.literalblock pre',
        '.listingblock > .content > pre',
        '.post.md pre',
        '.table-wrapper'
      ];
      const scrollables = document.querySelectorAll(selectors.join(', '));
      scrollables.forEach(element => updateScrollShadows(element));
    }, 500);
  });

  // Debug helper - expose function globally
  window.debugScrollShadow = function(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) {
      console.error('Element not found');
      return;
    }
    updateScrollShadows(element);
  };
})();