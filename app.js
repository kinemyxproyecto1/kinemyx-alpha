/* =========================================================
   KINEMYX
   SQUAT ALPHA 0.1.1
   ========================================================= */


/* =========================================================
   ELEMENTOS DE LA INTERFAZ
   ========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cameraButton = document.getElementById("cameraButton");
const switchCameraButton = document.getElementById("switchCameraButton");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");

const repDisplay = document.getElementById("repDisplay");
const angleDisplay = document.getElementById("angleDisplay");
const stateDisplay = document.getElementById("stateDisplay");
const eccDisplay = document.getElementById("eccDisplay");
const conDisplay = document.getElementById("conDisplay");
const sideDisplay = document.getElementById("sideDisplay");

const statusBox = document.getElementById("status");
const warningBox = document.getElementById("warning");

const resultsBody = document.getElementById("resultsBody");
const summary = document.getElementById("summary");


/* =========================================================
   MOVENET
   ========================================================= */

let detector = null;


/* =========================================================
   ESTADO GENERAL
   ========================================================= */

let cameraReady = false;
let analysisActive = false;

let detectionLoopStarted = false;


/* =========================================================
   CONTROL DE CÁMARA
   ========================================================= */

/*
  user = cámara frontal
  environment = cámara trasera
*/

let currentFacingMode = "user";

let currentStream = null;


/* =========================================================
   LADO CORPORAL
   ========================================================= */

let candidateSide = "left";
let activeSide = "left";


/* =========================================================
   VARIABLES DE LA SERIE
   ========================================================= */

let repCount = 0;

let successfulReps = 0;

let movementState = "READY";

let maxFlexion = 0;

let repStartTime = 0;

let bottomTime = 0;

let ascentStartTime = 0;

let previousAngle = null;

let angleBuffer = [];

let results = [];


/* =========================================================
   AUDIO
   ========================================================= */

let audioContext = null;

/*
  Para evitar sonidos constantes
  durante pérdida de tracking.
*/

let trackingLostSince = null;

let trackingAlertPlayed = false;


/* =========================================================
   CONSTANTES
   ========================================================= */

/*
  Confianza mínima de los puntos corporales.
*/

const MIN_CONFIDENCE = 0.60;


/*
  Flexión aproximada para considerar
  que la persona está nuevamente de pie.
*/

const READY_FLEXION = 20;


/*
  Flexión necesaria para detectar
  que comenzó el descenso.
*/

const DESCENT_TRIGGER = 25;


/*
  Flexión mínima para aceptar
  que realmente hubo una sentadilla.
*/

const MIN_REP_FLEXION = 45;


/*
  Diferencia angular necesaria
  para detectar el cambio
  descenso → ascenso.
*/

const TURNAROUND_DELTA = 3;


/*
  Frames utilizados para
  suavizar el ángulo.
*/

const SMOOTHING_FRAMES = 5;


/* =========================================================
   CONFIGURACIÓN DEL USUARIO
   ========================================================= */

function getSettings() {

  return {

    targetReps:
      Number(
        document.getElementById("targetReps").value
      ),

    kneeTarget:
      Number(
        document.getElementById("kneeTarget").value
      ),

    kneeTolerance:
      Number(
        document.getElementById("kneeTolerance").value
      ),

    eccTarget:
      Number(
        document.getElementById("eccTarget").value
      ),

    eccTolerance:
      Number(
        document.getElementById("eccTolerance").value
      ),

    conTarget:
      Number(
        document.getElementById("conTarget").value
      ),

    conTolerance:
      Number(
        document.getElementById("conTolerance").value
      ),

    feedbackMode:
      document.getElementById("feedbackMode").value,

    checkRom:
      document.getElementById("checkRom").checked,

    checkEcc:
      document.getElementById("checkEcc").checked,

    checkCon:
      document.getElementById("checkCon").checked

  };

}


/* =========================================================
   BOTONES
   ========================================================= */

cameraButton.addEventListener(
  "click",
  initializeCamera
);


switchCameraButton.addEventListener(
  "click",
  switchCamera
);


startButton.addEventListener(
  "click",
  startAnalysis
);


stopButton.addEventListener(
  "click",
  stopAnalysis
);


/* =========================================================
   OBTENER CÁMARA
   ========================================================= */

async function getCameraStream() {

  /*
    Primero intentamos pedir específicamente
    la cámara seleccionada.
  */

  try {

    return await navigator.mediaDevices.getUserMedia({

      video: {

        facingMode: {
          exact: currentFacingMode
        },

        width: {
          ideal: 1280
        },

        height: {
          ideal: 720
        }

      },

      audio: false

    });

  }

  catch (error) {

    /*
      Si el navegador no acepta "exact",
      utilizamos "ideal".
    */

    console.warn(
      "No se pudo seleccionar la cámara exacta. Probando modo ideal.",
      error
    );


    return await navigator.mediaDevices.getUserMedia({

      video: {

        facingMode: {
          ideal: currentFacingMode
        },

        width: {
          ideal: 1280
        },

        height: {
          ideal: 720
        }

      },

      audio: false

    });

  }

}


/* =========================================================
   CARGAR MOVENET
   ========================================================= */

async function loadMoveNet() {

  /*
    Si ya está cargado,
    no volvemos a cargarlo.
  */

  if (detector) {
    return;
  }


  statusBox.textContent =
    "Cargando análisis de movimiento...";


  await tf.setBackend("webgl");

  await tf.ready();


  const model =
    poseDetection.SupportedModels.MoveNet;


  detector =
    await poseDetection.createDetector(

      model,

      {

        modelType:
          poseDetection
            .movenet
            .modelType
            .SINGLEPOSE_LIGHTNING,

        enableSmoothing: true

      }

    );

}


/* =========================================================
   INICIALIZAR CÁMARA
   ========================================================= */

async function initializeCamera() {

  try {

    statusBox.textContent =
      "Cargando KINEMYX...";


    /*
      Cargar MoveNet.
    */

    await loadMoveNet();


    /*
      Si ya había una cámara funcionando,
      detenerla.
    */

    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(
          track => track.stop()
        );

      currentStream = null;

    }


    cameraReady = false;


    /*
      Abrir cámara.
    */

    const stream =
      await getCameraStream();


    currentStream = stream;


    video.srcObject = stream;


    /*
      Esperar hasta que el navegador
      tenga información del video.
    */

    await new Promise(resolve => {

      video.onloadedmetadata =
        async () => {

          await video.play();

          resolve();

        };

    });


    /*
      Igualar canvas al tamaño
      real del video.
    */

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    cameraReady = true;


    startButton.disabled =
      false;


    /*
      Mostrar qué cámara está funcionando.
    */

    if (currentFacingMode === "user") {

      statusBox.textContent =
        "Cámara frontal activa · Ubícate de lado y muestra el cuerpo completo.";


      switchCameraButton.textContent =
        "Usar cámara trasera";

    }

    else {

      statusBox.textContent =
        "Cámara trasera activa · Ubícate de lado y muestra el cuerpo completo.";


      switchCameraButton.textContent =
        "Usar cámara frontal";

    }


    /*
      Iniciar MoveNet solo una vez.
    */

    if (!detectionLoopStarted) {

      detectionLoopStarted = true;

      detectLoop();

    }


    return true;

  }

  catch (error) {

    console.error(
      "Error de cámara:",
      error
    );


    cameraReady = false;


    statusBox.textContent =
      "No fue posible iniciar la cámara.";


    return false;

  }

}


/* =========================================================
   CAMBIAR CÁMARA
   ========================================================= */

async function switchCamera() {

  /*
    No permitimos cambiar de cámara
    durante una serie.
  */

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de cámara.";

    return;

  }


  /*
    Si todavía no se ha activado cámara.
  */

  if (!cameraReady) {

    statusBox.textContent =
      "Primero activa la cámara.";

    return;

  }


  const previousFacingMode =
    currentFacingMode;


  /*
    Alternar frontal ↔ trasera.
  */

  currentFacingMode =

    currentFacingMode === "user"

      ? "environment"

      : "user";


  statusBox.textContent =
    "Cambiando cámara...";


  const success =
    await initializeCamera();


  /*
    Si falla el cambio,
    volvemos a intentar con la cámara anterior.
  */

  if (!success) {

    currentFacingMode =
      previousFacingMode;


    statusBox.textContent =
      "Volviendo a la cámara anterior...";


    await initializeCamera();

  }

}


/* =========================================================
   LOOP PRINCIPAL MOVENET
   ========================================================= */

async function detectLoop() {

  /*
    Si la cámara todavía
    no está lista.
  */

  if (
    !cameraReady ||
    !detector ||
    video.readyState < 2
  ) {

    requestAnimationFrame(
      detectLoop
    );

    return;

  }


  try {

    const poses =
      await detector.estimatePoses(video);


    /*
      Limpiar skeleton anterior.
    */

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    if (
      poses &&
      poses.length > 0
    ) {

      const pose =
        poses[0];


      drawSkeleton(pose);


      processPose(pose);

    }

  }

  catch (error) {

    /*
      Si hay un error puntual
      no detenemos toda la aplicación.
    */

    console.warn(
      "Error temporal de MoveNet:",
      error
    );

  }


  requestAnimationFrame(
    detectLoop
  );

}


/* =========================================================
   PUNTOS DEL LADO CORPORAL
   ========================================================= */

function sideData(
  pose,
  side
) {

  const kp =
    pose.keypoints;


  /*
    Lado izquierdo.
  */

  if (side === "left") {

    return {

      shoulder:
        kp[5],

      hip:
        kp[11],

      knee:
        kp[13],

      ankle:
        kp[15]

    };

  }


  /*
    Lado derecho.
  */

  return {

    shoulder:
      kp[6],

    hip:
      kp[12],

    knee:
      kp[14],

    ankle:
      kp[16]

  };

}


/* =========================================================
   CONFIANZA PROMEDIO
   ========================================================= */

function averageConfidence(
  points
) {

  return (

    points.shoulder.score +

    points.hip.score +

    points.knee.score +

    points.ankle.score

  ) / 4;

}


/* =========================================================
   ELEGIR MEJOR LADO
   ========================================================= */

function determineBestSide(
  pose
) {

  const left =
    sideData(
      pose,
      "left"
    );


  const right =
    sideData(
      pose,
      "right"
    );


  const leftScore =
    averageConfidence(left);


  const rightScore =
    averageConfidence(right);


  return (

    leftScore >= rightScore

      ? "left"

      : "right"

  );

}


/* =========================================================
   CALCULAR ÁNGULO
   ========================================================= */

function calculateAngle(
  a,
  b,
  c
) {

  const radians =

    Math.atan2(
      c.y - b.y,
      c.x - b.x
    )

    -

    Math.atan2(
      a.y - b.y,
      a.x - b.x
    );


  let angle =

    Math.abs(
      radians *
      180 /
      Math.PI
    );


  if (angle > 180) {

    angle =
      360 - angle;

  }


  return angle;

}


/* =========================================================
   SUAVIZAR ÁNGULO
   ========================================================= */

function smoothAngle(
  angle
) {

  angleBuffer.push(angle);


  if (
    angleBuffer.length >
    SMOOTHING_FRAMES
  ) {

    angleBuffer.shift();

  }


  const total =
    angleBuffer.reduce(

      (sum, value) =>
        sum + value,

      0

    );


  return (
    total /
    angleBuffer.length
  );

}


/* =========================================================
   PROCESAR PERSONA DETECTADA
   ========================================================= */

function processPose(
  pose
) {

  /*
    Elegir el lado más visible.
  */

  candidateSide =
    determineBestSide(pose);


  /*
    Durante una serie,
    mantenemos fijo el lado elegido.
  */

  const side =

    analysisActive

      ? activeSide

      : candidateSide;


  sideDisplay.textContent =
    side.toUpperCase();


  const points =
    sideData(
      pose,
      side
    );


  const confidence =
    averageConfidence(
      points
    );


  /*
    Tracking insuficiente.
  */

  if (
    confidence <
    MIN_CONFIDENCE
  ) {

    angleDisplay.textContent =
      "—";


    if (analysisActive) {

      trackingWarning();

    }


    return;

  }


  /*
    Tracking recuperado.
  */

  trackingLostSince =
    null;

  trackingAlertPlayed =
    false;


  if (
    warningBox.textContent ===
    "Ajusta posición"
  ) {

    hideWarning();

  }


  /*
    Ángulo geométrico:
    cadera → rodilla → tobillo.
  */

  const jointAngle =
    calculateAngle(

      points.hip,

      points.knee,

      points.ankle

    );


  /*
    Convertir ángulo geométrico
    a flexión de rodilla.

    180° geométricos = 0° flexión.
  */

  let kneeFlexion =
    180 - jointAngle;


  kneeFlexion =
    Math.max(
      0,
      Math.min(
        160,
        kneeFlexion
      )
    );


  const smoothFlexion =
    smoothAngle(
      kneeFlexion
    );


  angleDisplay.textContent =

    smoothFlexion.toFixed(0)

    +

    "°";


  /*
    Solo analizamos repeticiones
    cuando la serie está activa.
  */

  if (analysisActive) {

    updateMovement(
      smoothFlexion,
      performance.now()
    );

  }

}


/* =========================================================
   MÁQUINA DE ESTADOS
   ========================================================= */

function updateMovement(
  flexion,
  timestamp
) {

  const settings =
    getSettings();


  /* =====================================================
     READY
     ===================================================== */

  if (
    movementState === "READY"
  ) {

    /*
      Detectar comienzo de descenso.
    */

    if (

      flexion >
      DESCENT_TRIGGER

      &&

      previousAngle !== null

      &&

      flexion >
      previousAngle

    ) {

      movementState =
        "DESCENDING";


      repStartTime =
        timestamp;


      maxFlexion =
        flexion;


      bottomTime =
        timestamp;

    }

  }


  /* =====================================================
     DESCENDING
     ===================================================== */

  else if (
    movementState ===
    "DESCENDING"
  ) {

    /*
      Actualizar máximo ROM.
    */

    if (
      flexion >
      maxFlexion
    ) {

      maxFlexion =
        flexion;


      bottomTime =
        timestamp;

    }


    /*
      Detectar inversión del movimiento.
    */

    if (

      maxFlexion -
      flexion >=
      TURNAROUND_DELTA

    ) {

      /*
        Confirmar que hubo una sentadilla
        suficientemente profunda como
        para considerarla repetición.
      */

      if (
        maxFlexion >=
        MIN_REP_FLEXION
      ) {

        movementState =
          "ASCENDING";


        ascentStartTime =
          timestamp;

      }

      else {

        /*
          Si solo hubo un movimiento pequeño
          volvemos a READY sin contar.
        */

        movementState =
          "READY";


        maxFlexion =
          0;

      }

    }

  }


  /* =====================================================
     ASCENDING
     ===================================================== */

  else if (
    movementState ===
    "ASCENDING"
  ) {

    /*
      Cuando vuelve cerca de extensión.
    */

    if (
      flexion <=
      READY_FLEXION
    ) {

      completeRep(
        timestamp
      );


      /*
        Si completeRep no finalizó
        automáticamente la serie,
        preparamos la siguiente repetición.
      */

      if (analysisActive) {

        movementState =
          "READY";


        maxFlexion =
          0;

      }

      else {

        /*
          La serie terminó.
          Evitamos sobrescribir COMPLETE.
        */

        previousAngle =
          flexion;

        return;

      }

    }

  }


  previousAngle =
    flexion;


  stateDisplay.textContent =
    movementState;


  repDisplay.textContent =

    `${repCount} / ${settings.targetReps}`;

}


/* =========================================================
   COMPLETAR REPETICIÓN
   ========================================================= */

function completeRep(
  timestamp
) {

  const settings =
    getSettings();


  repCount++;


  /*
    Tiempo excéntrico.
  */

  const eccentric =

    (
      bottomTime -
      repStartTime
    )

    /

    1000;


  /*
    Tiempo concéntrico.
  */

  const concentric =

    (
      timestamp -
      ascentStartTime
    )

    /

    1000;


  /* =====================================================
     ROM
     ===================================================== */

  const romMinimum =

    settings.kneeTarget

    -

    settings.kneeTolerance;


  const romPassed =

    maxFlexion >=
    romMinimum;


  /* =====================================================
     TEMPO EXCÉNTRICO
     ===================================================== */

  const eccPassed =

    Math.abs(

      eccentric -
      settings.eccTarget

    )

    <=

    settings.eccTolerance;


  /* =====================================================
     TEMPO CONCÉNTRICO
     ===================================================== */

  const conPassed =

    Math.abs(

      concentric -
      settings.conTarget

    )

    <=

    settings.conTolerance;


  /*
    Inicialmente asumimos
    que cumplió.
  */

  let passed =
    true;


  if (
    settings.checkRom &&
    !romPassed
  ) {

    passed =
      false;

  }


  if (
    settings.checkEcc &&
    !eccPassed
  ) {

    passed =
      false;

  }


  if (
    settings.checkCon &&
    !conPassed
  ) {

    passed =
      false;

  }


  /* =====================================================
     FEEDBACK
     ===================================================== */

  if (passed) {

    successfulReps++;


    showSuccess();

  }

  else {

    const message =
      buildWarning(

        settings,

        romPassed,

        eccPassed,

        conPassed,

        eccentric,

        concentric

      );


    showWarning(
      message
    );


    /*
      Solo un beep por repetición.
    */

    beepWarning();

  }


  /* =====================================================
     GUARDAR RESULTADO
     ===================================================== */

  const rep = {

    number:
      repCount,

    maxFlexion:
      maxFlexion,

    eccentric:
      eccentric,

    concentric:
      concentric,

    passed:
      passed

  };


  results.push(rep);


  addResultRow(rep);


  eccDisplay.textContent =

    eccentric.toFixed(2)

    +

    " s";


  conDisplay.textContent =

    concentric.toFixed(2)

    +

    " s";


  repDisplay.textContent =

    `${repCount} / ${settings.targetReps}`;


  updateSummary();


  /* =====================================================
     FINALIZACIÓN AUTOMÁTICA
     ===================================================== */

  if (
    repCount >=
    settings.targetReps
  ) {

    stopAnalysis(
      true
    );

  }

}


/* =========================================================
   MENSAJE DE ADVERTENCIA
   ========================================================= */

function buildWarning(

  settings,

  romPassed,

  eccPassed,

  conPassed,

  eccentric,

  concentric

) {

  /*
    Prioridad 1:
    ROM.
  */

  if (
    settings.checkRom &&
    !romPassed
  ) {

    return "Más profundidad";

  }


  /*
    Prioridad 2:
    Excéntrica.
  */

  if (
    settings.checkEcc &&
    !eccPassed
  ) {

    if (
      eccentric <
      settings.eccTarget
    ) {

      return "Bajada más lenta";

    }


    return "Bajada más rápida";

  }


  /*
    Prioridad 3:
    Concéntrica.
  */

  if (
    settings.checkCon &&
    !conPassed
  ) {

    if (
      concentric <
      settings.conTarget
    ) {

      return "Subida más lenta";

    }


    return "Subida más rápida";

  }


  return "Revisa objetivo";

}


/* =========================================================
   ADVERTENCIA VISUAL
   ========================================================= */

function showWarning(
  message
) {

  const mode =
    getSettings()
      .feedbackMode;


  if (

    mode === "visual"

    ||

    mode === "both"

  ) {

    warningBox.textContent =
      message;


    warningBox
      .classList
      .remove("hidden");


    setTimeout(
      hideWarning,
      1500
    );

  }

}


/* =========================================================
   FEEDBACK CORRECTO
   ========================================================= */

function showSuccess() {

  const mode =
    getSettings()
      .feedbackMode;


  /*
    Si el usuario no quiere
    feedback visual, no mostramos nada.
  */

  if (
    mode === "audio" ||
    mode === "off"
  ) {

    return;

  }


  statusBox.textContent =
    "✓ Objetivo cumplido";

}


/* =========================================================
   OCULTAR ADVERTENCIA
   ========================================================= */

function hideWarning() {

  warningBox
    .classList
    .add("hidden");

}


/* =========================================================
   TRACKING PERDIDO
   ========================================================= */

function trackingWarning() {

  const now =
    performance.now();


  /*
    Registrar cuándo comenzó
    la pérdida de tracking.
  */

  if (
    trackingLostSince === null
  ) {

    trackingLostSince =
      now;

  }


  /*
    Feedback visual.
  */

  showWarning(
    "Ajusta posición"
  );


  /*
    Solo emitir un beep
    durante cada episodio de
    pérdida de tracking.

    No suena continuamente.
  */

  if (

    now -
    trackingLostSince >
    1000

    &&

    !trackingAlertPlayed

  ) {

    beepWarning();


    trackingAlertPlayed =
      true;

  }

}


/* =========================================================
   BEEP SUTIL
   ========================================================= */

function beepWarning() {

  const mode =
    getSettings()
      .feedbackMode;


  /*
    Si el usuario eligió
    solo visual o apagado,
    no reproducimos audio.
  */

  if (

    mode !== "audio"

    &&

    mode !== "both"

  ) {

    return;

  }


  /*
    Crear AudioContext
    solamente si todavía
    no existe.
  */

  if (!audioContext) {

    audioContext =

      new (

        window.AudioContext

        ||

        window.webkitAudioContext

      )();

  }


  /*
    Algunos teléfonos suspenden
    AudioContext hasta una interacción.
  */

  if (
    audioContext.state ===
    "suspended"
  ) {

    audioContext.resume();

  }


  const oscillator =
    audioContext
      .createOscillator();


  const gain =
    audioContext
      .createGain();


  /*
    Frecuencia moderada.
  */

  oscillator.frequency.value =
    520;


  /*
    Volumen muy bajo.
  */

  gain.gain.value =
    0.025;


  oscillator.connect(
    gain
  );


  gain.connect(
    audioContext.destination
  );


  oscillator.start();


  /*
    Duración 120 ms.
  */

  oscillator.stop(

    audioContext.currentTime

    +

    0.12

  );

}


/* =========================================================
   DIBUJAR ESQUELETO
   ========================================================= */

function drawSkeleton(
  pose
) {

  const kp =
    pose.keypoints;


  /*
    Conexiones principales.
  */

  const connections = [

    [5, 6],

    [5, 11],

    [6, 12],

    [11, 12],

    [11, 13],

    [13, 15],

    [12, 14],

    [14, 16],

    [5, 7],

    [7, 9],

    [6, 8],

    [8, 10]

  ];


  ctx.lineWidth =
    3;


  ctx.strokeStyle =
    "#1478ff";


  /*
    Dibujar segmentos.
  */

  connections.forEach(

    ([a, b]) => {

      if (

        kp[a].score >
        0.35

        &&

        kp[b].score >
        0.35

      ) {

        ctx.beginPath();


        ctx.moveTo(
          kp[a].x,
          kp[a].y
        );


        ctx.lineTo(
          kp[b].x,
          kp[b].y
        );


        ctx.stroke();

      }

    }

  );


  /*
    Dibujar puntos articulares.
  */

  kp.forEach(
    point => {

      if (
        point.score >
        0.35
      ) {

        ctx.beginPath();


        ctx.arc(

          point.x,

          point.y,

          5,

          0,

          Math.PI * 2

        );


        ctx.fillStyle =
          "#ffffff";


        ctx.fill();

      }

    }
  );

}


/* =========================================================
   AGREGAR RESULTADO A LA TABLA
   ========================================================= */

function addResultRow(
  rep
) {

  const row =
    document.createElement(
      "tr"
    );


  row.innerHTML = `

    <td>
      ${rep.number}
    </td>

    <td>
      ${rep.maxFlexion.toFixed(0)}°
    </td>

    <td>
      ${rep.eccentric.toFixed(2)} s
    </td>

    <td>
      ${rep.concentric.toFixed(2)} s
    </td>

    <td
      class="${
        rep.passed
          ? "pass"
          : "fail"
      }"
    >

      ${
        rep.passed
          ? "✓"
          : "⚠"
      }

    </td>

  `;


  resultsBody.appendChild(
    row
  );

}


/* =========================================================
   ACTUALIZAR RESUMEN
   ========================================================= */

function updateSummary() {

  /*
    Si no hubo repeticiones.
  */

  if (
    results.length === 0
  ) {

    summary.innerHTML =
      "No se registraron repeticiones.";

    return;

  }


  /*
    Flexión media.
  */

  const avgFlexion =

    results.reduce(

      (sum, rep) =>
        sum +
        rep.maxFlexion,

      0

    )

    /

    results.length;


  /*
    Excéntrica media.
  */

  const avgEcc =

    results.reduce(

      (sum, rep) =>
        sum +
        rep.eccentric,

      0

    )

    /

    results.length;


  /*
    Concéntrica media.
  */

  const avgCon =

    results.reduce(

      (sum, rep) =>
        sum +
        rep.concentric,

      0

    )

    /

    results.length;


  /*
    Cumplimiento.
  */

  const compliance =

    (

      successfulReps

      /

      results.length

    )

    *

    100;


  summary.innerHTML = `

    <strong>
      ${results.length}
    </strong>

    repeticiones realizadas

    <br>

    <strong>
      ${successfulReps}
    </strong>

    cumplieron objetivos

    <br>

    Cumplimiento:

    <strong>
      ${compliance.toFixed(0)}%
    </strong>

    <br>

    Flexión media:

    <strong>
      ${avgFlexion.toFixed(0)}°
    </strong>

    <br>

    Excéntrica media:

    <strong>
      ${avgEcc.toFixed(2)} s
    </strong>

    <br>

    Concéntrica media:

    <strong>
      ${avgCon.toFixed(2)} s
    </strong>

  `;

}


/* =========================================================
   INICIAR SERIE
   ========================================================= */

function startAnalysis() {

  /*
    Cámara obligatoria.
  */

  if (!cameraReady) {

    statusBox.textContent =
      "Activa la cámara primero.";

    return;

  }


  /*
    Bloquear el lado corporal
    que actualmente tiene mejor tracking.
  */

  activeSide =
    candidateSide;


  /*
    Reiniciar serie.
  */

  repCount =
    0;


  successfulReps =
    0;


  results =
    [];


  resultsBody.innerHTML =
    "";


  summary.innerHTML =
    "Serie en curso...";


  angleBuffer =
    [];


  previousAngle =
    null;


  maxFlexion =
    0;


  movementState =
    "READY";


  trackingLostSince =
    null;


  trackingAlertPlayed =
    false;


  analysisActive =
    true;


  const settings =
    getSettings();


  repDisplay.textContent =

    `0 / ${settings.targetReps}`;


  stateDisplay.textContent =
    "READY";


  eccDisplay.textContent =
    "—";


  conDisplay.textContent =
    "—";


  statusBox.textContent =
    "Análisis activo";


  startButton.disabled =
    true;


  /*
    Preparar audio desde
    la interacción del usuario.
  */

  if (!audioContext) {

    audioContext =

      new (

        window.AudioContext

        ||

        window.webkitAudioContext

      )();

  }


  if (
    audioContext.state ===
    "suspended"
  ) {

    audioContext.resume();

  }

}


/* =========================================================
   FINALIZAR SERIE
   ========================================================= */

/*
  automatic = true
  significa que terminó porque
  alcanzó el número objetivo.

  automatic = false
  significa que el usuario presionó
  Finalizar serie.
*/

function stopAnalysis(
  automatic = false
) {

  /*
    Si no existe una serie activa.
  */

  if (!analysisActive) {

    statusBox.textContent =
      "No hay una serie activa.";

    return;

  }


  analysisActive =
    false;


  startButton.disabled =
    false;


  movementState =
    "COMPLETE";


  stateDisplay.textContent =
    "COMPLETE";


  /*
    Mostrar motivo de finalización.
  */

  if (automatic) {

    statusBox.textContent =

      `Serie completada · ${repCount} repeticiones`;

  }

  else {

    statusBox.textContent =

      `Serie finalizada · ${repCount} repeticiones`;

  }


  /*
    Mostrar resumen aunque
    se termine antes del objetivo.
  */

  updateSummary();

}
