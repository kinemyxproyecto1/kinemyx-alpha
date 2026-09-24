/* =========================================================
   KINEMYX Beta 0.8.1
   Dual View Tracking Engine

   MOVIMIENTOS  -> vista lateral unilateral
   SALTOS       -> vista frontal bilateral

   Principios de esta versión:
   - No mezclar lados durante una serie de movimientos.
   - Filtrar puntos anatómicos antes de dibujar/calcular.
   - Rechazar saltos bruscos de keypoints (outliers).
   - Mantener una articulación solo por un tiempo muy breve
     cuando MoveNet pierde confianza.
   - No usar flexión sagital de rodilla como métrica de salto
     cuando la cámara está frontal.

   0.8.1 · Overlay de tracking por modo de evaluación:
   - Tamaños del overlay escalados a la pantalla (iPhone legible).
   - Lateral: cadena principal según ejercicio, articulación
     medida destacada con arco y valor de flexión, etiquetas.
   - Frontal: piernas IZQ/DER diferenciadas, línea media y
     líneas base de tobillos/cadera durante la serie.
   - Punto ámbar = visible pero no apto para medir;
     punto hueco = posición retenida (no detectado este frame).
   - Sin cambios en umbrales, filtros ni motores de medición.
========================================================= */


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const APP_VERSION = "KINEMYX Beta 0.8.1";
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xljdjgbg";

const ACCESS_PASSWORD_HASH =
  "d7e96f2eeab5be2c90a72189cea3b274a1f3f31bdfda583b3969218a13a66f92";

const ACCESS_STORAGE_KEY = "kinemyx_beta_access";
const TESTER_NAME_STORAGE_KEY = "kinemyx_beta_tester_name";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


/* =========================================================
   ACCESS DOM
========================================================= */

const accessGate = $("accessGate");
const appRoot = $("appRoot");
const accessForm = $("accessForm");
const accessName = $("accessName");
const accessPassword = $("accessPassword");
const accessSubmitButton = $("accessSubmitButton");
const accessStatus = $("accessStatus");
const togglePasswordButton = $("togglePasswordButton");
const logoutButton = $("logoutButton");
const testerNameDisplay = $("testerNameDisplay");


/* =========================================================
   ACCESS
========================================================= */

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getTesterName() {
  return localStorage.getItem(TESTER_NAME_STORAGE_KEY) || "Tester no identificado";
}

function showApplication() {
  accessGate.classList.add("hidden");
  appRoot.classList.remove("hidden");
  testerNameDisplay.textContent = getTesterName();
}

function showAccessGate() {
  appRoot.classList.add("hidden");
  accessGate.classList.remove("hidden");
  accessPassword.value = "";
}

function initializeAccessGate() {
  const granted = localStorage.getItem(ACCESS_STORAGE_KEY);
  const name = localStorage.getItem(TESTER_NAME_STORAGE_KEY);

  if (granted === "granted" && name) {
    showApplication();
  } else {
    showAccessGate();
  }
}

async function submitAccess(event) {
  event.preventDefault();

  const name = accessName.value.trim();
  const password = accessPassword.value;

  if (!name) {
    accessStatus.textContent = "Escribe tu nombre para continuar.";
    accessStatus.className = "access-status error";
    return;
  }

  if (!password) {
    accessStatus.textContent = "Ingresa la clave de acceso.";
    accessStatus.className = "access-status error";
    return;
  }

  accessSubmitButton.disabled = true;
  accessSubmitButton.textContent = "Verificando...";

  try {
    const enteredHash = await sha256(password);

    if (enteredHash !== ACCESS_PASSWORD_HASH) {
      accessStatus.textContent = "Clave incorrecta.";
      accessStatus.className = "access-status error";
      accessPassword.value = "";
      return;
    }

    localStorage.setItem(ACCESS_STORAGE_KEY, "granted");
    localStorage.setItem(TESTER_NAME_STORAGE_KEY, name);

    accessStatus.textContent = "✓ Acceso autorizado";
    accessStatus.className = "access-status success";

    setTimeout(showApplication, 180);
  } catch (error) {
    console.error(error);
    accessStatus.textContent = "No fue posible verificar el acceso.";
    accessStatus.className = "access-status error";
  } finally {
    accessSubmitButton.disabled = false;
    accessSubmitButton.textContent = "Ingresar a KINEMYX";
  }
}

function togglePasswordVisibility() {
  const hidden = accessPassword.type === "password";
  accessPassword.type = hidden ? "text" : "password";
  togglePasswordButton.textContent = hidden ? "Ocultar" : "Ver";
}

function logout() {
  localStorage.removeItem(ACCESS_STORAGE_KEY);
  localStorage.removeItem(TESTER_NAME_STORAGE_KEY);
  stopCamera();
  accessName.value = "";
  showAccessGate();
}

accessForm.addEventListener("submit", submitAccess);
togglePasswordButton.addEventListener("click", togglePasswordVisibility);
logoutButton.addEventListener("click", logout);


/* =========================================================
   DOM
========================================================= */

const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const cameraWrapper = video.parentElement;

const movementCategoryButton = $("movementCategoryButton");
const jumpCategoryButton = $("jumpCategoryButton");
const movementExerciseSelector = $("movementExerciseSelector");
const jumpExerciseSelector = $("jumpExerciseSelector");

const viewModeBadge = $("viewModeBadge");
const positionTipText = $("positionTipText");
const sideSelectorPanel = $("sideSelectorPanel");
const sideModeHelp = $("sideModeHelp");

const movementSettingsSection = $("movementSettingsSection");
const jumpSettingsSection = $("jumpSettingsSection");
const movementConfigDetails = $("movementConfigDetails");
const jumpConfigDetails = $("jumpConfigDetails");

const cameraButton = $("cameraButton");
const switchCameraButton = $("switchCameraButton");
const startButton = $("startButton");
const stopButton = $("stopButton");

const liveExerciseLabel = $("liveExerciseLabel");
const countLabel = $("countLabel");
const primaryMetricLabel = $("primaryMetricLabel");
const secondaryMetricLabel = $("secondaryMetricLabel");
const tertiaryMetricLabel = $("tertiaryMetricLabel");
const repDisplay = $("repDisplay");
const angleDisplay = $("angleDisplay");
const stateDisplay = $("stateDisplay");
const eccDisplay = $("eccDisplay");
const conDisplay = $("conDisplay");
const sideLiveLabel = $("sideLiveLabel");
const sideDisplay = $("sideDisplay");
const trackingLiveDisplay = $("trackingLiveDisplay");
const statusBox = $("status");
const warningBox = $("warning");

const positionGuide = $("positionGuide");
const positionGuideTitle = $("positionGuideTitle");
const positionGuideText = $("positionGuideText");

const movementResultsSection = $("movementResults");
const movementResultsTitle = $("movementResultsTitle");
const movementSummary = $("movementSummary");
const movementResultsBody = $("movementResultsBody");
const movementAngleHeader = $("movementAngleHeader");

const jumpResultsSection = $("jumpResults");
const jumpResultsTitle = $("jumpResultsTitle");
const jumpSummary = $("jumpSummary");
const jumpResultsBody = $("jumpResultsBody");
const jumpProtocolHeader = $("jumpProtocolHeader");

const stepAnalysis = $("stepAnalysis");
const stepCamera = $("stepCamera");
const stepPosition = $("stepPosition");
const stepStart = $("stepStart");

const stepAnalysisText = $("stepAnalysisText");
const stepCameraText = $("stepCameraText");
const stepPositionText = $("stepPositionText");
const stepStartText = $("stepStartText");

const stepAnalysisStatus = $("stepAnalysisStatus");
const stepCameraStatus = $("stepCameraStatus");
const stepPositionStatus = $("stepPositionStatus");
const stepStartStatus = $("stepStartStatus");

const movementAngleName = $("movementAngleName");
const movementTargetReps = $("movementTargetReps");
const movementAngleTarget = $("movementAngleTarget");
const movementAngleTolerance = $("movementAngleTolerance");
const movementEccTarget = $("movementEccTarget");
const movementEccTolerance = $("movementEccTolerance");
const movementConTarget = $("movementConTarget");
const movementConTolerance = $("movementConTolerance");
const movementFeedbackMode = $("movementFeedbackMode");
const movementCheckAngle = $("movementCheckAngle");
const movementCheckEcc = $("movementCheckEcc");
const movementCheckCon = $("movementCheckCon");
const movementCheckAngleText = $("movementCheckAngleText");

const jumpTargetJumps = $("jumpTargetJumps");
const sjHoldWrap = $("sjHoldWrap");
const sjHoldTarget = $("sjHoldTarget");
const jumpFeedbackMode = $("jumpFeedbackMode");
const jumpCheckFlight = $("jumpCheckFlight");
const jumpCheckLanding = $("jumpCheckLanding");
const jumpProtocolNote = $("jumpProtocolNote");

const feedbackForm = $("feedbackForm");
const feedbackExercise = $("feedbackExercise");
const feedbackProfile = $("feedbackProfile");
const feedbackType = $("feedbackType");
const feedbackExperience = $("feedbackExperience");
const feedbackMessage = $("feedbackMessage");
const feedbackContact = $("feedbackContact");
const feedbackSubmit = $("feedbackSubmit");
const feedbackStatus = $("feedbackStatus");


/* =========================================================
   GENERAL STATE
========================================================= */

let detector = null;
let detectorProfile = null;
let detectorLoading = false;
let detectorLoadToken = 0;

let cameraReady = false;
let trackingReady = false;
let analysisActive = false;
let detectionLoopStarted = false;
let currentStream = null;
let currentFacingMode = "user";

let activeCategory = "movement";
let activeExercise = "squat";

let sideMode = "auto";
let candidateSide = "left";
let activeSide = "left";
let lockedSide = null;

let lastGoodTrackingAt = 0;
let lastPositionAssessment = null;

let audioContext = null;
let trackingLostSince = null;
let trackingAlertPlayed = false;
let warningHideTimer = null;


/* =========================================================
   TRACKING CONSTANTS
========================================================= */

const MIN_POINT_CONFIDENCE = 0.42;
const MIN_TRACKING_CONFIDENCE = 0.58;
const RAW_POINT_ACCEPT_SCORE = 0.25;

const TRACKING_HOLD_MS = 450;
const POINT_DRAW_HOLD_MS = 150;
const POINT_MEASURE_HOLD_MOVEMENT_MS = 120;
const POINT_MEASURE_HOLD_JUMP_MS = 90;

const FRAME_MARGIN_X = 0.035;
const FRAME_MARGIN_Y = 0.045;

const TRACK_ALPHA_MOVEMENT = 0.62;
const TRACK_ALPHA_JUMP = 0.88;

const TRACK_MAX_SPEED_SCALE_MOVEMENT = 4.0;
const TRACK_MAX_SPEED_SCALE_JUMP = 7.0;

const SEGMENT_RATIO_MIN = 0.56;
const SEGMENT_RATIO_MAX = 1.62;
const SEGMENT_BASELINE_ALPHA = 0.04;

const GRAVITY = 9.81;


/* =========================================================
   POSE TRACKER STATE
========================================================= */

let jointTracks = new Map();
let segmentBaselines = new Map();
let trackerBodyScale = 300;
let lastPoseTimestamp = null;

const KP = {
  nose: 0,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16
};

const pointLabels = {
  shoulder: "hombro",
  elbow: "codo",
  wrist: "muñeca",
  hip: "cadera",
  knee: "rodilla",
  ankle: "tobillo"
};

function resetPoseTracker() {
  jointTracks = new Map();
  segmentBaselines = new Map();
  trackerBodyScale = 300;
  lastPoseTimestamp = null;
}

function estimateRawBodyScale(pose) {
  const kp = pose?.keypoints || [];
  const candidates = [];

  const pairs = [
    [KP.leftShoulder, KP.leftAnkle],
    [KP.rightShoulder, KP.rightAnkle],
    [KP.leftShoulder, KP.leftHip],
    [KP.rightShoulder, KP.rightHip]
  ];

  for (const [aIndex, bIndex] of pairs) {
    const a = kp[aIndex];
    const b = kp[bIndex];

    if (
      a &&
      b &&
      a.score >= RAW_POINT_ACCEPT_SCORE &&
      b.score >= RAW_POINT_ACCEPT_SCORE
    ) {
      const d = distance(a, b);
      if (d > 20) candidates.push(d);
    }
  }

  if (!candidates.length) return trackerBodyScale;

  const longCandidates = candidates.filter((value) => value > 80);
  const base = longCandidates.length ? Math.max(...longCandidates) : Math.max(...candidates) * 2.2;

  return clamp(base, 120, 1600);
}

function getTrackerAlpha() {
  return activeCategory === "jump" ? TRACK_ALPHA_JUMP : TRACK_ALPHA_MOVEMENT;
}

function getTrackerMaxSpeedScale() {
  return activeCategory === "jump"
    ? TRACK_MAX_SPEED_SCALE_JUMP
    : TRACK_MAX_SPEED_SCALE_MOVEMENT;
}

function stabilizePoint(rawPoint, index, timestamp, bodyScale) {
  const track = jointTracks.get(index);
  const alpha = getTrackerAlpha();
  const speedScale = getTrackerMaxSpeedScale();

  const rawValid =
    rawPoint &&
    Number.isFinite(rawPoint.x) &&
    Number.isFinite(rawPoint.y) &&
    (rawPoint.score || 0) >= RAW_POINT_ACCEPT_SCORE;

  if (rawValid) {
    if (!track) {
      const created = {
        x: rawPoint.x,
        y: rawPoint.y,
        score: rawPoint.score || 0,
        t: timestamp,
        lastFresh: timestamp
      };

      jointTracks.set(index, created);

      return {
        ...rawPoint,
        x: created.x,
        y: created.y,
        score: created.score,
        _fresh: true,
        _staleMs: 0,
        _outlier: false
      };
    }

    const dt = clamp((timestamp - track.t) / 1000, 1 / 120, 0.18);
    const displacement = Math.hypot(rawPoint.x - track.x, rawPoint.y - track.y);
    const minAllowance = bodyScale * (activeCategory === "jump" ? 0.12 : 0.09);
    const dynamicAllowance = bodyScale * speedScale * dt;
    const maxAllowed = Math.max(minAllowance, dynamicAllowance);

    const outlier = displacement > maxAllowed;

    if (!outlier) {
      track.x = alpha * rawPoint.x + (1 - alpha) * track.x;
      track.y = alpha * rawPoint.y + (1 - alpha) * track.y;
      track.score = rawPoint.score || 0;
      track.t = timestamp;
      track.lastFresh = timestamp;

      return {
        ...rawPoint,
        x: track.x,
        y: track.y,
        score: track.score,
        _fresh: true,
        _staleMs: 0,
        _outlier: false
      };
    }
  }

  if (track) {
    const staleMs = timestamp - track.lastFresh;

    if (staleMs <= POINT_DRAW_HOLD_MS) {
      track.t = timestamp;

      return {
        ...(rawPoint || {}),
        x: track.x,
        y: track.y,
        score: Math.min(track.score, 0.46),
        _fresh: false,
        _staleMs: staleMs,
        _outlier: rawValid
      };
    }
  }

  return {
    ...(rawPoint || {}),
    x: rawPoint?.x ?? 0,
    y: rawPoint?.y ?? 0,
    score: 0,
    _fresh: false,
    _staleMs: Infinity,
    _outlier: false
  };
}

function stabilizePose(rawPose, timestamp) {
  const rawScale = estimateRawBodyScale(rawPose);
  trackerBodyScale = 0.90 * trackerBodyScale + 0.10 * rawScale;

  const keypoints = rawPose.keypoints.map((point, index) =>
    stabilizePoint(point, index, timestamp, trackerBodyScale)
  );

  lastPoseTimestamp = timestamp;

  return {
    ...rawPose,
    keypoints
  };
}

function pointMeasureHoldLimit() {
  return activeCategory === "jump"
    ? POINT_MEASURE_HOLD_JUMP_MS
    : POINT_MEASURE_HOLD_MOVEMENT_MS;
}

function isPointUsable(point, minScore = MIN_POINT_CONFIDENCE) {
  if (!point) return false;
  if ((point.score || 0) < minScore) return false;
  if ((point._staleMs || 0) > pointMeasureHoldLimit()) return false;
  return true;
}

function isPointDrawable(point) {
  if (!point) return false;
  if ((point.score || 0) < 0.28) return false;
  if ((point._staleMs || 0) > POINT_DRAW_HOLD_MS) return false;
  return true;
}

function averagePointConfidence(points) {
  if (!points.length) return 0;
  return mean(points.map((point) => point?.score || 0)) || 0;
}

function segmentPlausible(name, a, b, update = true) {
  if (!isPointDrawable(a) || !isPointDrawable(b)) return false;

  const length = distance(a, b);
  if (!Number.isFinite(length) || length < 8) return false;
  if (length > trackerBodyScale * 1.15) return false;

  const baseline = segmentBaselines.get(name);

  if (!baseline) {
    if (update) segmentBaselines.set(name, length);
    return true;
  }

  const ratio = length / baseline;
  const ok = ratio >= SEGMENT_RATIO_MIN && ratio <= SEGMENT_RATIO_MAX;

  if (ok && update) {
    segmentBaselines.set(
      name,
      baseline * (1 - SEGMENT_BASELINE_ALPHA) + length * SEGMENT_BASELINE_ALPHA
    );
  }

  return ok;
}


/* =========================================================
   EXERCISE META
========================================================= */

const exerciseMeta = {
  squat: {
    category: "movement",
    name: "Sentadilla",
    live: "SQUAT",
    angleName: "Flexión de rodilla",
    angleShort: "KNEE FLEXION",
    defaultAngle: 90,
    defaultTolerance: 5,
    defaultReps: 8,
    defaultEcc: 2,
    defaultCon: 1
  },

  deadlift: {
    category: "movement",
    name: "Peso muerto",
    live: "DEADLIFT",
    angleName: "Flexión de cadera",
    angleShort: "HIP FLEXION",
    defaultAngle: 65,
    defaultTolerance: 10,
    defaultReps: 6,
    defaultEcc: 2,
    defaultCon: 1
  },

  bench: {
    category: "movement",
    name: "Press banca",
    live: "BENCH PRESS",
    angleName: "Flexión de codo",
    angleShort: "ELBOW FLEXION",
    defaultAngle: 90,
    defaultTolerance: 10,
    defaultReps: 8,
    defaultEcc: 2,
    defaultCon: 1
  },

  sj: {
    category: "jump",
    name: "Squat Jump",
    live: "SQUAT JUMP"
  },

  cmj: {
    category: "jump",
    name: "CMJ",
    live: "CMJ"
  },

  abalakov: {
    category: "jump",
    name: "Abalakov",
    live: "ABALAKOV"
  }
};


/* =========================================================
   SETTINGS
========================================================= */

function getMovementSettings() {
  return {
    targetReps: Math.max(1, Number(movementTargetReps.value) || 1),
    angleTarget: Number(movementAngleTarget.value) || 0,
    angleTolerance: Math.max(0, Number(movementAngleTolerance.value) || 0),
    eccTarget: Math.max(0, Number(movementEccTarget.value) || 0),
    eccTolerance: Math.max(0, Number(movementEccTolerance.value) || 0),
    conTarget: Math.max(0, Number(movementConTarget.value) || 0),
    conTolerance: Math.max(0, Number(movementConTolerance.value) || 0),
    feedbackMode: movementFeedbackMode.value,
    checkAngle: movementCheckAngle.checked,
    checkEcc: movementCheckEcc.checked,
    checkCon: movementCheckCon.checked
  };
}

function getJumpSettings() {
  return {
    targetJumps: Math.max(1, Number(jumpTargetJumps.value) || 1),
    holdTarget: Math.max(0.3, Number(sjHoldTarget.value) || 1),
    feedbackMode: jumpFeedbackMode.value,
    checkFlight: jumpCheckFlight.checked,
    checkLanding: jumpCheckLanding.checked
  };
}

function getActiveFeedbackMode() {
  return activeCategory === "movement"
    ? getMovementSettings().feedbackMode
    : getJumpSettings().feedbackMode;
}


/* =========================================================
   VIEW MODE / SIDE MODE
========================================================= */

function sideLabel(side) {
  return side === "left" ? "IZQUIERDO" : "DERECHO";
}

function updateViewModeUI() {
  const isMovement = activeCategory === "movement";

  viewModeBadge.textContent = isMovement ? "VISTA LATERAL" : "VISTA FRONTAL";
  sideSelectorPanel.classList.toggle("hidden", !isMovement);

  if (isMovement) {
    sideLiveLabel.textContent = "LADO";
    sideDisplay.textContent =
      lockedSide || sideMode !== "auto"
        ? sideLabel(lockedSide || sideMode)
        : "AUTO";

    positionTipText.textContent =
      "Para movimientos, ubícate completamente de perfil. KINEMYX analizará una sola cadena anatómica y bloqueará ese lado durante la serie.";
  } else {
    sideLiveLabel.textContent = "VISTA";
    sideDisplay.textContent = "FRONTAL";

    positionTipText.textContent =
      "Para saltos, mira de frente a la cámara. Deben verse ambos hombros, codos, caderas, rodillas y tobillos durante todo el salto.";
  }
}

function updateSideButtons() {
  document.querySelectorAll(".side-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.sideMode === sideMode);
  });
}

function updateSideHelp(side = null) {
  if (activeCategory !== "movement") return;

  if (analysisActive && lockedSide) {
    sideModeHelp.textContent =
      `Serie activa · lado ${sideLabel(lockedSide).toLowerCase()} bloqueado hasta finalizar.`;
    return;
  }

  if (sideMode === "auto") {
    sideModeHelp.textContent = side
      ? `AUTO · lado con mejor visibilidad: ${sideLabel(side)}.`
      : "AUTO seleccionará el lado con mejor visibilidad antes de iniciar la serie.";
  } else {
    sideModeHelp.textContent =
      `Modo manual · KINEMYX analizará únicamente el lado ${sideLabel(sideMode).toLowerCase()}.`;
  }
}

function selectSideMode(mode) {
  if (analysisActive) {
    statusBox.textContent = "Finaliza la serie antes de cambiar el lado de análisis.";
    return;
  }

  sideMode = mode;
  lockedSide = null;
  trackingReady = false;
  lastGoodTrackingAt = 0;
  resetPoseTracker();

  updateSideButtons();
  updateSideHelp();
  updateViewModeUI();
  updateSetupFlow();
}

document.querySelectorAll(".side-choice").forEach((button) => {
  button.addEventListener("click", () => selectSideMode(button.dataset.sideMode));
});


/* =========================================================
   SETUP FLOW
========================================================= */

function setStep(element, textElement, statusElement, state, text, status) {
  element.classList.remove("done", "active", "pending", "warning-step");
  element.classList.add(state);
  textElement.textContent = text;
  statusElement.textContent = status;
}

function updateSetupFlow() {
  const name = exerciseMeta[activeExercise].name;

  setStep(
    stepAnalysis,
    stepAnalysisText,
    stepAnalysisStatus,
    "done",
    `${name} seleccionado`,
    "✓"
  );

  if (!cameraReady) {
    trackingLiveDisplay.textContent = "ESPERA";

    setStep(stepCamera, stepCameraText, stepCameraStatus, "active", "Activa la cámara", "2");
    setStep(stepPosition, stepPositionText, stepPositionStatus, "pending", "Esperando cámara", "3");
    setStep(stepStart, stepStartText, stepStartStatus, "pending", "Completa los pasos", "4");

    startButton.disabled = true;
    return;
  }

  if (detectorLoading || !detector) {
    trackingLiveDisplay.textContent = "CARGANDO";

    setStep(stepCamera, stepCameraText, stepCameraStatus, "done", "Cámara activa", "✓");
    setStep(stepPosition, stepPositionText, stepPositionStatus, "active", "Cargando tracking", "…");
    setStep(stepStart, stepStartText, stepStartStatus, "pending", "Esperando motor", "4");

    startButton.disabled = true;
    return;
  }

  setStep(
    stepCamera,
    stepCameraText,
    stepCameraStatus,
    "done",
    currentFacingMode === "user" ? "Cámara frontal activa" : "Cámara trasera activa",
    "✓"
  );

  if (!trackingReady) {
    trackingLiveDisplay.textContent = "AJUSTAR";

    const shortText = lastPositionAssessment?.short || "Ajusta posición";

    setStep(
      stepPosition,
      stepPositionText,
      stepPositionStatus,
      analysisActive ? "warning-step" : "active",
      shortText,
      "!"
    );

    setStep(
      stepStart,
      stepStartText,
      stepStartStatus,
      analysisActive ? "done" : "pending",
      analysisActive ? "Serie en curso" : "Esperando posición",
      analysisActive ? "●" : "4"
    );

    if (!analysisActive) startButton.disabled = true;
    return;
  }

  trackingLiveDisplay.textContent = "OK";

  setStep(stepPosition, stepPositionText, stepPositionStatus, "done", "Posición correcta", "✓");

  if (analysisActive) {
    setStep(stepStart, stepStartText, stepStartStatus, "done", "Serie en curso", "●");
    startButton.disabled = true;
  } else {
    setStep(stepStart, stepStartText, stepStartStatus, "active", "Listo para iniciar", "4");
    startButton.disabled = false;
  }
}


/* =========================================================
   CATEGORY / EXERCISE EVENTS
========================================================= */

movementCategoryButton.addEventListener("click", () => selectCategory("movement"));
jumpCategoryButton.addEventListener("click", () => selectCategory("jump"));

document.querySelectorAll("[data-exercise]").forEach((button) => {
  button.addEventListener("click", () => selectExercise(button.dataset.exercise));
});

cameraButton.addEventListener("click", initializeCamera);
switchCameraButton.addEventListener("click", switchCamera);
startButton.addEventListener("click", startAnalysis);
stopButton.addEventListener("click", () => stopAnalysis(false));

window.addEventListener("resize", syncCanvasToVideoFrame);
window.addEventListener("orientationchange", () => setTimeout(syncCanvasToVideoFrame, 250));

if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(syncCanvasToVideoFrame);
  resizeObserver.observe(cameraWrapper);
}


/* =========================================================
   CATEGORY / EXERCISE SELECTION
========================================================= */

function selectCategory(category) {
  if (analysisActive) {
    statusBox.textContent = "Finaliza la serie antes de cambiar de categoría.";
    return;
  }

  activeCategory = category;
  const isMovement = category === "movement";

  movementCategoryButton.classList.toggle("secondary", !isMovement);
  jumpCategoryButton.classList.toggle("secondary", isMovement);
  movementExerciseSelector.classList.toggle("hidden", !isMovement);
  jumpExerciseSelector.classList.toggle("hidden", isMovement);

  selectExercise(isMovement ? "squat" : "cmj");

  if (cameraReady) {
    ensureDetectorForActiveMode().catch((error) => {
      console.error(error);
      statusBox.textContent = "No fue posible cargar el motor de tracking.";
    });
  }
}

function selectExercise(exercise) {
  if (analysisActive) {
    statusBox.textContent = "Finaliza la serie antes de cambiar de análisis.";
    return;
  }

  activeExercise = exercise;
  activeCategory = exerciseMeta[exercise].category;

  trackingReady = false;
  lastGoodTrackingAt = 0;
  lastPositionAssessment = null;
  lockedSide = null;

  resetPoseTracker();
  hideWarning();
  hidePositionGuide();
  resetDynamicMovementTiming();
  resetJumpState();

  movementConfigDetails.open = false;
  jumpConfigDetails.open = false;

  document.querySelectorAll("[data-exercise]").forEach((button) => {
    button.classList.toggle("secondary", button.dataset.exercise !== exercise);
  });

  const isMovement = activeCategory === "movement";

  movementSettingsSection.classList.toggle("hidden", !isMovement);
  jumpSettingsSection.classList.toggle("hidden", isMovement);
  movementResultsSection.classList.toggle("hidden", !isMovement);
  jumpResultsSection.classList.toggle("hidden", isMovement);

  if (isMovement) {
    configureMovementUI(exercise);
  } else {
    configureJumpUI(exercise);
  }

  updateViewModeUI();
  updateFeedbackContext();
  updateSideHelp();

  statusBox.textContent = cameraReady
    ? isMovement
      ? "Ubícate completamente de perfil."
      : "Ubícate de frente y mantén ambos lados visibles."
    : "Activa la cámara";

  updateSetupFlow();
}


/* =========================================================
   UI CONFIGURATION
========================================================= */

function configureMovementUI(exercise) {
  const meta = exerciseMeta[exercise];

  liveExerciseLabel.textContent = meta.live;
  countLabel.textContent = "REP";
  primaryMetricLabel.textContent = meta.angleShort;
  secondaryMetricLabel.textContent = "ECCENTRIC";
  tertiaryMetricLabel.textContent = "CONCENTRIC";

  movementAngleName.textContent = `${meta.angleName} objetivo`;
  movementCheckAngleText.textContent = meta.angleName;
  movementAngleHeader.textContent = meta.angleName;
  movementResultsTitle.textContent = meta.name;

  movementTargetReps.value = meta.defaultReps;
  movementAngleTarget.value = meta.defaultAngle;
  movementAngleTolerance.value = meta.defaultTolerance;
  movementEccTarget.value = meta.defaultEcc;
  movementConTarget.value = meta.defaultCon;

  repDisplay.textContent = `0 / ${meta.defaultReps}`;
  angleDisplay.textContent = "—°";
  stateDisplay.textContent = "READY";
  eccDisplay.textContent = "—";
  conDisplay.textContent = "—";

  movementResultsBody.innerHTML = "";
  movementSummary.textContent = "Aún no hay resultados.";
}

function configureJumpUI(exercise) {
  const meta = exerciseMeta[exercise];

  liveExerciseLabel.textContent = meta.live;
  countLabel.textContent = "JUMP";
  primaryMetricLabel.textContent = "VIEW";
  secondaryMetricLabel.textContent = "FLIGHT TIME";
  tertiaryMetricLabel.textContent = "HEIGHT EST.";

  jumpResultsTitle.textContent = meta.name;

  repDisplay.textContent = `0 / ${Math.max(1, Number(jumpTargetJumps.value) || 3)}`;
  angleDisplay.textContent = "FRONTAL";
  stateDisplay.textContent = exercise === "sj" ? "START" : "READY";
  eccDisplay.textContent = "—";
  conDisplay.textContent = "—";

  sjHoldWrap.classList.toggle("hidden", exercise !== "sj");

  if (exercise === "sj") {
    jumpProtocolHeader.textContent = "Pausa";
    jumpProtocolNote.textContent =
      "Squat Jump: vista frontal, cuerpo completo y ambos pies visibles. Adopta tu posición inicial, mantén la pausa configurada y salta sin countermovement adicional.";
  } else if (exercise === "cmj") {
    jumpProtocolHeader.textContent = "Descenso";
    jumpProtocolNote.textContent =
      "CMJ: vista frontal, cuerpo completo y ambos pies visibles. Inicia de pie, realiza el countermovement y salta verticalmente.";
  } else {
    jumpProtocolHeader.textContent = "Descenso";
    jumpProtocolNote.textContent =
      "Abalakov: vista frontal, cuerpo completo y ambos pies visibles. Inicia de pie y utiliza libremente los brazos.";
  }

  jumpResultsBody.innerHTML = "";
  jumpSummary.textContent = "Aún no hay resultados.";
}


/* =========================================================
   CAMERA / DETECTOR
========================================================= */

async function getCameraStream() {
  const constraints = {
    video: {
      facingMode: { ideal: currentFacingMode },
      width: { ideal: 1280 },
      height: { ideal: 960 }
    },
    audio: false
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      ...constraints,
      video: {
        ...constraints.video,
        facingMode: { exact: currentFacingMode }
      }
    });
  } catch (error) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
}

function desiredDetectorProfile() {
  return activeCategory === "movement" ? "thunder" : "lightning";
}

async function ensureDetectorForActiveMode() {
  const profile = desiredDetectorProfile();

  if (detector && detectorProfile === profile) return;

  detectorLoading = true;
  trackingReady = false;
  updateSetupFlow();

  const token = ++detectorLoadToken;

  try {
    await tf.setBackend("webgl");
    await tf.ready();

    const modelType =
      profile === "thunder"
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

    const newDetector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType,
        enableSmoothing: false
      }
    );

    if (token !== detectorLoadToken) {
      if (typeof newDetector.dispose === "function") newDetector.dispose();
      return;
    }

    const oldDetector = detector;
    detector = newDetector;
    detectorProfile = profile;

    if (oldDetector && typeof oldDetector.dispose === "function") {
      oldDetector.dispose();
    }

    resetPoseTracker();
    statusBox.textContent =
      profile === "thunder"
        ? "Motor lateral de alta precisión listo."
        : "Motor frontal de alta velocidad listo.";
  } finally {
    if (token === detectorLoadToken) {
      detectorLoading = false;
      updateSetupFlow();
    }
  }
}

async function initializeCamera() {
  try {
    statusBox.textContent = "Cargando KINEMYX...";

    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    cameraReady = false;
    trackingReady = false;
    lockedSide = null;

    hidePositionGuide();
    hideWarning();
    resetPoseTracker();
    updateSetupFlow();

    currentStream = await getCameraStream();
    video.srcObject = currentStream;

    await new Promise((resolve) => {
      video.onloadedmetadata = async () => {
        await video.play();
        syncCanvasToVideoFrame();
        resolve();
      };
    });

    cameraReady = true;
    await ensureDetectorForActiveMode();

    switchCameraButton.textContent =
      currentFacingMode === "user" ? "Usar cámara trasera" : "Usar cámara frontal";

    statusBox.textContent =
      activeCategory === "movement"
        ? "Cámara activa · colócate completamente de perfil."
        : "Cámara activa · colócate de frente y muestra el cuerpo completo.";

    updateSetupFlow();

    if (!detectionLoopStarted) {
      detectionLoopStarted = true;
      detectLoop();
    }

    return true;
  } catch (error) {
    console.error(error);
    cameraReady = false;
    trackingReady = false;
    statusBox.textContent = "No fue posible iniciar la cámara.";
    trackingLiveDisplay.textContent = "ERROR";
    updateSetupFlow();
    return false;
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

  cameraReady = false;
  trackingReady = false;
  analysisActive = false;
  lockedSide = null;
  video.srcObject = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  trackingLiveDisplay.textContent = "ESPERA";
}

async function switchCamera() {
  if (analysisActive) {
    statusBox.textContent = "Finaliza la serie antes de cambiar de cámara.";
    return;
  }

  if (!cameraReady) {
    statusBox.textContent = "Primero activa la cámara.";
    return;
  }

  const previous = currentFacingMode;
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

  if (!(await initializeCamera())) {
    currentFacingMode = previous;
    await initializeCamera();
  }
}


/* =========================================================
   CANVAS ALIGNMENT
========================================================= */

function syncCanvasToVideoFrame() {
  if (!video.videoWidth || !video.videoHeight) return;

  const boxWidth = cameraWrapper.clientWidth;
  const boxHeight = cameraWrapper.clientHeight;

  if (!boxWidth || !boxHeight) return;

  const videoRatio = video.videoWidth / video.videoHeight;
  const boxRatio = boxWidth / boxHeight;

  let drawWidth;
  let drawHeight;

  if (videoRatio > boxRatio) {
    drawWidth = boxWidth;
    drawHeight = boxWidth / videoRatio;
  } else {
    drawHeight = boxHeight;
    drawWidth = boxHeight * videoRatio;
  }

  const left = (boxWidth - drawWidth) / 2;
  const top = (boxHeight - drawHeight) / 2;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // px de canvas por cada px CSS en pantalla (ver OVERLAY 0.8.1).
  overlayScale = canvas.width / drawWidth;

  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${drawWidth}px`;
  canvas.style.height = `${drawHeight}px`;
}


/* =========================================================
   DETECTION LOOP
========================================================= */

async function detectLoop() {
  if (
    !cameraReady ||
    !detector ||
    detectorLoading ||
    video.readyState < 2
  ) {
    requestAnimationFrame(detectLoop);
    return;
  }

  try {
    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses && poses.length > 0) {
      const timestamp = performance.now();
      const stabilized = stabilizePose(poses[0], timestamp);
      processPose(stabilized, timestamp);
    } else {
      handleMissingPose();
    }
  } catch (error) {
    console.warn("MoveNet:", error);
  }

  requestAnimationFrame(detectLoop);
}


/* =========================================================
   POSE ACCESSORS
========================================================= */

function sideData(pose, side) {
  const kp = pose.keypoints;

  if (side === "left") {
    return {
      shoulder: kp[KP.leftShoulder],
      elbow: kp[KP.leftElbow],
      wrist: kp[KP.leftWrist],
      hip: kp[KP.leftHip],
      knee: kp[KP.leftKnee],
      ankle: kp[KP.leftAnkle]
    };
  }

  return {
    shoulder: kp[KP.rightShoulder],
    elbow: kp[KP.rightElbow],
    wrist: kp[KP.rightWrist],
    hip: kp[KP.rightHip],
    knee: kp[KP.rightKnee],
    ankle: kp[KP.rightAnkle]
  };
}

function frontalData(pose) {
  const kp = pose.keypoints;

  return {
    left: {
      shoulder: kp[KP.leftShoulder],
      elbow: kp[KP.leftElbow],
      wrist: kp[KP.leftWrist],
      hip: kp[KP.leftHip],
      knee: kp[KP.leftKnee],
      ankle: kp[KP.leftAnkle]
    },
    right: {
      shoulder: kp[KP.rightShoulder],
      elbow: kp[KP.rightElbow],
      wrist: kp[KP.rightWrist],
      hip: kp[KP.rightHip],
      knee: kp[KP.rightKnee],
      ankle: kp[KP.rightAnkle]
    }
  };
}


/* =========================================================
   MOVEMENT SIDE SELECTION
========================================================= */

function movementRequiredEntries(points) {
  if (activeExercise === "bench") {
    return [
      ["shoulder", points.shoulder],
      ["elbow", points.elbow],
      ["wrist", points.wrist]
    ];
  }

  return [
    ["shoulder", points.shoulder],
    ["hip", points.hip],
    ["knee", points.knee],
    ["ankle", points.ankle]
  ];
}

function averageMovementConfidence(points) {
  const required = movementRequiredEntries(points).map((entry) => entry[1]);
  return averagePointConfidence(required);
}

function determineBestMovementSide(pose) {
  const left = sideData(pose, "left");
  const right = sideData(pose, "right");

  const leftScore = averageMovementConfidence(left);
  const rightScore = averageMovementConfidence(right);

  if (Math.abs(leftScore - rightScore) < 0.08) return candidateSide;
  return leftScore >= rightScore ? "left" : "right";
}

function getMovementTrackingSide(pose) {
  if (analysisActive && lockedSide) return lockedSide;
  if (sideMode === "left" || sideMode === "right") return sideMode;

  candidateSide = determineBestMovementSide(pose);
  return candidateSide;
}


/* =========================================================
   POSITION ASSESSMENT HELPERS
========================================================= */

function checkEdgeAssessment(entries) {
  if (!video.videoWidth || !video.videoHeight) return null;

  const marginX = video.videoWidth * FRAME_MARGIN_X;
  const marginY = video.videoHeight * FRAME_MARGIN_Y;

  for (const [name, point] of entries) {
    if (!isPointUsable(point)) continue;

    if (point.y > video.videoHeight - marginY) {
      return {
        ready: false,
        short: `${capitalize(name)} muy abajo`,
        title: "Falta margen inferior",
        text: "Aléjate un poco para que pies y tobillos permanezcan dentro del encuadre."
      };
    }

    if (point.y < marginY) {
      return {
        ready: false,
        short: `${capitalize(name)} muy arriba`,
        title: "Falta margen superior",
        text: "Aléjate un poco para dejar margen sobre el cuerpo."
      };
    }

    if (point.x < marginX || point.x > video.videoWidth - marginX) {
      return {
        ready: false,
        short: "Muévete al centro",
        title: "Demasiado cerca del borde",
        text: "Muévete hacia el centro de la imagen para que todo el movimiento permanezca visible."
      };
    }
  }

  return null;
}

function movementOrientationAssessment(pose, selectedPoints) {
  const kp = pose.keypoints;

  const ls = kp[KP.leftShoulder];
  const rs = kp[KP.rightShoulder];
  const lh = kp[KP.leftHip];
  const rh = kp[KP.rightHip];

  if (
    isPointUsable(ls, 0.35) &&
    isPointUsable(rs, 0.35) &&
    isPointUsable(lh, 0.35) &&
    isPointUsable(rh, 0.35) &&
    isPointUsable(selectedPoints.shoulder) &&
    isPointUsable(selectedPoints.hip)
  ) {
    const torso = Math.max(30, distance(selectedPoints.shoulder, selectedPoints.hip));
    const projectedWidth = (distance(ls, rs) + distance(lh, rh)) / 2;
    const ratio = projectedWidth / torso;

    if (ratio > 0.80) {
      return {
        ready: false,
        short: "Gira de perfil",
        title: "Vista demasiado frontal",
        text: "Gira el cuerpo hasta quedar claramente de perfil respecto de la cámara."
      };
    }
  }

  return null;
}

function validateMovementGeometry(points, side) {
  const prefix = `movement:${side}`;

  if (
    activeExercise !== "bench" &&
    !segmentPlausible(`${prefix}:shoulder-hip`, points.shoulder, points.hip)
  ) {
    return false;
  }

  if (
    activeExercise !== "bench" &&
    !segmentPlausible(`${prefix}:hip-knee`, points.hip, points.knee)
  ) {
    return false;
  }

  if (
    activeExercise !== "bench" &&
    !segmentPlausible(`${prefix}:knee-ankle`, points.knee, points.ankle)
  ) {
    return false;
  }

  if (
    activeExercise === "bench" &&
    !segmentPlausible(`${prefix}:shoulder-elbow`, points.shoulder, points.elbow)
  ) {
    return false;
  }

  if (
    activeExercise === "bench" &&
    !segmentPlausible(`${prefix}:elbow-wrist`, points.elbow, points.wrist)
  ) {
    return false;
  }

  return true;
}

function assessMovementPosition(pose, side) {
  const points = sideData(pose, side);
  const required = movementRequiredEntries(points);

  const missing = required
    .filter(([, point]) => !isPointUsable(point))
    .map(([name]) => pointLabels[name]);

  if (missing.length) {
    const main = missing[0];

    let correction = "Asegúrate de que la articulación quede claramente visible para la cámara.";

    if (main === "tobillo" || main === "rodilla") {
      correction = "Aléjate hasta que la pierna y el pie completos queden visibles.";
    } else if (main === "hombro" || main === "codo" || main === "muñeca") {
      correction = "Ajusta el encuadre para que el brazo del lado seleccionado quede completamente visible.";
    } else if (main === "cadera") {
      correction = "Evita que ropa, implementos u objetos oculten la cadera.";
    }

    return {
      ready: false,
      short: `Falta ${main}`,
      title: `Falta detectar ${main}`,
      text: correction
    };
  }

  const confidence = averageMovementConfidence(points);
  if (confidence < MIN_TRACKING_CONFIDENCE) {
    return {
      ready: false,
      short: "Tracking inestable",
      title: "Mejora la visibilidad",
      text: `Mantén visible el lado ${sideLabel(side).toLowerCase()} y mejora la iluminación.`
    };
  }

  const orientation = movementOrientationAssessment(pose, points);
  if (orientation) return orientation;

  if (!validateMovementGeometry(points, side)) {
    return {
      ready: false,
      short: "Articulación inestable",
      title: "Tracking anatómico inestable",
      text: "Mantén la posición un instante. KINEMYX está descartando un punto anatómico incoherente."
    };
  }

  const edge = checkEdgeAssessment(
    required.map(([name, point]) => [pointLabels[name], point])
  );
  if (edge) return edge;

  return {
    ready: true,
    short: "Posición correcta",
    title: "Posición lateral correcta",
    text: `${sideLabel(side)} detectado · cadena anatómica estable.`
  };
}

function frontalRequiredEntries(data) {
  return [
    ["hombro izquierdo", data.left.shoulder],
    ["codo izquierdo", data.left.elbow],
    ["cadera izquierda", data.left.hip],
    ["rodilla izquierda", data.left.knee],
    ["tobillo izquierdo", data.left.ankle],
    ["hombro derecho", data.right.shoulder],
    ["codo derecho", data.right.elbow],
    ["cadera derecha", data.right.hip],
    ["rodilla derecha", data.right.knee],
    ["tobillo derecho", data.right.ankle]
  ];
}

function validateFrontalGeometry(data) {
  const left = data.left;
  const right = data.right;

  const shoulderMid = midpoint(left.shoulder, right.shoulder);
  const hipMid = midpoint(left.hip, right.hip);
  const torso = Math.max(30, distance(shoulderMid, hipMid));

  const shoulderWidth = distance(left.shoulder, right.shoulder);
  const hipWidth = distance(left.hip, right.hip);

  if (shoulderWidth / torso < 0.24 && hipWidth / torso < 0.14) {
    return {
      ok: false,
      assessment: {
        ready: false,
        short: "Gira hacia cámara",
        title: "Vista demasiado lateral",
        text: "Para saltos, orienta el pecho hacia la cámara y mantén ambos lados visibles."
      }
    };
  }

  const shoulderDirection = Math.sign(right.shoulder.x - left.shoulder.x);
  const hipDirection = Math.sign(right.hip.x - left.hip.x);

  if (
    shoulderDirection !== 0 &&
    hipDirection !== 0 &&
    shoulderDirection !== hipDirection
  ) {
    return {
      ok: false,
      assessment: {
        ready: false,
        short: "Tracking cruzado",
        title: "Tracking bilateral inestable",
        text: "Mantente de frente y evita cruzar las piernas o girar el tronco mientras se calibra."
      }
    };
  }

  const leftThigh = distance(left.hip, left.knee);
  const rightThigh = distance(right.hip, right.knee);
  const leftShank = distance(left.knee, left.ankle);
  const rightShank = distance(right.knee, right.ankle);

  const thighRatio = leftThigh / Math.max(1, rightThigh);
  const shankRatio = leftShank / Math.max(1, rightShank);

  if (
    thighRatio < 0.52 ||
    thighRatio > 1.92 ||
    shankRatio < 0.52 ||
    shankRatio > 1.92
  ) {
    return {
      ok: false,
      assessment: {
        ready: false,
        short: "Piernas inestables",
        title: "Tracking bilateral inestable",
        text: "Asegúrate de que ambas piernas y ambos tobillos estén completamente visibles."
      }
    };
  }

  const segments = [
    ["front:left-hip-knee", left.hip, left.knee],
    ["front:left-knee-ankle", left.knee, left.ankle],
    ["front:right-hip-knee", right.hip, right.knee],
    ["front:right-knee-ankle", right.knee, right.ankle],
    ["front:left-shoulder-elbow", left.shoulder, left.elbow],
    ["front:right-shoulder-elbow", right.shoulder, right.elbow]
  ];

  for (const [name, a, b] of segments) {
    if (!segmentPlausible(name, a, b)) {
      return {
        ok: false,
        assessment: {
          ready: false,
          short: "Articulación inestable",
          title: "Tracking anatómico inestable",
          text: "Mantén el cuerpo visible un instante. KINEMYX está descartando una articulación incoherente."
        }
      };
    }
  }

  return { ok: true, assessment: null };
}

function assessJumpPosition(pose) {
  const data = frontalData(pose);
  const required = frontalRequiredEntries(data);

  const missing = required.filter(([, point]) => !isPointUsable(point));

  if (missing.length) {
    return {
      ready: false,
      short: `Falta ${missing[0][0]}`,
      title: `Falta detectar ${missing[0][0]}`,
      text: "Aléjate o ajusta el encuadre hasta que ambos lados del cuerpo estén claramente visibles."
    };
  }

  const confidence = averagePointConfidence(required.map(([, point]) => point));

  if (confidence < MIN_TRACKING_CONFIDENCE) {
    return {
      ready: false,
      short: "Tracking inestable",
      title: "Mejora la visibilidad",
      text: "Mantén ambos lados del cuerpo visibles y mejora la iluminación."
    };
  }

  const geometry = validateFrontalGeometry(data);
  if (!geometry.ok) return geometry.assessment;

  const edge = checkEdgeAssessment(required);
  if (edge) return edge;

  return {
    ready: true,
    short: "Posición correcta",
    title: "Vista frontal correcta",
    text: "Tracking bilateral estable · hombros, codos, caderas, rodillas y tobillos detectados."
  };
}


/* =========================================================
   POSITION GUIDE / TRACKING STATE
========================================================= */

function showPositionGuide(assessment) {
  if (!assessment) return;

  positionGuideTitle.textContent = assessment.title;
  positionGuideText.textContent = assessment.text;

  positionGuide.classList.remove("hidden", "ready-guide");
  if (assessment.ready) positionGuide.classList.add("ready-guide");
}

function hidePositionGuide() {
  positionGuide.classList.add("hidden");
  positionGuide.classList.remove("ready-guide");
}

function updateTrackingState(ready) {
  const now = performance.now();

  if (ready) {
    lastGoodTrackingAt = now;
    trackingLiveDisplay.textContent = "OK";

    if (!trackingReady) {
      trackingReady = true;
      updateSetupFlow();
    }

    return;
  }

  if (now - lastGoodTrackingAt > TRACKING_HOLD_MS) {
    trackingLiveDisplay.textContent = "AJUSTAR";

    if (trackingReady) {
      trackingReady = false;
      updateSetupFlow();
    }
  }
}

function handleMissingPose() {
  lastPositionAssessment = {
    ready: false,
    short: "No te detecto",
    title: "No se detecta el cuerpo",
    text:
      activeCategory === "movement"
        ? "Entra completamente en la imagen y colócate de perfil."
        : "Entra completamente en la imagen y colócate de frente."
  };

  trackingLiveDisplay.textContent = "PERDIDO";
  showPositionGuide(lastPositionAssessment);
  updateTrackingState(false);

  if (analysisActive && activeCategory === "movement") {
    pauseDynamicMovementTiming(performance.now());
  }

  if (analysisActive && activeCategory === "jump") {
    markJumpTrackingCompromised("Tracking perdido");
  }

  if (analysisActive) trackingWarning("Tracking perdido");
  updateSetupFlow();
}


/* =========================================================
   ANGLES
========================================================= */

function calculateAngle(a, b, c) {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);

  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function flexionFromAngle(a, b, c) {
  return clamp(180 - calculateAngle(a, b, c), 0, 170);
}


/* =========================================================
   SKELETON DRAWING · OVERLAY 0.8.1
   ---------------------------------------------------------
   El canvas trabaja en píxeles del video (p. ej. 1280×960)
   pero se muestra escalado (≈350 px de ancho en iPhone).
   Todos los tamaños del overlay se definen en px CSS y se
   convierten con overlayScale para que puntos, líneas y
   textos se vean igual en cualquier pantalla.

   Estados de cada punto articular:
   - "ok"   : detectado en este frame y apto para medir
              (score ≥ MIN_POINT_CONFIDENCE). Relleno blanco.
   - "low"  : visible pero bajo el umbral de medición
              (0.28 ≤ score < MIN_POINT_CONFIDENCE). Anillo ámbar.
   - "held" : no detectado en este frame; se mantiene la última
              posición ≤ POINT_DRAW_HOLD_MS. Anillo hueco gris.
   Un punto "low" o "held" nunca se presenta como medición válida.
========================================================= */

// Tamaños en px CSS (heurísticos de legibilidad, no clínicos).
const OVERLAY_POINT_RADIUS = 4.5;
const OVERLAY_FOCUS_RADIUS = 7;
const OVERLAY_FOCUS_HALO = 13;
const OVERLAY_LINE_PRIMARY = 3.5;
const OVERLAY_LINE_SECONDARY = 2;
const OVERLAY_ARC_RADIUS = 24;
const OVERLAY_LABEL_FONT = 9;
const OVERLAY_ANGLE_FONT = 13;
const OVERLAY_LABEL_OFFSET = 9;
// Histéresis para decidir de qué lado van las etiquetas (fracción del ancho).
const OVERLAY_LABEL_SIDE_HYSTERESIS = 0.08;

const OVERLAY_COLORS = {
  primary: "#1677ff",
  primaryAlt: "#7fb2ff",
  secondary: "rgba(255, 255, 255, 0.55)",
  point: "#ffffff",
  low: "#d99114",
  held: "rgba(255, 255, 255, 0.45)",
  halo: "rgba(22, 119, 255, 0.28)",
  text: "#ffffff",
  textMuted: "rgba(255, 255, 255, 0.72)",
  textBg: "rgba(2, 4, 6, 0.74)",
  reference: "rgba(255, 255, 255, 0.60)"
};

const OVERLAY_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif';

const jointShortLabels = {
  shoulder: "HOMBRO",
  elbow: "CODO",
  wrist: "MUÑECA",
  hip: "CADERA",
  knee: "RODILLA",
  ankle: "TOBILLO"
};

// Qué se enfatiza en vista lateral según el ejercicio.
// focus = articulación medida; angle = [proximal, vértice, distal]
// (mismo trío que usa getDynamicMovementMetrics para la señal primaria).
const LATERAL_DRAW_PROFILE = {
  squat: {
    focus: "knee",
    angle: ["hip", "knee", "ankle"],
    primary: ["shoulder-hip", "hip-knee", "knee-ankle"]
  },
  deadlift: {
    focus: "hip",
    angle: ["shoulder", "hip", "knee"],
    primary: ["shoulder-hip", "hip-knee", "knee-ankle"]
  },
  bench: {
    focus: "elbow",
    angle: ["shoulder", "elbow", "wrist"],
    primary: ["shoulder-elbow", "elbow-wrist"]
  }
};

const LATERAL_SEGMENTS = [
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
  ["shoulder", "hip"],
  ["hip", "knee"],
  ["knee", "ankle"]
];

let overlayScale = 1;
let overlayLabelSide = 1; // 1 = etiquetas a la derecha del punto, -1 = izquierda

function px(value) {
  return value * overlayScale;
}

function pointQuality(point) {
  if (!isPointDrawable(point)) return "none";
  if (point._fresh === false) return "held";
  if (!isPointUsable(point)) return "low";
  return "ok";
}

function drawPoint(point, options = {}) {
  const quality = pointQuality(point);
  if (quality === "none") return;

  const { focus = false, ring = OVERLAY_COLORS.primary } = options;
  const radius = px(focus ? OVERLAY_FOCUS_RADIUS : OVERLAY_POINT_RADIUS);

  ctx.save();

  if (focus && quality === "ok") {
    ctx.beginPath();
    ctx.arc(point.x, point.y, px(OVERLAY_FOCUS_HALO), 0, Math.PI * 2);
    ctx.fillStyle = OVERLAY_COLORS.halo;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);

  if (quality === "held") {
    ctx.lineWidth = px(1.5);
    ctx.strokeStyle = OVERLAY_COLORS.held;
    ctx.setLineDash([px(2.5), px(2.5)]);
    ctx.stroke();
  } else {
    ctx.fillStyle = OVERLAY_COLORS.point;
    ctx.fill();
    ctx.lineWidth = px(focus ? 2.5 : 2);
    ctx.strokeStyle = quality === "low" ? OVERLAY_COLORS.low : ring;
    ctx.stroke();
  }

  ctx.restore();
}

function drawConnection(a, b, segmentName, options = {}) {
  if (!isPointDrawable(a) || !isPointDrawable(b)) return;
  if (!segmentPlausible(segmentName, a, b, false)) return;

  const { role = "primary", color = null } = options;
  const degraded = pointQuality(a) !== "ok" || pointQuality(b) !== "ok";

  ctx.save();
  ctx.globalAlpha = degraded ? 0.4 : 1;
  ctx.lineWidth = px(role === "primary" ? OVERLAY_LINE_PRIMARY : OVERLAY_LINE_SECONDARY);
  ctx.lineCap = "round";
  ctx.strokeStyle =
    color || (role === "primary" ? OVERLAY_COLORS.primary : OVERLAY_COLORS.secondary);
  if (degraded) ctx.setLineDash([px(5), px(4)]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

// Rectángulos ya ocupados en el frame actual (puntos y etiquetas),
// para que ninguna etiqueta tape un punto articular u otra etiqueta.
let overlayObstacles = [];

function beginOverlayFrame(points, focusPoint = null) {
  overlayObstacles = [];

  for (const point of points) {
    if (pointQuality(point) === "none") continue;
    const r = px(point === focusPoint ? OVERLAY_FOCUS_HALO : OVERLAY_POINT_RADIUS + 3);
    overlayObstacles.push({ l: point.x - r, t: point.y - r, r: point.x + r, b: point.y + r });
  }
}

function rectsOverlap(a, b) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

function drawTag(x, y, text, options = {}) {
  const {
    align = "left",
    fontSize = OVERLAY_LABEL_FONT,
    color = OVERLAY_COLORS.text,
    weight = 800,
    alternatives = []
  } = options;

  ctx.save();
  ctx.font = `${weight} ${px(fontSize)}px ${OVERLAY_FONT_FAMILY}`;
  ctx.textBaseline = "middle";

  const padX = px(4);
  const height = px(fontSize + 6);
  const width = ctx.measureText(text).width + padX * 2;

  const place = (ax, ay, al) => {
    let left = al === "right" ? ax - width : al === "center" ? ax - width / 2 : ax;
    let top = ay - height / 2;
    // Mantener la etiqueta dentro del cuadro de video.
    left = clamp(left, px(2), canvas.width - width - px(2));
    top = clamp(top, px(2), canvas.height - height - px(2));
    return { l: left, t: top, r: left + width, b: top + height };
  };

  // Candidatos: posición preferida, alternativas horizontales y
  // desplazamientos verticales crecientes.
  const anchors = [{ x, align }, ...alternatives];
  const steps = [0, 1, -1, 2, -2, 3, -3];
  let chosen = null;

  for (const step of steps) {
    for (const anchor of anchors) {
      const rect = place(anchor.x, y + step * (height + px(2)), anchor.align);
      if (!overlayObstacles.some((obstacle) => rectsOverlap(rect, obstacle))) {
        chosen = rect;
        break;
      }
    }
    if (chosen) break;
  }

  if (!chosen) chosen = place(x, y, align);
  overlayObstacles.push(chosen);

  ctx.fillStyle = OVERLAY_COLORS.textBg;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(chosen.l, chosen.t, width, height, px(4));
  } else {
    ctx.rect(chosen.l, chosen.t, width, height);
  }
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(text, chosen.l + padX, chosen.t + height / 2 + px(0.5));
  ctx.restore();
}

function drawJointLabel(point, text, side = overlayLabelSide) {
  if (pointQuality(point) === "none") return;

  const offset = px(OVERLAY_POINT_RADIUS + OVERLAY_LABEL_OFFSET);
  drawTag(point.x + side * offset, point.y, text, {
    align: side > 0 ? "left" : "right",
    alternatives: [{ x: point.x - side * offset, align: side > 0 ? "right" : "left" }],
    color: pointQuality(point) === "ok" ? OVERLAY_COLORS.textMuted : OVERLAY_COLORS.low
  });
}

function updateLabelSide(points) {
  const visible = points.filter((point) => pointQuality(point) !== "none");
  if (!visible.length || !canvas.width) return;

  const meanX = mean(visible.map((point) => point.x));
  const center = canvas.width / 2;
  const band = canvas.width * OVERLAY_LABEL_SIDE_HYSTERESIS;

  // Etiquetas hacia el lado con más espacio libre.
  if (meanX < center - band) overlayLabelSide = 1;
  else if (meanX > center + band) overlayLabelSide = -1;
}

function drawLateralSkeleton(pose, side) {
  const p = sideData(pose, side);
  const prefix = `draw:${side}`;
  const profile = LATERAL_DRAW_PROFILE[activeExercise] || LATERAL_DRAW_PROFILE.squat;

  for (const [from, to] of LATERAL_SEGMENTS) {
    const key = `${from}-${to}`;
    const name = `${prefix}:${key}`;
    const a = p[from];
    const b = p[to];

    if (segmentPlausible(name, a, b)) {
      drawConnection(a, b, name, {
        role: profile.primary.includes(key) ? "primary" : "secondary"
      });
    }
  }

  const joints = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];

  updateLabelSide(Object.values(p));
  beginOverlayFrame(joints.map((joint) => p[joint]), p[profile.focus]);

  // Primero todos los puntos, después las etiquetas (no se tapan entre sí).
  for (const joint of joints) {
    const inPrimary = profile.primary.some((key) => key.split("-").includes(joint));

    drawPoint(p[joint], {
      focus: joint === profile.focus,
      ring: inPrimary ? OVERLAY_COLORS.primary : OVERLAY_COLORS.secondary
    });
  }

  for (const joint of joints) {
    // La articulación medida se rotula junto con su ángulo (drawLateralAngle).
    if (joint !== profile.focus) drawJointLabel(p[joint], jointShortLabels[joint]);
  }
}

// Dibuja el arco del ángulo medido y la flexión en la articulación foco.
// flexionValue es el mismo valor suavizado que se muestra en el panel,
// para que overlay y panel nunca discrepen.
function drawLateralAngle(pose, side, flexionValue) {
  const profile = LATERAL_DRAW_PROFILE[activeExercise];
  if (!profile) return;

  const p = sideData(pose, side);
  const [aKey, bKey, cKey] = profile.angle;
  const a = p[aKey];
  const b = p[bKey];
  const c = p[cKey];

  if (![a, b, c].every((point) => pointQuality(point) === "ok")) return;

  const angleA = Math.atan2(a.y - b.y, a.x - b.x);
  const angleC = Math.atan2(c.y - b.y, c.x - b.x);

  let delta = angleC - angleA;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  const radius = px(OVERLAY_ARC_RADIUS);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.arc(b.x, b.y, radius, angleA, angleA + delta, delta < 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(22, 119, 255, 0.18)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(b.x, b.y, radius, angleA, angleA + delta, delta < 0);
  ctx.lineWidth = px(2);
  ctx.strokeStyle = OVERLAY_COLORS.primary;
  ctx.stroke();
  ctx.restore();

  // Etiqueta en el lado externo del ángulo (opuesto a la bisectriz interna).
  const bisector = angleA + delta / 2;
  const labelDistance = radius + px(18);
  const lx = b.x - Math.cos(bisector) * labelDistance;
  const ly = b.y - Math.sin(bisector) * labelDistance;

  drawTag(lx, ly, `${jointShortLabels[bKey]} ${Math.round(flexionValue)}°`, {
    align: "center",
    fontSize: OVERLAY_ANGLE_FONT,
    weight: 850
  });
}

function drawFrontalSkeleton(pose) {
  const data = frontalData(pose);
  const l = data.left;
  const r = data.right;

  const connections = [
    // Tronco y cinturas (referencia)
    [l.shoulder, r.shoulder, "draw:front:shoulders", "secondary", null],
    [l.shoulder, l.hip, "draw:front:left-torso", "secondary", null],
    [r.shoulder, r.hip, "draw:front:right-torso", "secondary", null],
    [l.hip, r.hip, "draw:front:hips", "secondary", null],
    // Brazos (no se miden en salto)
    [l.shoulder, l.elbow, "draw:front:left-shoulder-elbow", "secondary", null],
    [l.elbow, l.wrist, "draw:front:left-elbow-wrist", "secondary", null],
    [r.shoulder, r.elbow, "draw:front:right-shoulder-elbow", "secondary", null],
    [r.elbow, r.wrist, "draw:front:right-elbow-wrist", "secondary", null],
    // Piernas (cadena principal del salto): izquierda azul, derecha azul claro
    [l.hip, l.knee, "draw:front:left-hip-knee", "primary", OVERLAY_COLORS.primary],
    [l.knee, l.ankle, "draw:front:left-knee-ankle", "primary", OVERLAY_COLORS.primary],
    [r.hip, r.knee, "draw:front:right-hip-knee", "primary", OVERLAY_COLORS.primaryAlt],
    [r.knee, r.ankle, "draw:front:right-knee-ankle", "primary", OVERLAY_COLORS.primaryAlt]
  ];

  for (const [a, b, name, role, color] of connections) {
    if (segmentPlausible(name, a, b)) {
      drawConnection(a, b, name, { role, color });
    }
  }

  beginOverlayFrame([
    l.shoulder, l.elbow, l.wrist, l.hip, l.knee, l.ankle,
    r.shoulder, r.elbow, r.wrist, r.hip, r.knee, r.ankle
  ]);

  drawJumpReferences(data);

  for (const [points, ring] of [
    [l, OVERLAY_COLORS.primary],
    [r, OVERLAY_COLORS.primaryAlt]
  ]) {
    for (const joint of ["shoulder", "elbow", "wrist"]) {
      drawPoint(points[joint], { ring: OVERLAY_COLORS.secondary });
    }
    for (const joint of ["hip", "knee", "ankle"]) {
      drawPoint(points[joint], { ring });
    }
  }

  // IZQ / DER del evaluado, hacia afuera de la línea media, para detectar
  // de inmediato si MoveNet intercambia los lados.
  if (pointQuality(l.shoulder) !== "none" && pointQuality(r.shoulder) !== "none") {
    const midX = (l.shoulder.x + r.shoulder.x) / 2;
    drawJointLabel(l.shoulder, "IZQ", Math.sign(l.shoulder.x - midX) || -1);
    drawJointLabel(r.shoulder, "DER", Math.sign(r.shoulder.x - midX) || 1);
  }
}

// Referencias del salto: línea media (hombros-cadera-tobillos) usada por el
// motor frontal y, una vez calibrado, las líneas base de tobillos y cadera.
function drawJumpReferences(data) {
  const pairs = [
    [data.left.shoulder, data.right.shoulder],
    [data.left.hip, data.right.hip],
    [data.left.ankle, data.right.ankle]
  ];

  const mids = pairs.map(([a, b]) =>
    pointQuality(a) === "ok" && pointQuality(b) === "ok" ? midpoint(a, b) : null
  );

  ctx.save();
  ctx.strokeStyle = OVERLAY_COLORS.reference;
  ctx.lineWidth = px(1.25);
  ctx.setLineDash([px(4), px(4)]);

  for (let i = 0; i < mids.length - 1; i++) {
    if (!mids[i] || !mids[i + 1]) continue;
    ctx.beginPath();
    ctx.moveTo(mids[i].x, mids[i].y);
    ctx.lineTo(mids[i + 1].x, mids[i + 1].y);
    ctx.stroke();
  }

  if (analysisActive && jumpBaselineAnkleY !== null && canvas.width) {
    const inset = canvas.width * 0.12;

    ctx.beginPath();
    ctx.moveTo(inset, jumpBaselineAnkleY);
    ctx.lineTo(canvas.width - inset, jumpBaselineAnkleY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(22, 119, 255, 0.70)";
    ctx.beginPath();
    ctx.moveTo(inset, jumpBaselineHipY);
    ctx.lineTo(canvas.width - inset, jumpBaselineHipY);
    ctx.stroke();
  }

  ctx.restore();

  if (analysisActive && jumpBaselineAnkleY !== null && canvas.width) {
    const inset = canvas.width * 0.12;
    drawTag(inset, jumpBaselineAnkleY - px(10), "BASE TOBILLOS", {
      color: OVERLAY_COLORS.textMuted
    });
    drawTag(inset, jumpBaselineHipY - px(10), "BASE CADERA", {
      color: OVERLAY_COLORS.textMuted
    });
  }

  // Marcadores de línea media: la cadera media es la señal principal del salto.
  mids.forEach((mid, index) => {
    if (!mid) return;
    const size = px(index === 1 ? 6 : 4);

    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = index === 1 ? OVERLAY_COLORS.primary : OVERLAY_COLORS.point;
    ctx.strokeStyle = index === 1 ? OVERLAY_COLORS.point : OVERLAY_COLORS.primary;
    ctx.lineWidth = px(1.5);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  });

  if (analysisActive && mids[1] && (jumpState === "FLIGHT" || jumpState === "LANDING")) {
    drawTag(mids[1].x, mids[1].y - px(22), jumpState === "FLIGHT" ? "VUELO" : "ATERRIZAJE", {
      align: "center",
      color: OVERLAY_COLORS.primaryAlt
    });
  }
}


/* =========================================================
   PROCESS POSE
========================================================= */

function processPose(pose, now) {
  if (activeCategory === "movement") {
    processMovementPose(pose, now);
  } else {
    processJumpPose(pose, now);
  }
}

function processMovementPose(pose, now) {
  const side = getMovementTrackingSide(pose);

  candidateSide = side;
  activeSide = side;

  sideDisplay.textContent = sideLabel(side);
  updateSideHelp(side);

  const assessment = assessMovementPosition(pose, side);
  lastPositionAssessment = assessment;

  drawLateralSkeleton(pose, side);
  showPositionGuide(assessment);
  updateTrackingState(assessment.ready);
  updateSetupFlow();

  if (!assessment.ready) {
    angleDisplay.textContent = "—";

    if (analysisActive) {
      pauseDynamicMovementTiming(now);
      trackingWarning(assessment.short);
    }

    return;
  }

  trackingLostSince = null;
  trackingAlertPlayed = false;

  if (analysisActive) resumeDynamicMovementTiming(now);

  const points = sideData(pose, side);
  const raw = getDynamicMovementMetrics(points);
  const metrics = smoothDynamicMovementMetrics(raw);

  angleDisplay.textContent = `${metrics.primary.toFixed(0)}°`;
  drawLateralAngle(pose, side, metrics.primary);

  if (analysisActive) updateDynamicMovement(metrics, now);
}

function processJumpPose(pose, now) {
  sideDisplay.textContent = "FRONTAL";

  const assessment = assessJumpPosition(pose);
  lastPositionAssessment = assessment;

  drawFrontalSkeleton(pose);
  showPositionGuide(assessment);
  updateTrackingState(assessment.ready);
  updateSetupFlow();

  if (!assessment.ready) {
    angleDisplay.textContent = "FRONTAL";

    if (analysisActive) {
      markJumpTrackingCompromised(assessment.short);
      trackingWarning(assessment.short);
    }

    return;
  }

  trackingLostSince = null;
  trackingAlertPlayed = false;

  const data = frontalData(pose);
  const metrics = getFrontalJumpMetrics(data);

  angleDisplay.textContent = "FRONTAL";

  if (analysisActive) updateJump(metrics, now);
}


/* =========================================================
   MOVEMENT ENGINE
========================================================= */

const DYN_CALIBRATION_FRAMES = 12;
const DYN_CALIBRATION_RANGE = 3.5;
const DYN_START_CANDIDATE_DELTA = 1.0;
const DYN_START_DELTA = 4.0;
const DYN_REVERSAL_CANDIDATE_DELTA = 0.8;
const DYN_REVERSAL_DELTA = 3.0;
const DYN_RETURN_TOLERANCE = 4.0;
const DYN_MIN_PHASE_MS = 180;
const DYN_SIGNAL_EPS = 0.20;
const DYN_TURNAROUND_STABLE_MS = 160;
const DYN_TURNAROUND_TOLERANCE = 1.0;
const DYN_BASELINE_ADAPTATION = 0.20;
const SMOOTHING_FRAMES = 5;

let movementRepCount = 0;
let movementSuccessfulReps = 0;
let movementResults = [];

let dynState = "CALIBRATING";
let dynCalibrationSamples = [];
let dynBaselineSignal = null;
let dynBaselinePrimary = null;
let dynPotentialStartTime = null;
let dynPhase1StartTime = null;
let dynExtremeSignal = null;
let dynExtremeTime = null;
let dynReversalCandidateTime = null;
let dynPhase2StartTime = null;
let dynEccentricDuration = null;
let dynConcentricDuration = null;
let dynPrimaryMax = 0;
let dynTrackingPauseStartedAt = null;
let dynBufferExercise = null;
let dynBuffers = { primary: [], secondary: [], signal: [] };

function dynSmooth(buffer, value) {
  buffer.push(value);
  if (buffer.length > SMOOTHING_FRAMES) buffer.shift();
  return mean(buffer);
}

function getDynamicMovementMetrics(points) {
  if (activeExercise === "bench") {
    const elbowFlexion = flexionFromAngle(points.shoulder, points.elbow, points.wrist);

    return {
      primary: elbowFlexion,
      secondary: null,
      signal: elbowFlexion
    };
  }

  const kneeFlexion = flexionFromAngle(points.hip, points.knee, points.ankle);
  const hipFlexion = flexionFromAngle(points.shoulder, points.hip, points.knee);

  if (activeExercise === "deadlift") {
    return {
      primary: hipFlexion,
      secondary: kneeFlexion,
      signal: hipFlexion * 0.70 + kneeFlexion * 0.30
    };
  }

  return {
    primary: kneeFlexion,
    secondary: hipFlexion,
    signal: kneeFlexion * 0.65 + hipFlexion * 0.35
  };
}

function smoothDynamicMovementMetrics(metrics) {
  if (dynBufferExercise !== activeExercise) {
    dynBufferExercise = activeExercise;
    dynBuffers = { primary: [], secondary: [], signal: [] };
  }

  const primary = dynSmooth(dynBuffers.primary, metrics.primary);
  const secondary =
    metrics.secondary === null
      ? null
      : dynSmooth(dynBuffers.secondary, metrics.secondary);
  const signal = dynSmooth(dynBuffers.signal, metrics.signal);

  return { primary, secondary, signal };
}

function getDynamicMovementProfile() {
  if (activeExercise === "deadlift") {
    return {
      phase1Direction: -1,
      readyLabel: "PISO / LISTO",
      phase1Label: "CONCÉNTRICA ↑",
      turnaroundLabel: "ARRIBA",
      phase2Label: "EXCÉNTRICA ↓",
      phase1Name: "concentric",
      phase2Name: "eccentric"
    };
  }

  return {
    phase1Direction: 1,
    readyLabel: "ARRIBA / LISTO",
    phase1Label: "EXCÉNTRICA ↓",
    turnaroundLabel: activeExercise === "bench" ? "ABAJO" : "FONDO",
    phase2Label: "CONCÉNTRICA ↑",
    phase1Name: "eccentric",
    phase2Name: "concentric"
  };
}

function resetDynamicMovementTiming() {
  dynState = "CALIBRATING";
  dynCalibrationSamples = [];
  dynBaselineSignal = null;
  dynBaselinePrimary = null;
  dynPotentialStartTime = null;
  dynPhase1StartTime = null;
  dynExtremeSignal = null;
  dynExtremeTime = null;
  dynReversalCandidateTime = null;
  dynPhase2StartTime = null;
  dynEccentricDuration = null;
  dynConcentricDuration = null;
  dynPrimaryMax = 0;
  dynTrackingPauseStartedAt = null;
  dynBufferExercise = activeExercise;
  dynBuffers = { primary: [], secondary: [], signal: [] };
}

function pauseDynamicMovementTiming(timestamp) {
  if (!analysisActive || activeCategory !== "movement") return;
  if (dynTrackingPauseStartedAt === null) dynTrackingPauseStartedAt = timestamp;
}

function resumeDynamicMovementTiming(timestamp) {
  if (dynTrackingPauseStartedAt === null) return;

  const gap = timestamp - dynTrackingPauseStartedAt;
  dynTrackingPauseStartedAt = null;

  const shift = (value) => (value === null ? null : value + gap);

  dynPotentialStartTime = shift(dynPotentialStartTime);
  dynPhase1StartTime = shift(dynPhase1StartTime);
  dynExtremeTime = shift(dynExtremeTime);
  dynReversalCandidateTime = shift(dynReversalCandidateTime);
  dynPhase2StartTime = shift(dynPhase2StartTime);
}

function calibrateDynamicMovement(metrics) {
  dynCalibrationSamples.push({
    signal: metrics.signal,
    primary: metrics.primary
  });

  if (dynCalibrationSamples.length > DYN_CALIBRATION_FRAMES) {
    dynCalibrationSamples.shift();
  }

  stateDisplay.textContent = "CALIBRANDO";

  if (activeExercise === "deadlift") {
    statusBox.textContent = "Mantén estable la posición inicial en el piso.";
  } else if (activeExercise === "bench") {
    statusBox.textContent = "Mantén los brazos extendidos un instante.";
  } else {
    statusBox.textContent = "Mantente de pie un instante.";
  }

  if (dynCalibrationSamples.length < DYN_CALIBRATION_FRAMES) return false;

  const signals = dynCalibrationSamples.map((sample) => sample.signal);
  const range = Math.max(...signals) - Math.min(...signals);

  if (range > DYN_CALIBRATION_RANGE) return false;

  dynBaselineSignal = mean(signals);
  dynBaselinePrimary = mean(dynCalibrationSamples.map((sample) => sample.primary));
  dynPrimaryMax = dynBaselinePrimary;
  dynState = "READY";

  stateDisplay.textContent = getDynamicMovementProfile().readyLabel;
  statusBox.textContent =
    activeExercise === "deadlift"
      ? "Piso calibrado · comienza la subida."
      : "Posición inicial calibrada · comienza cuando estés listo.";

  return true;
}

function dynIsMoreExtreme(current, extreme, direction) {
  return direction * (current - extreme) > DYN_SIGNAL_EPS;
}

function updateDynamicMovement(metrics, timestamp) {
  const settings = getMovementSettings();
  const profile = getDynamicMovementProfile();
  const signal = metrics.signal;
  const direction = profile.phase1Direction;

  dynPrimaryMax = Math.max(dynPrimaryMax || metrics.primary, metrics.primary);

  if (dynState === "CALIBRATING") {
    calibrateDynamicMovement(metrics);
    return;
  }

  if (dynState === "READY") {
    stateDisplay.textContent = profile.readyLabel;

    const departure = direction * (signal - dynBaselineSignal);

    if (
      departure >= DYN_START_CANDIDATE_DELTA &&
      dynPotentialStartTime === null
    ) {
      dynPotentialStartTime = timestamp;
    }

    if (departure < 0.5) dynPotentialStartTime = null;

    if (departure >= DYN_START_DELTA) {
      dynState = "PHASE1";
      dynPhase1StartTime = dynPotentialStartTime ?? timestamp;
      dynExtremeSignal = signal;
      dynExtremeTime = timestamp;
      dynReversalCandidateTime = null;
      dynEccentricDuration = null;
      dynConcentricDuration = null;
      dynPrimaryMax = Math.max(dynBaselinePrimary ?? metrics.primary, metrics.primary);
      stateDisplay.textContent = profile.phase1Label;
    }
  } else if (dynState === "PHASE1") {
    dynPrimaryMax = Math.max(dynPrimaryMax, metrics.primary);

    if (dynIsMoreExtreme(signal, dynExtremeSignal, direction)) {
      dynExtremeSignal = signal;
      dynExtremeTime = timestamp;
      dynReversalCandidateTime = null;
    }

    const reversal = direction * (dynExtremeSignal - signal);

    const stableAtTurnaround =
      timestamp - dynExtremeTime >= DYN_TURNAROUND_STABLE_MS &&
      Math.abs(signal - dynExtremeSignal) <= DYN_TURNAROUND_TOLERANCE;

    stateDisplay.textContent = stableAtTurnaround
      ? profile.turnaroundLabel
      : profile.phase1Label;

    if (
      reversal >= DYN_REVERSAL_CANDIDATE_DELTA &&
      dynReversalCandidateTime === null
    ) {
      dynReversalCandidateTime = timestamp;
    }

    if (reversal < 0.3) dynReversalCandidateTime = null;

    const phase1ElapsedMs = dynExtremeTime - dynPhase1StartTime;

    if (
      reversal >= DYN_REVERSAL_DELTA &&
      phase1ElapsedMs >= DYN_MIN_PHASE_MS
    ) {
      const duration = phase1ElapsedMs / 1000;

      if (profile.phase1Name === "eccentric") {
        dynEccentricDuration = duration;
      } else {
        dynConcentricDuration = duration;
      }

      dynState = "PHASE2";
      dynPhase2StartTime = dynReversalCandidateTime ?? timestamp;
      stateDisplay.textContent = profile.phase2Label;
    }
  } else if (dynState === "PHASE2") {
    stateDisplay.textContent = profile.phase2Label;
    dynPrimaryMax = Math.max(dynPrimaryMax, metrics.primary);

    const phase2ElapsedMs = timestamp - dynPhase2StartTime;

    const returnedToBaseline =
      direction > 0
        ? signal <= dynBaselineSignal + DYN_RETURN_TOLERANCE
        : signal >= dynBaselineSignal - DYN_RETURN_TOLERANCE;

    if (returnedToBaseline && phase2ElapsedMs >= DYN_MIN_PHASE_MS) {
      const duration = phase2ElapsedMs / 1000;

      if (profile.phase2Name === "eccentric") {
        dynEccentricDuration = duration;
      } else {
        dynConcentricDuration = duration;
      }

      completeDynamicMovementRep(
        dynEccentricDuration,
        dynConcentricDuration,
        dynPrimaryMax
      );

      if (analysisActive) {
        dynBaselineSignal =
          dynBaselineSignal * (1 - DYN_BASELINE_ADAPTATION) +
          signal * DYN_BASELINE_ADAPTATION;

        dynBaselinePrimary =
          (dynBaselinePrimary ?? metrics.primary) * (1 - DYN_BASELINE_ADAPTATION) +
          metrics.primary * DYN_BASELINE_ADAPTATION;

        dynState = "READY";
        dynPotentialStartTime = null;
        dynPhase1StartTime = null;
        dynExtremeSignal = null;
        dynExtremeTime = null;
        dynReversalCandidateTime = null;
        dynPhase2StartTime = null;
        dynEccentricDuration = null;
        dynConcentricDuration = null;
        dynPrimaryMax = metrics.primary;
        stateDisplay.textContent = profile.readyLabel;
      }
    }
  }

  repDisplay.textContent = `${movementRepCount} / ${settings.targetReps}`;
}

function completeDynamicMovementRep(eccentric, concentric, angleValue) {
  const settings = getMovementSettings();

  movementRepCount++;

  const eccAvailable = Number.isFinite(eccentric);
  const conAvailable = Number.isFinite(concentric);

  const anglePassed = angleValue >= settings.angleTarget - settings.angleTolerance;
  const eccPassed =
    eccAvailable &&
    Math.abs(eccentric - settings.eccTarget) <= settings.eccTolerance;
  const conPassed =
    conAvailable &&
    Math.abs(concentric - settings.conTarget) <= settings.conTolerance;

  let passed = true;

  if (settings.checkAngle && !anglePassed) passed = false;
  if (settings.checkEcc && !eccPassed) passed = false;
  if (settings.checkCon && !conPassed) passed = false;

  if (passed) {
    movementSuccessfulReps++;
    showSuccess();
  } else {
    showWarning(
      buildDynamicMovementWarning(
        settings,
        anglePassed,
        eccPassed,
        conPassed,
        eccentric,
        concentric
      )
    );
    beepWarning();
  }

  const rep = {
    number: movementRepCount,
    angle: angleValue,
    eccentric: eccAvailable ? eccentric : null,
    concentric: conAvailable ? concentric : null,
    passed
  };

  movementResults.push(rep);
  addMovementResultRow(rep);
  updateMovementSummary();

  eccDisplay.textContent = eccAvailable ? `${eccentric.toFixed(2)} s` : "—";
  conDisplay.textContent = conAvailable ? `${concentric.toFixed(2)} s` : "—";
  repDisplay.textContent = `${movementRepCount} / ${settings.targetReps}`;

  if (movementRepCount >= settings.targetReps) stopAnalysis(true);
}

function buildDynamicMovementWarning(
  settings,
  anglePassed,
  eccPassed,
  conPassed,
  eccentric,
  concentric
) {
  if (settings.checkAngle && !anglePassed) return "Mayor recorrido";

  if (settings.checkEcc && Number.isFinite(eccentric) && !eccPassed) {
    return eccentric < settings.eccTarget
      ? "Excéntrica más rápida"
      : "Excéntrica más lenta";
  }

  if (settings.checkCon && Number.isFinite(concentric) && !conPassed) {
    return concentric < settings.conTarget
      ? "Concéntrica más rápida"
      : "Concéntrica más lenta";
  }

  return "Revisa objetivo";
}


/* =========================================================
   FRONTAL JUMP ENGINE
========================================================= */

const JUMP_BASELINE_FRAMES = 10;
const JUMP_BASELINE_RANGE_SCALE = 0.018;
const JUMP_TAKEOFF_MIN_MS = 70;
const JUMP_MIN_FLIGHT_MS = 120;
const JUMP_MAX_FLIGHT_MS = 1300;
const JUMP_LANDING_CAPTURE_MS = 360;
const JUMP_CONFIRM_FRAMES = 2;

const JUMP_CM_DESCENT_TRIGGER_SCALE = 0.030;
const JUMP_CM_REVERSAL_SCALE = 0.022;
const JUMP_SJ_COUNTERMOVEMENT_ALLOWANCE_SCALE = 0.018;
const JUMP_SJ_PROPULSION_TRIGGER_SCALE = 0.020;

let jumpCount = 0;
let jumpValidCount = 0;
let jumpState = "CALIBRATING";
let jumpResults = [];

let jumpBaselineAnkleY = null;
let jumpBaselineHipY = null;
let jumpBaselineScale = null;
let jumpBaselineSamples = [];

let jumpPreviousAnkleY = null;
let jumpPreviousHipY = null;
let jumpDeepestHipY = null;
let jumpStartTime = 0;
let jumpBottomTime = 0;
let jumpPropulsionStartTime = 0;
let jumpTakeoffTime = 0;
let jumpLandingTime = 0;
let jumpLandingStartTime = 0;
let jumpTakeoffCandidateTime = null;
let jumpTakeoffConfirmFrames = 0;
let jumpLandingCandidateTime = null;
let jumpLandingConfirmFrames = 0;
let jumpTrackingCompromised = false;
let jumpTrackingReason = null;

let sjHoldStartTime = 0;
let sjBaselineHipY = null;
let sjProtocolInvalid = false;

function resetJumpState() {
  jumpState = "CALIBRATING";
  jumpBaselineAnkleY = null;
  jumpBaselineHipY = null;
  jumpBaselineScale = null;
  jumpBaselineSamples = [];
  jumpPreviousAnkleY = null;
  jumpPreviousHipY = null;
  jumpDeepestHipY = null;
  jumpStartTime = 0;
  jumpBottomTime = 0;
  jumpPropulsionStartTime = 0;
  jumpTakeoffTime = 0;
  jumpLandingTime = 0;
  jumpLandingStartTime = 0;
  jumpTakeoffCandidateTime = null;
  jumpTakeoffConfirmFrames = 0;
  jumpLandingCandidateTime = null;
  jumpLandingConfirmFrames = 0;
  jumpTrackingCompromised = false;
  jumpTrackingReason = null;
  sjHoldStartTime = 0;
  sjBaselineHipY = null;
  sjProtocolInvalid = false;
}

function getFrontalJumpMetrics(data) {
  const shoulderMid = midpoint(data.left.shoulder, data.right.shoulder);
  const hipMid = midpoint(data.left.hip, data.right.hip);
  const ankleMid = midpoint(data.left.ankle, data.right.ankle);

  const leftScale = distance(data.left.shoulder, data.left.ankle);
  const rightScale = distance(data.right.shoulder, data.right.ankle);
  const bodyScale = Math.max(80, mean([leftScale, rightScale]));

  return {
    shoulderMid,
    hipMid,
    ankleMid,
    hipY: hipMid.y,
    ankleY: ankleMid.y,
    scale: bodyScale
  };
}

function updateJumpBaseline(metrics) {
  jumpBaselineSamples.push({
    ankleY: metrics.ankleY,
    hipY: metrics.hipY,
    scale: metrics.scale
  });

  if (jumpBaselineSamples.length > JUMP_BASELINE_FRAMES) {
    jumpBaselineSamples.shift();
  }

  if (jumpBaselineSamples.length < JUMP_BASELINE_FRAMES) return false;

  const ankles = jumpBaselineSamples.map((sample) => sample.ankleY);
  const hips = jumpBaselineSamples.map((sample) => sample.hipY);
  const scales = jumpBaselineSamples.map((sample) => sample.scale);

  const avgScale = mean(scales);
  const ankleRange = Math.max(...ankles) - Math.min(...ankles);
  const hipRange = Math.max(...hips) - Math.min(...hips);

  const ankleTolerance = Math.max(4, avgScale * JUMP_BASELINE_RANGE_SCALE);
  const hipTolerance = Math.max(5, avgScale * (JUMP_BASELINE_RANGE_SCALE * 1.25));

  if (ankleRange > ankleTolerance || hipRange > hipTolerance) return false;

  jumpBaselineAnkleY = mean(ankles);
  jumpBaselineHipY = mean(hips);
  jumpBaselineScale = avgScale;
  sjBaselineHipY = jumpBaselineHipY;

  return true;
}

function markJumpTrackingCompromised(reason) {
  if (!analysisActive || activeCategory !== "jump") return;

  if (
    jumpState !== "CALIBRATING" &&
    jumpState !== "READY" &&
    jumpState !== "START"
  ) {
    jumpTrackingCompromised = true;
    jumpTrackingReason = reason || "Tracking inestable";
  }
}

function updateJump(metrics, timestamp) {
  const settings = getJumpSettings();

  if (jumpBaselineAnkleY === null) {
    const calibrated = updateJumpBaseline(metrics);
    stateDisplay.textContent = "CALIBRANDO";

    jumpPreviousAnkleY = metrics.ankleY;
    jumpPreviousHipY = metrics.hipY;

    if (!calibrated) return;

    jumpState = activeExercise === "sj" ? "START" : "READY";
    stateDisplay.textContent = jumpState;
    statusBox.textContent =
      activeExercise === "sj"
        ? "Posición inicial calibrada · mantén la pausa antes de saltar."
        : "Posición inicial calibrada · salta cuando estés listo.";
    return;
  }

  if (activeExercise === "sj") {
    updateSquatJumpFrontal(metrics, timestamp, settings);
  } else {
    updateCountermovementJumpFrontal(metrics, timestamp, settings);
  }

  jumpPreviousAnkleY = metrics.ankleY;
  jumpPreviousHipY = metrics.hipY;

  stateDisplay.textContent = jumpState;
  repDisplay.textContent = `${jumpCount} / ${settings.targetJumps}`;
}

function updateSquatJumpFrontal(metrics, timestamp, settings) {
  const scale = jumpBaselineScale || metrics.scale;
  const cmAllowance = scale * JUMP_SJ_COUNTERMOVEMENT_ALLOWANCE_SCALE;
  const propulsionTrigger = scale * JUMP_SJ_PROPULSION_TRIGGER_SCALE;

  if (jumpState === "START") {
    jumpState = "HOLD";
    sjHoldStartTime = timestamp;
    sjBaselineHipY = metrics.hipY;
  } else if (jumpState === "HOLD") {
    const deviation = Math.abs(metrics.hipY - sjBaselineHipY);

    if (deviation > scale * 0.025) {
      sjHoldStartTime = timestamp;
      sjBaselineHipY = metrics.hipY;
      return;
    }

    if ((timestamp - sjHoldStartTime) / 1000 >= settings.holdTarget) {
      jumpState = "ARMED";
      sjBaselineHipY = metrics.hipY;
    }
  } else if (jumpState === "ARMED") {
    const downward = metrics.hipY - sjBaselineHipY;
    const upward = sjBaselineHipY - metrics.hipY;

    if (downward > cmAllowance) {
      sjProtocolInvalid = true;
      jumpState = "INVALID";
      showWarning("Countermovement detectado");
      beepWarning();
      return;
    }

    if (upward > propulsionTrigger) {
      jumpState = "PROPULSION";
      jumpPropulsionStartTime = timestamp;
    }
  } else if (jumpState === "INVALID") {
    if (Math.abs(metrics.hipY - sjBaselineHipY) < scale * 0.03) {
      addInvalidJumpResult("Countermovement");
      prepareNextJump();
    }
  } else if (jumpState === "PROPULSION") {
    detectJumpTakeoffFrontal(metrics, timestamp);
  } else if (jumpState === "FLIGHT") {
    detectJumpLandingFrontal(metrics, timestamp);
  } else if (jumpState === "LANDING") {
    captureLandingFrontal(timestamp, settings, settings.holdTarget);
  }
}

function updateCountermovementJumpFrontal(metrics, timestamp, settings) {
  const scale = jumpBaselineScale || metrics.scale;
  const descentTrigger = scale * JUMP_CM_DESCENT_TRIGGER_SCALE;
  const reversalTrigger = scale * JUMP_CM_REVERSAL_SCALE;

  if (jumpState === "READY") {
    const descent = metrics.hipY - jumpBaselineHipY;

    if (descent > descentTrigger) {
      jumpState = "COUNTERMOVEMENT";
      jumpStartTime = timestamp;
      jumpDeepestHipY = metrics.hipY;
      jumpBottomTime = timestamp;
    }
  } else if (jumpState === "COUNTERMOVEMENT") {
    if (metrics.hipY > jumpDeepestHipY) {
      jumpDeepestHipY = metrics.hipY;
      jumpBottomTime = timestamp;
    }

    if (jumpDeepestHipY - metrics.hipY > reversalTrigger) {
      jumpState = "PROPULSION";
      jumpPropulsionStartTime = timestamp;
    }
  } else if (jumpState === "PROPULSION") {
    detectJumpTakeoffFrontal(metrics, timestamp);
  } else if (jumpState === "FLIGHT") {
    detectJumpLandingFrontal(metrics, timestamp);
  } else if (jumpState === "LANDING") {
    captureLandingFrontal(timestamp, settings, null);
  }
}

function detectJumpTakeoffFrontal(metrics, timestamp) {
  const propulsionMs = timestamp - jumpPropulsionStartTime;
  if (propulsionMs < JUMP_TAKEOFF_MIN_MS) return;

  const scale = jumpBaselineScale || metrics.scale;
  const ankleThreshold = Math.max(5, scale * 0.024);
  const hipThreshold = Math.max(4, scale * 0.012);

  const ankleLift = jumpBaselineAnkleY - metrics.ankleY;
  const hipLift = jumpBaselineHipY - metrics.hipY;

  const ankleMovingUp =
    jumpPreviousAnkleY !== null && metrics.ankleY < jumpPreviousAnkleY - 0.18;
  const hipMovingUp =
    jumpPreviousHipY !== null && metrics.hipY < jumpPreviousHipY - 0.12;

  const candidate =
    ankleLift > ankleThreshold &&
    hipLift > hipThreshold &&
    ankleMovingUp &&
    hipMovingUp;

  if (candidate) {
    if (jumpTakeoffConfirmFrames === 0) {
      jumpTakeoffCandidateTime = timestamp;
    }

    jumpTakeoffConfirmFrames++;

    if (jumpTakeoffConfirmFrames >= JUMP_CONFIRM_FRAMES) {
      jumpTakeoffTime = jumpTakeoffCandidateTime;
      jumpState = "FLIGHT";
      jumpLandingCandidateTime = null;
      jumpLandingConfirmFrames = 0;
    }
  } else {
    jumpTakeoffCandidateTime = null;
    jumpTakeoffConfirmFrames = 0;
  }
}

function detectJumpLandingFrontal(metrics, timestamp) {
  const flightMs = timestamp - jumpTakeoffTime;
  if (flightMs < JUMP_MIN_FLIGHT_MS) return;

  const scale = jumpBaselineScale || metrics.scale;
  const ankleTolerance = Math.max(7, scale * 0.035);

  const ankleNearGround =
    Math.abs(metrics.ankleY - jumpBaselineAnkleY) <= ankleTolerance;

  const ankleMovingDown =
    jumpPreviousAnkleY !== null && metrics.ankleY > jumpPreviousAnkleY + 0.14;

  const hipMovingDown =
    jumpPreviousHipY !== null && metrics.hipY > jumpPreviousHipY + 0.08;

  const candidate = ankleNearGround && ankleMovingDown && hipMovingDown;

  if (candidate) {
    if (jumpLandingConfirmFrames === 0) {
      jumpLandingCandidateTime = timestamp;
    }

    jumpLandingConfirmFrames++;

    if (jumpLandingConfirmFrames >= JUMP_CONFIRM_FRAMES) {
      jumpLandingTime = jumpLandingCandidateTime;
      jumpLandingStartTime = timestamp;
      jumpState = "LANDING";
    }
  } else {
    jumpLandingCandidateTime = null;
    jumpLandingConfirmFrames = 0;
  }

  if (flightMs > JUMP_MAX_FLIGHT_MS) {
    addInvalidJumpResult(jumpTrackingReason || "No se detectó aterrizaje");
    showWarning("Salto invalidado · revisa tracking");
    beepWarning();
    prepareNextJump();
  }
}

function captureLandingFrontal(timestamp, settings, sjHold) {
  if (timestamp - jumpLandingStartTime >= JUMP_LANDING_CAPTURE_MS) {
    completeJump(settings, sjHold);
    if (analysisActive) prepareNextJump();
  }
}

function completeJump(settings, sjHold) {
  const flightTime = (jumpLandingTime - jumpTakeoffTime) / 1000;
  const estimatedHeightCm =
    ((GRAVITY * Math.pow(flightTime, 2)) / 8) * 100;

  const descentTime =
    activeExercise === "sj"
      ? null
      : (jumpBottomTime - jumpStartTime) / 1000;

  const flightValid =
    Number.isFinite(flightTime) &&
    flightTime >= JUMP_MIN_FLIGHT_MS / 1000 &&
    flightTime <= JUMP_MAX_FLIGHT_MS / 1000;

  const landingValid = Number.isFinite(jumpLandingTime) && jumpLandingTime > jumpTakeoffTime;

  let valid = !sjProtocolInvalid && !jumpTrackingCompromised;

  if (settings.checkFlight && !flightValid) valid = false;
  if (settings.checkLanding && !landingValid) valid = false;

  jumpCount++;
  if (valid) jumpValidCount++;

  if (valid) {
    showSuccess();
  } else {
    showWarning(jumpTrackingReason || "Revisa protocolo");
    beepWarning();
  }

  const result = {
    number: jumpResults.length + 1,
    estimatedHeightCm,
    flightTime,
    descentTime,
    holdTime: activeExercise === "sj" ? sjHold : null,
    landingDetected: landingValid,
    valid,
    reason: valid ? "Válido" : jumpTrackingReason || "Revisar"
  };

  jumpResults.push(result);
  addJumpResultRow(result);
  updateJumpSummary();

  eccDisplay.textContent = `${flightTime.toFixed(3)} s`;
  conDisplay.textContent = `${estimatedHeightCm.toFixed(1)} cm`;
  repDisplay.textContent = `${jumpCount} / ${settings.targetJumps}`;

  if (jumpCount >= settings.targetJumps) stopAnalysis(true);
}

function addInvalidJumpResult(reason) {
  const result = {
    number: jumpResults.length + 1,
    estimatedHeightCm: null,
    flightTime: null,
    descentTime: null,
    holdTime: activeExercise === "sj" ? getJumpSettings().holdTarget : null,
    landingDetected: false,
    valid: false,
    reason
  };

  jumpResults.push(result);
  addJumpResultRow(result);
  updateJumpSummary();
}

function prepareNextJump() {
  const preserveCount = jumpCount;
  const preserveValid = jumpValidCount;
  const preserveResults = jumpResults;

  resetJumpState();

  jumpCount = preserveCount;
  jumpValidCount = preserveValid;
  jumpResults = preserveResults;
}


/* =========================================================
   FEEDBACK VISUAL / AUDIO
========================================================= */

function showWarning(message) {
  const mode = getActiveFeedbackMode();
  if (mode !== "visual" && mode !== "both") return;

  warningBox.textContent = message;
  warningBox.classList.remove("hidden");

  if (warningHideTimer) clearTimeout(warningHideTimer);
  warningHideTimer = setTimeout(hideWarning, 1800);
}

function hideWarning() {
  warningBox.classList.add("hidden");
}

function showSuccess() {
  const mode = getActiveFeedbackMode();
  if (mode === "audio" || mode === "off") return;
  statusBox.textContent = "✓ Objetivo cumplido";
}

function trackingWarning(message) {
  const now = performance.now();

  if (trackingLostSince === null) trackingLostSince = now;

  showWarning(message);

  if (now - trackingLostSince > 1000 && !trackingAlertPlayed) {
    beepWarning();
    trackingAlertPlayed = true;
  }
}

function beepWarning() {
  const mode = getActiveFeedbackMode();
  if (mode !== "audio" && mode !== "both") return;

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") audioContext.resume();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.frequency.value = 520;
  gain.gain.value = 0.025;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}


/* =========================================================
   RESULTS
========================================================= */

function addMovementResultRow(rep) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${rep.number}</td>
    <td>${rep.angle.toFixed(0)}°</td>
    <td>${Number.isFinite(rep.eccentric) ? `${rep.eccentric.toFixed(2)} s` : "—"}</td>
    <td>${Number.isFinite(rep.concentric) ? `${rep.concentric.toFixed(2)} s` : "—"}</td>
    <td class="${rep.passed ? "pass" : "fail"}">${rep.passed ? "✓" : "⚠"}</td>
  `;

  movementResultsBody.appendChild(row);
}

function updateMovementSummary() {
  if (!movementResults.length) {
    movementSummary.textContent = "Aún no hay resultados.";
    return;
  }

  const avgAngle = mean(movementResults.map((rep) => rep.angle));
  const eccValues = movementResults
    .filter((rep) => Number.isFinite(rep.eccentric))
    .map((rep) => rep.eccentric);
  const conValues = movementResults
    .filter((rep) => Number.isFinite(rep.concentric))
    .map((rep) => rep.concentric);

  const avgEcc = mean(eccValues);
  const avgCon = mean(conValues);
  const compliance = (movementSuccessfulReps / movementResults.length) * 100;

  movementSummary.innerHTML = `
    <strong>${movementResults.length}</strong> repeticiones ·
    <strong>${compliance.toFixed(0)}%</strong> dentro de objetivos<br>
    ${exerciseMeta[activeExercise].angleName} media:
    <strong>${avgAngle.toFixed(0)}°</strong> · Excéntrica:
    <strong>${avgEcc === null ? "—" : `${avgEcc.toFixed(2)} s`}</strong> · Concéntrica:
    <strong>${avgCon === null ? "—" : `${avgCon.toFixed(2)} s`}</strong>
  `;
}

function addJumpResultRow(result) {
  const row = document.createElement("tr");

  const protocolValue =
    activeExercise === "sj"
      ? result.holdTime === null
        ? "—"
        : `${result.holdTime.toFixed(2)} s`
      : result.descentTime === null
      ? "—"
      : `${result.descentTime.toFixed(2)} s`;

  row.innerHTML = `
    <td>${result.number}</td>
    <td>${result.estimatedHeightCm === null ? "—" : `${result.estimatedHeightCm.toFixed(1)} cm`}</td>
    <td>${result.flightTime === null ? "—" : `${result.flightTime.toFixed(3)} s`}</td>
    <td>${protocolValue}</td>
    <td>${result.landingDetected ? "Detectado" : "—"}</td>
    <td class="${result.valid ? "pass" : "fail"}">${result.valid ? "✓" : "⚠"}</td>
  `;

  jumpResultsBody.appendChild(row);
}

function updateJumpSummary() {
  if (!jumpResults.length) {
    jumpSummary.textContent = "Aún no hay resultados.";
    return;
  }

  const valid = jumpResults.filter(
    (result) => result.valid && result.estimatedHeightCm !== null
  );

  const invalidCount = jumpResults.length - valid.length;

  if (!valid.length) {
    jumpSummary.innerHTML = `
      <strong>${jumpResults.length}</strong> intentos registrados ·
      <strong>${invalidCount}</strong> por revisar.
    `;
    return;
  }

  const heights = valid.map((result) => result.estimatedHeightCm);
  const flights = valid.map((result) => result.flightTime);

  const best = Math.max(...heights);
  const avgHeight = mean(heights);
  const avgFlight = mean(flights);

  jumpSummary.innerHTML = `
    <strong>${valid.length}</strong> saltos válidos ·
    <strong>${invalidCount}</strong> por revisar<br>
    Mejor altura estimada: <strong>${best.toFixed(1)} cm</strong> ·
    Media: <strong>${avgHeight.toFixed(1)} cm</strong> ·
    Vuelo medio: <strong>${avgFlight.toFixed(3)} s</strong>
  `;
}


/* =========================================================
   START / STOP ANALYSIS
========================================================= */

function startAnalysis() {
  if (!cameraReady) {
    statusBox.textContent = "Activa la cámara primero.";
    return;
  }

  if (!detector || detectorLoading) {
    statusBox.textContent = "Espera a que termine de cargar el motor de tracking.";
    return;
  }

  if (!trackingReady) {
    statusBox.textContent =
      lastPositionAssessment?.text || "Ajusta tu posición antes de iniciar.";
    return;
  }

  if (activeCategory === "movement") {
    lockedSide = sideMode === "auto" ? candidateSide : sideMode;
    activeSide = lockedSide;
    sideDisplay.textContent = sideLabel(activeSide);
    updateSideHelp(activeSide);
  } else {
    lockedSide = null;
    sideDisplay.textContent = "FRONTAL";
  }

  trackingLostSince = null;
  trackingAlertPlayed = false;
  hideWarning();

  movementConfigDetails.open = false;
  jumpConfigDetails.open = false;

  if (activeCategory === "movement") {
    movementRepCount = 0;
    movementSuccessfulReps = 0;
    movementResults = [];
    movementResultsBody.innerHTML = "";
    movementSummary.textContent = "Serie en curso...";

    resetDynamicMovementTiming();

    repDisplay.textContent = `0 / ${getMovementSettings().targetReps}`;
    stateDisplay.textContent = "CALIBRANDO";
    eccDisplay.textContent = "—";
    conDisplay.textContent = "—";
  } else {
    jumpCount = 0;
    jumpValidCount = 0;
    jumpResults = [];
    jumpResultsBody.innerHTML = "";
    jumpSummary.textContent = "Serie en curso...";

    resetJumpState();

    repDisplay.textContent = `0 / ${getJumpSettings().targetJumps}`;
    stateDisplay.textContent = "CALIBRANDO";
    eccDisplay.textContent = "—";
    conDisplay.textContent = "—";
  }

  analysisActive = true;
  updateSetupFlow();

  if (activeCategory === "movement") {
    if (activeExercise === "deadlift") {
      statusBox.textContent = "Mantén la posición inicial en el piso para calibrar.";
    } else if (activeExercise === "bench") {
      statusBox.textContent = "Mantén los brazos extendidos para calibrar.";
    } else {
      statusBox.textContent = "Mantente de pie para calibrar.";
    }
  } else {
    statusBox.textContent =
      activeExercise === "sj"
        ? "Mantén estable tu posición inicial de Squat Jump."
        : "Mantente de pie y estable mientras KINEMYX calibra la vista frontal.";
  }

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") audioContext.resume();
}

function stopAnalysis(automatic = false) {
  if (!analysisActive) {
    statusBox.textContent = "No hay una serie activa.";
    return;
  }

  analysisActive = false;
  stateDisplay.textContent = "COMPLETE";

  if (activeCategory === "movement") {
    updateMovementSummary();
    statusBox.textContent = automatic
      ? `Serie completada · ${movementRepCount} repeticiones`
      : `Serie finalizada · ${movementRepCount} repeticiones`;
  } else {
    jumpState = "COMPLETE";
    updateJumpSummary();
    statusBox.textContent = automatic
      ? `Serie completada · ${jumpCount} saltos`
      : `Serie finalizada · ${jumpCount} saltos`;
  }

  lockedSide = null;
  updateViewModeUI();
  updateSideHelp(candidateSide);
  updateSetupFlow();
  updateFeedbackContext();
}


/* =========================================================
   FEEDBACK FORM
========================================================= */

function detectBrowser() {
  const ua = navigator.userAgent;

  if (/CriOS/i.test(ua)) return "Chrome iOS";
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Android/i.test(ua)) return "Safari";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  return "Otro";
}

function detectDevice() {
  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  return "Desconocido";
}

function updateFeedbackContext() {
  feedbackExercise.value = exerciseMeta[activeExercise].name;
}

async function submitFeedback(event) {
  event.preventDefault();

  const message = feedbackMessage.value.trim();

  if (!message) {
    feedbackStatus.textContent = "Describe brevemente qué ocurrió.";
    feedbackStatus.className = "feedback-status error";
    return;
  }

  feedbackSubmit.disabled = true;
  feedbackSubmit.textContent = "Enviando...";

  const payload = new FormData();

  payload.append("_subject", `Nuevo feedback ${APP_VERSION}`);
  payload.append("tester", getTesterName());
  payload.append("perfil", feedbackProfile.value);
  payload.append("ejercicio", exerciseMeta[activeExercise].name);
  payload.append("categoria", activeCategory);
  payload.append("vista", activeCategory === "movement" ? "Lateral" : "Frontal");
  payload.append("tipo_feedback", feedbackType.value);
  payload.append("experiencia", `${feedbackExperience.value}/5`);
  payload.append("mensaje", message);
  payload.append(
    "lado",
    activeCategory === "movement" ? lockedSide || candidateSide : "bilateral"
  );
  payload.append("modo_lado", activeCategory === "movement" ? sideMode : "frontal");
  payload.append("contacto", feedbackContact.value.trim() || "No indicado");
  payload.append("version", APP_VERSION);
  payload.append("dispositivo", detectDevice());
  payload.append("navegador", detectBrowser());
  payload.append("modelo_tracking", detectorProfile || "no cargado");
  payload.append(
    "camara",
    currentFacingMode === "user" ? "Frontal dispositivo" : "Trasera dispositivo"
  );
  payload.append("fecha_hora", new Date().toLocaleString("es-CL"));

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error("Error Formspree");

    feedbackStatus.textContent = "✓ Feedback enviado.";
    feedbackStatus.className = "feedback-status success";

    feedbackForm.reset();
    feedbackExperience.value = "5";
    updateFeedbackContext();
  } catch (error) {
    console.error(error);
    feedbackStatus.textContent = "No se pudo enviar. Inténtalo nuevamente.";
    feedbackStatus.className = "feedback-status error";
  } finally {
    feedbackSubmit.disabled = false;
    feedbackSubmit.textContent = "Enviar feedback";
  }
}

feedbackForm.addEventListener("submit", submitFeedback);


/* =========================================================
   INITIALIZE
========================================================= */

initializeAccessGate();
updateSideButtons();
updateSideHelp();
selectCategory("movement");
updateViewModeUI();
updateSetupFlow();
updateFeedbackContext();
