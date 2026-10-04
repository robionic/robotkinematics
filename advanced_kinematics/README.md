# Advanced Kinematics Visualizer

## 🏭 Overview

This subproject is a lightweight browser-based kinematics visualizer inspired by the Glowbuzzer workflow. It is designed to help users explore how a serial robot arm moves as joint values change and to visualize the relationship between joint geometry and end-effector position.

## 🚀 Key Features

- **Interactive Robot Sketch**: Visualize arm motion in a simple XY plane.
- **Joint Parameter Exploration**: Experiment with link lengths, offsets, and axis values.
- **Fast Frontend Experience**: Run as a static browser app with no backend dependency.
- **Standalone Workflow**: Useful as a quick testbed or companion to the main Robot Kinematics Lab.

## 🛠️ Technology Stack

- **HTML/CSS/JavaScript**
- **Browser-rendered visualization**
- **Client-side geometry calculations**

## 📋 Installation & Setup

### Prerequisites
- A modern browser
- Python 3 (optional, for serving the files)

### Run Locally

```powershell
cd advanced_kinematics
python -m http.server 8001
```

Then open:
```text
http://127.0.0.1:8001/
```

## 🎯 Usage Guide

1. Open the visualizer in a browser.
2. Adjust the robot parameters or joint state.
3. Observe how the arm configuration changes.
4. Use the view to connect geometry to motion and end-effector behavior.

## 📁 Project Structure

```text
advanced_kinematics/
├── README.md
├── index.html
├── app.js
├── style.css
└── ...
```

## 🔎 Typical Use Cases

- Robot motion exploration
- Kinematics demos
- Quick visualization for classroom or prototyping use
- Companion tool for the main Robot Kinematics Lab
