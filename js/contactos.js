(function () {
  var form = document.getElementById('contact-form');
  var hint = document.getElementById('contact-form-hint');
  var successBox = document.getElementById('contact-success');
  if (!form) return;

  var submitting = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;

    var data = new FormData(form);
    var payload = {
      type: 'contact',
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      topic: String(data.get('topic') || 'info@stoffus.pt'),
      message: String(data.get('message') || '').trim()
    };

    if (!payload.name || !payload.email || !payload.message) {
      if (hint) hint.textContent = 'Preencha todos os campos obrigatórios.';
      return;
    }

    if (!window.StoffusLeads) {
      if (hint) hint.textContent = 'Envio indisponível. Ligue +351 239 700 799.';
      return;
    }

    submitting = true;
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'A enviar…';
    }
    if (hint) hint.textContent = '';
    if (successBox) successBox.hidden = true;

    StoffusLeads.submitLead(payload)
      .then(function (res) {
        form.reset();
        if (successBox) {
          successBox.hidden = false;
          successBox.textContent = res.message || 'Mensagem recebida. Responderemos em breve.';
        }
        StoffusLeads.showSuccess(form, hint, 'Mensagem enviada com sucesso.');
      })
      .catch(function () {
        submitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar mensagem';
        }
        if (hint) hint.textContent = 'Não foi possível enviar. Tente geral@stoffus.pt ou +351 239 700 799.';
      });
  });
})();
