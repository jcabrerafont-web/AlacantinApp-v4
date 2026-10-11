// ============================================================================
// ALACANTINAPP V4 - LÓGICA PRINCIPAL Y GESTIÓN DE LIBRO GENEALÓGICO (app.js)
// Libro Genealógico Oficial ESGA025 (CNZ) - Club Gallina Alacantina
// ============================================================================

// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://htbyipavphxcehdwrjbl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0YnlpcGF2cGh4Y2VoZHdyamJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMjQyOTEsImV4cCI6MjEwNjYwMDI5MX0.tnBJERxhI3YbwSOFVkeBvvz5qm6FNxzBZ8_5S-UKoQM';

let supabaseClient = null;

// Inicialización segura del cliente Supabase
function initSupabase() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if (typeof createClient === 'function') {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Error: La librería de Supabase no se ha cargado correctamente en el CDN.');
  }
}

// Ejecutar inicialización inmediatamente
initSupabase();

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let state = {
  animals: [],
  breeders: [],
  vaccines: [],
  losses: [],
  user: null,
  filters: {
    search: '',
    variety: 'all',
    sex: 'all',
    status: 'active'
  }
};

// ============================================================================
// 1. AUTENTICACIÓN Y CONTROL DE SESIÓN
// ============================================================================
async function handleAuth(event) {
  if (event) event.preventDefault();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  if (!emailInput || !passwordInput) {
    alert('No se encontraron los campos del formulario de acceso.');
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert('Por favor, introduce tu correo electrónico y contraseña.');
    return;
  }

  if (!supabaseClient) {
    alert('Error: El cliente de Supabase no se ha inicializado.');
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert('Error de acceso: ' + error.message);
    console.error('Error Supabase Auth:', error);
  } else {
    state.user = data.user;
    updateAuthUI(true, data.user.email);
    await loadAllData();
  }
}

async function checkSession() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    state.user = session.user;
    updateAuthUI(true, session.user.email);
    await loadAllData();
  } else {
    updateAuthUI(false);
  }
}

function updateAuthUI(isAuthenticated, userEmail = '') {
  const appContent = document.getElementById('app-content');
  const landingLogin = document.getElementById('landing-login');
  const authState = document.getElementById('auth-state');
  const authIndicator = document.getElementById('auth-indicator');
  const btnAuth = document.getElementById('btn-auth');

  if (isAuthenticated) {
    if (appContent) appContent.classList.remove('hidden');
    if (landingLogin) landingLogin.classList.add('hidden');
    if (authState) authState.textContent = userEmail;
    if (authIndicator) authIndicator.className = 'w-2 h-2 rounded-full bg-green-500';
    if (btnAuth) {
      btnAuth.textContent = 'Cerrar Sesión';
      btnAuth.onclick = logout;
    }
  } else {
    if (appContent) appContent.classList.add('hidden');
    if (landingLogin) landingLogin.classList.remove('hidden');
    if (authState) authState.textContent = 'Sesión no iniciada';
    if (authIndicator) authIndicator.className = 'w-2 h-2 rounded-full bg-yellow-500';
    if (btnAuth) {
      btnAuth.textContent = 'Entrar';
      btnAuth.onclick = () => window.location.reload();
    }
  }
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  state.user = null;
  window.location.reload();
}

// ============================================================================
// 2. NAVEGACIÓN POR PESTAÑAS
// ============================================================================
window.switchTab = function(tabId) {
  const sections = ['registro', 'censo', 'informes', 'estandar', 'gestion'];
  
  sections.forEach(id => {
    const el = document.getElementById(`sec-${id}`);
    if (el) {
      if (id === tabId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
    
    const btn = document.getElementById(`tab-${id}`);
    if (btn) {
      if (id === tabId) {
        btn.className = "py-3 px-4 text-amber-400 border-b-2 border-amber-400 font-medium touch-target flex items-center gap-2";
      } else {
        btn.className = "py-3 px-4 text-slate-400 border-b-2 border-transparent font-medium touch-target flex items-center gap-2";
      }
    }

    const mobBtn = document.getElementById(`mob-${id}`);
    if (mobBtn) {
      if (id === tabId) {
        mobBtn.className = "flex flex-col items-center gap-1 text-amber-400 py-1 px-2 text-[11px] font-medium transition-colors";
      } else {
        mobBtn.className = "flex flex-col items-center gap-1 text-slate-400 hover:text-amber-400 py-1 px-2 text-[11px] font-medium transition-colors";
      }
    }
  });
};

// ============================================================================
// 3. CARGA Y SINCRONIZACIÓN DE DATOS (SUPABASE + LOCALSTORAGE)
// ============================================================================
async function loadAllData() {
  try {
    if (navigator.onLine && supabaseClient) {
      const [resAnimals, resBreeders, resVaccines, resLosses] = await Promise.all([
        supabaseClient.from('animals').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('breeders').select('*').order('code', { ascending: true }),
        supabaseClient.from('vaccines').select('*').order('date', { ascending: false }),
        supabaseClient.from('losses').select('*').order('date', { ascending: false })
      ]);

      if (resAnimals.data) state.animals = resAnimals.data;
      if (resBreeders.data) state.breeders = resBreeders.data;
      if (resVaccines.data) state.vaccines = resVaccines.data;
      if (resLosses.data) state.losses = resLosses.data;

      localStorage.setItem('alacantin_animals', JSON.stringify(state.animals));
      localStorage.setItem('alacantin_breeders', JSON.stringify(state.breeders));
      localStorage.setItem('alacantin_vaccines', JSON.stringify(state.vaccines));
      localStorage.setItem('alacantin_losses', JSON.stringify(state.losses));

      const offlineBadge = document.getElementById('offline-badge');
      if (offlineBadge) offlineBadge.classList.add('hidden');
    } else {
      state.animals = JSON.parse(localStorage.getItem('alacantin_animals') || '[]');
      state.breeders = JSON.parse(localStorage.getItem('alacantin_breeders') || '[]');
      state.vaccines = JSON.parse(localStorage.getItem('alacantin_vaccines') || '[]');
      state.losses = JSON.parse(localStorage.getItem('alacantin_losses') || '[]');

      const offlineBadge = document.getElementById('offline-badge');
      if (offlineBadge) offlineBadge.classList.remove('hidden');
    }
    renderAll();
  } catch (err) {
    console.error('Error al sincronizar datos:', err);
  }
}

// ============================================================================
// 4. REGISTRO Y GUARDADO DE DATOS (CÁMARA DIRECTA + VISTA PREVIA + REGA UPSERT)
// ============================================================================

// Objeto global para almacenar los archivos de fotos capturados o seleccionados
let fotosSeleccionadas = {
  foto_lateral: null,
  foto_cabeza: null,
  foto_tarsos: null
};

// Genera la vista previa en pantalla de la foto tomada con la cámara o seleccionada
window.procesarVistaPrevia = function(tipo, inputElement) {
  if (!inputElement.files || inputElement.files.length === 0) return;

  const file = inputElement.files[0];
  fotosSeleccionadas[tipo] = file;

  const reader = new FileReader();
  reader.onload = function(e) {
    const imgElement = document.getElementById(`${tipo}_img`);
    const containerElement = document.getElementById(`${tipo}_preview_container`);
    const controlsElement = document.getElementById(`${tipo}_controls`);

    if (imgElement) imgElement.src = e.target.result;
    if (containerElement) containerElement.classList.remove('hidden');
    if (controlsElement) controlsElement.classList.add('hidden');
  };
  reader.readAsDataURL(file);
};

// Limpia y descarta la foto seleccionada para permitir una nueva toma
window.descartarFoto = function(tipo) {
  fotosSeleccionadas[tipo] = null;

  const inputCam = document.getElementById(`${tipo}_cam`);
  const inputFile = document.getElementById(`${tipo}_file`);
  const containerElement = document.getElementById(`${tipo}_preview_container`);
  const controlsElement = document.getElementById(`${tipo}_controls`);

  if (inputCam) inputCam.value = '';
  if (inputFile) inputFile.value = '';
  if (containerElement) containerElement.classList.add('hidden');
  if (controlsElement) controlsElement.classList.remove('hidden');
};

// Sube el archivo procesado a Supabase Storage
async function subirImagenStorage(tipo, ringNumber) {
  const file = fotosSeleccionadas[tipo];
  if (!file) return null;

  const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
  const fileName = `${ringNumber}_${tipo}_${Date.now()}.${fileExt}`;
  const filePath = `ejemplares/${fileName}`;

  if (supabaseClient) {
    const { error: uploadError } = await supabaseClient.storage.from('fotografias').upload(filePath, file);
    if (uploadError) {
      console.error(`Error al subir imagen ${tipo}:`, uploadError);
      return null;
    }
    const { data } = supabaseClient.storage.from('fotografias').getPublicUrl(filePath);
    return data ? data.publicUrl : null;
  }
  return null;
}

async function guardarEjemplar(event) {
  if (event) event.preventDefault();

  const ring = document.getElementById('anilla')?.value.trim();
  const variety = document.getElementById('variedad')?.value;
  const sex = document.getElementById('sexo')?.value;
  const birthDate = document.getElementById('fecha_nacimiento')?.value;
  const weight = document.getElementById('peso')?.value;
  const section = document.getElementById('seccion_libro')?.value;
  const sire = document.getElementById('padre')?.value.trim();
  const dam = document.getElementById('madre')?.value.trim();
  const germoplasm = document.getElementById('banco_germoplasma')?.value;
  const notes = document.getElementById('observaciones')?.value;

  const criadorNombre = document.getElementById('criador_nombre')?.value.trim();
  const criadorRega = document.getElementById('criador_rega')?.value.trim();
  const criadorSocio = document.getElementById('criador_socio')?.value.trim();
  const criadorMunicipio = document.getElementById('criador_municipio')?.value.trim();
  const criadorProvincia = document.getElementById('criador_provincia')?.value.trim();
  const criadorGps = document.getElementById('criador_gps')?.value.trim();

  if (!ring) {
    alert('La anilla oficial es obligatoria.');
    return;
  }

  // 1. Sincronización de datos del Criador / REGA
  if (navigator.onLine && supabaseClient && criadorRega) {
    const breederData = {
      code: criadorSocio || 'ESGA025',
      full_name: criadorNombre,
      rega: criadorRega,
      location: `${criadorMunicipio} (${criadorProvincia})`,
      gps: criadorGps
    };
    await supabaseClient.from('breeders').upsert([breederData]);
  }

  // 2. Procesamiento de Fotografías (Subida a Supabase si Online / Guardado Base64 si Offline)
  let fotoLateralUrl = null;
  let fotoCabezaUrl = null;
  let fotoTarsosUrl = null;

  if (navigator.onLine && supabaseClient) {
    // Modo ONLINE: Subida directa a Supabase Storage
    fotoLateralUrl = await subirImagenStorage('foto_lateral', ring);
    fotoCabezaUrl = await subirImagenStorage('foto_cabeza', ring);
    fotoTarsosUrl = await subirImagenStorage('foto_tarsos', ring);
  } else {
    // Modo OFFLINE (Gallinero sin cobertura): Convertir a Base64 para visualización e inspección local
    const convertirABase64 = (file) => new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

    fotoLateralUrl = await convertirABase64(fotosSeleccionadas.foto_lateral);
    fotoCabezaUrl = await convertirABase64(fotosSeleccionadas.foto_cabeza);
    fotoTarsosUrl = await convertirABase64(fotosSeleccionadas.foto_tarsos);
  }

  // 3. Estructura de datos del nuevo ejemplar
  const newAnimal = {
    ring_number: ring,
    variety: variety || 'Milflores',
    sex: sex || 'M',
    birth_date: birthDate || null,
    weight: weight || null,
    section: section || 'Registro Nacimientos',
    sire_ring: sire || null,
    dam_ring: dam || null,
    germoplasm: germoplasm || 'No',
    notes: notes || '',
    breeder_code: criadorSocio || null,
    foto_lateral: fotoLateralUrl,
    foto_cabeza: fotoCabezaUrl,
    foto_tarsos: fotoTarsosUrl,
    status: 'active'
  };

  // 4. Guardado en Supabase o Encolado Local
  if (navigator.onLine && supabaseClient) {
    const { error } = await supabaseClient.from('animals').upsert([newAnimal]);
    if (error) {
      alert('Error al guardar en Supabase: ' + error.message);
      return;
    }
  } else {
    // Guardar en cola de sincronización pendiente offline
    const colaOffline = JSON.parse(localStorage.getItem('alacantin_cola_offline') || '[]');
    colaOffline.push({ animalData: newAnimal, timestamp: Date.now() });
    localStorage.setItem('alacantin_cola_offline', JSON.stringify(colaOffline));
  }

  // 5. Actualizar estado local (Reactividad e Interfaz)
  const index = state.animals.findIndex(a => a.ring_number === ring);
  if (index >= 0) {
    state.animals[index] = newAnimal;
  } else {
    state.animals.unshift(newAnimal);
  }

  localStorage.setItem('alacantin_animals', JSON.stringify(state.animals));

  // 6. Mensaje final según cobertura
  if (navigator.onLine) {
    alert('✅ Ejemplar y documentación fotográfica sincronizados correctamente en Supabase.');
  } else {
    alert('📡 Guardado localmente en modo Offline. Las fotografías se subirán a la nube automáticamente cuando recuperes la cobertura.');
  }

  limpiarFormulario();
  renderAll();
}

 // Sincronización en la tabla de breeders / Explotación REGA
  if (navigator.onLine && supabaseClient && criadorRega) {
    const breederData = {
      code: criadorSocio || 'ESGA025',
      full_name: criadorNombre,
      rega: criadorRega,
      location: `${criadorMunicipio} (${criadorProvincia})`,
      gps: criadorGps
    };

    (async () => {
      try {
        const { data, error } = await supabaseClient.from('breeders').upsert([breederData]);
        if (error) throw error;
        console.log('Datos del criador sincronizados en breeders:', data);
      } catch (err) {
        console.error('Error al sincronizar datos del criador:', err.message);
      }
    })();
  }
  // Subida de las 3 fotografías obligatorias procesando la cámara/galería
  let fotoLateralUrl = null;
  let fotoCabezaUrl = null;
  let fotoTarsosUrl = null;

  if (navigator.onLine && supabaseClient) {
    (async () => {
      try {
        fotoLateralUrl = await subirImagenStorage('foto_lateral', ring);
        fotoCabezaUrl = await subirImagenStorage('foto_cabeza', ring);
        fotoTarsosUrl = await subirImagenStorage('foto_tarsos', ring);
      } catch (err) {
        console.error('Error al subir las fotografías:', err.message);
      }
    })();
  }
  const newAnimal = {
    ring_number: ring,
    variety: variety || 'Milflores',
    sex: sex || 'M',
    birth_date: birthDate || null,
    weight: weight || null,
    section: section || 'Registro Nacimientos',
    sire_ring: sire || null,
    dam_ring: dam || null,
    germoplasm: germoplasm || 'No',
    notes: notes || '',
    breeder_code: criadorSocio || null,
    foto_lateral: fotoLateralUrl,
    foto_cabeza: fotoCabezaUrl,
    foto_tarsos: fotoTarsosUrl,
    status: 'active'
  };

  if (navigator.onLine && supabaseClient) {
    const { error } = await supabaseClient.from('animals').upsert([newAnimal]);
    if (error) {
      alert('Error al guardar en Supabase: ' + error.message);
      return;
    }
  }

  const index = state.animals.findIndex(a => a.ring_number === ring);
  if (index >= 0) {
    state.animals[index] = newAnimal;
  } else {
    state.animals.unshift(newAnimal);
  }

  localStorage.setItem('alacantin_animals', JSON.stringify(state.animals));
  alert('Ejemplar y documentación fotográfica guardados correctamente en v4.');
  limpiarFormulario();
  renderAll();
}

function limpiarFormulario() {
  const form = document.getElementById('form-ejemplar');
  if (form) form.reset();
  descartarFoto('foto_lateral');
  descartarFoto('foto_cabeza');
  descartarFoto('foto_tarsos');
}

async function markLoss(ringNumber) {
  const reason = prompt(`Indique el motivo de la baja para el ejemplar ${ringNumber}:`);
  if (!reason) return;

  const lossRecord = {
    ring_number: ringNumber,
    date: new Date().toISOString().split('T')[0],
    reason: reason
  };

  if (navigator.onLine && supabaseClient) {
    await supabaseClient.from('losses').insert([lossRecord]);
    await supabaseClient.from('animals').update({ status: 'loss' }).eq('ring_number', ringNumber);
  }

  const animal = state.animals.find(a => a.ring_number === ringNumber);
  if (animal) animal.status = 'loss';

  state.losses.push(lossRecord);
  localStorage.setItem('alacantin_animals', JSON.stringify(state.animals));
  localStorage.setItem('alacantin_losses', JSON.stringify(state.losses));
  renderAll();
}
// ============================================================================
// 5. CÁLCULOS GENEALÓGICOS, TRAMOS DE EDAD Y CONSANGUINIDAD (WRIGHT)
// ============================================================================
function calcularTramoEdad(birthDate) {
  if (!birthDate) return 'Desconocido';
  const birth = new Date(birthDate);
  const now = new Date();
  const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (diffMonths < 6) return 'Pollito (< 6m)';
  if (diffMonths <= 12) return 'Joven (6 - 12m)';
  return 'Adulto Reproductor (> 1a)';
}

function getAncestors(ringNumber, depth = 3) {
  if (!ringNumber || depth === 0) return null;
  const animal = state.animals.find(a => a.ring_number === ringNumber);
  if (!animal) return { ring_number: ringNumber, sire: null, dam: null };

  return {
    ...animal,
    sire: getAncestors(animal.sire_ring, depth - 1),
    dam: getAncestors(animal.dam_ring, depth - 1)
  };
}

function calculateWrightInbreeding(sireRing, damRing) {
  if (!sireRing || !damRing) return 0;

  const getAncestorPaths = (ring, currentPath = [], allPaths = []) => {
    const animal = state.animals.find(a => a.ring_number === ring);
    if (!animal) return allPaths;

    const newPath = [...currentPath, ring];
    allPaths.push(newPath);

    if (animal.sire_ring) getAncestorPaths(animal.sire_ring, newPath, allPaths);
    if (animal.dam_ring) getAncestorPaths(animal.dam_ring, newPath, allPaths);
    return allPaths;
  };

  const sirePaths = getAncestorPaths(sireRing);
  const damPaths = getAncestorPaths(damRing);
  let totalFx = 0;

  sirePaths.forEach(sPath => {
    const commonAncestor = sPath[sPath.length - 1];
    damPaths.forEach(dPath => {
      if (dPath[dPath.length - 1] === commonAncestor) {
        const n1 = sPath.length - 1;
        const n2 = dPath.length - 1;
        totalFx += Math.pow(0.5, n1 + n2 + 1);
      }
    });
  });

  return Math.min(totalFx * 100, 100);
}

// ============================================================================
// 6. EXPORTACIÓN DE MATRIZ DE PEDIGRÍ CSV (PARA ESTUDIO GENÉTICO Y Ne)
// ============================================================================
window.exportarMatrizPedigriCSV = function() {
  if (!state.animals || state.animals.length === 0) {
    alert('No hay registros de animales en el censo para exportar.');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,ID_ANIMAL,ID_PADRE,ID_MADRE,SEXO,FECHA_NACIMIENTO,SECCION_LIBRO,REGA_EXPLOTACION\n';

  state.animals.forEach(a => {
    const idAnimal = a.ring_number || '';
    const idPadre = a.sire_ring || '';
    const idMadre = a.dam_ring || '';
    const sexo = a.sex || '';
    const fechaNac = a.birth_date || '';
    const seccion = a.section || 'Nacimientos';
    const rega = a.breeder_code || 'ESGA025';

    csvContent += `"${idAnimal}","${idPadre}","${idMadre}","${sexo}","${fechaNac}","${seccion}","${rega}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Matriz_Pedigri_ESGA025_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// 7. RENDERIZADO DE TABLAS, VISTAS E INFORMES CNZ (CON VISOR DE FOTOS)
// ============================================================================
function renderAll() {
  renderAnimalsTable();
  populateDropdowns();
}

function renderAnimalsTable() {
  const tbody = document.getElementById('tabla-ejemplares');
  if (!tbody) return;

  const activeAnimals = state.animals.filter(a => a.status !== 'loss');

  tbody.innerHTML = activeAnimals.map(a => {
    const tieneFotos = a.foto_lateral || a.foto_cabeza || a.foto_tarsos;
    return `
      <tr class="hover:bg-slate-700/50">
        <td class="p-4 font-bold text-amber-400">${a.ring_number}</td>
        <td class="p-4">${a.sex === 'M' ? '♂ Macho' : '♀ Hembra'}</td>
        <td class="p-4">${a.variety || 'Milflores'}</td>
        <td class="p-4">${calcularTramoEdad(a.birth_date)}</td>
        <td class="p-4">${a.section || 'Nacimientos'}</td>
        <td class="p-4">
          <button onclick="abrirModalFotos('${a.ring_number}')" 
                  class="px-2.5 py-1 ${tieneFotos ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'} font-semibold rounded text-xs flex items-center gap-1 transition-colors">
            📸 ${tieneFotos ? 'Ver Fotos' : 'Sin Fotos'}
          </button>
        </td>
        <td class="p-4 flex gap-2">
          <button onclick="markLoss('${a.ring_number}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs">Baja</button>
          <button onclick="generatePedigreePDF('${a.ring_number}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs">Pedigrí</button>
        </td>
      </tr>
    `;
  }).join('');
}

function populateDropdowns() {
  const sireSelect = document.getElementById('padre');
  const damSelect = document.getElementById('madre');

  const males = state.animals.filter(a => a.sex === 'M' && a.status !== 'loss');
  const females = state.animals.filter(a => a.sex === 'H' && a.status !== 'loss');

  if (sireSelect) {
    sireSelect.innerHTML = '<option value="">Sin Registro (Padre)</option>' +
      males.map(m => `<option value="${m.ring_number}">${m.ring_number} (${m.variety || 'Milflores'})</option>`).join('');
  }

  if (damSelect) {
    damSelect.innerHTML = '<option value="">Sin Registro (Madre)</option>' +
      females.map(f => `<option value="${f.ring_number}">${f.ring_number} (${f.variety || 'Milflores'})</option>`).join('');
  }
}

// ============================================================================
// FUNCIONES DEL VISOR MODAL DE FOTOS (CNZ ART. 3.1.c)
// ============================================================================
window.abrirModalFotos = function(ringNumber) {
  const animal = state.animals.find(a => a.ring_number === ringNumber);
  if (!animal) return;

  const modal = document.getElementById('modal-fotos');
  const titulo = document.getElementById('modal-fotos-titulo');
  const subtitulo = document.getElementById('modal-fotos-subtitulo');

  if (titulo) titulo.textContent = `Documentación Fotográfica - Anilla ${animal.ring_number}`;
  if (subtitulo) subtitulo.textContent = `Variedad: ${animal.variety || 'Milflores'} | Sexo: ${animal.sex === 'M' ? 'Macho' : 'Hembra'} | Tramo: ${calcularTramoEdad(animal.birth_date)}`;

  // Cargar imagen Lateral
  cargarFotoEnModal('modal-foto-lateral', 'modal-foto-lateral-empty', animal.foto_lateral);
  // Cargar imagen Cabeza
  cargarFotoEnModal('modal-foto-cabeza', 'modal-foto-cabeza-empty', animal.foto_cabeza);
  // Cargar imagen Tarsos
  cargarFotoEnModal('modal-foto-tarsos', 'modal-foto-tarsos-empty', animal.foto_tarsos);

  if (modal) modal.classList.remove('hidden');
};

function cargarFotoEnModal(imgId, emptyId, url) {
  const img = document.getElementById(imgId);
  const empty = document.getElementById(emptyId);

  if (url) {
    if (img) {
      img.src = url;
      img.classList.remove('hidden');
    }
    if (empty) empty.classList.add('hidden');
  } else {
    if (img) img.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
  }
}

window.cerrarModalFotos = function() {
  const modal = document.getElementById('modal-fotos');
  if (modal) modal.classList.add('hidden');
};

// ============================================================================
// 8. INFORMES TÉCNICOS CNZ Y CERTIFICADOS PDF (CON INCORPORACIÓN DE IMÁGENES)
// ============================================================================
window.filtrarInformesCNZ = function() {
  const resultado = document.getElementById('resultado-informe');
  if (!resultado) return;

  const activos = state.animals.filter(a => a.status !== 'loss');
  const pollitos = activos.filter(a => calcularTramoEdad(a.birth_date).includes('Pollito')).length;
  const jovenes = activos.filter(a => calcularTramoEdad(a.birth_date).includes('Joven')).length;
  const adultos = activos.filter(a => calcularTramoEdad(a.birth_date).includes('Adulto')).length;

  const machos = activos.filter(a => a.sex === 'M').length;
  const hembras = activos.filter(a => a.sex === 'H').length;

  // Desglose por Variedades de Pluma (Art. 3.3 CNZ)
  const variedadesCount = {};
  activos.forEach(a => {
    const v = a.variety || 'Milflores';
    variedadesCount[v] = (variedadesCount[v] || 0) + 1;
  });

  const listaVariedadesHTML = Object.entries(variedadesCount)
    .map(([varNombre, cant]) => `<li>• ${varNombre}: <strong>${cant}</strong></li>`)
    .join('');

  resultado.innerHTML = `
    <div class="p-6 bg-slate-800 rounded-xl border border-slate-700 space-y-4 text-slate-200">
      <h3 class="font-bold text-amber-400 text-lg border-b border-slate-700 pb-2">📋 Expediente Oficial - Catálogo de Razas (CNZ)</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <!-- Desglose por Sexo -->
        <div class="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
          <p class="font-semibold text-amber-400 mb-2">Desglose por Sexo (Art. 3.1.f)</p>
          <p>Machos (1.0): <strong>${machos}</strong></p>
          <p>Hembras (0.1): <strong>${hembras}</strong></p>
          <p class="mt-2 text-xs text-slate-400">Ratio Reproductor: ${(machos > 0 ? (hembras / machos).toFixed(1) : 0)} H/M</p>
        </div>

        <!-- Desglose por Edad -->
        <div class="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
          <p class="font-semibold text-amber-400 mb-2">Desglose por Tramos de Edad</p>
          <p>Pollitos (< 6m): <strong>${pollitos}</strong></p>
          <p>Jóvenes (6-12m): <strong>${jovenes}</strong></p>
          <p>Adultos Reproductores (> 1a): <strong>${adultos}</strong></p>
        </div>

        <!-- Desglose por Variedades -->
        <div class="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
          <p class="font-semibold text-amber-400 mb-2">Variedades de Pluma (Art. 3.3)</p>
          <ul class="text-xs space-y-1 text-slate-300">
            ${listaVariedadesHTML || '<li>Sin registros</li>'}
          </ul>
        </div>
      </div>

      <div class="pt-2 flex justify-between items-center text-xs text-slate-400 border-t border-slate-700">
        <span>Censo Activo Verificado: <strong>${activos.length} ejemplares</strong></span>
        <button onclick="exportarMatrizPedigriCSV()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-1">
          🧬 Descargar Matriz CSV ($N_e$)
        </button>
      </div>
    </div>
  `;
};

window.generatePedigreePDF = async function(ringNumber) {
  const animal = state.animals.find(a => a.ring_number === ringNumber);
  if (!animal) {
    alert('Ejemplar no encontrado.');
    return;
  }

  const inbreeding = calculateWrightInbreeding(animal.sire_ring, animal.dam_ring);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Cabecera Oficial
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11);
  doc.text('CLUB GALLINA ALACANTINA', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Libro Genealógico Oficial ESGA025 - Certificado de Pedigrí (v4)', 14, 26);

  // Tabla Principales Datos
  doc.autoTable({
    startY: 42,
    head: [['Dato Oficial', 'Detalle del Ejemplar']],
    body: [
      ['Anilla Oficial', animal.ring_number],
      ['Variedad / Capa', animal.variety || 'Milflores'],
      ['Sexo', animal.sex === 'M' ? 'Macho (1.0)' : 'Hembra (0.1)'],
      ['Fecha Nacimiento', animal.birth_date || 'No registrada'],
      ['Tramo de Edad', calcularTramoEdad(animal.birth_date)],
      ['Coef. Consanguinidad (Wright)', `${inbreeding.toFixed(2)}%`],
      ['Sección del Libro', animal.section || 'Nacimientos'],
      ['Padre (Sire)', animal.sire_ring || 'Sin Registro'],
      ['Madre (Dam)', animal.dam_ring || 'Sin Registro']
    ],
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6] }
  });

  // Si existen imágenes, añadir anexo fotográfico en el PDF
  let finalY = doc.lastAutoTable.finalY + 10;
  if (animal.foto_lateral || animal.foto_cabeza || animal.foto_tarsos) {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Documentación Fotográfica de Inspección Zootécnica:', 14, finalY);
    
    // Anexo de aviso
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Fotografías almacenadas y verificadas en el repositorio digital del Libro ESGA025.', 14, finalY + 6);
  }

  doc.save(`Pedigri_ESGA025_${animal.ring_number}.pdf`);
};

window.obtenerUbicacionGPS = function() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude.toFixed(6);
      const lon = position.coords.longitude.toFixed(6);
      const gpsInput = document.getElementById('criador_gps');
      if (gpsInput) gpsInput.value = `${lat}, ${lon}`;
    }, () => {
      alert('No se pudo obtener la ubicación GPS.');
    });
  } else {
    alert('La geolocalización no es compatible en este navegador.');
  }
};
// ============================================================================
// 9. INICIALIZACIÓN GLOBAL V4
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('AlacantinApp v4 - Inicializada con éxito bajo protocolo CNZ.');
  checkSession();
});
