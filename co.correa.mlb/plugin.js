const teams =   {
  'Athletics': 133,
  'Pittsburgh Pirates': 134,
  'San Diego Padres': 135,
  'Seattle Mariners': 136,
  'San Francisco Giants': 137,
  'St. Louis Cardinals': 138,
  'Tampa Bay Rays': 139,
  'Texas Rangers': 140,
  'Toronto Blue Jays': 141,
  'Minnesota Twins': 142,
  'Philadelphia Phillies': 143,
  'Atlanta Braves': 144,
  'Chicago White Sox': 145,
  'Miami Marlins': 146,
  'New York Yankees': 147,
  'Milwaukee Brewers': 158,
  'Los Angeles Angels': 108,
  'Arizona Diamondbacks': 109,
  'Baltimore Orioles': 110,
  'Boston Red Sox': 111,
  'Chicago Cubs': 112,
  'Cincinnati Reds': 113,
  'Cleveland Guardians': 114,
  'Colorado Rockies': 115,
  'Detroit Tigers': 116,
  'Houston Astros': 117,
  'Kansas City Royals': 118,
  'Los Angeles Dodgers': 119,
  'Washington Nationals': 120,
  'New York Mets': 121
}

class ASC_URLSearchParams {
  constructor() {
    this.params = [];
  }

  append(key, value) {
    this.params.push({ key, value });
  }

  toString() {
    return this.params
    // .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .map(({ key, value }) => `${key}=${value}`)
    .join('&');
  }
}


function buildMLBScheduleURL({
  sportIds = [
    1,
  //   21, // MiLB (Minor League Baseball)
	//   51, // WBC or other international play
  ],
  startDate,
  endDate,
  gameTypes = [
    'E', // Exhibition
    'S', // Spring Training
    'R', // Regular Season
    'F', // Playoffs (Postseason)
    'D', // Division Series
    'L', // League Championship Series
    'W', // World Series
    'A', // All-Star
    'C'  // Wild Card
  ],
  language = 'en',
  leagueIds = [
    103, // American League
    104, // National League
    // 590, // Arizona Fall League
    // 160, // International League
    // 159, // Pacific Coast League
    // 420  // Dominican Summer League
  ],
  hydrateFields = [
    'team',
    'linescore(matchup,runners)',
    'xrefId',
    'story',
    'flags',
    'statusFlags',
    'broadcasts(all)',
    'venue(location)',
    'decisions',
    'person',
    'probablePitcher',
    'stats',
    'game(content(media(epg),summary))',
    'seriesStatus(useOverride=true)'
  ],
  sortBy = [],
  teamIds= [],
  season
}) {
  const baseUrl = 'https://statsapi.mlb.com/api/v1/schedule';
  const params = new ASC_URLSearchParams();

  // Add array-type query params with multiple values
  sportIds.forEach(id => params.append('sportId', id));
  gameTypes.forEach(type => params.append('gameType', type));
  leagueIds.forEach(id => params.append('leagueId', id));
  sortBy.forEach(sort => params.append('sortBy', sort));
  teamIds.forEach(teamId => params.append('teamId', teamId));

  // Add standard query params
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (language) params.append('language', language);
  if (season) params.append('season', season);
  
  // Add complex hydrate param
  if (hydrateFields.length > 0) {
    params.append('hydrate', hydrateFields.join(','));
  }

  return `${baseUrl}?${params.toString()}`;
}

function buildMLBHeadToHeadMediaUrl(teamId1, teamId2) {
  return `https://midfield.mlbstatic.com/v1/teams-matchup/${teamId1}-${teamId2}/ar_5:3/w_242`
}


function formatDate (date) {
  return date.toISOString().split('T')[0]
};

function load() {
  const ONLY_FINAL = false
  const todays_date = new Date()
  const fetch_to_date = new Date(todays_date.getTime() + 1 * 24 * 60 * 60 * 1000);
  const fetch_from_date = new Date(todays_date.getTime() - parseInt(days_to_fetch) * 24 * 60 * 60 * 1000);

  const teamIds = favorite_team_name == "All" ? [] : [teams[favorite_team_name]]
  console.log(favorite_team_name)
  console.log(days_to_fetch)

	const mlbScheduleUrl = buildMLBScheduleURL(
    {
      startDate: formatDate(fetch_from_date),
      endDate: formatDate(fetch_to_date),
      teamIds
    }
  )

  console.log(mlbScheduleUrl)
	let items = []

  sendRequest(mlbScheduleUrl)
  .then((text) => {
    const json = JSON.parse(text);
    let uri = site; 

    let games = []
    for (gameDate of json.dates) {games = [...games, ...gameDate.games]}

    if (ONLY_FINAL) {
      games = games.filter(g=>g.status.statusCode=="F")
    }

    for (const game of games) {
        const date =  Date.parse(game.gameDate)
        const item = Item.createWithUriDate(uri, date);
        const away_team = game.teams.away.team
        const home_team = game.teams.home.team
        item.uri = `https://www.mlb.com/gameday/${game.gamePk}`
        item.title = `${away_team.teamName} vs ${home_team.teamName} (${game.status.detailedState.toUpperCase()})`
        const results = `
            ${game.teams.away.isWinner ? '<b>' : ''}${away_team.abbreviation}${game.teams.away.isWinner ? '</b>' : ''} 
            ${game.teams.away.score} - ${game.teams.home.score}
            ${game.teams.home.isWinner ? '<b>' : ''} ${home_team.abbreviation}${game.teams.home.isWinner ? '</b>' : ''}
        `
        item.body = `
          ${
            game.status.statusCode == "F" || //Final: The game has completed.
            // game.status.statusCode == "S" //Scheduled (or Pre-Game): The game hasn’t started yet.
            game.status.statusCode == "I" || //In Progress: The game is currently live.
            game.status.statusCode == "D"    //Delayed: The game is running behind schedule.
            // game.status.statusCode == "O" //Postponed: The game has been postponed.
            ? results : ''
          }
          <br>${(new Date(game.gameDate)).toLocaleDateString()} ${(new Date(game.gameDate)).toLocaleTimeString(undefined, {hour: "numeric", minute: "numeric"})}
          <br><a href="https://baseball.theater/game/_/${game.gamePk}">Baseball Theater</a>
          <br><a href="https://${game.story?.link}">Story</a>
        `;
        const attachments = []
        // for (team_id of [away_team.id, home_team.id]) {
        const headToHeadMediaUrl = buildMLBHeadToHeadMediaUrl(away_team.id, home_team.id)
        const attachment = MediaAttachment.createWithUrl(headToHeadMediaUrl);
        // const attachment = MediaAttachment.createWithUrl(`https://midfield.mlbstatic.com/v1/team/${team_id}/spots/64`);
        attachment.mimeType = "image/png";
        attachment.text = `${game.teams.away.team.name} vs ${game.teams.home.team.name}`;
        attachment.aspectSize = {width: 242, height: 145};
        attachment.focalPoint = {x: 0, y: 0};
        attachments.push(attachment)
      // }
        item.attachments = attachments
        items.push(item)
    }
    return processResults(items);
  })
  
	.catch((requestError) => {
		processError(requestError);
	});
	
}
