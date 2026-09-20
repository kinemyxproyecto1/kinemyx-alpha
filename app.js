/* =========================================================
   KINEMYX
   Alpha 0.3
   Squat + CMJ
   Guided Setup Flow
   ========================================================= */


const $ = id =>
  document.getElementById(id);


/* =========================================================
   DOM
========================================================= */

const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

const squatModeButton = $("squatModeButton");
const cmjModeButton = $("cmjModeButton");

const squatSettingsSection = $("squatSettingsSection");
const cmjSettingsSection = $("cmjSettingsSection");

const squatConfigDetails = $("squatConfigDetails");
const cmjConfigDetails = $("cmjConfigDetails");

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
const sideDisplay = $("sideDisplay");

const statusBox = $("status");
const warningBox = $("warning");

const squatResultsSection = $("results");
const resultsBody = $("resultsBody");
const summary = $("summary");

const cmjResultsSection = $("cmjResults");
const cmjResultsBody = $("cmjResultsBody");
const cmjSummary = $("cmjSummary");


/* =========================================================
   SETUP FLOW DOM
========================================================= */

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


/* =========================================================
   GENERAL STATE
========================================================= */

let detector = null;

let cameraReady = false;
let trackingReady = false;
let analysisActive = false;
let detectionLoopStarted = false;

let lastGoodTrackingAt = 0;

let activeExercise = "squat";

let currentFacingMode = "user";
let currentStream = null;

let candidateSide = "left";
let activeSide = "left";

let audioContext = null;

let trackingLostSince = null;
let trackingAlertPlayed = false;

let warningHideTimer = null;

let angleBuffer = [];


/* =========================================================
   CONSTANTS
========================================================= */

const MIN_CONFIDENCE = 0.60;

const MIN_POINT_CONFIDENCE = 0.45;

const TRACKING_HOLD_MS = 450;

const SMOOTHING_FRAMES = 5;

const READY_FLEXION = 20;

const DESCENT_TRIGGER = 25;

const TURNAROUND_DELTA = 4;


/* =========================================================
   SQUAT STATE
========================================================= */

let squatRepCount = 0;

let squatSuccessfulReps = 0;

let squatState = "READY";

let squatMaxFlexion = 0;

let squatRepStartTime = 0;

let squatBottomTime = 0;

let squatAscentStartTime = 0;

let squatPreviousAngle = null;

let squatResults = [];

const SQUAT_MIN_REP_FLEXION = 45;


/* =========================================================
   CMJ STATE
========================================================= */

let cmjJumpCount = 0;

let cmjSuccessfulJumps = 0;

let cmjState = "READY";

let cmjPreviousFlexion = null;
let cmjPreviousAnkleY = null;

let cmjMaxFlexion = 0;

let cmjStartTime = 0;
let cmjBottomTime = 0;
let cmjPropulsionStartTime = 0;
let cmjTakeoffTime = 0;
let cmjLandingTime = 0;
let cmjLandingStartTime = 0;

let cmjMaxLandingFlexion = 0;

let cmjResults = [];

let cmjBaselineAnkleY = null;
let cmjBaselineHipY = null;
let cmjBaselineSamples = [];

const CMJ_MIN_COUNTERMOVEMENT = 35;
const CMJ_TAKEOFF_MIN_MS = 80;
const CMJ_MIN_FLIGHT_MS = 120;
const CMJ_MAX_FLIGHT_MS = 1200;
const CMJ_LANDING_CAPTURE_MS = 450;

const GRAVITY = 9.81;


/* =========================================================
   SETTINGS
========================================================= */

function getSquatSettings() {

  return {

    targetReps:
      Number($("targetReps").value),

    kneeTarget:
      Number($("kneeTarget").value),

    kneeTolerance:
      Number($("kneeTolerance").value),

    eccTarget:
      Number($("eccTarget").value),

    eccTolerance:
      Number($("eccTolerance").value),

    conTarget:
      Number($("conTarget").value),

    conTolerance:
      Number($("conTolerance").value),

    feedbackMode:
      $("feedbackMode").value,

    checkRom:
      $("checkRom").checked,

    checkEcc:
      $("checkEcc").checked,

    checkCon:
      $("checkCon").checked

  };

}


function getCmjSettings() {

  return {

    targetJumps:
      Number($("cmjTargetJumps").value),

    heightTarget:
      Number($("cmjHeightTarget").value),

    heightTolerance:
      Number($("cmjHeightTolerance").value),

    kneeTarget:
      Number($("cmjKneeTarget").value),

    kneeTolerance:
      Number($("cmjKneeTolerance").value),

    feedbackMode:
      $("cmjFeedbackMode").value,

    checkHeight:
      $("checkCmjHeight").checked,

    checkFlight:
      $("checkCmjFlight").checked,

    checkKnee:
      $("checkCmjKnee").checked,

    checkCountermovement:
      $("checkCmjCountermovement").checked,

    checkLanding:
      $("checkCmjLanding").checked

  };

}


function getActiveFeedbackMode() {

  return activeExercise === "cmj"
    ? getCmjSettings().feedbackMode
    : getSquatSettings().feedbackMode;

}


/* =========================================================
   GUIDED FLOW
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

  element.classList.add(state);

  textElement.textContent = text;
  statusElement.textContent = status;

}


function updateSetupFlow() {

  const exerciseName =
    activeExercise === "squat"
      ? "Sentadilla"
      : "CMJ";


  /* STEP 1 */

  setStep(
    stepAnalysis,
    stepAnalysisText,
    stepAnalysisStatus,
    "done",
    `${exerciseName} seleccionado`,
    "✓"
  );


  /* STEP 2 */

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
      "Completa los pasos anteriores",
      "4"
    );


    startButton.disabled = true;

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


  /* STEP 3 */

  if (!trackingReady) {

    setStep(
      stepPosition,
      stepPositionText,
      stepPositionStatus,
      analysisActive
        ? "warning-step"
        : "active",
      "Ajusta posición · cuerpo completo",
      "!"
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

    }

    else {

      setStep(
        stepStart,
        stepStartText,
        stepStartStatus,
        "pending",
        "Esperando tracking",
        "4"
      );


      startButton.disabled = true;

    }

    return;

  }


  setStep(
    stepPosition,
    stepPositionText,
    stepPositionStatus,
    "done",
    "Tracking listo",
    "✓"
  );


  /* STEP 4 */

  if (analysisActive) {

    setStep(
      stepStart,
      stepStartText,
      stepStartStatus,
      "done",
      "Serie en curso",
      "●"
    );


    startButton.disabled = true;

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


    startButton.disabled = false;

  }

}


/* =========================================================
   EXERCISE SELECTOR
========================================================= */

squatModeButton.addEventListener(
  "click",
  () => selectExercise("squat")
);


cmjModeButton.addEventListener(
  "click",
  () => selectExercise("cmj")
);


function selectExercise(exercise) {

  if (analysisActive) {

    statusBox.textContent =
      "Finaliza la serie antes de cambiar de análisis.";

    return;

  }


  activeExercise = exercise;

  angleBuffer = [];

  trackingReady = false;

  lastGoodTrackingAt = 0;

  hideWarning();


  squatConfigDetails.open = false;
  cmjConfigDetails.open = false;


  if (exercise === "squat") {

    squatSettingsSection.classList.remove("hidden");
    cmjSettingsSection.classList.add("hidden");

    squatResultsSection.classList.remove("hidden");
    cmjResultsSection.classList.add("hidden");

    squatModeButton.classList.remove("secondary");
    cmjModeButton.classList.add("secondary");

    liveExerciseLabel.textContent = "SQUAT";
    countLabel.textContent = "REP";

    primaryMetricLabel.textContent = "KNEE FLEXION";
    secondaryMetricLabel.textContent = "ECCENTRIC";
    tertiaryMetricLabel.textContent = "CONCENTRIC";

    const settings = getSquatSettings();

    repDisplay.textContent =
      `0 / ${settings.targetReps}`;

    angleDisplay.textContent = "—°";

    stateDisplay.textContent = "READY";

    eccDisplay.textContent = "—";
    conDisplay.textContent = "—";


    statusBox.textContent =
      cameraReady
        ? "Ubícate de lado para completar el tracking."
        : "Activa la cámara";

  }

  else {

    squatSettingsSection.classList.add("hidden");
    cmjSettingsSection.classList.remove("hidden");

    squatResultsSection.classList.add("hidden");
    cmjResultsSection.classList.remove("hidden");

    squatModeButton.classList.add("secondary");
    cmjModeButton.classList.remove("secondary");

    liveExerciseLabel.textContent = "CMJ";
    countLabel.textContent = "JUMP";

    primaryMetricLabel.textContent = "KNEE FLEXION";
    secondaryMetricLabel.textContent = "FLIGHT TIME";
    tertiaryMetricLabel.textContent = "HEIGHT EST.";

    const settings = getCmjSettings();

    repDisplay.textContent =
      `0 / ${settings.targetJumps}`;

    angleDisplay.textContent = "—°";

    stateDisplay.textContent = "READY";

    eccDisplay.textContent = "—";
    conDisplay.textContent = "—";


    statusBox.textContent =
      cameraReady
        ? "Ubícate de lado para completar el tracking."
        : "Activa la cámara";

  }


  updateSetupFlow();

}


/* =========================================================
   BUTTONS
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
  () => stopAnalysis(false)
);


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

    console.warn(
      "Cámara exacta no disponible. Usando cámara ideal.",
      error
    );


    return await navigator
      .mediaDevices
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
   MOVENET
========================================================= */

async function loadMoveNet() {

  if (detector) {
    return;
  }


  statusBox.textContent =
    "Cargando análisis de movimiento...";


  await tf.setBackend("webgl");

  await tf.ready();


  detector =
    await poseDetection.createDetector(

      poseDetection.SupportedModels.MoveNet,

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
        .forEach(track => track.stop());

      currentStream = null;

    }


    cameraReady = false;
    trackingReady = false;

    updateSetupFlow();


    const stream =
      await getCameraStream();


    currentStream = stream;

    video.srcObject = stream;


    await new Promise(resolve => {

      video.onloadedmetadata =
        async () => {

          await video.play();

          resolve();

        };

    });


    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    cameraReady = true;

    trackingReady = false;


    if (currentFacingMode === "user") {

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


    updateSetupFlow();


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
    trackingReady = false;

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


  trackingReady = false;

  updateSetupFlow();


  statusBox.textContent =
    "Cambiando cámara...";


  const success =
    await initializeCamera();


  if (!success) {

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
    !cameraReady ||
    !detector ||
    video.readyState < 2
  ) {

    requestAnimationFrame(detectLoop);

    return;

  }


  try {

    const poses =
      await detector.estimatePoses(video);


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

      const pose = poses[0];

      drawSkeleton(pose);

      processPose(pose);

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


  requestAnimationFrame(detectLoop);

}


/* =========================================================
   BODY DATA
========================================================= */

function sideData(
  pose,
  side
) {

  const kp = pose.keypoints;


  if (side === "left") {

    return {

      shoulder: kp[5],
      hip: kp[11],
      knee: kp[13],
      ankle: kp[15]

    };

  }


  return {

    shoulder: kp[6],
    hip: kp[12],
    knee: kp[14],
    ankle: kp[16]

  };

}


function averageConfidence(points) {

  return (
    points.shoulder.score +
    points.hip.score +
    points.knee.score +
    points.ankle.score
  ) / 4;

}


function determineBestSide(pose) {

  const left =
    sideData(pose, "left");

  const right =
    sideData(pose, "right");


  return (
    averageConfidence(left) >=
    averageConfidence(right)
      ? "left"
      : "right"
  );

}


/* =========================================================
   TRACKING
========================================================= */

function hasEnoughTracking(points) {

  const scores = [

    points.shoulder.score,
    points.hip.score,
    points.knee.score,
    points.ankle.score

  ];


  const allVisible =
    scores.every(
      score =>
        score >=
        MIN_POINT_CONFIDENCE
    );


  return (
    allVisible &&
    averageConfidence(points) >=
    MIN_CONFIDENCE
  );

}


function updateTrackingState(
  goodTracking
) {

  const now =
    performance.now();


  if (goodTracking) {

    lastGoodTrackingAt = now;

    if (!trackingReady) {

      trackingReady = true;

      updateSetupFlow();

    }

    return;

  }


  if (
    now -
    lastGoodTrackingAt >
    TRACKING_HOLD_MS
  ) {

    if (trackingReady) {

      trackingReady = false;

      updateSetupFlow();

    }

  }

}


function handleMissingPose() {

  updateTrackingState(false);


  if (analysisActive) {

    trackingWarning();

  }

}


/* =========================================================
   ANGLE
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
      360 -
      angle;

  }


  return angle;

}


function smoothAngle(angle) {

  angleBuffer.push(angle);


  if (
    angleBuffer.length >
    SMOOTHING_FRAMES
  ) {

    angleBuffer.shift();

  }


  return (
    angleBuffer.reduce(
      (sum, value) =>
        sum + value,
      0
    )
    /
    angleBuffer.length
  );

}


/* =========================================================
   PROCESS POSE
========================================================= */

function processPose(pose) {

  candidateSide =
    determineBestSide(pose);


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


  const goodTracking =
    hasEnoughTracking(points);


  updateTrackingState(
    goodTracking
  );


  if (!goodTracking) {

    angleDisplay.textContent =
      "—";


    if (analysisActive) {

      trackingWarning();

    }

    return;

  }


  trackingLostSince = null;
  trackingAlertPlayed = false;


  if (
    warningBox.textContent ===
    "Ajusta posición"
  ) {

    hideWarning();

  }


  const jointAngle =
    calculateAngle(
      points.hip,
      points.knee,
      points.ankle
    );


  let kneeFlexion =
    180 -
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
    smoothAngle(kneeFlexion);


  angleDisplay.textContent =
    `${smoothFlexion.toFixed(0)}°`;


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
   SQUAT
========================================================= */

function updateSquat(
  flexion,
  timestamp
) {

  const settings =
    getSquatSettings();


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
      squatMaxFlexion -
      flexion >=
      TURNAROUND_DELTA
    ) {

      if (
        squatMaxFlexion >=
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
   COMPLETE SQUAT REP
========================================================= */

function completeSquatRep(
  timestamp
) {

  const settings =
    getSquatSettings();


  squatRepCount++;


  const eccentric =
    (
      squatBottomTime -
      squatRepStartTime
    )
    /
    1000;


  const concentric =
    (
      timestamp -
      squatAscentStartTime
    )
    /
    1000;


  const romMinimum =
    settings.kneeTarget -
    settings.kneeTolerance;


  const romPassed =
    squatMaxFlexion >=
    romMinimum;


  const eccPassed =
    Math.abs(
      eccentric -
      settings.eccTarget
    )
    <=
    settings.eccTolerance;


  const conPassed =
    Math.abs(
      concentric -
      settings.conTarget
    )
    <=
    settings.conTolerance;


  let passed = true;


  if (
    settings.checkRom &&
    !romPassed
  ) {

    passed = false;

  }


  if (
    settings.checkEcc &&
    !eccPassed
  ) {

    passed = false;

  }


  if (
    settings.checkCon &&
    !conPassed
  ) {

    passed = false;

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


    showWarning(message);

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


  squatResults.push(rep);

  addSquatResultRow(rep);

  updateSquatSummary();


  eccDisplay.textContent =
    `${eccentric.toFixed(2)} s`;

  conDisplay.textContent =
    `${concentric.toFixed(2)} s`;


  repDisplay.textContent =
    `${squatRepCount} / ${settings.targetReps}`;


  if (
    squatRepCount >=
    settings.targetReps
  ) {

    stopAnalysis(true);

  }

}


function buildSquatWarning(
  settings,
  romPassed,
  eccPassed,
  conPassed,
  eccentric,
  concentric
) {

  if (
    settings.checkRom &&
    !romPassed
  ) {

    return "Más profundidad";

  }


  if (
    settings.checkEcc &&
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
    settings.checkCon &&
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
   CMJ CALIBRATION
========================================================= */

function updateCmjBaseline(
  flexion,
  points
) {

  if (
    analysisActive &&
    cmjState !==
    "READY"
  ) {

    return;

  }


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


  if (
    cmjBaselineSamples.length >
    20
  ) {

    cmjBaselineSamples.shift();

  }


  if (
    cmjBaselineSamples.length >=
    8
  ) {

    cmjBaselineAnkleY =
      cmjBaselineSamples.reduce(
        (sum, value) =>
          sum + value.ankleY,
        0
      )
      /
      cmjBaselineSamples.length;


    cmjBaselineHipY =
      cmjBaselineSamples.reduce(
        (sum, value) =>
          sum + value.hipY,
        0
      )
      /
      cmjBaselineSamples.length;

  }

}


/* =========================================================
   CMJ
========================================================= */

function updateCmj(
  flexion,
  points,
  timestamp
) {

  const settings =
    getCmjSettings();


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


  const ankleLift =
    cmjBaselineAnkleY -
    points.ankle.y;


  const hipLift =
    cmjBaselineHipY -
    points.hip.y;


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


  else if (
    cmjState ===
    "COUNTERMOVEMENT"
  ) {

    if (
      flexion >
      cmjMaxFlexion
    ) {

      cmjMaxFlexion =
        flexion;

      cmjBottomTime =
        timestamp;

    }


    if (
      cmjMaxFlexion -
      flexion >=
      TURNAROUND_DELTA
    ) {

      if (
        cmjMaxFlexion >=
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


  else if (
    cmjState ===
    "PROPULSION"
  ) {

    const propulsionTime =
      timestamp -
      cmjPropulsionStartTime;


    const takeoffDetected =
      propulsionTime >=
      CMJ_TAKEOFF_MIN_MS
      &&
      ankleLift >
      takeoffThreshold
      &&
      hipLift >
      hipLiftThreshold
      &&
      flexion <
      45;


    if (takeoffDetected) {

      cmjTakeoffTime =
        timestamp;

      cmjState =
        "FLIGHT";

    }

  }


  else if (
    cmjState ===
    "FLIGHT"
  ) {

    const flightMs =
      timestamp -
      cmjTakeoffTime;


    const ankleReturning =
      cmjPreviousAnkleY !==
      null
      &&
      points.ankle.y >
      cmjPreviousAnkleY;


    const nearBaseline =
      Math.abs(
        points.ankle.y -
        cmjBaselineAnkleY
      )
      <=
      landingTolerance;


    if (
      flightMs >=
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


    if (
      flightMs >
      CMJ_MAX_FLIGHT_MS
    ) {

      showWarning(
        "Repite el salto"
      );

      beepWarning();

      resetCmjMovementState();

    }

  }


  else if (
    cmjState ===
    "LANDING"
  ) {

    if (
      flexion >
      cmjMaxLandingFlexion
    ) {

      cmjMaxLandingFlexion =
        flexion;

    }


    if (
      timestamp -
      cmjLandingStartTime >=
      CMJ_LANDING_CAPTURE_MS
    ) {

      completeCmjJump();


      if (analysisActive) {

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
   COMPLETE CMJ
========================================================= */

function completeCmjJump() {

  const settings =
    getCmjSettings();


  cmjJumpCount++;


  const descentTime =
    (
      cmjBottomTime -
      cmjStartTime
    )
    /
    1000;


  const propulsionTime =
    (
      cmjTakeoffTime -
      cmjPropulsionStartTime
    )
    /
    1000;


  const flightTime =
    (
      cmjLandingTime -
      cmjTakeoffTime
    )
    /
    1000;


  const estimatedHeightM =
    GRAVITY *
    Math.pow(
      flightTime,
      2
    )
    /
    8;


  const estimatedHeightCm =
    estimatedHeightM *
    100;


  const heightMinimum =
    settings.heightTarget -
    settings.heightTolerance;


  const heightPassed =
    estimatedHeightCm >=
    heightMinimum;


  const kneeMinimum =
    settings.kneeTarget -
    settings.kneeTolerance;


  const kneeMaximum =
    settings.kneeTarget +
    settings.kneeTolerance;


  const kneePassed =
    cmjMaxFlexion >=
    kneeMinimum
    &&
    cmjMaxFlexion <=
    kneeMaximum;


  let passed = true;


  if (
    settings.checkHeight &&
    !heightPassed
  ) {

    passed = false;

  }


  if (
    (
      settings.checkKnee ||
      settings.checkCountermovement
    )
    &&
    !kneePassed
  ) {

    passed = false;

  }


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


    showWarning(message);

    beepWarning();

  }


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


  cmjResults.push(jump);

  addCmjResultRow(jump);

  updateCmjSummary();


  eccDisplay.textContent =
    `${flightTime.toFixed(3)} s`;


  conDisplay.textContent =
    `${estimatedHeightCm.toFixed(1)} cm`;


  repDisplay.textContent =
    `${cmjJumpCount} / ${settings.targetJumps}`;


  if (
    cmjJumpCount >=
    settings.targetJumps
  ) {

    stopAnalysis(true);

  }

}


function buildCmjWarning(
  settings,
  heightPassed,
  kneePassed
) {

  if (
    settings.checkHeight &&
    !heightPassed
  ) {

    return "Altura objetivo";

  }


  if (
    (
      settings.checkKnee ||
      settings.checkCountermovement
    )
    &&
    !kneePassed
  ) {

    const lower =
      settings.kneeTarget -
      settings.kneeTolerance;


    if (
      cmjMaxFlexion <
      lower
    ) {

      return "Mayor profundidad";

    }


    return "Menor profundidad";

  }


  return "Revisa salto";

}


/* =========================================================
   RESET CMJ
========================================================= */

function resetCmjMovementState() {

  cmjState = "READY";

  cmjPreviousFlexion = null;
  cmjPreviousAnkleY = null;

  cmjMaxFlexion = 0;

  cmjStartTime = 0;
  cmjBottomTime = 0;

  cmjPropulsionStartTime = 0;

  cmjTakeoffTime = 0;
  cmjLandingTime = 0;

  cmjLandingStartTime = 0;

  cmjMaxLandingFlexion = 0;

}


/* =========================================================
   FEEDBACK
========================================================= */

function showWarning(message) {

  const mode =
    getActiveFeedbackMode();


  if (
    mode !== "visual" &&
    mode !== "both"
  ) {

    return;

  }


  warningBox.textContent =
    message;


  warningBox.classList.remove(
    "hidden"
  );


  if (warningHideTimer) {

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


function showSuccess() {

  const mode =
    getActiveFeedbackMode();


  if (
    mode === "audio" ||
    mode === "off"
  ) {

    return;

  }


  statusBox.textContent =
    "✓ Objetivo cumplido";

}


function hideWarning() {

  warningBox.classList.add(
    "hidden"
  );

}


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


  if (
    now -
    trackingLostSince >
    1000
    &&
    !trackingAlertPlayed
  ) {

    beepWarning();

    trackingAlertPlayed = true;

  }

}


function beepWarning() {

  const mode =
    getActiveFeedbackMode();


  if (
    mode !== "audio" &&
    mode !== "both"
  ) {

    return;

  }


  if (!audioContext) {

    audioContext =
      new (
        window.AudioContext ||
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
    audioContext.createOscillator();


  const gain =
    audioContext.createGain();


  oscillator.frequency.value =
    520;


  gain.gain.value =
    0.025;


  oscillator.connect(gain);

  gain.connect(
    audioContext.destination
  );


  oscillator.start();


  oscillator.stop(
    audioContext.currentTime +
    0.12
  );

}


/* =========================================================
   SKELETON
========================================================= */

function drawSkeleton(pose) {

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


  ctx.lineWidth = 3;

  ctx.strokeStyle =
    "#1677ff";


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


  kp.forEach(point => {

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

  });

}


/* =========================================================
   SQUAT RESULTS
========================================================= */

function addSquatResultRow(rep) {

  const row =
    document.createElement("tr");


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


  resultsBody.appendChild(row);

}


function updateSquatSummary() {

  if (
    squatResults.length ===
    0
  ) {

    summary.innerHTML =
      "Aún no hay resultados.";

    return;

  }


  const avgFlexion =
    squatResults.reduce(
      (sum, rep) =>
        sum + rep.maxFlexion,
      0
    )
    /
    squatResults.length;


  const avgEcc =
    squatResults.reduce(
      (sum, rep) =>
        sum + rep.eccentric,
      0
    )
    /
    squatResults.length;


  const avgCon =
    squatResults.reduce(
      (sum, rep) =>
        sum + rep.concentric,
      0
    )
    /
    squatResults.length;


  const compliance =
    squatSuccessfulReps /
    squatResults.length *
    100;


  summary.innerHTML = `

    <strong>
      ${squatResults.length}
    </strong>
    repeticiones

    <br>

    <strong>
      ${squatSuccessfulReps}
    </strong>
    dentro de los objetivos

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
   CMJ RESULTS
========================================================= */

function addCmjResultRow(jump) {

  const row =
    document.createElement("tr");


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


  cmjResultsBody.appendChild(row);

}


function updateCmjSummary() {

  if (
    cmjResults.length ===
    0
  ) {

    cmjSummary.innerHTML =
      "Aún no hay resultados.";

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
      (sum, jump) =>
        sum +
        jump.estimatedHeightCm,
      0
    )
    /
    cmjResults.length;


  const avgFlight =
    cmjResults.reduce(
      (sum, jump) =>
        sum +
        jump.flightTime,
      0
    )
    /
    cmjResults.length;


  const avgBottom =
    cmjResults.reduce(
      (sum, jump) =>
        sum +
        jump.maxFlexion,
      0
    )
    /
    cmjResults.length;


  const compliance =
    cmjSuccessfulJumps /
    cmjResults.length *
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

    Flexión media:
    <strong>
      ${avgBottom.toFixed(0)}°
    </strong>

    <br>

    Cumplimiento:
    <strong>
      ${compliance.toFixed(0)}%
    </strong>

  `;

}


/* =========================================================
   START ANALYSIS
========================================================= */

function startAnalysis() {

  if (!cameraReady) {

    statusBox.textContent =
      "Activa la cámara primero.";

    return;

  }


  if (!trackingReady) {

    statusBox.textContent =
      "Ajusta tu posición antes de iniciar.";

    updateSetupFlow();

    return;

  }


  activeSide =
    candidateSide;


  angleBuffer = [];

  trackingLostSince = null;
  trackingAlertPlayed = false;

  hideWarning();


  squatConfigDetails.open = false;
  cmjConfigDetails.open = false;


  if (
    activeExercise ===
    "squat"
  ) {

    squatRepCount = 0;

    squatSuccessfulReps = 0;

    squatResults = [];

    resultsBody.innerHTML = "";

    summary.innerHTML =
      "Serie en curso...";

    squatState = "READY";

    squatMaxFlexion = 0;

    squatPreviousAngle = null;


    const settings =
      getSquatSettings();


    repDisplay.textContent =
      `0 / ${settings.targetReps}`;

    stateDisplay.textContent =
      "READY";

    eccDisplay.textContent = "—";

    conDisplay.textContent = "—";

  }

  else {

    cmjJumpCount = 0;

    cmjSuccessfulJumps = 0;

    cmjResults = [];

    cmjResultsBody.innerHTML = "";

    cmjSummary.innerHTML =
      "Serie en curso...";


    resetCmjMovementState();


    cmjBaselineSamples = [];

    cmjBaselineAnkleY = null;

    cmjBaselineHipY = null;


    const settings =
      getCmjSettings();


    repDisplay.textContent =
      `0 / ${settings.targetJumps}`;

    stateDisplay.textContent =
      "CALIBRATING";

    eccDisplay.textContent = "—";

    conDisplay.textContent = "—";

  }


  analysisActive = true;


  updateSetupFlow();


  statusBox.textContent =
    activeExercise === "cmj"
      ? "CMJ activo · mantente de pie 1–2 segundos antes del primer salto."
      : "Análisis de sentadilla activo";


  if (!audioContext) {

    audioContext =
      new (
        window.AudioContext ||
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
   STOP ANALYSIS
========================================================= */

function stopAnalysis(
  automatic = false
) {

  if (!analysisActive) {

    statusBox.textContent =
      "No hay una serie activa.";

    return;

  }


  analysisActive = false;


  stateDisplay.textContent =
    "COMPLETE";


  if (
    activeExercise ===
    "squat"
  ) {

    squatState =
      "COMPLETE";


    updateSquatSummary();


    statusBox.textContent =
      automatic
        ? `Serie completada · ${squatRepCount} repeticiones`
        : `Serie finalizada · ${squatRepCount} repeticiones`;

  }

  else {

    cmjState =
      "COMPLETE";


    updateCmjSummary();


    statusBox.textContent =
      automatic
        ? `Serie completada · ${cmjJumpCount} saltos`
        : `Serie finalizada · ${cmjJumpCount} saltos`;

  }


  updateSetupFlow();

}


/* =========================================================
   INITIAL STATE
========================================================= */

selectExercise("squat");

updateSetupFlow();