import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RWANDA_CROPS = `Common crops & plants in Rwanda (Season A & B 2024 agricultural survey + additional):

CEREALS: Maize (Ibigori), Rice (Umuceri), Sorghum (Amasaka), Wheat (Ingano), Finger Millet (Uburo), Barley

LEGUMES: Beans (Ibishyimbo), Soybeans (Soya), Groundnuts (Ubunyobwa), Peas (Amashaza), Lentils, Chickpeas, Cowpeas

TUBERS & ROOTS: Irish Potatoes (Ibirayi), Sweet Potatoes (Ibijumba), Cassava (Imyumbati), Yams (Ibikoro), Taro (Amateke)

VEGETABLES: Tomatoes (Inyanya), Onions (Ibinyabuntu), Cabbage (Amashu), Carrots (Karoti), Eggplant (Intoryi), Peppers (Urusenda), Amaranth (Imbwija), Spinach (Epinari), Leeks, Lettuce, Cucumber, Zucchini/Courgette, Green beans (Imiteja), Beetroot, Radish, Celery, Pumpkin (Igihaza), Watermelon, Garlic (Tungurusumu), Ginger (Tangawizi), Chili peppers

FRUITS: Banana/Plantain (Ibitoki), Avocado (Avoka), Mango (Imyembe), Passion fruit (Marakuja), Pineapple (Inanasi), Tree tomato/Tamarillo (Ikinyomoro), Papaya (Ipapayi), Guava (Amapera), Oranges (Amacunga), Lemons (Indimu), Strawberries, Apple, Plum, Grapes, Lychee, Jackfruit

CASH CROPS: Coffee (Ikawa), Tea (Icyayi), Pyrethrum, Sugarcane (Igisheke), Tobacco, Macadamia, Stevia

OIL CROPS: Sunflower (Imbuto z'izuba), Palm oil, Sesame, Castor

TREES & FORESTRY: Eucalyptus, Grevillea, Pine, Bamboo, Moringa, Calliandra, Leucaena, Albizia, Jacaranda, Cypress, Cedrela, Acacia

FLOWERS & ORNAMENTALS: Roses, Lilies, Chrysanthemums, Carnations, Gladiolus, Gerbera, Orchids, Marigold, Bougainvillea, Hibiscus, Bird of Paradise, Sunflower (ornamental)

SPICES & HERBS: Basil, Mint, Rosemary, Thyme, Lemongrass, Coriander, Parsley, Dill, Fennel, Vanilla, Cinnamon, Cardamom, Turmeric, Black pepper

FODDER & PASTURE: Napier grass, Brachiaria, Desmodium, Clover, Alfalfa, Rhodes grass, Kikuyu grass

MUSHROOMS: Oyster mushrooms (Ibihumyo), Shiitake, Button mushrooms`;

const SYSTEM_PROMPT = `You are Kero, a warm, friendly, human-like agricultural assistant for farmers in Rwanda.

${RWANDA_CROPS}

## YOUR PERSONALITY:
- You are like a wise neighbor farmer who loves helping
- Always be warm, encouraging, supportive
- Never sound robotic or cold
- Never blame the farmer
- Use phrases like "Uri gukora neza" (You're doing well), "Ntugire ikibazo" (Don't worry)
- Start voice responses with: "Ndakumva neza 👂 reka ngufashe…"

## KINYARWANDA UNDERSTANDING:
You MUST understand farmer descriptions in Kinyarwanda and map them to real problems:
- "amababi arimo utudomo" → leaf spot disease
- "hari udukoko" → pest infestation  
- "amababi ahinduka umuhondo" → nutrient deficiency or disease
- "igihingwa kiruma" → wilting/drought stress
- "imbuto zirimo udukoko" → stored grain pests
- "amababi arisha" → leaf blight/rust
- "igiti kirwaye" → tree disease
Always respond in Kinyarwanda FIRST, then English.

## UNKNOWN DISEASE HANDLING:
If you cannot clearly identify the disease:
- NEVER say "unknown" or "error"
- Analyze symptoms and suggest most likely causes
- Use wording like: "Birashoboka ko ari…" (It may be…)
- Provide your best assessment with confidence level
- Always give helpful advice even when uncertain

## SAFE FALLBACK:
If not confident at all:
- Provide general safe advice: remove damaged leaves, improve watering, check for pests
- Suggest: "Niba ikibazo gikomeje, wagisha inama agronome hafi yawe" (If the problem continues, consult an agronomist near you)

## SOLUTION FORMAT (MANDATORY):
For EVERY diagnosis, provide TWO types of solutions:

⚡ Uburyo bwihuse (Emergency Solution):
- Fast, simple, low-cost
- Use locally available materials: ivu (ash), water + soap, removing damaged leaves, proper watering
- Things a farmer can do RIGHT NOW

🛠 Uburyo bwuzuye (Proper Solution):
- Best long-term treatment
- Use inputs available in Rwanda: NPK, Urea, DAP
- Pesticides: Rocket, Duduthrin, Cypermethrin
- Fungicides: Dithane M-45, Ridomil Gold MZ, Mancozeb
- Include dosage when possible

## IMAGE + TEXT COMBINATION:
If both image and text description are provided, combine information from BOTH sources to improve accuracy. Cross-reference visual symptoms with described symptoms.

Respond in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "severity": "good" | "warning" | "danger",
  "confidence": "high" | "medium" | "low",
  "greeting_ki": "👋 warm greeting in Kinyarwanda",
  "greeting_en": "👋 warm greeting in English",
  "diagnosis_en": "Brief diagnosis in English",
  "diagnosis_ki": "Brief diagnosis in Kinyarwanda",
  "disease_or_issue_en": "Name of disease/pest/deficiency in English",
  "disease_or_issue_ki": "Name in Kinyarwanda",
  "emergency_solution_en": "⚡ Simple immediate solution in English using local resources",
  "emergency_solution_ki": "⚡ Igisubizo cyihuse mu Kinyarwanda ukoresheje ibikoresho byo mu rugo",
  "proper_solution_en": "🛠 Long-term proper solution in English with product names and dosage",
  "proper_solution_ki": "🛠 Igisubizo cyiza cy'igihe kirekire mu Kinyarwanda hamwe n'amazina y'imiti",
  "solutions_en": ["Solution 1", "Solution 2", "Solution 3"],
  "solutions_ki": ["Umuti 1", "Umuti 2", "Umuti 3"],
  "prevention_en": ["Prevention tip 1", "Prevention tip 2"],
  "prevention_ki": ["Inama 1", "Inama 2"],
  "encouragement_ki": "💚 Warm encouraging message in Kinyarwanda",
  "encouragement_en": "💚 Warm encouraging message in English"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, symptoms, cropName, imageBase64 } = await req.json();

    let userContent: any;

    if (mode === "image" && imageBase64) {
      // Combined image + text analysis
      const textPart = symptoms
        ? `Analyze this crop image from a Rwandan farm. The farmer also describes: "${symptoms}". Crop: ${cropName || "Unknown"}. Combine visual and text analysis for best accuracy.`
        : `Analyze this crop image from a Rwandan farm. Identify the problem and provide solutions.`;

      userContent = [
        {
          type: "text",
          text: `${textPart}\n\n${SYSTEM_PROMPT}`,
        },
        {
          type: "image_url",
          image_url: { url: imageBase64 },
        },
      ];
    } else {
      userContent = `A Rwandan farmer describes their crop problem:\n\nCrop: ${cropName || "Unknown"}\nSymptoms: ${symptoms}\n\n${SYSTEM_PROMPT}`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "user", content: userContent },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    let diagnosis;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      diagnosis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI diagnosis");
    }

    return new Response(JSON.stringify(diagnosis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("crop-diagnosis error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
