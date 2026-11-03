(function attachTouchEditorGridZoom(global) {
  // Zoom functionality for grid previews
  function initializeGridZoom() {
    const gridStages = document.querySelectorAll('.grid-stage');
    console.log('Found grid stages:', gridStages.length);

    let sharedScale = 1; // Shared zoom level for both panels
    const minScale = 0.5;
    const maxScale = 3;

    // Store pan positions for each panel
    const panPositions = new Map();

    const updateZoom = (newScale, sourceIndex = -1) => {
      if (newScale !== sharedScale) {
        sharedScale = newScale;

        // Apply zoom to all grid stages
        gridStages.forEach((stage, index) => {
          const panel = stage.closest('.grid-panel');
          if (!panel) return;

          // Initialize pan position if not exists
          if (!panPositions.has(panel)) {
            panPositions.set(panel, { x: 0, y: 0 });
          }

          const panPos = panPositions.get(panel);

          // Apply zoom and pan transform
          stage.style.transform = `scale(${sharedScale}) translate(${panPos.x}px, ${panPos.y}px)`;
          stage.style.transformOrigin = '50% 50%';
          stage.style.transition = 'transform 0.1s ease';

          // Update cursor and overflow
          if (sharedScale > 1) {
            panel.style.overflow = 'hidden'; // Hide scrollbars, use pure pan
            stage.style.cursor = 'grab';
            // Ensure the panel can contain the scaled content
            panel.style.position = 'relative';
          } else {
            panel.style.overflow = 'visible';
            stage.style.cursor = 'default';
            panPos.x = 0;
            panPos.y = 0;
          }

          // Update header text
          const header = panel.querySelector('h3');
          if (header) {
            const baseText = header.textContent.split(' - Zoom')[0];
            header.textContent = `${baseText} - Zoom: ${Math.round(sharedScale * 100)}%`;
          }
        });

        console.log('Synchronized zoom applied:', sharedScale, sourceIndex >= 0 ? `from panel ${sourceIndex}` : '');
      }
    };

    const resetView = () => {
      console.log('resetView called - forcing back to page load state');

      // Reset all variables to initial state
      sharedScale = 1;
      panPositions.clear();

      // Force each grid stage back to exactly page load state
      gridStages.forEach((stage, index) => {
        // Remove all transforms - back to page load
        stage.style.transform = '';
        stage.style.transformOrigin = '';
        stage.style.transition = '';
        stage.style.cursor = '';

        const panel = stage.closest('.grid-panel');
        if (panel) {
          // Reset panel overflow to page load state
          panel.style.overflow = '';
          panel.style.position = '';

          // Reset header to original text (no zoom info)
          const header = panel.querySelector('h3');
          if (header) {
            const orientation = panel.dataset.orientation;
            if (orientation === 'landscape') {
              header.textContent = 'Landscape (50 × 50)';
            } else if (orientation === 'portrait') {
              header.textContent = 'Portrait (50 × 50)';
            }
          }
        }

        console.log(`Stage ${index} reset to page load state`);
      });

      console.log('Reset completed - back to page load state');
    };

    gridStages.forEach((stage, index) => {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let scrollLeft = 0;
      let scrollTop = 0;

      const handleWheel = (e) => {
        console.log('Wheel on grid stage', index, '- deltaY:', e.deltaY);
        e.preventDefault();
        e.stopPropagation();

        const delta = -e.deltaY * 0.01;
        const newScale = Math.max(minScale, Math.min(maxScale, sharedScale + delta));
        updateZoom(newScale, index);
      };

      const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left mouse button
        if (sharedScale <= 1) return; // Only allow panning when zoomed

        const panel = stage.closest('.grid-panel');
        if (!panel) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get current pan position
        const currentPan = panPositions.get(panel) || { x: 0, y: 0 };
        scrollLeft = currentPan.x;
        scrollTop = currentPan.y;

        stage.style.cursor = 'grabbing';
        stage.style.transition = 'none'; // Disable transition during drag
        e.preventDefault();
      };

      const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const panel = stage.closest('.grid-panel');
        if (!panel) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newPanX = scrollLeft + deltaX;
        const newPanY = scrollTop + deltaY;

        // Allow free panning - let users explore the full viewport

        // Update pan position
        panPositions.set(panel, { x: newPanX, y: newPanY });

        // Apply transform with new pan position
        stage.style.transform = `scale(${sharedScale}) translate(${newPanX}px, ${newPanY}px)`;
      };

      const handleMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          stage.style.cursor = sharedScale > 1 ? 'grab' : 'default';
          stage.style.transition = 'transform 0.1s ease'; // Re-enable transition
        }
      };

      const handleMouseLeave = () => {
        if (isDragging) {
          isDragging = false;
          stage.style.cursor = sharedScale > 1 ? 'grab' : 'default';
          stage.style.transition = 'transform 0.1s ease'; // Re-enable transition
        }
      };

      // Attach event listeners
      stage.addEventListener('wheel', handleWheel, { passive: false });
      stage.addEventListener('mousedown', handleMouseDown);
      stage.addEventListener('mousemove', handleMouseMove);
      stage.addEventListener('mouseup', handleMouseUp);
      stage.addEventListener('mouseleave', handleMouseLeave);

      console.log(`Grid stage zoom and pan initialized for stage ${index}`);

      // Double-click to reset
      stage.addEventListener('dblclick', () => {
        resetView();
      });
    });

    // Add reset button functionality
    const resetBtn = document.getElementById('resetViewBtn');
    console.log('Looking for reset button...', resetBtn);

    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        console.log('Reset view button clicked!', e);
        e.preventDefault();
        resetView();
      });
      console.log('Reset button event listener added successfully');

      // Test the button visibility and properties
      console.log('Button properties:', {
        display: getComputedStyle(resetBtn).display,
        visibility: getComputedStyle(resetBtn).visibility,
        disabled: resetBtn.disabled,
        style: resetBtn.style.cssText
      });
    } else {
      console.error('Reset button not found! Available buttons:',
        Array.from(document.querySelectorAll('button')).map(b => b.id || b.textContent));
    }

    // Also add a global reset function for debugging
    window.resetGridView = resetView;

    // Initialize zoom display
    updateZoom(1);

    // Return the resetView function for external use
    return { resetView };
  }

  global.TouchEditorGridZoom = { initializeGridZoom };
})(window);
