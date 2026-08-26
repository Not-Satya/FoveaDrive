---
name: Glacial HUD
colors:
  surface: '#0e141d'
  surface-dim: '#0e141d'
  surface-bright: '#343944'
  surface-container-lowest: '#090e17'
  surface-container-low: '#161c25'
  surface-container: '#1a2029'
  surface-container-high: '#252a34'
  surface-container-highest: '#30353f'
  on-surface: '#dee2f0'
  on-surface-variant: '#c2c7cd'
  inverse-surface: '#dee2f0'
  inverse-on-surface: '#2b313b'
  outline: '#8c9197'
  outline-variant: '#42474c'
  surface-tint: '#a5cbe7'
  primary: '#f8fbff'
  on-primary: '#05344a'
  primary-container: '#bce3ff'
  on-primary-container: '#40667e'
  inverse-primary: '#3d637a'
  secondary: '#aacaeb'
  on-secondary: '#0f334e'
  secondary-container: '#2c4c68'
  on-secondary-container: '#9cbcdd'
  tertiary: '#f8faff'
  on-tertiary: '#283239'
  tertiary-container: '#d5dfe9'
  on-tertiary-container: '#59636b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c6e7ff'
  primary-fixed-dim: '#a5cbe7'
  on-primary-fixed: '#001e2d'
  on-primary-fixed-variant: '#234b62'
  secondary-fixed: '#cee5ff'
  secondary-fixed-dim: '#aacaeb'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#2a4965'
  tertiary-fixed: '#dae4ee'
  tertiary-fixed-dim: '#bec8d1'
  on-tertiary-fixed: '#131d24'
  on-tertiary-fixed-variant: '#3e4850'
  background: '#0e141d'
  on-background: '#dee2f0'
  surface-variant: '#30353f'
typography:
  display-lg:
    fontFamily: Space Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-caps:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.15em
  mono-data:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0em
spacing:
  unit: 4px
  gutter: 16px
  margin: 32px
  panel-padding: 24px
---

## Brand & Style
The design system embodies a **Minimalist Diegetic Holographic Glass** aesthetic. It is engineered for high-fidelity simulation environments where the UI exists as a physical, projected layer within a 3D space. 

The personality is clinical, cold, and high-precision. It avoids the "neon-punk" tropes of typical sci-fi interfaces in favor of a desaturated, "Star Citizen" inspired glassmorphism. The emotional response is one of calm technical authority. Surfaces are treated as frosted crystalline layers with subtle optical refraction, emphasizing legibility and structural discipline over decorative flair.

## Colors
The palette is strictly monochromatic and cool-toned. 
- **Deep Slate Navy (#060B14)**: Used as the ultimate backdrop or "void" color.
- **Translucent Frost Glass (#102035 at 35%)**: The primary surface material for all interactive and informational panels.
- **Soft Icy Blue (#BCE3FF)**: The primary data color, used for high-importance text and active states.
- **Pale Frost White (#EBF5FF)**: Used sparingly for highlights, critical alerts, or "glow" points to simulate light hitting glass edges.
- **Muted Cool Slate Gray (#6C8BAA)**: For secondary telemetry, labels, and de-emphasized metadata.
- **Ultra-thin Ice Outline (#2B4C6F)**: A 1px stroke used to define the physical boundaries of the holographic projection.

## Typography
The typographic system relies on a "Technical Dual-Type" pairing. **Space Mono** handles all headings, telemetry, and labels, providing a rigid, data-driven feel. **IBM Plex Sans** is used for dense body text to maintain high readability in low-contrast environments.

- **Capitalization**: Labels and headings should default to uppercase to reinforce the military-spec/industrial HUD feel.
- **Tracking**: Use wide letter-spacing for labels to improve legibility against frosted backgrounds.
- **Anti-aliasing**: Ensure crisp rendering; avoid heavy text shadows to maintain the diegetic glass appearance.

## Layout & Spacing
The layout follows a **4px rigid grid** system. All components should be positioned on multiples of 4 to ensure technical alignment. 

The layout is **Fluid-Adaptive**, designed to "float" within a viewport. 
- **Margins**: A minimum 32px safe-zone must be maintained around the viewport edges to simulate a projected HUD boundary.
- **Panels**: Use a modular approach where info-blocks can be stacked or tiled with 16px gutters.
- **Alignment**: Information should be grouped into specific "Functional Zones" (e.g., Navigation on the left, Vital Stats on the right).

## Elevation & Depth
Depth is achieved through **Glassmorphism** and layering rather than shadows.
- **Backdrop Blur**: All glass panels must apply a significant blur (min 12px) to the background to ensure text legibility.
- **Layering**: Higher-priority windows use a slightly more opaque frost (#102035 at 50%) and an inner 1px glow on the top and left edges to catch "simulated light."
- **Optical Refraction**: For overlapping panels, use a subtle 1px offset highlight on the border of the topmost element.
- **Shadows**: Do not use traditional drop shadows. Use "Ambient Occlusion" glows in the #060B14 color if separation is required.

## Shapes
The shape language is **Strictly Geometric and Brutalist**. 
- **Corners**: Use 0px (sharp) corners for all primary containers and buttons. 
- **Chamfering**: For a more "engineered" look, 45-degree chamfered corners may be used on large structural panels.
- **Lines**: Use horizontal and vertical lines (1px) to group content. Diagonal lines are reserved for directional indicators or specialized telemetry.

## Components
- **Buttons**: Rectangular with 1px Ice Blue outlines. Hover state: Fill background with 10% Soft Icy Blue opacity. Active state: 2px border-weight.
- **Chips / Tags**: Monospaced text inside a bracketed frame (e.g., `[ 01.DATA ]`). No background fill.
- **Input Fields**: A simple underline (1px) with the label floated above in `label-caps`. 
- **Lists**: Separated by 1px horizontal lines at 10% opacity. Leading indicators (dots or dashes) are preferred for clarity.
- **Progress Bars**: Simple segmented bars. Each segment is a 1:1 square or 1:2 vertical rectangle.
- **Telemetry Cards**: Large monospaced numeric values with a small `label-caps` descriptor. Use the `Soft Icy Blue` for the value and `Muted Cool Slate Gray` for the label.
- **Brackets**: Use L-shaped corner brackets to define focus areas or selected targets in the UI.