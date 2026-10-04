const presetRobots = {
  staubli: [
    { alpha: 0, a: 0.04, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#ea7d5d' },
    { alpha: 0, a: 0.04, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#ea7d5d' },
    { alpha: 0, a: 0.04, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#ea7d5d' },
  ],
  scara: [
    { alpha: 0, a: 1.2, d: 0, theta: 20, thetaOffset: 0, type: 'revolute', color: '#6aa073' },
    { alpha: 0, a: 1.4, d: 0, theta: 35, thetaOffset: 0, type: 'revolute', color: '#7ca07f' },
    { alpha: 0, a: 0.8, d: 0, theta: -25, thetaOffset: 0, type: 'revolute', color: '#8aad8f' },
  ],
};

const defaultRobot = [
  { alpha: 0, a: 0.3, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#ea7d5d' },
  { alpha: 0, a: 0.25, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#e39d76' },
  { alpha: 0, a: 0.2, d: 0, theta: 0, thetaOffset: 0, type: 'revolute', color: '#f0b48a' },
];

const dhTable = document.querySelector('#dh-table');
const presetSelect = document.querySelector('#preset-select');
const robotGroup = document.querySelector('#robot-drawing');
const forwardBlock = document.querySelector('#forward-kinematics');
const jacobianBlock = document.querySelector('#jacobian-output');
const tcpOutput = document.querySelector('#tcp-output');
const jointCount = document.querySelector('#joint-count');

let robotRows = structuredClone(defaultRobot);

function dhTransform(alphaDegrees, a, d, thetaDegrees) {
  const alpha = (alphaDegrees * Math.PI) / 180;
  const theta = (thetaDegrees * Math.PI) / 180;
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);

  return [
    [ct, -st * ca, st * sa, a * ct],
    [st, ct * ca, -ct * sa, a * st],
    [0, sa, ca, d],
    [0, 0, 0, 1],
  ];
}

function multiplyMatrices(a, b) {
  const result = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matrixToHtml(matrix) {
  const rows = matrix.map((row) => `
    <div class="matrix-row">
      ${row.map((value) => `<span>${Number(value).toFixed(2)}</span>`).join('')}
    </div>
  `).join('');
  return `<div class="matrix-grid">${rows}</div>`;
}

function renderDhTable() {
  dhTable.innerHTML = robotRows.map((row, index) => `
    <div class="dh-row" data-index="${index}">
      <div class="row-index">${index}</div>
      <label>α <input data-field="alpha" type="number" step="1" value="${row.alpha}" /></label>
      <label>a <input data-field="a" type="number" step="0.01" value="${row.a}" /></label>
      <label>d <input data-field="d" type="number" step="0.01" value="${row.d}" /></label>
      <label>θ <input data-field="theta" type="number" step="1" value="${row.theta}" /></label>
      <label>Type <select data-field="type"><option value="revolute" ${row.type === 'revolute' ? 'selected' : ''}>Revolute</option><option value="prismatic" ${row.type === 'prismatic' ? 'selected' : ''}>Prismatic</option></select></label>
      <label>Color <input data-field="color" type="text" value="${row.color}" /></label>
      <label>θ offset <input data-field="thetaOffset" type="number" step="1" value="${row.thetaOffset}" /></label>
      <label>d offset <input data-field="dOffset" type="number" step="0.01" value="${row.dOffset ?? 0}" /></label>
      <button class="delete-row" type="button" data-remove="${index}" aria-label="Delete row">×</button>
    </div>
  `).join('');
}

function addRow() {
  robotRows.push({ alpha: 0, a: 0.2, d: 0, theta: 0, thetaOffset: 0, dOffset: 0, type: 'revolute', color: '#7ca07f' });
  renderDhTable();
  updateVisualizer();
}

function updateRobotRowsFromInputs() {
  const rows = [...dhTable.querySelectorAll('.dh-row')];
  robotRows = rows.map((rowEl, index) => {
    const fields = rowEl.querySelectorAll('[data-field]');
    const next = { ...robotRows[index] };
    fields.forEach((field) => {
      const key = field.dataset.field;
      const value = field.type === 'number' ? Number(field.value) : field.value;
      next[key] = value;
    });
    if (!next.color) next.color = '#7ca07f';
    return next;
  });
}

dhTable.addEventListener('input', () => {
  updateRobotRowsFromInputs();
  updateVisualizer();
});

dhTable.addEventListener('change', () => {
  updateRobotRowsFromInputs();
  updateVisualizer();
});

dhTable.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove]');
  if (!removeButton) return;
  const index = Number(removeButton.dataset.remove);
  if (robotRows.length <= 1) return;
  robotRows.splice(index, 1);
  renderDhTable();
  updateVisualizer();
});

document.querySelector('#add-row').addEventListener('click', addRow);
document.querySelector('#load-preset').addEventListener('click', () => {
  const presetKey = presetSelect.value;
  robotRows = structuredClone(presetRobots[presetKey] || defaultRobot);
  renderDhTable();
  updateVisualizer();
});

document.querySelector('#download-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ joints: robotRows }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'robot-dh.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelector('#upload-json').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const rows = Array.isArray(payload?.joints) ? payload.joints : Array.isArray(payload) ? payload : null;
    if (!rows) throw new Error('Upload a valid JSON with a joints array.');
    robotRows = rows.map((row) => ({
      alpha: Number(row.alpha ?? 0),
      a: Number(row.a ?? row.length ?? 0),
      d: Number(row.d ?? 0),
      theta: Number(row.theta ?? 0),
      thetaOffset: Number(row.thetaOffset ?? 0),
      dOffset: Number(row.dOffset ?? 0),
      type: row.type || 'revolute',
      color: row.color || '#7ca07f',
    }));
    renderDhTable();
    updateVisualizer();
  } catch (error) {
    window.alert(error.message || 'Could not upload the robot JSON.');
  } finally {
    event.target.value = '';
  }
});

function computeForwardKinematics() {
  let transform = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  const points = [[0, 0, 0]];
  const matrices = [];

  robotRows.forEach((row) => {
    const thetaValue = row.type === 'revolute' ? row.theta + row.thetaOffset : row.thetaOffset;
    const dValue = row.type === 'prismatic' ? row.d + row.dOffset : row.d;
    const matrix = dhTransform(row.alpha, row.a, dValue, thetaValue);
    transform = multiplyMatrices(transform, matrix);
    matrices.push(transform.slice());
    points.push([transform[0][3], transform[1][3], transform[2][3]]);
  });

  return { matrices, points, endEffector: points.at(-1) };
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function computeJacobian(fk) {
  const endPosition = fk.endEffector;
  const jacobian = Array.from({ length: 6 }, () => Array(robotRows.length).fill(0));

  fk.matrices.forEach((matrix, index) => {
    const zAxis = [matrix[0][2], matrix[1][2], matrix[2][2]];
    const jointPosition = [matrix[0][3], matrix[1][3], matrix[2][3]];
    const radialVector = [
      endPosition[0] - jointPosition[0],
      endPosition[1] - jointPosition[1],
      endPosition[2] - jointPosition[2],
    ];

    if (robotRows[index].type === 'revolute') {
      const linear = cross(zAxis, radialVector);
      jacobian[0][index] = linear[0];
      jacobian[1][index] = linear[1];
      jacobian[2][index] = linear[2];
      jacobian[3][index] = zAxis[0];
      jacobian[4][index] = zAxis[1];
      jacobian[5][index] = zAxis[2];
    } else {
      jacobian[0][index] = zAxis[0];
      jacobian[1][index] = zAxis[1];
      jacobian[2][index] = zAxis[2];
    }
  });

  return jacobian;
}

function renderRobot(points) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = 200 / Math.max(spanX, spanY, 1);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const screenPoints = points.map(([x, y, z]) => [260 + (x - centerX) * scale, 160 - (y - centerY) * scale, z]);

  const links = screenPoints.slice(1).map((point, index) => {
    const start = screenPoints[index];
    const color = robotRows[index]?.color || '#ea7d5d';
    return `<line class="arm-link" x1="${start[0]}" y1="${start[1]}" x2="${point[0]}" y2="${point[1]}" style="--link-color:${color}" />`;
  }).join('');

  const frames = screenPoints.map(([x, y], index) => `
    <g class="frame-mark" transform="translate(${x} ${y})">
      <circle r="${index === 0 ? 7 : 5}" />
      <text x="10" y="-10">F${index}</text>
    </g>
  `).join('');

  const endPoint = screenPoints.at(-1);
  robotGroup.innerHTML = `${links}${frames}<circle class="tcp-mark" cx="${endPoint[0]}" cy="${endPoint[1]}" r="9" />`;
}

function updateVisualizer() {
  const fk = computeForwardKinematics();
  const endEffector = fk.endEffector;
  const jacobian = computeJacobian(fk);
  renderRobot(fk.points);
  forwardBlock.innerHTML = matrixToHtml(fk.matrices.at(-1) || [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]);
  jacobianBlock.innerHTML = matrixToHtml(jacobian);
  tcpOutput.textContent = `(${endEffector.map((value) => Number(value).toFixed(2)).join(', ')})`;
  jointCount.textContent = String(robotRows.length);
}

renderDhTable();
updateVisualizer();
