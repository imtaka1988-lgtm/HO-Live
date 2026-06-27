/**
 * ESPN 赛程抓取服务 — 免费公开 API，无需 Key
 * 覆盖足球五大联赛+欧冠+世界杯、NBA/WNBA
 * 返回 15 天内的赛程
 */
const http = require("http");
const https = require("https");

const ESPN_BASE = "http://site.api.espn.com/apis/site/v2/sports";

// 中文队名翻译
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
  // NBA (complete)
  Lakers: "湖人", Warriors: "勇士", Celtics: "凯尔特人", Nuggets: "掘金",
  Bucks: "雄鹿", Heat: "热火", "76ers": "76人", Suns: "太阳", Mavericks: "独行侠",
  Knicks: "尼克斯", Thunder: "雷霆", Timberwolves: "森林狼", Clippers: "快船",
  Pelicans: "鹈鹕", Kings: "国王", Grizzlies: "灰熊", Raptors: "猛龙",
  Bulls: "公牛", Spurs: "马刺", "Trail Blazers": "开拓者", Rockets: "火箭",
  Pacers: "步行者", Wizards: "奇才", Magic: "魔术", Hornets: "黄蜂",
  Pistons: "活塞", Hawks: "老鹰", Jazz: "爵士", Cavaliers: "骑士", Nets: "篮网",
  // WNBA (complete)
  "Las Vegas Aces": "王牌", "New York Liberty": "自由人",
  "Indiana Fever": "狂热", "Phoenix Mercury": "水星",
  "Seattle Storm": "风暴", "Dallas Wings": "飞翼",
  "Connecticut Sun": "太阳", "Chicago Sky": "天空",
  "Atlanta Dream": "梦想", "Washington Mystics": "神秘人",
  "Portland Fire": "火焰", "Golden State Valkyries": "女武神",
  "Toronto Tempo": "节奏", "Los Angeles Sparks": "火花",
  "Minnesota Lynx": "山猫",
  // 俱乐部
  Arsenal: "阿森纳", "Manchester City": "曼城", "Manchester Utd": "曼联",
  Liverpool: "利物浦", Chelsea: "切尔西", Tottenham: "热刺",
  Barcelona: "巴萨", "Real Madrid": "皇马", "Atletico Madrid": "马竞",
  "Bayern Munich": "拜仁", Dortmund: "多特", "RB Leipzig": "莱比锡",
  Juventus: "尤文", "AC Milan": "AC米兰", "Inter Milan": "国米", Napoli: "那不勒斯",
  "Paris SG": "巴黎", PSG: "巴黎", Marseille: "马赛", Lyon: "里昂",
  "Manchester United": "曼联", "Manchester Utd": "曼联",
  "Tottenham Hotspur": "热刺", "Leicester City": "莱斯特城",
  "Everton": "埃弗顿", "Newcastle United": "纽卡斯尔",
  "Aston Villa": "阿斯顿维拉", "West Ham United": "西汉姆联",
  "Wolverhampton Wanderers": "狼队", "Crystal Palace": "水晶宫",
  "Brighton and Hove Albion": "布莱顿", "Fulham": "富勒姆",
  "Brentford": "布伦特福德", "Nottingham Forest": "诺丁汉森林",
  "Bournemouth": "伯恩茅斯", "Southampton": "南安普顿",
  "Leeds United": "利兹联", "Burnley": "伯恩利",
  "Real Madrid": "皇马", Barcelona: "巴萨",
  "Atlético Madrid": "马竞", "Atletico Madrid": "马竞",
  "Sevilla": "塞维利亚", "Real Sociedad": "皇家社会",
  "Villarreal": "比利亚雷亚尔", "Real Betis": "贝蒂斯",
  "Athletic Club": "毕尔巴鄂", "Valencia": "瓦伦西亚",
  "Bayern Munich": "拜仁", "Bayern München": "拜仁",
  Dortmund: "多特", "Borussia Dortmund": "多特",
  "RB Leipzig": "莱比锡", "Bayer Leverkusen": "勒沃库森",
  "Eintracht Frankfurt": "法兰克福", "VfL Wolfsburg": "沃尔夫斯堡",
  "Borussia Mönchengladbach": "门兴", "SC Freiburg": "弗赖堡",
  "TSG Hoffenheim": "霍芬海姆", "VfB Stuttgart": "斯图加特",
  "Werder Bremen": "不莱梅", "FC Augsburg": "奥格斯堡",
  Juventus: "尤文", "Inter Milan": "国米", "AC Milan": "AC米兰",
  Napoli: "那不勒斯", "AS Roma": "罗马", Roma: "罗马",
  Lazio: "拉齐奥", "Atalanta": "亚特兰大", "Fiorentina": "佛罗伦萨",
  "Paris Saint-Germain": "巴黎", Marseille: "马赛", Lyon: "里昂",
  Monaco: "摩纳哥", "AS Monaco": "摩纳哥", Lille: "里尔",
  "Stade Rennais": "雷恩", Nice: "尼斯", Lens: "朗斯",
  "Benfica": "本菲卡", Porto: "波尔图", Ajax: "阿贾克斯",
  "PSV Eindhoven": "埃因霍温", Feyenoord: "费耶诺德",
  Celtic: "凯尔特人", Rangers: "流浪者",
  "Shakhtar Donetsk": "顿涅茨克矿工", "Dinamo Zagreb": "萨格勒布迪纳摩",
  "Red Star Belgrade": "贝尔格莱德红星", Olympiacos: "奥林匹亚科斯",
  Galatasaray: "加拉塔萨雷", Fenerbahce: "费内巴切",
  "FC Copenhagen": "哥本哈根", "Club Brugge": "布鲁日",
  "Red Bull Salzburg": "萨尔茨堡红牛", "Young Boys": "年轻人",
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
  ["basketball", "wnba", "WNBA"],
];

function fetchUrl(url) {
  const mod = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSON parse error")); }
      });
    });
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
  });
}

function toBeijing(datetimeStr) {
  if (!datetimeStr) return ["", ""];
  try {
    const dt = new Date(datetimeStr.replace("Z", "+00:00"));
    // Beijing = UTC+8
    const bj = new Date(dt.getTime() + 8 * 3600 * 1000);
    const date = bj.toISOString().slice(0, 10);
    const time = bj.toISOString().slice(11, 16);
    return [date, time];
  } catch (_) {
    return [datetimeStr.slice(0, 10), datetimeStr.slice(11, 16) || ""];
  }
}

async function fetchAllEvents() {
  const allEvents = [];
  for (const [sport, code, leagueName] of LEAGUES) {
    try {
      const url = `${ESPN_BASE}/${sport}/${code}/scoreboard`;
      const data = await fetchUrl(url);
      const events = data.events || [];
      for (const e of events) {
        const comps = e.competitions ? e.competitions[0] : null;
        if (!comps) continue;
        const teams = comps.competitors || [];
        if (teams.length < 2) continue;
        let home = (teams[0].team || {}).displayName || "?";
        let away = (teams[1].team || {}).displayName || "?";
        home = TEAM_CN[home] || home;
        away = TEAM_CN[away] || away;
        const [date, time] = toBeijing(e.date || "");
        const status = (e.status || {}).type || {};
        allEvents.push({
          sport,
          league: leagueName,
          home,
          away,
          date,
          time,
          status: status.name || "",
          statusDesc: status.description || "",
          venue: (comps.venue || {}).fullName || "",
          detail: status.detail || "",
        });
      }
    } catch (_) {}
  }
  return allEvents;
}

/**
 * 获取未来 15 天内赛程
 */
async function getSchedule(days = 15) {
  const all = await fetchAllEvents();

  // Build date range
  const today = new Date();
  // reset to local midnight
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() + days * 86400 * 1000);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return all.filter(e => e.date >= todayStr && e.date <= cutoffStr);
}

module.exports = { getSchedule };
