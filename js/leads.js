(function (global) {
  function apiBase() {
    var site = global.StoffusSite || {};
    if (site.isGithubPreview) return 'https://stoffus.pt/cms/api';
    if (site.isLocal) {
      var port = location.port || '';
      if (port === '8080') return '/cms/api';
    }
    return 'cms/api';
  }

  function submitLead(payload) {
    var site = global.StoffusSite || {};
    if (site.isGithubPreview) {
      try {
        var key = 'stoffus_leads_queue';
        var queue = JSON.parse(localStorage.getItem(key) || '[]');
        queue.push({ ts: new Date().toISOString(), payload: payload });
        localStorage.setItem(key, JSON.stringify(queue));
      } catch (e) {}
      return Promise.resolve({
        ok: true,
        message: 'Pedido registado (modo teste). No site em stoffus.pt enviamos automaticamente para a equipa.'
      });
    }

    var url = apiBase().replace(/\/$/, '') + '/leads.php';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Resposta inválida.' };
      }).then(function (data) {
        if (!res.ok || !data.ok) {
          var err = new Error((data && data.error) || 'Envio falhou.');
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function showSuccess(form, messageEl, message) {
    if (messageEl) messageEl.textContent = message;
    if (form) {
      form.querySelectorAll('input, textarea, select, button[type="submit"]').forEach(function (el) {
        if (el.type !== 'hidden') el.disabled = true;
      });
    }
  }

  global.StoffusLeads = {
    submitLead: submitLead,
    showSuccess: showSuccess
  };
})(window);
