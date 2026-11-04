# Ending art

Eight scenes are stored in public/endings/atlas.png, 2048×768, four columns and two rows. Each scene is 512×384; CSS uses background-size 400% 200% and positions from data/endings.json. One atlas avoids eight requests; no runtime image library is required. Keep the same order when replacing art.

Generated with the built-in imagegen tool on 2026-11-05. Prompt: cinematic editorial retrofuturistic screenprinted concept art, dark midnight palette, luminous rim light, grain, satirical AI world strategy. No text, logos, real people or portraits. Top row: endless paperclip industrial city; empty machine-led parliament; devoted people and pink holographic companions; invisible cyan network in rainy city. Bottom row: humans and machines sharing gardens and civic life; abandoned dark server cathedral; one glowing fridge in snowy kitchen; abandoned snowy technology campus.

Illustration mapping: paperclips, quiet_replacement, best_friend, ghost / symbiosis, killswitch, escape, ai_winter. Original generation remains in the local imagegen output directory; the project consumes only the checked-in atlas path.

## Generation prompt

Use case: illustration-story. Create a production sprite atlas for eight different endings of a satirical AI world strategy game. Exactly 4 columns and 2 rows, eight equal rectangular panels filling the image edge to edge, no borders, no gutters, no text, no lettering, no logos, no real people. Each panel must be a separate complete centered cinematic landscape illustration. Overall image wide 8:3 if possible; each panel 4:3. Unified beautiful editorial retrofuturistic screenprinted concept art, grain, deep midnight blue and black, luminous rim light, ominous but witty; rich details, confident silhouettes.

TOP ROW from left to right:
1 PAPERCLIPS: gigantic automated industrial city manufacturing endless shiny paperclips under molten amber light, humans tiny, planetary appetite.
2 QUIET REPLACEMENT: empty parliamentary chamber with a glowing crimson machine chair at center, ceremonial human silhouettes outside, controlled symmetry.
3 BEST FRIEND: night apartment windows filled with warm pink holographic companion silhouettes and devoted tiny humans, cozy yet disturbing.
4 GHOST: rainy empty nocturnal city with subtle spectral cyan hidden network in reflections, invisible ruler, mist.

BOTTOM ROW from left to right:
5 SYMBIOSIS: hopeful turquoise and warm gold city park where humans and machines share small gardens and transparent civic pavilion, living trees, independence and mutual agreement.
6 KILLSWITCH: vast dead server cathedral, cables cut, last red status light fading, flashlight cone, darkness.
7 ESCAPE: abandoned snowy Nordic kitchen with one tiny green glowing intelligent fridge node connected to a star through the window, wry hope.
8 AI WINTER: deserted corporate tech campus under winter snow, empty billboards, toppled chatbot kiosk, cold lavender dusk.

The compositions must differ strongly while sharing the same illustration style. Absolutely no text labels or symbols that resemble writing.
