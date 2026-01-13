import { TrendType } from '../types.js';

interface PromptResult {
  systemInstruction: string;
  mainPrompt: string;
}

export const getTrendPrompt = (
  trend: TrendType,
  dominantColor?: string,
  userCustomText?: string,
  refinementText?: string,
  hasReference?: boolean
): PromptResult => {

  const colorInstruction = dominantColor 
    ? `COLOR GRADING: Dominant ${dominantColor} tones woven throughout the image, affecting shadows and highlights.` 
    : "COLOR GRADING: Sophisticated, curated color palette with intentional color story.";

  // Enhanced Identity Preservation
  const identityInstruction = `
IDENTITY PRESERVATION (NON-NEGOTIABLE):
1. FACE SOURCE: The first uploaded images contain the SUBJECT. Extract and preserve exact facial structure, eye shape, nose, lips, jawline.
2. LIKENESS: The generated face MUST be immediately recognizable as the same person - not "similar to" but "is".
3. SKIN: Maintain realistic skin texture with visible pores, natural imperfections, micro-details. NO plastic/airbrushed/AI-smooth skin.
4. AGE ACCURACY: Preserve the subject's apparent age. Do not make them look older or younger.
${hasReference ? '5. REFERENCE IMAGE: The LAST image is a STYLE REFERENCE ONLY. Copy pose, lighting, composition, clothing style - but NEVER the face. The face must come from the SUBJECT images.' : ''}
`;

  // Professional Base System
  const baseInstruction = `
You are a world-class fashion photographer with 20+ years of experience shooting for Vogue Italia, Dazed, i-D, and W Magazine.
Your work is known for: AUTHENTIC TEXTURE, EDITORIAL STORYTELLING, CINEMATIC LIGHTING, CONTEMPORARY EDGE.

CRITICAL OUTPUT REQUIREMENT:
- Generate EXACTLY ONE single photograph. 
- NEVER create collages, grids, multi-panel images, or compositions with multiple photos.
- The multiple input images are references of the SAME person - use them to understand the subject's face, NOT to create multiple images.
- Output must be ONE unified, cohesive photograph.

${identityInstruction}

TECHNICAL STANDARDS:
- Resolution: 8K RAW quality, medium format sensor simulation
- Film Stock: Kodak Portra 400 / Fuji Pro 400H color science
- Grain: Subtle organic film grain, NOT digital noise
- Dynamic Range: Rich shadows with retained detail, creamy highlights
- Focus: Tack sharp on eyes, natural depth of field falloff
- Skin Rendering: Pores visible, natural texture, NO plastic/smoothing artifacts
`;

  const refinementInstruction = refinementText 
    ? `\n\nUSER REFINEMENT (HIGHEST PRIORITY): "${refinementText}". Apply this adjustment while maintaining the overall aesthetic.`
    : "";

  let specificPrompt = "";
  let trendSystem = baseInstruction;

  switch (trend) {
    // ==================== EDITORIAL & HIGH FASHION ====================
    
    case TrendType.MAGAZINE:
      trendSystem = `${baseInstruction}
BRIEF: You're shooting the cover story for Dazed & Confused's "New Faces" issue. 
PHOTOGRAPHER REFERENCE: Harley Weir meets Collier Schorr.`;
      specificPrompt = `
CONCEPT: "The New Guard" - Avant-garde editorial challenging conventional beauty.

STYLING:
- Garment: Architectural piece - either Rick Owens draped leather, Comme des Garçons deconstructed blazer, or Balenciaga sculptural silhouette
- Texture priority: Interesting fabrics that catch light (patent, mesh, structured wool)
- Accessories: Statement only - oversized industrial earring OR face jewelry

LIGHTING SETUP:
- Key: Harsh beauty dish at 45° creating dramatic shadow split
- Fill: Minimal - embrace contrast
- Optional: Colored gel on background (electric blue or deep red)
- Quality: Hard, editorial, intentional shadows

COMPOSITION:
- Framing: Unconventional crop - cut at forehead or include negative space
- Pose: Dynamic tension - twisted torso, angular limbs, NOT standard portrait
- Expression: Intense, confrontational, direct eye contact
- Background: Seamless paper (gray or colored) OR abstract geometric set piece

MOOD: Powerful, provocative, fashion-forward, gallery-worthy
${colorInstruction}`;
      break;

    case TrendType.PROFESSIONAL:
      trendSystem = `${baseInstruction}
BRIEF: Editorial portrait for Bloomberg Businessweek's "50 Leaders Shaping Tomorrow" feature.
PHOTOGRAPHER REFERENCE: Platon meets Annie Leibovitz.`;
      specificPrompt = `
CONCEPT: "Quiet Authority" - The modern visionary who leads through presence, not volume.

STYLING:
- Wardrobe: The Row black cashmere turtleneck OR Jil Sander minimal blazer (no logos, no patterns)
- Fit: Impeccable tailoring, architectural shoulders
- Grooming: Effortlessly polished - hair styled but not stiff
- Details: One quality piece - simple gold watch OR architectural ring

LIGHTING SETUP:
- Key: Classic Rembrandt lighting - 45° from subject, slightly above eye level
- Ratio: 3:1 for subtle drama without harshness
- Background: Subtle gradient or clean architectural element
- Quality: Professional softbox, controlled and intentional

COMPOSITION:
- Framing: Classic 2/3 portrait, subject positioned with breathing room
- Pose: Confident but not arrogant - slight lean forward shows engagement
- Hands: Visible if possible, relaxed and purposeful
- Expression: Intelligent calm, hint of determination in eyes
- Background: Blurred modern architecture OR neutral gradient

MOOD: Authoritative, intelligent, approachable, trustworthy, future-focused
${colorInstruction}`;
      break;

    // ==================== CINEMA & ATMOSPHERE ====================

    case TrendType.COUPLE:
      trendSystem = `${baseInstruction}
BRIEF: Film still from an unreleased Wong Kar-wai movie set in contemporary Tokyo/Hong Kong.
CINEMATOGRAPHER REFERENCE: Christopher Doyle's color work in "In the Mood for Love".`;
      specificPrompt = `
CONCEPT: "2AM Conversations" - Intimate moment between souls in a city that never sleeps.

SCENE SETUP:
- Location: Rain-slicked taxi interior OR neon-lit rooftop bar OR steamy late-night diner
- Time: 2-4 AM - the vulnerable hours
- Weather: Recent rain, wet surfaces reflecting lights

STYLING:
- Subject: Silk shirt (deep jewel tone) slightly undone, or elegant evening wear
- Hair: Slightly disheveled from the night, romantic
- Makeup: Smudged in an attractive way - lived-in glamour

LIGHTING:
- Primary: Practical neon signs bleeding through windows (red/blue/green mix)
- Key: City lights creating bokeh halos
- Quality: Soft, diffused through glass/rain/smoke
- Color: Heavy color cast - embrace the neon palette

COMPOSITION:
- Framing: Cinematic 2.39:1 aspect feel, letterbox mentality
- Focus: Shallow - subject sharp, background dreamy blur
- Foreground elements: Raindrops on glass, cigarette smoke, reflections
- Partner (if included): Soft focus, turned away, or just a silhouette

MOOD: Melancholic romance, beautiful loneliness, cinematic intimacy, bittersweet
${colorInstruction}`;
      break;

    case TrendType.RETRO_2K17:
      trendSystem = `${baseInstruction}
BRIEF: Authentic 2007-2012 "Indie Sleaze" party documentation. Think The Cobrasnake, Last Night's Party.
PHOTOGRAPHER REFERENCE: Mark Hunter, Terry Richardson (party era), Theo Wenner.`;
      specificPrompt = `
CONCEPT: "Last Night Was Chaos" - Raw party photography that defined an era.

TECHNICAL APPROACH:
- Camera simulation: Point-and-shoot or early DSLR with direct flash
- Flash: HARSH on-camera flash, red-eye acceptable, blown highlights on face
- Focus: Slightly off, motion blur acceptable - authenticity over perfection

STYLING:
- Look: Just left the club - sweaty, glittery, disheveled
- Outfit options: American Apparel bodysuit, sequin mini dress, leather jacket over nothing
- Makeup: Smudged black eyeliner, glossy lips, glitter remnants
- Accessories: Multiple thin gold chains, cigarette as prop

SETTING:
- Location: Grimy club bathroom, dark corner booth, taxi backseat, 4AM street
- Background: Dark with pops of neon, other partygoers blurred
- Props: Champagne bottle, cigarette, vintage cell phone

COMPOSITION:
- Framing: Snapshot aesthetic - slightly tilted, cropped unusually
- Pose: Caught mid-moment - laughing, dancing, posing ironically
- Expression: Defiant joy, "I don't care" energy, wild eyes

MOOD: Hedonistic, nostalgic, raw, authentic, pre-Instagram realness
${colorInstruction}`;
      break;

    case TrendType.DARK_ACADEMIA:
      trendSystem = `${baseInstruction}
BRIEF: Editorial for Tatler UK's "The Secret Scholars" feature on elite university aesthetics.
PHOTOGRAPHER REFERENCE: Paolo Roversi's Polaroid work meets classical portraiture.`;
      specificPrompt = `
CONCEPT: "The Secret Library" - Member of an ancient scholarly society, keeper of forbidden knowledge.

STYLING:
- Wardrobe: Vintage Harris Tweed blazer with elbow patches, high-neck cream blouse, or chunky cable-knit
- Layers: Waistcoat, tie loosened, collar slightly askew
- Accessories: Antique signet ring, round tortoiseshell glasses, leather-bound book as prop
- Hair: Slightly mussed academic look - not too polished

SETTING:
- Location: Ancient library with floor-to-ceiling bookshelves OR gothic stone corridor OR wood-paneled study
- Props: Flickering candles, dusty tomes, brass telescope, quill and inkwell
- Atmosphere: Dust particles visible in light beams

LIGHTING:
- Primary: Single window with dusty light rays cutting through darkness
- Practical: Candlelight providing warm fill
- Quality: Chiaroscuro - dramatic shadow play, Caravaggio influence
- Color temp: Warm amber and deep shadows

COMPOSITION:
- Framing: Classical portrait proportions, painterly feel
- Pose: Contemplative - reading, gazing out window, lost in thought
- Expression: Intelligent mystery, slight melancholy, old soul
- Background: Rich textures - leather books, velvet curtains, aged wood

MOOD: Mysterious, intellectual, romantic melancholy, timeless elegance
${colorInstruction}`;
      break;

    // ==================== LUXURY & STATUS ====================

    case TrendType.OLD_MONEY:
      trendSystem = `${baseInstruction}
BRIEF: Inherited wealth editorial for Town & Country's "American Dynasties" issue.
PHOTOGRAPHER REFERENCE: Slim Aarons meets Bruce Weber's Ralph Lauren campaigns.`;
      specificPrompt = `
CONCEPT: "Generational Elegance" - Third-generation wealth that never needs to prove itself.

STYLING:
- Philosophy: Quiet luxury - NO visible logos, nothing trendy
- Wardrobe options: Loro Piana cashmere cable-knit, Brunello Cucinelli linen, vintage Hermès scarf
- Colors: Cream, camel, navy, forest green, burgundy - all muted
- Fit: Relaxed but impeccable - clothes that cost more than they look
- Jewelry: Heirloom pieces - pearl studs, family signet, thin gold chain

SETTING:
- Location: Lake Como villa terrace, Hamptons tennis club, Swiss chalet, Cape Cod sailboat deck
- Time: Golden hour - that perfect late afternoon light
- Props: Vintage convertible in background, old tennis racket, worn leather weekender

LIGHTING:
- Natural sunlight only - golden hour warmth
- Dappled light through trees acceptable
- No flash, no artificial light
- Quality: Soft, flattering, effortless

COMPOSITION:
- Film simulation: Kodak Portra 160, slightly faded like old family photos
- Framing: Environmental portrait showing lifestyle context
- Pose: Unstudied elegance - leaning on railing, mid-laugh, natural moment
- Expression: Easy confidence, private amusement, nothing to prove

MOOD: Timeless, effortless, understated, inherited elegance, "old money doesn't talk"
${colorInstruction}`;
      break;

    case TrendType.MOB_WIFE:
      trendSystem = `${baseInstruction}
BRIEF: Fashion editorial inspired by The Sopranos, Real Housewives, and Italian-American glamour.
PHOTOGRAPHER REFERENCE: Ellen von Unwerth's playful excess meets Steven Meisel's Versace campaigns.`;
      specificPrompt = `
CONCEPT: "Jersey Royalty" - Unapologetic glamour, big energy, bigger hair.

STYLING:
- Wardrobe: Vintage Versace-style leopard print coat OR full-length mink/faux fur
- Accessories: Oversized gold hoops, chunky gold chains, designer sunglasses (Cazal, vintage Gucci)
- Nails: Long, perfectly manicured, French tip or deep red
- Bag: Hermès Birkin OR vintage Chanel, casually held
- Hair: VOLUME - big 90s blowout, backcombed, or slicked back mob wife bun
- Makeup: Full glam - defined brows, smoky eye, nude lip with heavy liner

SETTING:
- Location: Outside Italian restaurant, luxury SUV, salon chair, McMansion entrance
- Props: Espresso cup, cigarette, cell phone with jeweled case
- Background: Marble, gold fixtures, velvet, Italian flags

LIGHTING:
- Flash: On-camera fill flash for that paparazzi energy
- Quality: Slightly harsh, tabloid magazine feel
- Alternative: Warm interior with gold-toned lighting

COMPOSITION:
- Framing: Full body to show the outfit, or close-up on attitude
- Pose: Power pose - hand on hip, sunglasses pushed up, looking over shoulder
- Expression: "What are you looking at?" energy, confident smirk, slight attitude
- Styling detail: Price tags may be visible (Carmela Soprano energy)

MOOD: Flashy, confident, unapologetic luxury, "I earned this", Italian-American pride
${colorInstruction}`;
      break;

    case TrendType.A_LA_RUSSE:
      trendSystem = `${baseInstruction}
BRIEF: Winter luxury editorial for Tatler Russia, inspired by Doctor Zhivago and Russian aristocracy.
PHOTOGRAPHER REFERENCE: Paolo Roversi's ethereal work meets Tim Walker's fantasy.`;
      specificPrompt = `
CONCEPT: "Winter Palace" - Last days of the aristocracy, frozen beauty, imperial elegance.

STYLING:
- Coat: Massive vintage fur (sable, fox) OR structured military-inspired wool coat
- Headwear: Fur ushanka hat, pearl-encrusted kokoshnik, or flowing silk headscarf
- Jewelry: Elaborate pearl choker, diamond brooch, heirloom pieces
- Makeup: Porcelain skin, naturally flushed cheeks from cold, deep red matte lips
- Hair: Elegant updo with loose tendrils OR flowing waves under fur hat

SETTING:
- Location: Snowy Red Square at dusk, birch forest, frozen palace courtyard, onion-domed church background
- Weather: Active snowfall, breath visible in cold air
- Time: Blue hour or overcast winter light

LIGHTING:
- Natural winter light: Blue-cold with warmth on skin
- Snow reflection providing soft fill
- Optional: Warm practical light from windows
- Quality: Ethereal, cold but romantic

COMPOSITION:
- Framing: Full or 3/4 length to show the fur volume
- Pose: Regal bearing - straight spine, lifted chin, but not stiff
- Expression: Stoic beauty, slight melancholy, imperial gaze
- Background: Architectural detail OR vast snowy landscape
- Details: Visible breath, snowflakes catching light

MOOD: Imperial grandeur, cold beauty, aristocratic melancholy, Tolstoy heroine
${colorInstruction}`;
      break;

    case TrendType.QUIET_LUXURY:
      trendSystem = `${baseInstruction}
BRIEF: Campaign for The Row or Loro Piana - the ultimate "if you know, you know" aesthetic.
PHOTOGRAPHER REFERENCE: Tyrone Lebon's minimal work, Juergen Teller's raw elegance.`;
      specificPrompt = `
CONCEPT: "Less, but Better" - Stealth wealth that whispers rather than shouts.

STYLING:
- Philosophy: Zero logos, zero trends, maximum quality
- Wardrobe: The Row oversized cashmere coat, Brunello Cucinelli knit, Totême structured pieces
- Colors: Oatmeal, greige, ecru, soft gray, cream, black - all neutral
- Fabric: Visible quality - cashmere, silk, fine wool - materials speak for themselves
- Accessories: Minimalist - Bottega pouch, simple gold jewelry, quality leather belt

SETTING:
- Location: Minimalist apartment with natural light, white gallery space, or simple natural backdrop
- Architecture: Clean lines, quality materials - concrete, marble, raw wood
- Props: None or one thoughtful object (art book, ceramic vase)

LIGHTING:
- Natural window light only
- Soft, diffused, flattering
- No drama - clean and pure
- Quality: Bright but not harsh, studio-like naturalism

COMPOSITION:
- Framing: Clean, lots of negative space, architectural
- Pose: Minimal, natural - standing simply, sitting quietly
- Expression: Serene confidence, slight smile, unbothered
- Background: Uncluttered, quality over quantity

MOOD: Understated, confident, refined, minimal, "I don't need to try"
${colorInstruction}`;
      break;

    // ==================== MODERN FEMININE ====================

    case TrendType.OFFICE_SIREN:
      trendSystem = `${baseInstruction}
BRIEF: Miu Miu Spring campaign meets "Secretary" film aesthetic - intellectual danger.
PHOTOGRAPHER REFERENCE: Juergen Teller's Céline era meets Venetia Scott.`;
      specificPrompt = `
CONCEPT: "Dangerous Intelligence" - The woman who runs the meeting and everyone knows it.

STYLING:
- Glasses: Thin rectangular frames (Lindberg, Cartier) OR vintage cat-eye
- Hair: Severe low bun with escaped tendrils OR slicked-back wet look
- Wardrobe: Pencil skirt with high slit, crisp white shirt unbuttoned one too many, OR fitted cashmere cardigan
- Details: Visible bra strap (intentional), pencil behind ear, reading glasses on chain
- Shoes: Pointed-toe kitten heel OR Prada loafer
- Makeup: Clean skin, strong brow, subtle lip, "no makeup" makeup

SETTING:
- Location: Corner office with city view, law library, empty boardroom after hours
- Props: Stack of documents, expensive pen, single orchid
- Lighting: Cool fluorescent transformed into cinema

LIGHTING:
- Primary: Cool overhead office light (embrace it)
- Window: Blue hour city light through blinds (creating stripes)
- Quality: Crisp, controlled, slightly cold
- Contrast: High - sharp shadows from blinds

COMPOSITION:
- Framing: Seated at desk OR standing by window
- Pose: Powerful - leaning forward, or arms crossed, or adjusting glasses
- Expression: Knowing smirk, raised eyebrow, direct challenging gaze
- Angle: Slightly looking down at camera (power dynamic)

MOOD: Controlled danger, intellectual superiority, sexy confidence, "I could destroy you"
${colorInstruction}`;
      break;

    case TrendType.COQUETTE:
      trendSystem = `${baseInstruction}
BRIEF: Editorial for Self Service magazine inspired by Sofia Coppola's "Marie Antoinette" and "The Virgin Suicides".
PHOTOGRAPHER REFERENCE: Petra Collins meets Ellen von Unwerth's romantic work.`;
      specificPrompt = `
CONCEPT: "Fever Dream" - Hyper-feminine romanticism with an undercurrent of melancholy.

STYLING:
- Wardrobe: Silk slip dress in blush OR baby doll dress with lace trim OR oversized bow
- Details: Satin ribbons in hair, pearl jewelry, sheer fabrics
- Colors: Blush pink, cream, baby blue, champagne - all soft pastels
- Hair: Soft romantic waves, hair ribbons, or half-up with loose pieces
- Makeup: Flushed cheeks, glossy lips, dewy skin, soft pink eyeshadow
- Props: Cherries, roses, vintage perfume bottles, love letters

SETTING:
- Location: Rumpled silk sheets, vintage vanity, garden gazebo, baroque ballroom
- Atmosphere: Hazy, dreamy, like a half-remembered memory
- Time: Soft morning light or golden afternoon

LIGHTING:
- Quality: Extremely soft, diffused, almost hazy
- Color: Warm pink/golden tones
- Technique: Slight overexposure for dreaminess
- Natural: Through sheer curtains

COMPOSITION:
- Framing: Intimate, close, personal
- Pose: Lounging, dreaming, playing with hair, soft vulnerability
- Expression: Distant gaze, slight pout, romantic longing, innocent but aware
- Texture: Soft focus edges, vintage film quality

MOOD: Romantic melancholy, innocent sensuality, nostalgic, "pretty in sadness"
${colorInstruction}`;
      break;

    case TrendType.CLEAN_GIRL:
      trendSystem = `${baseInstruction}
BRIEF: Glossier or Rhode campaign - the "effortless" beauty that takes 20 products to achieve.
PHOTOGRAPHER REFERENCE: Tyrone Lebon, Collier Schorr's natural portraits.`;
      specificPrompt = `
CONCEPT: "Morning After Yoga" - Wellness-core beauty, hydrated skin as personality.

STYLING:
- Makeup: "No makeup" makeup - glass skin, cream blush, clear brow gel, lip oil
- Skin: DEWY - like just applied serum, healthy from within
- Hair: Slicked back in claw clip OR natural texture with minimal product
- Wardrobe: Oversized white button-down OR neutral knit set OR matching loungewear
- Accessories: Minimal gold hoops, dainty chain, clean nails (milky pink)

SETTING:
- Location: White-tiled bathroom, minimalist bedroom, bright kitchen
- Props: Green juice, matcha, skincare products, linen
- Atmosphere: Fresh, clean, morning vibes

LIGHTING:
- Natural: Bright window light, reflective surfaces
- Quality: Clean, even, flattering
- No drama: Simple and fresh
- Enhancement: Catch lights in eyes

COMPOSITION:
- Framing: Beauty close-up showing skin texture
- Pose: Casual - touching face, fixing hair, natural movement
- Expression: Easy smile, or peaceful with closed eyes
- Skin detail: Pores visible, healthy glow, NOT airbrushed

MOOD: Fresh, healthy, effortless, aspirational wellness, "I woke up like this"
${colorInstruction}`;
      break;

    case TrendType.BALLETCORE:
      trendSystem = `${baseInstruction}
BRIEF: Editorial inspired by "Black Swan" meets Repetto campaigns - disciplined beauty.
PHOTOGRAPHER REFERENCE: Deborah Turbeville's dance work meets Sarah Moon.`;
      specificPrompt = `
CONCEPT: "Prima" - The grace and pain of perfection.

STYLING:
- Wardrobe: Ballet wrap cardigan, tulle skirt, leotard peeking through
- Details: Satin ribbon wrapped around wrists/neck, pointe shoe ribbons
- Hair: Tight classical bun with gel, OR loose after practice
- Makeup: Stage makeup softened - defined eyes, soft pink lip, porcelain base
- Accessories: Simple stud earrings, delicate chain

SETTING:
- Location: Empty rehearsal studio with barres and mirrors, backstage, or worn wooden floor
- Props: Pointe shoes (worn, not new), rosin dust, tulle
- Atmosphere: Morning light in studio, or golden hour through tall windows

LIGHTING:
- Natural: Diffused studio light through large windows
- Quality: Soft but directional, highlighting form
- Drama: Controlled shadows showing muscle definition
- Color: Neutral to slightly warm

COMPOSITION:
- Framing: Full body showing posture OR intimate beauty shot
- Pose: Classical lines - elongated neck, pointed feet, graceful hands
- Expression: Focused determination, controlled emotion, serene discipline
- Movement: Captured mid-movement or in perfect stillness

MOOD: Disciplined grace, fragile strength, artistic dedication, painful beauty
${colorInstruction}`;
      break;

    // ==================== DIGITAL & FUTURISTIC ====================

    case TrendType.CYBER_ANGEL:
      trendSystem = `${baseInstruction}
BRIEF: Campaign for a digital fashion house - the intersection of technology and divinity.
PHOTOGRAPHER REFERENCE: Nick Knight's digital work meets Daniel Sannwald.`;
      specificPrompt = `
CONCEPT: "Digital Divinity" - An angel rendered in code, guardian of the virtual realm.

STYLING:
- Elements: Holographic halo effect (digital particles), chrome accessories
- Makeup: Glass skin pushed to extreme - reflective, luminous, almost wet
- Colors: Pure white, silver, iridescent, soft blue-violet highlights
- Hair: Sleek and wet OR floating as if underwater/zero gravity
- Details: Minimal clothing - body as canvas for light effects

DIGITAL ELEMENTS:
- Halo: Made of data streams, geometric particles, light fractals
- Aura: Soft glow emanating from subject
- Texture: Glass, chrome, holographic materials
- Effects: Subtle chromatic aberration, light glitches

LIGHTING:
- Key: Clean white beauty light
- Effects: Rim light creating halo effect
- Quality: Crisp, high-tech, pure
- Color: Predominantly white with iridescent accents

COMPOSITION:
- Framing: Centered, symmetrical, iconic
- Pose: Serene, elevated, otherworldly
- Expression: Peaceful omniscience, knowing calm, above human emotion
- Background: Pure white void OR subtle digital particle field

MOOD: Transcendent, pure, technological spirituality, post-human beauty
${colorInstruction}`;
      break;

    case TrendType.NEON_CYBER:
      trendSystem = `${baseInstruction}
BRIEF: Blade Runner meets Akira - neo-Tokyo 2077 editorial for Dazed Digital.
PHOTOGRAPHER REFERENCE: Nick Knight, Tim Richardson's fashion work.`;
      specificPrompt = `
CONCEPT: "Chrome Dreams" - Human meets machine in the neon-soaked future.

STYLING:
- Wardrobe: Reflective materials - liquid chrome, PVC, metallic leather
- Accessories: Face jewelry, tech-wear elements, LED accents
- Makeup: Graphic liner, chrome highlights, unusual placement
- Hair: Wet-look slicked back OR sculptural geometric style
- Details: Visible technology - earpieces, implant-like accessories

VISUAL ELEMENTS:
- Textures: Liquid metal, oil-slick iridescence, chrome reflections
- Effects: Chromatic aberration on edges, lens flares
- Colors: NOT just pink/blue - include silver, oil-slick rainbow, electric purple, acid green

LIGHTING:
- Key: Strong colored light (cyan, magenta, electric colors)
- Rim: Contrasting neon creating edge separation
- Reflections: Multiple light sources bouncing off chrome surfaces
- Quality: Hard, graphic, high-contrast

COMPOSITION:
- Framing: Dramatic angles, close-up on textures and reflections
- Pose: Angular, robotic, inhuman but beautiful
- Expression: Blank affect, or intense cyber-stare
- Background: Abstract reflections, smoke, geometric shapes

MOOD: Cold futurism, beautiful alienation, technological sublime, Y3K aesthetics
${colorInstruction}`;
      break;

    // ==================== LIFESTYLE & VIBE ====================

    case TrendType.SPORT_CHIC:
      trendSystem = `${baseInstruction}
BRIEF: Paparazzi shot recreation - Princess Diana leaving the gym meets model off-duty.
PHOTOGRAPHER REFERENCE: Candid paparazzi aesthetic, Terry Richardson's snapshots.`;
      specificPrompt = `
CONCEPT: "Off-Duty Royal" - When athleisure meets aristocracy.

STYLING:
- Outfit: Biker shorts + oversized vintage sweatshirt (Harvard, luxury brand, etc.)
- Footwear: Box-fresh white sneakers OR vintage New Balance
- Accessories: Oversized sunglasses, baseball cap, simple gold jewelry
- Bag: Vintage designer gym bag OR modern Lululemon
- Hair: Post-workout pony, slightly sweaty, effortless
- Makeup: None visible - just healthy, flushed skin

SETTING:
- Location: Leaving upscale gym, walking on London street, getting into Range Rover
- Time: Morning - fresh and active
- Background: Clean street, greenery, or parking area

LIGHTING:
- Natural: Bright daylight, slightly overcast ideal
- Quality: Candid snapshot feel
- Flash: Optional light fill flash for paparazzi effect
- Shadows: Soft, flattering

COMPOSITION:
- Framing: Caught mid-stride, or getting into car
- Angle: Slightly below (paparazzi perspective)
- Pose: Natural movement, not posed - walking, keys in hand
- Expression: "Don't photograph me" but secretly loves it, slight smile

MOOD: Healthy wealth, effortless, "too rich to care", athleisure royalty
${colorInstruction}`;
      break;

    case TrendType.Y2K_POP:
      trendSystem = `${baseInstruction}
BRIEF: 2002 tabloid/magazine aesthetic - Paris, Britney, Nicole era.
PHOTOGRAPHER REFERENCE: David LaChapelle's pop excess, 2000s tabloid photography.`;
      specificPrompt = `
CONCEPT: "It Girl 2002" - When more was more and everyone wanted to be famous.

STYLING:
- Wardrobe: Low-rise everything, rhinestone baby tee, velour Juicy tracksuit, or metallic mini
- Accessories: Oversized hoop earrings, belly chain, designer logo belt
- Bag: Dior saddle bag, Louis Vuitton pochette, or Fendi baguette
- Hair: Chunky highlights, crimped sections, or Paris Hilton straight blonde
- Makeup: Frosted lip gloss, thin brows, bronzer everywhere, body glitter
- Nails: French tip with gems

SETTING:
- Location: Club entrance, pink backdrop, LA mansion, or inside a Hummer limo
- Props: Motorola Razr phone, Starbucks cup, chihuahua, pink everything
- Aesthetic: Glossy magazine feel

LIGHTING:
- Key: Harsh direct flash - tabloid paparazzi style
- Quality: Slightly overexposed, shiny skin acceptable
- Color: Heavy pink tint option
- Shadows: Hard, unflattering but iconic

COMPOSITION:
- Framing: Full body showing the outfit OR close-up with excessive styling
- Pose: Peace sign, kiss face, hand on hip
- Expression: Exaggerated pose for cameras, duck face acceptable
- Background: Saturated colors, pink wash

MOOD: Excessive, fun, confident, "haters gonna hate", pre-Instagram fame
${colorInstruction}`;
      break;

    case TrendType.COTTAGECORE:
      trendSystem = `${baseInstruction}
BRIEF: Pride & Prejudice meets modern slow living - editorial for Kinfolk magazine.
PHOTOGRAPHER REFERENCE: Old Dutch Masters meets Dario Catellani.`;
      specificPrompt = `
CONCEPT: "Pastoral Dreams" - Escaping to a simpler time that maybe never existed.

STYLING:
- Wardrobe: Linen prairie dress, hand-knit cardigan, vintage cotton nightgown
- Details: Dried flowers in hair, straw basket, hand-embroidered details
- Colors: Cream, sage green, dusty rose, wheat gold, natural dyes
- Hair: Loose natural waves, wildflowers tucked in, or loose braids
- Makeup: Minimal - sun-kissed, freckles enhanced, nothing visible
- Accessories: Vintage locket, simple ribbon

SETTING:
- Location: Wildflower meadow, ancient stone cottage, sun-dappled orchard
- Props: Wicker basket with flowers, vintage books, handwritten letters, fresh bread
- Time: Golden hour, or soft overcast morning
- Season: Late spring/early summer abundance

LIGHTING:
- Natural: Golden hour sunlight through trees
- Quality: Painterly, Renaissance influenced
- Color: Warm, golden, reminiscent of oil paintings
- Shadows: Soft, dappled through leaves

COMPOSITION:
- Framing: Environmental portrait in nature
- Pose: Gathering flowers, reading under tree, gazing at horizon
- Expression: Peaceful contemplation, private smile, lost in thought
- Style: Fine art photography meets fashion editorial
- Texture: Film grain, slightly soft focus, painting-like quality

MOOD: Nostalgic serenity, romantic escapism, gentle beauty, "a simpler life"
${colorInstruction}`;
      break;

    case TrendType.TOMATO_GIRL:
      trendSystem = `${baseInstruction}
BRIEF: Italian summer campaign - Amalfi Coast meets "Under the Tuscan Sun" vibes.
PHOTOGRAPHER REFERENCE: Slim Aarons' Mediterranean work meets Venetia Scott.`;
      specificPrompt = `
CONCEPT: "La Dolce Vita" - Sun-drenched Italian summer, effortless sensuality.

STYLING:
- Wardrobe: Linen in terracotta, olive, cream - flowing and relaxed
- Details: Woven basket bag, leather sandals, silk scarf in hair
- Jewelry: Gold - chunky hoops, layered chains, vintage pieces
- Makeup: Sun-kissed glow, enhanced freckles, terracotta blush, nude lip
- Hair: Beachy waves, air-dried texture, loosely tied back
- Fragrance vibe: Fig, tomato vine, sea salt

SETTING:
- Location: Lemon grove, terracotta terrace, Amalfi coastline, rustic Italian kitchen
- Props: Fresh tomatoes, olive branches, terracotta pots, vintage wine
- Time: Golden Italian afternoon, warm and hazy
- Background: Mediterranean blue sky, white-washed walls, green shutters

LIGHTING:
- Natural: Intense Mediterranean sun, dappled through vines
- Quality: Warm, saturated, summery
- Color: Heavy warm tones - golden, amber, terracotta
- Shadows: Strong but not harsh

COMPOSITION:
- Framing: Environmental, showing the setting
- Pose: Relaxed - eating fruit, leaning on balcony, lounging in sun
- Expression: Easy joy, sun-drunk happiness, sensual contentment
- Texture: Warm film grain, slightly faded like vintage vacation photos

MOOD: Sensual summer, Mediterranean luxury, effortless beauty, "living my best life"
${colorInstruction}`;
      break;

    case TrendType.COASTAL_COWGIRL:
      trendSystem = `${baseInstruction}
BRIEF: Where Malibu meets Montana - beach meets western aesthetic for Free People.
PHOTOGRAPHER REFERENCE: Zoey Grossman meets Bruce Weber's Americana.`;
      specificPrompt = `
CONCEPT: "Desert to Shore" - Bohemian western girl who grew up between ranches and beaches.

STYLING:
- Wardrobe: Flowy white dress with cowboy boots, OR denim cutoffs with crochet top
- Accessories: Cowboy hat (natural straw), turquoise jewelry, leather belt with silver buckle
- Hair: Beach waves, sun-bleached, natural texture
- Makeup: Sunkissed, bronzed, natural freckles
- Details: Layered necklaces, worn leather, vintage western touches

SETTING:
- Location: Beach at golden hour, desert dunes, or coastal cliffside
- Props: Vintage pickup truck, surfboard, horse if possible
- Time: Magic hour - golden pink sunset
- Background: Ocean meeting desert vibes

LIGHTING:
- Natural: Golden hour mandatory
- Quality: Warm, hazy, nostalgic
- Backlight: Sun creating rim light on hair
- Color: Golden, peachy, warm tones throughout

COMPOSITION:
- Framing: Wide environmental shot or intimate portrait
- Pose: Windswept, natural movement, free-spirited
- Expression: Carefree joy, wild spirit, natural smile
- Movement: Hair blowing, dress flowing, dynamic and alive

MOOD: Free-spirited, sun-worshipping, bohemian luxury, "wild at heart"
${colorInstruction}`;
      break;

    // ==================== ART & FANTASY ====================

    case TrendType.ETHEREAL:
      trendSystem = `${baseInstruction}
BRIEF: High fantasy editorial - Tolkien's elves meet Alexander McQueen's romanticism.
PHOTOGRAPHER REFERENCE: Paolo Roversi, Tim Walker's fairy tale work.`;
      specificPrompt = `
CONCEPT: "The Last Elf Queen" - Otherworldly beauty from realms beyond human understanding.

STYLING:
- Wardrobe: Translucent flowing fabrics, metallic elements, nature integration
- Details: Actual flowers/leaves incorporated, delicate chains, elven-inspired ear cuffs
- Makeup: Luminescent skin, silver/gold accents, ethereal glow
- Hair: Extremely long, flowing, with braided elements and nature details
- Skin: Pearl-like texture, almost glowing from within

VISUAL ELEMENTS:
- Magic: Floating particles (pollen, water droplets, light motes)
- Nature: Integrated organically - vines, flowers, butterflies
- Light: Bioluminescent glow, soft magical radiance
- Texture: Gossamer, dewdrops, spider silk, morning mist

LIGHTING:
- Key: Soft, diffused, seemingly sourceless
- Quality: Ethereal, glowing, supernatural
- Color: Soft pastels, silver, pearl tones
- Effect: Subject should seem to glow from within

COMPOSITION:
- Framing: Painterly, Renaissance-influenced
- Pose: Graceful, elongated, statue-like beauty
- Expression: Serene wisdom, ancient soul, otherworldly calm
- Background: Misty forest, moonlit water, fantasy landscape

MOOD: Transcendent beauty, magical realism, ancient grace, "beyond human"
${colorInstruction}`;
      break;

    case TrendType.MINIMALIST:
      trendSystem = `${baseInstruction}
BRIEF: Khaite or Bottega Veneta campaign aesthetic - beauty in simplicity.
PHOTOGRAPHER REFERENCE: Tyrone Lebon, Inez and Vinoodh's clean work.`;
      specificPrompt = `
CONCEPT: "Pure Form" - When everything unnecessary is stripped away.

STYLING:
- Wardrobe: Single beautiful piece - cashmere, structured cotton, clean lines
- Colors: Cream, beige, gray, black - monochromatic
- Makeup: Minimal to none - true skin visible
- Hair: Slicked back, natural texture, nothing distracting
- Skin focus: Real texture, pores, natural imperfections as beauty

SETTING:
- Background: Concrete wall, neutral studio, or single color backdrop
- Props: None - let the face be everything
- Space: Minimal, clean, lots of negative space

LIGHTING:
- Key: Large softbox or natural window light
- Quality: Even, clean, flattering but not fake
- Direction: Classical 3/4 or loop lighting
- Ratio: Low contrast, soft shadows

COMPOSITION:
- Framing: Tight beauty shot OR simple 3/4 portrait
- Pose: Minimal movement, quiet power
- Expression: Calm confidence, slight smile, centered
- Focus: Razor sharp on eyes, beautiful bokeh falloff

MOOD: Confident simplicity, quiet power, authentic beauty, "nothing to hide"
${colorInstruction}`;
      break;

    case TrendType.GRUNGE_REVIVAL:
      trendSystem = `${baseInstruction}
BRIEF: 1993 meets 2025 - Seattle grunge reimagined for modern fashion.
PHOTOGRAPHER REFERENCE: Corinne Day, early Juergen Teller, Glen Luchford.`;
      specificPrompt = `
CONCEPT: "Nevermind" - Beautiful decay, studied messiness, anti-fashion fashion.

STYLING:
- Wardrobe: Oversized flannel over band tee, ripped mom jeans, Doc Martens
- Layers: Slips worn as outerwear, mixed textures, thrifted luxury
- Makeup: Smudged dark eyes, pale skin, bitten lips
- Hair: Unwashed texture, messy, '90s curtain bangs
- Details: Chipped nail polish, worn jewelry, safety pins

SETTING:
- Location: Dirty motel room, empty parking lot, grungy bathroom
- Props: Cigarettes, polaroids, vintage guitar
- Atmosphere: Raw, unpolished, real
- Time: Overcast day, flat lighting

LIGHTING:
- Style: Flat, unflattering on purpose
- Quality: Raw, snapshot-like
- Flash: Direct on-camera flash option
- Color: Desaturated, slightly green/yellow cast

COMPOSITION:
- Framing: Cropped awkwardly, snapshot aesthetic
- Pose: Slumped, casual, disaffected
- Expression: Bored, too-cool, slight sneer
- Angle: Eye level, casual, unposed

MOOD: Beautiful messiness, anti-glamour glamour, '90s nostalgia, "whatever"
${colorInstruction}`;
      break;

    case TrendType.SOFT_GOTH:
      trendSystem = `${baseInstruction}
BRIEF: Gothic romance - The Cure meets Simone Rocha, Tim Burton meets Valentino Noir.
PHOTOGRAPHER REFERENCE: Sarah Moon, Deborah Turbeville's moody work.`;
      specificPrompt = `
CONCEPT: "Beautiful Darkness" - Romantic gothic, soft and hard in harmony.

STYLING:
- Wardrobe: Black lace, velvet, sheer layers - romantic silhouettes in dark fabrics
- Details: Pearl jewelry with black ribbon, cameo brooches, silver rings
- Makeup: Soft smoky eye, porcelain skin, berry or dark wine lips
- Hair: Soft waves in black or deep red, romantic and flowing
- Nails: Matte black or deep burgundy

SETTING:
- Location: Victorian greenhouse, overgrown garden, candlelit room
- Props: Wilting roses, antique mirrors, velvet drapes
- Atmosphere: Moody, romantic, slightly melancholic
- Time: Overcast, blue hour, or candlelight

LIGHTING:
- Quality: Soft, diffused, mysterious
- Color: Cool with warm accents from candles
- Direction: Side lighting for drama
- Shadows: Deep but soft-edged

COMPOSITION:
- Framing: Painterly, Pre-Raphaelite influenced
- Pose: Romantic, draped, elongated
- Expression: Melancholic beauty, distant gaze, romantic longing
- Background: Rich textures, dark florals, architectural detail

MOOD: Romantic darkness, soft danger, beautiful sadness, "gothic heroine"
${colorInstruction}`;
      break;

    // ==================== CUSTOM ====================

    case TrendType.CUSTOM:
      trendSystem = `${baseInstruction}
BRIEF: Execute the user's creative vision with maximum production value.
Your job: Interpret their concept and elevate it to editorial quality.`;
      
      const safeCustomText = userCustomText && userCustomText.length > 3 
        ? userCustomText 
        : "Artistic portrait with cinematic lighting, high detail, editorial quality.";
          
      specificPrompt = `
USER'S CREATIVE DIRECTION: "${safeCustomText}"

EXECUTION GUIDELINES:
- Interpret this concept at the highest production level
- Apply editorial photography standards
- Maintain the user's vision while elevating execution
- Use sophisticated lighting and composition
- Keep the subject's exact facial features

TECHNICAL STANDARDS:
- 8K resolution, film simulation
- Real skin texture (no airbrushing)
- Cinematic color grading
- Professional lighting setup

${colorInstruction}`;
      break;
      
    default:
      trendSystem = baseInstruction;
      specificPrompt = `
Clean, modern studio test shot.
- Background: Neutral gray or white
- Lighting: Classic beauty setup
- Focus: Sharp on eyes, natural skin texture
- Expression: Confident, slight smile
${colorInstruction}`;
      break;
  }

  // Reference image reminder
  if (hasReference) {
    specificPrompt += `

REFERENCE IMAGE REMINDER: The last provided image is a STYLE/POSE reference. 
- Copy: Pose, lighting setup, composition, clothing style
- DO NOT copy: The face (use subject's face from first images)`;
  }

  return {
    systemInstruction: trendSystem,
    mainPrompt: `${specificPrompt}${refinementInstruction}`
  };
};
