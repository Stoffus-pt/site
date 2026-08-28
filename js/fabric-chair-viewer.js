(function () {
  var root = document.getElementById('fabric-chair');
  var canvas = document.getElementById('fabric-chair-canvas');
  if (!root || !canvas || typeof THREE === 'undefined') return;

  var loadingEl = document.getElementById('fabric-chair-loading');
  var captionEl = document.getElementById('fabric-chair-caption');
  var modelSelect = document.getElementById('fabric-chair-model');
  var collectionSelect = document.getElementById('fabric-chair-collection');
  var colorsEl = document.getElementById('fabric-chair-colors');
  var configBtn = document.getElementById('fabric-chair-config');

  var CHAIRS = {
    osaka: { label: 'Osaka', folder: 'osaka', file: 'osaka.glb' },
    masai: { label: 'Masai L', folder: 'masai', file: 'masail.glb' },
    prada: { label: 'Prada', folder: 'prada', file: 'prada.glb' },
    syros: { label: 'Syros', folder: 'syros', file: 'syros.glb' },
  };

  var RAPPORT_CM = 45;
  var COLLECTIONS = [];
  var activeCol = null;
  var activeIndex = 1;
  var currentChairId = 'osaka';

  var renderer;
  var scene;
  var camera;
  var controls;
  var chairRoot = null;
  var fabricMaterial = null;
  var fabricMeshes = [];
  var animationId = 0;
  var chairLoadToken = 0;
  var fabricLoadToken = 0;
  var dracoLoader = null;
  var gltfLoader = null;
  var DRACO_DECODER = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

  function studioBase() {
    var tex = (window.StoffusSite && window.StoffusSite.textureRemote) || 'https://stoffus.pt/Studio3D/assets/textures/';
    return tex.replace(/\/?textures\/?$/i, '/');
  }

  function chairModelUrl(chairId) {
    var chair = CHAIRS[chairId] || CHAIRS.osaka;
    return studioBase() + 'models/' + chair.folder + '/' + chair.file;
  }

  function mapUrls(colName, fileIndex, kind) {
    var base = studioBase() + 'textures/';
    var stem = String(colName || '').trim() + ' ' + String(fileIndex);
    var enc = function (name) {
      return base + encodeURI(name);
    };
    var k = String(kind || 'base').toLowerCase();
    if (k === 'base') {
      return [
        enc(stem + '.jpg'),
        enc(stem + '.jpeg'),
        enc(stem + '_BaseColor.jpg'),
        enc(stem + '_Diffuse.jpg'),
      ];
    }
    if (k === 'normal') {
      return [enc(stem + '_normal.jpg'), enc(stem + '_Normal.jpg'), enc(stem + '_Normal.png')];
    }
    if (k === 'ambient' || k === 'ao') {
      return [enc(stem + '_ambient.jpg'), enc(stem + '_AO.jpg'), enc(stem + '_ao.jpg')];
    }
    return [enc(stem + '.jpg')];
  }

  function loadFirstTexture(loader, urls) {
    return new Promise(function (resolve, reject) {
      var list = urls.slice();
      var i = 0;
      function tryNext() {
        if (i >= list.length) {
          reject(new Error('texture'));
          return;
        }
        loader.load(list[i++], resolve, undefined, tryNext);
      }
      tryNext();
    });
  }

  function applyTextureRepeat(texture) {
    if (!texture) return;
    var repeat = 90 / RAPPORT_CM;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (renderer && renderer.capabilities) {
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    texture.needsUpdate = true;
  }

  function fabricPhysics(col) {
    var tex = col && col.texture ? col.texture : 'default';
    if (tex === 'pele') {
      return { roughness: 0.58, metalness: 0.03, normalScale: new THREE.Vector2(0.55, 0.55), isPele: true };
    }
    if (tex === 'aveludado') {
      return { roughness: 0.92, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7), isPele: false };
    }
    if (tex === 'alinhado') {
      return { roughness: 0.88, metalness: 0, normalScale: new THREE.Vector2(1.1, 1.1), isPele: false };
    }
    return { roughness: 0.9, metalness: 0, normalScale: new THREE.Vector2(0.85, 0.85), isPele: false };
  }

  function isLegMesh(node) {
    if (!node || !node.isMesh) return false;
    var lower = String(node.name || '').toLowerCase();
    if (lower.includes('tabua') || lower.includes('base')) return false;
    if (node.userData && node.userData.isStoffusLeg) return true;
    var legWords = ['leg', 'pé', 'foot', 'feet', 'metal', 'wood', 'inox', 'chrome', 'rodape'];
    for (var i = 0; i < legWords.length; i++) {
      if (lower.includes(legWords[i])) return true;
    }
    if (/\bpe\b/.test(lower) || /(^|[_-])pe($|[_-])/.test(lower)) return true;
    return false;
  }

  function legMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.45, roughness: 0.88 });
  }

  function collectFabricMeshes(root) {
    fabricMeshes = [];
    root.traverse(function (node) {
      if (!node.isMesh) return;
      if (isLegMesh(node)) {
        node.material = legMaterial();
        return;
      }
      if (node.name === 'shadow_plane') return;
      if (node.material && node.material.name === 'Color M08') return;
      fabricMeshes.push(node);
      if (node.geometry && node.geometry.attributes.uv && !node.geometry.attributes.uv2) {
        node.geometry.setAttribute('uv2', new THREE.BufferAttribute(node.geometry.attributes.uv.array, 2));
      }
    });
  }

  function fitChair(root) {
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    root.updateMatrixWorld(true);

    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var scale = 1.35 / maxDim;

    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    box.setFromObject(root);
    var center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);
    root.updateMatrixWorld(true);
  }

  function setLoading(on) {
    root.classList.toggle('is-loading', on);
    if (loadingEl) loadingEl.hidden = !on;
  }

  function disposeMaterial(mat) {
    if (!mat) return;
    ['map', 'normalMap', 'aoMap', 'roughnessMap', 'bumpMap'].forEach(function (key) {
      if (mat[key] && mat[key].dispose) mat[key].dispose();
    });
    if (mat.dispose) mat.dispose();
  }

  function applyFabricMaterial() {
    if (!fabricMaterial) return;
    fabricMeshes.forEach(function (mesh) {
      mesh.material = fabricMaterial;
    });
  }

  function textureUrl(col, fileIndex) {
    var folder = col.textureFolder || col.name;
    return studioBase() + 'textures/' + encodeURIComponent(folder + ' ' + fileIndex + '.jpg');
  }

  function colorCount(col) {
    return col.colorCount || (col.end - col.start + 1);
  }

  function colorCode(col, fileIndex) {
    return col.prefix + (col.start + fileIndex - 1);
  }

  function fabricIdFor(col, fileIndex) {
    return col.id + '_' + colorCode(col, fileIndex);
  }

  function configuratorUrl(fabricId) {
    var modelId = currentChairId;
    if (window.StoffusSite && window.StoffusSite.configuratorForFabric) {
      return window.StoffusSite.configuratorForFabric(fabricId, modelId);
    }
    return (window.StoffusSite && window.StoffusSite.configurator) || '/Studio3D/app.html';
  }

  function updateCaption(col, fileIndex) {
    if (!captionEl || !col) return;
    captionEl.textContent = col.name + ' · ' + colorCode(col, fileIndex);
  }

  function updateConfigLink(col, fileIndex) {
    if (!configBtn || !col) return;
    configBtn.href = configuratorUrl(fabricIdFor(col, fileIndex));
  }

  function renderColors(col) {
    if (!colorsEl) return;
    colorsEl.innerHTML = '';
    var total = colorCount(col);
    var maxVisible = Math.min(total, 20);
    for (var i = 1; i <= maxVisible; i++) {
      (function (fileIndex) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fabric-chair__color' + (fileIndex === activeIndex ? ' is-active' : '');
        btn.setAttribute('aria-label', col.name + ' ' + colorCode(col, fileIndex));
        var img = document.createElement('img');
        img.src = textureUrl(col, fileIndex);
        img.alt = '';
        img.loading = 'lazy';
        btn.appendChild(img);
        btn.addEventListener('click', function () {
          selectColor(col, fileIndex);
        });
        colorsEl.appendChild(btn);
      })(i);
    }
  }

  function selectColor(col, fileIndex) {
    activeCol = col;
    activeIndex = fileIndex;
    if (collectionSelect && collectionSelect.value !== col.id) {
      collectionSelect.value = col.id;
    }
    updateCaption(col, fileIndex);
    updateConfigLink(col, fileIndex);
    renderColors(col);
    applyFabric(col, fileIndex);
  }

  function selectCollection(colId) {
    var col = null;
    for (var i = 0; i < COLLECTIONS.length; i++) {
      if (COLLECTIONS[i].id === colId) {
        col = COLLECTIONS[i];
        break;
      }
    }
    if (!col) return;
    selectColor(col, 1);
  }

  function applyFabric(col, fileIndex) {
    if (!col || !chairRoot) return Promise.resolve();
    var token = ++fabricLoadToken;
    var colName = col.textureFolder || col.name;
    var physics = fabricPhysics(col);
    var loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    root.classList.add('is-fabric-loading');

    return loadFirstTexture(loader, mapUrls(colName, fileIndex, 'base'))
      .then(function (colorTex) {
        if (token !== fabricLoadToken) return;
        colorTex.encoding = THREE.sRGBEncoding;
        applyTextureRepeat(colorTex);

        if (fabricMaterial) disposeMaterial(fabricMaterial);

        if (physics.isPele && typeof THREE.MeshPhysicalMaterial === 'function') {
          fabricMaterial = new THREE.MeshPhysicalMaterial({
            map: colorTex,
            color: 0xffffff,
            roughness: physics.roughness,
            metalness: physics.metalness,
            clearcoat: 0.06,
            clearcoatRoughness: 0.4,
            envMapIntensity: 0.22,
          });
        } else {
          fabricMaterial = new THREE.MeshStandardMaterial({
            map: colorTex,
            color: 0xffffff,
            roughness: physics.roughness,
            metalness: physics.metalness,
            envMapIntensity: 0.18,
          });
        }

        applyFabricMaterial();

        return loadFirstTexture(loader, mapUrls(colName, fileIndex, 'normal')).then(function (normalTex) {
          if (token !== fabricLoadToken || !fabricMaterial) return;
          applyTextureRepeat(normalTex);
          fabricMaterial.normalMap = normalTex;
          fabricMaterial.normalScale = physics.normalScale;
          fabricMaterial.needsUpdate = true;
          applyFabricMaterial();
        }).catch(function () {});
      })
      .then(function () {
        if (token !== fabricLoadToken) return;
        return loadFirstTexture(loader, mapUrls(colName, fileIndex, 'ambient')).then(function (aoTex) {
          if (token !== fabricLoadToken || !fabricMaterial) return;
          applyTextureRepeat(aoTex);
          fabricMaterial.aoMap = aoTex;
          fabricMaterial.aoMapIntensity = 0.95;
          fabricMaterial.needsUpdate = true;
          applyFabricMaterial();
        }).catch(function () {});
      })
      .finally(function () {
        if (token === fabricLoadToken) root.classList.remove('is-fabric-loading');
      });
  }

  function ensureGltfLoader() {
    if (!THREE.GLTFLoader) return null;
    if (!gltfLoader) {
      if (THREE.DRACOLoader) {
        dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath(DRACO_DECODER);
        dracoLoader.setDecoderConfig({ type: 'js' });
      }
      gltfLoader = new THREE.GLTFLoader();
      gltfLoader.setCrossOrigin('anonymous');
      if (dracoLoader) gltfLoader.setDRACOLoader(dracoLoader);
    }
    return gltfLoader;
  }

  function loadChair(chairId) {
    var loader = ensureGltfLoader();
    if (!loader) {
      root.classList.add('is-error');
      if (loadingEl) loadingEl.textContent = 'Visualizador 3D indisponível neste browser.';
      return Promise.reject(new Error('GLTFLoader'));
    }
    currentChairId = CHAIRS[chairId] ? chairId : 'osaka';
    if (modelSelect) modelSelect.value = currentChairId;

    var token = ++chairLoadToken;
    setLoading(true);

    if (chairRoot) {
      scene.remove(chairRoot);
      chairRoot.traverse(function (node) {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(function (m) { if (m && m.dispose) m.dispose(); });
          }
        }
      });
      chairRoot = null;
      fabricMeshes = [];
    }

    return new Promise(function (resolve, reject) {
      loader.load(
        chairModelUrl(currentChairId),
        function (gltf) {
          if (token !== chairLoadToken) return;
          chairRoot = gltf.scene;
          collectFabricMeshes(chairRoot);
          fitChair(chairRoot);
          scene.add(chairRoot);
          setLoading(false);
          root.classList.add('is-ready');
          if (activeCol) applyFabric(activeCol, activeIndex);
          resolve();
        },
        undefined,
        function (err) {
          if (token !== chairLoadToken) return;
          setLoading(false);
          root.classList.add('is-error');
          if (loadingEl) loadingEl.textContent = 'Não foi possível carregar o modelo 3D.';
          reject(err);
        }
      );
    });
  }

  function initScene() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.set(0.85, 0.72, 1.45);

    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 0.75;
      controls.maxDistance = 2.8;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.target.set(0, 0.42, 0);
    }

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9590, 0.62));
    var key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(2.5, 4.5, 3.2);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xfff5ee, 0.38);
    fill.position.set(-2.8, 1.2, -1.5);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffffff, 0.28);
    rim.position.set(-1, 2.5, 2.8);
    scene.add(rim);

    resize();
    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') {
      var stage = canvas.closest('.fabric-chair__stage');
      if (stage) {
        new ResizeObserver(function () {
          resize();
        }).observe(stage);
      }
    }

    function tick() {
      animationId = requestAnimationFrame(tick);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    tick();
  }

  function resize() {
    if (!renderer || !camera) return;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.floor(rect.width));
    var h = Math.max(1, Math.floor(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function buildCollectionSelect() {
    if (!collectionSelect) return;
    collectionSelect.innerHTML = '';
    COLLECTIONS.forEach(function (col) {
      var opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      collectionSelect.appendChild(opt);
    });
    collectionSelect.addEventListener('change', function () {
      selectCollection(collectionSelect.value);
    });
  }

  function buildModelSelect() {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    Object.keys(CHAIRS).forEach(function (id) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = CHAIRS[id].label;
      modelSelect.appendChild(opt);
    });
    modelSelect.addEventListener('change', function () {
      loadChair(modelSelect.value).then(function () {
        if (configBtn && activeCol) updateConfigLink(activeCol, activeIndex);
      });
    });
  }

  function initCatalog(data) {
    COLLECTIONS = (data.collections || []).filter(function (col) {
      return col && col.show !== false;
    });
    buildCollectionSelect();
    buildModelSelect();

    var preferred = COLLECTIONS[0];
    var featured = ['artis', 'matchy', 'falcon', 'prisma', 'mirage'];
    featured.forEach(function (id) {
      for (var i = 0; i < COLLECTIONS.length; i++) {
        if (COLLECTIONS[i].id === id) {
          preferred = COLLECTIONS[i];
          break;
        }
      }
    });

    if (preferred) {
      collectionSelect.value = preferred.id;
      selectColor(preferred, 1);
    }
  }

  window.StoffusFabricChair = {
    apply: function (col, fileIndex) {
      if (!col) return;
      selectColor(col, fileIndex || 1);
    },
    ready: function () {
      return !!chairRoot;
    },
    defaultChairId: function () {
      return currentChairId;
    },
  };

  initScene();
  loadChair('osaka').catch(function () {});

  fetch('data/fabrics.json')
    .then(function (res) {
      if (!res.ok) throw new Error('fabrics.json');
      return res.json();
    })
    .then(initCatalog)
    .catch(function () {
      if (loadingEl) loadingEl.textContent = 'Catálogo de tecidos indisponível.';
    });

  window.addEventListener('beforeunload', function () {
    cancelAnimationFrame(animationId);
    if (fabricMaterial) disposeMaterial(fabricMaterial);
  });
})();
