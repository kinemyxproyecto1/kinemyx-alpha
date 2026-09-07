const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cameraButton = document.getElementById("cameraButton");
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


let detector = null;

let cameraReady = false;
let analysisActive = false;

let candidateSide = "left";
let activeSide = "left";

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

let audioContext = null;

let trackingLostSince = null;
let lastTrackingAudio = 0;


const MIN_CONFIDENCE = 0.60;

const READY_FLEXION = 20;

const DESCENT_TRIGGER = 25;

const MIN_REP_FLEXION = 45;

const TURNAROUND_DELTA = 3;

const SMOOTHING_FRAMES = 5;

const TRACKING_AUDIO_COOLDOWN = 3000;


/* ---------------------------
   CONFIGURACIÓN
---------------------------- */

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


/* ---------------------------
   CÁMARA + MOVENET
---------------------------- */

cameraButton.addEventListener(
  "click",
  initializeCamera
);


async function initializeCamera() {

  try {

    statusBox.textContent =
      "Cargando KINEMYX...";

    await tf.setBackend("webgl");

    await tf.ready();


    const model =
      poseDetection.SupportedModels.MoveNet;


    detector =
      await poseDetection.createDetector(

        model,

        {
          modelType:
            poseDetection.movenet.modelType
              .SINGLEPOSE_LIGHTNING,

          enableSmoothing: true
        }

      );


    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {

            facingMode: "user",

            width: {
              ideal: 1280
            },

            height: {
              ideal: 720
            }

          },

          audio: false

        });


    video.srcObject = stream;


    await new Promise(resolve => {

      video.onloadedmetadata = () => {

        video.play();

        resolve();

      };

    });


    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;


    cameraReady = true;

    startButton.disabled = false;


    statusBox.textContent =
      "Cámara activa. Ubícate de lado y muestra el cuerpo completo.";


    detectLoop();


  } catch (error) {

    console.error(error);

    statusBox.textContent =
      "No fue posible iniciar la cámara.";

  }

}


/* ---------------------------
   DETECCIÓN
---------------------------- */

async function detectLoop() {

  if (!cameraReady || !detector) {

    requestAnimationFrame(detectLoop);

    return;

  }


  const poses =
    await detector.estimatePoses(video);


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (poses.length > 0) {

    const pose = poses[0];

    drawSkeleton(pose);

    processPose(pose);

  }


  requestAnimationFrame(detectLoop);

}


/* ---------------------------
   PUNTOS CORPORALES
---------------------------- */

function sideData(pose, side) {

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

  const left = sideData(pose, "left");
  const right = sideData(pose, "right");

  const leftScore =
    averageConfidence(left);

  const rightScore =
    averageConfidence(right);


  return leftScore >= rightScore
    ? "left"
    : "right";

}


/* ---------------------------
   ÁNGULO
---------------------------- */

function calculateAngle(a, b, c) {

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
      radians * 180 / Math.PI
    );


  if (angle > 180) {

    angle =
      360 - angle;

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


  const total =
    angleBuffer.reduce(
      (a, b) => a + b,
      0
    );


  return total /
    angleBuffer.length;

}


/* ---------------------------
   PROCESAMIENTO
---------------------------- */

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
    sideData(pose, side);


  const confidence =
    averageConfidence(points);


  if (
    confidence <
    MIN_CONFIDENCE
  ) {

    angleDisplay.textContent = "—";

    if (analysisActive) {

      trackingWarning();

    }

    return;

  }


  trackingLostSince = null;


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
    180 - jointAngle;


  kneeFlexion =
    Math.max(
      0,
      Math.min(160, kneeFlexion)
    );


  const smoothFlexion =
    smoothAngle(kneeFlexion);


  angleDisplay.textContent =
    smoothFlexion.toFixed(0) + "°";


  if (analysisActive) {

    updateMovement(
      smoothFlexion,
      performance.now()
    );

  }

}


/* ---------------------------
   MÁQUINA DE ESTADOS
---------------------------- */

function updateMovement(
  flexion,
  timestamp
) {

  const settings =
    getSettings();


  if (movementState === "READY") {

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


  else if (
    movementState ===
    "DESCENDING"
  ) {

    if (
      flexion >
      maxFlexion
    ) {

      maxFlexion =
        flexion;

      bottomTime =
        timestamp;

    }


    if (
      maxFlexion - flexion >=
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


  else if (
    movementState ===
    "ASCENDING"
  ) {

    if (
      flexion <=
      READY_FLEXION
    ) {

      completeRep(timestamp);

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


/* ---------------------------
   COMPLETAR REPETICIÓN
---------------------------- */

function completeRep(timestamp) {

  const settings =
    getSettings();


  repCount++;


  const eccentric =
    (bottomTime - repStartTime)
    / 1000;


  const concentric =
    (timestamp - ascentStartTime)
    / 1000;


  const romMin =
    settings.kneeTarget
    -
    settings.kneeTolerance;


  const romPassed =
    maxFlexion >= romMin;


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


    showWarning(message);

    beepWarning();

  }


  const rep = {

    number: repCount,

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
    eccentric.toFixed(2) + " s";


  conDisplay.textContent =
    concentric.toFixed(2) + " s";


  updateSummary();


  repDisplay.textContent =
    `${repCount} / ${settings.targetReps}`;


  if (
    repCount >=
    settings.targetReps
  ) {

    stopAnalysis();

  }

}


/* ---------------------------
   ADVERTENCIAS
---------------------------- */

function buildWarning(
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

    if (
      eccentric <
      settings.eccTarget
    ) {

      return "Bajada más lenta";

    }

    return "Bajada más rápida";

  }


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


/* ---------------------------
   FEEDBACK VISUAL
---------------------------- */

function showWarning(message) {

  const mode =
    getSettings().feedbackMode;


  if (
    mode === "visual" ||
    mode === "both"
  ) {

    warningBox.textContent =
      message;

    warningBox.classList
      .remove("hidden");


    setTimeout(
      hideWarning,
      1500
    );

  }

}


function showSuccess() {

  statusBox.textContent =
    "✓ Objetivo cumplido";

}


function hideWarning() {

  warningBox.classList
    .add("hidden");

}


/* ---------------------------
   TRACKING
---------------------------- */

function trackingWarning() {

  const now =
    performance.now();


  if (
    trackingLostSince === null
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
    now -
    lastTrackingAudio >
    TRACKING_AUDIO_COOLDOWN
  ) {

    beepWarning();

    lastTrackingAudio =
      now;

  }

}


/* ---------------------------
   AUDIO
---------------------------- */

function beepWarning() {

  const mode =
    getSettings().feedbackMode;


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


/* ---------------------------
   SKELETON
---------------------------- */

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
    "#1478ff";


  connections.forEach(
    ([a, b]) => {

      if (
        kp[a].score > 0.35 &&
        kp[b].score > 0.35
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
      point.score > 0.35
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


/* ---------------------------
   RESULTADOS
---------------------------- */

function addResultRow(rep) {

  const row =
    document.createElement("tr");


  row.innerHTML = `

    <td>${rep.number}</td>

    <td>
      ${rep.maxFlexion.toFixed(0)}°
    </td>

    <td>
      ${rep.eccentric.toFixed(2)} s
    </td>

    <td>
      ${rep.concentric.toFixed(2)} s
    </td>

    <td class="${rep.passed ? "pass" : "fail"}">

      ${rep.passed ? "✓" : "⚠"}

    </td>

  `;


  resultsBody.appendChild(row);

}


function updateSummary() {

  if (
    results.length === 0
  ) {

    return;

  }


  const avgFlexion =
    results.reduce(
      (sum, rep) =>
        sum + rep.maxFlexion,
      0
    )
    /
    results.length;


  const avgEcc =
    results.reduce(
      (sum, rep) =>
        sum + rep.eccentric,
      0
    )
    /
    results.length;


  const avgCon =
    results.reduce(
      (sum, rep) =>
        sum + rep.concentric,
      0
    )
    /
    results.length;


  const compliance =
    (
      successfulReps /
      results.length
    )
    * 100;


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


/* ---------------------------
   START / STOP
---------------------------- */

startButton.addEventListener(
  "click",
  startAnalysis
);


stopButton.addEventListener(
  "click",
  stopAnalysis
);


function startAnalysis() {

  if (!cameraReady) {
    return;
  }


  activeSide =
    candidateSide;


  repCount = 0;
  successfulReps = 0;

  results = [];

  resultsBody.innerHTML = "";

  angleBuffer = [];

  previousAngle = null;

  movementState =
    "READY";

  analysisActive =
    true;


  const settings =
    getSettings();


  repDisplay.textContent =
    `0 / ${settings.targetReps}`;


  stateDisplay.textContent =
    "READY";


  statusBox.textContent =
    "Análisis activo";


  startButton.disabled =
    true;


  stopButton.disabled =
    false;


  if (!audioContext) {

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

  }


  audioContext.resume();

}


function stopAnalysis() {

  analysisActive =
    false;


  startButton.disabled =
    false;


  stopButton.disabled =
    true;


  movementState =
    "READY";


  stateDisplay.textContent =
    "COMPLETE";


  statusBox.textContent =
    "Serie finalizada";


  updateSummary();

}
