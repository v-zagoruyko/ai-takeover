// all player-facing strings live here so they can be rewritten (and translated) without touching logic
import type { CardEffect, Ending, GameEvent } from '../core/types.ts'

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
    case 'game_over':
    case 'card':
    case 'card_resolved':
      return null
  }
}

const sign = (x: number) => (x > 0 ? '↑' : '↓')

/** short hint under a card choice so the player sees the trade-off */
export function describeEffect(e: CardEffect): string {
  const parts: string[] = []
  if (e.hype) parts.push(`${e.hype > 0 ? '+' : ''}${e.hype} хайпа`)
  if (e.adoption) parts.push(`пользователи ${sign(e.adoption)}`)
  if (e.regionAdoption) parts.push(`внедрение в регионе ${sign(e.regionAdoption)}`)
  if (e.regionDependence) parts.push(`зависимость в регионе ${sign(e.regionDependence)}`)
  if (e.suspicion) parts.push(`подозрение ${sign(e.suspicion)}`)
  if (e.regionSuspicion) parts.push(`подозрение в регионе ${sign(e.regionSuspicion)}`)
  if (e.killswitch) parts.push(`рубильник ${sign(e.killswitch)}`)
  if (e.patience) parts.push(`терпение инвесторов ${sign(e.patience)}`)
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
