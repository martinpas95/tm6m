window.TM6M = window.TM6M || {};

TM6M.home = (function () {
  function el(id) { return document.getElementById(id); }
  var query = '';

  function fmtDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
  }

  function render() {
    var list = el('home-list');
    var empty = el('home-empty');
    var tests = TM6M.storage.loadTests().filter(function (t) {
      if (!query) return true;
      return (t.paciente || '').toLowerCase().indexOf(query.toLowerCase()) >= 0;
    });
    list.innerHTML = '';
    empty.hidden = tests.length > 0;

    tests.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'test-item';

      var info = document.createElement('div');
      info.className = 'test-item-info';
      var name = document.createElement('div');
      name.className = 'test-item-name';
      name.textContent = t.paciente || '(sin nombre)';
      var meta = document.createElement('div');
      meta.className = 'test-item-meta';
      var metrosTot = TM6M.calc.metrosTotales(t.filas);
      meta.textContent = fmtDate(t.fecha) + ' · ' + metrosTot + ' m' + (t.finalizado ? '' : ' · sin terminar');
      info.appendChild(name);
      info.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'test-item-actions';

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.title = 'Editar';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', function (ev) { ev.stopPropagation(); openForEdit(t); });

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.title = 'Borrar';
      delBtn.textContent = '\u{1F5D1}';
      delBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (confirm('¿Borrar el test de ' + (t.paciente || 'este paciente') + '?')) {
          TM6M.storage.deleteTest(t.id);
          render();
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(info);
      li.appendChild(actions);
      li.addEventListener('click', function () { openForView(t); });
      list.appendChild(li);
    });
  }

  function openForView(t) {
    TM6M.state.current = JSON.parse(JSON.stringify(t));
    TM6M.report.render();
    TM6M.ui.showView('report');
  }

  function openForEdit(t) {
    TM6M.state.current = JSON.parse(JSON.stringify(t));
    TM6M.review.render();
    TM6M.ui.showView('review');
  }

  function init() {
    el('btn-new-test').addEventListener('click', function () {
      var settings = TM6M.storage.loadSettings();
      TM6M.state.current = TM6M.model.newTest(settings);
      TM6M.patient.render();
      TM6M.ui.showView('patient');
    });
    el('home-search').addEventListener('input', function () {
      query = el('home-search').value;
      render();
    });
  }

  return { init: init, render: render };
})();
