# backend/processing/drivability.py

from typing import List, Dict


def evaluate_drivability(grid_data, vehicle):
    clearance = vehicle["ground_clearance"]

    for cell in grid_data:
        if cell["terrain"] == "obstacle":
            cell["drivable"] = cell["height"] < clearance
        else:
            cell["drivable"] = True

    return grid_data