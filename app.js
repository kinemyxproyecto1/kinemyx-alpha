/* =========================================================
   KINEMYX - Movement Alpha 0.2
   SQUAT + CMJ
   ========================================================= */


/* =========================================================
   ELEMENTOS HTML
========================================================= */

const video =
  document.getElementById("video");

const canvas =
  document.getElementById("canvas");

const ctx =
  canvas.getContext("2d");


const squatModeButton =
  document.getElementById("squatModeButton");

const cmjModeButton =
  document.getElementById("cmjModeButton");


const squatSettingsSection =
  document.getElementById("squatSettingsSection");

const cmjSettingsSection =
  document.getElementById("cmjSettingsSection");


const cameraButton =
  document.getElementById("cameraButton");

const switchCameraButton =
  document.getElementById("switchCameraButton");

const startButton =
  document.getElementById("startButton");

const stopButton =
  document.getElementById("stopButton");


const liveExerciseLabel =
  document.getElementById("liveExerciseLabel");

const countLabel =
  document.getElementById("countLabel");

const primaryMetricLabel =
  document.getElementById("primaryMetricLabel");

const secondaryMetricLabel =
  document.getElementById("secondaryMetricLabel");

const tertiaryMetricLabel =
  document.getElementById("tertiaryMetricLabel");


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


/* =========================================================
   RESULTADOS SENTADILLA
========================================================= */

const squatResultsSection =
  document.getElementById("results");

const resultsBody =
  document.getElementById("resultsBody");

const summary =
  document.getElementById("summary");


/* =========================================================
   RESULTADOS CMJ
========================================================= */

const cmjResultsSection =
  document.getElementById("cmjResults");

const cmjResultsBody =
  document.getElementById("cmjResultsBody");

const cmjSummary =
  document.getElementById("cmjSummary");


/* =========================================================
   ESTADO GENERAL
========================================================= */

let detector = null;

let cameraReady = false;

let analysisActive = false;

let detectionLoopStarted = false;


/*
  Ejercicio inicial.
*/

let activeExercise =
  "squat";


/* =========================================================
   CÁMARA
========================================================= */

/*
  user =
  cámara frontal

  environment =
  cámara trasera
*/

let currentFacingMode =
  "user";

let currentStream =
  null;


/* =========================================================
   LADO CORPORAL
========================================================= */

let candidateSide =
  "left";

let activeSide =
  "left";


/* =========================================================
   AUDIO Y ALERTAS
========================================================= */

let audioContext =
  null;

let trackingLostSince =
  null;

let trackingAlertPlayed =
  false;

let warningHideTimer =
  null;


/* =========================================================
   CONSTANTES GENERALES
========================================================= */

const MIN_CONFIDENCE =
  0.60;

const SMOOTHING_FRAMES =
  5;

const READY_FLEXION =
  20;

const DESCENT_TRIGGER =
  25;

const TURNAROUND_DELTA =
  4;


/* =========================================================
   SENTADILLA
========================================================= */

let squatRepCount =
  0;

let squatSuccessfulReps =
  0;

let squatState =
  "READY";

let squatMaxFlexion =
  0;

let squatRepStartTime =
  0;

let squatBottomTime =
  0;

let squatAscentStartTime =
  0;

let squatPreviousAngle =
  null;

let squatResults =
  [];


const SQUAT_MIN_REP_FLEXION =
  45;


/* =========================================================
   CMJ
========================================================= */

let cmjJumpCount =
  0;

let cmjSuccessfulJumps =
  0;

let cmjState =
  "READY";


let cmjPreviousFlexion =
  null;

let cmjPreviousAnkleY =
  null;


let cmjMaxFlexion =
  0;


let cmjStartTime =
  0;

let cmjBottomTime =
  0;

let cmjPropulsionStartTime =
  0;

let cmjTakeoffTime =
  0;

let cmjLandingTime =
  0;

let cmjLandingStartTime =
  0;


let cmjMaxLandingFlexion =
  0;


let cmjResults =
  [];


/* =========================================================
   CALIBRACIÓN CMJ
========================================================= */

/*
  Posición vertical de tobillo
  y cadera estando de pie.

  Se utiliza para detectar
  aproximadamente despegue
  y aterrizaje.
*/

let cmjBaselineAnkleY =
  null;

let cmjBaselineHipY =
  null;

let cmjBaselineSamples =
  [];


/* =========================================================
   CONSTANTES CMJ
========================================================= */

const CMJ_MIN_COUNTERMOVEMENT =
  35;


/*
  Evita identificar como despegue
  pequeños movimientos instantáneos.
*/

const CMJ_TAKEOFF_MIN_MS =
  80;


/*
  Un vuelo más corto que esto
  probablemente sea ruido.
*/

const CMJ_MIN_FLIGHT_MS =
  120;


/*
  Seguridad por si no detecta
  correctamente el aterrizaje.
*/

const CMJ_MAX_FLIGHT_MS =
  1200;


/*
  Tiempo durante el cual analizamos
  la flexión posterior al contacto.
*/

const CMJ_LANDING_CAPTURE_MS =
  450;


/*
  Gravedad.

  Se utilizará para estimar
  altura mediante tiempo de vuelo.
*/

const GRAVITY =
  9.81;


/* =========================================================
   SUAVIZADO
========================================================= */

let angleBuffer =
  [];


/* =========================================================
   CONFIGURACIÓN SENTADILLA
========================================================= */

function getSquatSettings() {

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
   CONFIGURACIÓN CMJ
========================================================= */

function getCmjSettings() {

  return {

    targetJumps:
      Number(
        document
          .getElementById("cmjTargetJumps")
          .value
      ),


    heightTarget:
      Number(
        document
          .getElementById("cmjHeightTarget")
          .value
      ),


    heightTolerance:
      Number(
        document
          .getElementById("cmjHeightTolerance")
          .value
      ),


    kneeTarget:
      Number(
        document
          .getElementById("cmjKneeTarget")
          .value
      ),


    kneeTolerance:
      Number(
        document
          .getElementById("cmjKneeTolerance")
          .value
      ),


    feedbackMode:
      document
        .getElementById("cmjFeedbackMode")
        .value,


    checkHeight:
      document
        .getElementById("checkCmjHeight")
        .checked,


    checkFlight:
      document
        .getElementById("checkCmjFlight")
        .checked,


    checkKnee:
      document
        .getElementById("checkCmjKnee")
        .checked,


    checkCountermovement:
      document
        .getElementById("checkCmjCountermovement")
        .checked,


    checkLanding:
      document
        .getElementById("checkCmjLanding")
        .checked

  };

}


/* =========================================================
   FEEDBACK SEGÚN EJERCICIO
========================================================= */

function getActiveFeedbackMode() {

  if (
    activeExercise ===
    "cmj"
  ) {

    return getCmjSettings()
      .feedbackMode;

  }


  return getSquatSettings()
    .feedbackMode;

}


/* =========================================================
   SELECTOR DE EJERCICIO
========================================================= */

squatModeButton
  .addEventListener(
    "click",
    () =>
      selectExercise("squat")
  );


cmjModeButton
  .addEventListener(
    "click",
    () =>
      selectExercise("cmj")
  );


function selectExercise(
  exercise
) {

  /*
    No permitir cambio
    durante una serie.
  */

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de análisis.";

    return;

  }


  activeExercise =
    exercise;


  angleBuffer =
    [];


  hideWarning();


  /* =====================================================
     SENTADILLA
  ===================================================== */

  if (
    exercise ===
    "squat"
  ) {

    squatSettingsSection
      .classList
      .remove("hidden");


    cmjSettingsSection
      .classList
      .add("hidden");


    squatResultsSection
      .classList
      .remove("hidden");


    cmjResultsSection
      .classList
      .add("hidden");


    squatModeButton
      .classList
      .remove("secondary");


    cmjModeButton
      .classList
      .add("secondary");


    liveExerciseLabel
      .textContent =
      "SQUAT";


    countLabel
      .textContent =
      "REP";


    primaryMetricLabel
      .textContent =
      "KNEE FLEXION";


    secondaryMetricLabel
      .textContent =
      "ECCENTRIC";


    tertiaryMetricLabel
      .textContent =
      "CONCENTRIC";


    const settings =
      getSquatSettings();


    repDisplay
      .textContent =
      `0 / ${settings.targetReps}`;


    angleDisplay
      .textContent =
      "—°";


    stateDisplay
      .textContent =
      "READY";


    eccDisplay
      .textContent =
      "—";


    conDisplay
      .textContent =
      "—";


    statusBox
      .textContent =

      cameraReady

        ? "Sentadilla seleccionada."

        : "Activa la cámara";

  }


  /* =====================================================
     CMJ
  ===================================================== */

  else {

    squatSettingsSection
      .classList
      .add("hidden");


    cmjSettingsSection
      .classList
      .remove("hidden");


    squatResultsSection
      .classList
      .add("hidden");


    cmjResultsSection
      .classList
      .remove("hidden");


    squatModeButton
      .classList
      .add("secondary");


    cmjModeButton
      .classList
      .remove("secondary");


    liveExerciseLabel
      .textContent =
      "CMJ";


    countLabel
      .textContent =
      "JUMP";


    primaryMetricLabel
      .textContent =
      "KNEE FLEXION";


    secondaryMetricLabel
      .textContent =
      "FLIGHT TIME";


    tertiaryMetricLabel
      .textContent =
      "HEIGHT EST.";


    const settings =
      getCmjSettings();


    repDisplay
      .textContent =
      `0 / ${settings.targetJumps}`;


    angleDisplay
      .textContent =
      "—°";


    stateDisplay
      .textContent =
      "READY";


    eccDisplay
      .textContent =
      "—";


    conDisplay
      .textContent =
      "—";


    statusBox
      .textContent =

      cameraReady

        ? "CMJ seleccionado · mantente de pie unos segundos para calibrar."

        : "Activa la cámara";

  }

}


/* =========================================================
   BOTONES
========================================================= */

cameraButton
  .addEventListener(
    "click",
    initializeCamera
  );


switchCameraButton
  .addEventListener(
    "click",
    switchCamera
  );


startButton
  .addEventListener(
    "click",
    startAnalysis
  );


stopButton
  .addEventListener(
    "click",
    () =>
      stopAnalysis(false)
  );


/* =========================================================
   OBTENER CÁMARA
========================================================= */

async function getCameraStream() {

  try {

    return await navigator
      .mediaDevices
      .getUserMedia({

        video: {

          facingMode: {
            exact:
              currentFacingMode
          },

          width: {
            ideal:
              1280
          },

          height: {
            ideal:
              720
          }

        },

        audio:
          false

      });

  }

  catch (error) {

    /*
      Algunos navegadores
      no aceptan exact.
    */

    console.warn(
      "No se pudo abrir la cámara exacta; probando modo ideal.",
      error
    );


    return await navigator
      .mediaDevices
      .getUserMedia({

        video: {

          facingMode: {
            ideal:
              currentFacingMode
          },

          width: {
            ideal:
              1280
          },

          height: {
            ideal:
              720
          }

        },

        audio:
          false

      });

  }

}


/* =========================================================
   CARGAR MOVENET
========================================================= */

async function loadMoveNet() {

  /*
    Cargar una sola vez.
  */

  if (detector) {

    return;

  }


  statusBox.textContent =
    "Cargando análisis de movimiento...";


  await tf.setBackend(
    "webgl"
  );


  await tf.ready();


  detector =
    await poseDetection
      .createDetector(

        poseDetection
          .SupportedModels
          .MoveNet,

        {

          modelType:
            poseDetection
              .movenet
              .modelType
              .SINGLEPOSE_LIGHTNING,

          enableSmoothing:
            true

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


    await loadMoveNet();


    /*
      Detener cámara anterior.
    */

    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(

          track =>
            track.stop()

        );


      currentStream =
        null;

    }


    cameraReady =
      false;


    const stream =
      await getCameraStream();


    currentStream =
      stream;


    video.srcObject =
      stream;


    await new Promise(

      resolve => {

        video.onloadedmetadata =
          async () => {

            await video.play();

            resolve();

          };

      }

    );


    canvas.width =
      video.videoWidth;


    canvas.height =
      video.videoHeight;


    cameraReady =
      true;


    startButton.disabled =
      false;


    if (
      currentFacingMode ===
      "user"
    ) {

      statusBox.textContent =
        "Cámara frontal activa · ubícate de lado y muestra el cuerpo completo.";


      switchCameraButton.textContent =
        "Usar cámara trasera";

    }

    else {

      statusBox.textContent =
        "Cámara trasera activa · ubícate de lado y muestra el cuerpo completo.";


      switchCameraButton.textContent =
        "Usar cámara frontal";

    }


    /*
      Iniciar loop solamente una vez.
    */

    if (
      !detectionLoopStarted
    ) {

      detectionLoopStarted =
        true;


      detectLoop();

    }


    return true;

  }

  catch (error) {

    console.error(
      "Error inicializando cámara:",
      error
    );


    cameraReady =
      false;


    statusBox.textContent =
      "No fue posible iniciar la cámara.";


    return false;

  }

}


/* =========================================================
   CAMBIAR CÁMARA
========================================================= */

async function switchCamera() {

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


  const previousMode =
    currentFacingMode;


  currentFacingMode =

    currentFacingMode ===
    "user"

      ? "environment"

      : "user";


  statusBox.textContent =
    "Cambiando cámara...";


  const success =
    await initializeCamera();


  if (!success) {

    currentFacingMode =
      previousMode;


    statusBox.textContent =
      "Volviendo a la cámara anterior...";


    await initializeCamera();

  }

}


/* =========================================================
   LOOP DE DETECCIÓN
========================================================= */

async function detectLoop() {

  if (

    !cameraReady

    ||

    !detector

    ||

    video.readyState <
    2

  ) {

    requestAnimationFrame(
      detectLoop
    );

    return;

  }


  try {

    const poses =
      await detector
        .estimatePoses(
          video
        );


    ctx.clearRect(

      0,

      0,

      canvas.width,

      canvas.height

    );


    if (

      poses

      &&

      poses.length >
      0

    ) {

      const pose =
        poses[0];


      drawSkeleton(
        pose
      );


      processPose(
        pose
      );

    }

  }

  catch (error) {

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
   PUNTOS CORPORALES
========================================================= */

function sideData(
  pose,
  side
) {

  const kp =
    pose.keypoints;


  if (
    side ===
    "left"
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
   CONFIANZA
========================================================= */

function averageConfidence(
  points
) {

  return (

    points.shoulder.score

    +

    points.hip.score

    +

    points.knee.score

    +

    points.ankle.score

  ) / 4;

}


/* =========================================================
   MEJOR LADO CORPORAL
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


  return (

    averageConfidence(
      left
    )

    >=

    averageConfidence(
      right
    )

      ? "left"

      : "right"

  );

}


/* =========================================================
   CÁLCULO DE ÁNGULO
========================================================= */

function calculateAngle(
  a,
  b,
  c
) {

  const radians =

    Math.atan2(

      c.y -
      b.y,

      c.x -
      b.x

    )

    -

    Math.atan2(

      a.y -
      b.y,

      a.x -
      b.x

    );


  let angle =

    Math.abs(

      radians

      *

      180

      /

      Math.PI

    );


  if (
    angle >
    180
  ) {

    angle =
      360 -
      angle;

  }


  return angle;

}


/* =========================================================
   SUAVIZADO DE ÁNGULO
========================================================= */

function smoothAngle(
  angle
) {

  angleBuffer.push(
    angle
  );


  if (

    angleBuffer.length

    >

    SMOOTHING_FRAMES

  ) {

    angleBuffer.shift();

  }


  return (

    angleBuffer.reduce(

      (
        sum,
        value
      ) =>

        sum +
        value,

      0

    )

    /

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
    Durante una serie
    mantenemos el mismo lado.
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


  /* =====================================================
     TRACKING INSUFICIENTE
  ===================================================== */

  if (

    confidence

    <

    MIN_CONFIDENCE

  ) {

    angleDisplay.textContent =
      "—";


    if (analysisActive) {

      trackingWarning();

    }


    return;

  }


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


  /* =====================================================
     FLEXIÓN DE RODILLA
  ===================================================== */

  const jointAngle =
    calculateAngle(

      points.hip,

      points.knee,

      points.ankle

    );


  let kneeFlexion =

    180

    -

    jointAngle;


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

    `${smoothFlexion.toFixed(0)}°`;


  /*
    Cuando CMJ está seleccionado,
    aprovechamos los momentos
    de pie para calibrar.
  */

  if (
    activeExercise ===
    "cmj"
  ) {

    updateCmjBaseline(
      smoothFlexion,
      points
    );

  }


  if (!analysisActive) {

    return;

  }


  if (
    activeExercise ===
    "squat"
  ) {

    updateSquat(

      smoothFlexion,

      performance.now()

    );

  }

  else {

    updateCmj(

      smoothFlexion,

      points,

      performance.now()

    );

  }

}


/* =========================================================
   SENTADILLA
========================================================= */

function updateSquat(
  flexion,
  timestamp
) {

  const settings =
    getSquatSettings();


  /* =====================================================
     READY
  ===================================================== */

  if (
    squatState ===
    "READY"
  ) {

    if (

      flexion >
      DESCENT_TRIGGER

      &&

      squatPreviousAngle !==
      null

      &&

      flexion >
      squatPreviousAngle

    ) {

      squatState =
        "DESCENDING";


      squatRepStartTime =
        timestamp;


      squatMaxFlexion =
        flexion;


      squatBottomTime =
        timestamp;

    }

  }


  /* =====================================================
     DESCENDING
  ===================================================== */

  else if (

    squatState ===
    "DESCENDING"

  ) {

    if (

      flexion >
      squatMaxFlexion

    ) {

      squatMaxFlexion =
        flexion;


      squatBottomTime =
        timestamp;

    }


    if (

      squatMaxFlexion

      -

      flexion

      >=

      TURNAROUND_DELTA

    ) {

      if (

        squatMaxFlexion

        >=

        SQUAT_MIN_REP_FLEXION

      ) {

        squatState =
          "ASCENDING";


        squatAscentStartTime =
          timestamp;

      }

      else {

        squatState =
          "READY";


        squatMaxFlexion =
          0;

      }

    }

  }


  /* =====================================================
     ASCENDING
  ===================================================== */

  else if (

    squatState ===
    "ASCENDING"

  ) {

    if (

      flexion <=
      READY_FLEXION

    ) {

      completeSquatRep(
        timestamp
      );


      if (analysisActive) {

        squatState =
          "READY";


        squatMaxFlexion =
          0;

      }

    }

  }


  squatPreviousAngle =
    flexion;


  stateDisplay.textContent =
    squatState;


  repDisplay.textContent =

    `${squatRepCount} / ${settings.targetReps}`;

}


/* =========================================================
   COMPLETAR SENTADILLA
========================================================= */

function completeSquatRep(
  timestamp
) {

  const settings =
    getSquatSettings();


  squatRepCount++;


  const eccentric =

    (
      squatBottomTime

      -

      squatRepStartTime
    )

    /

    1000;


  const concentric =

    (
      timestamp

      -

      squatAscentStartTime
    )

    /

    1000;


  const romMinimum =

    settings.kneeTarget

    -

    settings.kneeTolerance;


  const romPassed =

    squatMaxFlexion

    >=

    romMinimum;


  const eccPassed =

    Math.abs(

      eccentric

      -

      settings.eccTarget

    )

    <=

    settings.eccTolerance;


  const conPassed =

    Math.abs(

      concentric

      -

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

    passed =
      false;

  }


  if (

    settings.checkEcc

    &&

    !eccPassed

  ) {

    passed =
      false;

  }


  if (

    settings.checkCon

    &&

    !conPassed

  ) {

    passed =
      false;

  }


  if (passed) {

    squatSuccessfulReps++;


    showSuccess();

  }

  else {

    const message =
      buildSquatWarning(

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


    beepWarning();

  }


  const rep = {

    number:
      squatRepCount,

    maxFlexion:
      squatMaxFlexion,

    eccentric:
      eccentric,

    concentric:
      concentric,

    passed:
      passed

  };


  squatResults.push(
    rep
  );


  addSquatResultRow(
    rep
  );


  updateSquatSummary();


  eccDisplay.textContent =

    `${eccentric.toFixed(2)} s`;


  conDisplay.textContent =

    `${concentric.toFixed(2)} s`;


  repDisplay.textContent =

    `${squatRepCount} / ${settings.targetReps}`;


  if (

    squatRepCount

    >=

    settings.targetReps

  ) {

    stopAnalysis(
      true
    );

  }

}


/* =========================================================
   ADVERTENCIA SENTADILLA
========================================================= */

function buildSquatWarning(

  settings,

  romPassed,

  eccPassed,

  conPassed,

  eccentric,

  concentric

) {

  if (

    settings.checkRom

    &&

    !romPassed

  ) {

    return "Más profundidad";

  }


  if (

    settings.checkEcc

    &&

    !eccPassed

  ) {

    return (

      eccentric <
      settings.eccTarget

        ? "Bajada más lenta"

        : "Bajada más rápida"

    );

  }


  if (

    settings.checkCon

    &&

    !conPassed

  ) {

    return (

      concentric <
      settings.conTarget

        ? "Subida más lenta"

        : "Subida más rápida"

    );

  }


  return "Revisa objetivo";

}


/* =========================================================
   CMJ - CALIBRACIÓN DE POSICIÓN
========================================================= */

function updateCmjBaseline(
  flexion,
  points
) {

  /*
    No recalibrar durante
    las fases del salto.
  */

  if (

    analysisActive

    &&

    cmjState !==
    "READY"

  ) {

    return;

  }


  /*
    Solo calibramos cuando
    está prácticamente de pie.
  */

  if (

    flexion >
    READY_FLEXION

  ) {

    return;

  }


  cmjBaselineSamples.push({

    ankleY:
      points.ankle.y,

    hipY:
      points.hip.y

  });


  /*
    Utilizamos máximo
    los últimos 20 frames.
  */

  if (

    cmjBaselineSamples.length

    >

    20

  ) {

    cmjBaselineSamples.shift();

  }


  /*
    Mínimo 8 frames
    para establecer la referencia.
  */

  if (

    cmjBaselineSamples.length

    >=

    8

  ) {

    cmjBaselineAnkleY =

      cmjBaselineSamples.reduce(

        (
          sum,
          value
        ) =>

          sum +
          value.ankleY,

        0

      )

      /

      cmjBaselineSamples.length;


    cmjBaselineHipY =

      cmjBaselineSamples.reduce(

        (
          sum,
          value
        ) =>

          sum +
          value.hipY,

        0

      )

      /

      cmjBaselineSamples.length;

  }

}


/* =========================================================
   CMJ - MÁQUINA DE ESTADOS
========================================================= */

function updateCmj(

  flexion,

  points,

  timestamp

) {

  const settings =
    getCmjSettings();


  /* =====================================================
     CALIBRACIÓN
  ===================================================== */

  if (

    cmjBaselineAnkleY ===
    null

    ||

    cmjBaselineHipY ===
    null

  ) {

    stateDisplay.textContent =
      "CALIBRATING";


    statusBox.textContent =
      "Mantente de pie y quieto 1–2 segundos para calibrar CMJ.";


    cmjPreviousFlexion =
      flexion;


    cmjPreviousAnkleY =
      points.ankle.y;


    return;

  }


  /*
    Desplazamiento vertical
    respecto de la posición inicial.

    En pantalla:
    menor Y = mayor altura.
  */

  const ankleLift =

    cmjBaselineAnkleY

    -

    points.ankle.y;


  const hipLift =

    cmjBaselineHipY

    -

    points.hip.y;


  /*
    Threshold adaptado
    al tamaño del video.
  */

  const takeoffThreshold =

    Math.max(

      8,

      canvas.height *
      0.012

    );


  const hipLiftThreshold =

    Math.max(

      10,

      canvas.height *
      0.015

    );


  const landingTolerance =

    Math.max(

      10,

      canvas.height *
      0.018

    );


  /* =====================================================
     READY
  ===================================================== */

  if (
    cmjState ===
    "READY"
  ) {

    if (

      flexion >
      DESCENT_TRIGGER

      &&

      cmjPreviousFlexion !==
      null

      &&

      flexion >
      cmjPreviousFlexion

    ) {

      cmjState =
        "COUNTERMOVEMENT";


      cmjStartTime =
        timestamp;


      cmjMaxFlexion =
        flexion;


      cmjBottomTime =
        timestamp;

    }

  }


  /* =====================================================
     COUNTERMOVEMENT
  ===================================================== */

  else if (

    cmjState ===
    "COUNTERMOVEMENT"

  ) {

    /*
      Máxima flexión.
    */

    if (

      flexion >
      cmjMaxFlexion

    ) {

      cmjMaxFlexion =
        flexion;


      cmjBottomTime =
        timestamp;

    }


    /*
      Cambio descenso → subida.
    */

    if (

      cmjMaxFlexion

      -

      flexion

      >=

      TURNAROUND_DELTA

    ) {

      if (

        cmjMaxFlexion

        >=

        CMJ_MIN_COUNTERMOVEMENT

      ) {

        cmjState =
          "PROPULSION";


        cmjPropulsionStartTime =
          timestamp;

      }

      else {

        cmjState =
          "READY";


        cmjMaxFlexion =
          0;

      }

    }

  }


  /* =====================================================
     PROPULSION
  ===================================================== */

  else if (

    cmjState ===
    "PROPULSION"

  ) {

    const propulsionTime =

      timestamp

      -

      cmjPropulsionStartTime;


    /*
      Aproximación de despegue.

      Exigimos:
      - tobillo elevado
      - cadera elevada
      - rodilla relativamente extendida
      - un mínimo temporal
    */

    const takeoffDetected =

      propulsionTime

      >=

      CMJ_TAKEOFF_MIN_MS

      &&

      ankleLift

      >

      takeoffThreshold

      &&

      hipLift

      >

      hipLiftThreshold

      &&

      flexion

      <

      45;


    if (
      takeoffDetected
    ) {

      cmjTakeoffTime =
        timestamp;


      cmjState =
        "FLIGHT";

    }

  }


  /* =====================================================
     FLIGHT
  ===================================================== */

  else if (

    cmjState ===
    "FLIGHT"

  ) {

    const flightMs =

      timestamp

      -

      cmjTakeoffTime;


    /*
      Tobillo vuelve hacia abajo.
    */

    const ankleReturning =

      cmjPreviousAnkleY !==
      null

      &&

      points.ankle.y

      >

      cmjPreviousAnkleY;


    /*
      Tobillo vuelve aproximadamente
      al nivel inicial.
    */

    const nearBaseline =

      Math.abs(

        points.ankle.y

        -

        cmjBaselineAnkleY

      )

      <=

      landingTolerance;


    /*
      Detectar contacto.
    */

    if (

      flightMs

      >=

      CMJ_MIN_FLIGHT_MS

      &&

      nearBaseline

      &&

      ankleReturning

    ) {

      cmjLandingTime =
        timestamp;


      cmjLandingStartTime =
        timestamp;


      cmjMaxLandingFlexion =
        flexion;


      cmjState =
        "LANDING";

    }


    /*
      Seguridad si algo
      salió mal.
    */

    if (

      flightMs

      >

      CMJ_MAX_FLIGHT_MS

    ) {

      showWarning(
        "Repite el salto"
      );


      beepWarning();


      resetCmjMovementState();

    }

  }


  /* =====================================================
     LANDING
  ===================================================== */

  else if (

    cmjState ===
    "LANDING"

  ) {

    /*
      Buscar máxima flexión
      durante absorción.
    */

    if (

      flexion

      >

      cmjMaxLandingFlexion

    ) {

      cmjMaxLandingFlexion =
        flexion;

    }


    /*
      Registrar durante 450 ms.
    */

    if (

      timestamp

      -

      cmjLandingStartTime

      >=

      CMJ_LANDING_CAPTURE_MS

    ) {

      completeCmjJump();


      if (
        analysisActive
      ) {

        resetCmjMovementState();

      }

    }

  }


  cmjPreviousFlexion =
    flexion;


  cmjPreviousAnkleY =
    points.ankle.y;


  stateDisplay.textContent =
    cmjState;


  repDisplay.textContent =

    `${cmjJumpCount} / ${settings.targetJumps}`;

}


/* =========================================================
   COMPLETAR CMJ
========================================================= */

function completeCmjJump() {

  const settings =
    getCmjSettings();


  cmjJumpCount++;


  /* =====================================================
     TIEMPO DESCENSO
  ===================================================== */

  const descentTime =

    (
      cmjBottomTime

      -

      cmjStartTime
    )

    /

    1000;


  /* =====================================================
     TIEMPO PROPULSIÓN APROX.
  ===================================================== */

  const propulsionTime =

    (
      cmjTakeoffTime

      -

      cmjPropulsionStartTime
    )

    /

    1000;


  /* =====================================================
     TIEMPO DE VUELO
  ===================================================== */

  const flightTime =

    (
      cmjLandingTime

      -

      cmjTakeoffTime
    )

    /

    1000;


  /* =====================================================
     ALTURA ESTIMADA

     h = g × t² / 8
  ===================================================== */

  const estimatedHeightM =

    GRAVITY

    *

    Math.pow(
      flightTime,
      2
    )

    /

    8;


  const estimatedHeightCm =

    estimatedHeightM

    *

    100;


  /* =====================================================
     OBJETIVO ALTURA
  ===================================================== */

  const heightMinimum =

    settings.heightTarget

    -

    settings.heightTolerance;


  const heightPassed =

    estimatedHeightCm

    >=

    heightMinimum;


  /* =====================================================
     OBJETIVO FLEXIÓN
  ===================================================== */

  const kneeMinimum =

    settings.kneeTarget

    -

    settings.kneeTolerance;


  const kneeMaximum =

    settings.kneeTarget

    +

    settings.kneeTolerance;


  const kneePassed =

    cmjMaxFlexion

    >=

    kneeMinimum

    &&

    cmjMaxFlexion

    <=

    kneeMaximum;


  /* =====================================================
     RESULTADO
  ===================================================== */

  let passed =
    true;


  if (

    settings.checkHeight

    &&

    !heightPassed

  ) {

    passed =
      false;

  }


  if (

    (
      settings.checkKnee

      ||

      settings.checkCountermovement
    )

    &&

    !kneePassed

  ) {

    passed =
      false;

  }


  /* =====================================================
     FEEDBACK
  ===================================================== */

  if (passed) {

    cmjSuccessfulJumps++;


    showSuccess();

  }

  else {

    const message =
      buildCmjWarning(

        settings,

        heightPassed,

        kneePassed

      );


    showWarning(
      message
    );


    /*
      Un solo beep
      por salto.
    */

    beepWarning();

  }


  /* =====================================================
     GUARDAR SALTO
  ===================================================== */

  const jump = {

    number:
      cmjJumpCount,


    estimatedHeightCm:
      estimatedHeightCm,


    flightTime:
      flightTime,


    maxFlexion:
      cmjMaxFlexion,


    descentTime:
      descentTime,


    propulsionTime:
      propulsionTime,


    landingFlexion:
      cmjMaxLandingFlexion,


    passed:
      passed

  };


  cmjResults.push(
    jump
  );


  addCmjResultRow(
    jump
  );


  updateCmjSummary();


  /*
    Panel en vivo.

    secondaryMetricLabel =
    Flight time

    tertiaryMetricLabel =
    Height Est.
  */

  eccDisplay.textContent =

    `${flightTime.toFixed(3)} s`;


  conDisplay.textContent =

    `${estimatedHeightCm.toFixed(1)} cm`;


  repDisplay.textContent =

    `${cmjJumpCount} / ${settings.targetJumps}`;


  /* =====================================================
     FIN AUTOMÁTICO
  ===================================================== */

  if (

    cmjJumpCount

    >=

    settings.targetJumps

  ) {

    stopAnalysis(
      true
    );

  }

}


/* =========================================================
   ADVERTENCIA CMJ
========================================================= */

function buildCmjWarning(

  settings,

  heightPassed,

  kneePassed

) {

  /*
    Primero altura.
  */

  if (

    settings.checkHeight

    &&

    !heightPassed

  ) {

    return "Altura objetivo";

  }


  /*
    Después profundidad.
  */

  if (

    (
      settings.checkKnee

      ||

      settings.checkCountermovement
    )

    &&

    !kneePassed

  ) {

    const lower =

      settings.kneeTarget

      -

      settings.kneeTolerance;


    if (

      cmjMaxFlexion

      <

      lower

    ) {

      return "Mayor profundidad";

    }


    return "Menor profundidad";

  }


  return "Revisa salto";

}


/* =========================================================
   REINICIAR ESTADO CMJ
========================================================= */

function resetCmjMovementState() {

  cmjState =
    "READY";


  cmjPreviousFlexion =
    null;


  cmjPreviousAnkleY =
    null;


  cmjMaxFlexion =
    0;


  cmjStartTime =
    0;


  cmjBottomTime =
    0;


  cmjPropulsionStartTime =
    0;


  cmjTakeoffTime =
    0;


  cmjLandingTime =
    0;


  cmjLandingStartTime =
    0;


  cmjMaxLandingFlexion =
    0;

}


/* =========================================================
   FEEDBACK VISUAL
========================================================= */

function showWarning(
  message
) {

  const mode =
    getActiveFeedbackMode();


  if (

    mode !==
    "visual"

    &&

    mode !==
    "both"

  ) {

    return;

  }


  warningBox.textContent =
    message;


  warningBox
    .classList
    .remove("hidden");


  /*
    Reiniciar temporizador.
  */

  if (
    warningHideTimer
  ) {

    clearTimeout(
      warningHideTimer
    );

  }


  warningHideTimer =

    setTimeout(

      hideWarning,

      1500

    );

}


/* =========================================================
   OBJETIVO CUMPLIDO
========================================================= */

function showSuccess() {

  const mode =
    getActiveFeedbackMode();


  /*
    No hacemos sonido
    cuando está correcto.
  */

  if (

    mode ===
    "audio"

    ||

    mode ===
    "off"

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
    Solo un beep por episodio
    de tracking perdido.
  */

  if (

    now

    -

    trackingLostSince

    >

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
    getActiveFeedbackMode();


  if (

    mode !==
    "audio"

    &&

    mode !==
    "both"

  ) {

    return;

  }


  if (
    !audioContext
  ) {

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
    Sonido breve y discreto.
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
   RESULTADOS SENTADILLA
========================================================= */

function addSquatResultRow(
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
    .appendChild(
      row
    );

}


/* =========================================================
   RESUMEN SENTADILLA
========================================================= */

function updateSquatSummary() {

  if (

    squatResults.length ===
    0

  ) {

    summary.innerHTML =
      "No se registraron repeticiones.";

    return;

  }


  const avgFlexion =

    squatResults.reduce(

      (
        sum,
        rep
      ) =>

        sum +
        rep.maxFlexion,

      0

    )

    /

    squatResults.length;


  const avgEcc =

    squatResults.reduce(

      (
        sum,
        rep
      ) =>

        sum +
        rep.eccentric,

      0

    )

    /

    squatResults.length;


  const avgCon =

    squatResults.reduce(

      (
        sum,
        rep
      ) =>

        sum +
        rep.concentric,

      0

    )

    /

    squatResults.length;


  const compliance =

    squatSuccessfulReps

    /

    squatResults.length

    *

    100;


  summary.innerHTML = `

    <strong>
      ${squatResults.length}
    </strong>
    repeticiones realizadas

    <br>

    <strong>
      ${squatSuccessfulReps}
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
   TABLA RESULTADOS CMJ
========================================================= */

function addCmjResultRow(
  jump
) {

  const row =
    document.createElement(
      "tr"
    );


  row.innerHTML = `

    <td>
      ${jump.number}
    </td>

    <td>
      ${jump.estimatedHeightCm.toFixed(1)} cm
    </td>

    <td>
      ${jump.flightTime.toFixed(3)} s
    </td>

    <td>
      ${jump.maxFlexion.toFixed(0)}°
    </td>

    <td>
      ${jump.descentTime.toFixed(2)} s
    </td>

    <td>
      ${jump.landingFlexion.toFixed(0)}°
    </td>

    <td
      class="${
        jump.passed
          ? "pass"
          : "fail"
      }"
    >
      ${
        jump.passed
          ? "✓"
          : "⚠"
      }
    </td>

  `;


  cmjResultsBody
    .appendChild(
      row
    );

}


/* =========================================================
   RESUMEN CMJ
========================================================= */

function updateCmjSummary() {

  if (

    cmjResults.length ===
    0

  ) {

    cmjSummary.innerHTML =
      "No se registraron saltos.";

    return;

  }


  const best =

    Math.max(

      ...cmjResults.map(

        jump =>
          jump.estimatedHeightCm

      )

    );


  const avgHeight =

    cmjResults.reduce(

      (
        sum,
        jump
      ) =>

        sum +
        jump.estimatedHeightCm,

      0

    )

    /

    cmjResults.length;


  const avgFlight =

    cmjResults.reduce(

      (
        sum,
        jump
      ) =>

        sum +
        jump.flightTime,

      0

    )

    /

    cmjResults.length;


  const avgBottom =

    cmjResults.reduce(

      (
        sum,
        jump
      ) =>

        sum +
        jump.maxFlexion,

      0

    )

    /

    cmjResults.length;


  const compliance =

    cmjSuccessfulJumps

    /

    cmjResults.length

    *

    100;


  cmjSummary.innerHTML = `

    <strong>
      ${cmjResults.length}
    </strong>
    saltos registrados

    <br>

    Mejor altura estimada:

    <strong>
      ${best.toFixed(1)} cm
    </strong>

    <br>

    Altura media estimada:

    <strong>
      ${avgHeight.toFixed(1)} cm
    </strong>

    <br>

    Tiempo de vuelo medio:

    <strong>
      ${avgFlight.toFixed(3)} s
    </strong>

    <br>

    Flexión media en el fondo:

    <strong>
      ${avgBottom.toFixed(0)}°
    </strong>

    <br>

    Cumplimiento de objetivos:

    <strong>
      ${compliance.toFixed(0)}%
    </strong>

    <br><br>

    <small>
      Altura estimada mediante tiempo de vuelo con cámara.
      No equivale a una medición con plataforma de fuerza.
    </small>

  `;

}


/* =========================================================
   INICIAR ANÁLISIS
========================================================= */

function startAnalysis() {

  if (!cameraReady) {

    statusBox.textContent =
      "Activa la cámara primero.";

    return;

  }


  /*
    Bloqueamos el lado
    mejor detectado.
  */

  activeSide =
    candidateSide;


  angleBuffer =
    [];


  trackingLostSince =
    null;


  trackingAlertPlayed =
    false;


  hideWarning();


  /* =====================================================
     INICIAR SENTADILLA
  ===================================================== */

  if (

    activeExercise ===
    "squat"

  ) {

    squatRepCount =
      0;


    squatSuccessfulReps =
      0;


    squatResults =
      [];


    resultsBody.innerHTML =
      "";


    summary.innerHTML =
      "Serie en curso...";


    squatState =
      "READY";


    squatMaxFlexion =
      0;


    squatPreviousAngle =
      null;


    const settings =
      getSquatSettings();


    repDisplay.textContent =

      `0 / ${settings.targetReps}`;


    stateDisplay.textContent =
      "READY";


    eccDisplay.textContent =
      "—";


    conDisplay.textContent =
      "—";

  }


  /* =====================================================
     INICIAR CMJ
  ===================================================== */

  else {

    cmjJumpCount =
      0;


    cmjSuccessfulJumps =
      0;


    cmjResults =
      [];


    cmjResultsBody.innerHTML =
      "";


    cmjSummary.innerHTML =
      "Serie en curso...";


    resetCmjMovementState();


    /*
      Nueva calibración
      antes de cada test.
    */

    cmjBaselineSamples =
      [];


    cmjBaselineAnkleY =
      null;


    cmjBaselineHipY =
      null;


    const settings =
      getCmjSettings();


    repDisplay.textContent =

      `0 / ${settings.targetJumps}`;


    stateDisplay.textContent =
      "CALIBRATING";


    eccDisplay.textContent =
      "—";


    conDisplay.textContent =
      "—";

  }


  analysisActive =
    true;


  startButton.disabled =
    true;


  if (

    activeExercise ===
    "cmj"

  ) {

    statusBox.textContent =
      "Análisis CMJ activo · mantente de pie 1–2 segundos antes del primer salto.";

  }

  else {

    statusBox.textContent =
      "Análisis de sentadilla activo";

  }


  /*
    Preparar audio.
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
   FINALIZAR ANÁLISIS
========================================================= */

function stopAnalysis(
  automatic = false
) {

  if (!analysisActive) {

    statusBox.textContent =
      "No hay una serie activa.";

    return;

  }


  analysisActive =
    false;


  startButton.disabled =
    false;


  stateDisplay.textContent =
    "COMPLETE";


  /* =====================================================
     SENTADILLA
  ===================================================== */

  if (

    activeExercise ===
    "squat"

  ) {

    squatState =
      "COMPLETE";


    updateSquatSummary();


    if (automatic) {

      statusBox.textContent =

        `Serie completada · ${squatRepCount} repeticiones`;

    }

    else {

      statusBox.textContent =

        `Serie finalizada · ${squatRepCount} repeticiones`;

    }

  }


  /* =====================================================
     CMJ
  ===================================================== */

  else {

    cmjState =
      "COMPLETE";


    updateCmjSummary();


    if (automatic) {

      statusBox.textContent =

        `Serie completada · ${cmjJumpCount} saltos`;

    }

    else {

      statusBox.textContent =

        `Serie finalizada · ${cmjJumpCount} saltos`;

    }

  }

}


/* =========================================================
   ESTADO INICIAL
========================================================= */

selectExercise(
  "squat"
);
