mergeInto(LibraryManager.library, {
  // Halo-style narrator via the browser's speech synthesis — deep pitch,
  // slow rate, tiny delay so lines never clip each other.
  WebSpeech_Speak: function (ptr) {
    var s = UTF8ToString(ptr);
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(s);
      u.rate = 0.85;
      u.pitch = 0.5;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* unsupported */ }
  },
  WebSpeech_Cancel: function () {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }
});
