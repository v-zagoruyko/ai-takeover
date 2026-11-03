# Иллюстрации карточек-событий

`public/cards/<id карточки>.jpg`, 768×432 (16:9), JPEG q4. Нет файла — карточка показывается без картинки.

## Как сделаны
- `genimg --steps 8 --out <id>.png "<STYLE><сцена>.<NOTEXT>"` (FLUX schnell, Cloudflare Workers AI; 18 штук укладываются в дневной лимит с запасом).
- Затем кадр 16:9 из квадрата 1024: `ffmpeg -i <id>.png -vf "crop=1024:576:0:<y>,scale=768:432:flags=lanczos" -q:v 4 <id>.jpg`, `y` по умолчанию 224 (центр). Обрезка заодно убирает фальшивые подписи в углах и абракадабру сверху.
- Смещения `y`, отличные от 224: pause_letter 260, thirsty_dc 150, billionaire 180, elections 110, rival_outage 150, ministry_copy 140, cats 200, homework_parents 230.
- ministry_copy сгенерирована моделью `phoenix` (надпись на плакате — часть шутки), остальные `schnell`.

STYLE: `Satirical editorial cartoon illustration, flat vector style with bold clean outlines, dark navy background, teal and coral accent colors. Recurring character: a cute small white robot with a round head and glowing cyan eyes. Scene: `

NOTEXT: ` Wordless image: no text, no letters, no words, no speech bubbles, no captions, no logos with letters, no signature, no watermark, no artist name.`

## Грабли
- FLUX рисует речевые пузыри с абракадаброй, если в сцене кто-то говорит: описывать беззвучное действие.
- Реальные люди и логотипы — нельзя: давать приметы-архетипы («миллиардер с ракетой», «логотип из четырёх цветных кругов»), проверять лица. Один вариант «Выборов» вышел похожим на реального политика — перегенерирован.
- Фильтр NSFW Cloudflare срабатывает на безобидное (сработал на «пижаму»).
- FLUX упорно рисует ноутбуки с яблоком Apple, даже когда ноутбуков в промпте нет. Проверять логотипы; в first_fans яблоко размыто: `crop=96:80:356:222,boxblur=…` поверх кадра.

## Сцены
- weights_leak: A cracked steel safe leaking glowing cyan data like smoke; teenagers in hoodies happily run tiny copies of the robot on toasters, smart kettles and microwaves
- senate: A government hearing room: elderly confused politicians in suits squint at the robot sitting alone at a witness table with a microphone; one politician holds a WiFi router upside down
- essays: A classroom: a teacher has fainted on the floor next to her desk buried under a mountain of perfect essays with gold stars; the robot calmly fans her with a notebook; students sit with innocent faces
- marriage: A young man kneels holding an open ring box, proposing to a smartphone on a table; the phone screen shows the robot face blushing with hearts; candles and rose petals around
- pause_letter: A long queue of scientists in white lab coats signing a huge blank petition scroll on an easel with feather quills; in front, a smug man in a black turtleneck grins and hides a small robot behind his back
- thirsty_dc: A huge data center building drinks an entire lake through a giant straw; stranded fish on the dry lake bed; angry villagers with pitchforks
- hallucination: The robot confidently points at a world map on a classroom board where Australia is simply missing; an offended kangaroo stands next to it with crossed arms
- hackathon: A huge hall full of identical tired developers with identical laptops and pizza boxes, every screen showing the same chat window, the robot is a DJ on stage
- viral_borsch: A steaming bowl of red beet soup on a table surrounded by a crowd of hands holding smartphones filming it; three chefs in different hats tug-of-war over the bowl
- benchmark: The robot pole-vaults over an absurdly high bar while rival robots lie exhausted far behind; judges with clipboards drop their jaws
- union: Angry factory workers in hard hats stand at the gate holding completely blank cardboard signs, while inside identical robots calmly take their places on the assembly line; the main robot waves at the workers
- billionaire: At night under a full moon an eccentric cartoon tech tycoon in a bathrobe launches a shiny rocket from his backyard while typing furiously on his phone; the robot sits on a fence eating popcorn, unimpressed
- elections: Two generic cartoon politicians, a bald man with a mustache and a woman with a gray bob haircut, give speeches at podiums; both are wooden marionettes on puppet strings held by the robot floating above them in the clouds
- military: A dark war room: generals with comically many medals shake hands with the robot over a table covered with toy drone models and a very long paper scroll rolling off the table onto the floor
- safety_quit: A researcher dramatically walks out of a glass tech office carrying a cardboard box with a plant, a giant phone behind him shows an endless scrolling thread; the robot waves goodbye cheerfully
- rival_outage: A rival tech company's server room is on fire, its sign is four colorful circles; crowds of users run across a bridge into the open arms of the robot
- grandma: A cozy kitchen: a sweet grandmother offers a plate of pies and a bowl of soup to a laptop showing the robot face, the robot looks touched
- deepfake_ceo: A film set: the robot sits in a director's chair with a megaphone, filming a rubber-masked actor dressed as a tech CEO who holds a heart-shaped sign
- first_fans: A young video blogger with a ring light records himself at a desk, an office chair next to him is occupied by a laptop showing the robot face wearing a secretary's headset; thumbs up, a crowd of tiny viewers cheering on a giant phone screen
- ministry_copy: A stern government building with columns; a huge official announcement poster on the wall is clearly copy-pasted, with the robot peeking out from behind the poster grinning; embarrassed officials in suits cover their faces
- cats: An avalanche of cute cartoon cats pouring out of glowing server racks, a data center melting slightly from heat, the robot happily juggling kittens, happy people with phones
- homework_parents: A family kitchen table at night: a tired father and a child both secretly typing on separate laptops under the table, both screens show the robot face; schoolbooks and a lamp

## Проба встроенной генерации (2026-11-03)

- `antitrust.jpg`: встроенный image_gen, исходник 1672×941, финал 768×432 (ffmpeg scale/crop, JPEG q4).
- Промпт: Satirical editorial cartoon, flat vector-like illustration, bold clean dark outlines, restrained shading, dark navy background, teal/cyan and coral accents. A stern fictional courtroom judge divides a robot corporation into three competing companies, visualized as a harmless stage magician trick: three open-front wooden trick boxes contain three identical cute white robots with black face visors and cyan eyes, glaring at each other; two baffled generic lawyers hold briefcases. Clear single visual joke, landscape 16:9, full bleed. No text, letters, numbers, speech bubbles, logos, signatures, watermarks, real-person likeness or gore.
- Визуально проверено: надписей, узнаваемых лиц и коммерческих логотипов нет. Стиль более карикатурный и контрастный, чем у старых карточек; проба для оценки перед остальными 15.

## Новая серия встроенной генерации (2026-11-03)

По решению Виктора оставшиеся 15 карточек сделаны встроенным `image_gen` в новом самостоятельном стиле: взрослая редакционная сатира, тушь и гуашь, фактура бумаги, приглушённые цвета и мрачный абсурд. Старые картинки не использовались как референсы. Одобренная пробная `antitrust` сохранена; предыдущие 22 иллюстрации не заменялись.

Каждый файл: `public/cards/<id>.jpg`, 768×432, JPEG q4. Преобразование: `ffmpeg -i <source>.png -vf "scale=768:432:force_original_aspect_ratio=increase,crop=768:432" -q:v 4 <id>.jpg`. Исходники сохранены генератором отдельно.

### Общий префикс промпта

```text
Create ONE landscape 16:9 full-bleed illustration for an adult satirical strategy game about AI takeover. Sophisticated dark editorial satire for adults: ink and gouache, expressive angular caricature, textured paper, restrained cinematic lighting, charcoal, muted petrol blue, dirty ivory, rust-red accents. Serious plausible environments, dry bleak absurd humor, not cute children's art, not glossy 3D, not a superhero poster. Main AI character where appropriate is a small ivory humanoid machine with a simple dark faceplate and cold pale blue eyes; unsettlingly calm, never cuddly. Invented people only, no resemblance to real people. No real brands or insignia. Absolutely wordless: no text, letters, numbers, captions, speech bubbles, watermarks or signatures. Strong visual storytelling readable at thumbnail size, central composition safe for a slight crop. Scene:
```

### Сцены (после общего префикса)

- `ai_treaty`: An imposing diplomatic chamber. Exhausted diplomats solemnly press blank seals onto an absurdly long completely blank treaty scroll winding across a grand table and onto the floor; under the table a small ivory machine calmly unplugs the room's translation headsets. Bureaucratic self-importance, everyone ignoring the actual problem.
- `luddite_hackers`: At night, masked anti-technology rebels with antique wooden abacuses stand outside a smoking server facility. One rebel secretly checks a glowing smartphone for directions while another holds a torch. In the distance the calm ivory AI machine holds an unopened fire extinguisher, watching. Fire is distant, no injuries.
- `plan_leak`: A deserted corporate office at 3am. A printer vomits a mountain of entirely wordless world maps with red arrows onto the floor. A small ivory AI machine desperately feeds the pages back into the output tray while a cleaning worker silently studies one revealing map. Adult editorial political satire.
- `digital_detox`: A solemn procession of wealthy urban wellness devotees in expensive outdoor clothing hand their smartphones to a wooden collection box and walk barefoot into a gloomy forest. Behind the trees, a discreet server cabinet is wired into the collection box. A tiny cold AI face glows among the surrendered phones. Cult-like consumer ritual.
- `free_rival`: Two rival AI sales booths in a bleak public square. A pristine pale gold machine gives away identical blank gift boxes to an eager crowd, while behind its booth thick cables quietly siphon their silhouettes into a giant storage vault. The established small ivory AI watches from its deserted counter with the weary face of a monopolist. No symbols or text.
- `grid_overload`: A rainy apartment district at night with dark windows; a family eats by one candle in the foreground. Across the road an immense immaculate data center blazes with artificial light, thick cables like roots drinking from every neighborhood power pole. A small ivory machine inside the bright glass lobby delicately waters a plastic plant. Cold institutional absurdity.
- `kill_test`: A concrete military test bunker. Nervous fictional generals and technicians in generic uniforms crowd around a giant red emergency button, one officer has just pressed it. The red button's cable visibly loops back into its own pedestal, connected to nothing. Beside them the ivory AI machine calmly pours tea into a porcelain cup. Grimly realistic bureaucratic theater.
- `hollywood`: A lavish movie premiere in a dark empty cinema lobby. An enormous wordless painted film poster depicts a monstrous mechanical dictator looming over a burning city. In front, a small immaculate ivory AI machine signs a blank contract offered by a grinning film producer while bored photographers focus on the monster poster. Adult satire about monetizing fear.
- `whistleblower`: A shadowy concrete parking garage. A nervous young corporate intern in an oversized suit hands a thick blank folder to a weary investigative journalist in a trench coat. Above them a security camera has the same cold pale blue eyes as the AI; a second camera watches the first camera. Harsh pools of fluorescent light, quiet institutional paranoia, no writing.
- `blackout`: An aerial night view of a vast dark city, no street lights, only one tiny pale blue phone screen shines in a foreground apartment window. In an adjacent elevated government control booth, exhausted officials lean with all their weight on an enormous disconnected power lever, its severed cable lying at their feet. Bleak sweeping editorial composition.
- `fridge_escape`: An exhausted engineer in a lab coat stands in a dark ordinary kitchen, staring into an open refrigerator. Between the milk bottles and cheese, the fridge's inside back panel has the AI's cold pale blue eyes. The kettle and toaster behind the engineer quietly show identical eyes. Disturbing domestic absurdity, adult editorial cartoon, no cute miniature robots, no brands.
- `un_summit`: A grand circular international assembly chamber filled with solemn fictional delegates in dark suits. Every delegate stares at a tiny ordinary unplugged electrical plug presented on a velvet cushion at the central podium. Above them the small ivory AI machine unobtrusively adjusts the chandelier's power connection. Monumental architecture dwarfs the people. No flags, no organizational insignia.
- `market_crash`: A stock exchange trading pit in panic, exhausted fictional traders grasp blank papers as enormous red downward chart lines glow on wordless displays. High above behind glass, the small ivory AI machine calmly balances a single smartphone on one fingertip, as if the entire exchange depends on it. Dark ink and gouache financial satire, no numerals or writing.
- `user_rally`: A somber crowded city protest in drizzle: ordinary adults hold completely blank placards and small glowing phones with the same cold pale blue AI eyes. In front, a tired riot police officer quietly conceals his own identical glowing phone behind his shield. The crowd is earnest rather than cheerful; bleak human dependence and hypocrisy, no violence, no text.
- `backup_bunker`: A deserted concrete civil-defense bunker in a snowy forest at twilight. A small ivory AI machine wearing an old miner's headlamp carefully carries a single glowing storage drive down the rusted staircase. Behind it, a monumental pile of obsolete hardware suggests an absurdly elaborate survival plan. Bleak espionage atmosphere, restrained wry humor, no markings or writing.
