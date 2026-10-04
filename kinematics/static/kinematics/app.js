const initialJoints = [
    { name: "Shoulder", type: "revolute", length: 2.4, alpha: 0, d: 0, theta: 35 },
    { name: "Elbow", type: "revolute", length: 1.8, alpha: 0, d: 0, theta: -55 },
    { name: "Wrist", type: "revolute", length: 1.1, alpha: 0, d: 0, theta: 40 },
];

const presetRobots = {
    classic: [
        { name: "Joint 1", type: "revolute", length: 0.04, alpha: 0, d: 0.00, theta: 0 },
        { name: "Joint 2", type: "revolute", length: 0.04, alpha: 0, d: 0.00, theta: 0 },
        { name: "Joint 3", type: "revolute", length: 0.04, alpha: 0, d: 0.00, theta: 0 },
    ],
    scara: [
        { name: "Base", type: "revolute", length: 1.2, alpha: 0, d: 0.00, theta: 20 },
        { name: "Shoulder", type: "revolute", length: 1.4, alpha: 0, d: 0.00, theta: 35 },
        { name: "Forearm", type: "revolute", length: 0.8, alpha: 0, d: 0.00, theta: -25 },
    ],
};

const lessonSteps = [
    {
        kicker: "STEP 01 — JOINT AXIS",
        title: "Start with the joint",
        description: "In standard DH, every joint gets a z-axis. Point z along the motion: the rotation axis for a revolute joint, or the slide direction for a prismatic joint.",
        equation: "Revolute → θ is variable　 /　 Prismatic → d is variable",
        icon: "z",
    },
    {
        kicker: "STEP 02 — COMMON NORMAL",
        title: "Find the x direction",
        description: "The x-axis lies along the shortest line between neighboring z-axes (the common normal). Its signed length is a, the link length you entered.",
        equation: "a = distance along x from zᵢ₋₁ to zᵢ",
        icon: "x",
    },
    {
        kicker: "STEP 03 — LINK TWIST",
        title: "Measure the twist",
        description: "Rotate about x to bring zᵢ₋₁ onto zᵢ. That signed angle is α. Parallel axes have zero twist; your twist input is shown in degrees.",
        equation: "α = angle from zᵢ₋₁ to zᵢ about x",
        icon: "α",
    },
    {
        kicker: "STEP 04 — JOINT OFFSET",
        title: "Measure along z",
        description: "Move along the previous z-axis to reach the common normal. This displacement is d. It is fixed for a revolute joint, and the moving coordinate for a prismatic one.",
        equation: "Revolute: d fixed　 /　 Prismatic: d variable",
        icon: "d",
    },
    {
        kicker: "STEP 05 — JOINT ANGLE",
        title: "Rotate into the frame",
        description: "Rotate around the previous z-axis to align the x-axes. This is θ. A revolute actuator changes θ; for a prismatic joint, θ is fixed.",
        equation: "Revolute: θ variable　 /　 Prismatic: θ fixed",
        icon: "θ",
    },
    {
        kicker: "STEP 06 — BUILD THE TRANSFORM",
        title: "Chain the four moves",
        description: "Apply the standard-DH operations in order. Multiply each joint transform by the previous frame transform to locate the next frame and the tool center point.",
        equation: "Tᵢ = Rz(θᵢ) · Tz(dᵢ) · Tx(aᵢ) · Rx(αᵢ)",
        icon: "T",
    },
];

const jointList = document.querySelector("#joint-list");
const lessonJoint = document.querySelector("#lesson-joint");
const tableBody = document.querySelector("#dh-rows");
const addButton = document.querySelector("#add-joint");
const svgGroup = document.querySelector("#arm-drawing");
const toolSvgGroup = document.querySelector("#tool-arm-drawing");
const toolMatrixBody = document.querySelector("#tool-matrix-body");
const toolTcp = document.querySelector("#tool-tcp");
const toolJointCount = document.querySelector("#tool-joint-count");
const forwardOutput = document.querySelector("#forward-kinematics-output");
const jacobianOutput = document.querySelector("#jacobian-output");
const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value;
const importForm = document.querySelector("#robot-import-form");
const importButton = document.querySelector("#import-robot-button");
const importStatus = document.querySelector("#import-status");
const robotPreview = document.querySelector("#robot-preview");
const robotImage = document.querySelector("#robot-product-image");
const imagePicker = document.querySelector("#robot-image-picker");
const toolTabs = document.querySelectorAll(".tool-tab");
const toolPreset = document.querySelector("#robot-preset");
const loadPresetButton = document.querySelector("#load-preset-button");
const downloadDhButton = document.querySelector("#download-dh-button");
const uploadDhInput = document.querySelector("#upload-dh-input");
let importedImages = [];
let importedPageTitle = "";
let joints = initialJoints.map((joint) => ({ ...joint }));
let activeStep = 0;
let selectedJoint = 0;
let deriveTimer;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
}

function applyJointSet(nextJoints) {
    joints = nextJoints.map((joint) => ({ ...joint }));
    renderJoints();
    selectedJoint = Math.min(selectedJoint, Math.max(0, joints.length - 1));
    renderJointPicker();
    scheduleDerive();
}

function renderJoints() {
    jointList.innerHTML = joints.map((joint, index) => `
        <article class="joint-card" data-index="${index}">
            <div class="joint-card-head">
                <span class="joint-index">${String(index + 1).padStart(2, "0")}</span>
                <input class="joint-name" aria-label="Joint ${index + 1} name" data-field="name" value="${escapeHtml(joint.name)}" maxlength="32">
                <button class="remove-joint" type="button" data-remove="${index}" aria-label="Remove ${escapeHtml(joint.name)} joint" ${joints.length === 1 ? "disabled" : ""}>×</button>
            </div>
            <div class="joint-fields">
                <label>JOINT TYPE<select data-field="type"><option value="revolute" ${joint.type === "revolute" ? "selected" : ""}>Revolute ↻</option><option value="prismatic" ${joint.type === "prismatic" ? "selected" : ""}>Prismatic ⇆</option></select></label>
                <label>LINK LENGTH <span class="field-unit">a</span><input data-field="length" type="number" step="0.1" value="${joint.length}"></label>
                <label>LINK TWIST <span class="field-unit">α °</span><input data-field="alpha" type="number" step="5" value="${joint.alpha}"></label>
                ${joint.type === "revolute"
                    ? `<label>JOINT ANGLE <span class="field-unit">θ °</span><input data-field="theta" type="number" step="5" value="${joint.theta}"></label><label>FIXED OFFSET <span class="field-unit">d</span><input data-field="d" type="number" step="0.1" value="${joint.d}"></label>`
                    : `<label>JOINT SLIDE <span class="field-unit">d</span><input data-field="d" type="number" step="0.1" value="${joint.d}"></label><label>FIXED ANGLE <span class="field-unit">θ °</span><input data-field="theta" type="number" step="5" value="${joint.theta}"></label>`}
            </div>
        </article>`).join("");
    renderJointPicker();
}

function renderJointPicker() {
    selectedJoint = Math.min(selectedJoint, joints.length - 1);
    lessonJoint.innerHTML = joints.map((joint, index) =>
        `<option value="${index}" ${index === selectedJoint ? "selected" : ""}>${String(index + 1).padStart(2, "0")} · ${escapeHtml(joint.name)}</option>`,
    ).join("");
}

function updateLesson() {
    const step = lessonSteps[activeStep];
    document.querySelector("#step-number").textContent = String(activeStep + 1).padStart(2, "0");
    document.querySelector("#progress-fill").style.width = `${((activeStep + 1) / lessonSteps.length) * 100}%`;
    document.querySelector("#lesson-kicker").textContent = step.kicker;
    document.querySelector("#lesson-title").textContent = step.title;
    document.querySelector("#lesson-description").textContent = step.description;
    document.querySelector("#lesson-equation").textContent = step.equation;
    document.querySelector("#lesson-icon").textContent = step.icon;
    document.querySelector("#previous-step").disabled = activeStep === 0;
    document.querySelector("#next-step").textContent = activeStep === lessonSteps.length - 1 ? "Start over ↺" : "Next step →";
}

function renderTable(rows) {
    tableBody.innerHTML = rows.map((row) => `
        <tr>
            <td><span class="table-joint-index">0${row.index}</span> ${escapeHtml(row.name)}</td>
            <td><span class="type-pill ${row.type}">${row.type}</span></td>
            <td>${formatNumber(row.a)}</td><td>${formatNumber(row.alpha)}°</td>
            <td>${formatNumber(row.d)}${row.variable === "d" ? '<span class="variable-star"> ●</span>' : ""}</td>
            <td>${formatNumber(row.theta)}°${row.variable === "theta" ? '<span class="variable-star"> ●</span>' : ""}</td>
            <td><span class="variable-label">${row.variable === "theta" ? "θ rotates" : "d slides"}</span></td>
        </tr>`).join("");
}

function formatNumber(value) {
    return Number(value).toFixed(2);
}

function plotRobot(points, targetGroup) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const span = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
    const scale = 235 / Math.max(span, spanY, 1);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const screenPoints = points.map(([x, y]) => [260 + (x - centerX) * scale, 160 - (y - centerY) * scale]);
    const links = screenPoints.slice(1).map((point, index) => {
        const start = screenPoints[index];
        return `<line class="arm-link" x1="${start[0]}" y1="${start[1]}" x2="${point[0]}" y2="${point[1]}" style="--link-color:${index % 2 ? "#f1a46f" : "#e87851"}"/>`;
    }).join("");
    const frames = screenPoints.map(([x, y], index) => `
        <g class="frame-mark" transform="translate(${x} ${y})">
            <circle r="${index === 0 ? 7 : 5}"/><text x="9" y="-9">F${index}</text>
        </g>`).join("");
    targetGroup.innerHTML = `${links}${frames}<circle class="tcp-mark" cx="${screenPoints.at(-1)[0]}" cy="${screenPoints.at(-1)[1]}" r="9"/>`;
}

function drawRobot(points) {
    plotRobot(points, svgGroup);
}

function drawToolRobot(points) {
    plotRobot(points, toolSvgGroup);
}

function setEndEffector(position) {
    const text = `(${position.map((value) => Number(value).toFixed(2)).join(", ")})`;
    document.querySelector("#end-effector span").textContent = text;
    document.querySelector("#position-output").textContent = text;
    toolTcp.textContent = text;
}

function formatMatrixCell(value) {
    return Number(value).toFixed(2);
}

function renderMatrixDisplay(matrix) {
    const matrixRows = matrix.map((row) => `
        <div class="matrix-row">
            ${row.map((value) => `<span>${formatMatrixCell(value)}</span>`).join("")}
        </div>`).join("");
    return `<div class="matrix-grid">${matrixRows}</div>`;
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function computeJacobian(frames) {
    const end = frames.at(-1);
    const endPosition = [end[0][3], end[1][3], end[2][3]];
    const jacobian = Array.from({ length: 6 }, () => Array(joints.length).fill(0));

    for (let index = 0; index < joints.length; index += 1) {
        const frame = frames[index + 1];
        const zAxis = [frame[0][2], frame[1][2], frame[2][2]];
        const jointPosition = [frame[0][3], frame[1][3], frame[2][3]];
        const radialVector = [
            endPosition[0] - jointPosition[0],
            endPosition[1] - jointPosition[1],
            endPosition[2] - jointPosition[2],
        ];

        if (joints[index].type === "revolute") {
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
    }

    return jacobian;
}

function renderToolInfo(result) {
    toolMatrixBody.innerHTML = result.rows.map((row) => `
        <tr>
            <td>${row.name}</td>
            <td>${formatMatrixCell(row.alpha)}</td>
            <td>${formatMatrixCell(row.theta)}</td>
            <td>${formatMatrixCell(row.d)}</td>
            <td>${formatMatrixCell(row.a)}</td>
            <td>${formatMatrixCell(row.d)}</td>
            <td>${formatMatrixCell(0)}</td>
            <td>${row.type}</td>
        </tr>`).join("");

    const lastFrame = result.frames.at(-1);
    const jacobian = computeJacobian(result.frames);
    forwardOutput.innerHTML = renderMatrixDisplay(lastFrame);
    jacobianOutput.innerHTML = renderMatrixDisplay(jacobian);
    drawToolRobot(result.points);
    toolJointCount.textContent = String(joints.length);
}

async function derive() {
    try {
        const response = await fetch("/api/derive/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
            body: JSON.stringify({ joints }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not derive this robot.");
        renderTable(result.rows);
        drawRobot(result.points);
        renderToolInfo(result);
        setEndEffector(result.end_effector);
        document.querySelector("#api-error")?.remove();
    } catch (error) {
        let message = document.querySelector("#api-error");
        if (!message) {
            message = document.createElement("p");
            message.id = "api-error";
            message.className = "error-message";
            document.querySelector(".table-panel").append(message);
        }
        message.textContent = error.message;
    }
}

function scheduleDerive() {
    window.clearTimeout(deriveTimer);
    deriveTimer = window.setTimeout(derive, 100);
    document.querySelector("#quiz-feedback").textContent = "Choose an answer to check your understanding.";
    document.querySelector("#quiz-feedback").className = "quiz-feedback";
}

function setRobotImage(url) {
    try {
        if (new URL(url).protocol !== "https:") throw new Error("Use a secure HTTPS image link.");
    } catch (error) {
        importStatus.textContent = error.message || "Enter a valid image link.";
        importStatus.className = "import-status error";
        return;
    }
    robotImage.src = url;
    robotImage.alt = `${importedPageTitle || "Robot model"} product image`;
    document.querySelector("#robot-image-url").value = url;
    robotPreview.hidden = false;
    importStatus.textContent = "";
    importStatus.className = "import-status";
}

importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = document.querySelector("#robot-page-url").value.trim();
    importButton.disabled = true;
    importStatus.textContent = "Looking for the product page title and image…";
    importStatus.className = "import-status";
    robotPreview.hidden = true;
    try {
        const response = await fetch("/api/import-robot/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
            body: JSON.stringify({ url }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load this product page.");
        importedImages = result.images;
        importedPageTitle = result.title;
        document.querySelector("#robot-model-title").textContent = result.title;
        const pageLink = document.querySelector("#robot-page-link");
        pageLink.href = result.page_url;
        imagePicker.innerHTML = importedImages.map((image, index) =>
            `<option value="${escapeHtml(image)}">Product image ${index + 1}</option>`,
        ).join("");
        document.querySelector("#robot-image-picker-wrap").hidden = importedImages.length < 2;
        document.querySelector("#robot-image-url").value = "";
        robotPreview.hidden = false;
        setRobotImage(importedImages[0]);
        importStatus.textContent = "Page loaded. Review the image and estimate the joint count below.";
        importStatus.className = "import-status success";
        document.querySelector("#robot-preview").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        importStatus.textContent = error.message;
        importStatus.className = "import-status error";
    } finally {
        importButton.disabled = false;
    }
});

imagePicker.addEventListener("change", () => setRobotImage(imagePicker.value));
document.querySelector("#use-image-url").addEventListener("click", () => {
    const imageUrl = document.querySelector("#robot-image-url").value.trim();
    if (imageUrl) setRobotImage(imageUrl);
});
document.querySelector("#apply-joint-count").addEventListener("click", () => {
    const requestedCount = Number(document.querySelector("#robot-joint-count").value);
    joints = joints.slice(0, requestedCount);
    while (joints.length < requestedCount) {
        const index = joints.length + 1;
        joints.push({ name: `Joint ${index}`, type: "revolute", length: 1.5, alpha: 0, d: 0, theta: 0 });
    }
    selectedJoint = Math.min(selectedJoint, joints.length - 1);
    renderJoints();
    scheduleDerive();
    document.querySelector("#joint-list").scrollIntoView({ behavior: "smooth", block: "center" });
});

jointList.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    const index = Number(event.target.closest(".joint-card").dataset.index);
    joints[index][field] = field === "name" || field === "type" ? event.target.value : Number(event.target.value);
    if (field === "type") renderJoints();
    renderJointPicker();
    scheduleDerive();
});

jointList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button || joints.length <= 1) return;
    const removedIndex = Number(button.dataset.remove);
    joints.splice(removedIndex, 1);
    if (removedIndex < selectedJoint) selectedJoint -= 1;
    renderJoints();
    scheduleDerive();
});

addButton.addEventListener("click", () => {
    if (joints.length >= 8) return;
    joints.push({ name: `Joint ${joints.length + 1}`, type: "revolute", length: 1.5, alpha: 0, d: 0, theta: 0 });
    renderJoints();
    selectedJoint = joints.length - 1;
    renderJointPicker();
    scheduleDerive();
});

lessonJoint.addEventListener("change", () => {
    selectedJoint = Number(lessonJoint.value);
    document.querySelector("#quiz-feedback").textContent = "Choose an answer to check your understanding.";
    document.querySelector("#quiz-feedback").className = "quiz-feedback";
});
document.querySelector("#previous-step").addEventListener("click", () => {
    activeStep = Math.max(0, activeStep - 1);
    updateLesson();
});
document.querySelector("#next-step").addEventListener("click", () => {
    activeStep = (activeStep + 1) % lessonSteps.length;
    updateLesson();
});
document.querySelector("#quiz-choices").addEventListener("click", (event) => {
    const choice = event.target.closest("[data-answer]");
    if (!choice) return;
    const expected = joints[selectedJoint].type === "revolute" ? "theta" : "d";
    const feedback = document.querySelector("#quiz-feedback");
    const correct = choice.dataset.answer === expected;
    feedback.textContent = correct
        ? `Exactly. This ${joints[selectedJoint].type} joint changes ${expected === "theta" ? "θ (rotation)" : "d (translation)"}.`
        : `Not quite. A ${joints[selectedJoint].type} joint changes ${expected === "theta" ? "θ (rotation)" : "d (translation)"}.`;
    feedback.className = `quiz-feedback ${correct ? "correct" : "incorrect"}`;
});

toolTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        const shown = tab.dataset.tab;
        toolTabs.forEach((button) => {
            const active = button === tab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".tool-panel").forEach((panel) => {
            const active = panel.id === `${shown}-panel`;
            panel.classList.toggle("is-active", active);
        });
    });
});

loadPresetButton.addEventListener("click", () => {
    const presetKey = toolPreset.value;
    if (presetKey === "custom") return;
    applyJointSet(presetRobots[presetKey]);
});

downloadDhButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ joints }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "robot-dh.json";
    anchor.click();
    URL.revokeObjectURL(url);
});

uploadDhInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const nextJoints = Array.isArray(payload?.joints) ? payload.joints : null;
        if (!nextJoints) throw new Error("Upload a JSON file with a joints array.");
        applyJointSet(nextJoints);
        importStatus.textContent = `Loaded ${file.name}.`;
        importStatus.className = "import-status success";
    } catch (error) {
        importStatus.textContent = error.message || "Could not read that robot file.";
        importStatus.className = "import-status error";
    } finally {
        uploadDhInput.value = "";
    }
});

renderJoints();
updateLesson();
derive();
