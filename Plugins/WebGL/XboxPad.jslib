mergeInto(LibraryManager.library, {
  XboxPad_Read: function (outPtr) {
    var set = function (i, v) {
      HEAPF32[(outPtr >> 2) + i] = v;
    };
    var gp = null;
    try {
      var pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      }
    } catch (e) { gp = null; }

    if (!gp) {
      set(0, 0);
      return 0;
    }

    set(0, 1);
    set(1, gp.axes[0] || 0);
    set(2, gp.axes[1] || 0);
    set(3, gp.axes[2] || 0);
    set(4, gp.axes[3] || 0);

    // Standard Gamepad mapping (Xbox):
    // 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 LS, 11 RS
    // 12 dpad U, 13 D, 14 L, 15 R
    for (var b = 0; b < 17; b++) {
      var btn = gp.buttons[b];
      var val = 0;
      if (btn) val = (typeof btn.value === "number") ? btn.value : (btn.pressed ? 1 : 0);
      set(5 + b, val);
    }
    return 1;
  }
});
