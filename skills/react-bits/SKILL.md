---
name: react-bits
description: Add animated React components from React Bits (reactbits.dev) via the shadcn registry - text animations, backgrounds, cursor effects, cards, menus, micro-interactions. Use when a React/Next.js page needs motion or character beyond plain components ("animated hero", "cool background", "text effect", "react bits").
---

# React Bits

Source: github.com/DavidHDev/react-bits (MIT + Commons Clause). Components are copied into the project, not imported from a package.

## Install a component
Suffix picks the flavor: `TS` or `JS`, then `TW` (Tailwind) or `CSS`. Default to `TS-TW` in Tailwind repos.

```bash
npx shadcn@latest add @react-bits/SplitText-TS-TW
# no components.json? use jsrepo:
npx jsrepo@latest add https://reactbits.dev/r/SplitText-TS-TW
```

If `@react-bits` is not a known registry, add to `components.json`:
```json
"registries": { "@react-bits": "https://reactbits.dev/r/{name}.json" }
```
Docs and live demos: https://reactbits.dev/<category>/<kebab-name> (e.g. /text-animations/split-text).

## Rules
- One signature effect per view. Motion supports the content; it is not the content (taste + impeccable still govern the page).
- Respect `prefers-reduced-motion`; WebGL backgrounds (Aurora, Silk, Hyperspeed...) need a static fallback and must not block LCP. Lazy-load them.
- Restyle to the project's tokens after install; never ship demo colors.
- Read the copied file before use: some pull in deps (gsap, three, ogl, motion). Add only what the chosen component needs.

## Catalog
- **TextAnimations**: ASCIIText, BlurText, CircularText, CountUp, CurvedLoop, DecryptedText, DepthText, EchoText, FallingText, FoldText, FuzzyText, GlitchText, GradientText, MaskedHeading, ParticleText, RotatingText, ScrambledText, ScrollFloat, ScrollReveal, ScrollVelocity, ShinyText, Shuffle, SplitFlapText, SplitText, StrokeText, TechText, TextCursor, TextLoop, TextPressure, TextType, TrueFocus, VariableProximity, WarpText
- **Animations**: AnimatedContent, BlobCursor, ClickSpark, Crosshair, CrystalizedBall, Cubes, CursorGrid, DitherVeil, ElasticMesh, ElectricBorder, ElectricLogo, FadeContent, GhostCursor, GlareHover, GlowCursor, GradualBlur, HalftoneReveal, ImageTrail, LaserFlow, LogoLoop, Magnet, MetaBalls, MetallicPaint, Noise, OrbitImages, PixelSwap, PixelTrail, PixelTransition, Ribbons, RippleDistortion, ScrollExpand, ShapeBlur, SplashCursor, StarBorder, StickerPeel, Strands, SwarmCursor, TargetCursor
- **Backgrounds**: AcidSquares, AeroShards, Antigravity, Aurora, Balatro, Ballpit, Beams, CRTWarp, ColorBends, DarkVeil, Dither, DotField, DotGrid, EvilEye, FaultyTerminal, Ferrofluid, FloatingLines, FluxLines, Galaxy, GhostFibers, GradientASCII, GradientBlinds, GradientWaves, Grainient, GridDistortion, GridMotion, GridScan, Hyperspeed, Iridescence, LetterGlitch, LightPillar, LightRays, LightTunnel, Lightfall, Lightning, LineWaves, LiquidChrome, LiquidEther, MagicRings, MagnetLines, MicroSlats, MoltenMetal, Orb, Particles, PatternWaves, PixelBlast, PixelSnow, Plasma, PlasmaWave, Prism, PrismaticBurst, Radar, RippleGrid, Scanner, ShapeGrid, ShapeWaves, SideRays, Silk, SlicedWaves, SoftAurora, Threads, Topography, Waves, WebThreads
- **Components**: AccordionGallery, AnimatedList, BorderGlow, BounceCards, BubbleMenu, CardNav, CardSwap, Carousel, ChromaGrid, CircularCarousel, CircularGallery, Counter, CurvedInput, DecayCard, DepthCarousel, Dock, DomeGallery, DriftWall, ElasticSlider, FlexCarousel, FlowingMenu, FluidGlass, FlyingPosters, Folder, GlassIcons, GlassSurface, GooeyNav, HoloCard, InfiniteMenu, InfiniteSpiral, Lanyard, LineSidebar, MagicBento, Masonry, ModelViewer, MorphSlider, OptionWheel, PillNav, PixelCard, ProfileCard, ReflectiveCard, ScrollStack, SpecularButton, SpotlightCard, Stack, StaggeredMenu, Stepper, TiltedCard
- **Micro**: BellToggle, BranchedMenu, CallChip, CodeSlots, CometDial, DodgeField, FlipCard, FlyingButton, FolderFloat, FuseButton, GlideSelect, HoldButton, JellyRadio, LatticeLoader, PaperCrumple, PeekRating, PromptBar, PulseHeart, RefineFrame, RubberSegment, ScrubField, Shredder, SlideCommit, SlingButton, SloshGauge, SpringCheck, SquishSwitch, StatusMark, SwipeRow, SwipeToast, TearTicket, ThoughtLine, VoicePill, WakeSlider, WarmTooltip
