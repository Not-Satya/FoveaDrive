# SemanticKITTI class ids -> FoveaDrive terrain.

SEMANTIC_NAMES = {
    0: 'unlabeled',
    1: 'outlier',
    10: 'car',
    11: 'bicycle',
    13: 'bus',
    15: 'motorcycle',
    16: 'on-rails',
    18: 'truck',
    20: 'other-vehicle',
    30: 'person',
    31: 'bicyclist',
    32: 'motorcyclist',
    40: 'road',
    44: 'parking',
    48: 'sidewalk',
    49: 'other-ground',
    50: 'building',
    51: 'fence',
    52: 'other-structure',
    60: 'lane-marking',
    70: 'vegetation',
    71: 'trunk',
    72: 'terrain',
    80: 'pole',
    81: 'traffic-sign',
    99: 'other-object',
    252: 'moving-car',
    253: 'moving-bicyclist',
    254: 'moving-person',
    255: 'moving-motorcyclist',
    256: 'moving-on-rails',
    257: 'moving-bus',
    258: 'moving-truck',
    259: 'moving-other-vehicle',
}

GROUND_CLASSES = frozenset({40, 44, 48, 49, 60, 72})
OBSTACLE_CLASSES = frozenset({
    10, 11, 13, 15, 16, 18, 20, 30, 31, 32,
    50, 51, 52, 71, 80, 81, 99,
    252, 253, 254, 255, 256, 257, 258, 259,
})
VEGETATION_CLASSES = frozenset({70})
ROAD_CLASSES = frozenset({40, 44, 60, 72})


def semantic_name(class_id: int) -> str:
    return SEMANTIC_NAMES.get(int(class_id), 'unlabeled')


def terrain_from_semantic(class_id: int, height: float, height_std: float,
                          obstacle_frac: float, height_threshold: float,
                          roughness_threshold: float,
                          depression_threshold: float):
    cid = int(class_id)
    if obstacle_frac >= 0.12 or cid in OBSTACLE_CLASSES:
        return 'obstacle'
    if cid in GROUND_CLASSES:
        if height < depression_threshold:
            return 'depression'
        if height_std > roughness_threshold:
            return 'rough'
        return 'ground'
    if cid in VEGETATION_CLASSES:
        if height > height_threshold:
            return 'obstacle'
        return 'rough'
    return None
