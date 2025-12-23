import { PlaylistPayload } from "../types";

const BASE = import.meta.env.BASE_URL || "/";

export function getDemoPayload(pageUrl: string): PlaylistPayload {
  return {
    playlist_id: "sports-highlights",
    title: "Sports Highlights",
    context: { page_url: pageUrl },
    moments: [
      {
        content_id: "vid-1",
        type: "video",
        title: "Anthony Joshua KOs Jake Paul",
        src: `${BASE}Anthony%20Joshua%20KOs%20Jake%20Paul%20in%20a%20Sloppy%20Mess!.mp4`,
        tags: ["boxing", "knockout", "highlights", "combat"],
        globalPopularity: 0.9,
      },
      {
        content_id: "vid-2",
        type: "video",
        title: "Cam Little 73 Yard Field Goal",
        src: `${BASE}cam-little-73-yard-field-goal.mp4`,
        tags: ["nfl", "football", "field-goal", "record"],
        globalPopularity: 0.75,
      },
      {
        content_id: "ad-1",
        type: "ad",
        title: "Fluently AI",
        src: `${BASE}fluently-ad.mp4`,
        tags: ["ad", "tech", "ai"],
        sponsor: {
          name: "Fluently AI",
          ctaText: "Start now",
          ctaUrl: "https://app.getfluently.app/onboarding/intro?utm_content=FastestWay_MainFunnel_NEW_Video_AK016_9x16_EN_2.mp4&utm_source=google&utm_medium=cpc&utm_campaign=059_Google_DemandGen_WW_Broad_TopCreo_ALL_0812",
        },
      },
      {
        content_id: "vid-3",
        type: "video",
        title: "Jaguars Prove They Are to Be Feared",
        src: `${BASE}Jaguars%20Prove%20They%20Are%20to%20Be%20Feared.mp4`,
        tags: ["nfl", "football", "jaguars", "highlights"],
        globalPopularity: 0.65,
      },
      {
        content_id: "vid-4",
        type: "video",
        title: "Kenny Dillingham NIL Plea",
        src: `${BASE}Kenny%20Dillingham%20PLEADS%20for%20NIL%20Donations%20at%20Arizona%20State.mp4`,
        tags: ["college", "football", "nil", "coach"],
        globalPopularity: 0.55,
      },
      {
        content_id: "vid-5",
        type: "video",
        title: "Michael Irvin Miami CFP Reaction",
        src: `${BASE}Michael%20Irvin%20was%20GOING%20THROUGH%20IT%20During%20Miami%27s%20CFP%20Win%20%28via%20espn%29.mp4`,
        tags: ["college", "football", "miami", "reaction", "cfp"],
        globalPopularity: 0.7,
      },
      {
        content_id: "vid-6",
        type: "video",
        title: "NFL Bet of the Weekend",
        src: `${BASE}One%20NFL%20bet%20you%20HAVE%20to%20make%20this%20weekend.mp4`,
        tags: ["nfl", "football", "betting", "analysis"],
        globalPopularity: 0.6,
      },
      {
        content_id: "vid-7",
        type: "video",
        title: "Deni Avdija Takeover",
        src: `${BASE}deni-avdija-takeover.mp4`,
        tags: ["nba", "basketball", "deni-avdija", "trailblazers", "highlights"],
        globalPopularity: 0.8,
      },
      {
        content_id: "vid-8",
        type: "video",
        title: "Deni Avdija Crossover & Jam",
        src: `${BASE}deni-avdija-crossover-jam.mp4`,
        tags: ["nba", "basketball", "deni-avdija", "dunk", "crossover"],
        globalPopularity: 0.75,
      },
      {
        content_id: "vid-9",
        type: "video",
        title: "Deni Avdija SLAM!",
        src: `${BASE}deni-avdija-slam.mp4`,
        tags: ["nba", "basketball", "deni-avdija", "dunk", "highlights"],
        globalPopularity: 0.85,
      },
    ],
  };
}
