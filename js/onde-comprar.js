(function () {
  var form = document.getElementById('onde-form');
  var gpsBtn = document.getElementById('gps-btn');
  var gpsHint = document.getElementById('gps-hint');
  var gpsStatus = document.getElementById('gps-status');
  var hint = document.getElementById('onde-hint');
  var placeInput = form ? form.querySelector('[name="place"]') : null;
  var coordsInput = document.getElementById('onde-coords');
  var mapsInput = document.getElementById('onde-maps');
  var successBox = document.getElementById('onde-success');
  var showroomEl = document.getElementById('onde-showroom');
  var regionsEl = document.getElementById('onde-regions');

  if (!form) return;

  var gpsBtnDefaultLabel = gpsBtn ? gpsBtn.textContent.trim() : '';
  var submitting = false;

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
    coordsInput.value = latS + ',' + lngS;
    mapsInput.value = buildMapsLink(latS, lngS);

    if (placeInput && placeLabel) placeInput.value = placeLabel;

    setHint(gpsHint, '');
    if (placeLabel) {
      setGpsStatus('Localização detectada: ' + placeLabel + '. Confirme e envie o pedido.', 'ok');
    } else {
      setGpsStatus('Coordenadas obtidas. Indique a cidade e envie o pedido.', 'ok');
    }
    if (placeInput) placeInput.focus();
  }

  function geoErrorMessage(err) {
    if (!err) return 'Não foi possível obter a localização.';
    if (err.code === 1) return 'Permissão negada. Active a localização ou indique a cidade manualmente.';
    if (err.code === 2) return 'Localização indisponível. Indique a cidade manualmente.';
    if (err.code === 3) return 'Tempo esgotado. Tente novamente ou indique a cidade manualmente.';
    return 'Não foi possível obter a localização. Indique a cidade manualmente.';
  }

  if (gpsBtn) {
    gpsBtn.addEventListener('click', function () {
      if (window.StoffusCookies && !window.StoffusCookies.hasConsent()) {
        setGpsStatus('Aceite os cookies para usar a localização GPS, ou escreva a cidade manualmente.', 'error');
        return;
      }

      setHint(gpsHint, '');
      setHint(hint, '');
      setGpsStatus('', '');
      if (successBox) successBox.hidden = true;

      if (!window.isSecureContext) {
        setGpsStatus('A localização GPS só funciona em ligação segura (https).', 'error');
        return;
      }

      if (!navigator.geolocation) {
        setGpsStatus('O seu browser não suporta GPS. Indique a cidade manualmente.', 'error');
        return;
      }

      setGpsLoading(true);
      setHint(gpsHint, 'A pedir permissão de localização…');

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function (placeLabel) {
            applyLocation(pos.coords.latitude, pos.coords.longitude, placeLabel);
            setGpsLoading(false);
          });
        },
        function (err) {
          setGpsStatus(geoErrorMessage(err), 'error');
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function renderShowroom(data) {
    if (!showroomEl || !data || !data.showroom) return;
    var s = data.showroom;
    showroomEl.innerHTML =
      '<article class="showroom-card">' +
        '<span class="label">Visite a fábrica</span>' +
        '<h3>' + s.name + '</h3>' +
        '<p>' + s.note + '</p>' +
        '<ul class="showroom-card__list">' +
          '<li><strong>Morada:</strong> ' + s.address + '</li>' +
          '<li><strong>Telefone:</strong> <a href="tel:' + s.phone.replace(/\s/g, '') + '">' + s.phone + '</a></li>' +
          '<li><strong>Horário:</strong> ' + s.hours + '</li>' +
        '</ul>' +
        '<div class="showroom-card__actions">' +
          '<a class="btn btn--brand" href="' + s.maps + '" target="_blank" rel="noopener">Como chegar</a>' +
          '<a class="btn btn--outline" href="contactos.html">Contactar</a>' +
        '</div>' +
      '</article>';
  }

  function renderRegions(data) {
    if (!regionsEl || !data || !data.regions) return;
    regionsEl.innerHTML = data.regions.map(function (region) {
      var districts = (region.districts || []).join(', ');
      return (
        '<article class="visit-region-card">' +
          '<h3>' + region.name + '</h3>' +
          (districts ? '<p>' + districts + '</p>' : '<p>Rede internacional — contacte-nos.</p>') +
          '<a class="visit-region-card__link" href="#localizacao">Pedir indicação nesta zona</a>' +
        '</article>'
      );
    }).join('');
  }

  fetch('data/visit-points.json')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      renderShowroom(data);
      renderRegions(data);
    })
    .catch(function () {});

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;

    setHint(hint, '');
    if (successBox) successBox.hidden = true;

    var fd = new FormData(form);
    var payload = {
      type: 'visit',
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      place: String(fd.get('place') || '').trim(),
      postal: String(fd.get('postal') || '').trim(),
      coords: String(fd.get('coords') || '').trim(),
      maps: String(fd.get('maps') || '').trim(),
      message: String(fd.get('message') || '').trim()
    };

    if (!payload.name) {
      setHint(hint, 'Indique o seu nome.');
      return;
    }
    if (!payload.phone) {
      setHint(hint, 'Indique o telefone para podermos contactá-lo.');
      return;
    }
    if (!payload.place && !payload.coords) {
      setHint(hint, 'Indique a cidade/zona ou use o GPS.');
      return;
    }
    if (!payload.place && payload.coords) {
      setHint(hint, 'Indique pelo menos a cidade ou freguesia.');
      return;
    }

    if (!window.StoffusLeads) {
      setHint(hint, 'Envio indisponível neste momento. Ligue +351 239 700 799.');
      return;
    }

    submitting = true;
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'A enviar…';
    }

    StoffusLeads.submitLead(payload)
      .then(function (res) {
        form.reset();
        if (coordsInput) coordsInput.value = '';
        if (mapsInput) mapsInput.value = '';
        if (successBox) {
          successBox.hidden = false;
          successBox.textContent = res.message || 'Pedido recebido. Entraremos em contacto com a sugestão de visita.';
        }
        StoffusLeads.showSuccess(form, hint, 'Pedido enviado. Responderemos com uma ou duas opções de loja na sua zona.');
        if (successBox) successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      })
      .catch(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar pedido';
        }
        submitting = false;
        setHint(hint, 'Não foi possível enviar agora. Ligue +351 239 700 799 ou escreva para geral@stoffus.pt.');
      });
  });
})();
