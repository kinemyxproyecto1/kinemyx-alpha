/* =========================================================
   KINEMYX
   Squat Alpha 0.1.1
   ========================================================= */


/* =========================================================
   ELEMENTOS HTML
   ========================================================= */

const video = document.getElementById("video");

const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");


const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById("switchCameraButton");

const startButton =
  document.getElementById("startButton");

const stopButton =
  document.getElementById("stopButton");


const repDisplay =
  document.getElementById("repDisplay");

const angleDisplay =
  document.getElementById("angleDisplay");

const stateDisplay =
  document.getElementById("stateDisplay");

const eccDisplay =
  document.getElementById("eccDisplay");

const conDisplay =
  document.getElementById("conDisplay");

const sideDisplay =
  document.getElementById("sideDisplay");


const statusBox =
  document.getElementById("status");

const warningBox =
  document.getElementById("warning");


const resultsBody =
  document.getElementById("resultsBody");

const summary =
  document.getElementById("summary");



/* =========================================================
   VARIABLES GENERALES
   ========================================================= */

let detector = null;


let cameraReady = false;

let analysisActive = false;


/* =========================================================
   CONTROL DE CÁMARA
   ========================================================= */

let currentFacingMode = "user";

let currentStream = null;


/*
  Evita crear varios loops de MoveNet
  cuando cambiemos entre cámara frontal y trasera.
*/

let detectionLoopStarted = false;



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


let trackingLostSince = null;

let lastTrackingAudio = 0;



/* =========================================================
   CONSTANTES
   ========================================================= */

const MIN_CONFIDENCE = 0.60;


/*
  Flexión aproximada máxima
  permitida para considerar
  que volvió a posición inicial.
*/

const READY_FLEXION = 20;


/*
  Flexión mínima necesaria
  para considerar que comenzó
  un descenso.
*/

const DESCENT_TRIGGER = 25;


/*
  Flexión mínima para confirmar
  que realmente hubo una
  repetición.
*/

const MIN_REP_FLEXION = 45;


/*
  Diferencia angular necesaria
  para detectar cambio
  descenso → ascenso.
*/

const TURNAROUND_DELTA = 3;


/*
  Frames utilizados para
  suavizar el ángulo.
*/

const SMOOTHING_FRAMES = 5;


/*
  Tiempo mínimo entre avisos
  de tracking.
*/

const TRACKING_AUDIO_COOLDOWN = 3000;



/* =========================================================
   CONFIGURACIÓN DEL USUARIO
   ========================================================= */

function getSettings() {

  return {

    targetReps:
      Number(
        document
          .getElementById("targetReps")
          .value
      ),


    kneeTarget:
      Number(
        document
          .getElementById("kneeTarget")
          .value
      ),


    kneeTolerance:
      Number(
        document
          .getElementById("kneeTolerance")
          .value
      ),


    eccTarget:
      Number(
        document
          .getElementById("eccTarget")
          .value
      ),


    eccTolerance:
      Number(
        document
          .getElementById("eccTolerance")
          .value
      ),


    conTarget:
      Number(
        document
          .getElementById("conTarget")
          .value
      ),


    conTolerance:
      Number(
        document
          .getElementById("conTolerance")
          .value
      ),


    feedbackMode:
      document
        .getElementById("feedbackMode")
        .value,


    checkRom:
      document
        .getElementById("checkRom")
        .checked,


    checkEcc:
      document
        .getElementById("checkEcc")
        .checked,


    checkCon:
      document
        .getElementById("checkCon")
        .checked

  };

}



/* =========================================================
   BOTÓN ACTIVAR CÁMARA
   ========================================================= */

cameraButton.addEventListener(
  "click",
  initializeCamera
);



/* =========================================================
   BOTÓN CAMBIAR CÁMARA
   ========================================================= */

switchCameraButton.addEventListener(
  "click",
  switchCamera
);



/* =========================================================
   OBTENER STREAM DE CÁMARA
   ========================================================= */

async function getCameraStream() {

  /*
    Primero intentamos solicitar
    específicamente frontal o trasera.
  */

  try {

    return await navigator.mediaDevices
      .getUserMedia({

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
      Algunos navegadores no aceptan
      "exact".

      Si falla, usamos "ideal".
    */

    console.warn(
      "Cámara exacta no disponible. Probando modo ideal.",
      error
    );


    return await navigator.mediaDevices
      .getUserMedia({

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
   INICIALIZAR CÁMARA + MOVENET
   ========================================================= */

async function initializeCamera() {

  try {

    statusBox.textContent =
      "Cargando KINEMYX...";


    /* -----------------------------------------
       CARGAR MOVENET SOLO UNA VEZ
       ----------------------------------------- */

    if (!detector) {

      await tf.setBackend("webgl");

      await tf.ready();


      const model =
        poseDetection
          .SupportedModels
          .MoveNet;


      detector =
        await poseDetection
          .createDetector(

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



    /* -----------------------------------------
       DETENER STREAM ANTERIOR
       ----------------------------------------- */

    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(
          track => track.stop()
        );

      currentStream = null;

    }



    cameraReady = false;



    /* -----------------------------------------
       SOLICITAR NUEVA CÁMARA
       ----------------------------------------- */

    const stream =
      await getCameraStream();


    currentStream = stream;


    video.srcObject = stream;



    /* -----------------------------------------
       ESPERAR VIDEO
       ----------------------------------------- */

    await new Promise(
      resolve => {

        video.onloadedmetadata =
          async () => {

            await video.play();

            resolve();

          };

      }
    );



    /* -----------------------------------------
       AJUSTAR CANVAS
       ----------------------------------------- */

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;



    cameraReady = true;


    startButton.disabled =
      false;



    /* -----------------------------------------
       MOSTRAR CÁMARA ACTIVA
       ----------------------------------------- */

    if (
      currentFacingMode ===
      "user"
    ) {

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



    /* -----------------------------------------
       INICIAR LOOP SOLO UNA VEZ
       ----------------------------------------- */

    if (!detectionLoopStarted) {

      detectionLoopStarted = true;

      detectLoop();

    }


    return true;

  }

  catch (error) {

    console.error(
      "Error inicializando cámara:",
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
    No cambiamos cámara durante una serie,
    porque alteraría la detección de fases.
  */

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de cámara.";

    return;

  }



  if (!cameraReady) {

    statusBox.textContent =
      "Primero activa la cámara.";

    return;

  }



  const previousFacingMode =
    currentFacingMode;



  currentFacingMode =

    currentFacingMode === "user"

      ? "environment"

      : "user";



  statusBox.textContent =
    "Cambiando cámara...";



  const success =
    await initializeCamera();



  /*
    Si el cambio falla,
    volvemos a la cámara anterior.
  */

  if (!success) {

    currentFacingMode =
      previousFacingMode;


    statusBox.textContent =
      "No fue posible cambiar de cámara.";

  }

}



/* =========================================================
   LOOP DE DETECCIÓN
   ========================================================= */

async function detectLoop() {

  /*
    Si cámara/modelo todavía
    no están listos.
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
      await detector
        .estimatePoses(video);



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

    console.warn(
      "Error temporal en detección:",
      error
    );

  }



  requestAnimationFrame(
    detectLoop
  );

}



/* =========================================================
   OBTENER PUNTOS DEL LADO
   ========================================================= */

function sideData(
  pose,
  side
) {

  const kp =
    pose.keypoints;



  /* -----------------------------------------
     LADO IZQUIERDO
     ----------------------------------------- */

  if (
    side === "left"
  ) {

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



  /* -----------------------------------------
     LADO DERECHO
     ----------------------------------------- */

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
   CONFIANZA MEDIA
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
   DETERMINAR MEJOR LADO
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



  if (
    angle > 180
  ) {

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

      (a, b) =>
        a + b,

      0

    );



  return (

    total /

    angleBuffer.length

  );

}



/* =========================================================
   PROCESAR POSE
   ========================================================= */

function processPose(
  pose
) {

  candidateSide =
    determineBestSide(
      pose
    );



  /*
    Antes de comenzar:
    elegimos automáticamente
    el lado más visible.

    Durante la serie:
    bloqueamos el lado elegido.
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



  /* -----------------------------------------
     TRACKING INSUFICIENTE
     ----------------------------------------- */

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



  /* -----------------------------------------
     TRACKING RECUPERADO
     ----------------------------------------- */

  trackingLostSince =
    null;



  if (

    warningBox.textContent ===
    "Ajusta posición"

  ) {

    hideWarning();

  }



  /* -----------------------------------------
     ÁNGULO GEOMÉTRICO
     ----------------------------------------- */

  const jointAngle =
    calculateAngle(

      points.hip,

      points.knee,

      points.ankle

    );



  /* -----------------------------------------
     FLEXIÓN DE RODILLA
     ----------------------------------------- */

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

    smoothFlexion
      .toFixed(0)

    +

    "°";



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
    movementState ===
    "READY"
  ) {

    if (

      flexion >
      DESCENT_TRIGGER

      &&

      previousAngle !==
      null

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
      Actualizar máxima
      flexión alcanzada.
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
      Detectar cambio
      de dirección.
    */

    if (

      maxFlexion -
      flexion >=

      TURNAROUND_DELTA

    ) {

      if (

        maxFlexion >=
        MIN_REP_FLEXION

      ) {

        movementState =
          "ASCENDING";


        ascentStartTime =
          timestamp;

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
      Regresó suficientemente
      cerca de extensión.
    */

    if (

      flexion <=
      READY_FLEXION

    ) {

      completeRep(
        timestamp
      );


      movementState =
        "READY";


      maxFlexion = 0;

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



  /* -----------------------------------------
     TIEMPO EXCÉNTRICO
     ----------------------------------------- */

  const eccentric =

    (
      bottomTime -
      repStartTime
    )

    /

    1000;



  /* -----------------------------------------
     TIEMPO CONCÉNTRICO
     ----------------------------------------- */

  const concentric =

    (
      timestamp -
      ascentStartTime
    )

    /

    1000;



  /* -----------------------------------------
     OBJETIVO DE ROM
     ----------------------------------------- */

  const romMin =

    settings.kneeTarget

    -

    settings.kneeTolerance;



  const romPassed =

    maxFlexion >=
    romMin;



  /* -----------------------------------------
     OBJETIVO EXCÉNTRICO
     ----------------------------------------- */

  const eccPassed =

    Math.abs(

      eccentric -

      settings.eccTarget

    )

    <=

    settings.eccTolerance;



  /* -----------------------------------------
     OBJETIVO CONCÉNTRICO
     ----------------------------------------- */

  const conPassed =

    Math.abs(

      concentric -

      settings.conTarget

    )

    <=

    settings.conTolerance;



  let passed =
    true;



  if (

    settings.checkRom

    &&

    !romPassed

  ) {

    passed = false;

  }



  if (

    settings.checkEcc

    &&

    !eccPassed

  ) {

    passed = false;

  }



  if (

    settings.checkCon

    &&

    !conPassed

  ) {

    passed = false;

  }



  /* =====================================================
     RESULTADO DE LA REP
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
      Un beep puntual
      por repetición incorrecta.
    */

    beepWarning();

  }



  /* =====================================================
     GUARDAR REP
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



  updateSummary();



  repDisplay.textContent =

    `${repCount} / ${settings.targetReps}`;



  /* =====================================================
     FIN AUTOMÁTICO
     ===================================================== */

  if (

    repCount >=
    settings.targetReps

  ) {

    stopAnalysis();

  }

}



/* =========================================================
   CONSTRUIR ADVERTENCIA
   ========================================================= */

function buildWarning(

  settings,

  romPassed,

  eccPassed,

  conPassed,

  eccentric,

  concentric

) {

  /* -----------------------------------------
     ROM
     ----------------------------------------- */

  if (

    settings.checkRom

    &&

    !romPassed

  ) {

    return "Más profundidad";

  }



  /* -----------------------------------------
     EXCÉNTRICA
     ----------------------------------------- */

  if (

    settings.checkEcc

    &&

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



  /* -----------------------------------------
     CONCÉNTRICA
     ----------------------------------------- */

  if (

    settings.checkCon

    &&

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
   FEEDBACK VISUAL
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
   TRACKING
   ========================================================= */

function trackingWarning() {

  const now =
    performance.now();



  if (
    trackingLostSince ===
    null
  ) {

    trackingLostSince =
      now;

  }



  showWarning(
    "Ajusta posición"
  );



  /*
    Solo emitimos audio
    si la pérdida de tracking
    persiste más de 1 segundo.
  */

  if (

    now -
    trackingLostSince >
    1000

    &&

    now -
    lastTrackingAudio >

    TRACKING_AUDIO_COOLDOWN

  ) {

    beepWarning();


    lastTrackingAudio =
      now;

  }

}



/* =========================================================
   AUDIO
   ========================================================= */

function beepWarning() {

  const mode =
    getSettings()
      .feedbackMode;



  if (

    mode !== "audio"

    &&

    mode !== "both"

  ) {

    return;

  }



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



  const oscillator =
    audioContext
      .createOscillator();



  const gain =
    audioContext
      .createGain();



  /*
    Tono sutil.
  */

  oscillator.frequency.value =
    520;


  gain.gain.value =
    0.025;



  oscillator.connect(
    gain
  );


  gain.connect(
    audioContext.destination
  );



  oscillator.start();



  oscillator.stop(

    audioContext.currentTime

    +

    0.12

  );

}



/* =========================================================
   DIBUJAR SKELETON
   ========================================================= */

function drawSkeleton(
  pose
) {

  const kp =
    pose.keypoints;



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
   AGREGAR RESULTADO A TABLA
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



  resultsBody
    .appendChild(row);

}



/* =========================================================
   ACTUALIZAR RESUMEN
   ========================================================= */

function updateSummary() {

  if (
    results.length === 0
  ) {

    summary.innerHTML =
      "No se registraron repeticiones.";

    return;

  }



  const avgFlexion =

    results.reduce(

      (sum, rep) =>

        sum +
        rep.maxFlexion,

      0

    )

    /

    results.length;



  const avgEcc =

    results.reduce(

      (sum, rep) =>

        sum +
        rep.eccentric,

      0

    )

    /

    results.length;



  const avgCon =

    results.reduce(

      (sum, rep) =>

        sum +
        rep.concentric,

      0

    )

    /

    results.length;



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

startButton.addEventListener(

  "click",

  startAnalysis

);



function startAnalysis() {

  if (!cameraReady) {

    statusBox.textContent =
      "Activa la cámara primero.";

    return;

  }



  /* -----------------------------------------
     BLOQUEAR LADO MÁS VISIBLE
     ----------------------------------------- */

  activeSide =
    candidateSide;



  /* -----------------------------------------
     REINICIAR DATOS
     ----------------------------------------- */

  repCount = 0;

  successfulReps = 0;


  results = [];


  resultsBody.innerHTML =
    "";


  summary.innerHTML =
    "Serie en curso...";


  angleBuffer = [];


  previousAngle =
    null;


  maxFlexion =
    0;


  movementState =
    "READY";


  trackingLostSince =
    null;



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
    El botón Finalizar
    permanece siempre disponible.
  */


  /* -----------------------------------------
     ACTIVAR AUDIO DESDE GESTO DEL USUARIO
     ----------------------------------------- */

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
   FINALIZAR SERIE MANUAL
   ========================================================= */

stopButton.addEventListener(

  "click",

  stopAnalysis

);



function stopAnalysis() {

  /*
    Si no existe una serie activa,
    el botón sigue funcionando,
    pero simplemente informa.
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
    "READY";



  stateDisplay.textContent =
    "COMPLETE";



  statusBox.textContent =

    `Serie finalizada · ${repCount} repeticiones`;



  updateSummary();

}
