# backend/main.py

from data.loader import load_sample_points
from processing.grid import AdaptiveGrid
from processing.terrain import classify_terrain
from processing.drivability import evaluate_drivability
from models.vehicle import get_vehicle


def run_pipeline(vehicle_type: str = "sedan"):
    # Load data
    points = load_sample_points()

    # Build adaptive grid
    grid = AdaptiveGrid()
    grid.add_points(points)

    map_data = grid.build_map()

    # Terrain classification
    map_data = classify_terrain(map_data)

    # Vehicle-based drivability
    vehicle = get_vehicle(vehicle_type)
    map_data = evaluate_drivability(map_data, vehicle)

    return map_data



if __name__ == "__main__":
    output = run_pipeline("sedan")

    # Print sample output
    for item in output[:10]:
        print(item)
        
    heights = [cell["height"] for cell in output]

    print("MIN HEIGHT:", min(heights))
    print("MAX HEIGHT:", max(heights))