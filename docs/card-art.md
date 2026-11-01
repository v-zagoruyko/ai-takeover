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
