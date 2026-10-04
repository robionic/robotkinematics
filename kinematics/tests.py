import json
import math
import socket
from unittest.mock import patch

from django.test import TestCase

from .model import ModelValidationError, derive_robot
from .page_import import RobotPageImportError, extract_page_details, import_robot_page


class DeriveRobotTests(TestCase):
    def test_two_revolute_planar_joints_calculate_end_effector(self):
        result = derive_robot(
            {
                "joints": [
                    {"name": "Shoulder", "type": "revolute", "length": 2, "alpha": 0, "d": 0, "theta": 0},
                    {"name": "Elbow", "type": "revolute", "length": 1, "alpha": 0, "d": 0, "theta": 90},
                ]
            }
        )

        self.assertAlmostEqual(result["end_effector"][0], 2)
        self.assertAlmostEqual(result["end_effector"][1], 1)
        self.assertEqual(result["rows"][0]["variable"], "theta")
        self.assertEqual(len(result["frames"]), 3)

    def test_prismatic_joint_marks_d_as_variable(self):
        result = derive_robot(
            {
                "joints": [
                    {"name": "Slide", "type": "prismatic", "length": 1, "alpha": 0, "d": 3, "theta": 0}
                ]
            }
        )

        self.assertEqual(result["rows"][0]["variable"], "d")
        self.assertEqual(result["end_effector"], [1.0, 0.0, 3.0])

    def test_non_finite_values_are_rejected(self):
        with self.assertRaisesRegex(ModelValidationError, "must be finite"):
            derive_robot(
                {
                    "joints": [
                        {"name": "Bad", "type": "revolute", "length": math.inf, "alpha": 0, "d": 0, "theta": 0}
                    ]
                }
            )

    def test_api_returns_validation_errors_as_bad_requests(self):
        response = self.client.post(
            "/api/derive/",
            data=json.dumps({"joints": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_product_page_import_extracts_title_and_robot_image(self):
        details = extract_page_details(
            '<html><head><meta property="og:title" content="Example robot">'
            '<meta property="og:image" content="/images/arm.jpg"></head></html>',
            "https://robots.example/models/arm",
        )

        self.assertEqual(details["title"], "Example robot")
        self.assertEqual(details["images"], ["https://robots.example/images/arm.jpg"])

    def test_product_import_rejects_private_addresses(self):
        with self.assertRaisesRegex(RobotPageImportError, "public"):
            import_robot_page("https://127.0.0.1/robot")

    def test_product_import_rejects_hosts_with_mixed_public_and_private_addresses(self):
        public_record = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
        private_record = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 443))
        with patch("kinematics.page_import.socket.getaddrinfo", return_value=[public_record, private_record]):
            with self.assertRaisesRegex(RobotPageImportError, "public"):
                import_robot_page("https://robots.example/model")

    def test_product_import_resolves_redirected_page_and_reports_errors(self):
        with patch("kinematics.page_import._read_product_page", return_value=(
            '<meta property="og:image" content="https://cdn.example/arm.jpg">',
            "https://robots.example/model",
        )):
            response = self.client.post(
                "/api/import-robot/",
                data=json.dumps({"url": "https://robots.example/model"}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["images"], ["https://cdn.example/arm.jpg"])

    def test_product_import_rejects_non_https_link(self):
        response = self.client.post(
            "/api/import-robot/",
            data=json.dumps({"url": "http://robots.example/model"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("HTTPS", response.json()["error"])
