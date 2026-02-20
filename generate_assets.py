import os
from PIL import Image

def generate_assets(master_path="src/assets/master.png"):
    if not os.path.exists(master_path):
        print(f"Error: {master_path} not found. Please save your source image there.")
        return

    try:
        img = Image.open(master_path)
        img = img.convert("RGBA")
        
        # 1. Icons (Resizing)
        sizes = [16, 32, 48, 128]
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = f"src/assets/icon{size}.png"
            resized.save(output_path, "PNG")
            print(f"Generated {output_path}")

        # 2. Store Tiles (Padding/Resizing)
        # Background color: Indigo/Navy #0f172a (Tailwind slate-900) or similar
        bg_color = (15, 23, 42, 255) 

        # -- Marquee Tile (1400x560) --
        marquee = Image.new("RGBA", (1400, 560), bg_color)
        # Resize logo to fit nicely (e.g., 400px high)
        logo_height = 400
        aspect_ratio = img.width / img.height
        logo_width = int(logo_height * aspect_ratio)
        logo_resized = img.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
        
        # Center the logo
        x = (1400 - logo_width) // 2
        y = (560 - logo_height) // 2
        marquee.paste(logo_resized, (x, y), logo_resized)
        marquee.save("src/assets/marquee_tile.png", "PNG")
        print("Generated src/assets/marquee_tile.png")

        # -- Small Tile (440x280) --
        small = Image.new("RGBA", (440, 280), bg_color)
        # Resize logo to fit nicely (e.g., 200px high)
        logo_height = 200
        logo_width = int(logo_height * aspect_ratio)
        logo_resized = img.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
        
        x = (440 - logo_width) // 2
        y = (280 - logo_height) // 2
        small.paste(logo_resized, (x, y), logo_resized)
        small.save("src/assets/small_tile.png", "PNG")
        print("Generated src/assets/small_tile.png")

        print("\nAll assets generated successfully!")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_assets()
