import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .model import ModelValidationError, derive_robot
from .page_import import RobotPageImportError, import_robot_page


def home(request):
    return render(request, "kinematics/index.html")


@require_POST
def derive(request):
    try:
        payload = json.loads(request.body)
        result = derive_robot(payload)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)
    except ModelValidationError as error:
        return JsonResponse({"error": str(error)}, status=400)
    return JsonResponse(result)


@require_POST
def import_robot(request):
    try:
        payload = json.loads(request.body)
        if not isinstance(payload, dict):
            raise RobotPageImportError("Send a product page URL.")
        result = import_robot_page(payload.get("url"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)
    except RobotPageImportError as error:
        return JsonResponse({"error": str(error)}, status=400)
    return JsonResponse(result)
