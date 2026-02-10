/**
 * Dynamic scroll shadows for horizontally scrollable elements
 * Shows shadows on left/right based on scroll position
 */
(function() {
  'use strict';

  function updateScrollShadows(element) {
    let scrollLeft = element.scrollLeft;
    let scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;

    // Check if there's a code element inside with wider content
    const codeElement = element.querySelector('code');
    if (codeElement && codeElement.scrollWidth > scrollWidth) {
      scrollWidth = codeElement.scrollWidth;
      // If the code element is wider, read scrollLeft from it too
      scrollLeft = codeElement.scrollLeft;
    }

    // Check if there's a table element inside with wider content
    const tableElement = element.querySelector('table');
    if (tableElement && tableElement.scrollWidth > scrollWidth) {
      scrollWidth = tableElement.scrollWidth;
      // If the table element is wider, read scrollLeft from it too
      scrollLeft = tableElement.scrollLeft;
    }

    const maxScroll = scrollWidth - clientWidth;

    // Check if there's overflow at all
    const hasOverflow = scrollWidth > clientWidth;

    if (!hasOverflow) {
      element.classList.remove('has-scroll-shadow-left', 'has-scroll-shadow-right');
      return;
    }

    // Show left shadow if not at the start (with 5px threshold)
    if (scrollLeft > 5) {
      element.classList.add('has-scroll-shadow-left');
    } else {
      element.classList.remove('has-scroll-shadow-left');
    }

    // Show right shadow if not at the end (with 5px threshold)
    if (scrollLeft < maxScroll - 5) {
      element.classList.add('has-scroll-shadow-right');
    } else {
      element.classList.remove('has-scroll-shadow-right');
    }
  }

  function initScrollShadows() {
    // Select all scrollable pre elements and table wrappers
    const selectors = [
      '.literalblock pre',
      '.listingblock > .content > pre',
      '.table-wrapper'
    ];

    const scrollables = document.querySelectorAll(selectors.join(', '));

    scrollables.forEach(element => {
      // Initial check
      updateScrollShadows(element);

      // Update on scroll
      element.addEventListener('scroll', () => {
        updateScrollShadows(element);
      }, { passive: true });

      // Also listen to scroll on the code element inside
      const codeElement = element.querySelector('code');
      if (codeElement) {
        codeElement.addEventListener('scroll', () => {
          updateScrollShadows(element);
        }, { passive: true });
      }

      // Also listen to scroll on the table element inside
      const tableElement = element.querySelector('table');
      if (tableElement) {
        tableElement.addEventListener('scroll', () => {
          updateScrollShadows(element);
        }, { passive: true });
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
      const scrollables = document.querySelectorAll('.literalblock pre, .listingblock > .content > pre, .table-wrapper');
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
    console.log('Manual check for element:', element);
    updateScrollShadows(element);
  };
})();