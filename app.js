/* =========================================================
   KINEMYX Beta 0.6
   Movimientos + Saltos + Feedback + Posicionamiento guiado
   ========================================================= */

const $ = (id) => document.getElementById(id);

const APP_VERSION = "KINEMYX Beta 0.6";
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xljdjgbg";


/* =========================================================
   DOM
========================================================= */

const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const cameraWrapper =
  video.parentElement;

const movementCategoryButton =
  $("movementCategoryButton");

const jumpCategoryButton =
  $("jumpCategoryButton");

const movementExerciseSelector =
  $("movementExerciseSelector");

const jumpExerciseSelector =
  $("jumpExerciseSelector");

const movementSettingsSection =
  $("movementSettingsSection");

const jumpSettingsSection =
  $("jumpSettingsSection");

const movementConfigDetails =
  $("movementConfigDetails");

const jumpConfigDetails =
  $("jumpConfigDetails");

const cameraButton =
  $("cameraButton");

const switchCameraButton =
  $("switchCameraButton");

const startButton =
  $("startButton");

const stopButton =
  $("stopButton");

const liveExerciseLabel =
  $("liveExerciseLabel");

const countLabel =
  $("countLabel");

const primaryMetricLabel =
  $("primaryMetricLabel");

const secondaryMetricLabel =
  $("secondaryMetricLabel");

const tertiaryMetricLabel =
  $("tertiaryMetricLabel");

const repDisplay =
  $("repDisplay");

const angleDisplay =
  $("angleDisplay");

const stateDisplay =
  $("stateDisplay");

const eccDisplay =
  $("eccDisplay");

const conDisplay =
  $("conDisplay");

const sideDisplay =
  $("sideDisplay");

const statusBox =
  $("status");

const warningBox =
  $("warning");

const positionGuide =
  $("positionGuide");

const positionGuideTitle =
  $("positionGuideTitle");

const positionGuideText =
  $("positionGuideText");

const movementResultsSection =
  $("movementResults");

const movementResultsTitle =
  $("movementResultsTitle");

const movementSummary =
  $("movementSummary");

const movementResultsBody =
  $("movementResultsBody");

const movementAngleHeader =
  $("movementAngleHeader");

const jumpResultsSection =
  $("jumpResults");

const jumpResultsTitle =
  $("jumpResultsTitle");

const jumpSummary =
  $("jumpSummary");

const jumpResultsBody =
  $("jumpResultsBody");

const jumpProtocolHeader =
  $("jumpProtocolHeader");

const stepAnalysis =
  $("stepAnalysis");

const stepCamera =
  $("stepCamera");

const stepPosition =
  $("stepPosition");

const stepStart =
  $("stepStart");

const stepAnalysisText =
  $("stepAnalysisText");

const stepCameraText =
  $("stepCameraText");

const stepPositionText =
  $("stepPositionText");

const stepStartText =
  $("stepStartText");

const stepAnalysisStatus =
  $("stepAnalysisStatus");

const stepCameraStatus =
  $("stepCameraStatus");

const stepPositionStatus =
  $("stepPositionStatus");

const stepStartStatus =
  $("stepStartStatus");

const movementAngleName =
  $("movementAngleName");

const movementTargetReps =
  $("movementTargetReps");

const movementAngleTarget =
  $("movementAngleTarget");

const movementAngleTolerance =
  $("movementAngleTolerance");

const movementEccTarget =
  $("movementEccTarget");

const movementEccTolerance =
  $("movementEccTolerance");

const movementConTarget =
  $("movementConTarget");

const movementConTolerance =
  $("movementConTolerance");

const movementFeedbackMode =
  $("movementFeedbackMode");

const movementCheckAngle =
  $("movementCheckAngle");

const movementCheckEcc =
  $("movementCheckEcc");

const movementCheckCon =
  $("movementCheckCon");

const movementCheckAngleText =
  $("movementCheckAngleText");

const jumpTargetJumps =
  $("jumpTargetJumps");

const jumpKneeTarget =
  $("jumpKneeTarget");

const jumpKneeTolerance =
  $("jumpKneeTolerance");

const sjHoldWrap =
  $("sjHoldWrap");

const sjHoldTarget =
  $("sjHoldTarget");

const jumpFeedbackMode =
  $("jumpFeedbackMode");

const jumpCheckFlight =
  $("jumpCheckFlight");

const jumpCheckKnee =
  $("jumpCheckKnee");

const jumpCheckLanding =
  $("jumpCheckLanding");

const jumpProtocolNote =
  $("jumpProtocolNote");

const feedbackForm =
  $("feedbackForm");

const feedbackExercise =
  $("feedbackExercise");

const feedbackProfile =
  $("feedbackProfile");

const feedbackType =
  $("feedbackType");

const feedbackExperience =
  $("feedbackExperience");

const feedbackMessage =
  $("feedbackMessage");

const feedbackContact =
  $("feedbackContact");

const feedbackSubmit =
  $("feedbackSubmit");

const feedbackStatus =
  $("feedbackStatus");


/* =========================================================
   GENERAL STATE
========================================================= */

let detector = null;

let cameraReady = false;
let trackingReady = false;
let analysisActive = false;
let detectionLoopStarted = false;

let lastGoodTrackingAt = 0;
let lastPositionAssessment = null;

let activeCategory =
  "movement";

let activeExercise =
  "squat";

let currentFacingMode =
  "user";

let currentStream =
  null;

let candidateSide =
  "left";

let activeSide =
  "left";

let audioContext =
  null;

let trackingLostSince =
  null;

let trackingAlertPlayed =
  false;

let warningHideTimer =
  null;

let angleBuffer =
  [];


/* =========================================================
   CONSTANTS
========================================================= */

const MIN_CONFIDENCE =
  0.58;

const MIN_POINT_CONFIDENCE =
  0.42;

const TRACKING_HOLD_MS =
  450;

const SMOOTHING_FRAMES =
  5;

const TURNAROUND_DELTA =
  4;

const GRAVITY =
  9.81;

const FRAME_MARGIN_X =
  0.035;

const FRAME_MARGIN_Y =
  0.045;

/*
  Heurística 2D para detectar cuando
  la persona está demasiado frontal.
*/
const FRONTAL_RATIO_THRESHOLD =
  0.58;


/* =========================================================
   EXERCISE METADATA
========================================================= */

const exerciseMeta = {

  squat: {

    category:
      "movement",

    name:
      "Sentadilla",

    live:
      "SQUAT",

    angleName:
      "Flexión de rodilla",

    angleShort:
      "KNEE FLEXION",

    defaultAngle:
      90,

    defaultTolerance:
      5,

    defaultReps:
      8,

    defaultEcc:
      2,

    defaultCon:
      1,

    minDepth:
      45

  },


  deadlift: {

    category:
      "movement",

    name:
      "Peso muerto",

    live:
      "DEADLIFT",

    angleName:
      "Flexión de cadera",

    angleShort:
      "HIP FLEXION",

    defaultAngle:
      65,

    defaultTolerance:
      10,

    defaultReps:
      6,

    defaultEcc:
      2,

    defaultCon:
      1,

    floorFlexion:
      45

  },


  bench: {

    category:
      "movement",

    name:
      "Press banca",

    live:
      "BENCH PRESS",

    angleName:
      "Flexión de codo",

    angleShort:
      "ELBOW FLEXION",

    defaultAngle:
      90,

    defaultTolerance:
      10,

    defaultReps:
      8,

    defaultEcc:
      2,

    defaultCon:
      1,

    minDepth:
      55

  },


  sj: {

    category:
      "jump",

    name:
      "Squat Jump",

    live:
      "SQUAT JUMP"

  },


  cmj: {

    category:
      "jump",

    name:
      "CMJ",

    live:
      "CMJ"

  },


  abalakov: {

    category:
      "jump",

    name:
      "Abalakov",

    live:
      "ABALAKOV"

  }

};


/* =========================================================
   MOVEMENT STATE
========================================================= */

let movementRepCount =
  0;

let movementSuccessfulReps =
  0;

let movementState =
  "READY";

let movementMaxAngle =
  0;

let movementRepStartTime =
  0;

let movementBottomTime =
  0;

let movementAscentStartTime =
  0;

let movementPreviousAngle =
  null;

let movementResults =
  [];

let deadliftEccentricForNextRep =
  null;

let deadliftDescentStartTime =
  0;


/* =========================================================
   JUMP STATE
========================================================= */

let jumpCount =
  0;

let jumpValidCount =
  0;

let jumpState =
  "CALIBRATING";

let jumpPreviousFlexion =
  null;

let jumpPreviousAnkleY =
  null;

let jumpMaxFlexion =
  0;

let jumpStartTime =
  0;

let jumpBottomTime =
  0;

let jumpPropulsionStartTime =
  0;

let jumpTakeoffTime =
  0;

let jumpLandingTime =
  0;

let jumpLandingStartTime =
  0;

let jumpMaxLandingFlexion =
  0;

let jumpResults =
  [];

let jumpBaselineAnkleY =
  null;

let jumpBaselineSamples =
  [];

let sjHoldStartTime =
  0;

let sjHeldFlexion =
  null;

let sjProtocolInvalid =
  false;


const JUMP_READY_FLEXION =
  20;

const JUMP_DESCENT_TRIGGER =
  25;

const CMJ_MIN_COUNTERMOVEMENT =
  35;

const JUMP_TAKEOFF_MIN_MS =
  70;

const JUMP_MIN_FLIGHT_MS =
  120;

const JUMP_MAX_FLIGHT_MS =
  1300;

const JUMP_LANDING_CAPTURE_MS =
  420;

const SJ_COUNTERMOVEMENT_ALLOWANCE =
  6;


/* =========================================================
   SETTINGS
========================================================= */

function getMovementSettings() {

  return {

    targetReps:
      Math.max(
        1,
        Number(
          movementTargetReps.value
        ) || 1
      ),

    angleTarget:
      Number(
        movementAngleTarget.value
      ) || 0,

    angleTolerance:
      Math.max(
        0,
        Number(
          movementAngleTolerance.value
        ) || 0
      ),

    eccTarget:
      Math.max(
        0,
        Number(
          movementEccTarget.value
        ) || 0
      ),

    eccTolerance:
      Math.max(
        0,
        Number(
          movementEccTolerance.value
        ) || 0
      ),

    conTarget:
      Math.max(
        0,
        Number(
          movementConTarget.value
        ) || 0
      ),

    conTolerance:
      Math.max(
        0,
        Number(
          movementConTolerance.value
        ) || 0
      ),

    feedbackMode:
      movementFeedbackMode.value,

    checkAngle:
      movementCheckAngle.checked,

    checkEcc:
      movementCheckEcc.checked,

    checkCon:
      movementCheckCon.checked

  };

}


function getJumpSettings() {

  return {

    targetJumps:
      Math.max(
        1,
        Number(
          jumpTargetJumps.value
        ) || 1
      ),

    kneeTarget:
      Number(
        jumpKneeTarget.value
      ) || 90,

    kneeTolerance:
      Math.max(
        0,
        Number(
          jumpKneeTolerance.value
        ) || 0
      ),

    holdTarget:
      Math.max(
        0.3,
        Number(
          sjHoldTarget.value
        ) || 1
      ),

    feedbackMode:
      jumpFeedbackMode.value,

    checkFlight:
      jumpCheckFlight.checked,

    checkKnee:
      jumpCheckKnee.checked,

    checkLanding:
      jumpCheckLanding.checked

  };

}


function getActiveFeedbackMode() {

  return activeCategory === "movement"

    ? getMovementSettings().feedbackMode

    : getJumpSettings().feedbackMode;

}


/* =========================================================
   SETUP FLOW
========================================================= */

function setStep(
  element,
  textElement,
  statusElement,
  state,
  text,
  status
) {

  element.classList.remove(
    "done",
    "active",
    "pending",
    "warning-step"
  );

  element.classList.add(
    state
  );

  textElement.textContent =
    text;

  statusElement.textContent =
    status;

}


function updateSetupFlow() {

  const name =
    exerciseMeta[
      activeExercise
    ].name;


  setStep(

    stepAnalysis,

    stepAnalysisText,

    stepAnalysisStatus,

    "done",

    `${name} seleccionado`,

    "✓"

  );


  if (!cameraReady) {

    setStep(
      stepCamera,
      stepCameraText,
      stepCameraStatus,
      "active",
      "Activa la cámara",
      "2"
    );

    setStep(
      stepPosition,
      stepPositionText,
      stepPositionStatus,
      "pending",
      "Esperando cámara",
      "3"
    );

    setStep(
      stepStart,
      stepStartText,
      stepStartStatus,
      "pending",
      "Completa los pasos",
      "4"
    );

    startButton.disabled =
      true;

    return;

  }


  setStep(

    stepCamera,

    stepCameraText,

    stepCameraStatus,

    "done",

    currentFacingMode === "user"
      ? "Cámara frontal activa"
      : "Cámara trasera activa",

    "✓"

  );


  if (!trackingReady) {

    const shortText =
      lastPositionAssessment?.short
      ||
      "Ajusta posición";


    setStep(

      stepPosition,

      stepPositionText,

      stepPositionStatus,

      analysisActive
        ? "warning-step"
        : "active",

      shortText,

      "!"

    );


    setStep(

      stepStart,

      stepStartText,

      stepStartStatus,

      analysisActive
        ? "done"
        : "pending",

      analysisActive
        ? "Serie en curso"
        : "Esperando posición",

      analysisActive
        ? "●"
        : "4"

    );


    if (!analysisActive) {

      startButton.disabled =
        true;

    }

    return;

  }


  setStep(

    stepPosition,

    stepPositionText,

    stepPositionStatus,

    "done",

    "Posición correcta",

    "✓"

  );


  if (analysisActive) {

    setStep(
      stepStart,
      stepStartText,
      stepStartStatus,
      "done",
      "Serie en curso",
      "●"
    );

    startButton.disabled =
      true;

  }

  else {

    setStep(
      stepStart,
      stepStartText,
      stepStartStatus,
      "active",
      "Listo para iniciar",
      "4"
    );

    startButton.disabled =
      false;

  }

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

movementCategoryButton
  .addEventListener(
    "click",
    () =>
      selectCategory(
        "movement"
      )
  );


jumpCategoryButton
  .addEventListener(
    "click",
    () =>
      selectCategory(
        "jump"
      )
  );


document
  .querySelectorAll(
    "[data-exercise]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () =>
          selectExercise(
            button.dataset.exercise
          )
      );

    }
  );


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
      stopAnalysis(
        false
      )
  );


window.addEventListener(
  "resize",
  syncCanvasToVideoFrame
);


window.addEventListener(
  "orientationchange",
  () =>
    setTimeout(
      syncCanvasToVideoFrame,
      250
    )
);


if (
  "ResizeObserver"
  in window
) {

  const resizeObserver =
    new ResizeObserver(
      () =>
        syncCanvasToVideoFrame()
    );


  resizeObserver.observe(
    cameraWrapper
  );

}


/* =========================================================
   CATEGORY
========================================================= */

function selectCategory(
  category
) {

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de categoría.";

    return;

  }


  activeCategory =
    category;


  const isMovement =
    category ===
    "movement";


  movementCategoryButton
    .classList
    .toggle(
      "secondary",
      !isMovement
    );


  jumpCategoryButton
    .classList
    .toggle(
      "secondary",
      isMovement
    );


  movementExerciseSelector
    .classList
    .toggle(
      "hidden",
      !isMovement
    );


  jumpExerciseSelector
    .classList
    .toggle(
      "hidden",
      isMovement
    );


  selectExercise(

    isMovement
      ? "squat"
      : "cmj"

  );

}


/* =========================================================
   SELECT EXERCISE
========================================================= */

function selectExercise(
  exercise
) {

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de análisis.";

    return;

  }


  activeExercise =
    exercise;


  activeCategory =
    exerciseMeta[
      exercise
    ].category;


  angleBuffer =
    [];


  trackingReady =
    false;


  lastGoodTrackingAt =
    0;


  lastPositionAssessment =
    null;


  hideWarning();
  hidePositionGuide();


  movementConfigDetails.open =
    false;


  jumpConfigDetails.open =
    false;


  document
    .querySelectorAll(
      "[data-exercise]"
    )
    .forEach(
      (button) => {

        button.classList.toggle(

          "secondary",

          button.dataset.exercise
          !==
          exercise

        );

      }
    );


  const isMovement =
    activeCategory ===
    "movement";


  movementSettingsSection
    .classList
    .toggle(
      "hidden",
      !isMovement
    );


  jumpSettingsSection
    .classList
    .toggle(
      "hidden",
      isMovement
    );


  movementResultsSection
    .classList
    .toggle(
      "hidden",
      !isMovement
    );


  jumpResultsSection
    .classList
    .toggle(
      "hidden",
      isMovement
    );


  if (isMovement) {

    configureMovementUI(
      exercise
    );

  }

  else {

    configureJumpUI(
      exercise
    );

  }


  updateFeedbackContext();


  statusBox.textContent =
    cameraReady

      ? "Ubícate según la guía hasta completar la posición."

      : "Activa la cámara";


  updateSetupFlow();

}


/* =========================================================
   MOVEMENT UI
========================================================= */

function configureMovementUI(
  exercise
) {

  const meta =
    exerciseMeta[
      exercise
    ];


  liveExerciseLabel.textContent =
    meta.live;


  countLabel.textContent =
    "REP";


  primaryMetricLabel.textContent =
    meta.angleShort;


  secondaryMetricLabel.textContent =
    "ECCENTRIC";


  tertiaryMetricLabel.textContent =
    "CONCENTRIC";


  movementAngleName.textContent =
    `${meta.angleName} objetivo`;


  movementCheckAngleText.textContent =
    meta.angleName;


  movementAngleHeader.textContent =
    meta.angleName;


  movementResultsTitle.textContent =
    meta.name;


  movementTargetReps.value =
    meta.defaultReps;


  movementAngleTarget.value =
    meta.defaultAngle;


  movementAngleTolerance.value =
    meta.defaultTolerance;


  movementEccTarget.value =
    meta.defaultEcc;


  movementConTarget.value =
    meta.defaultCon;


  repDisplay.textContent =
    `0 / ${meta.defaultReps}`;


  angleDisplay.textContent =
    "—°";


  stateDisplay.textContent =
    activeExercise ===
    "deadlift"

      ? "WAIT_FLOOR"

      : "READY";


  eccDisplay.textContent =
    "—";


  conDisplay.textContent =
    "—";


  movementResultsBody.innerHTML =
    "";


  movementSummary.textContent =
    "Aún no hay resultados.";

}


/* =========================================================
   JUMP UI
========================================================= */

function configureJumpUI(
  exercise
) {

  const meta =
    exerciseMeta[
      exercise
    ];


  liveExerciseLabel.textContent =
    meta.live;


  countLabel.textContent =
    "JUMP";


  primaryMetricLabel.textContent =
    "KNEE FLEXION";


  secondaryMetricLabel.textContent =
    "FLIGHT TIME";


  tertiaryMetricLabel.textContent =
    "HEIGHT EST.";


  jumpResultsTitle.textContent =
    meta.name;


  repDisplay.textContent =
    `0 / ${
      Math.max(
        1,
        Number(
          jumpTargetJumps.value
        ) || 3
      )
    }`;


  angleDisplay.textContent =
    "—°";


  stateDisplay.textContent =
    exercise === "sj"

      ? "START POSITION"

      : "READY";


  eccDisplay.textContent =
    "—";


  conDisplay.textContent =
    "—";


  sjHoldWrap
    .classList
    .toggle(
      "hidden",
      exercise !== "sj"
    );


  jumpCheckKnee.checked =
    exercise === "sj";


  if (
    exercise ===
    "sj"
  ) {

    jumpProtocolHeader.textContent =
      "Protocolo";


    jumpProtocolNote.textContent =
      "Squat Jump: parte desde la posición objetivo, mantén la pausa y despega sin countermovement. Manos en cadera.";

  }

  else if (
    exercise ===
    "cmj"
  ) {

    jumpProtocolHeader.textContent =
      "Descenso";


    jumpProtocolNote.textContent =
      "CMJ: inicia de pie, manos en cadera, realiza un countermovement y salta verticalmente.";

  }

  else {

    jumpProtocolHeader.textContent =
      "Descenso";


    jumpProtocolNote.textContent =
      "Abalakov: inicia de pie y utiliza libremente el movimiento de brazos durante el salto.";

  }


  jumpResultsBody.innerHTML =
    "";


  jumpSummary.textContent =
    "Aún no hay resultados.";

}


/* =========================================================
   CAMERA
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

    console.warn(
      "Cámara exacta no disponible. Probando modo ideal.",
      error
    );


    return navigator
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
   CANVAS / VIDEO ALIGNMENT
========================================================= */

function syncCanvasToVideoFrame() {

  if (
    !video.videoWidth
    ||
    !video.videoHeight
    ||
    !cameraWrapper
  ) {

    return;

  }


  const boxWidth =
    cameraWrapper.clientWidth;


  const boxHeight =
    cameraWrapper.clientHeight;


  if (
    !boxWidth
    ||
    !boxHeight
  ) {

    return;

  }


  const videoRatio =
    video.videoWidth
    /
    video.videoHeight;


  const boxRatio =
    boxWidth
    /
    boxHeight;


  let drawWidth;
  let drawHeight;


  /*
    El video usa object-fit: contain.

    Por eso calculamos la zona REAL
    donde se está mostrando la imagen.
  */

  if (
    videoRatio >
    boxRatio
  ) {

    drawWidth =
      boxWidth;


    drawHeight =
      boxWidth
      /
      videoRatio;

  }

  else {

    drawHeight =
      boxHeight;


    drawWidth =
      boxHeight
      *
      videoRatio;

  }


  const left =
    (
      boxWidth -
      drawWidth
    )
    /
    2;


  const top =
    (
      boxHeight -
      drawHeight
    )
    /
    2;


  canvas.width =
    video.videoWidth;


  canvas.height =
    video.videoHeight;


  canvas.style.left =
    `${left}px`;


  canvas.style.top =
    `${top}px`;


  canvas.style.width =
    `${drawWidth}px`;


  canvas.style.height =
    `${drawHeight}px`;


  canvas.style.right =
    "auto";


  canvas.style.bottom =
    "auto";

}


/* =========================================================
   MOVENET
========================================================= */

async function loadMoveNet() {

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
   INITIALIZE CAMERA
========================================================= */

async function initializeCamera() {

  try {

    statusBox.textContent =
      "Cargando KINEMYX...";


    await loadMoveNet();


    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );


      currentStream =
        null;

    }


    cameraReady =
      false;


    trackingReady =
      false;


    lastPositionAssessment =
      null;


    hidePositionGuide();


    updateSetupFlow();


    currentStream =
      await getCameraStream();


    video.srcObject =
      currentStream;


    await new Promise(
      (resolve) => {

        video.onloadedmetadata =
          async () => {

            await video.play();


            syncCanvasToVideoFrame();


            resolve();

          };

      }
    );


    cameraReady =
      true;


    if (
      currentFacingMode ===
      "user"
    ) {

      statusBox.textContent =
        "Cámara frontal activa · ubícate de lado y deja visible el segmento completo.";


      switchCameraButton.textContent =
        "Usar cámara trasera";

    }

    else {

      statusBox.textContent =
        "Cámara trasera activa · ubícate de lado y deja visible el segmento completo.";


      switchCameraButton.textContent =
        "Usar cámara frontal";

    }


    updateSetupFlow();


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


    trackingReady =
      false;


    statusBox.textContent =
      "No fue posible iniciar la cámara.";


    updateSetupFlow();


    return false;

  }

}


/* =========================================================
   SWITCH CAMERA
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
    currentFacingMode === "user"

      ? "environment"

      : "user";


  trackingReady =
    false;


  lastPositionAssessment =
    null;


  updateSetupFlow();


  if (
    !(await initializeCamera())
  ) {

    currentFacingMode =
      previousMode;


    await initializeCamera();

  }

}


/* =========================================================
   DETECTION LOOP
========================================================= */

async function detectLoop() {

  if (
    !cameraReady
    ||
    !detector
    ||
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
      poses.length > 0
    ) {

      drawSkeleton(
        poses[0]
      );


      processPose(
        poses[0]
      );

    }

    else {

      handleMissingPose();

    }

  }

  catch (error) {

    console.warn(
      "Error temporal MoveNet:",
      error
    );

  }


  requestAnimationFrame(
    detectLoop
  );

}


/* =========================================================
   SIDE DATA
========================================================= */

function sideData(
  pose,
  side
) {

  const kp =
    pose.keypoints;


  if (
    side === "left"
  ) {

    return {

      shoulder:
        kp[5],

      elbow:
        kp[7],

      wrist:
        kp[9],

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

    elbow:
      kp[8],

    wrist:
      kp[10],

    hip:
      kp[12],

    knee:
      kp[14],

    ankle:
      kp[16]

  };

}


const pointLabels = {

  shoulder:
    "hombro",

  elbow:
    "codo",

  wrist:
    "muñeca",

  hip:
    "cadera",

  knee:
    "rodilla",

  ankle:
    "tobillo"

};


/* =========================================================
   REQUIRED POINTS
========================================================= */

function requiredPointEntries(
  points
) {

  if (
    activeExercise ===
    "bench"
  ) {

    return [

      [
        "shoulder",
        points.shoulder
      ],

      [
        "elbow",
        points.elbow
      ],

      [
        "wrist",
        points.wrist
      ]

    ];

  }


  if (
    activeExercise ===
    "deadlift"
  ) {

    return [

      [
        "shoulder",
        points.shoulder
      ],

      [
        "hip",
        points.hip
      ],

      [
        "knee",
        points.knee
      ]

    ];

  }


  return [

    [
      "shoulder",
      points.shoulder
    ],

    [
      "hip",
      points.hip
    ],

    [
      "knee",
      points.knee
    ],

    [
      "ankle",
      points.ankle
    ]

  ];

}


function requiredPoints(
  points
) {

  return requiredPointEntries(
    points
  )
    .map(
      (
        [, point]
      ) =>
        point
    );

}


/* =========================================================
   CONFIDENCE
========================================================= */

function averageConfidence(
  points
) {

  const required =
    requiredPoints(
      points
    );


  return required.reduce(

    (
      sum,
      point
    ) =>
      sum +
      point.score,

    0

  )

  /

  required.length;

}


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


  return averageConfidence(
    left
  )

  >=

  averageConfidence(
    right
  )

    ? "left"

    : "right";

}


function hasEnoughTracking(
  points
) {

  const required =
    requiredPoints(
      points
    );


  return (

    required.every(

      (point) =>
        point.score
        >=
        MIN_POINT_CONFIDENCE

    )

    &&

    averageConfidence(
      points
    )
    >=
    MIN_CONFIDENCE

  );

}


/* =========================================================
   GEOMETRY HELPERS
========================================================= */

function distance(
  a,
  b
) {

  return Math.hypot(

    a.x -
    b.x,

    a.y -
    b.y

  );

}


function capitalize(
  text
) {

  return text
    .charAt(
      0
    )
    .toUpperCase()
    +
    text.slice(
      1
    );

}


/* =========================================================
   POSITION QUALITY
========================================================= */

function isLikelyFrontal(
  pose
) {

  const kp =
    pose.keypoints;


  const leftShoulder =
    kp[5];


  const rightShoulder =
    kp[6];


  const leftHip =
    kp[11];


  const rightHip =
    kp[12];


  const visible = [

    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip

  ].every(

    (point) =>
      point
      &&
      point.score
      >=
      0.35

  );


  if (!visible) {

    return false;

  }


  const shoulderWidth =
    distance(
      leftShoulder,
      rightShoulder
    );


  const hipWidth =
    distance(
      leftHip,
      rightHip
    );


  const leftTorso =
    distance(
      leftShoulder,
      leftHip
    );


  const rightTorso =
    distance(
      rightShoulder,
      rightHip
    );


  const torsoHeight =
    (
      leftTorso
      +
      rightTorso
    )
    /
    2;


  if (!torsoHeight) {

    return false;

  }


  const bodyWidth =
    (
      shoulderWidth
      +
      hipWidth
    )
    /
    2;


  return (

    bodyWidth
    /
    torsoHeight

    >

    FRONTAL_RATIO_THRESHOLD

  );

}


/* =========================================================
   MISSING POINT DETECTION
========================================================= */

function buildMissingPointAssessment(
  points
) {

  const missing =
    requiredPointEntries(
      points
    )

      .filter(
        (
          [, point]
        ) =>
          !point
          ||
          point.score
          <
          MIN_POINT_CONFIDENCE
      )

      .map(
        (
          [name]
        ) =>
          pointLabels[
            name
          ]
      );


  if (
    !missing.length
  ) {

    return null;

  }


  const main =
    missing[0];


  let correction =
    "Muévete un poco y asegúrate de que el segmento quede completamente visible.";


  if (
    main === "tobillo"
    ||
    main === "rodilla"
  ) {

    correction =
      "Aléjate de la cámara hasta que la pierna y el pie completos queden dentro de la imagen.";

  }

  else if (
    main === "hombro"
    ||
    main === "codo"
    ||
    main === "muñeca"
  ) {

    correction =
      "Ajusta el encuadre para que todo el brazo del lado analizado quede visible.";

  }

  else if (
    main === "cadera"
  ) {

    correction =
      "Evita que ropa, muebles o implementos tapen la cadera y aléjate un poco si está fuera de cuadro.";

  }


  return {

    ready:
      false,

    type:
      "missing",

    short:
      `Falta ${main}`,

    title:
      `Falta detectar ${main}`,

    text:
      correction

  };

}


/* =========================================================
   EDGE DETECTION
========================================================= */

function buildEdgeAssessment(
  points
) {

  if (
    !video.videoWidth
    ||
    !video.videoHeight
  ) {

    return null;

  }


  const marginX =
    video.videoWidth
    *
    FRAME_MARGIN_X;


  const marginY =
    video.videoHeight
    *
    FRAME_MARGIN_Y;


  const entries =
    requiredPointEntries(
      points
    )
      .filter(
        (
          [, point]
        ) =>
          point.score
          >=
          MIN_POINT_CONFIDENCE
      );


  for (
    const [
      name,
      point
    ]
    of entries
  ) {


    if (
      point.y
      >
      video.videoHeight
      -
      marginY
    ) {

      return {

        ready:
          false,

        type:
          "edge",

        short:
          `${capitalize(pointLabels[name])} muy abajo`,

        title:
          `${capitalize(pointLabels[name])} demasiado cerca del borde`,

        text:
          "Aléjate de la cámara o inclínala ligeramente hacia abajo hasta dejar más margen alrededor del segmento."

      };

    }


    if (
      point.y
      <
      marginY
    ) {

      return {

        ready:
          false,

        type:
          "edge",

        short:
          `${capitalize(pointLabels[name])} muy arriba`,

        title:
          `${capitalize(pointLabels[name])} demasiado cerca del borde`,

        text:
          "Aléjate de la cámara o reajusta su altura para dejar más espacio dentro de la imagen."

      };

    }


    if (
      point.x
      <
      marginX

      ||

      point.x
      >
      video.videoWidth
      -
      marginX
    ) {

      return {

        ready:
          false,

        type:
          "edge",

        short:
          "Muévete al centro",

        title:
          "Segmento demasiado cerca del borde",

        text:
          "Muévete hacia el centro de la imagen para evitar que el cuerpo salga del encuadre durante el movimiento."

      };

    }

  }


  return null;

}


/* =========================================================
   COMPLETE POSITION ASSESSMENT
========================================================= */

function assessPosition(
  pose,
  side
) {

  const points =
    sideData(
      pose,
      side
    );


  const missingAssessment =
    buildMissingPointAssessment(
      points
    );


  if (
    missingAssessment
  ) {

    return missingAssessment;

  }


  if (
    !hasEnoughTracking(
      points
    )
  ) {

    return {

      ready:
        false,

      type:
        "confidence",

      short:
        "Mejora visibilidad",

      title:
        "Tracking inestable",

      text:
        "Mejora la iluminación, evita ropa u objetos que oculten las articulaciones y mantén el cuerpo claramente visible."

    };

  }


  const edgeAssessment =
    buildEdgeAssessment(
      points
    );


  if (
    edgeAssessment
  ) {

    return edgeAssessment;

  }


  if (
    isLikelyFrontal(
      pose
    )
  ) {

    return {

      ready:
        false,

      type:
        "orientation",

      short:
        "Gira de lado",

      title:
        "Gira hacia una vista lateral",

      text:
        "Colócate de perfil respecto al teléfono. KINEMYX mide estos ángulos en 2D y necesita una vista lateral estable."

    };

  }


  return {

    ready:
      true,

    type:
      "ready",

    short:
      "Posición correcta",

    title:
      "Posición correcta",

    text:
      "Tracking estable. Mantén esta ubicación durante toda la evaluación."

  };

}


/* =========================================================
   POSITION GUIDE
========================================================= */

function showPositionGuide(
  assessment
) {

  if (
    !assessment
    ||
    !positionGuide
  ) {

    return;

  }


  positionGuideTitle.textContent =
    assessment.title;


  positionGuideText.textContent =
    assessment.text;


  positionGuide.classList.remove(
    "hidden",
    "ready-guide"
  );


  if (
    assessment.ready
  ) {

    positionGuide.classList.add(
      "ready-guide"
    );

  }

}


function hidePositionGuide() {

  if (
    !positionGuide
  ) {

    return;

  }


  positionGuide
    .classList
    .add(
      "hidden"
    );


  positionGuide
    .classList
    .remove(
      "ready-guide"
    );

}


/* =========================================================
   TRACKING
========================================================= */

function updateTrackingState(
  positionReady
) {

  const now =
    performance.now();


  if (
    positionReady
  ) {

    lastGoodTrackingAt =
      now;


    if (
      !trackingReady
    ) {

      trackingReady =
        true;


      updateSetupFlow();

    }


    return;

  }


  if (

    now -
    lastGoodTrackingAt

    >

    TRACKING_HOLD_MS

    &&

    trackingReady

  ) {

    trackingReady =
      false;


    updateSetupFlow();

  }

}


function handleMissingPose() {

  lastPositionAssessment = {

    ready:
      false,

    type:
      "pose",

    short:
      "No te detecto",

    title:
      "No se detecta el cuerpo",

    text:
      "Entra completamente en la imagen, mejora la iluminación y evita quedar demasiado cerca de la cámara."

  };


  showPositionGuide(
    lastPositionAssessment
  );


  updateTrackingState(
    false
  );


  updateSetupFlow();


  if (
    analysisActive
  ) {

    trackingWarning(
      lastPositionAssessment.short
    );

  }

}


/* =========================================================
   ANGLES
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


function flexionFromAngle(
  a,
  b,
  c
) {

  return Math.max(

    0,

    Math.min(

      170,

      180
      -
      calculateAngle(
        a,
        b,
        c
      )

    )

  );

}


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


  return angleBuffer.reduce(

    (
      sum,
      value
    ) =>
      sum
      +
      value,

    0

  )

  /

  angleBuffer.length;

}


function getPrimaryAngle(
  points
) {

  if (
    activeExercise ===
    "bench"
  ) {

    return flexionFromAngle(

      points.shoulder,
      points.elbow,
      points.wrist

    );

  }


  if (
    activeExercise ===
    "deadlift"
  ) {

    return flexionFromAngle(

      points.shoulder,
      points.hip,
      points.knee

    );

  }


  return flexionFromAngle(

    points.hip,
    points.knee,
    points.ankle

  );

}


/* =========================================================
   PROCESS POSE
========================================================= */

function processPose(
  pose
) {

  candidateSide =
    determineBestSide(
      pose
    );


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


  const assessment =
    assessPosition(
      pose,
      side
    );


  lastPositionAssessment =
    assessment;


  showPositionGuide(
    assessment
  );


  updateTrackingState(
    assessment.ready
  );


  updateSetupFlow();


  if (
    !assessment.ready
  ) {

    angleDisplay.textContent =
      "—";


    if (
      analysisActive
    ) {

      trackingWarning(
        assessment.short
      );

    }


    return;

  }


  trackingLostSince =
    null;


  trackingAlertPlayed =
    false;


  if (
    warningBox.dataset.positionWarning
    ===
    "true"
  ) {

    hideWarning();

  }


  const primaryAngle =
    smoothAngle(

      getPrimaryAngle(
        points
      )

    );


  angleDisplay.textContent =
    `${primaryAngle.toFixed(0)}°`;


  if (
    !analysisActive
  ) {

    return;

  }


  if (
    activeCategory ===
    "movement"
  ) {

    if (
      activeExercise ===
      "deadlift"
    ) {

      updateDeadlift(

        primaryAngle,

        performance.now()

      );

    }

    else {

      updateStandardMovement(

        primaryAngle,

        performance.now()

      );

    }

  }

  else {

    updateJump(

      primaryAngle,

      points,

      performance.now()

    );

  }

}


/* =========================================================
   STANDARD MOVEMENT
========================================================= */

function updateStandardMovement(
  angle,
  timestamp
) {

  const settings =
    getMovementSettings();


  const isBench =
    activeExercise ===
    "bench";


  const readyAngle =
    isBench
      ? 25
      : 20;


  const triggerAngle =
    isBench
      ? 30
      : 25;


  const minDepth =
    exerciseMeta[
      activeExercise
    ].minDepth;


  if (
    movementState ===
    "READY"
  ) {

    if (

      angle >
      triggerAngle

      &&

      movementPreviousAngle !==
      null

      &&

      angle >
      movementPreviousAngle

    ) {

      movementState =
        "DESCENDING";


      movementRepStartTime =
        timestamp;


      movementMaxAngle =
        angle;


      movementBottomTime =
        timestamp;

    }

  }


  else if (
    movementState ===
    "DESCENDING"
  ) {

    if (
      angle >
      movementMaxAngle
    ) {

      movementMaxAngle =
        angle;


      movementBottomTime =
        timestamp;

    }


    if (

      movementMaxAngle
      -
      angle

      >=
      TURNAROUND_DELTA

    ) {

      if (
        movementMaxAngle
        >=
        minDepth
      ) {

        movementState =
          "ASCENDING";


        movementAscentStartTime =
          timestamp;

      }

      else {

        movementState =
          "READY";


        movementMaxAngle =
          0;

      }

    }

  }


  else if (
    movementState ===
    "ASCENDING"
  ) {

    if (
      angle <=
      readyAngle
    ) {

      completeMovementRep(

        (
          movementBottomTime
          -
          movementRepStartTime
        )
        /
        1000,

        (
          timestamp
          -
          movementAscentStartTime
        )
        /
        1000

      );


      if (
        analysisActive
      ) {

        movementState =
          "READY";


        movementMaxAngle =
          0;

      }

    }

  }


  movementPreviousAngle =
    angle;


  stateDisplay.textContent =
    movementState;


  repDisplay.textContent =
    `${movementRepCount} / ${settings.targetReps}`;

}


/* =========================================================
   DEADLIFT
========================================================= */

function updateDeadlift(
  angle,
  timestamp
) {

  const settings =
    getMovementSettings();


  const floorFlexion =
    exerciseMeta
      .deadlift
      .floorFlexion;


  if (
    movementState ===
    "WAIT_FLOOR"
  ) {

    if (
      angle >=
      floorFlexion
    ) {

      movementState =
        "FLOOR READY";


      movementMaxAngle =
        angle;


      movementPreviousAngle =
        angle;

    }

  }


  else if (
    movementState ===
    "FLOOR READY"
  ) {

    if (
      angle >
      movementMaxAngle
    ) {

      movementMaxAngle =
        angle;

    }


    if (

      movementPreviousAngle
      !==
      null

      &&

      movementPreviousAngle
      -
      angle

      >=
      2.5

    ) {

      movementState =
        "ASCENDING";


      movementAscentStartTime =
        timestamp;

    }

  }


  else if (
    movementState ===
    "ASCENDING"
  ) {

    if (
      angle <=
      20
    ) {

      const concentric =
        (
          timestamp
          -
          movementAscentStartTime
        )
        /
        1000;


      completeMovementRep(

        deadliftEccentricForNextRep,

        concentric

      );


      if (
        analysisActive
      ) {

        movementState =
          "TOP";


        movementMaxAngle =
          0;

      }

    }

  }


  else if (
    movementState ===
    "TOP"
  ) {

    if (
      angle >
      25
    ) {

      movementState =
        "DESCENDING";


      deadliftDescentStartTime =
        timestamp;

    }

  }


  else if (
    movementState ===
    "DESCENDING"
  ) {

    if (
      angle >=
      floorFlexion
    ) {

      deadliftEccentricForNextRep =
        (
          timestamp
          -
          deadliftDescentStartTime
        )
        /
        1000;


      movementState =
        "FLOOR READY";


      movementMaxAngle =
        angle;

    }

  }


  movementPreviousAngle =
    angle;


  stateDisplay.textContent =
    movementState;


  repDisplay.textContent =
    `${movementRepCount} / ${settings.targetReps}`;

}


/* =========================================================
   COMPLETE MOVEMENT REP
========================================================= */

function completeMovementRep(
  eccentric,
  concentric
) {

  const settings =
    getMovementSettings();


  movementRepCount++;


  const angleValue =
    movementMaxAngle;


  const anglePassed =

    angleValue

    >=

    settings.angleTarget
    -
    settings.angleTolerance;


  const eccAvailable =
    Number.isFinite(
      eccentric
    );


  const eccPassed =

    !eccAvailable

    ||

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
    settings.checkAngle
    &&
    !anglePassed
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


  if (
    passed
  ) {

    movementSuccessfulReps++;


    showSuccess();

  }

  else {

    showWarning(

      buildMovementWarning(

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

    number:
      movementRepCount,

    angle:
      angleValue,

    eccentric:
      eccAvailable
        ? eccentric
        : null,

    concentric:
      concentric,

    passed:
      passed

  };


  movementResults.push(
    rep
  );


  addMovementResultRow(
    rep
  );


  updateMovementSummary();


  eccDisplay.textContent =
    eccAvailable

      ? `${eccentric.toFixed(2)} s`

      : "—";


  conDisplay.textContent =
    `${concentric.toFixed(2)} s`;


  repDisplay.textContent =
    `${movementRepCount} / ${settings.targetReps}`;


  if (
    movementRepCount
    >=
    settings.targetReps
  ) {

    stopAnalysis(
      true
    );

  }

}


/* =========================================================
   MOVEMENT WARNING
========================================================= */

function buildMovementWarning(
  settings,
  anglePassed,
  eccPassed,
  conPassed,
  eccentric,
  concentric
) {

  if (
    settings.checkAngle
    &&
    !anglePassed
  ) {

    return "Mayor recorrido";

  }


  if (
    settings.checkEcc
    &&
    !eccPassed
    &&
    Number.isFinite(
      eccentric
    )
  ) {

    return eccentric
      <
      settings.eccTarget

      ? "Fase excéntrica más lenta"

      : "Fase excéntrica más rápida";

  }


  if (
    settings.checkCon
    &&
    !conPassed
  ) {

    return concentric
      <
      settings.conTarget

      ? "Fase concéntrica más lenta"

      : "Fase concéntrica más rápida";

  }


  return "Revisa objetivo";

}


/* =========================================================
   RESET JUMP
========================================================= */

function resetJumpState() {

  jumpState =
    "CALIBRATING";

  jumpPreviousFlexion =
    null;

  jumpPreviousAnkleY =
    null;

  jumpMaxFlexion =
    0;

  jumpStartTime =
    0;

  jumpBottomTime =
    0;

  jumpPropulsionStartTime =
    0;

  jumpTakeoffTime =
    0;

  jumpLandingTime =
    0;

  jumpLandingStartTime =
    0;

  jumpMaxLandingFlexion =
    0;

  jumpBaselineAnkleY =
    null;

  jumpBaselineSamples =
    [];

  sjHoldStartTime =
    0;

  sjHeldFlexion =
    null;

  sjProtocolInvalid =
    false;

}


/* =========================================================
   UPDATE JUMP
========================================================= */

function updateJump(
  flexion,
  points,
  timestamp
) {

  const settings =
    getJumpSettings();


  if (
    jumpBaselineAnkleY
    ===
    null
  ) {

    jumpBaselineSamples.push(
      points.ankle.y
    );


    if (
      jumpBaselineSamples.length
      >
      12
    ) {

      jumpBaselineSamples.shift();

    }


    if (
      jumpBaselineSamples.length
      >=
      8
    ) {

      jumpBaselineAnkleY =

        jumpBaselineSamples.reduce(

          (
            sum,
            value
          ) =>
            sum
            +
            value,

          0

        )

        /

        jumpBaselineSamples.length;


      jumpState =
        activeExercise === "sj"

          ? "START POSITION"

          : "READY";

    }

    else {

      jumpState =
        "CALIBRATING";

    }


    stateDisplay.textContent =
      jumpState;


    jumpPreviousFlexion =
      flexion;


    jumpPreviousAnkleY =
      points.ankle.y;


    return;

  }


  if (
    activeExercise ===
    "sj"
  ) {

    updateSquatJump(

      flexion,

      points,

      timestamp,

      settings

    );

  }

  else {

    updateCountermovementJump(

      flexion,

      points,

      timestamp,

      settings

    );

  }


  jumpPreviousFlexion =
    flexion;


  jumpPreviousAnkleY =
    points.ankle.y;


  stateDisplay.textContent =
    jumpState;


  repDisplay.textContent =
    `${jumpCount} / ${settings.targetJumps}`;

}


/* =========================================================
   SQUAT JUMP
========================================================= */

function updateSquatJump(
  flexion,
  points,
  timestamp,
  settings
) {

  const lower =
    settings.kneeTarget
    -
    settings.kneeTolerance;


  const upper =
    settings.kneeTarget
    +
    settings.kneeTolerance;


  const inStartPosition =

    flexion >=
    lower

    &&

    flexion <=
    upper;


  if (
    jumpState ===
    "START POSITION"
  ) {

    if (
      inStartPosition
    ) {

      jumpState =
        "HOLD";


      sjHoldStartTime =
        timestamp;


      sjHeldFlexion =
        flexion;


      jumpMaxFlexion =
        flexion;

    }

  }


  else if (
    jumpState ===
    "HOLD"
  ) {

    if (
      !inStartPosition
    ) {

      jumpState =
        "START POSITION";


      sjHoldStartTime =
        0;


      sjHeldFlexion =
        null;


      return;

    }


    if (
      flexion >
      jumpMaxFlexion
    ) {

      jumpMaxFlexion =
        flexion;

    }


    if (

      (
        timestamp
        -
        sjHoldStartTime
      )

      /

      1000

      >=
      settings.holdTarget

    ) {

      jumpState =
        "ARMED";


      sjHeldFlexion =
        flexion;


      jumpMaxFlexion =
        flexion;


      jumpStartTime =
        timestamp;

    }

  }


  else if (
    jumpState ===
    "ARMED"
  ) {

    if (

      flexion

      >

      sjHeldFlexion
      +
      SJ_COUNTERMOVEMENT_ALLOWANCE

    ) {

      sjProtocolInvalid =
        true;


      showWarning(
        "Countermovement detectado"
      );


      beepWarning();


      jumpState =
        "INVALID";


      return;

    }


    if (

      sjHeldFlexion
      -
      flexion

      >=
      3

    ) {

      jumpState =
        "PROPULSION";


      jumpPropulsionStartTime =
        timestamp;

    }

  }


  else if (
    jumpState ===
    "INVALID"
  ) {

    if (
      flexion <=
      JUMP_READY_FLEXION
    ) {

      addInvalidJumpResult(
        "Countermovement"
      );


      prepareNextJump();

    }

  }


  else if (
    jumpState ===
    "PROPULSION"
  ) {

    detectJumpTakeoff(

      flexion,

      points,

      timestamp

    );

  }


  else if (
    jumpState ===
    "FLIGHT"
  ) {

    detectJumpLanding(

      flexion,

      points,

      timestamp

    );

  }


  else if (
    jumpState ===
    "LANDING"
  ) {

    captureLanding(

      flexion,

      timestamp,

      settings,

      settings.holdTarget

    );

  }

}


/* =========================================================
   CMJ + ABALAKOV
========================================================= */

function updateCountermovementJump(
  flexion,
  points,
  timestamp,
  settings
) {

  if (
    jumpState ===
    "READY"
  ) {

    if (

      flexion >
      JUMP_DESCENT_TRIGGER

      &&

      jumpPreviousFlexion
      !==
      null

      &&

      flexion >
      jumpPreviousFlexion

    ) {

      jumpState =
        "COUNTERMOVEMENT";


      jumpStartTime =
        timestamp;


      jumpMaxFlexion =
        flexion;


      jumpBottomTime =
        timestamp;

    }

  }


  else if (
    jumpState ===
    "COUNTERMOVEMENT"
  ) {

    if (
      flexion >
      jumpMaxFlexion
    ) {

      jumpMaxFlexion =
        flexion;


      jumpBottomTime =
        timestamp;

    }


    if (

      jumpMaxFlexion
      -
      flexion

      >=
      TURNAROUND_DELTA

    ) {

      if (

        jumpMaxFlexion

        >=

        CMJ_MIN_COUNTERMOVEMENT

      ) {

        jumpState =
          "PROPULSION";


        jumpPropulsionStartTime =
          timestamp;

      }

      else {

        jumpState =
          "READY";


        jumpMaxFlexion =
          0;

      }

    }

  }


  else if (
    jumpState ===
    "PROPULSION"
  ) {

    detectJumpTakeoff(

      flexion,

      points,

      timestamp

    );

  }


  else if (
    jumpState ===
    "FLIGHT"
  ) {

    detectJumpLanding(

      flexion,

      points,

      timestamp

    );

  }


  else if (
    jumpState ===
    "LANDING"
  ) {

    captureLanding(

      flexion,

      timestamp,

      settings,

      null

    );

  }

}


/* =========================================================
   TAKEOFF / LANDING
========================================================= */

function getTakeoffThreshold() {

  return Math.max(

    8,

    canvas.height
    *
    0.012

  );

}


function getLandingTolerance() {

  return Math.max(

    10,

    canvas.height
    *
    0.02

  );

}


function detectJumpTakeoff(
  flexion,
  points,
  timestamp
) {

  const propulsionMs =

    timestamp
    -
    jumpPropulsionStartTime;


  const ankleLift =

    jumpBaselineAnkleY

    -

    points.ankle.y;


  if (

    propulsionMs >=
    JUMP_TAKEOFF_MIN_MS

    &&

    ankleLift >
    getTakeoffThreshold()

    &&

    flexion <
    50

  ) {

    jumpTakeoffTime =
      timestamp;


    jumpState =
      "FLIGHT";

  }

}


function detectJumpLanding(
  flexion,
  points,
  timestamp
) {

  const flightMs =

    timestamp
    -
    jumpTakeoffTime;


  const nearBaseline =

    Math.abs(

      points.ankle.y

      -

      jumpBaselineAnkleY

    )

    <=

    getLandingTolerance();


  const ankleReturning =

    jumpPreviousAnkleY
    !==
    null

    &&

    points.ankle.y
    >
    jumpPreviousAnkleY;


  if (

    flightMs >=
    JUMP_MIN_FLIGHT_MS

    &&

    nearBaseline

    &&

    ankleReturning

  ) {

    jumpLandingTime =
      timestamp;


    jumpLandingStartTime =
      timestamp;


    jumpMaxLandingFlexion =
      flexion;


    jumpState =
      "LANDING";


    return;

  }


  if (
    flightMs >
    JUMP_MAX_FLIGHT_MS
  ) {

    showWarning(
      "No se detectó aterrizaje"
    );


    beepWarning();


    prepareNextJump();

  }

}


function captureLanding(
  flexion,
  timestamp,
  settings,
  sjHold
) {

  if (
    flexion >
    jumpMaxLandingFlexion
  ) {

    jumpMaxLandingFlexion =
      flexion;

  }


  if (

    timestamp
    -
    jumpLandingStartTime

    >=

    JUMP_LANDING_CAPTURE_MS

  ) {

    completeJump(

      settings,

      sjHold

    );


    if (
      analysisActive
    ) {

      prepareNextJump();

    }

  }

}


/* =========================================================
   COMPLETE JUMP
========================================================= */

function completeJump(
  settings,
  sjHold
) {

  jumpCount++;


  const flightTime =

    (
      jumpLandingTime
      -
      jumpTakeoffTime
    )

    /

    1000;


  const estimatedHeightCm =

    (
      GRAVITY

      *

      Math.pow(
        flightTime,
        2
      )

      /

      8
    )

    *

    100;


  const descentTime =

    activeExercise ===
    "sj"

      ? null

      : (
          jumpBottomTime
          -
          jumpStartTime
        )
        /
        1000;


  const kneePassed =

    jumpMaxFlexion

    >=

    settings.kneeTarget
    -
    settings.kneeTolerance

    &&

    jumpMaxFlexion

    <=

    settings.kneeTarget
    +
    settings.kneeTolerance;


  const flightValid =

    flightTime

    >=

    JUMP_MIN_FLIGHT_MS
    /
    1000

    &&

    flightTime

    <=

    JUMP_MAX_FLIGHT_MS
    /
    1000;


  const landingValid =
    Number.isFinite(
      jumpMaxLandingFlexion
    );


  let valid =
    !sjProtocolInvalid;


  if (
    settings.checkFlight
    &&
    !flightValid
  ) {

    valid =
      false;

  }


  if (
    settings.checkKnee
    &&
    !kneePassed
  ) {

    valid =
      false;

  }


  if (
    settings.checkLanding
    &&
    !landingValid
  ) {

    valid =
      false;

  }


  if (
    valid
  ) {

    jumpValidCount++;


    showSuccess();

  }

  else {

    showWarning(

      activeExercise ===
      "sj"

      &&

      sjProtocolInvalid

        ? "Salto no válido"

        : "Revisa protocolo"

    );


    beepWarning();

  }


  const result = {

    number:
      jumpResults.length
      +
      1,

    estimatedHeightCm:
      estimatedHeightCm,

    flightTime:
      flightTime,

    maxFlexion:
      jumpMaxFlexion,

    descentTime:
      descentTime,

    holdTime:
      activeExercise ===
      "sj"

        ? sjHold

        : null,

    landingFlexion:
      jumpMaxLandingFlexion,

    valid:
      valid,

    reason:
      valid

        ? "Válido"

        : "Revisar"

  };


  jumpResults.push(
    result
  );


  addJumpResultRow(
    result
  );


  updateJumpSummary();


  eccDisplay.textContent =
    `${flightTime.toFixed(3)} s`;


  conDisplay.textContent =
    `${estimatedHeightCm.toFixed(1)} cm`;


  repDisplay.textContent =
    `${jumpCount} / ${settings.targetJumps}`;


  if (
    jumpCount
    >=
    settings.targetJumps
  ) {

    stopAnalysis(
      true
    );

  }

}


/* =========================================================
   INVALID SJ
========================================================= */

function addInvalidJumpResult(
  reason
) {

  const result = {

    number:
      jumpResults.length
      +
      1,

    estimatedHeightCm:
      null,

    flightTime:
      null,

    maxFlexion:
      jumpMaxFlexion,

    descentTime:
      null,

    holdTime:
      getJumpSettings()
        .holdTarget,

    landingFlexion:
      null,

    valid:
      false,

    reason:
      reason

  };


  jumpResults.push(
    result
  );


  addJumpResultRow(
    result
  );


  updateJumpSummary();

}


/* =========================================================
   PREPARE NEXT JUMP
========================================================= */

function prepareNextJump() {

  jumpState =
    "CALIBRATING";

  jumpPreviousFlexion =
    null;

  jumpPreviousAnkleY =
    null;

  jumpMaxFlexion =
    0;

  jumpStartTime =
    0;

  jumpBottomTime =
    0;

  jumpPropulsionStartTime =
    0;

  jumpTakeoffTime =
    0;

  jumpLandingTime =
    0;

  jumpLandingStartTime =
    0;

  jumpMaxLandingFlexion =
    0;

  jumpBaselineAnkleY =
    null;

  jumpBaselineSamples =
    [];

  sjHoldStartTime =
    0;

  sjHeldFlexion =
    null;

  sjProtocolInvalid =
    false;

}


/* =========================================================
   LIVE FEEDBACK
========================================================= */

function showWarning(
  message,
  positionWarning = false
) {

  const mode =
    getActiveFeedbackMode();


  if (
    mode !== "visual"
    &&
    mode !== "both"
  ) {

    return;

  }


  warningBox.textContent =
    message;


  warningBox.dataset.positionWarning =
    positionWarning

      ? "true"

      : "false";


  warningBox
    .classList
    .remove(
      "hidden"
    );


  if (
    warningHideTimer
  ) {

    clearTimeout(
      warningHideTimer
    );

  }


  warningHideTimer =
    setTimeout(

      () => {

        if (
          warningBox.dataset.positionWarning
          !==
          "true"
        ) {

          hideWarning();

        }

      },

      1500

    );

}


function showSuccess() {

  const mode =
    getActiveFeedbackMode();


  if (
    mode === "audio"
    ||
    mode === "off"
  ) {

    return;

  }


  statusBox.textContent =
    "✓ Objetivo cumplido";

}


function hideWarning() {

  warningBox
    .classList
    .add(
      "hidden"
    );


  warningBox.dataset.positionWarning =
    "false";

}


function trackingWarning(
  shortMessage =
    "Ajusta posición"
) {

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
    shortMessage,
    true
  );


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


function beepWarning() {

  const mode =
    getActiveFeedbackMode();


  if (
    mode !== "audio"
    &&
    mode !== "both"
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
   DRAW SKELETON
========================================================= */

function drawSkeleton(
  pose
) {

  const kp =
    pose.keypoints;


  const connections = [

    [5, 6],

    [5, 7],

    [7, 9],

    [6, 8],

    [8, 10],

    [5, 11],

    [6, 12],

    [11, 12],

    [11, 13],

    [13, 15],

    [12, 14],

    [14, 16]

  ];


  ctx.lineWidth =
    3;


  ctx.strokeStyle =
    "#1677ff";


  connections.forEach(

    (
      [a, b]
    ) => {

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

    (
      point
    ) => {

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

          Math.PI
          *
          2

        );


        ctx.fillStyle =
          "#ffffff";


        ctx.fill();

      }

    }

  );

}


/* =========================================================
   MOVEMENT RESULT ROW
========================================================= */

function addMovementResultRow(
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
      ${rep.angle.toFixed(0)}°
    </td>

    <td>
      ${
        rep.eccentric ===
        null

          ? "—"

          : `${rep.eccentric.toFixed(2)} s`
      }
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


  movementResultsBody
    .appendChild(
      row
    );

}


/* =========================================================
   MOVEMENT SUMMARY
========================================================= */

function updateMovementSummary() {

  if (
    !movementResults.length
  ) {

    movementSummary.textContent =
      "Aún no hay resultados.";

    return;

  }


  const avgAngle =

    movementResults.reduce(

      (
        sum,
        rep
      ) =>
        sum
        +
        rep.angle,

      0

    )

    /

    movementResults.length;


  const eccValues =

    movementResults

      .filter(
        (
          rep
        ) =>
          rep.eccentric
          !==
          null
      )

      .map(
        (
          rep
        ) =>
          rep.eccentric
      );


  const avgEcc =

    eccValues.length

      ?

      eccValues.reduce(

        (
          sum,
          value
        ) =>
          sum
          +
          value,

        0

      )

      /

      eccValues.length

      :

      null;


  const avgCon =

    movementResults.reduce(

      (
        sum,
        rep
      ) =>
        sum
        +
        rep.concentric,

      0

    )

    /

    movementResults.length;


  const compliance =

    (
      movementSuccessfulReps

      /

      movementResults.length
    )

    *

    100;


  movementSummary.innerHTML = `

    <strong>
      ${movementResults.length}
    </strong>

    repeticiones ·

    <strong>
      ${compliance.toFixed(0)}%
    </strong>

    dentro de objetivos

    <br>

    ${
      exerciseMeta[
        activeExercise
      ].angleName
    }

    media:

    <strong>
      ${avgAngle.toFixed(0)}°
    </strong>

    · Excéntrica media:

    <strong>
      ${
        avgEcc ===
        null

          ? "—"

          : `${avgEcc.toFixed(2)} s`
      }
    </strong>

    · Concéntrica media:

    <strong>
      ${avgCon.toFixed(2)} s
    </strong>

  `;

}


/* =========================================================
   JUMP RESULT ROW
========================================================= */

function addJumpResultRow(
  result
) {

  const row =
    document.createElement(
      "tr"
    );


  const protocolValue =

    activeExercise ===
    "sj"

      ?

      (
        result.holdTime ===
        null

          ? result.reason

          : `${result.holdTime.toFixed(2)} s`
      )

      :

      (
        result.descentTime ===
        null

          ? "—"

          : `${result.descentTime.toFixed(2)} s`
      );


  row.innerHTML = `

    <td>
      ${result.number}
    </td>

    <td>
      ${
        result.estimatedHeightCm ===
        null

          ? "—"

          : `${result.estimatedHeightCm.toFixed(1)} cm`
      }
    </td>

    <td>
      ${
        result.flightTime ===
        null

          ? "—"

          : `${result.flightTime.toFixed(3)} s`
      }
    </td>

    <td>
      ${result.maxFlexion.toFixed(0)}°
    </td>

    <td>
      ${protocolValue}
    </td>

    <td>
      ${
        result.landingFlexion ===
        null

          ? "—"

          : `${result.landingFlexion.toFixed(0)}°`
      }
    </td>

    <td
      class="${
        result.valid
          ? "pass"
          : "fail"
      }"
    >
      ${
        result.valid
          ? "✓"
          : "⚠"
      }
    </td>

  `;


  jumpResultsBody
    .appendChild(
      row
    );

}


/* =========================================================
   JUMP SUMMARY
========================================================= */

function updateJumpSummary() {

  if (
    !jumpResults.length
  ) {

    jumpSummary.textContent =
      "Aún no hay resultados.";

    return;

  }


  const valid =

    jumpResults.filter(

      (
        result
      ) =>

        result.valid

        &&

        result.estimatedHeightCm
        !==
        null

    );


  const invalidCount =

    jumpResults.length

    -

    valid.length;


  if (
    !valid.length
  ) {

    jumpSummary.innerHTML = `

      <strong>
        ${jumpResults.length}
      </strong>

      intentos registrados ·

      <strong>
        ${invalidCount}
      </strong>

      por revisar.

    `;


    return;

  }


  const heights =

    valid.map(

      (
        result
      ) =>
        result.estimatedHeightCm

    );


  const flights =

    valid.map(

      (
        result
      ) =>
        result.flightTime

    );


  const best =

    Math.max(
      ...heights
    );


  const avgHeight =

    heights.reduce(

      (
        sum,
        value
      ) =>
        sum
        +
        value,

      0

    )

    /

    heights.length;


  const avgFlight =

    flights.reduce(

      (
        sum,
        value
      ) =>
        sum
        +
        value,

      0

    )

    /

    flights.length;


  jumpSummary.innerHTML = `

    <strong>
      ${valid.length}
    </strong>

    saltos válidos ·

    <strong>
      ${invalidCount}
    </strong>

    por revisar

    <br>

    Mejor altura estimada:

    <strong>
      ${best.toFixed(1)} cm
    </strong>

    · Media:

    <strong>
      ${avgHeight.toFixed(1)} cm
    </strong>

    · Vuelo medio:

    <strong>
      ${avgFlight.toFixed(3)} s
    </strong>

  `;

}


/* =========================================================
   START
========================================================= */

function startAnalysis() {

  if (
    !cameraReady
  ) {

    statusBox.textContent =
      "Activa la cámara primero.";

    return;

  }


  if (
    !trackingReady
  ) {

    statusBox.textContent =

      lastPositionAssessment?.text

      ||

      "Ajusta tu posición antes de iniciar.";


    if (
      lastPositionAssessment
    ) {

      showPositionGuide(
        lastPositionAssessment
      );

    }


    updateSetupFlow();

    return;

  }


  activeSide =
    candidateSide;


  angleBuffer =
    [];


  trackingLostSince =
    null;


  trackingAlertPlayed =
    false;


  hideWarning();


  movementConfigDetails.open =
    false;


  jumpConfigDetails.open =
    false;


  if (
    activeCategory ===
    "movement"
  ) {

    movementRepCount =
      0;


    movementSuccessfulReps =
      0;


    movementResults =
      [];


    movementResultsBody.innerHTML =
      "";


    movementSummary.textContent =
      "Serie en curso...";


    movementMaxAngle =
      0;


    movementPreviousAngle =
      null;


    deadliftEccentricForNextRep =
      null;


    deadliftDescentStartTime =
      0;


    movementState =

      activeExercise ===
      "deadlift"

        ? "WAIT_FLOOR"

        : "READY";


    repDisplay.textContent =

      `0 / ${
        getMovementSettings()
          .targetReps
      }`;


    stateDisplay.textContent =
      movementState;


    eccDisplay.textContent =
      "—";


    conDisplay.textContent =
      "—";

  }

  else {

    jumpCount =
      0;


    jumpValidCount =
      0;


    jumpResults =
      [];


    jumpResultsBody.innerHTML =
      "";


    jumpSummary.textContent =
      "Serie en curso...";


    resetJumpState();


    repDisplay.textContent =

      `0 / ${
        getJumpSettings()
          .targetJumps
      }`;


    stateDisplay.textContent =
      "CALIBRATING";


    eccDisplay.textContent =
      "—";


    conDisplay.textContent =
      "—";

  }


  analysisActive =
    true;


  updateSetupFlow();


  if (
    activeExercise ===
    "sj"
  ) {

    statusBox.textContent =
      "Squat Jump activo · adopta la posición objetivo y mantén la pausa antes de saltar.";

  }

  else if (
    activeExercise ===
    "cmj"
  ) {

    statusBox.textContent =
      "CMJ activo · inicia de pie y realiza el countermovement cuando estés listo.";

  }

  else if (
    activeExercise ===
    "abalakov"
  ) {

    statusBox.textContent =
      "Abalakov activo · puedes utilizar libremente los brazos.";

  }

  else if (
    activeExercise ===
    "deadlift"
  ) {

    statusBox.textContent =
      "Peso muerto activo · adopta la posición inicial en el suelo para comenzar.";

  }

  else {

    statusBox.textContent =
      `${exerciseMeta[activeExercise].name} activo`;

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

}


/* =========================================================
   STOP
========================================================= */

function stopAnalysis(
  automatic = false
) {

  if (
    !analysisActive
  ) {

    statusBox.textContent =
      "No hay una serie activa.";

    return;

  }


  analysisActive =
    false;


  stateDisplay.textContent =
    "COMPLETE";


  if (
    activeCategory ===
    "movement"
  ) {

    movementState =
      "COMPLETE";


    updateMovementSummary();


    statusBox.textContent =

      automatic

        ? `Serie completada · ${movementRepCount} repeticiones`

        : `Serie finalizada · ${movementRepCount} repeticiones`;

  }

  else {

    jumpState =
      "COMPLETE";


    updateJumpSummary();


    statusBox.textContent =

      automatic

        ? `Serie completada · ${jumpCount} saltos`

        : `Serie finalizada · ${jumpCount} saltos`;

  }


  updateSetupFlow();


  updateFeedbackContext();

}


/* =========================================================
   FEEDBACK FORM
========================================================= */

function detectBrowser() {

  const ua =
    navigator.userAgent;


  if (
    /CriOS/i.test(
      ua
    )
  ) {

    return "Chrome iOS";

  }


  if (
    /FxiOS/i.test(
      ua
    )
  ) {

    return "Firefox iOS";

  }


  if (
    /EdgiOS/i.test(
      ua
    )
  ) {

    return "Edge iOS";

  }


  if (

    /Safari/i.test(
      ua
    )

    &&

    !/Chrome|CriOS|Android/i.test(
      ua
    )

  ) {

    return "Safari";

  }


  if (
    /Chrome/i.test(
      ua
    )
  ) {

    return "Chrome";

  }


  if (
    /Firefox/i.test(
      ua
    )
  ) {

    return "Firefox";

  }


  return "Otro";

}


function detectDevice() {

  const ua =
    navigator.userAgent;


  if (
    /iPhone/i.test(
      ua
    )
  ) {

    return "iPhone";

  }


  if (
    /iPad/i.test(
      ua
    )
  ) {

    return "iPad";

  }


  if (
    /Android/i.test(
      ua
    )
  ) {

    return "Android";

  }


  if (
    /Macintosh/i.test(
      ua
    )
  ) {

    return "Mac";

  }


  if (
    /Windows/i.test(
      ua
    )
  ) {

    return "Windows";

  }


  return navigator.platform
    ||
    "Desconocido";

}


function updateFeedbackContext() {

  if (
    !feedbackExercise
  ) {

    return;

  }


  feedbackExercise.value =
    exerciseMeta[
      activeExercise
    ].name;

}


async function submitFeedback(
  event
) {

  event.preventDefault();


  const message =
    feedbackMessage
      .value
      .trim();


  if (
    !message
  ) {

    feedbackStatus.textContent =
      "Cuéntame brevemente qué ocurrió o qué mejorarías.";


    feedbackStatus.className =
      "feedback-status error";


    feedbackMessage.focus();


    return;

  }


  feedbackSubmit.disabled =
    true;


  feedbackSubmit.textContent =
    "Enviando...";


  feedbackStatus.textContent =
    "";


  feedbackStatus.className =
    "feedback-status";


  const payload =
    new FormData();


  payload.append(
    "_subject",
    `Nuevo feedback ${APP_VERSION}`
  );


  payload.append(
    "perfil",
    feedbackProfile.value
  );


  payload.append(
    "ejercicio",
    exerciseMeta[
      activeExercise
    ].name
  );


  payload.append(

    "categoria",

    activeCategory ===
    "movement"

      ? "Movimiento"

      : "Salto"

  );


  payload.append(
    "tipo_feedback",
    feedbackType.value
  );


  payload.append(
    "experiencia",
    `${feedbackExperience.value}/5`
  );


  payload.append(
    "mensaje",
    message
  );


  payload.append(

    "contacto",

    feedbackContact
      .value
      .trim()

    ||

    "No indicado"

  );


  payload.append(
    "version",
    APP_VERSION
  );


  payload.append(
    "dispositivo",
    detectDevice()
  );


  payload.append(
    "navegador",
    detectBrowser()
  );


  payload.append(
    "user_agent",
    navigator.userAgent
  );


  payload.append(

    "camara",

    currentFacingMode ===
    "user"

      ? "Frontal"

      : "Trasera"

  );


  payload.append(

    "fecha_hora",

    new Date()
      .toLocaleString(
        "es-CL"
      )

  );


  try {

    const response =
      await fetch(

        FORMSPREE_ENDPOINT,

        {

          method:
            "POST",

          body:
            payload,

          headers: {

            Accept:
              "application/json"

          }

        }

      );


    if (
      !response.ok
    ) {

      throw new Error(
        "Formspree respondió con error"
      );

    }


    feedbackStatus.textContent =
      "✓ ¡Gracias! Tu feedback fue enviado y nos ayuda a mejorar KINEMYX.";


    feedbackStatus.className =
      "feedback-status success";


    feedbackForm.reset();


    feedbackExperience.value =
      "5";


    updateFeedbackContext();

  }

  catch (error) {

    console.error(
      "Error enviando feedback:",
      error
    );


    feedbackStatus.textContent =
      "No se pudo enviar el feedback. Revisa tu conexión e inténtalo nuevamente.";


    feedbackStatus.className =
      "feedback-status error";

  }

  finally {

    feedbackSubmit.disabled =
      false;


    feedbackSubmit.textContent =
      "Enviar feedback";

  }

}


if (
  feedbackForm
) {

  feedbackForm.addEventListener(

    "submit",

    submitFeedback

  );

}


/* =========================================================
   INITIAL STATE
========================================================= */

selectCategory(
  "movement"
);


updateSetupFlow();


updateFeedbackContext();