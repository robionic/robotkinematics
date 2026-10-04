import math
from typing import Any


MAX_JOINTS = 8


class ModelValidationError(ValueError):
    pass


def _number(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise ModelValidationError(f"{field} must be a number.")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ModelValidationError(f"{field} must be a number.") from None
    if not math.isfinite(number):
        raise ModelValidationError(f"{field} must be finite.")
    return number


def _multiply(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    return [
        [sum(left[row][k] * right[k][column] for k in range(4)) for column in range(4)]
        for row in range(4)
    ]


def _dh_transform(a: float, alpha_degrees: float, d: float, theta_degrees: float) -> list[list[float]]:
    alpha = math.radians(alpha_degrees)
    theta = math.radians(theta_degrees)
    cos_alpha, sin_alpha = math.cos(alpha), math.sin(alpha)
    cos_theta, sin_theta = math.cos(theta), math.sin(theta)
    return [
        [cos_theta, -sin_theta * cos_alpha, sin_theta * sin_alpha, a * cos_theta],
        [sin_theta, cos_theta * cos_alpha, -cos_theta * sin_alpha, a * sin_theta],
        [0.0, sin_alpha, cos_alpha, d],
        [0.0, 0.0, 0.0, 1.0],
    ]


def derive_robot(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("joints"), list):
        raise ModelValidationError("Send a robot model with a joints list.")
    joints = payload["joints"]
    if not 1 <= len(joints) <= MAX_JOINTS:
        raise ModelValidationError(f"A robot must have between 1 and {MAX_JOINTS} joints.")

    rows: list[dict[str, Any]] = []
    frames = [[[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]]
    points = [[0.0, 0.0, 0.0]]

    for index, joint in enumerate(joints, start=1):
        if not isinstance(joint, dict):
            raise ModelValidationError(f"Joint {index} must be an object.")
        joint_type = joint.get("type")
        if joint_type not in {"revolute", "prismatic"}:
            raise ModelValidationError(f"Joint {index} must be revolute or prismatic.")
        name = str(joint.get("name", f"Joint {index}")).strip()[:32] or f"Joint {index}"
        a = _number(joint.get("length"), f"Joint {index} length")
        alpha = _number(joint.get("alpha"), f"Joint {index} twist")
        d = _number(joint.get("d"), f"Joint {index} offset")
        theta = _number(joint.get("theta"), f"Joint {index} angle")

        transform = _dh_transform(a, alpha, d, theta)
        frame = _multiply(frames[-1], transform)
        frames.append(frame)
        points.append([frame[0][3], frame[1][3], frame[2][3]])
        rows.append(
            {
                "index": index,
                "name": name,
                "type": joint_type,
                "a": a,
                "alpha": alpha,
                "d": d,
                "theta": theta,
                "variable": "theta" if joint_type == "revolute" else "d",
            }
        )

    return {"rows": rows, "frames": frames, "points": points, "end_effector": points[-1]}
