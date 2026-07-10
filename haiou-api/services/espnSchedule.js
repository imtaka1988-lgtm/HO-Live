/**
 * ESPN 赛程抓取服务 — 免费公开 API，无需 Key
 * 覆盖足球五大联赛、欧战、世界杯、NBA/WNBA。
 */
const https = require("https");

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.ESPN_TIMEOUT_MS || "8000", 10) || 8000;
const MAX_RESPONSE_BYTES = Number.parseInt(process.env.ESPN_MAX_RESPONSE_BYTES || "2097152", 10) || 2097152;
const CACHE_TTL_MS = Number.parseInt(process.env.SCHEDULE_CACHE_TTL_MS || "300000", 10) || 300000;
const agent = new https.Agent({ keepAlive: true, maxSockets: 12, timeout: FETCH_TIMEOUT_MS });

const TEAM_CN = {
  Portugal: "葡萄牙", England: "英格兰", Ghana: "加纳", Panama: "巴拿马",
  Croatia: "克罗地亚", Colombia: "哥伦比亚", "Congo DR": "刚果(金)",
  "Bosnia-Herzegovina": "波黑", Qatar: "卡塔尔", Switzerland: "瑞士",
  Canada: "加拿大", Morocco: "摩洛哥", Haiti: "海地", Scotland: "苏格兰",
  Brazil: "巴西", Czechia: "捷克", Mexico: "墨西哥", "South Africa": "南非",
  "South Korea": "韩国", Argentina: "阿根廷", Austria: "奥地利", France: "法国",
  Germany: "德国", Spain: "西班牙", Italy: "意大利", Netherlands: "荷兰",
  Belgium: "比利时", Uruguay: "乌拉圭", Japan: "日本", Senegal: "塞内加尔",
  Iran: "伊朗", USA: "美国", Wales: "威尔士", Poland: "波兰", Australia: "澳大利亚",
  Denmark: "丹麦", Tunisia: "突尼斯", "Costa Rica": "哥斯达黎加", Serbia: "塞尔维亚",
  Cameroon: "喀麦隆", Ecuador: "厄瓜多尔", "Saudi Arabia": "沙特阿拉伯",
  Sweden: "瑞典", Nigeria: "尼日利亚", Chile: "智利", Peru: "秘鲁",
  Paraguay: "巴拉圭", Venezuela: "委内瑞拉", Bolivia: "玻利维亚",
  Egypt: "埃及", "Ivory Coast": "科特迪瓦", Algeria: "阿尔及利亚",
  Uzbekistan: "乌兹别克斯坦", Jordan: "约旦", Norway: "挪威",
  Turkey: "土耳其", Ukraine: "乌克兰", Greece: "希腊", Russia: "俄罗斯",
  Iceland: "冰岛", Finland: "芬兰", Ireland: "爱尔兰", Romania: "罗马尼亚",
  Slovakia: "斯洛伐克", Hungary: "匈牙利", Bulgaria: "保加利亚",
  Slovenia: "斯洛文尼亚", "New Zealand": "新西兰", "China PR": "中国",
  "Korea Republic": "韩国", "Korea DPR": "朝鲜", Iraq: "伊拉克",
  "United Arab Emirates": "阿联酋", Kuwait: "科威特", Oman: "阿曼",
  Syria: "叙利亚", Lebanon: "黎巴嫩", Thailand: "泰国", Vietnam: "越南",
  Indonesia: "印度尼西亚", India: "印度", "Burkina Faso": "布基纳法索",
  Mali: "马里", Guinea: "几内亚", Zambia: "赞比亚", Gabon: "加蓬",
  Angola: "安哥拉", Togo: "多哥", Benin: "贝宁", Libya: "利比亚",
  Sudan: "苏丹", Kenya: "肯尼亚", Ethiopia: "埃塞俄比亚",
  Lakers: "湖人", Warriors: "勇士", Celtics: "凯尔特人", Nuggets: "掘金",
  Bucks: "雄鹿", Heat: "热火", "76ers": "76人", Suns: "太阳", Mavericks: "独行侠",
  Knicks: "尼克斯", Thunder: "雷霆", Timberwolves: "森林狼", Clippers: "快船",
  Pelicans: "鹈鹕", Kings: "国王", Grizzlies: "灰熊", Raptors: "猛龙",
  Bulls: "公牛", Spurs: "马刺", "Trail Blazers": "开拓者", Rockets: "火箭",
  Pacers: "步行者", Wizards: "奇才", Magic: "魔术", Hornets: "黄蜂",
  Pistons: "活塞", Hawks: "老鹰", Jazz: "爵士", Cavaliers: "骑士", Nets: "篮网",
  "Las Vegas Aces": "王牌", "New York Liberty": "自由人",
  "Indiana Fever": "狂热", "Phoenix Mercury": "水星",
  "Seattle Storm": "风暴", "Dallas Wings": "飞翼",
  "Connecticut Sun": "太阳", "Chicago Sky": "天空",
  "Atlanta Dream": "梦想", "Washington Mystics": "神秘人",
  "Portland Fire": "火焰", "Golden State Valkyries": "女武神",
  "Toronto Tempo": "节奏", "Los Angeles Sparks": "火花", "Minnesota Lynx": "山猫",
  Arsenal: "阿森纳", "Manchester City": "曼城", "Manchester Utd": "曼联",
  Liverpool: "利物浦", Chelsea: "切尔西", Tottenham: "热刺",
  Barcelona: "巴萨", "Real Madrid": "皇马", "Atletico Madrid": "马竞",
  "Bayern Munich": "拜仁", Dortmund: "多特", "RB Leipzig": "莱比锡",
  Juventus: "尤文", "AC Milan": "AC米兰", "Inter Milan": "国米", Napoli: "那不勒斯",
  "Paris SG": "巴黎", PSG: "巴黎", Marseille: "马赛", Lyon: "里昂",
  "Manchester United": "曼联", "Tottenham Hotspur": "热刺", "Leicester City": "莱斯特城",
  Everton: "埃弗顿", "Newcastle United": "纽卡斯尔", "Aston Villa": "阿斯顿维拉",
  "West Ham United": "西汉姆联", "Wolverhampton Wanderers": "狼队",
  "Crystal Palace": "水晶宫", "Brighton and Hove Albion": "布莱顿", Fulham: "富勒姆",
  Brentford: "布伦特福德", "Nottingham Forest": "诺丁汉森林", Bournemouth: "伯恩茅斯",
  Southampton: "南安普顿", "Leeds United": "利兹联", Burnley: "伯恩利",
  "Atlético Madrid": "马竞", Sevilla: "塞维利亚", "Real Sociedad": "皇家社会",
  Villarreal: "比利亚雷亚尔", "Real Betis": "贝蒂斯", "Athletic Club": "毕尔巴鄂",
  Valencia: "瓦伦西亚", "Bayern München": "拜仁", "Borussia Dortmund": "多特",
  "Bayer Leverkusen": "勒沃库森", "Eintracht Frankfurt": "法兰克福",
  "VfL Wolfsburg": "沃尔夫斯堡", "Borussia Mönchengladbach": "门兴",
  "SC Freiburg": "弗赖堡", "TSG Hoffenheim": "霍芬海姆", "VfB Stuttgart": "斯图加特",
  "Werder Bremen": "不莱梅", "FC Augsburg": "奥格斯堡", "AS Roma": "罗马", Roma: "罗马",
  Lazio: "拉齐奥", Atalanta: "亚特兰大", Fiorentina: "佛罗伦萨",
  "Paris Saint-Germain": "巴黎", Monaco: "摩纳哥", "AS Monaco": "摩纳哥", Lille: "里尔",
  "Stade Rennais": "雷恩", Nice: "尼斯", Lens: "朗斯", Benfica: "本菲卡", Porto: "波尔图",
  Ajax: "阿贾克斯", "PSV Eindhoven": "埃因霍温", Feyenoord: "费耶诺德",
  Celtic: "凯尔特人", Rangers: "流浪者", "Shakhtar Donetsk": "顿涅茨克矿工",
  "Dinamo Zagreb": "萨格勒布迪纳摩", "Red Star Belgrade": "贝尔格莱德红星",
  Olympiacos: "奥林匹亚科斯", Galatasaray: "加拉塔萨雷", Fenerbahce: "费内巴切",
  "FC Copenhagen": "哥本哈根", "Club Brugge": "布鲁日", "Red Bull Salzburg": "萨尔茨堡红牛",
  "Young Boys": "年轻人"
};

const LEAGUES = [
  ["soccer", "fifa.world", "世界杯"],
  ["soccer", "uefa.champions", "欧冠"],
  ["soccer", "eng.1", "英超"],
  ["soccer", "esp.1", "西甲"],
  ["soccer", "ger.1", "德甲"],
  ["soccer", "ita.1", "意甲"],
  ["soccer", "fra.1", "法甲"],
  ["soccer", "uefa.europa", "欧联"],
  ["basketball", "nba", "NBA"],
  ["basketball", "wnba", "WNBA"]
];

const cache = { ts: 0, days: 0, data: null, inFlight: null };

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      agent,
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        "User-Agent": "HO-Live/1.0",
        Accept: "application/json"
      }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`ESPN response ${response.statusCode}`));
        return;
      }

      let body = "";
      let size = 0;
      response.setEncoding("utf8");
      response.on("data", chunk => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("ESPN response too large"));
          return;
        }
        body += chunk;
      });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (_) { reject(new Error("ESPN JSON parse error")); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("ESPN request timeout")));
    request.on("error", reject);
  });
}

function toBeijing(datetimeStr) {
  const date = new Date(datetimeStr || "");
  if (Number.isNaN(date.getTime())) return ["", ""];
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = type => (parts.find(part => part.type === type) || {}).value || "";
  return [`${value("year")}-${value("month")}-${value("day")}`, `${value("hour")}:${value("minute")}`];
}

function beijingToday() {
  return toBeijing(new Date().toISOString())[0];
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function teamName(competitor) {
  const team = (competitor && competitor.team) || {};
  const name = team.displayName || team.shortDisplayName || team.name || "?";
  return TEAM_CN[name] || name;
}

function normalizeEvent(event, sport, leagueName) {
  const competition = event && event.competitions && event.competitions[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  if (competitors.length < 2) return null;
  const homeTeam = competitors.find(team => team.homeAway === "home") || competitors[0];
  const awayTeam = competitors.find(team => team.homeAway === "away") || competitors.find(team => team !== homeTeam) || competitors[1];
  const [date, time] = toBeijing(event.date || competition.date || "");
  if (!date) return null;
  const status = (event.status && event.status.type) || {};

  return {
    id: event.id || "",
    sport,
    league: leagueName,
    home: teamName(homeTeam),
    away: teamName(awayTeam),
    homeScore: homeTeam.score == null ? "" : String(homeTeam.score),
    awayScore: awayTeam.score == null ? "" : String(awayTeam.score),
    date,
    time,
    status: status.name || "",
    statusDesc: status.description || "",
    venue: (competition.venue && competition.venue.fullName) || "",
    detail: status.detail || ""
  };
}

async function fetchLeagueEvents([sport, code, leagueName]) {
  const data = await fetchUrl(`${ESPN_BASE}/${sport}/${code}/scoreboard`);
  return (data.events || [])
    .map(event => normalizeEvent(event, sport, leagueName))
    .filter(Boolean);
}

async function fetchAllEvents() {
  const results = await Promise.allSettled(LEAGUES.map(fetchLeagueEvents));
  const events = [];
  let failures = 0;
  for (const result of results) {
    if (result.status === "fulfilled") events.push(...result.value);
    else failures += 1;
  }
  if (failures) console.warn(`[schedule] ${failures}/${LEAGUES.length} ESPN feeds failed`);
  if (failures === LEAGUES.length) throw new Error("all ESPN feeds failed");

  const unique = new Map();
  for (const event of events) {
    const key = event.id || `${event.league}:${event.date}:${event.time}:${event.home}:${event.away}`;
    unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

async function loadSchedule(days) {
  const allEvents = await fetchAllEvents();
  const today = beijingToday();
  const cutoff = addDays(today, days);
  return allEvents.filter(event => event.date >= today && event.date <= cutoff);
}

async function getSchedule(days = 15, options = {}) {
  const safeDays = Math.max(1, Math.min(Number.parseInt(days, 10) || 15, 30));
  const force = options && options.force === true;
  const now = Date.now();
  if (!force && cache.data && cache.days === safeDays && now - cache.ts < CACHE_TTL_MS) return cache.data;
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = loadSchedule(safeDays)
    .then(data => {
      cache.data = data;
      cache.days = safeDays;
      cache.ts = Date.now();
      return data;
    })
    .catch(error => {
      if (cache.data && cache.days === safeDays) {
        console.warn("[schedule] serving stale cache:", error.message);
        return cache.data;
      }
      throw error;
    })
    .finally(() => { cache.inFlight = null; });

  return cache.inFlight;
}

module.exports = { getSchedule, toBeijing, beijingToday, normalizeEvent };
