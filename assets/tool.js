// Wires the pre-rendered calculator or converter on a page to live results. Runs only in the browser.
(function () {
  var el = document.getElementById('tool-spec');
  if (!el) return;
  var spec = JSON.parse(el.textContent);
  var F = window.TrupoFormula;
  var tool = spec.tool;

  if (spec.page_type === 'calculator') {
    var form = document.getElementById('calc');
    var asts = tool.outputs.map(function (o) { return F.parse(o.formula); });
    var run = function () {
      var env = {}, bad = false;
      tool.inputs.forEach(function (inp) {
        var v = parseFloat(document.getElementById('in-' + inp.id).value);
        if (!isFinite(v)) bad = true;
        env[inp.id] = v;
      });
      tool.outputs.forEach(function (o, i) {
        var out = document.getElementById('out-' + o.id), r = NaN;
        if (!bad) { try { r = F.evaluate(asts[i], env); } catch (e) { r = NaN; } }
        env[o.id] = r;
        out.textContent = isFinite(r) ? (o.prefix || '') + F.format(r, o.precision) + (o.suffix || '') : '—';
      });
    };
    form.addEventListener('input', run);
    form.addEventListener('change', run);
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    run();
  }

  if (spec.page_type === 'converter') {
    var conv = document.getElementById('conv');
    var unit = function (id) { for (var i = 0; i < tool.units.length; i++) if (tool.units[i].id === id) return tool.units[i]; };
    var go = function () {
      var v = parseFloat(document.getElementById('cv-value').value);
      var from = unit(document.getElementById('cv-from').value), to = unit(document.getElementById('cv-to').value);
      var r = isFinite(v) ? ((v * from.factor + (from.offset || 0)) - (to.offset || 0)) / to.factor : NaN;
      document.getElementById('cv-out').textContent = F.format(r, tool.precision);
    };
    document.getElementById('cv-swap').addEventListener('click', function () {
      var a = document.getElementById('cv-from'), b = document.getElementById('cv-to'), t = a.value;
      a.value = b.value; b.value = t; go();
    });
    conv.addEventListener('input', go);
    conv.addEventListener('change', go);
    conv.addEventListener('submit', function (e) { e.preventDefault(); go(); });
    go();
  }
})();
