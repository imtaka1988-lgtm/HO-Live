/**
 * 海鸥直播 V4.2 — 实时指数中英文词典
 *
 * 联赛名称、队伍名称统一中文化。
 * NBA / WNBA / NBL 联赛名保持原文，不做翻译。
 * 未收录队伍保留英文原名。
 */

export const LEAGUE_NAME_MAP = {
  "NBA": "NBA",
  "WNBA": "WNBA",
  "NBL": "NBL",

  "A-League": "澳超",
  "China Super League": "中超",
  "J1 League": "日职联",
  "K League 1": "韩K联",
  "Premier League": "英超",
  "La Liga": "西甲",
  "Serie A": "意甲",
  "Bundesliga": "德甲",
  "Ligue 1": "法甲",
  "MLS": "美职联",
  "Copa Libertadores": "解放者杯",
  "Copa Sudamericana": "南美杯"
};

export const SPORT_KEY_NAME_MAP = {
  "basketball_nba": "NBA",
  "basketball_wnba": "WNBA",
  "basketball_nbl": "NBL",

  "soccer_china_superleague": "中超",
  "soccer_japan_j1_league": "日职联",
  "soccer_korea_kleague1": "韩K联",
  "soccer_australia_aleague": "澳超",
  "soccer_sweden_allsvenskan": "瑞典超",
  "soccer_norway_eliteserien": "挪超",
  "soccer_finland_veikkausliiga": "芬超",
  "soccer_germany_bundesliga2": "德乙",
  "soccer_england_league1": "英甲",
  "soccer_england_league2": "英乙",
  "soccer_brazil_serie_b": "巴西乙",
  "soccer_chile_campeonato": "智利甲",
  "soccer_conmebol_copa_libertadores": "解放者杯",
  "soccer_conmebol_copa_sudamericana": "南美杯"
};

export const TEAM_NAME_MAP = {
  // NBA
  "Atlanta Hawks": "亚特兰大老鹰",
  "Boston Celtics": "波士顿凯尔特人",
  "Brooklyn Nets": "布鲁克林篮网",
  "Charlotte Hornets": "夏洛特黄蜂",
  "Chicago Bulls": "芝加哥公牛",
  "Cleveland Cavaliers": "克利夫兰骑士",
  "Dallas Mavericks": "达拉斯独行侠",
  "Denver Nuggets": "丹佛掘金",
  "Detroit Pistons": "底特律活塞",
  "Golden State Warriors": "金州勇士",
  "Houston Rockets": "休斯敦火箭",
  "Indiana Pacers": "印第安纳步行者",
  "Los Angeles Clippers": "洛杉矶快船",
  "Los Angeles Lakers": "洛杉矶湖人",
  "Memphis Grizzlies": "孟菲斯灰熊",
  "Miami Heat": "迈阿密热火",
  "Milwaukee Bucks": "密尔沃基雄鹿",
  "Minnesota Timberwolves": "明尼苏达森林狼",
  "New Orleans Pelicans": "新奥尔良鹈鹕",
  "New York Knicks": "纽约尼克斯",
  "Oklahoma City Thunder": "俄克拉荷马城雷霆",
  "Orlando Magic": "奥兰多魔术",
  "Philadelphia 76ers": "费城76人",
  "Phoenix Suns": "菲尼克斯太阳",
  "Portland Trail Blazers": "波特兰开拓者",
  "Sacramento Kings": "萨克拉门托国王",
  "San Antonio Spurs": "圣安东尼奥马刺",
  "Toronto Raptors": "多伦多猛龙",
  "Utah Jazz": "犹他爵士",
  "Washington Wizards": "华盛顿奇才",

  // WNBA
  "Atlanta Dream": "亚特兰大梦想",
  "Chicago Sky": "芝加哥天空",
  "Connecticut Sun": "康涅狄格太阳",
  "Dallas Wings": "达拉斯飞翼",
  "Golden State Valkyries": "金州女武神",
  "Indiana Fever": "印第安纳狂热",
  "Las Vegas Aces": "拉斯维加斯王牌",
  "Los Angeles Sparks": "洛杉矶火花",
  "Minnesota Lynx": "明尼苏达山猫",
  "New York Liberty": "纽约自由人",
  "Phoenix Mercury": "菲尼克斯水星",
  "Seattle Storm": "西雅图风暴",
  "Washington Mystics": "华盛顿神秘人",

  // 澳洲 NBL
  "Adelaide 36ers": "阿德莱德36人",
  "Brisbane Bullets": "布里斯班子弹",
  "Cairns Taipans": "凯恩斯太攀蛇",
  "Illawarra Hawks": "伊拉瓦拉老鹰",
  "Melbourne United": "墨尔本联",
  "New Zealand Breakers": "新西兰破坏者",
  "Perth Wildcats": "珀斯野猫",
  "South East Melbourne Phoenix": "东南墨尔本凤凰",
  "Sydney Kings": "悉尼国王",
  "Tasmania JackJumpers": "塔斯马尼亚跳蚁",

  // 新西兰 NBL
  "Otago Nuggets": "奥塔哥掘金",
  "Canterbury Rams": "坎特伯雷公羊",
  "Auckland Tuatara": "奥克兰蜥蜴",
  "Wellington Saints": "惠灵顿圣徒",
  "Taranaki Airs": "塔拉纳基空气",
  "Nelson Giants": "尼尔森巨人",
  "Southland Sharks": "南地鲨鱼",
  "Hawke's Bay Hawks": "霍克湾老鹰",
  "Franklin Bulls": "富兰克林公牛",
  "Manawatu Jets": "马纳瓦图喷气机",
  "Whai": "怀伊",
  "Bay Hawks": "海湾老鹰",

  // 中超
  "Shanghai Port": "上海海港",
  "Shanghai Shenhua": "上海申花",
  "Beijing Guoan": "北京国安",
  "Shandong Taishan": "山东泰山",
  "Chengdu Rongcheng": "成都蓉城",
  "Zhejiang Professional": "浙江队",
  "Zhejiang FC": "浙江队",
  "Tianjin Jinmen Tiger": "天津津门虎",
  "Henan Songshan Longmen": "河南队",
  "Wuhan Three Towns": "武汉三镇",
  "Changchun Yatai": "长春亚泰",
  "Qingdao Hainiu": "青岛海牛",
  "Qingdao West Coast": "青岛西海岸",
  "Shenzhen Peng City": "深圳新鹏城",
  "Meizhou Hakka": "梅州客家",
  "Yunnan Yukun": "云南玉昆",

  // 日职联
  "Vissel Kobe": "神户胜利船",
  "Yokohama F. Marinos": "横滨水手",
  "Kawasaki Frontale": "川崎前锋",
  "Urawa Red Diamonds": "浦和红钻",
  "Kashima Antlers": "鹿岛鹿角",
  "Cerezo Osaka": "大阪樱花",
  "Gamba Osaka": "大阪钢巴",
  "FC Tokyo": "FC东京",
  "Sanfrecce Hiroshima": "广岛三箭",
  "Nagoya Grampus": "名古屋鲸八",
  "Consadole Sapporo": "札幌冈萨多",
  "Avispa Fukuoka": "福冈黄蜂",
  "Albirex Niigata": "新潟天鹅",

  // 韩K联
  "Ulsan Hyundai": "蔚山现代",
  "Ulsan HD": "蔚山HD",
  "Jeonbuk Hyundai Motors": "全北现代",
  "FC Seoul": "首尔FC",
  "Pohang Steelers": "浦项制铁",
  "Suwon FC": "水原FC",
  "Daegu FC": "大邱FC",
  "Jeju United": "济州联",
  "Gangwon FC": "江原FC",
  "Gwangju FC": "光州FC",
  "Daejeon Hana Citizen": "大田市民",

  // 澳超
  "Sydney FC": "悉尼FC",
  "Melbourne Victory": "墨尔本胜利",
  "Melbourne City": "墨尔本城",
  "Western Sydney Wanderers": "西悉尼流浪者",
  "Adelaide United": "阿德莱德联",
  "Brisbane Roar": "布里斯班狮吼",
  "Central Coast Mariners": "中央海岸水手",
  "Newcastle Jets": "纽卡斯尔喷气机",
  "Perth Glory": "珀斯光荣",
  "Wellington Phoenix": "惠灵顿凤凰",
  "Macarthur FC": "麦克阿瑟FC",
  "Western United": "西部联",

  // 欧洲豪门
  "Manchester United": "曼联",
  "Manchester City": "曼城",
  "Liverpool": "利物浦",
  "Arsenal": "阿森纳",
  "Chelsea": "切尔西",
  "Tottenham Hotspur": "热刺",
  "Real Madrid": "皇家马德里",
  "Barcelona": "巴塞罗那",
  "Atletico Madrid": "马德里竞技",
  "Bayern Munich": "拜仁慕尼黑",
  "Borussia Dortmund": "多特蒙德",
  "Paris Saint Germain": "巴黎圣日耳曼",
  "PSG": "巴黎圣日耳曼",
  "Juventus": "尤文图斯",
  "Inter Milan": "国际米兰",
  "AC Milan": "AC米兰",
  "Napoli": "那不勒斯",
  "Roma": "罗马",
  "Ajax": "阿贾克斯",
  "Benfica": "本菲卡",
  "Porto": "波尔图",
  "Sporting Lisbon": "葡萄牙体育",

  // 简写兼容（Odds API 可能返回简称）
  "LAL": "湖人",
  "BOS": "凯尔特人",
  "GSW": "勇士",
  "MIL": "雄鹿",
  "MIA": "热火",
  "PHI": "76人",
  "DEN": "掘金",
  "DAL": "独行侠",
  "NYK": "尼克斯",
  "LAC": "快船",
  "PHX": "太阳",
  "MIN": "森林狼",
  "OKC": "雷霆",
  "SAC": "国王",
  "NOP": "鹈鹕",
  "HOU": "火箭",
  "SAS": "马刺",
  "MEM": "灰熊",
  "POR": "开拓者",
  "UTA": "爵士",
  "ATL": "老鹰",
  "CHA": "黄蜂",
  "CHI": "公牛",
  "CLE": "骑士",
  "DET": "活塞",
  "IND": "步行者",
  "ORL": "魔术",
  "TOR": "猛龙",
  "WAS": "奇才",
  "BKN": "篮网"
};

export function leagueName(name, sportKey) {
  if (sportKey && SPORT_KEY_NAME_MAP[sportKey]) return SPORT_KEY_NAME_MAP[sportKey];
  return LEAGUE_NAME_MAP[name] || name || "";
}

export function teamName(name) {
  return TEAM_NAME_MAP[name] || name || "";
}

export function matchName(home, away) {
  return teamName(home) + " vs " + teamName(away);
}
