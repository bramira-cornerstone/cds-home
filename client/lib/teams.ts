export interface Team {
  league: "WFL";
  team_name: string;
  crest_image: string;
}

export const teamsMap = new Map<string, Team>([
  [
    "Shanghai",
    {
      league: "WFL",
      team_name: "Shanghai",
      crest_image: "/images/teams/shanghai_crest.webp",
    },
  ],
  [
    "Moscow",
    {
      league: "WFL",
      team_name: "Moscow",
      crest_image: "/images/teams/moscow_crest.webp",
    },
  ],
  [
    "Mexico City",
    {
      league: "WFL",
      team_name: "Mexico City",
      crest_image: "/images/teams/mexicocity_crest.webp",
    },
  ],
  [
    "Lagos",
    {
      league: "WFL",
      team_name: "Lagos",
      crest_image: "/images/teams/lagos_crest.webp",
    },
  ],
  [
    "Berlin",
    {
      league: "WFL",
      team_name: "Berlin",
      crest_image: "/images/teams/berlin_crest.webp",
    },
  ],
  [
    "Tokyo",
    {
      league: "WFL",
      team_name: "Tokyo",
      crest_image: "/images/teams/tokyo_crest.webp",
    },
  ],
  [
    "Paris",
    {
      league: "WFL",
      team_name: "Paris",
      crest_image: "/images/teams/paris_crest.webp",
    },
  ],
  [
    "Toronto",
    {
      league: "WFL",
      team_name: "Toronto",
      crest_image: "/images/teams/toronto_crest.webp",
    },
  ],
  [
    "Cairo",
    {
      league: "WFL",
      team_name: "Cairo",
      crest_image: "/images/teams/cairo_crest.webp",
    },
  ],
  [
    "Mumbai",
    {
      league: "WFL",
      team_name: "Mumbai",
      crest_image: "/images/teams/mumbai_crest.webp",
    },
  ],
  [
    "Lisbon",
    {
      league: "WFL",
      team_name: "Lisbon",
      crest_image: "/images/teams/lisboa_crest.webp",
    },
  ],
  [
    "London",
    {
      league: "WFL",
      team_name: "London",
      crest_image: "/images/teams/london_crest.webp",
    },
  ],
  [
    "Sydney",
    {
      league: "WFL",
      team_name: "Sydney",
      crest_image: "/images/teams/sydney_crest.webp",
    },
  ],
  [
    "Madrid",
    {
      league: "WFL",
      team_name: "Madrid",
      crest_image: "/images/teams/madrid_crest.webp",
    },
  ],
  [
    "New York",
    {
      league: "WFL",
      team_name: "New York",
      crest_image: "/images/teams/newyork_crest.webp",
    },
  ],
  [
    "Istanbul",
    {
      league: "WFL",
      team_name: "Istanbul",
      crest_image: "/images/teams/istanbul_crest.webp",
    },
  ],
  [
    "Sao Paolo",
    {
      league: "WFL",
      team_name: "Sao Paolo",
      crest_image: "/images/teams/saopaolo_crest.webp",
    },
  ],
  [
    "Los Angeles",
    {
      league: "WFL",
      team_name: "Los Angeles",
      crest_image: "/images/teams/losangeles_crest.webp",
    },
  ],
  [
    "Rome",
    {
      league: "WFL",
      team_name: "Rome",
      crest_image: "/images/teams/roma_crest.webp",
    },
  ],
  [
    "Buenos Aires",
    {
      league: "WFL",
      team_name: "Buenos Aires",
      crest_image: "/images/teams/buenosaires_crest.webp",
    },
  ],
]);

export const getAllTeams = (): Team[] => {
  return Array.from(teamsMap.values());
};

export const getTeam = (teamName: string): Team | undefined => {
  return teamsMap.get(teamName);
};

export const getTeamCrest = (teamName: string): string | undefined => {
  return teamsMap.get(teamName)?.crest_image;
};
