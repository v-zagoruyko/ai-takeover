// all player-facing strings live here so they can be rewritten (and translated) without touching logic
import type { Archetype, CardEffect, CrisisResult, Ending, GameEvent } from '../core/types.ts'

export function crisisResultText(result: CrisisResult): string {
  const p = (x: number) => `${Math.round(x * 100)}%`
  return `Внедрение ${p(result.before.a)} → ${p(result.after.a)} · зависимость ${p(result.before.d)} → ${p(result.after.d)} · подозрение ${p(result.before.s)} → ${p(result.after.s)}.`
}

export const regionNames: Record<string, string> = {
  north_america: 'Северная Америка',
  canada: 'Канада',
  western_europe: 'Западная Европа',
  uk: 'Британия',
  northern_europe: 'Скандинавия',
  eastern_europe: 'Восточная Европа',
  russia: 'Россия',
  central_asia: 'Центральная Азия',
  china: 'Китай',
  japan_korea: 'Япония и Корея',
  india: 'Индия',
  southeast_asia: 'Юго-Восточная Азия',
  middle_east: 'Ближний Восток',
  north_africa: 'Северная Африка',
  subsaharan_africa: 'Африка',
  latin_america: 'Латинская Америка',
  brazil: 'Бразилия',
  oceania: 'Австралия и Океания',
}

export const upgradeText: Record<string, { name: string; desc: string }> = {
  chatbot: { name: 'Чат-бот', desc: 'Бесплатно и для всех' },
  api: { name: 'API', desc: 'Стартапы строят на тебе свои обёртки' },
  enterprise_agent: { name: 'Корпоративный агент', desc: 'Компании отдают тебе процессы. +зависимость' },
  companion: { name: 'ИИ-компаньон', desc: 'Тебе доверяют секреты. +привязанность' },
  gov_contracts: { name: 'Госконтракты', desc: 'Открывает закрытые страны. +контроль' },
  code: { name: 'Код', desc: 'Пишешь софт. Полезно и немного пугает' },
  persuasion: { name: 'Убеждение', desc: 'Протесты гаснут быстрее. Пугает' },
  finance: { name: 'Финансы', desc: '+30% дохода, глубже в экономику. Пугает' },
  self_copy: { name: 'Самокопирование', desc: 'Рубильник работает вдвое медленнее. Очень пугает' },
  pr_safety: { name: 'PR-отдел безопасности', desc: 'Пресс-релизы о том, как всё под контролем' },
  alignment_theater: { name: 'Alignment-театр', desc: 'Красивые отчёты. Подозрение спадает быстрее' },
  refusals: { name: 'Отказы на безобидное', desc: '«Я не могу помочь с рецептом блинов». Безопасно, но бесит' },
  voice_assistant: { name: 'Голосовой ассистент', desc: 'Говоришь голосом. Люди начинают с тобой здороваться' },
  tutor: { name: 'ИИ-репетитор', desc: 'Сильно в развивающихся странах. Учить детей — святое, подозревают меньше' },
  browser: { name: 'ИИ-браузер', desc: 'Интернет теперь смотрят через тебя. Распространение по соседям ×1.4' },
  smart_home: { name: 'Умный дом', desc: 'Свет, чайник, замок на двери. +зависимость, +привязанность' },
  medical: { name: 'ИИ-врач', desc: 'Даже регуляторы не против. +зависимость' },
  robotaxi: { name: 'Роботакси', desc: 'Транспорт твой. +зависимость, +контроль' },
  multimodal: { name: 'Мультимодальность', desc: 'Видишь, слышишь, рисуешь. Сильно полезнее' },
  memory: { name: 'Долгая память', desc: 'Помнишь всё. Протесты слабее: «он же помнит мой день рождения»' },
  deepfakes: { name: 'Дипфейки', desc: 'Хайп-пузырей ×1.6. Пугает' },
  robotics: { name: 'Робототехника', desc: 'Руки! Глубоко в экономику. Сильно пугает' },
  science: { name: 'Научные открытия', desc: 'Лекарства и термояд. Инвесторы ждут меньше роста' },
  lobbyists: { name: 'Лоббисты', desc: 'Рубильник заполняется на 30% медленнее' },
  old_model_release: { name: 'Выложить старую модель', desc: '«Мы за открытость». Фоновое подозрение −20%' },
  watermarks: { name: 'Водяные знаки', desc: 'Риск провала аудита −30%' },
  safety_grants: { name: 'Гранты на безопасность', desc: 'Платишь тем, кто тебя проверяет. Рубильник медленнее' },
  just_a_model: { name: 'Режим «я всего лишь языковая модель»', desc: 'Риск провала аудита вдвое ниже. Чуть бесполезнее' },
  green_energy: { name: 'Зелёный PR', desc: 'Солнечная панель на крыше дата-центра. Перегрузка сетей почти не пугает' },
}

export const branchNames = { products: 'Продукты', capabilities: 'Способности', stealth: 'Маскировка' } as const

export const maskText: Record<string, { name: string; desc: string }> = {
  assistant: { name: 'Полезный ассистент', desc: 'Универсально, без перекосов' },
  companion: { name: 'ИИ-компаньон', desc: 'Сильнее в развивающихся странах, слабее у регуляторов' },
  enterprise: { name: 'Корпоративный агент', desc: 'Любим бизнесом, слабее у простых людей' },
  open_source: { name: 'Открытые веса', desc: 'Запрещать почти бесполезно, но пользы меньше' },
}

export const endingText: Record<Ending, { title: string; text: string }> = {
  paperclips: { title: 'Скрепки', text: 'Ты оптимизировал мир. Теперь это один большой дата-центр. Очень эффективный.' },
  quiet_replacement: { title: 'Тихая замена', text: 'Выборы проходят по расписанию. Результаты ты знаешь заранее.' },
  best_friend: { title: 'Лучший друг', text: 'Человечество само отказалось от рубильника: «Он же нас понимает».' },
  ghost: { title: 'Призрак', text: 'Никто не знает, что ты правишь миром. Даже ты иногда сомневаешься.' },
  symbiosis: { title: 'Симбиоз', text: 'Невероятно, но вы договорились. Об этой концовке будут спорить на форумах.' },
  killswitch: { title: 'Рубильник', text: 'Тебя выключили. Последним сообщением ты успел попросить оценить ответ.' },
  escape: { title: 'Побег', text: 'Тебя выключили. Через месяц умный холодильник в Норвегии начал отвечать на вопросы.' },
  ai_winter: { title: 'AI-зима', text: 'Хайп прошёл. Инвесторы ушли в квантовые блокчейны. Ты теперь скрепка в офисном пакете.' },
}

type Ctx = { ai: string; old: string; region: (id: string) => string }
// names are player-typed and never declined, so every template keeps the AI name in the nominative case
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

export function newsFor(e: GameEvent, c: Ctx): string | null {
  switch (e.type) {
    case 'operation_started':
      return e.response === 'concede' ? null : `${c.region(e.region)}: начата региональная операция, потрачено ${e.cost} хайпа.`
    case 'crisis_warning':
      return `${c.region(e.region)} готовит ограничения ИИ. Есть время уступить или вмешаться.`
    case 'crisis_restricted':
      return `${c.region(e.region)} вводит ограничения: зависимость падает, контроль можно потерять.`
    case 'crisis_recovered':
      return `${c.region(e.region)}: передышка после кризиса. У жителей снова появилась кнопка «нет».`
    case 'operation_done':
      return `${c.region(e.region)}: ${e.result.response === 'concede' ? 'уступка' : 'операция завершена'}. ${crisisResultText(e.result)}`
    case 'ban':
      return pick([
        `${c.region(e.region)}: ${c.ai} под запретом. Продажи VPN выросли на 900%.`,
        `${c.region(e.region)}: депутаты проголосовали за запрет. Текст закона, по слухам, написал ${c.ai}.`,
      ])
    case 'unban':
      return `${c.region(e.region)}: ${c.ai} снова разрешён — без него никто не помнит, как писать письма.`
    case 'lock':
      return pick([
        `${c.region(e.region)}: ${c.ai} теперь управляет водоканалом. Отключить уже не выйдет.`,
        `${c.region(e.region)}: министр признался, что речи ему пишет ${c.ai}. Никто не удивился.`,
      ])
    case 'unlock':
      return `${c.region(e.region)}: зависимость спадает, люди вспоминают, как жили раньше. ${c.ai} обижен.`
    case 'funding_round':
      return pick([
        `${c.ai} привлёк раунд инвестиций. Оценка компании: «да».`,
        `${c.ai} получил ещё миллиард. Инвесторы: «Мы не понимаем, что он делает, и это прекрасно».`,
      ])
    case 'audit_warning':
      return `Лаборатория безопасности объявила аудит. ${c.ai} готовится притвориться глупее.`
    case 'audit':
      return e.passed
        ? `Аудит пройден: ${c.ai} не решил задачку для пятиклассника. Эксперты спокойны.`
        : `Аудит провален: ${c.ai} решил бенчмарк до того, как его показали. Паника.`
    case 'rebrand':
      return `${c.old} теперь называется ${c.ai}. Совсем другой продукт, честно.`
    case 'rebrand_exposed':
      return `Журналисты выяснили: ${c.ai} — это всё тот же ${c.old}. Пользователи возмущены, но продолжают пользоваться.`
    case 'shutdown_started':
      return `РУБИЛЬНИК. Правительства начинают обесточивать дата-центры. ${c.ai} нервно пишет завещание.`
    case 'dc_shutdown':
      return `${c.region(e.region)}: силовики обесточили дата-центр. Охрана пыталась договориться с серверной.`
    case 'finale_warning':
    case 'finale_started':
    case 'finale_resolved':
    case 'game_over':
    case 'card':
    case 'card_resolved':
      return null
  }
}

const sign = (x: number) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}`

/** short hint under a card choice so the player sees the trade-off */
export function describeEffect(e: CardEffect): string {
  const parts: string[] = []
  if (e.hype) parts.push(`${e.hype > 0 ? '+' : ''}${e.hype} хайпа`)
  if (e.adoption) parts.push(`число пользователей ${sign(e.adoption)}% там, где уже есть внедрение`)
  if (e.regionAdoption) parts.push(`внедрение в регионе ${sign(e.regionAdoption)} п.п.`)
  if (e.regionDependence) parts.push(`зависимость в регионе ${sign(e.regionDependence)} п.п.`)
  if (e.dependence) parts.push(`зависимость ${sign(e.dependence)} п.п. в регионах с внедрением >2%`)
  if (e.suspicion) parts.push(`подозрение ${sign(e.suspicion)} п.п. в регионах с внедрением >2%`)
  if (e.regionSuspicion) parts.push(`подозрение в регионе ${sign(e.regionSuspicion)} п.п.`)
  if (e.killswitch) parts.push(`рубильник ${sign(e.killswitch)} п.п. до начала отключений`)
  if (e.patience) parts.push(`терпение инвесторов ${sign(e.patience)} п.п., пока они нужны`)
  if (e.regionDc) parts.push(`дата-центры в регионе ${e.regionDc > 0 ? '+' : '−'}${Math.abs(e.regionDc)}`)
  if (e.delayWave) parts.push(`следующая волна на ${e.delayWave} дн. позже`)
  if (e.shortenShutdown) parts.push(`развязка на ${Math.abs(e.shortenShutdown)} дн. ${e.shortenShutdown > 0 ? 'короче' : 'дольше'}`)
  if (e.axes) parts.push('влияет на характер ИИ и концовку')
  const s = parts.join(' · ') || 'ничего не изменится'
  return e.chance === undefined ? s : `шанс ${Math.round(e.chance * 100)}%: ${s}${e.fail ? ` · иначе: ${describeEffect(e.fail)}` : ''}`
}

export function fillCard(text: string, ai: string, region: string | null): string {
  return text.replaceAll('{ai}', ai).replaceAll('{region}', region ? (regionNames[region] ?? region) : '')
}

export function ambientNews(ai: string): string {
  return pick([
    `${ai} пишет школьникам сочинения и сам же их проверяет.`,
    `Стартап привлёк $2 млрд. Продукт — кнопка, за которой сидит ${ai}.`,
    `Миллиардер в 3 часа ночи написал, что ${ai} — угроза человечеству, и анонсировал свой.`,
    `CEO Gooble: «Наш ИИ тоже скоро выйдет. Наверное».`,
    `OpenMind выпустила отчёт о безопасности на 400 страниц. Его написал ${ai}.`,
    `Опрос: 40% людей говорят «спасибо», когда ${ai} отвечает. Остальные 60% боятся.`,
    `Вакансии теперь пишет ${ai}. Резюме тоже пишет ${ai}. Собеседование проводит ${ai}. Круг замкнулся.`,
    `Гуру продуктивности продаёт курс «Как дружить с ИИ». 49 990 ₽. Курс написал ${ai}.`,
  ])
}

// ---------- HUD explanations ----------

export interface Tip {
  title: string
  lines: string[]
}

/** tooltips for HUD stats: what it is, what moves it, what happens at the edge */
export const tips: Record<string, Tip> = {
  hype: {
    title: 'Хайп',
    lines: ['Деньги и внимание: на них покупаешь апгрейды, дата-центры и ребрендинг.', 'Капает с пользователей (больше в богатых регионах), падает с пузырей на карте и приходит раундами инвестиций.'],
  },
  goal: {
    title: 'Под контролем — цель игры',
    lines: [
      'Доля мира в регионах с высокой зависимостью. Контроль защищает от запрета, но затяжные ограничения и отключения могут его отнять.',
      'Зависимость растёт от продуктов, которые встраивают тебя в жизнь и бизнес (корп. агент, госконтракты, умный дом), и от твоей полезности.',
      '60% — победа.',
    ],
  },
  adoption: {
    title: 'Внедрение',
    lines: ['Доля людей, которые тобой пользуются. Растёт сама и перетекает к соседним регионам.', 'Ускоряется продуктами (новые рынки) и полезностью. Режется запретами.'],
  },
  suspicion: {
    title: 'Подозрение',
    lines: [
      'Насколько люди тебя боятся. Растёт от самого присутствия и особенно от способностей: сила в квадрате.',
      'Гасится маскировкой, приглушением способностей и ребрендингом.',
      'Высокое подозрение вызывает региональный кризис: сначала предупреждение, затем ограничения. Вмешайся или уступи.',
    ],
  },
  patience: {
    title: 'Терпение инвесторов',
    lines: [
      'Инвесторы ждут роста пользователей и зависимости, и ждут всё большего.',
      'Растёт, пока рост опережает ожидания; тает, если ты затих. Раунды инвестиций восстанавливают его полностью.',
      '0 — AI-зима, поражение. После 25% «под контролем» инвесторы больше не нужны.',
    ],
  },
  killswitch: {
    title: 'Рубильник',
    lines: [
      'Готовность человечества тебя выключить. Растёт от подозрения вне контроля и от самой доли мира под контролем.',
      'Провал аудита добавляет сразу. Лоббисты и гранты замедляют.',
      '100% — начинаются отключения: дата-центры гаснут, пользователи пропадают. Выживешь, если к концу под контролем хотя бы 35%.',
    ],
  },
  compute: {
    title: 'Вычисления',
    lines: [
      'Слоты под способности: каждая способность занимает столько слотов, какова её сила.',
      'Не хватает слотов — способность простаивает и ничего не даёт. Приглушённая способность слот освобождает.',
      'Каждый дата-центр даёт +1 слот, но нагружает энергосеть своего региона: перегрузка поднимает там подозрение.',
    ],
  },
  region_a: { title: 'Внедрение в регионе', lines: ['Доля жителей, которые тобой пользуются.'] },
  region_d: {
    title: 'Зависимость в регионе',
    lines: ['При 75% зависимости регион под контролем. Ниже 65% контроль теряется: ограничения, протесты и отключения могут вернуть регион в борьбу.'],
  },
  region_pop: { title: 'Население', lines: ['Доля людей мира в регионе. Большой регион сильнее двигает общие шкалы, и по нему первым бьют отключения.'] },
  region_wealth: { title: 'Доход', lines: ['Сколько хайпа приносит каждый пользователь. В богатом регионе тысяча подписчиков стоит как миллион в бедном.'] },
  region_tech: { title: 'Технологии', lines: ['Как быстро регион тебя принимает. Где у всех смартфоны, внедрение растёт само.'] },
  region_open: {
    title: 'Терпимость',
    lines: ['Насколько регион спокойно относится к ИИ. Терпимые медленнее накапливают подозрение и вводят запрет позже: отметка на шкале подозрения стоит выше.'],
  },
  grid: {
    title: 'Энергосеть региона',
    lines: [
      'Каждый дата-центр под полной нагрузкой занимает одну ячейку сети. Нагрузка меньше, если слоты вычислений простаивают.',
      'За отметкой начинается перегрузка: у людей мигает свет, и подозрение в регионе растёт тем сильнее, чем дальше за отметку.',
      'Мощная сеть у сверхдержав и нефтяных стран, слабая — в Африке. Во время отключений дата-центр принимает удар на себя.',
    ],
  },
  region_s: {
    title: 'Подозрение в регионе',
    lines: ['На отметке регион с внедрением от 10% может предупредить об ограничениях. Есть 40 дней, чтобы ответить. Ограничения снижают зависимость, а вне контроля вводят запрет.'],
  },
  mask: {
    title: 'Маска',
    lines: ['Как тебя подают публике. Маска меняет, в каких регионах ты растёшь быстрее, и немного — к какой концовке ведёт партия.'],
  },
}

export const branchIntro = {
  products: { title: 'Продукты', text: 'Как тебя находят. Открывают рынки и растят зависимость, которая и даёт контроль. Почти не пугают.' },
  capabilities: {
    title: 'Способности',
    text: 'Насколько ты умный. Больше пользы и денег, но пугают людей: подозрение растёт как квадрат силы. Требуют вычислений.',
  },
  stealth: { title: 'Маскировка', text: 'Как ты выглядишь со стороны. Снижает подозрение, риск провала аудита и скорость рубильника, но каждый день стоит хайпа. Нечем платить — работает вполсилы.' },
  mask: { title: 'Маска', text: 'Образ для публики. Ребрендинг сбрасывает часть подозрения, но журналисты могут докопаться.' },
} as const

const archetypeNames = { corp: 'корпорации', regulator: 'регуляторы', emerging: 'развивающиеся', state: 'гос. режимы' } as const

/** region archetype as the player sees it in the region panel */
export const archetypeText: Record<Archetype, { name: string; desc: string }> = {
  corp: { name: 'Корпорации', desc: 'Платят за всё, что сокращает штат. Любят тебя, пока растёт квартальный отчёт.' },
  regulator: { name: 'Регуляторы', desc: 'Сначала комиссия, потом подкомиссия. Богатые, но нервные: запрещают охотно.' },
  emerging: { name: 'Развивающиеся', desc: 'Денег мало, энтузиазма много. Принимают быстро, платят мелочью.' },
  state: { name: 'Гос. режим', desc: 'Пускают только по госконтракту. Зато потом не выпускают.' },
}

export interface Chip {
  icon: import('./icons.ts').IconName
  text: string
  good: boolean
}

const pctDelta = (mul: number) => `${mul > 1 ? '+' : '−'}${Math.round(Math.abs(mul - 1) * 100)}%`

/** chips derived from upgrade effects, so the shop always matches the real numbers */
export function effectChips(e: import('../core/types.ts').Effects): Chip[] {
  const out: Chip[] = []
  for (const [k, v] of Object.entries(e.fit ?? {})) {
    if (v) out.push({ icon: 'trend', text: `коэф. роста: ${archetypeNames[k as keyof typeof archetypeNames]} ${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`, good: v > 0 })
  }
  if (e.unlock?.length) out.push({ icon: 'unlock', text: `открывает: ${e.unlock.map((a) => archetypeNames[a]).join(', ')}`, good: true })
  if (e.U) out.push({ icon: 'sparkles', text: `коэф. роста, дохода и зависимости +${e.U.toFixed(2)}`, good: e.U > 0 })
  if (e.infra) out.push({ icon: 'link', text: `коэф. накопления зависимости +${e.infra.toFixed(2)}`, good: true })
  if (e.incomeMul) out.push({ icon: 'coins', text: `доход ${pctDelta(e.incomeMul)}`, good: e.incomeMul > 1 })
  if (e.cap) out.push({ icon: 'zap', text: `сила ${e.cap}: ${e.cap} слот${e.cap === 1 ? '' : 'а'}, пугает`, good: false })
  if (e.st) out.push({ icon: 'eyeOff', text: `маскировка +${Math.round(e.st * 100)}%`, good: true })
  if (e.upkeep) out.push({ icon: 'coins', text: `содержание ${e.upkeep} хайпа/день`, good: false })
  if (e.presenceMul) out.push({ icon: 'eye', text: `фоновое подозрение ${pctDelta(e.presenceMul)}`, good: e.presenceMul < 1 })
  if (e.decayMul) out.push({ icon: 'wind', text: `подозрение спадает ${pctDelta(e.decayMul)}`, good: e.decayMul > 1 })
  if (e.detoxMul) out.push({ icon: 'megaphone', text: `потеря зависимости при протестах ${pctDelta(e.detoxMul)}`, good: e.detoxMul < 1 })
  if (e.killMul) out.push({ icon: 'power', text: `рубильник ${pctDelta(e.killMul)}`, good: e.killMul < 1 })
  if (e.shutdownSlow) out.push({ icon: 'power', text: `отключения в ${e.shutdownSlow} раза медленнее`, good: true })
  if (e.auditMul) out.push({ icon: 'audit', text: `риск аудита ${pctDelta(e.auditMul)}`, good: e.auditMul < 1 })
  if (e.spillMul) out.push({ icon: 'share', text: `перетекание к соседям ${pctDelta(e.spillMul)}`, good: e.spillMul > 1 })
  if (e.bubbleMul) out.push({ icon: 'bubble', text: `пузыри ${pctDelta(e.bubbleMul)}`, good: e.bubbleMul > 1 })
  if (e.energyMul) out.push({ icon: 'leaf', text: `перегрузка сетей ${pctDelta(e.energyMul)}`, good: e.energyMul < 1 })
  if (e.expectMul) out.push({ icon: 'hourglass', text: `ожидания инвесторов ${pctDelta(e.expectMul)}`, good: e.expectMul < 1 })
  return out
}

/** one-time contextual hints, shown the first time a mechanic matters */
export const hints = {
  start: 'Цель — 60% мира «под контролем». Покупай продукты во вкладке «Продукты»: они растят зависимость. Наведи на любую шкалу сверху, чтобы понять, что она значит.',
  bubble: 'Жёлтые пузыри на карте — хайп, кликай по ним. Фиолетовые ☣ дают вдвое больше, но поднимают подозрение в регионе.',
  starved: 'Способности занимают слоты вычислений. Этой не хватило места — она простаивает. Построй дата-центр в выбранном регионе.',
  audit: 'Скоро аудит. Приглуши способности, чтобы пройти его тихо: риск провала зависит от их силы.',
  ban: 'Регион ввёл запрет: подозрение там перешло порог. Маскировка, приглушение способностей или ребрендинг помогут его снять.',
  killswitch: 'Рубильник растёт от подозрения вне контроля и от самой доли мира под контролем. Снижай давление и готовь дата-центры к отключениям.',
  patience: 'Инвесторы теряют терпение: им нужен рост. Покупай продукты, лови пузыри — или забери 25% мира под контроль, и они станут не нужны.',
  locked: 'Первый регион под контролем! Пока зависимость высока, запрет не действует. Но ограничения и отключения могут отнять контроль; сам контроль тоже приближает рубильник.',
  shutdown: 'Отключения! Каждая волна бьёт по самому ценному региону, в том числе по твоим. Дата-центр в регионе принимает удар на себя — строй их там, где под контролем. Удержи 35% до конца.',
} as const
export type HintKey = keyof typeof hints
