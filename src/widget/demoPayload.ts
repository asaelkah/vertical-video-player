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
        src: `${BASE}Anthony Joshua KOs Jake Paul in a Sloppy Mess!.mp4`,
      },
      {
        content_id: "vid-2",
        type: "video",
        title: "Cam Little 73 Yard Field Goal",
        src: `${BASE}Cam Little from 73_! THATS NOT NORMAL  (via @NFL ).mp4`,
      },
      {
        content_id: "vid-3",
        type: "video",
        title: "Jaguars Prove They Are to Be Feared",
        src: `${BASE}Jaguars Prove They Are to Be Feared.mp4`,
      },
      {
        content_id: "vid-4",
        type: "video",
        title: "Kenny Dillingham NIL Plea",
        src: `${BASE}Kenny Dillingham PLEADS for NIL Donations at Arizona State.mp4`,
      },
      {
        content_id: "vid-5",
        type: "video",
        title: "Michael Irvin Miami CFP Reaction",
        src: `${BASE}Michael Irvin was GOING THROUGH IT During Miami's CFP Win (via espn).mp4`,
      },
      {
        content_id: "vid-6",
        type: "video",
        title: "NFL Bet of the Weekend",
        src: `${BASE}One NFL bet you HAVE to make this weekend.mp4`,
      },
    ],
  };
}
