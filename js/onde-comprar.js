(function () {
  var form = document.getElementById('onde-form');
  var gpsBtn = document.getElementById('gps-btn');
  var gpsHint = document.getElementById('gps-hint');
  var gpsStatus = document.getElementById('gps-status');
  var hint = document.getElementById('onde-hint');
  var placeInput = form ? form.querySelector('[name="place"]') : null;
  var coordsInput = document.getElementById('onde-coords');
  var mapsInput = document.getElementById('onde-maps');
  var actions = document.getElementById('onde-actions');
  var emailLink = document.getElementById('onde-email');
  var copyBtn = document.getElementById('onde-copy');

  if (!form) return;

  var gpsBtnDefaultLabel = gpsBtn ? gpsBtn.textContent.trim() : '';

  function setHint(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
  }

  function setGpsStatus(msg, type) {
    if (!gpsStatus) return;
    gpsStatus.textContent = msg || '';
    gpsStatus.hidden = !msg;
    gpsStatus.classList.remove('is-ok', 'is-error');
    if (type) gpsStatus.classList.add(type === 'ok' ? 'is-ok' : 'is-error');
  }

  function setGpsLoading(loading) {
    if (!gpsBtn) return;
    gpsBtn.disabled = loading;
    gpsBtn.textContent = loading ? 'A obter localização…' : gpsBtnDefaultLabel;
    gpsBtn.classList.toggle('is-loading', loading);
  }

  function buildMapsLink(lat, lng) {
    return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng);
  }

  function formatAddressFromBigDataCloud(data) {
    if (!data) return '';
    var parts = [];
    var locality = data.locality || data.city;
    if (locality) {
      locality = String(locality).split('(')[0].trim();
      parts.push(locality);
    }
    var region = data.principalSubdivision;
    if (region && region !== locality) parts.push(region);
    if (data.countryName) parts.push(data.countryName);
    return parts.filter(Boolean).join(', ');
  }

  function formatAddressFromNominatim(data) {
    if (!data) return '';
    if (data.display_name) {
      var short = String(data.display_name).split(',').slice(0, 3).join(',').trim();
      if (short) return short;
    }
    var a = data.address || {};
    var parts = [];
    var locality = a.city || a.town || a.village || a.municipality || a.suburb;
    if (locality) parts.push(locality);
    var district = a.county || a.state_district || a.region;
    if (district && district !== locality) parts.push(district);
    if (a.country) parts.push(a.country);
    return parts.filter(Boolean).join(', ');
  }

  function reverseGeocode(lat, lng) {
    var bdcUrl =
      'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
      encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lng) +
      '&localityLanguage=pt';

    return fetch(bdcUrl, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('geocode');
        return res.json();
      })
      .then(function (data) {
        return formatAddressFromBigDataCloud(data);
      })
      .catch(function () {
        var nomUrl =
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=' +
          encodeURIComponent(lat) +
          '&lon=' + encodeURIComponent(lng) +
          '&zoom=14&addressdetails=1';

        return fetch(nomUrl, {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'pt-PT,pt'
          }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('geocode');
            return res.json();
          })
          .then(function (data) {
            return formatAddressFromNominatim(data);
          })
          .catch(function () {
            return '';
          });
      });
  }

  function applyLocation(lat, lng, placeLabel) {
    var latS = Number(lat).toFixed(6);
    var lngS = Number(lng).toFixed(6);
    var coords = latS + ',' + lngS;
    var maps = buildMapsLink(latS, lngS);

    coordsInput.value = coords;
    mapsInput.value = maps;

    if (placeInput && placeLabel) {
      placeInput.value = placeLabel;
    }

    setHint(gpsHint, '');

    if (placeLabel) {
      setGpsStatus('Localização detectada: ' + placeLabel + '. Confirme no formulário e gere a mensagem.', 'ok');
      setHint(hint, 'Local preenchido automaticamente. Pode ajustar e carregar em «Gerar mensagem».');
    } else {
      setGpsStatus('Coordenadas obtidas. Indique a cidade no formulário e gere a mensagem.', 'ok');
      setHint(hint, 'Não foi possível identificar a cidade automaticamente. Escreva a localização manualmente.');
    }

    if (placeInput) placeInput.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function geoErrorMessage(err) {
    if (!err) return 'Não foi possível obter a localização.';
    if (err.code === 1) return 'Permissão negada. Active a localização no browser ou indique a cidade manualmente.';
    if (err.code === 2) return 'Localização indisponível. Indique a cidade manualmente.';
    if (err.code === 3) return 'Tempo esgotado. Tente novamente ou indique a cidade manualmente.';
    return 'Não foi possível obter a localização. Indique a cidade manualmente.';
  }

  if (gpsBtn) {
    gpsBtn.addEventListener('click', function () {
      setHint(gpsHint, '');
      setHint(hint, '');
      setGpsStatus('', '');
      actions.hidden = true;

      if (!window.isSecureContext) {
        setGpsStatus('A localização GPS só funciona em ligação segura (https). Indique a cidade no formulário.', 'error');
        if (placeInput) placeInput.focus();
        return;
      }

      if (!navigator.geolocation) {
        setGpsStatus('O seu browser não suporta GPS. Indique a cidade manualmente.', 'error');
        if (placeInput) placeInput.focus();
        return;
      }

      setGpsLoading(true);
      setHint(gpsHint, 'A pedir permissão de localização…');

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;

          setHint(gpsHint, 'A identificar a sua zona…');

          reverseGeocode(lat, lng).then(function (placeLabel) {
            applyLocation(lat, lng, placeLabel);
            setGpsLoading(false);
          });
        },
        function (err) {
          setHint(gpsHint, '');
          setGpsStatus(geoErrorMessage(err), 'error');
          setGpsLoading(false);
          if (placeInput) placeInput.focus();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function buildMessage(data) {
    var lines = [];
    lines.push('Olá,');
    lines.push('');
    lines.push('Gostava de saber onde posso ver e experimentar sofás Stoffus perto de si.');
    lines.push('');

    if (data.name) lines.push('Nome: ' + data.name);
    if (data.phone) lines.push('Telefone: ' + data.phone);
    if (data.place) lines.push('Localização: ' + data.place);
    if (data.postal) lines.push('Código postal: ' + data.postal);
    if (data.maps) lines.push('Mapa (localização aproximada): ' + data.maps);

    if (data.message) {
      lines.push('');
      lines.push('Notas:');
      lines.push(data.message);
    }

    lines.push('');
    lines.push('Obrigado.');
    return lines.join('\n');
  }

  function encodeMailto(to, subject, body) {
    return 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return Promise.resolve();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setHint(hint, '');

    var fd = new FormData(form);
    var data = {
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      place: String(fd.get('place') || '').trim(),
      postal: String(fd.get('postal') || '').trim(),
      coords: String(fd.get('coords') || '').trim(),
      maps: String(fd.get('maps') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };

    if (!data.phone) {
      setHint(hint, 'Indique o seu número de telefone para podermos contactá-lo.');
      actions.hidden = true;
      var phoneInput = form.querySelector('[name="phone"]');
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (!data.place && !data.coords) {
      setHint(hint, 'Indique a cidade/zona ou use o GPS para obter a localização.');
      actions.hidden = true;
      return;
    }

    if (!data.place && data.coords) {
      setHint(hint, 'Indique pelo menos a cidade ou freguesia para podermos indicar o melhor local de visita.');
      actions.hidden = true;
      if (placeInput) placeInput.focus();
      return;
    }

    var subject = 'Pedido de visita - sofás Stoffus';
    var body = buildMessage(data);

    emailLink.href = encodeMailto('geral@stoffus.pt', subject, body);
    actions.hidden = false;
    setHint(hint, 'Mensagem pronta. Pode abrir o email ou copiar o texto.');
    actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    copyBtn.onclick = function () {
      copyText(body).then(function () {
        setHint(hint, 'Texto copiado para a área de transferência.');
      });
    };
  });
})();
