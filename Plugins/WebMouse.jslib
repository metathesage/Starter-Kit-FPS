mergeInto(LibraryManager.library, {
  // Raw mouse deltas straight from the DOM, for contexts where Unity's
  // pointer-lock path is unavailable (embedded webviews, preview panes).
  // When the document IS pointer-locked we report zeros so Unity's own
  // Mouse X/Y axes stay the single source of truth (no double-count).
  WebMouse_Poll: function (outPtr) {
    var set = function (i, v) {
      HEAPF32[(outPtr >> 2) + i] = v;
    };
    if (!Module.__waifuMouse) Module.__waifuMouse = { x: 0, y: 0, hooked: false };
    var m = Module.__waifuMouse;
    if (!m.hooked) {
      m.hooked = true;
      document.addEventListener('mousemove', function (e) {
        if (document.pointerLockElement) { m.x = 0; m.y = 0; return; }
        m.x += (e.movementX || 0);
        m.y += (e.movementY || 0);
      }, { passive: true });
      document.addEventListener('mousedown', function () {
        var c = document.getElementById('unity-canvas');
        if (c && document.activeElement !== c) { try { c.focus(); } catch (e) {} }
      }, { passive: true });
    }
    // accumulated deltas since last frame, scaled: unlocked movementX fires
    // many small events per rendered frame
    set(0, m.x * 0.6);
    set(1, m.y * 0.6);
    m.x = 0;
    m.y = 0;
  },
});
