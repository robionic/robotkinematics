# Frame by Frame — Robot Kinematics Lab

## 🏭 Overview

Robot Kinematics Lab is a Django-based educational web app for learning how serial robot arms are described and analyzed using standard Denavit–Hartenberg (DH) parameters. It helps students and engineers translate robot geometry into workable kinematic models and visualize end-effector motion in real time.

## 🚀 Key Features

### Robot Modeling
- **Serial Arm Builder**: Add up to eight revolute or prismatic joints.
- **Parameter Editor**: Adjust joint names, link lengths, twists, joint values, and offsets.
- **DH Table**: View the live transformation table used to derive robot motion.
- **End-Effector Tracking**: Monitor position updates as joint values change.

### Learning Workflow
- **Six-Step Lesson Flow**: Guide the user through a structured kinematics exercise.
- **Quick Checks**: Use checks to identify which actuator variable is active in each joint.
- **Product-Page Importer**: Paste a public robot product URL to preview metadata and an image for the robot model.
- **Visualization**: Follow the XY-plane sketch for a clear geometric interpretation of the model.

### Advanced Kinematics
- **Separate Visualizer**: Explore an additional kinematics subproject in `advanced_kinematics/`.

## 🛠️ Technology Stack

### Backend
- **Django**
- **Python**

### Frontend
- **HTML/CSS/JavaScript**
- **Interactive visualization for DH motion**

### Educational Model
- **Standard DH convention**
- **Robot arm geometry and physical parameter mapping**

## 📋 Installation & Setup

### Prerequisites
- Python 3.10+
- pip
- Virtual environment support

### Local Setup

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py runserver
```

Then open:
```text
http://127.0.0.1:8000/
```

## 🎯 Usage Guide

### Building a Robot
1. Add joints to your robot model.
2. Choose the joint type: revolute or prismatic.
3. Enter the geometry values for each joint.
4. Review the live DH table and end-effector location.
5. Use the guided task flow to understand which parameter drives each motion.

### Product Reference Import
- Paste a public HTTPS robot product-page URL.
- Review the metadata and image preview.
- Set the expected joint count and confirm each joint type.

### Kinematic Convention
The application uses the standard DH transform:

`Tᵢ = Rz(θᵢ) · Tz(dᵢ) · Tx(aᵢ) · Rx(αᵢ)`

For a revolute joint, `θ` is the variable and `d` is fixed. For a prismatic joint, `d` is the variable and `θ` is fixed.

Angles and twists are entered in degrees. Link lengths and offsets use consistent units selected by the user.

## 📁 Project Structure

```text
RobotKinematics/
├── README.md
├── manage.py
├── requirements.txt
├── advanced_kinematics/
├── robotkinematics/
├── kinematics/
└── ...
```

## ✅ Validation

Run the test suite with:

```powershell
.venv\Scripts\python.exe manage.py test
```

## 🔬 Advanced Kinematics Subproject

A separate visualizer inspired by the Glowbuzzer kinematics workflow is included in the `advanced_kinematics/` directory.

```powershell
cd advanced_kinematics
python -m http.server 8001
```

Then open:
```text
http://127.0.0.1:8001/
```

## 🔎 Typical Use Cases

- Robotics education
- DH parameter analysis
- Serial manipulator design exercises
- Classroom demonstrations for kinematics and motion planning
