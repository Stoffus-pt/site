(function () {
  var form = document.getElementById('contact-form');
  var hint = document.getElementById('contact-form-hint');
  if (!form) return;

  var topicLabels = {
    'info@stoffus.pt': 'Informações gerais',
    'geral@stoffus.pt': 'Contacto geral',
    'encomendas@stoffus.pt': 'Encomendas',
    'lsalgado@stoffus.pt': 'Administração / Stoffus 3D',
    'salete@stoffus.pt': 'Financeira / Contabilidade',
    'export@stoffus.pt': 'Exportação'
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();
    var email = String(data.get('email') || '').trim();
    var to = String(data.get('topic') || 'info@stoffus.pt');
    var message = String(data.get('message') || '').trim();
    var topicLabel = topicLabels[to] || 'Contacto';

    if (!name || !email || !message) {
      if (hint) hint.textContent = 'Preencha todos os campos obrigatórios.';
      return;
    }

    var subject = 'Contacto site Stoffus - ' + topicLabel;
    var body =
      'Nome: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Assunto: ' + topicLabel + '\n\n' +
      message;

    var mailto =
      'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    if (hint) hint.textContent = 'A abrir o seu programa de email…';

    window.location.href = mailto;
  });
})();
