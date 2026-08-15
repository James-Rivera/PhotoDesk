from __future__ import annotations

import io
import json
import os
import resource
import time

from PIL import Image, ImageDraw
from rembg import new_session, remove


def synthetic_portrait() -> bytes:
    image = Image.new("RGB", (1200, 1500), "#d9e9f7")
    draw = ImageDraw.Draw(image)
    draw.ellipse((330, 180, 870, 780), fill="#c9906f")
    draw.pieslice((300, 125, 900, 690), 180, 360, fill="#211b1c")
    draw.polygon(((175, 1500), (300, 850), (500, 700), (700, 700), (900, 850), (1025, 1500)), fill="#273449")
    draw.rectangle((510, 720, 690, 900), fill="#c9906f")
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=92)
    return output.getvalue()


def main() -> None:
    source = synthetic_portrait()
    load_started = time.perf_counter()
    model = os.environ.get("REMBG_MODEL", "isnet-general-use")
    session = new_session(model)
    load_seconds = time.perf_counter() - load_started
    inference_started = time.perf_counter()
    result = remove(source, session=session)
    inference_seconds = time.perf_counter() - inference_started
    with Image.open(io.BytesIO(result)) as output:
        dimensions = list(output.size)
    print(json.dumps({
        "inputBytes": len(source),
        "outputBytes": len(result),
        "outputDimensions": dimensions,
        "model": model,
        "modelLoadSeconds": round(load_seconds, 3),
        "inferenceSeconds": round(inference_seconds, 3),
        "peakRssMiB": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
    }))


if __name__ == "__main__":
    main()
