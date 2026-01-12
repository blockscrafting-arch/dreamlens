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
    ? `COLOR PALETTE: Dominant ${dominantColor} aesthetic.` 
    : "COLOR PALETTE: Curated, sophisticated color grading.";

  // UPDATED IDENTITY INSTRUCTION - Explicitly tells model about image order if reference exists
  const identityInstruction = `
    IDENTITY PRESERVATION (CRITICAL):
    1. The first images provided are the USER/SUBJECT. 
    2. You MUST use the facial features from the USER images.
    ${hasReference ? '3. The FINAL (Last) image is a STYLE/POSE REFERENCE. Do NOT copy the face from the last image. Use the last image ONLY for pose, lighting, and composition.' : ''}
    4. TEXTURE: Use "High-End Film Grain" or "4K Skin Texture". AVOID "plastic" smooth skin. 
    5. AGE: Keep the subject youthful but REALISTIC.
  `;

  // UPDATED BASE INSTRUCTION
  const baseInstruction = `
    You are a visionary fashion photographer shooting for Dazed, Vogue Italia, or Numero.
    Your style is: EDITORIAL, TEXTURAL, AUTHENTIC, CONTEMPORARY.
    
    ${identityInstruction}

    STYLE RULES:
    1. IMAGE QUALITY: Raw 8k resolution, Kodak Portra 400 simulation.
    2. LIGHTING: Complex, interesting lighting (Mixed sources, Cinematic).
    3. VIBE: Character, Story, High Fashion.
  `;

  // If the user wants to refine the result, we override the main prompt logic slightly
  const refinementInstruction = refinementText 
    ? `\n\nUSER ADJUSTMENT REQUEST (PRIORITY: HIGHEST): "${refinementText}". Apply this change to the image while keeping the general style.`
    : "";

  let specificPrompt = "";
  let trendSystem = baseInstruction;

  switch (trend) {
    case TrendType.MAGAZINE:
      trendSystem = `${baseInstruction} Create an avant-garde "Dazed & Confused" cover.`;
      specificPrompt = `High-fashion editorial shot.
        Concept: "Modern Art Muse". 
        Outfit: Sculptural, oversized, texture-heavy (feathers or chrome).
        Lighting: Harsh studio flash or colored gels.
        Pose: Dynamic, broken angles, non-standard.
        Background: Minimalist infinity wall or abstract set design.
        ${colorInstruction}`;
      break;

    case TrendType.COUPLE:
      trendSystem = `${baseInstruction} Create a cinematic movie still.`;
      specificPrompt = `A candid shot of the subject with a stylish partner (back turned or out of focus).
        Vibe: Wong Kar-wai film aesthetic, blurred lights, intimacy.
        Location: Night city taxi or rooftop bar.
        Lighting: Bokeh, city lights reflection, moody.
        ${colorInstruction}`;
      break;

    case TrendType.RETRO_2K17:
      trendSystem = `${baseInstruction} Create a raw "Indie Sleaze" aesthetic.`;
      specificPrompt = `Direct flash photography (snapshot style).
        Vibe: 3AM party, chaotic but stylish.
        Makeup: Smudged eyeliner, glossy lips.
        Outfit: Sequin dress or leather jacket.
        Background: Dark club corner or street at night.
        ${colorInstruction}`;
      break;
    
    case TrendType.OFFICE_SIREN:
      trendSystem = `${baseInstruction} Create a "Miu Miu / Gucci" librarian aesthetic.`;
      specificPrompt = `The subject in sharp "Office Siren" look.
        Details: Rectangular bayonetta glasses, messy bun with pencils.
        Outfit: Fitted grey cardigan, pencil skirt.
        Lighting: Cool fluorescent office light turned cinematic.
        Vibe: Sharp, intelligent, slightly dangerous.
        ${colorInstruction}`;
      break;

    case TrendType.OLD_MONEY:
      trendSystem = `${baseInstruction} Create a "Ralph Lauren" heritage campaign.`;
      specificPrompt = `Analog film photo (medium format).
        Location: Italian Lake Como villa or Swiss Alps terrace.
        Outfit: Loro Piana style knitwear, silk scarf.
        Lighting: Natural sunlight, soft shadows.
        Vibe: Effortless generational wealth, nothing flashy.
        ${colorInstruction}`;
      break;

    case TrendType.ETHEREAL:
      trendSystem = `${baseInstruction} Create a "High Fantasy Editorial" aesthetic.`;
      specificPrompt = `Surreal portrait of the subject.
        Style: Grimes / Art Angels aesthetic mixed with Renaissance.
        Elements: Floating water droplets, soft glowing skin (pearl texture).
        Outfit: Translucent fabrics, armor elements.
        Lighting: Bioluminescent glow.
        ${colorInstruction}`;
      break;

    case TrendType.MINIMALIST:
      trendSystem = `${baseInstruction} Create a "Skims / Rhode" campaign aesthetic.`;
      specificPrompt = `Studio beauty shot, very close up.
        Focus: Real skin texture, freckles, wet hair look.
        Background: Concrete or textured beige wall.
        Lighting: Softbox, diffused daylight.
        Vibe: Raw, honest, clean.
        ${colorInstruction}`;
      break;

    case TrendType.NEON_CYBER:
      trendSystem = `${baseInstruction} Create a "Liquid Chrome" 3D art aesthetic.`;
      specificPrompt = `Futuristic portrait.
        Elements: Liquid metal textures, chromatic aberration.
        Outfit: Digital fashion, reflective materials.
        Lighting: Iridescent reflections (not just pink/blue, use silver/oil slick colors).
        Vibe: Y3K, Post-human.
        ${colorInstruction}`;
      break;

    case TrendType.PROFESSIONAL:
      trendSystem = `${baseInstruction} Create a modern "Tech CEO" portrait.`;
      specificPrompt = `Modern editorial business portrait.
        Outfit: Minimalist black turtleneck or architectural blazer.
        Background: Abstract blurred glass or modern art gallery.
        Lighting: Rembrandt lighting, serious and intelligent.
        Vibe: Visionary, Forbes 30 under 30.
        ${colorInstruction}`;
      break;
    
    case TrendType.COQUETTE:
      trendSystem = `${baseInstruction} Create a "Sofial Coppola" movie aesthetic.`;
      specificPrompt = `Dreamy, soft-focus film shot.
        Props: Cherries, white lace, satin ribbons.
        Filter: Hazy, pastel, sun-drenched.
        Vibe: Melancholic romance, innocent but stylish.
        ${colorInstruction}`;
      break;

    case TrendType.DARK_ACADEMIA:
      trendSystem = `${baseInstruction} Create a "Harry Potter meets Vogue" aesthetic.`;
      specificPrompt = `Moody portrait in a gothic architecture setting.
        Outfit: Tweed coat, dark textures.
        Lighting: Candlelight or gloomy window light.
        Vibe: Secret society, ancient knowledge.
        ${colorInstruction}`;
      break;

    case TrendType.Y2K_POP:
      trendSystem = `${baseInstruction} Create a "Britney/Paris 2000s" paparazzi shot.`;
      specificPrompt = `Low-rise jeans, rhinestone t-shirt, pink tints.
        Lighting: Harsh camera flash.
        Vibe: Juicy Couture era, defiant, fun.
        ${colorInstruction}`;
      break;

    case TrendType.COTTAGECORE:
      trendSystem = `${baseInstruction} Create a "Pride & Prejudice" film still.`;
      specificPrompt = `Oil painting style lighting in nature.
        Outfit: Linen dress, straw hat.
        Environment: Wildflower field, picnic.
        Vibe: Slow life, organic, warm earth tones.
        ${colorInstruction}`;
      break;
    
    case TrendType.A_LA_RUSSE:
      trendSystem = `${baseInstruction} Create a "Doctor Zhivago" luxury editorial.`;
      specificPrompt = `Winter shot in high resolution.
        Outfit: Massive vintage fur coat, pearl jewelry.
        Makeup: Red cheeks (cold), red lips.
        Background: Snowy Red Square or winter forest.
        Vibe: Russian Aristocracy, cold but rich.
        ${colorInstruction}`;
      break;

    case TrendType.MOB_WIFE:
      trendSystem = `${baseInstruction} Create a "Sopranos" fashion editorial.`;
      specificPrompt = `Flashy, loud luxury.
        Outfit: Vintage leopard print coat, big black sunglasses, gold chains.
        Hair: Big blowout hair (90s style).
        Vibe: "Don't mess with me", Italian glamour.
        ${colorInstruction}`;
      break;

    case TrendType.CYBER_ANGEL:
      trendSystem = `${baseInstruction} Create a "Digital Divinity" aesthetic.`;
      specificPrompt = `Portrait with halo elements made of data or light.
        Skin: Glass skin effect.
        Colors: White, Silver, Holographic.
        Vibe: Ethereal tech, guardian of the internet.
        ${colorInstruction}`;
      break;

    case TrendType.SPORT_CHIC:
      trendSystem = `${baseInstruction} Create a "Princess Diana" gym aesthetic.`;
      specificPrompt = `Paparazzi style or vintage magazine shot.
        Outfit: Biker shorts, oversized sweatshirt, expensive sneakers.
        Location: Leaving a luxury gym or country club.
        Vibe: "Off-duty model", healthy, wealthy.
        ${colorInstruction}`;
      break;

    case TrendType.CUSTOM:
      trendSystem = `${baseInstruction} Execute the user's vision with High-End Production value.`;
      // FALLBACK PROTECTION: If user cleared text, use a generic safe prompt
      const safeCustomText = userCustomText && userCustomText.length > 3 
          ? userCustomText 
          : "Artistic portrait of the user, cinematic lighting, high detail, 8k resolution.";
          
      specificPrompt = `Artistic interpretation of: "${safeCustomText}".
        Face: Use the user's face exactly.
        Style: Cinematic, detailed, expensive.
        ${colorInstruction}`;
      break;
      
    default:
      specificPrompt = "Clean, modern studio test shot. Neutral background. Focus on eyes and skin texture.";
      break;
  }

  // Ensure reference instruction is reiterated in main prompt if present
  if (hasReference) {
      specificPrompt += `\n\nNOTE: A reference image has been provided (the last image). Adopt the pose, lighting, and clothing style of that image, but keep the user's face.`;
  }

  return {
    systemInstruction: trendSystem,
    mainPrompt: `${specificPrompt} ${refinementInstruction}`
  };
};