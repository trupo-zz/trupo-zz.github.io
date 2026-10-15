// Route C (GitHub Pages): no counting here. Only the local "thanks" reveal for the main button remains; no network calls.
(function () {
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-cta]') : null;
    if (!t || t.type === 'submit') return;
    if (t.id === 'notify') { t.disabled = true; var el = document.getElementById('cta-thanks'); if (el) el.hidden = false; }
  });
})();
